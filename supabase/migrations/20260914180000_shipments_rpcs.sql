-- ============================================================================
-- S4.18: RPCs de gestión de shipments
-- Migración: 20260914180000
--
-- Funciones:
--   create_shipment()        → crea un shipment nuevo
--   update_shipment()        → modifica datos operativos del shipment
--   update_shipment_status() → cambia el status del shipment
--
-- Las shipments son independientes de orders.status.
-- No modifican orders, payments ni inventory.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. create_shipment()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_shipment(
  p_order_id integer,
  p_provider text,
  p_costo numeric,
  p_estimated_days integer DEFAULT NULL,
  p_provider_tracking_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_order record;
  v_shipment_id integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  IF p_provider IS NULL OR p_provider NOT IN (
    'via_cargo', 'correo_argentino', 'crucero_express', 'oca', 'otro'
  ) THEN
    RAISE EXCEPTION 'Proveedor invalido: %', p_provider;
  END IF;

  IF p_costo IS NULL OR p_costo < 0 THEN
    RAISE EXCEPTION 'El costo debe ser mayor o igual a 0';
  END IF;

  IF p_estimated_days IS NOT NULL AND p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Los dias estimados deben ser mayores a 0 o NULL';
  END IF;

  SELECT id, numero_pedido, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  IF v_order.status NOT IN ('paid', 'preparing') THEN
    RAISE EXCEPTION 'No se puede crear envio para un pedido con estado: %', v_order.status;
  END IF;

  INSERT INTO public.shipments (
    order_id, provider, costo, estimated_days, provider_tracking_id
  ) VALUES (
    p_order_id, p_provider, p_costo, p_estimated_days, p_provider_tracking_id
  ) RETURNING id INTO v_shipment_id;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'order_id', p_order_id,
    'numero_pedido', v_order.numero_pedido,
    'provider', p_provider,
    'costo', p_costo,
    'estimated_days', p_estimated_days,
    'provider_tracking_id', p_provider_tracking_id,
    'status', 'pending'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. update_shipment()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_shipment(
  p_shipment_id integer,
  p_provider text DEFAULT NULL,
  p_costo numeric DEFAULT NULL,
  p_estimated_days integer DEFAULT NULL,
  p_provider_tracking_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_shipment record;
  v_updated_fields text[] := ARRAY[]::text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, order_id, provider, costo, estimated_days, provider_tracking_id, status
  INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment no encontrado: %', p_shipment_id;
  END IF;

  IF p_provider IS NOT NULL THEN
    IF p_provider NOT IN ('via_cargo', 'correo_argentino', 'crucero_express', 'oca', 'otro') THEN
      RAISE EXCEPTION 'Proveedor invalido: %', p_provider;
    END IF;
  END IF;

  IF p_costo IS NOT NULL AND p_costo < 0 THEN
    RAISE EXCEPTION 'El costo debe ser mayor o igual a 0';
  END IF;

  IF p_estimated_days IS NOT NULL AND p_estimated_days <= 0 THEN
    RAISE EXCEPTION 'Los dias estimados deben ser mayores a 0 o NULL';
  END IF;

  IF p_provider IS NOT NULL AND p_provider IS DISTINCT FROM v_shipment.provider THEN
    UPDATE public.shipments SET provider = p_provider WHERE id = p_shipment_id;
    v_updated_fields := array_append(v_updated_fields, 'provider');
  END IF;

  IF p_costo IS NOT NULL AND p_costo IS DISTINCT FROM v_shipment.costo THEN
    UPDATE public.shipments SET costo = p_costo WHERE id = p_shipment_id;
    v_updated_fields := array_append(v_updated_fields, 'costo');
  END IF;

  IF p_estimated_days IS NOT NULL AND p_estimated_days IS DISTINCT FROM v_shipment.estimated_days THEN
    UPDATE public.shipments SET estimated_days = p_estimated_days WHERE id = p_shipment_id;
    v_updated_fields := array_append(v_updated_fields, 'estimated_days');
  END IF;

  IF p_provider_tracking_id IS NOT NULL AND p_provider_tracking_id IS DISTINCT FROM v_shipment.provider_tracking_id THEN
    UPDATE public.shipments SET provider_tracking_id = p_provider_tracking_id WHERE id = p_shipment_id;
    v_updated_fields := array_append(v_updated_fields, 'provider_tracking_id');
  END IF;

  IF array_length(v_updated_fields, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'shipment_id', v_shipment.id,
      'order_id', v_shipment.order_id,
      'changed', false
    );
  END IF;

  UPDATE public.shipments SET updated_at = now() WHERE id = p_shipment_id;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment.id,
    'order_id', v_shipment.order_id,
    'updated_fields', to_jsonb(v_updated_fields),
    'changed', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. update_shipment_status()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_shipment_status(
  p_shipment_id integer,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_shipment record;
  v_previous_status text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, order_id, status
  INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment no encontrado: %', p_shipment_id;
  END IF;

  v_previous_status := v_shipment.status;

  IF v_previous_status = p_new_status THEN
    RETURN jsonb_build_object(
      'shipment_id', v_shipment.id,
      'order_id', v_shipment.order_id,
      'previous_status', v_previous_status,
      'status', p_new_status,
      'changed', false
    );
  END IF;

  IF NOT (
    (v_previous_status = 'pending' AND p_new_status = 'processing')
    OR
    (v_previous_status = 'processing' AND p_new_status = 'shipped')
    OR
    (v_previous_status = 'shipped' AND p_new_status = 'in_transit')
    OR
    (v_previous_status = 'in_transit' AND p_new_status = 'delivered')
    OR
    (v_previous_status = 'processing' AND p_new_status = 'failed')
    OR
    (v_previous_status = 'shipped' AND p_new_status = 'failed')
    OR
    (v_previous_status = 'in_transit' AND p_new_status = 'failed')
  ) THEN
    RAISE EXCEPTION 'Transicion invalida: % -> %', v_previous_status, p_new_status;
  END IF;

  UPDATE public.shipments
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment.id,
    'order_id', v_shipment.order_id,
    'previous_status', v_previous_status,
    'status', p_new_status,
    'changed', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Configurar GRANTS
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.create_shipment(integer, text, numeric, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_shipment(integer, text, numeric, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_shipment(integer, text, numeric, integer, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.create_shipment(integer, text, numeric, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_shipment(integer, text, numeric, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_shipment(integer, text, numeric, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_shipment(integer, text, numeric, integer, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.update_shipment(integer, text, numeric, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_shipment_status(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_shipment_status(integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_shipment_status(integer, text) FROM postgres;
GRANT EXECUTE ON FUNCTION public.update_shipment_status(integer, text) TO authenticated;
