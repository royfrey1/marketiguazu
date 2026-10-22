-- Migracion: Papelera de productos y borrado definitivo (PASO 1 de 3)
-- Fecha: 2026-10-22
-- Descripcion:
--   * products.deleted_at: marca de papelera (soft delete). Un producto en
--     papelera tiene deleted_at NOT NULL y activo = false forzosamente.
--   * RPCs admin: archive / restore / delete_info / delete_permanent.
--   * El borrado definitivo se hace SOLO via RPC SECURITY DEFINER:
--     limpia inventory_movements, inventory, price_history, cart_items,
--     product_images, product_variants y finalmente products.
--   * El borrado definitivo NUNCA borra archivos de Storage (el frontend
--     los limpia por API de Storage con los nombres devueltos en
--     storage_files; DB primero, Storage despues).
--   * RLS de products: se reemplaza products_admin_all (ALL) por policies
--     separadas SELECT/INSERT/UPDATE; no hay policy de DELETE directo,
--     el borrado es solo via RPC.
--   * inventory_admin_view excluye productos en papelera.
--   * update_admin_product rechaza editar productos en papelera.
--   * Nueva policy de storage.objects para que el admin pueda borrar
--     archivos del bucket publicaciones (los archivos viven en la raiz
--     del bucket, la policy existente solo borraba carpetas del usuario).
-- Comentarios en ASCII a proposito. Ejecutar con supabase db push --linked.

-- ============================================================
-- PARTE 1: esquema
-- ============================================================
ALTER TABLE public.products ADD COLUMN deleted_at timestamptz NULL;

