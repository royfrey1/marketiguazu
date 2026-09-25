-- ============================================================
-- FASE 6A.4.1 — Fuente pública de disponibilidad para Storefront
-- ============================================================
-- Problema:
--   1. inventory_auth_select solo cubre authenticated (no anon)
--   2. PostgREST no soporta filtrar por quantity-reserved
--   3. getCatalog count no refleja productos disponibles reales
--   4. Usuarios anónimos no pueden ver disponibilidad
--
-- Solución: SECURITY DEFINER function que retorna product_id y
-- available (quantity - reserved) para productos activos con
-- stock > 0. Bypasea RLS de inventory ejecutando como owner.
--
-- Seguridad:
--   - SECURITY DEFINER: ejecuta con privilegios del owner
--   - Solo retorna product_id + available (no otros campos)
--   - No expone movimientos, thresholds, ni created_by
--   - No permite INSERT/UPDATE/DELETE
--   - GRANT EXECUTE a anon y authenticated
--   - inventory_admin_all se conserva para operaciones admin
--
-- Reversible:
--   DROP FUNCTION IF EXISTS public.get_product_availability();
-- ============================================================

-- 1. Crear función SECURITY DEFINER
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

-- 2. Otorgar EXECUTE a anon y authenticated
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;

-- 3. Revocar de roles que no deberían usarla
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_product_availability() FROM PUBLIC;
