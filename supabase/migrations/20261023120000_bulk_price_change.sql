-- Etapa 2B: cambio masivo de precios.
-- Tabla de lotes + columna batch_id en price_history + RPCs de aplicación y deshacer.
-- Solo cambia la columna precio; precio_anterior y en_oferta quedan intactos.

BEGIN;

-- 2.1 Tabla de lotes
CREATE TABLE public.price_change_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  products_count integer,
  variants_count integer,
  undo_of uuid REFERENCES public.price_change_batches(id) ON DELETE SET NULL,
  undone_at timestamptz,
  undone_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.price_change_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_change_batches_admin_select ON public.price_change_batches
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.price_change_batches FROM anon, authenticated;
GRANT SELECT ON public.price_change_batches TO authenticated;

COMMENT ON TABLE public.price_change_batches IS
  'Lotes de cambio masivo de precios (Etapa 2B). Escritura solo via RPCs SECURITY DEFINER.';

-- 2.2 batch_id en price_history
ALTER TABLE public.price_history
  ADD COLUMN batch_id uuid REFERENCES public.price_change_batches(id) ON DELETE SET NULL;

CREATE INDEX price_history_batch_id_idx ON public.price_history (batch_id)
  WHERE batch_id IS NOT NULL;

-- 2.3 RPC de aplicación
CREATE FUNCTION public.apply_price_change_bulk(
  p_items jsonb,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_meta_size int;
  v_total int := 0;
  v_problems jsonb := '[]'::jsonb;
  v_priority int := 99;
  v_prod_ids bigint[] := '{}';
  v_var_ids bigint[] := '{}';
  v_pid bigint;
  v_vid bigint;
  v_item jsonb;
  v_var jsonb;
  v_expected numeric;
  v_new numeric;
  v_cur record;
  v_p_deleted timestamptz;
  v_unchanged int := 0;
  v_batch_id uuid;
  v_ch_pids bigint[] := '{}';
  v_ch_pold numeric[] := '{}';
  v_ch_pnew numeric[] := '{}';
  v_ch_vids bigint[] := '{}';
  v_ch_vold numeric[] := '{}';
  v_ch_vnew numeric[] := '{}';
  v_n_prod int;
  v_n_var int;
  v_code text;
  v_ok boolean;
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
  IF jsonb_typeof(p_meta) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: p_meta debe ser un objeto JSON'
      USING ERRCODE = 'P4094';
  END IF;
  v_meta_size := octet_length(p_meta::text);
  IF v_meta_size > 2048 THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: p_meta supera 2 KB (% bytes)', v_meta_size
      USING ERRCODE = 'P4094';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + 1;
    IF v_item->'variantes' IS NOT NULL AND jsonb_typeof(v_item->'variantes') = 'array' THEN
      v_total := v_total + jsonb_array_length(v_item->'variantes');
    END IF;
  END LOOP;
  IF v_total = 0 OR v_total > 500 THEN
    RAISE EXCEPTION 'TAMANO_LOTE_INVALIDO: el lote debe tener entre 1 y 500 filas (recibido: %)', v_total
      USING ERRCODE = 'P4094';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item->'precio') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item->'expected_precio') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'PRECIO_INVALIDO: precio y expected_precio del producto deben ser numericos'
        USING ERRCODE = '22023';
    END IF;
    v_new := round((v_item->>'precio')::numeric, 2);
    IF v_new <= 0 OR v_new > 9999999999 THEN
      RAISE EXCEPTION 'PRECIO_INVALIDO: el precio debe estar entre 0 (exclusivo) y 9999999999'
        USING ERRCODE = '22023';
    END IF;
    IF v_item->'variantes' IS NOT NULL AND jsonb_typeof(v_item->'variantes') = 'array' THEN
      FOR v_var IN SELECT * FROM jsonb_array_elements(v_item->'variantes') LOOP
        IF jsonb_typeof(v_var->'precio') IS DISTINCT FROM 'number'
           OR jsonb_typeof(v_var->'expected_precio') IS DISTINCT FROM 'number' THEN
          RAISE EXCEPTION 'PRECIO_INVALIDO: precio y expected_precio de la variante deben ser numericos'
            USING ERRCODE = '22023';
        END IF;
        v_new := round((v_var->>'precio')::numeric, 2);
        IF v_new <= 0 OR v_new > 9999999999 THEN
          RAISE EXCEPTION 'PRECIO_INVALIDO: el precio de la variante debe estar entre 0 (exclusivo) y 9999999999'
            USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_pid := (v_item->>'product_id')::bigint;
      v_ok := true;
    EXCEPTION WHEN others THEN
      v_ok := false;
    END;
    IF NOT v_ok THEN
      v_problems := v_problems || jsonb_build_object('product_id', null, 'variant_id', null, 'motivo', 'no_existe');
      v_priority := least(v_priority, 1);
    ELSE
      IF v_pid = ANY(v_prod_ids) THEN
        v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'duplicado');
        v_priority := least(v_priority, 1);
      ELSE
        v_prod_ids := v_prod_ids || v_pid;
      END IF;
      IF v_item->'variantes' IS NOT NULL AND jsonb_typeof(v_item->'variantes') = 'array' THEN
        FOR v_var IN SELECT * FROM jsonb_array_elements(v_item->'variantes') LOOP
          BEGIN
            v_vid := (v_var->>'variant_id')::bigint;
            v_ok := true;
          EXCEPTION WHEN others THEN
            v_ok := false;
          END;
          IF NOT v_ok THEN
            v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'no_existe');
            v_priority := least(v_priority, 1);
          ELSIF v_vid = ANY(v_var_ids) THEN
            v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', v_vid, 'motivo', 'duplicado');
            v_priority := least(v_priority, 1);
          ELSE
            v_var_ids := v_var_ids || v_vid;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  PERFORM 1 FROM public.products WHERE id = ANY(v_prod_ids) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.product_variants WHERE id = ANY(v_var_ids) ORDER BY id FOR UPDATE;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item->'product_id') IS DISTINCT FROM 'number' THEN
      CONTINUE;
    END IF;
    v_pid := (v_item->>'product_id')::bigint;
    v_expected := round((v_item->>'expected_precio')::numeric, 2);
    v_new := round((v_item->>'precio')::numeric, 2);

    SELECT id, precio, deleted_at, en_oferta, precio_anterior
      INTO v_cur
    FROM public.products WHERE id = v_pid;

    IF NOT FOUND THEN
      v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'no_existe');
      v_priority := least(v_priority, 1);
    ELSIF v_cur.deleted_at IS NOT NULL THEN
      v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'en_papelera');
      v_priority := least(v_priority, 2);
    ELSIF v_cur.precio IS DISTINCT FROM v_expected THEN
      v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'precio_cambiado');
      v_priority := least(v_priority, 3);
    ELSIF v_cur.en_oferta AND NOT (
      v_cur.precio_anterior IS NOT NULL
      AND v_cur.precio_anterior > v_new
      AND v_cur.precio_anterior <= v_new * 10
    ) THEN
      v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'oferta_invalida');
      v_priority := least(v_priority, 4);
    ELSIF v_cur.precio IS DISTINCT FROM v_new THEN
      v_ch_pids := v_ch_pids || v_pid;
      v_ch_pold := v_ch_pold || v_cur.precio;
      v_ch_pnew := v_ch_pnew || v_new;
    ELSE
      v_unchanged := v_unchanged + 1;
    END IF;

    IF v_item->'variantes' IS NOT NULL AND jsonb_typeof(v_item->'variantes') = 'array' THEN
      FOR v_var IN SELECT * FROM jsonb_array_elements(v_item->'variantes') LOOP
        IF jsonb_typeof(v_var->'variant_id') IS DISTINCT FROM 'number' THEN
          CONTINUE;
        END IF;
        v_vid := (v_var->>'variant_id')::bigint;
        v_expected := round((v_var->>'expected_precio')::numeric, 2);
        v_new := round((v_var->>'precio')::numeric, 2);

        SELECT id, product_id, precio, en_oferta, precio_anterior
          INTO v_cur
        FROM public.product_variants WHERE id = v_vid;

        IF NOT FOUND THEN
          v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', v_vid, 'motivo', 'no_existe');
          v_priority := least(v_priority, 1);
        ELSIF v_cur.product_id IS DISTINCT FROM v_pid THEN
          v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', v_vid, 'motivo', 'no_existe');
          v_priority := least(v_priority, 1);
        ELSE
          SELECT deleted_at INTO v_p_deleted FROM public.products WHERE id = v_cur.product_id;
          IF v_p_deleted IS NOT NULL THEN
            v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', v_vid, 'motivo', 'en_papelera');
            v_priority := least(v_priority, 2);
          ELSIF v_cur.precio IS DISTINCT FROM v_expected THEN
            v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', v_vid, 'motivo', 'precio_cambiado');
            v_priority := least(v_priority, 3);
          ELSIF v_cur.en_oferta AND NOT (
            v_cur.precio_anterior IS NOT NULL
            AND v_cur.precio_anterior > v_new
            AND v_cur.precio_anterior <= v_new * 10
          ) THEN
            v_problems := v_problems || jsonb_build_object('product_id', v_pid, 'variant_id', v_vid, 'motivo', 'oferta_invalida');
            v_priority := least(v_priority, 4);
          ELSIF v_cur.precio IS DISTINCT FROM v_new THEN
            v_ch_vids := v_ch_vids || v_vid;
            v_ch_vold := v_ch_vold || v_cur.precio;
            v_ch_vnew := v_ch_vnew || v_new;
          ELSE
            v_unchanged := v_unchanged + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_problems) > 0 THEN
    v_code := CASE v_priority
      WHEN 1 THEN 'P4095'
      WHEN 2 THEN 'P4043'
      WHEN 3 THEN 'P4096'
      ELSE 'P4097'
    END;
    RAISE EXCEPTION 'Lote rechazado: % fila(s) con problemas. Ningun precio fue modificado.',
      jsonb_array_length(v_problems)
      USING ERRCODE = v_code,
            DETAIL = jsonb_build_object('problems', v_problems)::text;
  END IF;

  v_n_prod := coalesce(array_length(v_ch_pids, 1), 0);
  v_n_var := coalesce(array_length(v_ch_vids, 1), 0);

  IF v_n_prod = 0 AND v_n_var = 0 THEN
    RETURN jsonb_build_object('batch_id', null, 'products_changed', 0, 'variants_changed', 0, 'unchanged', v_unchanged);
  END IF;

  INSERT INTO public.price_change_batches (created_by, meta, products_count, variants_count)
  VALUES (v_user_id, p_meta, v_n_prod, v_n_var)
  RETURNING id INTO v_batch_id;

  FOR i IN 1..v_n_prod LOOP
    UPDATE public.products SET precio = v_ch_pnew[i], updated_at = now()
    WHERE id = v_ch_pids[i];
    INSERT INTO public.price_history (product_id, precio_anterior, precio_nuevo, origen, user_id, batch_id)
    VALUES (v_ch_pids[i], v_ch_pold[i], v_ch_pnew[i], 'bulk_update', v_user_id, v_batch_id);
  END LOOP;

  FOR i IN 1..v_n_var LOOP
    UPDATE public.product_variants SET precio = v_ch_vnew[i], updated_at = now()
    WHERE id = v_ch_vids[i];
    INSERT INTO public.price_history (product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id, batch_id)
    VALUES (null, v_ch_vids[i], v_ch_vold[i], v_ch_vnew[i], 'bulk_update', v_user_id, v_batch_id);
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'products_changed', v_n_prod,
    'variants_changed', v_n_var,
    'unchanged', v_unchanged
  );
