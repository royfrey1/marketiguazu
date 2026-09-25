-- ============================================================================
-- S4.10: RPC segura update_order_status()
-- Migración: 20260914150000
-- 
-- Permite a un administrador cambiar el estado de un pedido respetando
-- una máquina de estados explícita. Transiciones válidas:
--   pending → paid → preparing → shipped → delivered
--
-- Requiere payment_status = 'approved' para pending → paid y paid → preparing.
-- NO modifica payment_status, shipments, inventory ni order_items.
-- Usa FOR UPDATE para resistir concurrencia.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Crear la función update_order_status()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id integer,
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
  v_order record;
  v_previous_status text;
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

  -- 3. Obtener pedido con bloqueo FOR UPDATE (concurrencia)
  SELECT id, status, payment_status, updated_at
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  v_previous_status := v_order.status;

  -- 4. Validar que el nuevo estado sea reconocido
  IF p_new_status NOT IN ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Estado no reconocido: %', p_new_status;
  END IF;

  -- 5. Comportamiento idempotente: mismo estado → no-op
  IF v_previous_status = p_new_status THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'previous_status', v_previous_status,
      'new_status', p_new_status,
      'updated_at', v_order.updated_at,
      'changed', false
    );
  END IF;

  -- 6. Validar transiciones permitidas
  --    pending → paid
  IF v_previous_status = 'pending' AND p_new_status = 'paid' THEN
    IF v_order.payment_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'No se puede marcar el pedido como pagado porque el pago no está aprobado (payment_status: %)', v_order.payment_status;
    END IF;
    v_allowed := true;

  --    paid → preparing
  ELSIF v_previous_status = 'paid' AND p_new_status = 'preparing' THEN
    IF v_order.payment_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'No se puede preparar el pedido porque el pago no está aprobado (payment_status: %)', v_order.payment_status;
    END IF;
    v_allowed := true;

  --    preparing → shipped
  ELSIF v_previous_status = 'preparing' AND p_new_status = 'shipped' THEN
    v_allowed := true;

  --    shipped → delivered
  ELSIF v_previous_status = 'shipped' AND p_new_status = 'delivered' THEN
    v_allowed := true;

  ELSE
    -- Transición no permitida
    RAISE EXCEPTION 'Transición de estado no permitida: % → %', v_previous_status, p_new_status;
  END IF;

  -- 7. Actualizar estado
  UPDATE public.orders
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_order_id;

  -- 8. Retornar resultado
  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'previous_status', v_previous_status,
    'new_status', p_new_status,
    'updated_at', now(),
    'changed', true
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Configurar GRANTS
-- ---------------------------------------------------------------------------

-- Revocar de roles que no deben ejecutarla
REVOKE EXECUTE ON FUNCTION public.update_order_status(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_order_status(integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_status(integer, text) FROM postgres;

-- Permitir a authenticated (la función valida is_admin internamente)
GRANT EXECUTE ON FUNCTION public.update_order_status(integer, text) TO authenticated;
