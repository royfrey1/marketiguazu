-- ============================================================
-- FASE 6A.4.4 — Re-aplicación de get_product_availability()
-- ============================================================
-- Problema diagnosticado:
--   Un producto nuevo creado desde Admin con stock real (qty=10)
--   NO aparece en el Storefront para ningún usuario (anon, auth, admin).
--   El Admin SÍ puede ver el producto e inventario.
--
-- Causa raíz:
--   La función get_product_availability() definida en migraciones
--   anteriores (20260921130000 through 20260921170000) probablemente
--   NO fue aplicada a la base de datos remota de Supabase.
--   Sin la función, la RPC falla silenciosamente y el frontend
--   recibe un Map vacío → 0 productos en catálogo.
--
-- Solución:
--   Re-crear la función con CREATE OR REPLACE FUNCTION de forma
--   segura y repetible. Si la función ya existe con la versión
--   correcta, no hay cambio. Si no existe o tiene una versión
--   anterior, se actualiza.
--
-- La función implementa la regla definitiva de disponibilidad:
--   - Producto sin variantes → inventory product-level
--   - Producto con variantes activas → inventory de variantes
--   - Producto con variantes todas inactivas → NO aparece
--   - Sin inventory → NO aparece
--   - available <= 0 → NO aparece
--   - activo = false → NO aparece
--   - available === null NO se considera disponible
--
-- Seguridad:
--   SECURITY DEFINER, SET search_path = public
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

-- Restaurar permisos de forma segura
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;
