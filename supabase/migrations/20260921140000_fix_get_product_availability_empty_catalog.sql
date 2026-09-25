-- ============================================================
-- FASE 6A.4.2 — Corrección: catálogo vacío por función de disponibilidad
-- ============================================================
-- Problema: get_product_availability() solo retorna productos CON
-- inventory rows y quantity-reserved > 0. Productos que existían
-- antes del sistema de inventory (sin filas en inventory) son
-- invisibles en el catálogo público.
--
-- Causa raíz:
--   - Productos pre-inventory: NO tienen filas en inventory
--   - Productos post-inventory: tienen filas con quantity=0
--   - La función original solo matcheaba products con inventory
--   - Resultado: 0 productos retornados
--
-- Solución: la función ahora retorna:
--   1. Productos SIN inventory rows → disponibles (sin restricción)
--   2. Productos CON inventory → disponibles si SUM(qty-res) > 0
--   3. Productos CON inventory pero todo en 0 → NO disponibles
--
-- Seguridad: mantiene SECURITY DEFINER, search_path, permisos.
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
  SELECT
    p.id AS product_id,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id) THEN NULL
      ELSE SUM(COALESCE(i.quantity, 0) - COALESCE(i.reserved, 0))
    END AS available
  FROM products p
  LEFT JOIN inventory i ON i.product_id = p.id
  WHERE p.activo = true
  GROUP BY p.id
  HAVING
    -- Productos sin inventory: incluir (disponibilidad por defecto)
    NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id)
    OR
    -- Productos con inventory: incluir solo si hay stock disponible
    SUM(COALESCE(i.quantity, 0) - COALESCE(i.reserved, 0)) > 0
$$;

-- Restaurar permisos (CREATE OR REPLACE no cambia grants)
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;
