-- ============================================================
-- Escalar "una sola imagen principal" por variante
-- ============================================================
-- Antes: idx_product_images_one_principal UNIQUE (product_id)
--        WHERE es_principal = true
--   → a lo sumo UNA principal por producto en total; bloqueaba que
--     cada variante tuviera su propia imagen principal.
--
-- Ahora: DOS índices únicos parciales:
--   1) producto (galería sin variante): UNIQUE (product_id)
--      WHERE variant_id IS NULL AND es_principal = true
--      → comportamiento idéntico al anterior para el caso existente
--        (los datos cumplen: toda fila es_principal sin variante
--        ya era única por product_id).
--   2) variante (galería por variante): UNIQUE (variant_id)
--      WHERE variant_id IS NOT NULL AND es_principal = true
--      → cada variante puede tener su propia principal, independiente
--        de la del producto y de las demás variantes.
-- ============================================================

DROP INDEX IF EXISTS public.idx_product_images_one_principal;

CREATE UNIQUE INDEX idx_product_images_one_principal_product
  ON public.product_images (product_id)
  WHERE variant_id IS NULL AND es_principal = true;

CREATE UNIQUE INDEX idx_product_images_one_principal_variant
  ON public.product_images (variant_id)
  WHERE variant_id IS NOT NULL AND es_principal = true;
