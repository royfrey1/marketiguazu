-- ============================================================
-- Fix — inventory_admin_view: resolver imagen de producto/variante
-- ============================================================
-- `product_imagen_url` apuntaba solo a `products.imagen_url` (columna
-- legacy), por lo que los productos cargados con el sistema nuevo
-- (product_images) no tenían imagen en Inventario.
--
-- Criterio (igual que productImagesService.resolveImageUrl):
--   1) imagen con es_principal = true
--   2) si no existe, la de menor sort_order (desempate created_at, id)
--   3) si no hay ninguna fila en product_images, products.imagen_url
--
-- `variant_imagen_url` conserva la imagen propia de la variante si
-- existe; si es NULL, aplica el mismo criterio de resolución del producto.
--
-- Grants restaurados igual que en la definición anterior (security_invoker
-- = true: aplica las policies de product_images del usuario de la sesión).
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
  COALESCE(img_resuelta.url, p.imagen_url) AS product_imagen_url,
  p.category_id AS product_category_id,
  c.nombre AS category_nombre,
  pv.nombre AS variant_nombre,
  pv.sku AS variant_sku,
  COALESCE(pv.imagen_url, img_resuelta.url, p.imagen_url) AS variant_imagen_url,
  pv.activo AS variant_activo
FROM inventory i
JOIN products p ON p.id = i.product_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN product_variants pv ON pv.id = i.variant_id
LEFT JOIN LATERAL (
  SELECT pi.url
  FROM product_images pi
  WHERE pi.product_id = p.id
  ORDER BY pi.es_principal DESC, pi.sort_order ASC, pi.created_at ASC, pi.id ASC
  LIMIT 1
) img_resuelta ON true;

-- Restaurar permisos (DROP VIEW los elimina)
REVOKE ALL ON public.inventory_admin_view FROM anon;
REVOKE ALL ON public.inventory_admin_view FROM PUBLIC;
REVOKE ALL ON public.inventory_admin_view FROM postgres;
REVOKE ALL ON public.inventory_admin_view FROM service_role;
GRANT SELECT ON public.inventory_admin_view TO authenticated;
