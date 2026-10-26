-- Migracion: Etapa 2B.1 — list_recent_price_batches incluye los primeros
-- nombres de productos de cada lote ("productos") y el total de productos
-- distintos tocados ("productos_total"). Compatible hacia atras: todos los
-- campos actuales (id, created_at, meta, products_count, variants_count,
-- undo_of, undone_at) se mantienen igual, mismo orden y misma validacion.
--
-- "productos": hasta 5 titulos (text) de productos distintos tocados por el
--   lote segun price_history.batch_id: las filas con product_id aportan su
--   producto; las filas con variant_id aportan el producto de la variante.
--   Un producto con varias variantes aparece una sola vez (DISTINCT por
--   product_id). Orden determinista: product_id ascendente.
-- "productos_total": cantidad de productos DISTINTOS tocados por el lote
--   (para que el frontend muestre "y N mas"). Si un producto fue borrado
--   definitivamente su historial cae por cascade, simplemente no cuenta.

CREATE OR REPLACE FUNCTION public.list_recent_price_batches(p_limit integer DEFAULT 10)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_limit int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos de administrador'
      USING ERRCODE = 'P4003';
  END IF;
  v_limit := least(greatest(coalesce(p_limit, 10), 1), 50);
  RETURN (
    SELECT coalesce(
      jsonb_agg(
        to_jsonb(b) || jsonb_build_object(
          'productos', coalesce(n.productos, '[]'::jsonb),
          'productos_total', coalesce(n.productos_total, 0)
        )
        ORDER BY b.created_at DESC
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT id, created_at, meta, products_count, variants_count, undo_of, undone_at
      FROM public.price_change_batches
      ORDER BY created_at DESC
      LIMIT v_limit
    ) b
    LEFT JOIN LATERAL (
      WITH touched AS (
        SELECT DISTINCT ph.product_id AS product_id
        FROM public.price_history ph
        WHERE ph.batch_id = b.id
          AND ph.product_id IS NOT NULL
        UNION
        SELECT DISTINCT pv.product_id AS product_id
        FROM public.price_history ph
        JOIN public.product_variants pv ON pv.id = ph.variant_id
        WHERE ph.batch_id = b.id
          AND ph.variant_id IS NOT NULL
      )
      SELECT
        (
          SELECT jsonb_agg(p.titulo ORDER BY p.id)
          FROM (
            SELECT t.product_id
            FROM touched t
            JOIN public.products p ON p.id = t.product_id
            ORDER BY t.product_id
            LIMIT 5
          ) limited
          JOIN public.products p ON p.id = limited.product_id
        ) AS productos,
        (
          SELECT count(*)
          FROM touched t
          JOIN public.products p ON p.id = t.product_id
        ) AS productos_total
    ) n ON true
  );
END;
$function$
;

COMMENT ON FUNCTION public.list_recent_price_batches(integer) IS
  'Lista los últimos lotes de cambio masivo de precios (1..50, default 10) para la UI admin. SECURITY DEFINER; solo admin (P4003 si no). Cada elemento mantiene id, created_at, meta, products_count, variants_count, undo_of, undone_at y agrega "productos" (hasta 5 titulos de productos distintos tocados segun price_history, DISTINCT por producto, ordenados por product_id) y "productos_total" (productos distintos tocados; el historial de productos borrados definitivamente cae por cascade y no cuenta).';
