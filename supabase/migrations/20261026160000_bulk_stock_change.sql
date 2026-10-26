-- Migracion: Etapa 3 — acciones masivas de stock (paralelo a la Etapa 2B de
-- precios). NUEVAS piezas solamente; no altera adjust_stock, reserve_stock,
-- release_reservation, confirm_sale, cancel_order ni ninguna otra funcion.
--
--   * stock_change_batches: lotes de ajuste masivo (auditoria + Deshacer).
--   * inventory_movements.batch_id: lote al que pertenece cada movimiento.
--   * apply_stock_change_bulk(p_items, p_meta): aplica stock ABSOLUTO por fila
--     (la vista previa ya calculo set/add/sub), todo o nada, maximo 500 filas,
--     con concurrencia optimista (expected_quantity) y bloqueo ORDER BY id.
--   * undo_stock_change_bulk(p_batch_id): revierte por DELTA INVERSO (nunca
--     stock absoluto, porque pudo haber ventas/reservas despues); parcial.
--   * list_recent_stock_batches(p_limit): lotes recientes para la UI, con
--     "productos" (hasta 5 titulos distintos) y "productos_total".

-- ===== 2.1 Tabla de lotes =====

CREATE TABLE public.stock_change_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_count integer,
  undo_of uuid REFERENCES public.stock_change_batches(id) ON DELETE SET NULL,
  undone_at timestamptz,
  undone_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.stock_change_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_change_batches_admin_select ON public.stock_change_batches
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.stock_change_batches FROM anon, authenticated;
GRANT SELECT ON public.stock_change_batches TO authenticated;

COMMENT ON TABLE public.stock_change_batches IS
  'Lotes de cambio masivo de stock (Etapa 3). Escritos solo via apply_stock_change_bulk / undo_stock_change_bulk (SECURITY DEFINER); SELECT solo para admin via RLS.';

-- ===== 2.2 batch_id en inventory_movements =====

ALTER TABLE public.inventory_movements
  ADD COLUMN batch_id uuid REFERENCES public.stock_change_batches(id) ON DELETE SET NULL;

CREATE INDEX inventory_movements_batch_id_idx ON public.inventory_movements (batch_id)
  WHERE batch_id IS NOT NULL;

-- ===== 2.3 apply_stock_change_bulk =====

