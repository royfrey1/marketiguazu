-- ============================================================
-- Fase 3 — Migración A: RPC del webhook + fix de idempotencia
-- Migración: 20260926100000
--
-- Contenido:
--   1. apply_mp_payment_status() — RPC interna invocada SOLO por
--      mp-webhook (service_role). Localiza el pago por
--      provider_payment_id (fallback: external_reference = order_id),
--      sincroniza payments.status / orders.payment_status,
--      confirma stock (confirm_sale) al aprobar y libera reservas
--      (release_reservation) al rechazar/cancelar.
--   2. Grants: solo service_role (sin auth.uid() que validar).
--   3. Fix de release_reservation: idempotencia NETA
--      (reservas activas = Σ reservation − Σ release − Σ sale por
--      order + inventory). Antes, un segundo rechazo de la misma
--      orden no liberaba nada y la reserva quedaba fuga.
--
-- Reversible: DROP FUNCTION apply_mp_payment_status + restaurar
-- el cuerpo original de release_reservation (ver respaldo en
-- migración 20260907120000).
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. apply_mp_payment_status()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_mp_payment_status(
  p_provider_payment_id text,   -- id del pago en MP (data.id del webhook)
  p_external_reference   text,  -- orders.id reportado por MP (external_reference)
  p_new_status           text,  -- estado canónico YA mapeado (pending|approved|rejected|refunded|cancelled)
  p_raw_status           text,  -- estado crudo de MP (auditoría → metadata)
  p_mp_amount            numeric -- transaction_amount reportado por MP
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_payment      record;
  v_order        record;
  v_changed      boolean := false;
  v_reason       text;
  v_stock_errors text[]  := ARRAY[]::text[];
  v_item         record;
BEGIN
  -- 0. validaciones estructurales (error = bug nuestro → excepción)
  IF p_provider_payment_id IS NULL OR length(trim(p_provider_payment_id)) = 0 THEN
    RAISE EXCEPTION 'provider_payment_id vacío';
  END IF;
  IF p_new_status NOT IN ('pending','approved','rejected','refunded','cancelled') THEN
    RAISE EXCEPTION 'Estado canónico no reconocido: %', p_new_status;
  END IF;

  -- 1. lookup directo por id de MP (notificaciones repetidas / reintentos)
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider = 'mercadopago'
    AND provider_payment_id = p_provider_payment_id
  FOR UPDATE;

  -- 2. fallback: PRIMER contacto → asociar por external_reference (order_id),
  --    eligiendo la fila pending sin id de MP de esa orden
  IF NOT FOUND THEN
    IF p_external_reference IS NULL OR p_external_reference !~ '^[0-9]+$' THEN
      RETURN jsonb_build_object('changed', false, 'reason', 'payment_row_not_found',
        'provider_payment_id', p_provider_payment_id,
        'external_reference', p_external_reference);
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_external_reference::integer
      AND provider = 'mercadopago'
      AND provider_payment_id IS NULL
      AND status = 'pending'
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      -- caso terminalmente irresoluble: no tiene sentido reintentar
      RETURN jsonb_build_object('changed', false, 'reason', 'payment_row_not_found',
        'provider_payment_id', p_provider_payment_id,
        'order_id', p_external_reference::integer);
    END IF;
  END IF;

  -- 3. bloquear la orden
  SELECT * INTO v_order
  FROM public.orders WHERE id = v_payment.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no encontrado', v_payment.order_id;
  END IF;

  -- 4. registrar id de MP en la fila (solo primera vez) y
  --    auditoría del estado crudo (merge: conserva preference_id)
  UPDATE public.payments
  SET provider_payment_id = p_provider_payment_id, updated_at = now()
  WHERE id = v_payment.id
    AND provider_payment_id IS DISTINCT FROM p_provider_payment_id;

  UPDATE public.payments
  SET metadata   = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('mp',
                     jsonb_build_object('status_raw', p_raw_status,
                                        'last_synced_at', extract(epoch FROM now())::bigint)),
      updated_at = now()
  WHERE id = v_payment.id;

  -- 5. monto: MP es autoritativo; discrepancia = incidente, no aplicar
  IF p_mp_amount IS NOT NULL AND p_mp_amount <> v_payment.amount THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'amount_mismatch',
      'payment_id', v_payment.id, 'order_id', v_order.id,
      'numero_pedido', v_order.numero_pedido,
      'expected_amount', v_payment.amount, 'mp_amount', p_mp_amount);
  END IF;

  -- 6. idempotencia: mismo estado → no-op (clave para reintentos de MP)
  IF v_payment.status = p_new_status THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'same_status',
      'payment_id', v_payment.id, 'order_id', v_order.id,
      'payment_status', v_payment.status, 'order_status', v_order.status);
  END IF;

  -- 7. matriz de transiciones. Fuera de matriz (eventos fuera de orden,
  --    degradaciones) → ignorar SIN excepción: MP no debe recibir 500/retries.
  IF (v_payment.status = 'pending'  AND p_new_status IN ('approved','rejected','cancelled'))
  OR (v_payment.status = 'rejected' AND p_new_status = 'cancelled')
  OR (v_payment.status = 'approved' AND p_new_status = 'refunded') THEN
    v_changed := true;
  ELSE
    RETURN jsonb_build_object('changed', false, 'reason', 'ignored_transition',
      'payment_id', v_payment.id, 'order_id', v_order.id,
      'from', v_payment.status, 'to', p_new_status);
  END IF;

  -- 8. aplicar estados (misma sincronía que update_payment_status)
  UPDATE public.payments SET status = p_new_status, updated_at = now()
  WHERE id = v_payment.id;
  UPDATE public.orders SET payment_status = p_new_status, updated_at = now()
  WHERE id = v_order.id;

  -- 9. aprobado → orden paid + confirmar venta por cada item
  IF p_new_status = 'approved' THEN
    IF v_order.status = 'pending' THEN
      UPDATE public.orders SET status = 'paid', updated_at = now()
      WHERE id = v_order.id;

      FOR v_item IN
        SELECT product_id, variant_id, cantidad FROM public.order_items
        WHERE order_id = v_order.id AND product_id IS NOT NULL AND cantidad > 0
      LOOP
        BEGIN
          PERFORM public.confirm_sale(v_item.product_id, v_item.variant_id,
                                      v_item.cantidad, v_order.id);
        EXCEPTION WHEN OTHERS THEN
          -- NUNCA abortar la acreditación por stock: dejar constancia
          v_stock_errors := v_stock_errors || SQLERRM;
        END;
      END LOOP;
    ELSIF v_order.status = 'cancelled' THEN
      -- pago acreditado después de cancelar (cron): no tocar stock,
      -- requiere acción manual (reembolso o reactivar orden)
      v_reason := 'order_cancelled_late_payment';
    END IF;
  END IF;

  -- 10. rechazado/cancelado + orden todavía pending → liberar reservas
  IF p_new_status IN ('rejected','cancelled') AND v_order.status = 'pending' THEN
    FOR v_item IN
      SELECT product_id, variant_id, cantidad FROM public.order_items
      WHERE order_id = v_order.id AND product_id IS NOT NULL AND cantidad > 0
    LOOP
      BEGIN
        PERFORM public.release_reservation(v_item.product_id, v_item.variant_id,
                                           v_item.cantidad, v_order.id);
      EXCEPTION WHEN OTHERS THEN
        v_stock_errors := v_stock_errors || SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'numero_pedido', v_order.numero_pedido,
    'previous_payment_status', v_payment.status,
    'payment_status', p_new_status,
    'order_status', CASE WHEN v_order.status = 'pending' AND p_new_status = 'approved'
                         THEN 'paid' ELSE v_order.status END,
    'changed', true,
    'reason', COALESCE(v_reason, 'applied'),
    'stock_errors', to_jsonb(v_stock_errors));
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Grants de apply_mp_payment_status: SOLO service_role
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.apply_mp_payment_status(text, text, text, text, numeric)
  FROM PUBLIC, anon, authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.apply_mp_payment_status(text, text, text, text, numeric)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Fix: release_reservation con idempotencia NETA
