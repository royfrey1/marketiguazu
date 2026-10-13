-- ============================================================
-- FASE 1 — Ofertas: columnas en_oferta, checks, indices, backfill
-- y vista products_ofertas.
-- Decisiones aprobadas:
--   * Oferta manual, sin fechas por ahora (hueco documentado para
--     oferta_desde / oferta_hasta futuro, NO creado).
--   * Producto SIN variantes activas: la oferta es del producto.
--   * Producto CON variantes activas: la oferta es de cada variante
--     y el flag del producto NO cuenta (lo decide la vista).
--   * Descuento real obligatorio: precio_anterior > precio.
--   * Tope duro: precio_anterior <= precio * 10 (max 90% off).
--     (La advertencia de >50% es solo de UI, no se implementa aca.)
--   * El precio de oferta ES el precio vigente: no hay segundo
--     campo de precio y el checkout no cambia.
-- ============================================================

-- ------------------------------------------------------------
-- 1. COLUMNAS
-- ------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS en_oferta boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS en_oferta boolean NOT NULL DEFAULT false;

-- FUTURO (NO implementar; solo dejar el hueco documentado):
--   ALTER TABLE public.products         ADD COLUMN oferta_desde timestamptz;
--   ALTER TABLE public.products         ADD COLUMN oferta_hasta timestamptz;
--   ALTER TABLE public.product_variants ADD COLUMN oferta_desde timestamptz;
--   ALTER TABLE public.product_variants ADD COLUMN oferta_hasta timestamptz;
--   Y centralizar la vigencia en la vista products_ofertas, por ejemplo:
--     en_oferta AND (oferta_desde IS NULL OR now() >= oferta_desde)
--              AND (oferta_hasta  IS NULL OR now() <  oferta_hasta)
--   Si se agregan columnas a products hay que RECREAR la vista (p.*).

-- ------------------------------------------------------------
-- 2. CHECKS por fila: oferta real + tope anti-typos
-- ------------------------------------------------------------
ALTER TABLE public.products
  ADD CONSTRAINT products_en_oferta_real_discount_chk
  CHECK (NOT en_oferta OR (precio_anterior IS NOT NULL AND precio_anterior > precio));

ALTER TABLE public.products
  ADD CONSTRAINT products_en_oferta_max_discount_chk
  CHECK (NOT en_oferta OR precio_anterior <= precio * 10);

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_en_oferta_real_discount_chk
  CHECK (NOT en_oferta OR (precio_anterior IS NOT NULL AND precio_anterior > precio));

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_en_oferta_max_discount_chk
  CHECK (NOT en_oferta OR precio_anterior <= precio * 10);

-- ------------------------------------------------------------
-- 3. INDICES PARCIALES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_en_oferta
  ON public.products (id)
  WHERE en_oferta AND activo;

CREATE INDEX IF NOT EXISTS idx_product_variants_en_oferta
  ON public.product_variants (product_id)
  WHERE en_oferta AND activo;

-- ------------------------------------------------------------
-- 4. BACKfill (aprobado): solo productos ACTIVOS sin variantes
--    ACTIVAS que hoy tienen precio_anterior > precio (y dentro
--    del tope). NO se marcan inactivos ni productos con
--    variantes activas (p.ej. 1023, cuyo en_oferta queda false).
-- ------------------------------------------------------------
UPDATE public.products p
   SET en_oferta = true
 WHERE p.activo
   AND p.precio_anterior IS NOT NULL
   AND p.precio_anterior > p.precio
   AND p.precio_anterior <= p.precio * 10
   AND NOT EXISTS (
     SELECT 1 FROM public.product_variants v
     WHERE v.product_id = p.id AND v.activo
   );

-- ------------------------------------------------------------
-- 5. VISTA: oferta efectiva (regla unica)
-- ------------------------------------------------------------
-- REGLA:
--   * Si el producto tiene variantes activas: MANDA la variante
--     (el en_oferta del producto se ignora). La variante en oferta
--     MAS BARATA define oferta_precio / oferta_precio_anterior /
--     oferta_descuento / oferta_variant_id. Solo variantes activas
--     cuentan; una variante agotada SIGUE contando (el stock se
--     filtra aparte con get_product_availability).
--   * Si no tiene variantes activas: cuenta el flag del producto.
--   * oferta_variantes_count = variantes activas en oferta con
--     descuento real (0 si la oferta es del producto).
-- security_invoker = true (Postgres >= 15; la BD es 17.x):
--   la vista hereda las policies de products (solo activo=true
--   para anon/authenticated) y de product_variants (solo variantes
--   activas de productos activos). No se agregan grants de escritura.
-- NOTA: las relaciones embebidas de PostgREST (categories,
-- product_images) NO existen sobre una vista porque no hay FKs:
-- el frontend debe traer ids desde esta vista y luego hacer el
-- select habitual sobre products con .in('id', ids).
CREATE OR REPLACE VIEW public.products_ofertas
WITH (security_invoker = true) AS
SELECT p.*,
  CASE
    WHEN vhas.has_av THEN (ovf.id IS NOT NULL)
    ELSE p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
  END AS en_oferta_efectivo,
  CASE
    WHEN vhas.has_av THEN ovf.precio
    WHEN p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
      THEN p.precio
  END AS oferta_precio,
  CASE
    WHEN vhas.has_av THEN ovf.precio_anterior
    WHEN p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
      THEN p.precio_anterior
  END AS oferta_precio_anterior,
  CASE
    WHEN vhas.has_av THEN ovf.descuento_pct
    WHEN p.en_oferta AND p.precio_anterior IS NOT NULL AND p.precio_anterior > p.precio
      THEN round(((p.precio_anterior - p.precio) / p.precio_anterior) * 100)::integer
  END AS oferta_descuento,
  CASE
    WHEN vhas.has_av THEN (
      SELECT count(*)::integer
      FROM public.product_variants v
      WHERE v.product_id = p.id
        AND v.activo
        AND v.en_oferta
        AND v.precio_anterior IS NOT NULL
        AND v.precio_anterior > v.precio
    )
    ELSE 0
  END AS oferta_variantes_count,
  CASE WHEN vhas.has_av THEN ovf.id END AS oferta_variant_id
FROM public.products p
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT 1 FROM public.product_variants v
    WHERE v.product_id = p.id AND v.activo
  ) AS has_av
) vhas
LEFT JOIN LATERAL (
  SELECT v.id,
         v.precio,
         v.precio_anterior,
         round(((v.precio_anterior - v.precio) / v.precio_anterior) * 100)::integer AS descuento_pct
  FROM public.product_variants v
  WHERE v.product_id = p.id
    AND v.activo
    AND v.en_oferta
    AND v.precio_anterior IS NOT NULL
    AND v.precio_anterior > v.precio
  ORDER BY v.precio ASC
  LIMIT 1
) ovf ON vhas.has_av;

-- ------------------------------------------------------------
-- 6. GRANTS de lectura (la escritura no existe en una vista)
-- ------------------------------------------------------------
GRANT SELECT ON public.products_ofertas TO anon;
GRANT SELECT ON public.products_ofertas TO authenticated;

-- ------------------------------------------------------------
-- 7. Recargar el cache de esquema de PostgREST
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
