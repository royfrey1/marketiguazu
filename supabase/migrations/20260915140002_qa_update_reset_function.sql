-- ============================================================================
-- S4.19.3 — Corrección: actualizar qa_reset_admin_order para QA-ADMIN-CANCEL
-- El estado inicial de QA-ADMIN-CANCEL debe ser 'paid' (no 'pending')
-- para coexistir con idx_orders_one_pending_per_user.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.qa_reset_admin_order(p_order_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_target_status text;
  v_target_payment_status text;
  v_target_payment_provider_status text;
  v_target_shipment_status text;
  v_item record;
  v_inv record;
  v_has_reservation boolean;
  v_has_sale boolean;
  v_has_release boolean;
  v_reservation_qty integer;
  v_sale_qty integer;
  v_new_reserved integer;
  v_initial_qty constant integer := 20;
  v_result jsonb;
BEGIN
  SELECT id, numero_pedido, status, payment_status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  CASE v_order.numero_pedido
    WHEN 'QA-ADMIN-PENDING' THEN
      v_target_status := 'pending';
      v_target_payment_status := 'pending';
      v_target_payment_provider_status := 'pending';
      v_target_shipment_status := NULL;
    WHEN 'QA-ADMIN-PAID' THEN
      v_target_status := 'paid';
      v_target_payment_status := 'approved';
      v_target_payment_provider_status := 'approved';
      v_target_shipment_status := 'pending';
    WHEN 'QA-ADMIN-PREPARING' THEN
      v_target_status := 'preparing';
      v_target_payment_status := 'approved';
      v_target_payment_provider_status := 'approved';
      v_target_shipment_status := 'processing';
    WHEN 'QA-ADMIN-SHIPPED' THEN
      v_target_status := 'shipped';
      v_target_payment_status := 'approved';
      v_target_payment_provider_status := 'approved';
      v_target_shipment_status := 'in_transit';
    WHEN 'QA-ADMIN-DELIVERED' THEN
      v_target_status := 'delivered';
      v_target_payment_status := 'approved';
      v_target_payment_provider_status := 'approved';
      v_target_shipment_status := 'delivered';
    WHEN 'QA-ADMIN-CANCEL' THEN
      -- Estado inicial: 'paid' (no 'pending') para coexistir con
      -- idx_orders_one_pending_per_user (QA-ADMIN-PENDING ya es pending)
      v_target_status := 'paid';
      v_target_payment_status := 'approved';
      v_target_payment_provider_status := 'approved';
      v_target_shipment_status := NULL;
    ELSE
      RAISE EXCEPTION 'Fixture QA no reconocido: %', v_order.numero_pedido;
  END CASE;

  UPDATE public.orders
  SET status = v_target_status,
      payment_status = v_target_payment_status,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET status = v_target_payment_provider_status,
      updated_at = now()
  WHERE order_id = p_order_id;

  IF v_target_shipment_status IS NULL THEN
    DELETE FROM public.shipments WHERE order_id = p_order_id;
  ELSE
    UPDATE public.shipments
    SET status = v_target_shipment_status,
        updated_at = now()
    WHERE order_id = p_order_id;
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.cantidad
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT id, quantity, reserved
    INTO v_inv
    FROM public.inventory
    WHERE product_id = v_item.product_id
      AND (
        (v_item.variant_id IS NULL AND variant_id IS NULL)
        OR
        (variant_id = v_item.variant_id)
      );

    IF v_inv IS NULL THEN
      RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
        v_item.product_id, v_item.variant_id;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'reservation'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_reservation;

    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'sale'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_sale;

    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'release'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_release;

    IF v_has_sale THEN
      UPDATE public.inventory
      SET quantity = v_initial_qty,
          reserved = 0,
          updated_at = now()
      WHERE id = v_inv.id;

      DELETE FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'sale'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id;

      DELETE FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'reservation'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id;

    ELSIF v_has_reservation AND NOT v_has_release THEN
      SELECT cantidad INTO v_reservation_qty
      FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'reservation'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
      LIMIT 1;

      v_new_reserved := GREATEST(0, v_inv.reserved - v_reservation_qty);

      UPDATE public.inventory
      SET reserved = v_new_reserved,
          updated_at = now()
      WHERE id = v_inv.id;

      DELETE FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'reservation'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id;

    ELSIF v_has_release THEN
      DELETE FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id;

      UPDATE public.inventory
      SET quantity = v_initial_qty,
          reserved = 0,
          updated_at = now()
      WHERE id = v_inv.id;
    END IF;
  END LOOP;

  SELECT jsonb_build_object(
    'order_id', v_order.id,
    'numero_pedido', v_order.numero_pedido,
    'previous_status', v_order.status,
    'restored_status', v_target_status,
    'restored_payment_status', v_target_payment_status,
    'restored_shipment_status', v_target_shipment_status,
    'success', true
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ============================================================================
-- FIN S4.19.3 — qa_reset_admin_order actualizado
-- ============================================================================