CREATE INDEX products_deleted_at_idx ON public.products (deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_trash_inactive_chk
  CHECK (deleted_at IS NULL OR activo = false);

-- update_admin_product: version original + guardia de papelera.
-- El UPDATE no toca deleted_at, pero p_activo podria reactivar un
-- producto en papelera; ahora se bloquea con un error claro.
CREATE OR REPLACE FUNCTION public.update_admin_product(p_product_id integer, p_titulo text, p_slug text, p_category_id integer, p_precio numeric, p_descripcion text DEFAULT NULL::text, p_marca text DEFAULT NULL::text, p_precio_anterior numeric DEFAULT NULL::numeric, p_activo boolean DEFAULT true, p_destacado boolean DEFAULT false, p_peso_envio_gramos integer DEFAULT NULL::integer, p_alto_paquete_cm integer DEFAULT NULL::integer, p_ancho_paquete_cm integer DEFAULT NULL::integer, p_largo_paquete_cm integer DEFAULT NULL::integer, p_en_oferta boolean DEFAULT NULL::boolean, p_opcion_base_nombre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_old_price numeric;
  v_current_offer boolean;
  v_new_offer boolean;
  v_current_opcion text;
  v_deleted_at timestamptz;
  v_new_opcion text;
  v_product products%ROWTYPE;
BEGIN
  -- 1. Validar autorización admin
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No tenés permisos de administrador';
  END IF;

  -- Validar precio mayor a 0 (defensa temprana; el CHECK de la tabla es el respaldo)
  IF p_precio IS NULL OR p_precio <= 0 THEN
    RAISE EXCEPTION 'El precio debe ser mayor a 0'
      USING ERRCODE = '22023';
  END IF;
  -- 2. Obtener precio, en_oferta y opcion_base actuales antes del update
  SELECT precio, en_oferta, opcion_base_nombre, deleted_at
    INTO v_old_price, v_current_offer, v_current_opcion, v_deleted_at
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'PRODUCT_IN_TRASH: el producto esta en la papelera (id: %); usa restore_admin_product antes de editar', p_product_id
      USING ERRCODE = 'P4043';
  END IF;

  -- NULL = no cambiar el valor actual (admin actual no manda el parametro)
  v_new_offer := COALESCE(p_en_oferta, v_current_offer);

  -- opcion_base_nombre: NULL = no cambiar; '  ' = quitar (NULL);
  -- texto = guardar recortado.
  v_new_opcion := CASE
    WHEN p_opcion_base_nombre IS NULL THEN v_current_opcion
    WHEN btrim(p_opcion_base_nombre) = '' THEN NULL
    ELSE btrim(p_opcion_base_nombre)
  END;

  -- 2b. Validar la oferta ANTES de que salte el CHECK duro
  IF v_new_offer THEN
    IF p_precio_anterior IS NULL OR p_precio_anterior <= p_precio THEN
      RAISE EXCEPTION 'Para marcar una oferta, el precio anterior debe ser mayor que el precio actual. Si querés quitar la oferta, desmarcá en_oferta.'
        USING ERRCODE = '22023';
    END IF;
    IF p_precio_anterior > p_precio * 10 THEN
      RAISE EXCEPTION 'El descuento de la oferta no puede superar el 90%%. Precio anterior máximo permitido: %',
        round(p_precio * 10, 2)
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM product_variants
      WHERE product_id = p_product_id AND activo
    ) THEN
      RAISE EXCEPTION 'Este producto tiene variantes: marca la oferta en la variante correspondiente.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 3. Actualizar producto
  UPDATE products SET
    titulo = p_titulo,
    slug = p_slug,
    descripcion = p_descripcion,
    marca = p_marca,
    category_id = p_category_id,
    precio = p_precio,
    precio_anterior = p_precio_anterior,
    activo = p_activo,
    destacado = p_destacado,
    en_oferta = v_new_offer,
    opcion_base_nombre = v_new_opcion,
    peso_envio_gramos = p_peso_envio_gramos,
    alto_paquete_cm = p_alto_paquete_cm,
    ancho_paquete_cm = p_ancho_paquete_cm,
    largo_paquete_cm = p_largo_paquete_cm,
    updated_at = now()
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  -- 4. Si el precio cambió, registrar en price_history
  --    (cambio de precio + resultado en oferta -> 'promotion')
  IF v_old_price IS DISTINCT FROM p_precio THEN
    INSERT INTO price_history (
      product_id, precio_anterior, precio_nuevo, origen, user_id
    ) VALUES (
      p_product_id, v_old_price, p_precio,
      CASE WHEN v_new_offer THEN 'promotion' ELSE 'manual' END,
      v_user_id
    );
  END IF;

  -- 5. Devolver producto actualizado como JSONB
  RETURN to_jsonb(v_product);
END;
$function$;

-- ============================================================
-- PARTE 1b: inventory_admin_view excluye papelera
-- ============================================================
CREATE OR REPLACE VIEW public.inventory_admin_view AS
 SELECT i.id,
    i.product_id,
    i.variant_id,
    i.quantity,
    i.reserved,
    i.quantity - i.reserved AS available,
    i.low_stock_threshold,
    i.created_at,
    i.updated_at,
    p.titulo AS product_titulo,
    p.slug AS product_slug,
    p.activo AS product_activo,
    COALESCE(img_resuelta.url, p.imagen_url) AS product_imagen_url,
    p.category_id AS product_category_id,
    c.nombre AS category_nombre,
    pv.nombre AS variant_nombre,
    pv.sku AS variant_sku,
    COALESCE(pv.imagen_url, img_resuelta.url, p.imagen_url) AS variant_imagen_url,
    pv.activo AS variant_activo
   FROM inventory i
     JOIN products p ON p.id = i.product_id AND p.deleted_at IS NULL
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_variants pv ON pv.id = i.variant_id
     LEFT JOIN LATERAL ( SELECT pi.url
           FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.es_principal DESC, pi.sort_order, pi.created_at, pi.id
         LIMIT 1) img_resuelta ON true;

-- ============================================================
-- PARTE 1c: RLS de products
-- ============================================================
-- Se elimina el acceso DELETE directo de admin a la tabla products.
-- productsService.remove() del frontend no tiene llamadas (verificado);
-- el borrado definitivo pasa a ser exclusivo via RPC.
DROP POLICY IF EXISTS products_admin_all ON public.products;

CREATE POLICY products_admin_select ON public.products
  FOR SELECT USING (public.is_admin());

CREATE POLICY products_admin_insert ON public.products
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY products_admin_update ON public.products
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- products_public_read (SELECT activo=true) queda intacta: un producto
-- en papelera tiene activo=false garantizado por el CHECK, por lo que
-- la tienda/publico nunca lo ve.

-- ============================================================
-- PARTE 1d: policy de Storage para limpieza de imagenes
-- ============================================================
-- La policy existente "Usuarios eliminan sus imagenes" solo permite
-- borrar archivos dentro de una carpeta con el uid del usuario. Los
-- archivos del bucket publicaciones viven en la raiz, asi que el admin
-- no podia borrarlos. Se agrega una policy admin sobre el bucket.
CREATE POLICY storage_objects_admin_delete_publicaciones ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'publicaciones' AND public.is_admin());

