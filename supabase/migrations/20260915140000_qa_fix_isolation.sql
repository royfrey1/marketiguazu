-- ============================================================================
-- S4.19.3 — Corrección del aislamiento de fixtures QA administrativos
-- 1. Crear usuarios QA (auth.users + profiles)
-- 2. Reasignar 6 pedidos QA al customer QA
-- 3. Restaurar idx_orders_one_pending_per_user
-- ============================================================================

-- ============================================================================
-- 1. CREAR USUARIOS QA
-- ============================================================================

-- 1.1 ADMIN QA
-- UUID fijo para el admin QA
DO $$
DECLARE
  v_admin_uuid uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_customer_uuid uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Crear perfil admin QA primero (la FK es profiles → auth.users, pero el profile se crea primero)
  -- Nota: profiles.id tiene FK a auth.users.id, así que necesitamos crear auth.users primero
  -- Pero auth.users tiene ON DELETE CASCADE desde profiles, así que profiles se eliminaría si auth.users se elimina.
  -- Solución: crear auth.users primero, luego profiles.

  -- Verificar si ya existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_uuid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_admin_uuid,
      'authenticated',
      'authenticated',
      'qa.admin.control@example.test',
      crypt('QA-Test-Password-123!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"QA Admin Control","role":"admin"}'::jsonb
    );
  END IF;

  -- Crear perfil admin QA
  INSERT INTO profiles (id, nombre, role)
  VALUES (v_admin_uuid, 'QA Admin Control', 'admin')
  ON CONFLICT (id) DO UPDATE SET nombre = 'QA Admin Control', role = 'admin';

  -- 1.2 CUSTOMER QA
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_customer_uuid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_customer_uuid,
      'authenticated',
      'authenticated',
      'qa.customer.control@example.test',
      crypt('QA-Test-Password-123!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"QA Customer Control","role":"customer"}'::jsonb
    );
  END IF;

  -- Crear perfil customer QA
  INSERT INTO profiles (id, nombre, role)
  VALUES (v_customer_uuid, 'QA Customer Control', 'customer')
  ON CONFLICT (id) DO UPDATE SET nombre = 'QA Customer Control', role = 'customer';

END $$;

-- ============================================================================
-- 2. REASIGNAR LOS 6 PEDIDOS QA AL CUSTOMER QA
-- ============================================================================

DO $$
DECLARE
  v_customer_uuid uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  UPDATE orders
  SET user_id = v_customer_uuid
  WHERE numero_pedido LIKE 'QA-ADMIN-%';
END $$;

-- ============================================================================
-- 3. RESTAURAR idx_orders_one_pending_per_user
-- ============================================================================

-- Verificar que no exista antes de crear
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_orders_one_pending_per_user'
  ) THEN
    CREATE UNIQUE INDEX idx_orders_one_pending_per_user
      ON orders (user_id)
      WHERE status = 'pending';
  END IF;
END $$;

-- ============================================================================
-- FIN S4.19.3
-- ============================================================================
