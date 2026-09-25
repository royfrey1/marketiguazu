-- ============================================================
-- FIX F8 T4.5 — Corregir price_history XOR constraint en variantes
-- =================================================--
-- PROBLEMA:
--   price_history tiene CHECK:
--   CHECK ((product_id IS NOT NULL) <> (variant_id IS NOT NULL))
--   Es decir: exactamente UNO de los dos debe ser NOT NULL (XOR).
--
--   Las RPCs de variantes insertaban AMBOS (product_id Y variant_id)
--   como NOT NULL, violando el CHECK.
--
-- SOLUCIÓN:
--   Para historial de variante: product_id = NULL, variant_id = Y
--   Para historial de producto:  product_id = X, variant_id = NULL
-- ============================================================

-- ============================================================
-- 1. CREATE_PRODUCT_VARIANT — Fix price_history INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_product_variant(
  p_product_id integer,
  p_sku text,
  p_nombre text,
  p_precio numeric,
  p_precio_anterior numeric DEFAULT NULL,
  p_atributos jsonb DEFAULT NULL,
  p_imagen_url text DEFAULT NULL,
  p_activo boolean DEFAULT true
)
RETURNS SETOF public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_admin boolean;
  v_variant record;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  -- Crear variante
  INSERT INTO product_variants (
    product_id, sku, nombre, precio, precio_anterior,
    atributos, imagen_url, activo
  ) VALUES (
    p_product_id, p_sku, p_nombre, p_precio, p_precio_anterior,
    p_atributos, p_imagen_url, p_activo
  )
  RETURNING * INTO v_variant;

  -- Crear inventory inicial
  INSERT INTO inventory (product_id, variant_id, quantity, reserved, low_stock_threshold)
  VALUES (p_product_id, v_variant.id, 0, 0, 5);

  -- Registrar precio inicial en price_history
  -- XOR: product_id=NULL, variant_id=Y (historial de variante)
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

-- ============================================================
-- 2. UPDATE_PRODUCT_VARIANT — Fix price_history INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_product_variant(
  p_variant_id integer,
  p_sku text,
  p_nombre text,
  p_precio numeric,
  p_precio_anterior numeric DEFAULT NULL,
  p_atributos jsonb DEFAULT NULL,
  p_imagen_url text DEFAULT NULL,
  p_activo boolean DEFAULT true
)
RETURNS SETOF public.product_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_admin boolean;
  v_old_precio numeric;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  -- Obtener precio actual
  SELECT precio INTO v_old_precio
  FROM product_variants WHERE id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada (id: %)', p_variant_id;
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
      updated_at = now()
  WHERE id = p_variant_id;

  -- Registrar cambio de precio solo si cambió
  -- XOR: product_id=NULL, variant_id=Y (historial de variante)
  IF v_old_precio IS DISTINCT FROM p_precio THEN
    INSERT INTO price_history (
      product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id
    ) VALUES (
      NULL, p_variant_id, v_old_precio, p_precio, 'manual', auth.uid()
    );
  END IF;

  RETURN QUERY SELECT * FROM product_variants WHERE id = p_variant_id;
END;
$function$;

-- ============================================================
-- GRANTS (mantener mínimo privilegio)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_product_variant(integer, text, text, numeric, numeric, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_product_variant(integer, text, text, numeric, numeric, jsonb, text, boolean) TO authenticated;
