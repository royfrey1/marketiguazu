-- ============================================================
-- confirm_sale al aprobar pagos NO-MP (manual / USDT)
-- ============================================================
-- Problema:
--   confirm_sale solo se ejecutaba desde apply_mp_payment_status
--   (webhook Mercado Pago). En el flujo USDT u otros pagos manuales,
--   el admin aprueba con update_payment_status ("Confirmar pago
--   recibido") y el stock quedaba para siempre en reserva: reserved
--   nunca bajaba y quantity nunca se descontaba (quantity solo baja
--   en confirm_sale, según el modelo vigente).
--
-- Cambio (sin tocar nada más de update_payment_status: misma firma,
-- validaciones, guard de pedido cancelado de la migración
-- 20261005192549, matriz de transiciones y retorno):
--   Cuando la transición es pending → approved y el provider del
--   pago NO es 'mercadopago' (valor exacto usado por create-payment
--   y admin-verify-payment), por cada order_item se llama a
--   confirm_sale(product_id, variant_id, cantidad, order_id) con el
--   mismo patrón que apply_mp_payment_status (filtra product_id NOT
--   NULL y cantidad > 0, maneja variant NULL). confirm_sale ya es
--   idempotente por movimiento 'sale' por orden: repetir la
--   aprobación no descuenta dos veces.
--
-- Caso borde (decisión documentada):
--   Si el pedido no tiene reserva vigente (cron, re-armo fallido,
--   reserva de menos), confirm_sale lanza "Reserva insuficiente" /
--   "Inventario no encontrado". En este flujo MANUAL la aprobación
--   FALLA con mensaje claro "No hay reserva de stock vigente para
--   este pedido" y NO se aprueba nada: el RAISE ocurre en la misma
--   transacción (todo o nada), en vez de aprobar sin descontar stock.
--   Esto difiere de apply_mp_payment_status a propósito: allí nunca
--   se aborta la acreditación de MP (los errores de stock quedan
--   registrados en v_stock_errors para acción manual); acá no hay
--   acreditación automática que proteger y el admin puede reintentar
--   tras resolver el stock.
--   pagos 'mercadopago' aprobados manualmente quedan FUERA de este
--   cambio (su flujo es apply_mp_payment_status / webhook).
--   NO aplica tampoco: pagos ya approved (idempotencia paso 6 → no-op)
--   ni aprobaciones posteriores a la cancelación (guard 4b).
--
-- GRANTS: CREATE OR REPLACE conserva los grants existentes de
-- update_payment_status (solo authenticated, con is_admin interno).
-- ============================================================

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
  v_item record;
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

  -- 7b. Stock al aprobar pagos NO-MP: convertir reserva en venta.
  --     Se ejecuta ANTES de tocar payments/orders: si falta reserva,
  --     el RAISE aborta la transacción completa y no se aprueba nada.
  IF v_previous_payment_status = 'pending'
     AND p_new_status = 'approved'
     AND v_payment.provider IS DISTINCT FROM 'mercadopago' THEN
    FOR v_item IN
      SELECT product_id, variant_id, cantidad
      FROM public.order_items
      WHERE order_id = v_order.id
        AND product_id IS NOT NULL
        AND cantidad > 0
    LOOP
      BEGIN
        PERFORM public.confirm_sale(
          v_item.product_id, v_item.variant_id,
          v_item.cantidad, v_order.id
        );
      EXCEPTION WHEN OTHERS THEN
        -- Sin reserva vigente: no aprobar sin descontar stock.
        RAISE EXCEPTION 'No hay reserva de stock vigente para este pedido (producto %): %',
          v_item.product_id, SQLERRM;
      END;
    END LOOP;
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
