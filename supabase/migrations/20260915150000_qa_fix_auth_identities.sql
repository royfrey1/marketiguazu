-- QA-INFRA-01: Fix auth infrastructure for QA users
--
-- Root causes:
-- 1. Migration 20260915140001_qa_create_users.sql inserted into auth.users
--    but NOT into auth.identities. GoTrue requires both to authenticate.
-- 2. NULL values in token columns (confirmation_token, email_change,
--    email_change_token_new, recovery_token) cause GoTrue to fail with
--    "Database error querying schema". These must be empty strings.
--
-- This migration inserts missing identity records AND fixes NULL token columns.
-- Idempotent: checks existence before inserting.

DO $$
DECLARE
  v_admin_uuid  uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_admin_email text := 'qa.admin.control@example.test';
  v_cust_uuid   uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
  v_cust_email  text := 'qa.customer.control@example.test';
  v_created_at  timestamptz := '2026-09-15 15:59:38.348674+00'::timestamptz;
BEGIN
  -- Fix NULL token columns for both QA users (GoTrue requires empty strings)
  UPDATE auth.users SET
    confirmation_token = COALESCE(confirmation_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    recovery_token = COALESCE(recovery_token, '')
  WHERE id IN (v_admin_uuid, v_cust_uuid);

  -- Admin identity
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE provider = 'email' AND provider_id = v_admin_uuid::text
  ) THEN
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_uuid,
      v_admin_uuid,
      jsonb_build_object(
        'sub', v_admin_uuid::text,
        'email', v_admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_created_at,
      v_created_at
    );
  END IF;

  -- Customer identity
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE provider = 'email' AND provider_id = v_cust_uuid::text
  ) THEN
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_cust_uuid,
      v_cust_uuid,
      jsonb_build_object(
        'sub', v_cust_uuid::text,
        'email', v_cust_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_created_at,
      v_created_at
    );
  END IF;
END $$;
