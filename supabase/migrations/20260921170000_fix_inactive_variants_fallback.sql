-- ============================================================
-- FASE 6A.4.3.2 — Corrección: variantes existentes inactivas
-- ============================================================
-- BUG: La CTE anterior solo buscaba variantes activas (pv.activo = true).
-- Un producto con variantes existentes pero TODAS inactivas pasaba al
-- branch de product-level inventory, lo cual es incorrecto.
--
-- REGLA CORREGIDA:
--   Sin variantes existentes (0 filas en product_variants)
--     → usar inventory product-level
--   Con variantes existentes (≥1 fila en product_variants)
--     → SI hay al menos una activa: usar inventory de variantes activas
--     → SI todas están inactivas: NO retornar el producto
--   Nunca mezclar product-level con variant-level.
--
-- CAMBIO CLAVE:
--   CTE anterior: SELECT WHERE pv.activo = true
--   CTE nuevo:    SELECT ... GROUP BY product_id, BOOL_OR(pv.activo)
--
-- Esto permite distinguir:
--   - "sin variantes" (0 filas) → product-level inventory
--   - "con variantes, todas inactivas" → no aparece
--   - "con variantes, ≥1 activa" → variant-level inventory
--
-- Unicidad inventory product-level:
--   Garantizada por idx_inventory_one_per_product_no_variant
--   (UNIQUE INDEX parcial WHERE variant_id IS NULL).
--   No necesita GROUP BY en el branch product-level.
--
-- Seguridad:
--   SECURITY DEFINER, search_path = public
--   GRANT EXECUTE a anon y authenticated
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
  WITH product_variant_info AS (
    SELECT
      pv.product_id,
      BOOL_OR(pv.activo) AS has_active
    FROM product_variants pv
    GROUP BY pv.product_id
  )

  -- CASO A: Productos SIN variantes (0 filas en product_variants)
  -- Usar ÚNICAMENTE inventory product-level (variant_id IS NULL)
  -- Unicidad garantizada por idx_inventory_one_per_product_no_variant
  SELECT
    p.id AS product_id,
    (i.quantity - i.reserved) AS available
  FROM products p
  JOIN inventory i ON i.product_id = p.id AND i.variant_id IS NULL
  WHERE p.activo = true
    AND (i.quantity - i.reserved) > 0
    AND NOT EXISTS (
      SELECT 1 FROM product_variant_info v WHERE v.product_id = p.id
    )

  UNION

  -- CASO B: Productos CON variantes, al menos una activa
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
      SELECT 1 FROM product_variant_info v
      WHERE v.product_id = p.id AND v.has_active = true
    )
  GROUP BY p.id
  HAVING SUM(i.quantity - i.reserved) > 0

  -- CASO C (implícito): Productos CON variantes, todas inactivas
  -- NO matchea ninguna rama → no se retorna el producto
$$;

-- Restaurar permisos
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;
