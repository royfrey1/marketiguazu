-- ============================================================
-- FASE 2 — Ofertas: RPCs de admin con p_en_oferta.
--
-- Como cambian las firmas, se hace DROP FUNCTION (firma vieja
-- exacta) + CREATE en la misma migracion/transaccion. Los cuerpos
-- parten de los definidos originalmente en:
--   20260908123000_admin_product_rpc_transactions.sql (productos)
--   20260916150000_fix_variant_price_history_xor.sql (variantes)
-- y se modifican lo minimo para soportar en_oferta.
--
-- Retrocompatibilidad: el admin actual NO manda p_en_oferta.
--   * CREATE: DEFAULT false (producto nuevo sin oferta).
--   * UPDATE: DEFAULT NULL = "no cambiar el valor actual" (un
--     DEFAULT false apagaria las ofertas en cada edicion).
--   * SECURITY DEFINER, search_path, owner y la validacion interna
--     de admin se conservan identicos; los GRANT EXECUTE se
--     re-aplican al final (DROP+CREATE los resetea).
--
-- price_history: si cambia el precio y el resultado queda con
-- en_oferta = true -> origen = 'promotion' (valor ya permitido por
-- el CHECK de origen; no se modifica dicho CHECK). Cualquier otro
-- caso -> 'manual' como hasta ahora.
-- ============================================================

-- ------------------------------------------------------------
-- 1. create_admin_product (firma vieja + p_en_oferta DEFAULT false)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_admin_product(
  text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer
);

