-- ============================================================
-- Fix — cancel_order: idempotencia por saldo neto de reservas
--         + guard en update_payment_status para pedidos cancelados
-- ============================================================
-- Problema (verificado en producción 2026-10-05):
--   cancel_order decidía liberar stock con guards de "¿ya existe algún
--   movimiento 'release' para esta orden?" (y 'sale'). Tras un re-armo
--   de la orden pending en el checkout (release + nueva reserva, ruta
--   de reutilización de _shared/order-creation.ts), quedaba un 'release'
--   histórico y la cancelación posterior NO liberaba la reserva vigente,
--   dejando inventory.reserved clavado (fugas en productos 1013/1023/1037
--   con los pedidos PED-00020 y PED-00023).
--
--   La misma fuga ya fue corregida en release_reservation
--   (migración 20260926100000) con idempotencia NETA:
--     neto = Σ reservation − Σ (release + sale)  por orden e inventario
--   pero el fix no se replicó en cancel_order.
--
-- Cambios:
--   1) cancel_order conserva firma, retorno, validación de admin,
--      transiciones y UPDATE final a 'cancelled', pero la liberación
--      por ítem calcula el saldo neto y, si neto > 0, la delega en
--      release_reservation (misma idempotencia, validaciones y libro
--      de movimientos que usan el cron expire_stale_pending_orders y
--      los errores de checkout). Efecto sobre inventory: igual que
--      antes — SOLO reserved (quantity no se toca en la liberación;
--      quantity solo lo descuenta confirm_sale al confirmar venta).
--   2) update_payment_status: RAISE si el pedido asociado está
--      'cancelled' (antes se podía aprobar el pago de un pedido ya
--      cancelado: quedaba cancelled + approved).
--   3) cancel_order pasa a 'cancelled' los pagos 'pending' del pedido
--      (NUNCA toca 'approved' u otros) y deja orders.payment_status
--      coherente cuando estaba 'pending'. Compatible con los CHECK
--      existentes: payments_status_check y orders_payment_status_check
--      incluyen 'cancelled' (verificado en remoto).
--      IMPORTANTE: los pagos 'approved' quedan intactos (coherente con
--      el modelo: el dinero puede haber ingresado igual).
-- ============================================================

-- ------------------------------------------------------------
-- 1. cancel_order con idempotencia por saldo neto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_order record;
  v_previous_status text;
  v_stock_action text := 'not_applicable';
  v_item record;
  v_inventory_id integer;
  v_net integer;
BEGIN
  -- 1. Verificar usuario autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  -- 2. Verificar rol admin
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Obtener pedido con bloqueo FOR UPDATE
  SELECT id, numero_pedido, status, payment_status, updated_at
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  v_previous_status := v_order.status;

  -- 4. Idempotencia: si ya está cancelado, no-op
  IF v_previous_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'numero_pedido', v_order.numero_pedido,
      'previous_status', v_previous_status,
      'status', 'cancelled',
      'payment_status', v_order.payment_status,
      'stock_action', 'unchanged',
      'changed', false
    );
  END IF;

  -- 5. Validar estado cancelable
  IF v_previous_status NOT IN ('pending', 'paid', 'preparing') THEN
    RAISE EXCEPTION 'No se puede cancelar un pedido con estado: %', v_previous_status;
  END IF;

  -- 6. Procesar liberación de stock para cada item
  v_stock_action := 'unchanged';

  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.cantidad
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Buscar fila de inventario (misma validación que la versión anterior)
    SELECT id
    INTO v_inventory_id
    FROM public.inventory
    WHERE product_id = v_item.product_id
      AND (
        (v_item.variant_id IS NULL AND variant_id IS NULL)
        OR
        (variant_id = v_item.variant_id)
      );

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
        v_item.product_id, v_item.variant_id;
    END IF;

    -- Saldo neto de ESTA orden sobre ESTE inventario (idempotencia neta):
    --   neto = Σ reservation − Σ (release + sale)
    -- neto <= 0  -> ya liberado / venta confirmada / nada que liberar
    SELECT
      COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'reservation'), 0)
      - COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo IN ('release', 'sale')), 0)
    INTO v_net
    FROM public.inventory_movements m
    WHERE m.inventory_id = v_inventory_id
      AND m.referencia_tipo = 'order'
      AND m.referencia_id = p_order_id;

    IF COALESCE(v_net, 0) > 0 THEN
      -- Liberación delegada en release_reservation: recalcula el neto,
      -- valida que exista reserved suficiente, hace
      --   reserved = reserved - LEAST(p_cantidad, neto)
      -- (NO toca quantity, igual que la rama de liberación anterior)
      -- e inserta el movimiento 'release' con la misma trazabilidad
      -- que el cron expire_stale_pending_orders.
      PERFORM public.release_reservation(
        v_item.product_id,
        v_item.variant_id,
        v_item.cantidad,
        p_order_id
      );
      v_stock_action := 'released';
    END IF;
  END LOOP;

  -- 7. Cancelar pagos pendientes del pedido (NUNCA toca 'approved')
  UPDATE public.payments
  SET status = 'cancelled',
      updated_at = now()
  WHERE order_id = p_order_id
    AND status = 'pending';

  -- 8. Actualizar estado del pedido a cancelled
  --    (+ orders.payment_status coherente cuando estaba 'pending')
  UPDATE public.orders
  SET status = 'cancelled',
      payment_status = CASE
        WHEN payment_status = 'pending' THEN 'cancelled'
        ELSE payment_status
      END,
      updated_at = now()
  WHERE id = p_order_id;

  IF v_order.payment_status = 'pending' THEN
    v_order.payment_status := 'cancelled';
  END IF;

  -- 9. Retornar resultado
  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'numero_pedido', v_order.numero_pedido,
    'previous_status', v_previous_status,
    'status', 'cancelled',
    'payment_status', v_order.payment_status,
    'stock_action', v_stock_action,
    'cancellation_reason', p_reason,
    'changed', true
  );
