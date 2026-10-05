-- ============================================================
-- Galería de imágenes por variante — product_images.variant_id
-- ============================================================
-- Permite que una variante tenga su propia galería reutilizando
-- product_images (fila con product_id + variant_id). Las filas de
-- galería de producto siguen con variant_id = NULL (sin cambios).
--
-- - ON DELETE CASCADE: si se borra la variante, desaparecen sus imágenes.
-- - product_images.product_id sigue siendo NOT NULL (la fila siempre
--   pertenece a un producto).
-- - product_variants.imagen_url NO se toca: queda como fallback legacy.
--
-- RLS: sin cambios necesarios —
--   * product_images_public_read valida por product_id (join a products),
--     no depende de variant_id (nullable).
--   * product_images_admin_all usa is_admin(): el admin inserta/borra
--     imágenes de variante igual que las de producto.
-- ============================================================

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS variant_id bigint
  REFERENCES public.product_variants (id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_images_variant_id
  ON public.product_images (variant_id)
  WHERE variant_id IS NOT NULL;