END;
$$;

COMMENT ON FUNCTION public.apply_price_change_bulk(jsonb, jsonb) IS
  'Aplica un lote (max 500 filas) de cambio de precios: solo la columna precio en products/product_variants. Todo o nada. Registra price_history con origen bulk_update y el lote en price_change_batches.';

-- 2.4 RPC de deshacer
CREATE FUNCTION public.undo_price_change_bulk(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_batch record;
  v_rows jsonb;
  v_r jsonb;
  v_hist_pids bigint[];
  v_hist_vids bigint[];
  v_pid bigint;
  v_vid bigint;
  v_old numeric;
  v_newb numeric;
  v_cur record;
  v_rest_p int := 0;
  v_rest_v int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_ch_pids bigint[] := '{}';
  v_ch_pold numeric[] := '{}';
  v_ch_pnew numeric[] := '{}';
  v_ch_vids bigint[] := '{}';
  v_ch_vold numeric[] := '{}';
  v_ch_vnew numeric[] := '{}';
  v_new_batch_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos de administrador'
      USING ERRCODE = 'P4003';
  END IF;
  v_user_id := auth.uid();

  SELECT * INTO v_batch FROM public.price_change_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOTE_NO_ENCONTRADO: no existe el lote indicado'
      USING ERRCODE = 'P4098';
  END IF;
  IF v_batch.undone_at IS NOT NULL OR v_batch.undo_of IS NOT NULL THEN
    RAISE EXCEPTION 'LOTE_NO_DESHACIBLE: el lote ya fue deshecho o es el mismo un deshacer'
      USING ERRCODE = 'P4099';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_id', ph.product_id,
           'variant_id', ph.variant_id,
           'precio_anterior', ph.precio_anterior,
           'precio_nuevo', ph.precio_nuevo
         ) ORDER BY ph.id), '[]'::jsonb)
    INTO v_rows
  FROM public.price_history ph
  WHERE ph.batch_id = p_batch_id;

  SELECT array_agg(DISTINCT ph.product_id) INTO v_hist_pids
  FROM public.price_history ph
  WHERE ph.batch_id = p_batch_id AND ph.product_id IS NOT NULL;
  PERFORM 1 FROM public.products WHERE id = ANY(v_hist_pids) ORDER BY id FOR UPDATE;

  SELECT array_agg(DISTINCT ph.variant_id) INTO v_hist_vids
  FROM public.price_history ph
  WHERE ph.batch_id = p_batch_id AND ph.variant_id IS NOT NULL;
  PERFORM 1 FROM public.product_variants WHERE id = ANY(v_hist_vids) ORDER BY id FOR UPDATE;

  FOR v_r IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
    v_pid := nullif(v_r->>'product_id', '')::bigint;
    v_vid := nullif(v_r->>'variant_id', '')::bigint;
    v_old := (v_r->>'precio_anterior')::numeric;
    v_newb := (v_r->>'precio_nuevo')::numeric;

    IF v_pid IS NOT NULL THEN
      SELECT id, precio INTO v_cur FROM public.products WHERE id = v_pid;
      IF NOT FOUND THEN
        v_skipped := v_skipped || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'no_existe');
      ELSIF v_cur.precio IS DISTINCT FROM v_newb THEN
        v_skipped := v_skipped || jsonb_build_object('product_id', v_pid, 'variant_id', null, 'motivo', 'precio_cambiado');
      ELSE
        v_ch_pids := v_ch_pids || v_pid;
        v_ch_pold := v_ch_pold || v_cur.precio;
        v_ch_pnew := v_ch_pnew || v_old;
      END IF;
    ELSE
      SELECT id, precio INTO v_cur FROM public.product_variants WHERE id = v_vid;
      IF NOT FOUND THEN
        v_skipped := v_skipped || jsonb_build_object('product_id', null, 'variant_id', v_vid, 'motivo', 'no_existe');
      ELSIF v_cur.precio IS DISTINCT FROM v_newb THEN
        v_skipped := v_skipped || jsonb_build_object('product_id', null, 'variant_id', v_vid, 'motivo', 'precio_cambiado');
      ELSE
        v_ch_vids := v_ch_vids || v_vid;
        v_ch_vold := v_ch_vold || v_cur.precio;
        v_ch_vnew := v_ch_vnew || v_old;
      END IF;
    END IF;
  END LOOP;

  v_rest_p := coalesce(array_length(v_ch_pids, 1), 0);
  v_rest_v := coalesce(array_length(v_ch_vids, 1), 0);

  IF v_rest_p = 0 AND v_rest_v = 0 THEN
    RETURN jsonb_build_object('batch_id', null, 'restored_products', 0, 'restored_variants', 0, 'skipped', v_skipped);
  END IF;

  INSERT INTO public.price_change_batches (created_by, meta, products_count, variants_count, undo_of)
  VALUES (v_user_id, jsonb_build_object('undo_of', p_batch_id), v_rest_p, v_rest_v, p_batch_id)
  RETURNING id INTO v_new_batch_id;

  FOR i IN 1..v_rest_p LOOP
    UPDATE public.products SET precio = v_ch_pnew[i], updated_at = now()
    WHERE id = v_ch_pids[i];
    INSERT INTO public.price_history (product_id, precio_anterior, precio_nuevo, origen, user_id, batch_id)
    VALUES (v_ch_pids[i], v_ch_pold[i], v_ch_pnew[i], 'bulk_update', v_user_id, v_new_batch_id);
  END LOOP;

  FOR i IN 1..v_rest_v LOOP
    UPDATE public.product_variants SET precio = v_ch_vnew[i], updated_at = now()
    WHERE id = v_ch_vids[i];
    INSERT INTO public.price_history (product_id, variant_id, precio_anterior, precio_nuevo, origen, user_id, batch_id)
    VALUES (null, v_ch_vids[i], v_ch_vold[i], v_ch_vnew[i], 'bulk_update', v_user_id, v_new_batch_id);
  END LOOP;

  UPDATE public.price_change_batches
  SET undone_at = now(), undone_by = v_user_id
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_new_batch_id,
    'restored_products', v_rest_p,
    'restored_variants', v_rest_v,
    'skipped', v_skipped
  );
END;
$$;

COMMENT ON FUNCTION public.undo_price_change_bulk(uuid) IS
  'Deshace un lote de cambio masivo de precios: restaura el precio anterior del historial fila por fila (salta filas inexistentes o con precio posterior), crea un lote hijo con undo_of y marca el original como deshecho.';

-- 2.5 Listado de lotes recientes
CREATE FUNCTION public.list_recent_price_batches(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos de administrador'
      USING ERRCODE = 'P4003';
  END IF;
  v_limit := least(greatest(coalesce(p_limit, 10), 1), 50);
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
    FROM (
      SELECT id, created_at, meta, products_count, variants_count, undo_of, undone_at
      FROM public.price_change_batches
      ORDER BY created_at DESC
      LIMIT v_limit
    ) b
  );
END;
$$;

COMMENT ON FUNCTION public.list_recent_price_batches(integer) IS
  'Devuelve los ultimos lotes de cambio masivo de precios (max 50) para listarlos y deshacerlos desde el admin.';

-- Permisos
REVOKE ALL ON FUNCTION public.apply_price_change_bulk(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_price_change_bulk(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_recent_price_batches(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.apply_price_change_bulk(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_price_change_bulk(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_recent_price_batches(integer) TO authenticated, service_role;

COMMIT;
