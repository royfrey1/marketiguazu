-- ============================================================================
-- S4.16: RPC segura update_payment_status()
-- Migración: 20260914160000
--
-- Permite a un administrador cambiar el estado de un pago manteniendo
-- la consistencia con orders.payment_status y orders.status.
--
-- Máquina de estados del pago:
--   pending → approved | rejected | cancelled
--   approved → refunded
--   rejected → cancelled
--   cancelled → (terminal)
--   refunded → (terminal)
--
-- Regla especial: pending → approved + order.status = pending
--   → avanzar order.status a paid en la misma transacción.
--
-- Usa FOR UPDATE para resistir concurrencia.
-- NO modifica stock, shipments ni cancela pedidos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Crear la función update_payment_status()
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. Configurar GRANTS
-- ---------------------------------------------------------------------------

-- Revocar de roles que no deben ejecutarla
REVOKE EXECUTE ON FUNCTION public.update_payment_status(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_payment_status(integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_payment_status(integer, text) FROM postgres;

-- Permitir a authenticated (la función valida is_admin internamente)
GRANT EXECUTE ON FUNCTION public.update_payment_status(integer, text) TO authenticated;
