-- 20261022180000_fix_delete_product_permanent_cleanup.sql
-- Fix: delete_admin_product_permanent limpiaba dependientes SOLO por
-- product_id, pero price_history admite filas ligadas unicamente por
-- variant_id (CHECK price_history_check exige XOR product_id/variant_id).
-- Con productos con variantes, esas filas bloqueaban el DELETE de
-- product_variants por la FK price_history_variant_id_fkey (RESTRICT) y
-- el borrado definitivo fallaba (caso real: producto 8, 5 filas).
-- Cambio: toda limpieza de dependientes alcanza por product_id O por el
-- conjunto de ids de variantes del producto. Mismo orden, mismas
-- validaciones, mismos codigos de error y mismo retorno.

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
  v_variant_ids integer[];
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

  -- Conjunto de variantes: toda limpieza de dependientes usa product_id
  -- O variant_id (nunca solo product_id).
  SELECT COALESCE(array_agg(id), '{}') INTO v_variant_ids
    FROM product_variants
   WHERE product_id = p_product_id;

  SELECT COALESCE(array_agg(pi.url ORDER BY pi.id), '{}') INTO v_urls
    FROM product_images pi
   WHERE pi.product_id = p_product_id
      OR pi.variant_id = ANY(v_variant_ids);

  -- Orden respetando FKs RESTRICT (movimientos -> inventory ->
  -- price_history/cart_items/imagenes -> variantes -> producto).
  DELETE FROM inventory_movements
   WHERE inventory_id IN (
     SELECT id FROM inventory
      WHERE product_id = p_product_id
         OR variant_id = ANY(v_variant_ids)
   );

  DELETE FROM inventory
   WHERE product_id = p_product_id
      OR variant_id = ANY(v_variant_ids);

  DELETE FROM price_history
   WHERE product_id = p_product_id
      OR variant_id = ANY(v_variant_ids);

  DELETE FROM cart_items
   WHERE product_id = p_product_id
      OR variant_id = ANY(v_variant_ids);

  DELETE FROM product_images
   WHERE product_id = p_product_id
      OR variant_id = ANY(v_variant_ids);

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

REVOKE ALL ON FUNCTION public.delete_admin_product_permanent(integer, boolean) FROM PUBLIC, anon;
GRANT ALL ON FUNCTION public.delete_admin_product_permanent(integer, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
