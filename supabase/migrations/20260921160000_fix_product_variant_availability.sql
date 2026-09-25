-- ============================================================
-- FASE 6A.4.3.1 — Definición única de inventario para variantes
-- ============================================================
-- Corrección puntual de get_product_availability() para eliminar
-- la ambigüedad cuando un producto tiene inventory a nivel de
-- producto Y también inventory asociado a variantes.
--
-- REGLA DEFINITIVA:
--   Producto SIN variantes activas → usar inventory product-level
--   Producto CON variantes activas → usar SOLO inventory de variantes
--   NO mezclar ambos inventarios.
--
-- Un producto con variantes activas IGNORA su inventory product-level.
-- Esto garantiza que el stock reportado sea inequívoco.
--
-- Garantía: máximo 1 fila por product_id.
--   - Sin variantes: inventory product-level es único (variant_id IS NULL)
--   - Con variantes: GROUP BY product_id
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
  WITH product_has_active_variants AS (
    SELECT DISTINCT pv.product_id AS id
    FROM product_variants pv
    WHERE pv.activo = true
  )

  -- CASO A: Productos SIN variantes activas
  -- Usar ÚNICAMENTE inventory product-level (variant_id IS NULL)
  SELECT
    p.id AS product_id,
    (i.quantity - i.reserved) AS available
  FROM products p
  JOIN inventory i ON i.product_id = p.id AND i.variant_id IS NULL
  WHERE p.activo = true
    AND (i.quantity - i.reserved) > 0
    AND NOT EXISTS (
      SELECT 1 FROM product_has_active_variants v WHERE v.id = p.id
    )

  UNION

  -- CASO B: Productos CON variantes activas
  -- Usar ÚNICAMENTE inventory de variantes activas
  -- GROUP BY garantiza 1 fila por product_id
  SELECT
    p.id AS product_id,
    SUM(i.quantity - i.reserved) AS available
  FROM products p
  JOIN inventory i ON i.product_id = p.id AND i.variant_id IS NOT NULL
  JOIN product_variants pv ON pv.id = i.variant_id AND pv.activo = true
  WHERE p.activo = true
    AND EXISTS (
      SELECT 1 FROM product_has_active_variants v WHERE v.id = p.id
    )
  GROUP BY p.id
  HAVING SUM(i.quantity - i.reserved) > 0
$$;

-- Restaurar permisos
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;
