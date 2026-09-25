DO $$
DECLARE
  v_admin_uuid uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_customer_uuid uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_uuid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_admin_uuid, 'authenticated', 'authenticated',
      'qa.admin.control@example.test',
      crypt('QA-Test-Password-123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"QA Admin Control","role":"admin"}'::jsonb
    );
  END IF;
  INSERT INTO profiles (id, nombre, role) VALUES (v_admin_uuid, 'QA Admin Control', 'admin')
  ON CONFLICT (id) DO UPDATE SET nombre = 'QA Admin Control', role = 'admin';

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_customer_uuid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_customer_uuid, 'authenticated', 'authenticated',
      'qa.customer.control@example.test',
      crypt('QA-Test-Password-123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"QA Customer Control","role":"customer"}'::jsonb
    );
  END IF;
  INSERT INTO profiles (id, nombre, role) VALUES (v_customer_uuid, 'QA Customer Control', 'customer')
  ON CONFLICT (id) DO UPDATE SET nombre = 'QA Customer Control', role = 'customer';
END $$;