CREATE OR REPLACE FUNCTION public.apply_stock_change_bulk(
  p_items jsonb,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid;
  v_meta_size int;
  v_modo text;
  v_motivo text;
  v_n int := 0;
  v_problems jsonb := '[]'::jsonb;
  v_priority int := 99;
  v_code text;
  v_seen int[] := '{}';
  v_expected_map jsonb := '{}'::jsonb;
  v_new_map jsonb := '{}'::jsonb;
  v_id int;
  v_expected numeric;
  v_new numeric;
  v_item jsonb;
  v_cur record;
  v_unchanged int := 0;
  v_changed int := 0;
  v_ch_ids int[] := '{}';
  v_ch_new int[] := '{}';
  v_batch_id uuid;
  v_delta int;
  v_dir text;
  v_tipo text;
  i int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos de administrador'
      USING ERRCODE = 'P4003';
  END IF;
  v_user_id := auth.uid();

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: p_items debe ser un array JSON'
      USING ERRCODE = 'P4094';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: el lote esta vacio'
      USING ERRCODE = 'P4094';
  END IF;
  IF jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: el lote debe tener entre 1 y 500 filas (recibido: %)',
      jsonb_array_length(p_items)
      USING ERRCODE = 'P4094';
  END IF;
  IF jsonb_typeof(p_meta) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: p_meta debe ser un objeto JSON'
      USING ERRCODE = 'P4094';
  END IF;
  v_meta_size := octet_length(p_meta::text);
  IF v_meta_size > 2048 THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: p_meta supera 2 KB (% bytes)', v_meta_size
      USING ERRCODE = 'P4094';
  END IF;
  v_modo := p_meta->>'modo';
  IF v_modo IS NULL OR v_modo NOT IN ('set', 'add', 'sub') THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: meta.modo debe ser set, add o sub'
      USING ERRCODE = 'P4094';
  END IF;
  IF jsonb_typeof(p_meta->'valor') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'VALOR_INVALIDO: meta.valor debe ser numerico'
      USING ERRCODE = '22023';
  END IF;
  v_motivo := trim(coalesce(p_meta->>'motivo', ''));
  IF length(v_motivo) < 3 OR length(v_motivo) > 200 THEN
    RAISE EXCEPTION 'MOTIVO_INVALIDO: el motivo debe tener entre 3 y 200 caracteres'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item->'inventory_id') IS DISTINCT FROM 'number'
       OR (v_item->>'inventory_id')::numeric <> floor((v_item->>'inventory_id')::numeric)
       OR (v_item->>'inventory_id')::numeric < 1
       OR (v_item->>'inventory_id')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'STOCK_INVALIDO: inventory_id debe ser un entero positivo'
        USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'expected_quantity') IS DISTINCT FROM 'number'
       OR (v_item->>'expected_quantity')::numeric <> floor((v_item->>'expected_quantity')::numeric)
       OR (v_item->>'expected_quantity')::numeric < 0
       OR (v_item->>'expected_quantity')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'STOCK_INVALIDO: expected_quantity debe ser un entero >= 0'
        USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number'
       OR (v_item->>'quantity')::numeric <> floor((v_item->>'quantity')::numeric)
       OR (v_item->>'quantity')::numeric < 0
       OR (v_item->>'quantity')::numeric > 1000000 THEN
      RAISE EXCEPTION 'STOCK_INVALIDO: quantity debe ser un entero entre 0 y 1000000'
        USING ERRCODE = '22023';
    END IF;
    v_id := (v_item->>'inventory_id')::int;
    v_expected := (v_item->>'expected_quantity')::numeric;
    v_new := (v_item->>'quantity')::numeric;
    IF v_id = ANY(v_seen) THEN
      v_problems := v_problems || jsonb_build_object(
        'inventory_id', v_id, 'product_id', null, 'variant_id', null, 'motivo', 'duplicado');
      v_priority := least(v_priority, 1);
    ELSE
      v_seen := v_seen || v_id;
      v_expected_map := v_expected_map || jsonb_build_object(v_id::text, v_expected);
      v_new_map := v_new_map || jsonb_build_object(v_id::text, v_new);
    END IF;
    v_n := v_n + 1;
  END LOOP;

  FOR v_cur IN
    SELECT i.id, i.product_id, i.variant_id, i.quantity, i.reserved, p.deleted_at
    FROM public.inventory i
    JOIN public.products p ON p.id = i.product_id
    WHERE i.id = ANY(v_seen)
    ORDER BY i.id
    FOR UPDATE OF i
  LOOP
    v_expected := (v_expected_map->>(v_cur.id::text))::numeric;
    v_new := (v_new_map->>(v_cur.id::text))::numeric;

    IF v_cur.deleted_at IS NOT NULL THEN
      v_problems := v_problems || jsonb_build_object(
        'inventory_id', v_cur.id, 'product_id', v_cur.product_id,
        'variant_id', v_cur.variant_id, 'motivo', 'en_papelera');
      v_priority := least(v_priority, 2);
    ELSIF v_cur.quantity IS DISTINCT FROM v_expected THEN
      v_problems := v_problems || jsonb_build_object(
        'inventory_id', v_cur.id, 'product_id', v_cur.product_id,
        'variant_id', v_cur.variant_id, 'motivo', 'stock_cambiado');
      v_priority := least(v_priority, 3);
    ELSIF v_new < v_cur.reserved THEN
      v_problems := v_problems || jsonb_build_object(
        'inventory_id', v_cur.id, 'product_id', v_cur.product_id,
        'variant_id', v_cur.variant_id, 'motivo', 'stock_invalido');
      v_priority := least(v_priority, 4);
    ELSIF v_new = v_cur.quantity THEN
      v_unchanged := v_unchanged + 1;
    ELSE
      v_changed := v_changed + 1;
      v_ch_ids := v_ch_ids || v_cur.id;
      v_ch_new := v_ch_new || v_new::int;
    END IF;
  END LOOP;

  FOR v_id IN SELECT unnest(v_seen) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.id = v_id) THEN
      v_problems := v_problems || jsonb_build_object(
        'inventory_id', v_id, 'product_id', null, 'variant_id', null, 'motivo', 'no_existe');
      v_priority := least(v_priority, 1);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_problems) > 0 THEN
    v_code := CASE v_priority
      WHEN 1 THEN 'P4095'
      WHEN 2 THEN 'P4043'
      WHEN 3 THEN 'P4096'
      ELSE 'P4097'
    END;
    RAISE EXCEPTION 'Lote rechazado: % fila(s) con problemas. Ningun stock fue modificado.',
      jsonb_array_length(v_problems)
      USING ERRCODE = v_code,
            DETAIL = jsonb_build_object('problems', v_problems)::text;
  END IF;

  IF v_changed = 0 THEN
    RETURN jsonb_build_object('batch_id', null, 'changed', 0, 'unchanged', v_unchanged);
  END IF;

  INSERT INTO public.stock_change_batches (created_by, meta, rows_count)
  VALUES (v_user_id, p_meta, v_changed)
  RETURNING id INTO v_batch_id;

  FOR i IN 1..array_length(v_ch_ids, 1) LOOP
    UPDATE public.inventory
    SET quantity = v_ch_new[i],
        updated_at = now()
    WHERE id = v_ch_ids[i];

    v_delta := v_ch_new[i] - (v_expected_map->>(v_ch_ids[i]::text))::int;
    v_dir := CASE WHEN v_delta > 0 THEN 'increase' ELSE 'decrease' END;
    v_tipo := CASE WHEN v_modo = 'add' AND v_delta > 0 THEN 'restock' ELSE 'adjustment' END;

    INSERT INTO public.inventory_movements (
      inventory_id, tipo, direccion, cantidad,
      notas, created_by, batch_id
    ) VALUES (
      v_ch_ids[i], v_tipo, v_dir, abs(v_delta),
      'Masivo: ' || v_motivo, v_user_id, v_batch_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'changed', v_changed,
    'unchanged', v_unchanged
  );
