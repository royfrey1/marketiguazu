-- ============================================================
-- OPCIÓN BASE OPT-IN en productos con variantes (Fase 1: BD+servidor)
-- ============================================================
-- Contexto: hoy, si un producto tiene variantes activas, el producto
-- base deja de ser una opción vendible (get_product_availability solo
-- suma stock de variantes; la ficha solo ofrece variantes).
--
-- Solución OPT-IN: columna nueva products.opcion_base_nombre.
--   * NULL (default)  -> el producto se comporta EXACTAMENTE como hoy.
--   * con nombre      -> la opción base es elegible y su stock cuenta.
--
-- Decisiones aprobadas:
--   * La opción base NO entra en ofertas: la regla "producto con
--     variantes activas = oferta por variante (flag del producto se
--     ignora)" NO cambia.
--   * La opción base usa el precio de products.precio y el stock de
--     la fila base de inventory (variant_id IS NULL), que ya se carga
--     en la pantalla de ajuste de stock vía adjust_stock.
--   * Productos SIN variantes: sin cambios.
--   * Variantes todas inactivas: sin cambios (no aparecen).
--   * Solo aparece si available > 0 (regla actual respetada).
--
-- NO se modifican: reserve_stock, confirm_sale, adjust_stock,
-- create_product_variant ni las funciones de ofertas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. COLUMNA + CHECK
-- ------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN opcion_base_nombre text NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_opcion_base_nombre_len_chk
  CHECK (opcion_base_nombre IS NULL
         OR char_length(btrim(opcion_base_nombre)) BETWEEN 1 AND 60);

