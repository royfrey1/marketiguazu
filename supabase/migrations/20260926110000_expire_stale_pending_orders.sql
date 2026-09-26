-- ============================================================
-- Fase 3 — Migración B: expiración de órdenes pending
-- Migración: 20260926110000
--
-- Las preferencias de Mercado Pago expiran a las 24 hs pero MP NO
-- emite ninguna notificación de expiración, así que nada libera las
-- reservas de órdenes pending que nunca se pagan. Esta migración:
--   1. Habilita la extensión pg_cron.
--   2. Crea expire_stale_pending_orders(): por cada orden pending
--      con más de 25 hs (24 hs + 1 h de margen) y sin pago aprobado:
--      libera reservas, marca sus pagos pending → cancelled y la
--      orden → cancelled (libera el índice "un pending por usuario").
--   3. Agenda el job 'expire-pending-orders' cada hora (minuto 10).
--
-- Si CREATE EXTENSION es rechazado por permisos en el push, habilitar
-- pg_cron desde el dashboard (Database → Extensions) y re-ejecutar el
-- schedule por separado.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Extensión pg_cron (scheduler de trabajos programados)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------------
-- 2. expire_stale_pending_orders()
--
-- SEGURIDAD: SECURITY DEFINER ejecuta como owner (postgres); se revoca
-- EXECUTE de PUBLIC/anon/authenticated — solo la invoca el job de cron
-- (corre como el rol que agendó, postgres).
--
-- SKIP LOCKED: si el webhook está procesando un pago de esa orden en
-- este instante, el cron la salta y la evalúa en la próxima corrida.
-- Un pago que llegue DESPUÉS de cancelar queda como
-- order_cancelled_late_payment en el webhook (acción manual).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_pending_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order        record;
  v_item         record;
  v_expired      integer := 0;
  v_expired_ids  jsonb   := '[]'::jsonb;
  v_stock_errors text[]  := ARRAY[]::text[];
BEGIN
  FOR v_order IN
    SELECT id, numero_pedido
    FROM public.orders
    WHERE status = 'pending'
      AND created_at < now() - interval '25 hours'
      AND payment_status NOT IN ('approved', 'refunded')
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.order_id = orders.id
          AND p.status = 'approved'
      )
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 1. liberar reservas activas (release_reservation con idempotencia neta)
    FOR v_item IN
      SELECT product_id, variant_id, cantidad
      FROM public.order_items
      WHERE order_id = v_order.id
        AND product_id IS NOT NULL
        AND cantidad > 0
    LOOP
      BEGIN
        PERFORM public.release_reservation(
          v_item.product_id, v_item.variant_id, v_item.cantidad, v_order.id
        );
      EXCEPTION WHEN OTHERS THEN
        v_stock_errors := v_stock_errors || ('order ' || v_order.numero_pedido || ': ' || SQLERRM);
      END;
    END LOOP;

    -- 2. pagos pendientes de la orden → cancelled
    UPDATE public.payments
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = v_order.id
      AND status = 'pending';

    -- 3. orden → cancelled (payment_status incluido)
    UPDATE public.orders
    SET status = 'cancelled',
        payment_status = 'cancelled',
        updated_at = now()
    WHERE id = v_order.id;

    v_expired := v_expired + 1;
    v_expired_ids := v_expired_ids || to_jsonb(v_order.id);
  END LOOP;

  RETURN jsonb_build_object(
    'expired', v_expired,
    'order_ids', v_expired_ids,
    'stock_errors', to_jsonb(v_stock_errors));
END;
$function$;

-- Grants: solo el owner (postgres / job de cron); sin acceso desde la API
REVOKE ALL ON FUNCTION public.expire_stale_pending_orders() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Schedule: cada hora, en el minuto 10
--    cron.unschedule('…') lanza un error (XX000) si el job no existe,
--    así que se envuelve en DO/EXCEPTION → re-ejecutable igualmente
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  PERFORM cron.unschedule('expire-pending-orders');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job todavía no existe en una primera corrida
END $$;

SELECT cron.schedule(
  'expire-pending-orders',
  '10 * * * *',
  $$SELECT public.expire_stale_pending_orders()$$
);
