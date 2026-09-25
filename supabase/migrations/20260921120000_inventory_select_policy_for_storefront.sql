-- ============================================================
-- FASE 6A.4 — Policy SELECT en inventory para storefront
-- ============================================================
-- Problema: la policy inventory_admin_all solo permite a
-- is_admin() acceder a la tabla inventory. Los joins en las
-- queries del catálogo público devuelven arrays vacíos para
-- clientes, making computeProductAvailable() retornar null.
-- Resultado: el cliente ve todos los productos como disponibles.
--
-- Solución: agregar una policy SELECT separada que permita a
-- authenticated users leer inventory. Esto permite que los
-- joins del catálogo funcionen correctamente para clientes.
--
-- NOTA: esta policy expone quantity y reserved al cliente.
-- Esto es aceptable porque:
--   - El cliente necesita saber si un producto tiene stock
--   - quantity/reserved no son sensibles (no expone movimientos)
--   - La policy UPDATE/DELETE sigue restringida a admin
--
-- Reversible: DROP POLICY inventory_auth_select ON public.inventory;
-- ============================================================

-- 1. Policy SELECT para authenticated (storefront queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory'
    AND policyname = 'inventory_auth_select'
  ) THEN
    CREATE POLICY inventory_auth_select
      ON public.inventory
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 2. Otorgar SELECT a authenticated (por si no lo tiene)
GRANT SELECT ON public.inventory TO authenticated;