END;
$function$
;

COMMENT ON FUNCTION public.apply_stock_change_bulk(jsonb, jsonb) IS
  'Aplica un lote de cambios de stock (1..500 filas, todo o nada) sobre inventory.quantity. SECURITY DEFINER; solo admin (P4003). Entrada: [{"inventory_id","expected_quantity","quantity"}] + meta {modo set|add|sub, valor, motivo}. Concurrencia optimista (P4096) y bloqueo ORDER BY id FOR UPDATE. Registra stock_change_batches y un inventory_movements por fila cambiada (tipo restock solo para modo add con increase; adjustment en los demas casos). Devuelve {batch_id, changed, unchanged}.';

-- ===== 2.4 undo_stock_change_bulk =====

CREATE OR REPLACE FUNCTION public.undo_stock_change_bulk(p_batch_id uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid;
  v_batch record;
  v_ids int[];
  v_deltas jsonb;
  v_cur record;
  v_id int;
  v_delta int;
  v_new int;
  v_skipped jsonb := '[]'::jsonb;
  v_to_restore int[] := '{}';
  v_to_new int[] := '{}';
  v_child uuid;
  i int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos de administrador'
      USING ERRCODE = 'P4003';
  END IF;
  v_user_id := auth.uid();

  SELECT id, undo_of, undone_at
  INTO v_batch
  FROM public.stock_change_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOTE_INEXISTENTE: no existe el lote de stock indicado'
      USING ERRCODE = 'P4098';
  END IF;
  IF v_batch.undo_of IS NOT NULL OR v_batch.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'LOTE_NO_DESHACIBLE: el lote ya fue deshecho o es el resultado de un deshacer'
      USING ERRCODE = 'P4099';
  END IF;

  SELECT array_agg(DISTINCT m.inventory_id ORDER BY m.inventory_id)
  INTO v_ids
  FROM public.inventory_movements m
  WHERE m.batch_id = p_batch_id;

  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('batch_id', null, 'restored', 0, 'skipped', '[]'::jsonb);
  END IF;

  SELECT coalesce(
    jsonb_object_agg(inventory_id, delta),
    '{}'::jsonb
  ) INTO v_deltas
  FROM (
    SELECT m.inventory_id,
           sum(CASE WHEN m.direccion = 'increase' THEN m.cantidad ELSE -m.cantidad END)::int AS delta
    FROM public.inventory_movements m
    WHERE m.batch_id = p_batch_id
    GROUP BY m.inventory_id
  ) d;

  FOR v_cur IN
    SELECT i.id, i.product_id, i.variant_id, i.quantity, i.reserved
    FROM public.inventory i
    WHERE i.id = ANY(v_ids)
    ORDER BY i.id
    FOR UPDATE
  LOOP
    v_delta := (v_deltas->>(v_cur.id::text))::int;
    IF v_delta = 0 THEN
      v_skipped := v_skipped || jsonb_build_object(
        'inventory_id', v_cur.id, 'product_id', v_cur.product_id,
        'variant_id', v_cur.variant_id, 'motivo', 'stock_insuficiente');
      CONTINUE;
    END IF;
    v_new := v_cur.quantity - v_delta;
    IF v_new < 0 THEN
      v_skipped := v_skipped || jsonb_build_object(
        'inventory_id', v_cur.id, 'product_id', v_cur.product_id,
        'variant_id', v_cur.variant_id, 'motivo', 'stock_negativo');
    ELSIF v_new < v_cur.reserved THEN
      v_skipped := v_skipped || jsonb_build_object(
        'inventory_id', v_cur.id, 'product_id', v_cur.product_id,
        'variant_id', v_cur.variant_id, 'motivo', 'stock_insuficiente');
    ELSE
      v_to_restore := v_to_restore || v_cur.id;
      v_to_new := v_to_new || v_new;
    END IF;
  END LOOP;

  FOREACH v_id IN ARRAY v_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.id = v_id) THEN
      v_skipped := v_skipped || jsonb_build_object(
        'inventory_id', v_id, 'product_id', null, 'variant_id', null, 'motivo', 'no_existe');
    END IF;
  END LOOP;

  IF array_length(v_to_restore, 1) IS NULL THEN
    RETURN jsonb_build_object('batch_id', null, 'restored', 0, 'skipped', v_skipped);
  END IF;

  INSERT INTO public.stock_change_batches (created_by, meta, rows_count, undo_of)
  VALUES (v_user_id, jsonb_build_object('modo', 'undo'), array_length(v_to_restore, 1), p_batch_id)
  RETURNING id INTO v_child;

  FOR i IN 1..array_length(v_to_restore, 1) LOOP
    v_delta := (v_deltas->>(v_to_restore[i]::text))::int;
    UPDATE public.inventory
    SET quantity = v_to_new[i],
        updated_at = now()
    WHERE id = v_to_restore[i];

    INSERT INTO public.inventory_movements (
      inventory_id, tipo, direccion, cantidad,
      notas, created_by, batch_id
    ) VALUES (
      v_to_restore[i], 'adjustment',
      CASE WHEN v_delta > 0 THEN 'decrease' ELSE 'increase' END,
      abs(v_delta),
      'Deshacer lote masivo', v_user_id, v_child
    );
  END LOOP;

  UPDATE public.stock_change_batches
  SET undone_at = now(),
      undone_by = v_user_id
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_child,
    'restored', array_length(v_to_restore, 1),
    'skipped', v_skipped
  );
