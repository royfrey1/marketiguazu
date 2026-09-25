-- ============================================================
-- A2.6.1 — Agregar columna computada `available` a inventory_admin_view
-- ============================================================
-- Corrige el filtro "Stock bajo" que usaba `quantity` en lugar
-- de `quantity - reserved` para determinar disponibilidad.
-- ============================================================

DROP VIEW IF EXISTS public.inventory_admin_view;

CREATE VIEW public.inventory_admin_view
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.product_id,
  i.variant_id,
  i.quantity,
  i.reserved,
  (i.quantity - i.reserved) AS available,
  i.low_stock_threshold,
  i.created_at,
  i.updated_at,
  p.titulo AS product_titulo,
  p.slug AS product_slug,
  p.activo AS product_activo,
  p.imagen_url AS product_imagen_url,
  p.category_id AS product_category_id,
  c.nombre AS category_nombre,
  pv.nombre AS variant_nombre,
  pv.sku AS variant_sku,
  pv.imagen_url AS variant_imagen_url,
  pv.activo AS variant_activo
FROM inventory i
JOIN products p ON p.id = i.product_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN product_variants pv ON pv.id = i.variant_id;

-- Restaurar permisos (DROP VIEW los elimina)
REVOKE ALL ON public.inventory_admin_view FROM anon;
REVOKE ALL ON public.inventory_admin_view FROM PUBLIC;
REVOKE ALL ON public.inventory_admin_view FROM postgres;
REVOKE ALL ON public.inventory_admin_view FROM service_role;
GRANT SELECT ON public.inventory_admin_view TO authenticated;