--
-- Antes: "si ya existe un release para esta orden → no-op". Con reintentos
-- de pago de la misma orden (reservar → rechazar → reservar → rechazar),
-- el segundo release veía el release del primer intento y no liberaba,
-- dejando reserved clavado (fuga de stock reservado).
--
-- Ahora: reservas activas de la orden en este inventory
--   neto = Σ reservation − Σ release − Σ sale
--   neto ≤ 0 → no-op; si no, libera LEAST(p_cantidad, neto).
-- El guard de confirm_sale (por movimiento 'sale') no cambia: es correcto.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_reservation(
  p_product_id integer,
  p_variant_id integer,
  p_cantidad integer,
  p_order_id integer
)
RETURNS void AS $$
DECLARE
  v_inventory_id integer;
  v_reserved integer;
  v_net integer;
  v_to_release integer;
BEGIN
  -- Validar parámetros
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0. Recibido: %', p_cantidad;
  END IF;

  -- Buscar fila de inventario y bloquearla
  SELECT id, reserved
  INTO v_inventory_id, v_reserved
  FROM inventory
  WHERE product_id = p_product_id
    AND (
      (p_variant_id IS NULL AND variant_id IS NULL)
      OR
      (variant_id = p_variant_id)
    )
  FOR UPDATE;

  -- Verificar que exista
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
      p_product_id, p_variant_id;
  END IF;

  -- Idempotencia neta: reservas activas de ESTA orden en ESTE inventory
  SELECT
    COALESCE(SUM(cantidad) FILTER (WHERE tipo = 'reservation'), 0)
    - COALESCE(SUM(cantidad) FILTER (WHERE tipo IN ('release', 'sale')), 0)
  INTO v_net
  FROM inventory_movements
  WHERE inventory_id = v_inventory_id
    AND referencia_tipo = 'order'
    AND referencia_id = p_order_id;

  IF v_net IS NULL OR v_net <= 0 THEN
    -- ya liberado / venta confirmada / nada que liberar
    RETURN;
  END IF;

  -- Nunca liberar de más de lo reservado activamente por la orden
  v_to_release := LEAST(p_cantidad, v_net);

  -- Verificar que haya reserva física que liberar
  IF v_reserved < v_to_release THEN
    RAISE EXCEPTION 'Reserva insuficiente para liberar. Reservado: %, a liberar: %',
      v_reserved, v_to_release;
  END IF;

  -- Liberar reserva
  UPDATE inventory
  SET reserved = reserved - v_to_release,
      updated_at = now()
  WHERE id = v_inventory_id;

  -- Registrar movimiento de liberación
  INSERT INTO inventory_movements (
    inventory_id, tipo, direccion, cantidad,
    referencia_tipo, referencia_id
  ) VALUES (
    v_inventory_id, 'release', 'increase', v_to_release,
    'order', p_order_id
  );
END;
$$ LANGUAGE plpgsql
SET search_path = public;