END;
$function$;

-- ------------------------------------------------------------
-- 2. update_payment_status: guard de pedido cancelado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_payment_id integer,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_payment record;
  v_order record;
  v_previous_payment_status text;
  v_previous_order_status text;
  v_allowed boolean := false;
BEGIN
  -- 1. Verificar usuario autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  -- 2. Verificar rol admin
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Obtener payment con bloqueo FOR UPDATE
  SELECT id, order_id, status, provider, amount, currency
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado: %', p_payment_id;
  END IF;

  v_previous_payment_status := v_payment.status;

  -- 4. Obtener order asociado con bloqueo FOR UPDATE
  SELECT id, status, payment_status, numero_pedido
  INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido asociado no encontrado: %', v_payment.order_id;
  END IF;

  v_previous_order_status := v_order.status;

  -- 4b. Guard: no permitir modificar el pago de un pedido cancelado
  --     (evita aprobar un pago de un pedido ya cancelado, que dejaba
  --      orders en cancelled + approved sin coherencia)
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede modificar el pago de un pedido cancelado'
      USING ERRCODE = '42501';
  END IF;

  -- 5. Validar que el nuevo estado sea reconocido
  IF p_new_status NOT IN ('pending', 'approved', 'rejected', 'refunded', 'cancelled') THEN
    RAISE EXCEPTION 'Estado de pago no reconocido: %', p_new_status;
  END IF;

  -- 6. Comportamiento idempotente: mismo estado → no-op
  IF v_previous_payment_status = p_new_status THEN
    RETURN jsonb_build_object(
      'payment_id', v_payment.id,
      'order_id', v_order.id,
      'numero_pedido', v_order.numero_pedido,
      'previous_payment_status', v_previous_payment_status,
      'payment_status', p_new_status,
      'order_payment_status', v_order.payment_status,
      'previous_order_status', v_previous_order_status,
      'order_status', v_order.status,
      'changed', false
    );
  END IF;

  -- 7. Validar transiciones permitidas
  --    pending → approved
  IF v_previous_payment_status = 'pending' AND p_new_status = 'approved' THEN
    v_allowed := true;

  --    pending → rejected
  ELSIF v_previous_payment_status = 'pending' AND p_new_status = 'rejected' THEN
    v_allowed := true;

  --    pending → cancelled
  ELSIF v_previous_payment_status = 'pending' AND p_new_status = 'cancelled' THEN
    v_allowed := true;

  --    rejected → cancelled
  ELSIF v_previous_payment_status = 'rejected' AND p_new_status = 'cancelled' THEN
    v_allowed := true;

  --    approved → refunded
  ELSIF v_previous_payment_status = 'approved' AND p_new_status = 'refunded' THEN
    v_allowed := true;

  ELSE
    -- Transición no permitida
    RAISE EXCEPTION 'Transición de pago no permitida: % → %', v_previous_payment_status, p_new_status;
  END IF;

  -- 8. Actualizar payments.status
  UPDATE public.payments
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_payment_id;

  -- 9. Sincronizar orders.payment_status
  UPDATE public.orders
  SET payment_status = p_new_status,
      updated_at = now()
  WHERE id = v_payment.order_id;

  -- 10. Regla especial: pending → approved + order.status = pending → paid
  IF v_previous_payment_status = 'pending' AND p_new_status = 'approved' AND v_order.status = 'pending' THEN
    UPDATE public.orders
    SET status = 'paid',
        updated_at = now()
    WHERE id = v_payment.order_id;
    v_order.status := 'paid';
  END IF;

  -- 11. Retornar resultado
  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'numero_pedido', v_order.numero_pedido,
    'previous_payment_status', v_previous_payment_status,
    'payment_status', p_new_status,
    'order_payment_status', p_new_status,
    'previous_order_status', v_previous_order_status,
    'order_status', v_order.status,
    'changed', true
  );
END;
$function$;
