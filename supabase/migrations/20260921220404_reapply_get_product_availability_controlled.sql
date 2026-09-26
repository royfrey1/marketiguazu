-- Extraída de supabase_migrations.schema_migrations del proyecto
-- remoto (marketplace-iguazu-db) el 2026-09-25, con su mismo
-- version/nombre. SQL idéntico al que ya está aplicado en el remoto.

DROP FUNCTION IF EXISTS public.get_product_availability();

CREATE OR REPLACE FUNCTION public.get_product_availability()
RETURNS TABLE (
  product_id integer,
  available integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH product_variant_info AS (
    SELECT
      p.id AS product_id,
      COUNT(pv.id) AS variant_count,
      BOOL_OR(pv.activo) AS has_active_variant
    FROM public.products AS p
    LEFT JOIN public.product_variants AS pv
      ON pv.product_id = p.id
    WHERE p.activo = true
    GROUP BY p.id
  ),
  product_level_stock AS (
    SELECT
      p.id AS product_id,
      (i.quantity - i.reserved)::integer AS available
    FROM public.products AS p
    INNER JOIN product_variant_info AS pvi
      ON pvi.product_id = p.id
    INNER JOIN public.inventory AS i
      ON i.product_id = p.id
     AND i.variant_id IS NULL
    WHERE p.activo = true
      AND pvi.variant_count = 0
      AND (i.quantity - i.reserved) > 0
  ),
  variant_level_stock AS (
    SELECT
      p.id AS product_id,
      SUM(i.quantity - i.reserved)::integer AS available
    FROM public.products AS p
    INNER JOIN product_variant_info AS pvi
      ON pvi.product_id = p.id
     AND pvi.variant_count > 0
     AND pvi.has_active_variant = true
    INNER JOIN public.inventory AS i
      ON i.product_id = p.id
     AND i.variant_id IS NOT NULL
    INNER JOIN public.product_variants AS pv
      ON pv.id = i.variant_id
     AND pv.product_id = i.product_id
     AND pv.activo = true
    WHERE p.activo = true
      AND (i.quantity - i.reserved) > 0
    GROUP BY p.id
    HAVING SUM(i.quantity - i.reserved) > 0
  )
  SELECT product_id, available FROM product_level_stock
  UNION ALL
  SELECT product_id, available FROM variant_level_stock;
$$;

REVOKE ALL ON FUNCTION public.get_product_availability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_product_availability() FROM postgres;
REVOKE ALL ON FUNCTION public.get_product_availability() FROM service_role;

GRANT EXECUTE ON FUNCTION public.get_product_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_availability() TO authenticated;