CREATE FUNCTION public.create_admin_product(
  p_titulo text,
  p_slug text,
  p_category_id integer,
  p_precio numeric,
  p_descripcion text DEFAULT NULL::text,
  p_marca text DEFAULT NULL::text,
  p_precio_anterior numeric DEFAULT NULL::numeric,
  p_activo boolean DEFAULT true,
  p_destacado boolean DEFAULT false,
  p_peso_envio_gramos integer DEFAULT NULL::integer,
  p_alto_paquete_cm integer DEFAULT NULL::integer,
  p_ancho_paquete_cm integer DEFAULT NULL::integer,
  p_largo_paquete_cm integer DEFAULT NULL::integer,
  p_en_oferta boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
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

  -- 1b. Validar la oferta ANTES de que salte el CHECK duro
  IF p_en_oferta THEN
    IF p_precio_anterior IS NULL OR p_precio_anterior <= p_precio THEN
      RAISE EXCEPTION 'Para marcar una oferta, el precio anterior debe ser mayor que el precio actual.'
        USING ERRCODE = '22023';
    END IF;
    IF p_precio_anterior > p_precio * 10 THEN
      RAISE EXCEPTION 'El descuento de la oferta no puede superar el 90%%. Precio anterior máximo permitido: %',
        round(p_precio * 10, 2)
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 2. Insertar producto
  INSERT INTO products (
    titulo, slug, descripcion, marca, category_id,
    precio, precio_anterior, activo, destacado,
    peso_envio_gramos, alto_paquete_cm, ancho_paquete_cm, largo_paquete_cm,
    en_oferta
  ) VALUES (
    p_titulo, p_slug, p_descripcion, p_marca, p_category_id,
    p_precio, p_precio_anterior, p_activo, p_destacado,
    p_peso_envio_gramos, p_alto_paquete_cm, p_ancho_paquete_cm, p_largo_paquete_cm,
    p_en_oferta
  )
  RETURNING * INTO v_product;

  -- 3. Crear inventario inicial (quantity=0, reserved=0)
  INSERT INTO inventory (
    product_id, quantity, reserved, low_stock_threshold
  ) VALUES (
    v_product.id, 0, 0, 5
  );

  -- 4. Registrar precio inicial en price_history.
  --    Alta sin cambio de precio -> origen 'manual'
  --    (el caso 'promotion' aplica a cambios de precio, ver update).
  INSERT INTO price_history (
    product_id, precio_anterior, precio_nuevo, origen, user_id
  ) VALUES (
    v_product.id, v_product.precio, v_product.precio, 'manual', v_user_id
  );

  -- 5. Devolver producto creado como JSONB
  RETURN to_jsonb(v_product);
END;
$function$;

-- ------------------------------------------------------------
-- 2. update_admin_product (firma vieja + p_en_oferta DEFAULT NULL)
--    DEFAULT NULL = no cambiar el en_oferta actual.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_admin_product(
  integer, text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer
);

CREATE FUNCTION public.update_admin_product(
  p_product_id integer,
  p_titulo text,
  p_slug text,
  p_category_id integer,
  p_precio numeric,
  p_descripcion text DEFAULT NULL::text,
  p_marca text DEFAULT NULL::text,
  p_precio_anterior numeric DEFAULT NULL::numeric,
  p_activo boolean DEFAULT true,
  p_destacado boolean DEFAULT false,
  p_peso_envio_gramos integer DEFAULT NULL::integer,
  p_alto_paquete_cm integer DEFAULT NULL::integer,
  p_ancho_paquete_cm integer DEFAULT NULL::integer,
  p_largo_paquete_cm integer DEFAULT NULL::integer,
  p_en_oferta boolean DEFAULT NULL
)
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

  -- 2. Obtener precio y en_oferta actuales antes del update
  SELECT precio, en_oferta
    INTO v_old_price, v_current_offer
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  -- NULL = no cambiar el valor actual (admin actual no manda el parametro)
  v_new_offer := COALESCE(p_en_oferta, v_current_offer);

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

-- ------------------------------------------------------------
-- 3. create_product_variant (firma vieja + p_en_oferta DEFAULT false)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_product_variant(
  integer, text, text, numeric, numeric, jsonb, text, boolean
);

CREATE FUNCTION public.create_product_variant(
  p_product_id integer,
  p_sku text,
  p_nombre text,
  p_precio numeric,
  p_precio_anterior numeric DEFAULT NULL::numeric,
  p_atributos jsonb DEFAULT NULL::jsonb,
  p_imagen_url text DEFAULT NULL::text,
  p_activo boolean DEFAULT true,
  p_en_oferta boolean DEFAULT false
)
RETURNS SETOF product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_variant record;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  -- Validar la oferta ANTES de que salte el CHECK duro
  IF p_en_oferta THEN
    IF p_precio_anterior IS NULL OR p_precio_anterior <= p_precio THEN
      RAISE EXCEPTION 'Para marcar una oferta, el precio anterior debe ser mayor que el precio actual.'
        USING ERRCODE = '22023';
    END IF;
    IF p_precio_anterior > p_precio * 10 THEN
      RAISE EXCEPTION 'El descuento de la oferta no puede superar el 90%%. Precio anterior máximo permitido: %',
        round(p_precio * 10, 2)
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- NOTA (decisión de diseño): si el producto tiene en_oferta = true
  -- a nivel producto y esta es su PRIMERA variante activa, la regla
  -- de la vista products_ofertas hace que deje de contar el flag del
  -- producto (con variantes activas manda la variante). NO se
  -- desactiva el flag del producto en silencio: queda tal cual y la
  -- vista lo ignora; el frontend/admin debera avisar que la oferta
  -- ahora se marca en la variante.

  -- Crear variante
  INSERT INTO product_variants (
    product_id, sku, nombre, precio, precio_anterior,
    atributos, imagen_url, activo, en_oferta
  ) VALUES (
    p_product_id, p_sku, p_nombre, p_precio, p_precio_anterior,
    p_atributos, p_imagen_url, p_activo, p_en_oferta
  )
  RETURNING * INTO v_variant;

  -- Crear inventory inicial
  INSERT INTO inventory (product_id, variant_id, quantity, reserved, low_stock_threshold)
  VALUES (p_product_id, v_variant.id, 0, 0, 5);

  -- Registrar precio inicial en price_history
  -- XOR: product_id=NULL, variant_id=Y (historial de variante)
  -- Alta sin cambio de precio -> origen 'manual'
  INSERT INTO price_history (
    product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id
  ) VALUES (
    NULL, v_variant.id,
    COALESCE(p_precio_anterior, p_precio),
    p_precio,
    'manual',
    auth.uid()
  );

  RETURN QUERY SELECT * FROM product_variants WHERE id = v_variant.id;
END;
$function$;

-- ------------------------------------------------------------
-- 4. update_product_variant (firma vieja + p_en_oferta DEFAULT NULL)
--    DEFAULT NULL = no cambiar el en_oferta actual.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_product_variant(
  integer, text, text, numeric, numeric, jsonb, text, boolean
);

CREATE FUNCTION public.update_product_variant(
  p_variant_id integer,
  p_sku text,
  p_nombre text,
  p_precio numeric,
  p_precio_anterior numeric DEFAULT NULL::numeric,
  p_atributos jsonb DEFAULT NULL::jsonb,
  p_imagen_url text DEFAULT NULL::text,
  p_activo boolean DEFAULT true,
  p_en_oferta boolean DEFAULT NULL
)
RETURNS SETOF product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_old_precio numeric;
  v_current_offer boolean;
  v_new_offer boolean;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  -- Obtener precio y en_oferta actuales
  SELECT precio, en_oferta
    INTO v_old_precio, v_current_offer
  FROM product_variants WHERE id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada (id: %)', p_variant_id;
  END IF;

  -- NULL = no cambiar el valor actual (admin actual no manda el parametro)
  v_new_offer := COALESCE(p_en_oferta, v_current_offer);

  -- Validar la oferta ANTES de que salte el CHECK duro
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
  END IF;

  -- Actualizar variante
  UPDATE product_variants
  SET sku = p_sku,
      nombre = p_nombre,
      precio = p_precio,
      precio_anterior = p_precio_anterior,
      atributos = p_atributos,
      imagen_url = p_imagen_url,
      activo = p_activo,
      en_oferta = v_new_offer,
      updated_at = now()
  WHERE id = p_variant_id;

  -- Registrar cambio de precio solo si cambió
  -- XOR: product_id=NULL, variant_id=Y (historial de variante)
  -- (cambio de precio + resultado en oferta -> 'promotion')
  IF v_old_precio IS DISTINCT FROM p_precio THEN
    INSERT INTO price_history (
      product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id
    ) VALUES (
      NULL, p_variant_id, v_old_precio, p_precio,
      CASE WHEN v_new_offer THEN 'promotion' ELSE 'manual' END,
      auth.uid()
    );
  END IF;

  RETURN QUERY SELECT * FROM product_variants WHERE id = p_variant_id;
END;
$function$;

-- ------------------------------------------------------------
-- 5. GRANT EXECUTE: los mismos roles que tenian antes
--    (anon, authenticated, service_role — verificados en el backup
--    de backup/2026-10-09-ofertas/grants.json). DROP+CREATE resetea
--    el ACL, asi que se re-aplican.
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_admin_product(
  text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_admin_product(
  integer, text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_product_variant(
  integer, text, text, numeric, numeric, jsonb, text, boolean, boolean
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_product_variant(
  integer, text, text, numeric, numeric, jsonb, text, boolean, boolean
) TO anon, authenticated, service_role;
