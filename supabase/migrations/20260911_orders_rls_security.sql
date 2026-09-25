-- ============================================================
-- S4.4 — Seguridad RLS del sistema de pedidos
-- ============================================================
-- Habilita RLS y crea policies de SELECT para:
--   - orders
--   - order_items
--   - payments
--   - shipments
--
-- Reglas:
--   Cliente autenticado: solo lee sus propios datos.
--   Admin (profiles.role = 'admin'): lee todos los datos.
--   Escrituras: NINGUNA desde frontend. Solo backend/service_role.
--
-- Idempotente: usa IF NOT EXISTS para policies y
--   REVOKE/GRANT seguros de ejecutar múltiples veces.
-- ============================================================


-- ============================================================
-- 1. orders — Habilitar RLS
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. orders — Policy: cliente lee sus propios pedidos
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
    AND policyname = 'orders_select_own'
  ) THEN
    CREATE POLICY orders_select_own
      ON orders
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 3. orders — Policy: admin lee todos los pedidos
--    Usa is_admin() que es SECURITY DEFINER (sin recursión).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
    AND policyname = 'orders_select_admin'
  ) THEN
    CREATE POLICY orders_select_admin
      ON orders
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
END $$;


-- ============================================================
-- 4. order_items — Habilitar RLS
-- ============================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. order_items — Policy: cliente lee items de sus pedidos
--    Valida ownership через orders.user_id.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items'
    AND policyname = 'order_items_select_own'
  ) THEN
    CREATE POLICY order_items_select_own
      ON order_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 6. order_items — Policy: admin lee todos los items
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items'
    AND policyname = 'order_items_select_admin'
  ) THEN
    CREATE POLICY order_items_select_admin
      ON order_items
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
END $$;


-- ============================================================
-- 7. payments — Habilitar RLS
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. payments — Policy: cliente lee pagos de sus pedidos
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments'
    AND policyname = 'payments_select_own'
  ) THEN
    CREATE POLICY payments_select_own
      ON payments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = payments.order_id
          AND orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 9. payments — Policy: admin lee todos los pagos
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments'
    AND policyname = 'payments_select_admin'
  ) THEN
    CREATE POLICY payments_select_admin
      ON payments
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
END $$;


-- ============================================================
-- 10. shipments — Habilitar RLS
-- ============================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. shipments — Policy: cliente lee envíos de sus pedidos
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shipments'
    AND policyname = 'shipments_select_own'
  ) THEN
    CREATE POLICY shipments_select_own
      ON shipments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = shipments.order_id
          AND orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 12. shipments — Policy: admin lee todos los envíos
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shipments'
    AND policyname = 'shipments_select_admin'
  ) THEN
    CREATE POLICY shipments_select_admin
      ON shipments
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
END $$;


-- ============================================================
-- 13. REVOKE escrituras directas desde frontend
--     Asegurar que authenticated NO pueda INSERT/UPDATE/DELETE
--     en estas cuatro tablas. Solo service_role opera backend.
-- ============================================================

-- orders
REVOKE INSERT ON orders FROM authenticated;
REVOKE UPDATE ON orders FROM authenticated;
REVOKE DELETE ON orders FROM authenticated;

-- order_items
REVOKE INSERT ON order_items FROM authenticated;
REVOKE UPDATE ON order_items FROM authenticated;
REVOKE DELETE ON order_items FROM authenticated;

-- payments
REVOKE INSERT ON payments FROM authenticated;
REVOKE UPDATE ON payments FROM authenticated;
REVOKE DELETE ON payments FROM authenticated;

-- shipments
REVOKE INSERT ON shipments FROM authenticated;
REVOKE UPDATE ON shipments FROM authenticated;
REVOKE DELETE ON shipments FROM authenticated;


-- ============================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================