-- ============================================================
-- PARTE 2: RPCs de la Papelera
-- ============================================================
-- Claves de error (mensaje empieza con la clave; SQLSTATE propio):
--   FORBIDDEN               P4003  no es admin
--   PRODUCT_NOT_FOUND       P4004  no existe el producto
--   PRODUCT_IN_TRASH        P4043  edit de producto en papelera
--   ALREADY_IN_TRASH        P4041  archive dos veces
--   NOT_IN_TRASH            P4042  restore sin estar en papelera
--   HAS_SALES               P4091  borrado definitivo con ventas
--   IN_CARTS                P4092  borrado definitivo en carritos
--   STOCK_CONFIRM_REQUIRED  P4093  stock>0 sin confirmacion
--   Slug ocupado (incluida en papelera): 23505 products_slug_key
CREATE OR REPLACE FUNCTION public.archive_admin_product(p_product_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_product products%ROWTYPE;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN: se requiere rol admin'
      USING ERRCODE = 'P4003';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND: no existe el producto (id: %)', p_product_id
      USING ERRCODE = 'P4004';
  END IF;

  IF v_product.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_IN_TRASH: el producto ya esta en la papelera (id: %)', p_product_id
      USING ERRCODE = 'P4041';
  END IF;

  UPDATE products
     SET deleted_at = now(),
         activo = false,
         destacado = false,
         updated_at = now()
   WHERE id = p_product_id
  RETURNING * INTO v_product;

  RETURN to_jsonb(v_product);
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_admin_product(p_product_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_product products%ROWTYPE;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN: se requiere rol admin'
      USING ERRCODE = 'P4003';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND: no existe el producto (id: %)', p_product_id
      USING ERRCODE = 'P4004';
  END IF;

  IF v_product.deleted_at IS NULL THEN
    RAISE EXCEPTION 'NOT_IN_TRASH: el producto no esta en la papelera (id: %)', p_product_id
      USING ERRCODE = 'P4042';
  END IF;

  -- activo queda en false a proposito: la reactivacion es una decision
  -- explicita del dueno desde el formulario de edicion.
  UPDATE products
     SET deleted_at = NULL,
         updated_at = now()
   WHERE id = p_product_id
  RETURNING * INTO v_product;

  RETURN to_jsonb(v_product);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_product_delete_info(p_product_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_product products%ROWTYPE;
  v_sales bigint;
  v_carts bigint;
  v_stock bigint;
  v_urls text[];
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN: se requiere rol admin'
      USING ERRCODE = 'P4003';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND: no existe el producto (id: %)', p_product_id
      USING ERRCODE = 'P4004';
  END IF;

  SELECT count(*) INTO v_sales FROM order_items WHERE product_id = p_product_id;
  SELECT count(*) INTO v_carts FROM cart_items WHERE product_id = p_product_id;
  SELECT COALESCE(sum(quantity), 0) INTO v_stock FROM inventory WHERE product_id = p_product_id;

  SELECT COALESCE(array_agg(pi.url ORDER BY pi.id), '{}') INTO v_urls
    FROM product_images pi WHERE pi.product_id = p_product_id;

  RETURN jsonb_build_object(
    'product_id', v_product.id,
    'titulo', v_product.titulo,
    'slug', v_product.slug,
    'in_trash', v_product.deleted_at IS NOT NULL,
    'has_sales', v_sales > 0,
    'sales_count', v_sales,
    'in_carts', v_carts > 0,
    'carts_count', v_carts,
    'has_stock', v_stock > 0,
    'stock_total', v_stock,
    'variant_count', (SELECT count(*) FROM product_variants WHERE product_id = p_product_id),
    'image_count', COALESCE(array_length(v_urls, 1), 0),
    'storage_urls', to_jsonb(v_urls),
    'storage_files', to_jsonb(ARRAY(
      SELECT regexp_replace(u, '^.*/publicaciones/', '')
        FROM unnest(v_urls) AS u
       WHERE u LIKE '%/publicaciones/%'
    ))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_admin_product_permanent(
  p_product_id integer,
  p_confirm_stock_loss boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_product products%ROWTYPE;
  v_sales bigint;
  v_carts bigint;
  v_stock bigint;
  v_urls text[];
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN: se requiere rol admin'
      USING ERRCODE = 'P4003';
  END IF;

  -- FOR UPDATE serialize contra archive/restore concurrentes
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND: no existe el producto (id: %)', p_product_id
      USING ERRCODE = 'P4004';
  END IF;

  IF v_product.deleted_at IS NULL THEN
    RAISE EXCEPTION 'NOT_IN_TRASH: el producto debe estar en la papelera para el borrado definitivo (id: %)', p_product_id
      USING ERRCODE = 'P4042';
  END IF;

  SELECT count(*) INTO v_sales FROM order_items WHERE product_id = p_product_id;
  IF v_sales > 0 THEN
    RAISE EXCEPTION 'HAS_SALES: el producto tiene % ventas registradas; no se puede borrar definitivamente (id: %)', v_sales, p_product_id
      USING ERRCODE = 'P4091';
  END IF;

  SELECT count(*) INTO v_carts FROM cart_items WHERE product_id = p_product_id;
  IF v_carts > 0 THEN
    RAISE EXCEPTION 'IN_CARTS: el producto esta en % carritos; sacalo de los carritos antes de borrarlo (id: %)', v_carts, p_product_id
      USING ERRCODE = 'P4092';
  END IF;

  SELECT COALESCE(sum(quantity), 0) INTO v_stock FROM inventory WHERE product_id = p_product_id;
  IF v_stock > 0 AND NOT COALESCE(p_confirm_stock_loss, false) THEN
    RAISE EXCEPTION 'STOCK_CONFIRM_REQUIRED: el producto tiene stock %; confirma la perdida de stock para borrarlo (id: %)', v_stock, p_product_id
      USING ERRCODE = 'P4093';
  END IF;

  SELECT COALESCE(array_agg(pi.url ORDER BY pi.id), '{}') INTO v_urls
    FROM product_images pi WHERE pi.product_id = p_product_id;

  -- Orden respetando FKs RESTRICT (movimientos -> inventory ->
  -- price_history/cart_items/imagenes -> variantes -> producto).
  DELETE FROM inventory_movements
   WHERE inventory_id IN (SELECT id FROM inventory WHERE product_id = p_product_id);

  DELETE FROM inventory WHERE product_id = p_product_id;
  DELETE FROM price_history WHERE product_id = p_product_id;
  DELETE FROM cart_items WHERE product_id = p_product_id;
  DELETE FROM product_images WHERE product_id = p_product_id;
  DELETE FROM product_variants WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;

  -- El frontend limpia Storage con storage_files (solo nombres de este
  -- bucket); DB primero, Storage despues.
  RETURN jsonb_build_object(
    'deleted', true,
    'product_id', p_product_id,
    'titulo', v_product.titulo,
    'slug', v_product.slug,
    'stock_removed', v_stock,
    'storage_urls', to_jsonb(v_urls),
    'storage_files', to_jsonb(ARRAY(
      SELECT regexp_replace(u, '^.*/publicaciones/', '')
        FROM unnest(v_urls) AS u
       WHERE u LIKE '%/publicaciones/%'
    ))
  );
END;
$function$;

-- ============================================================
-- PARTE 2b: grants (sin acceso anon a las RPCs admin)
-- ============================================================
REVOKE ALL ON FUNCTION public.archive_admin_product(integer) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.archive_admin_product(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restore_admin_product(integer) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.restore_admin_product(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_admin_product_delete_info(integer) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.get_admin_product_delete_info(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_admin_product_permanent(integer, boolean) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.delete_admin_product_permanent(integer, boolean) TO authenticated, service_role;

-- ============================================================
-- PARTE 5 (preview): recargar el cache de PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';