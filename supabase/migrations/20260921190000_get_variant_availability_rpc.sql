-- ============================================================
-- FASE 6A.4.8 — RPC pública de disponibilidad por variante
-- ============================================================
-- Problema:
--   ProductPage necesita conocer la disponibilidad de cada variante
--   para un producto. El join inventory en product_variants está
--   bloqueado por RLS para usuarios anónimos y puede dar datos
--   incompletos incluso para authenticated.
--
-- Solución:
--   RPC SECURITY DEFINER que retorna variant_id + available
--   para todas las variantes activas de un producto.
--
-- Seguridad:
--   - SECURITY DEFINER: lee inventory internamente
--   - Solo retorna variant_id y available (no quantity/reserved)
--   - GRANT solo a anon y authenticated
--   - No expone información administrativa
--
-- Reversible:
--   DROP FUNCTION IF EXISTS public.get_variant_availability(integer);
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_variant_availability(p_product_id integer)
RETURNS TABLE(variant_id integer, available integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pv.id AS variant_id,
    COALESCE(i.quantity - i.reserved, 0) AS available
  FROM product_variants pv
  LEFT JOIN inventory i
    ON i.product_id = pv.product_id
    AND i.variant_id = pv.id
  WHERE pv.product_id = p_product_id
    AND pv.activo = true
$$;

-- Permisos: solo anon y authenticated
REVOKE EXECUTE ON FUNCTION public.get_variant_availability(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_variant_availability(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_variant_availability(integer) TO authenticated;
