-- ============================================================================
-- S4.17: RPC segura cancel_order()
-- Migración: 20260914170000
--
-- Cancela comercialmente un pedido y libera stock/reservas cuando corresponda.
--
-- Estados cancelables: pending, paid, preparing
-- Estados bloqueados: shipped, delivered, cancelled (idempotente)
--
-- Estrategia de stock:
--   - Si existe reserva (tipo='reservation') sin venta confirmada → liberar
--   - Si ya fue confirmada (tipo='sale') → no modificar stock
--   - Si no hay reserva → no modificar stock
--
-- NO simula reembolso de pago.
-- NO modifica shipments.
-- Usa FOR UPDATE para resistir concurrencia.
-- ============================================================================

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
  v_inv record;
  v_reserved integer;
  v_has_sale boolean;
  v_has_release boolean;
  v_release_qty integer;
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
    -- Buscar fila de inventario
    SELECT id, reserved
    INTO v_inv
    FROM public.inventory
    WHERE product_id = v_item.product_id
      AND (
        (v_item.variant_id IS NULL AND variant_id IS NULL)
        OR
        (variant_id = v_item.variant_id)
      )
    FOR UPDATE;

    IF v_inv IS NULL THEN
      RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
        v_item.product_id, v_item.variant_id;
    END IF;

    -- Verificar si existe reserva para este pedido
    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'reservation'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_sale;

    IF v_has_sale THEN
      -- Verificar si ya fue confirmada como venta
      SELECT EXISTS(
        SELECT 1 FROM public.inventory_movements
        WHERE inventory_id = v_inv.id
          AND tipo = 'sale'
          AND referencia_tipo = 'order'
          AND referencia_id = p_order_id
      ) INTO v_has_sale;

      IF v_has_sale THEN
        -- Venta ya confirmada: no modificar stock
        v_stock_action := 'unchanged';
      ELSE
        -- Verificar si ya fue liberada
        SELECT EXISTS(
          SELECT 1 FROM public.inventory_movements
          WHERE inventory_id = v_inv.id
            AND tipo = 'release'
            AND referencia_tipo = 'order'
            AND referencia_id = p_order_id
        ) INTO v_has_release;

        IF v_has_release THEN
          -- Ya fue liberada: no modificar stock
          v_stock_action := 'unchanged';
        ELSE
          -- Liberar reserva: usar cantidad de la reserva original
          SELECT cantidad INTO v_reserved
          FROM public.inventory_movements
          WHERE inventory_id = v_inv.id
            AND tipo = 'reservation'
            AND referencia_tipo = 'order'
            AND referencia_id = p_order_id
          LIMIT 1;

          -- Usar el menor entre reserva original y cantidad actual del item
          v_release_qty := LEAST(v_reserved, v_item.cantidad);

          -- Liberar reserved
          UPDATE public.inventory
          SET reserved = reserved - v_release_qty,
              updated_at = now()
          WHERE id = v_inv.id;

          -- Registrar movimiento de liberación
          INSERT INTO public.inventory_movements (
            inventory_id, tipo, direccion, cantidad,
            referencia_tipo, referencia_id, notas
          ) VALUES (
            v_inv.id, 'release', 'increase', v_release_qty,
            'order', p_order_id,
            'Liberación por cancelación de pedido'
          );

          v_stock_action := 'released';
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 7. Actualizar estado del pedido a cancelled
  UPDATE public.orders
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_order_id;

  -- 8. Retornar resultado
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

-- ---------------------------------------------------------------------------
-- Configurar GRANTS
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.cancel_order(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_order(integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_order(integer, text) FROM postgres;

GRANT EXECUTE ON FUNCTION public.cancel_order(integer, text) TO authenticated;