END;
$function$
;

COMMENT ON FUNCTION public.undo_stock_change_bulk(uuid) IS
  'Deshace un lote de ajuste masivo de stock por DELTA INVERSO sobre el stock ACTUAL (no pisa ventas/reservas posteriores). SECURITY DEFINER; solo admin (P4003). Lote inexistente: P4098; ya deshecho o lote-hijo: P4099. Filas cuyo resultado seria < 0 o < reserved van en "skipped"; si no se restaura nada el lote original no se marca y batch_id es null. Registra movimientos adjustment con el batch hijo (undo_of).';

-- ===== 2.5 list_recent_stock_batches =====

CREATE OR REPLACE FUNCTION public.list_recent_stock_batches(p_limit integer DEFAULT 10)
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
      SELECT id, created_at, meta, rows_count, undo_of, undone_at
      FROM public.stock_change_batches
      ORDER BY created_at DESC
      LIMIT v_limit
    ) b
    LEFT JOIN LATERAL (
      WITH touched AS (
        SELECT DISTINCT i.product_id AS product_id
        FROM public.inventory_movements m
        JOIN public.inventory i ON i.id = m.inventory_id
        WHERE m.batch_id = b.id
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

COMMENT ON FUNCTION public.list_recent_stock_batches(integer) IS
  'Lista los ultimos lotes de cambio masivo de stock (1..50, default 10) para la UI admin. SECURITY DEFINER; solo admin (P4003). Cada elemento: id, created_at, meta, rows_count, undo_of, undone_at + "productos" (hasta 5 titulos de productos distintos tocados, orden por product_id) y "productos_total".';

-- ===== Permisos de las 3 RPC =====

REVOKE ALL ON FUNCTION public.apply_stock_change_bulk(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_stock_change_bulk(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_recent_stock_batches(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.apply_stock_change_bulk(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_stock_change_bulk(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_recent_stock_batches(integer) TO authenticated, service_role;
