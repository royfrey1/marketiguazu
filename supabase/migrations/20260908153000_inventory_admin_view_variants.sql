-- ============================================================
-- F8 T4.5 — Actualizar inventory_admin_view para soportar variantes
-- ============================================================
-- La vista ahora muestra:
--   - Productos sin variantes (variant_id IS NULL) como antes
--   - Productos con variantes: cada variante como fila separada
--
-- Esto permite que /admin/inventario muestre stock de variantes.
-- ============================================================

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
  c.nombre AS category_nombre,
  pv.nombre AS variant_nombre,
  pv.sku AS variant_sku,
  pv.imagen_url AS variant_imagen_url,
  pv.activo AS variant_activo
FROM inventory i
JOIN products p ON p.id = i.product_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN product_variants pv ON pv.id = i.variant_id;
