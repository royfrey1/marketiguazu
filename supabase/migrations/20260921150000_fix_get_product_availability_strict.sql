-- ============================================================
-- FASE 6A.4.3 — Corrección definitiva de get_product_availability()
-- ============================================================
-- Regla de negocio definitiva:
--   Producto activo + available > 0 → aparece en catálogo
--   Producto activo + available <= 0 → NO aparece
--   Producto activo sin inventory → NO aparece
--   Producto inactivo → NO aparece
--
-- available === null NO se considera disponible.
--
-- La función retorna product_id + available SOLO para productos
-- con stock real positivo (quantity - reserved > 0).
--
-- Productos sin variantes: usa inventory del producto (variant_id IS NULL).
-- Productos con variantes: usa inventory de variantes activas.
-- Si un producto tiene ambas (product-level + variant-level), la
-- UNION deduplica y cada query contribuye independientemente.
--
-- Seguridad:
--   SECURITY DEFINER, search_path = public
--   GRANT EXECUTE a anon y authenticated
--   No expone quantity, reserved, movements, threshold
--
-- Reversible:
--   DROP FUNCTION IF EXISTS public.get_product_availability();
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_product_availability()
RETURNS TABLE(product_id integer, available integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Productos sin variantes: stock a nivel de producto
  SELECT DISTINCT
    p.id AS product_id,
    (i.quantity - i.reserved) AS available
  FROM products p
  JOIN inventory i ON i.product_id = p.id AND i.variant_id IS NULL
  WHERE p.activo = true
    AND (i.quantity - i.reserved) > 0

  UNION

  -- Productos con variantes: sumatoria de stock de variantes activas
  SELECT DISTINCT
    p.id AS product_id,
    SUM(i.quantity - i.reserved) OVER (PARTITION BY p.id) AS available
  FROM products p
  JOIN inventory i ON i.product_id = p.id AND i.variant_id IS NOT NULL
  JOIN product_variants pv ON pv.id = i.variant_id AND pv.activo = true
  WHERE p.activo = true
    AND (i.quantity - i.reserved) > 0
$$;

-- Restaurar permisos
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;
