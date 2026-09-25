-- ============================================================
-- F8 T4.5 — RPCs para administración de variantes de producto
-- ============================================================
-- 3 funciones transaccionales:
--   1. create_product_variant  — crea variante + inventory + price_history
--   2. update_product_variant  — actualiza variante + price_history si cambió precio
--   3. delete_product_variant  — elimina variante si no tiene dependencias
-- ============================================================

-- ============================================================
-- 1. CREATE_PRODUCT_VARIANT
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
  INSERT INTO price_history (
    product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id
  ) VALUES (
    p_product_id, v_variant.id,
    COALESCE(p_precio_anterior, p_precio),
    p_precio,
    'manual',
    auth.uid()
  );

  RETURN QUERY SELECT * FROM product_variants WHERE id = v_variant.id;
END;
$function$;

-- ============================================================
-- 2. UPDATE_PRODUCT_VARIANT
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
  v_product_id integer;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  -- Obtener precio actual y product_id
  SELECT precio, product_id INTO v_old_precio, v_product_id
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
  IF v_old_precio IS DISTINCT FROM p_precio THEN
    INSERT INTO price_history (
      product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id
    ) VALUES (
      v_product_id, p_variant_id, v_old_precio, p_precio, 'manual', auth.uid()
    );
  END IF;

  RETURN QUERY SELECT * FROM product_variants WHERE id = p_variant_id;
END;
$function$;

-- ============================================================
-- 3. DELETE_PRODUCT_VARIANT
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_product_variant(
  p_variant_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_admin boolean;
  v_product_id integer;
  v_has_movements boolean;
  v_has_orders boolean;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  SELECT product_id INTO v_product_id
  FROM product_variants WHERE id = p_variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada (id: %)', p_variant_id;
  END IF;

  -- Verificar movimientos de inventario
  SELECT EXISTS (
    SELECT 1 FROM inventory_movements im
    JOIN inventory i ON i.id = im.inventory_id
    WHERE i.variant_id = p_variant_id
  ) INTO v_has_movements;

  IF v_has_movements THEN
    RAISE EXCEPTION 'No se puede eliminar: la variante tiene movimientos de inventario. Desactívela en su lugar.';
  END IF;

  -- Verificar pedidos
  SELECT EXISTS (
    SELECT 1 FROM order_items WHERE variant_id = p_variant_id
  ) INTO v_has_orders;

  IF v_has_orders THEN
    RAISE EXCEPTION 'No se puede eliminar: la variante tiene pedidos asociados. Desactívela en su lugar.';
  END IF;

  -- Eliminar inventory y price_history de la variante
  DELETE FROM inventory WHERE variant_id = p_variant_id;
  DELETE FROM price_history WHERE variant_id = p_variant_id;

  -- Eliminar variante
  DELETE FROM product_variants WHERE id = p_variant_id;
END;
$function$;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_product_variant(integer, text, text, numeric, numeric, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_product_variant(integer, text, text, numeric, numeric, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product_variant(integer) TO authenticated;