-- ------------------------------------------------------------
-- 2. get_product_availability: mismo contrato y atributos.
--    ÚNICO cambio: para productos CON variantes activas, si
--    opcion_base_nombre IS NOT NULL, available = suma de variantes
--    + stock de la fila base (coalesce; 0 si no hay fila).
--    Con opcion_base_nombre IS NULL el resultado es idéntico al
--    anterior (verificado en el ensayo con la comparación completa).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_availability()
 RETURNS TABLE(product_id integer, available integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH product_variant_info AS (
    SELECT
      p.id AS product_id,
      COUNT(pv.id) AS variant_count,
      BOOL_OR(pv.activo) AS has_active_variant
    FROM public.products AS p
    LEFT JOIN public.product_variants AS pv
      ON pv.product_id = p.id
    WHERE p.activo = true
    GROUP BY p.id
  ),
  product_level_stock AS (
    SELECT
      p.id AS product_id,
      (i.quantity - i.reserved)::integer AS available
    FROM public.products AS p
    INNER JOIN product_variant_info AS pvi
      ON pvi.product_id = p.id
    INNER JOIN public.inventory AS i
      ON i.product_id = p.id
     AND i.variant_id IS NULL
    WHERE p.activo = true
      AND pvi.variant_count = 0
      AND (i.quantity - i.reserved) > 0
  ),
  variant_level_stock AS (
    SELECT
      p.id AS product_id,
      (
        COALESCE(vs.variant_available, 0)
        + CASE
            WHEN p.opcion_base_nombre IS NOT NULL
              THEN COALESCE(bs.base_available, 0)
            ELSE 0
          END
      )::integer AS available
    FROM public.products AS p
    INNER JOIN product_variant_info AS pvi
      ON pvi.product_id = p.id
     AND pvi.variant_count > 0
     AND pvi.has_active_variant = true
    LEFT JOIN LATERAL (
      SELECT SUM(i.quantity - i.reserved)::integer AS variant_available
      FROM public.inventory AS i
      INNER JOIN public.product_variants AS pv
        ON pv.id = i.variant_id
       AND pv.product_id = i.product_id
       AND pv.activo = true
      WHERE i.product_id = p.id
        AND i.variant_id IS NOT NULL
        AND (i.quantity - i.reserved) > 0
    ) vs ON true
    LEFT JOIN LATERAL (
      SELECT (i.quantity - i.reserved)::integer AS base_available
      FROM public.inventory AS i
      WHERE i.product_id = p.id
        AND i.variant_id IS NULL
    ) bs ON true
    WHERE p.activo = true
      AND (
        COALESCE(vs.variant_available, 0)
        + CASE
            WHEN p.opcion_base_nombre IS NOT NULL
              THEN COALESCE(bs.base_available, 0)
            ELSE 0
          END
      ) > 0
  )
  SELECT product_id, available FROM product_level_stock
  UNION ALL
  SELECT product_id, available FROM variant_level_stock;
$function$;

-- ------------------------------------------------------------
-- 3. get_product_base_availability(p_product_id): NUEVA, solo lectura.
--    Devuelve (opcion_base_nombre, available) SOLO si el producto
--    está activo y tiene opcion_base_nombre no nulo; available =
--    coalesce(quantity - reserved, 0) de la fila base (0 si no hay
--    fila). Cero filas en cualquier otro caso.
--    Mismos atributos y grants que get_variant_availability.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_base_availability(p_product_id bigint)
 RETURNS TABLE(opcion_base_nombre text, available integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.opcion_base_nombre,
    COALESCE((
      SELECT SUM(i.quantity - i.reserved)
      FROM public.inventory AS i
      WHERE i.product_id = p.id
        AND i.variant_id IS NULL
    ), 0)::integer AS available
  FROM public.products AS p
  WHERE p.id = p_product_id
    AND p.activo = true
    AND p.opcion_base_nombre IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_product_base_availability(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_base_availability(bigint) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_product_base_availability(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product_base_availability(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_base_availability(bigint) TO authenticated;

-- ------------------------------------------------------------
-- 4. create_admin_product / update_admin_product: parámetro nuevo
--    p_opcion_base_nombre text DEFAULT NULL AL FINAL.
--    Como cambian las firmas, se hace DROP de la firma vieja y
--    CREATE de la nueva (sin sobrecargas ambiguas), conservando
--    SECURITY DEFINER, search_path=public, owner postgres y los
--    grants (se re-aplican al final; DROP+CREATE los resetea).
--    create: NULL o vacío = sin opción base.
--    update: NULL = NO CAMBIAR (admin viejo no manda el parámetro);
--            texto vacío o solo espacios = QUITAR (NULL);
--            texto = guardar el nombre recortado.
--    No cambia ninguna otra lógica (precios, en_oferta,
--    price_history, validaciones, mensajes en español).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_admin_product(
  text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean
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
  p_en_oferta boolean DEFAULT false,
  p_opcion_base_nombre text DEFAULT NULL::text
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

  -- 2. Insertar producto (NULL o vacío = sin opción base)
  INSERT INTO products (
    titulo, slug, descripcion, marca, category_id,
    precio, precio_anterior, activo, destacado,
    peso_envio_gramos, alto_paquete_cm, ancho_paquete_cm, largo_paquete_cm,
    en_oferta, opcion_base_nombre
  ) VALUES (
    p_titulo, p_slug, p_descripcion, p_marca, p_category_id,
    p_precio, p_precio_anterior, p_activo, p_destacado,
    p_peso_envio_gramos, p_alto_paquete_cm, p_ancho_paquete_cm, p_largo_paquete_cm,
    p_en_oferta, NULLIF(btrim(p_opcion_base_nombre), '')
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

DROP FUNCTION IF EXISTS public.update_admin_product(
  integer, text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean
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
  p_en_oferta boolean DEFAULT NULL::boolean,
  p_opcion_base_nombre text DEFAULT NULL::text
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
  v_current_opcion text;
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

  -- 2. Obtener precio, en_oferta y opcion_base actuales antes del update
  SELECT precio, en_oferta, opcion_base_nombre
    INTO v_old_price, v_current_offer, v_current_opcion
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
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

-- Grants: los mismos roles que tenían antes (postgres, anon,
-- authenticated, service_role + PUBLIC; verificados en el respaldo
-- backup/2026-10-14-opcion-base/functions/*.sql). DROP+CREATE
-- resetea el ACL, así que se re-aplican.
GRANT EXECUTE ON FUNCTION public.create_admin_product(
  text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean, text
) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_product(
  text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean, text
) TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_admin_product(
  integer, text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean, text
) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_admin_product(
  integer, text, text, integer, numeric, text, text, numeric,
  boolean, boolean, integer, integer, integer, integer, boolean, text
) TO postgres, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 5. VISTA products_ofertas: exponer la columna nueva (las listas
--    de la tienda leen de la vista). CREATE OR REPLACE conserva
--    owner y grants; la columna nueva se agrega AL FINAL (regla
--    de Postgres para REPLACE), por eso la lista es explícita en
--    lugar de p.*.
--    Las columnas calculadas de oferta NO cambian: la opción base
--    no entra en ofertas.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.products_ofertas
WITH (security_invoker = true) AS
SELECT p.id,
    p.titulo,
    p.slug,
    p.descripcion,
    p.marca,
    p.category_id,
    p.precio,
    p.precio_anterior,
    p.imagen_url,
    p.activo,
    p.destacado,
    p.created_at,
    p.updated_at,
    p.fts,
    p.peso_envio_gramos,
    p.alto_paquete_cm,
    p.ancho_paquete_cm,
    p.largo_paquete_cm,
    p.en_oferta,
    CASE
        WHEN vhas.has_av THEN (ovf.id IS NOT NULL)
        ELSE p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
    END AS en_oferta_efectivo,
    CASE
        WHEN vhas.has_av THEN ovf.precio
        WHEN p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
          THEN p.precio
    END AS oferta_precio,
    CASE
        WHEN vhas.has_av THEN ovf.precio_anterior
        WHEN p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
          THEN p.precio_anterior
    END AS oferta_precio_anterior,
    CASE
        WHEN vhas.has_av THEN ovf.descuento_pct
        WHEN p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
          THEN round(((p.precio_anterior - p.precio) / p.precio_anterior) * 100)::integer
    END AS oferta_descuento,
    CASE
        WHEN vhas.has_av THEN (
            SELECT count(*)::integer
            FROM public.product_variants v
            WHERE v.product_id = p.id
              AND v.activo
              AND v.en_oferta
              AND v.precio_anterior IS NOT NULL
              AND v.precio_anterior > v.precio
        )
        ELSE 0
    END AS oferta_variantes_count,
    CASE WHEN vhas.has_av THEN ovf.id END AS oferta_variant_id,
    p.opcion_base_nombre
FROM public.products p
CROSS JOIN LATERAL (
    SELECT EXISTS (
        SELECT 1 FROM public.product_variants v
        WHERE v.product_id = p.id AND v.activo
    ) AS has_av
) vhas
LEFT JOIN LATERAL (
    SELECT v.id,
           v.precio,
           v.precio_anterior,
           round(((v.precio_anterior - v.precio) / v.precio_anterior) * 100)::integer AS descuento_pct
    FROM public.product_variants v
    WHERE v.product_id = p.id
      AND v.activo
      AND v.en_oferta
      AND v.precio_anterior IS NOT NULL
      AND v.precio_anterior > v.precio
    ORDER BY v.precio ASC
    LIMIT 1
) ovf ON vhas.has_av;

-- ------------------------------------------------------------
-- 6. Recargar el cache de PostgREST
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
