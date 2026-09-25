-- ============================================================
-- F8 T4.4.1 — Seguridad y versionado del módulo Inventario
-- F8 T4.4.2 — Cierre de permisos RPC (solo service_role)
-- ============================================================
-- Versiona el estado real de RLS y grants para:
--   - inventory
--   - inventory_movements
--   - reserve_stock()
--   - confirm_sale()
--   - release_reservation()
--
-- Idempotente: REVOKE/GRANT son seguros de ejecutar múltiples veces.
-- No elimina policies correctas existentes.
-- No cambia SECURITY TYPE de las funciones.
-- No modifica lógica interna de las funciones.
-- ============================================================

-- ============================================================
-- 1. RLS: inventory
-- ============================================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory'
    AND policyname = 'inventory_admin_all'
  ) THEN
    CREATE POLICY inventory_admin_all
      ON public.inventory
      FOR ALL
      USING (is_admin());
  END IF;
END $$;

-- ============================================================
-- 2. RLS: inventory_movements
-- ============================================================
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_movements'
    AND policyname = 'inventory_movements_admin_all'
  ) THEN
    CREATE POLICY inventory_movements_admin_all
      ON public.inventory_movements
      FOR ALL
      USING (is_admin());
  END IF;
END $$;

-- ============================================================
-- 3. GRANTS: reserve_stock()
-- ============================================================
-- Estado actual: GRANT a anon, authenticated, service_role, postgres, PUBLIC
-- Estado final: service_role ÚNICAMENTE
-- Consumidor: create-payment Edge Function (service_role)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.reserve_stock(integer, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_stock(integer, integer, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_stock(integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_stock(integer, integer, integer, integer) FROM postgres;
GRANT EXECUTE ON FUNCTION public.reserve_stock(integer, integer, integer, integer) TO service_role;

-- ============================================================
-- 4. GRANTS: confirm_sale()
-- ============================================================
-- Estado actual: GRANT a anon, authenticated, service_role, postgres, PUBLIC
-- Estado final: service_role ÚNICAMENTE
-- Consumidor: ninguno actual (reservado para futuro backend)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.confirm_sale(integer, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_sale(integer, integer, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_sale(integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_sale(integer, integer, integer, integer) FROM postgres;
GRANT EXECUTE ON FUNCTION public.confirm_sale(integer, integer, integer, integer) TO service_role;

-- ============================================================
-- 5. GRANTS: release_reservation()
-- ============================================================
-- Estado actual: GRANT a anon, authenticated, service_role, postgres, PUBLIC
-- Estado final: service_role ÚNICAMENTE
-- Consumidor: create-payment Edge Function (service_role)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.release_reservation(integer, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_reservation(integer, integer, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_reservation(integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_reservation(integer, integer, integer, integer) FROM postgres;
GRANT EXECUTE ON FUNCTION public.release_reservation(integer, integer, integer, integer) TO service_role;
