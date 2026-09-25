-- ============================================================
-- FIX F8 T4.4.3.1 — Seguridad de inventory_admin_view
-- ============================================================
-- Problema: la vista fue creada sin security_invoker = true.
-- Esto significa que ejecuta con privilegios del owner (postgres),
-- bypassing RLS en inventory. Cualquier rol (anon, authenticated)
-- puede leer inventario directamente.
--
-- Solución:
--   1. Dropear la vista insegura
--   2. Recrear con security_invoker = true
--   3. Revocar ALL de anon, PUBLIC, postgres, service_role
--   4. Otorgar solo SELECT a authenticated
--
-- security_invoker = true hace que la vista ejecute con los
-- privilegios del usuario que consulta, respetando RLS.
-- ============================================================

-- 1. Dropear vista existente
DROP VIEW IF EXISTS public.inventory_admin_view;

-- 2. Recrear con security_invoker = true
CREATE OR REPLACE VIEW public.inventory_admin_view
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.product_id,
  i.variant_id,
  i.quantity,
  i.reserved,
  i.low_stock_threshold,
  i.created_at,
  i.updated_at,
  p.titulo AS product_titulo,
  p.slug AS product_slug,
  p.activo AS product_activo,
  p.imagen_url AS product_imagen_url,
  p.category_id AS product_category_id,
  c.nombre AS category_nombre
FROM inventory i
JOIN products p ON p.id = i.product_id
LEFT JOIN categories c ON c.id = p.category_id
WHERE i.variant_id IS NULL;

-- 3. Revocar permisos excesivos
REVOKE ALL ON public.inventory_admin_view FROM anon;
REVOKE ALL ON public.inventory_admin_view FROM PUBLIC;
REVOKE ALL ON public.inventory_admin_view FROM postgres;
REVOKE ALL ON public.inventory_admin_view FROM service_role;

-- 4. Solo SELECT para authenticated (admin)
GRANT SELECT ON public.inventory_admin_view TO authenticated;
