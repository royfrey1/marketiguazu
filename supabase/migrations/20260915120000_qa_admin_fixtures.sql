-- ============================================================================
-- S4.19.2 — Infraestructura QA reutilizable para gestión administrativa
-- Migración separada de negocio. Identificada como QA.
-- NO modificar RPCs de negocio.
--
-- NOTA: Los usuarios QA (auth.users) deben crearse desde el Dashboard:
--   Admin:  qa.admin.control@example.test  / role=admin
--   Customer: qa.customer.control@example.test / role=customer
-- Los profiles se crean automáticamente por el trigger on auth.users.
-- Los pedidos QA se asocian al admin existente (f89dc444...) por compatibilidad.
-- ============================================================================

-- ============================================================================
-- 0. DROP TEMPORAL de constraint de un solo pending por usuario
-- ============================================================================

DROP INDEX IF EXISTS public.idx_orders_one_pending_per_user;

-- ============================================================================
-- 1. PRODUCTOS QA (2 productos claramente identificados, activo=false)
-- ============================================================================

INSERT INTO products (titulo, slug, descripcion, marca, category_id, precio, imagen_url, activo, destacado)
VALUES
  (
    'QA-ADMIN Producto Test 1',
    'qa-admin-producto-test-1',
    'Producto de prueba para infraestructura QA administrativa. No vender.',
    'QA-Testing',
    1,
    1000.00,
    '/placeholder-qa.png',
    false,
    false
  ),
  (
    'QA-ADMIN Producto Test 2',
    'qa-admin-producto-test-2',
    'Producto de prueba para infraestructura QA administrativa. No vender.',
    'QA-Testing',
    1,
    2500.00,
    '/placeholder-qa.png',
    false,
    false
  )
ON CONFLICT (slug) DO NOTHING;

-- Asignar IDs específicos para los productos QA (setear secuencia)
SELECT setval(
  (SELECT pg_get_serial_sequence('products', 'id')),
  GREATEST((SELECT MAX(id) FROM products), 1002)
);

-- Obtener los IDs reales de los productos QA
DO $$
DECLARE
  v_prod1_id integer;
  v_prod2_id integer;
BEGIN
  SELECT id INTO v_prod1_id FROM products WHERE slug = 'qa-admin-producto-test-1';
  SELECT id INTO v_prod2_id FROM products WHERE slug = 'qa-admin-producto-test-2';

  -- Verificar que existan
  IF v_prod1_id IS NULL OR v_prod2_id IS NULL THEN
    RAISE EXCEPTION 'Productos QA no encontrados: prod1=%, prod2=%', v_prod1_id, v_prod2_id;
  END IF;

  -- Guardar en una tabla temporal para usar después
  CREATE TEMPORARY TABLE IF NOT EXISTS qa_product_ids (
    prod1_id integer,
    prod2_id integer
  ) ON COMMIT DROP;
  INSERT INTO qa_product_ids VALUES (v_prod1_id, v_prod2_id);
END $$;

-- ============================================================================
-- 2. INVENTARIO QA (quantity=20, reserved=0 para ambos)
-- ============================================================================

INSERT INTO inventory (product_id, variant_id, quantity, reserved, low_stock_threshold)
SELECT prod1_id, NULL, 20, 0, 5 FROM qa_product_ids
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE product_id = (SELECT prod1_id FROM qa_product_ids) AND variant_id IS NULL);

INSERT INTO inventory (product_id, variant_id, quantity, reserved, low_stock_threshold)
SELECT prod2_id, NULL, 20, 0, 5 FROM qa_product_ids
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE product_id = (SELECT prod2_id FROM qa_product_ids) AND variant_id IS NULL);

-- ============================================================================
-- 3. PEDIDOS QA (6 pedidos en estados controlados)
-- ============================================================================

DO $$
DECLARE
  v_prod1_id integer;
  v_prod2_id integer;
  v_inv_prod1 integer;
  v_inv_prod2 integer;
BEGIN
  SELECT prod1_id, prod2_id INTO v_prod1_id, v_prod2_id FROM qa_product_ids;

  SELECT id INTO v_inv_prod1 FROM inventory WHERE product_id = v_prod1_id AND variant_id IS NULL;
  SELECT id INTO v_inv_prod2 FROM inventory WHERE product_id = v_prod2_id AND variant_id IS NULL;

  -- 3.1 QA-ADMIN-PENDING: pending / pending / sin shipment
  INSERT INTO orders (user_id, numero_pedido, status, payment_status, subtotal, envio_costo, total, direccion_envio, notas)
  VALUES (
    'f89dc444-754f-4315-b062-d3b5d039a9ed'::uuid,
    'QA-ADMIN-PENDING',
    'pending',
    'pending',
    1000.00,
    0,
    1000.00,
    '{"calle":"QA Testing 123","ciudad":"Buenos Aires","provincia":"Buenos Aires","codigo_postal":"C1000","pais":"Argentina"}'::jsonb,
    'Fixture QA — pedido pendiente para pruebas de estado/pago/cancelación'
  )
  ON CONFLICT (numero_pedido) DO NOTHING;

  -- 3.2 QA-ADMIN-PAID: paid / approved / pending shipment
  INSERT INTO orders (user_id, numero_pedido, status, payment_status, subtotal, envio_costo, total, direccion_envio, notas)
  VALUES (
    'f89dc444-754f-4315-b062-d3b5d039a9ed'::uuid,
    'QA-ADMIN-PAID',
    'paid',
    'approved',
    2500.00,
    500.00,
    3000.00,
    '{"calle":"QA Testing 456","ciudad":"Córdoba","provincia":"Córdoba","codigo_postal":"X5000","pais":"Argentina"}'::jsonb,
    'Fixture QA — pedido pagado para pruebas de estado/shipment'
  )
  ON CONFLICT (numero_pedido) DO NOTHING;

  -- 3.3 QA-ADMIN-PREPARING: preparing / approved / processing shipment
  INSERT INTO orders (user_id, numero_pedido, status, payment_status, subtotal, envio_costo, total, direccion_envio, notas)
  VALUES (
    'f89dc444-754f-4315-b062-d3b5d039a9ed'::uuid,
    'QA-ADMIN-PREPARING',
    'preparing',
    'approved',
    1000.00,
    300.00,
    1300.00,
    '{"calle":"QA Testing 789","ciudad":"Rosario","provincia":"Santa Fe","codigo_postal":"S2000","pais":"Argentina"}'::jsonb,
    'Fixture QA — pedido en preparación para pruebas de shipment'
  )
  ON CONFLICT (numero_pedido) DO NOTHING;

  -- 3.4 QA-ADMIN-SHIPPED: shipped / approved / in_transit shipment
  INSERT INTO orders (user_id, numero_pedido, status, payment_status, subtotal, envio_costo, total, direccion_envio, notas)
  VALUES (
    'f89dc444-754f-4315-b062-d3b5d039a9ed'::uuid,
    'QA-ADMIN-SHIPPED',
    'shipped',
    'approved',
    5000.00,
    800.00,
    5800.00,
    '{"calle":"QA Testing 321","ciudad":"Mendoza","provincia":"Mendoza","codigo_postal":"M5000","pais":"Argentina"}'::jsonb,
    'Fixture QA — pedido enviado para pruebas de shipment/independencia estados'
  )
  ON CONFLICT (numero_pedido) DO NOTHING;

  -- 3.5 QA-ADMIN-DELIVERED: delivered / approved / delivered shipment
  INSERT INTO orders (user_id, numero_pedido, status, payment_status, subtotal, envio_costo, total, direccion_envio, notas)
  VALUES (
    'f89dc444-754f-4315-b062-d3b5d039a9ed'::uuid,
    'QA-ADMIN-DELIVERED',
    'delivered',
    'approved',
    1000.00,
    0,
    1000.00,
    '{"calle":"QA Testing 654","ciudad":"La Plata","provincia":"Buenos Aires","codigo_postal":"B1900","pais":"Argentina"}'::jsonb,
    'Fixture QA — pedido entregado para pruebas de estados terminales/idempotencia'
  )
  ON CONFLICT (numero_pedido) DO NOTHING;

  -- 3.6 QA-ADMIN-CANCEL: pending / pending / sin shipment
  INSERT INTO orders (user_id, numero_pedido, status, payment_status, subtotal, envio_costo, total, direccion_envio, notas)
  VALUES (
    'f89dc444-754f-4315-b062-d3b5d039a9ed'::uuid,
    'QA-ADMIN-CANCEL',
    'pending',
    'pending',
    2500.00,
    0,
    2500.00,
    '{"calle":"QA Testing 987","ciudad":"Tucumán","provincia":"Tucumán","codigo_postal":"T4000","pais":"Argentina"}'::jsonb,
    'Fixture QA — pedido para pruebas de cancelación y stock/reserva'
  )
  ON CONFLICT (numero_pedido) DO NOTHING;

  -- 4. ORDER ITEMS
  INSERT INTO order_items (order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal)
  SELECT o.id, v_prod1_id, NULL, 'QA-ADMIN Producto Test 1', NULL, 'QA-SKU-001', 1000.00, 1, 1000.00
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PENDING'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO order_items (order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal)
  SELECT o.id, v_prod2_id, NULL, 'QA-ADMIN Producto Test 2', NULL, 'QA-SKU-002', 2500.00, 1, 2500.00
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PAID'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO order_items (order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal)
  SELECT o.id, v_prod1_id, NULL, 'QA-ADMIN Producto Test 1', NULL, 'QA-SKU-001', 1000.00, 1, 1000.00
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO order_items (order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal)
  SELECT o.id, v_prod2_id, NULL, 'QA-ADMIN Producto Test 2', NULL, 'QA-SKU-002', 2500.00, 2, 5000.00
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO order_items (order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal)
  SELECT o.id, v_prod1_id, NULL, 'QA-ADMIN Producto Test 1', NULL, 'QA-SKU-001', 1000.00, 1, 1000.00
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO order_items (order_id, product_id, variant_id, nombre_producto, variante_nombre, sku, precio_unitario, cantidad, subtotal)
  SELECT o.id, v_prod2_id, NULL, 'QA-ADMIN Producto Test 2', NULL, 'QA-SKU-002', 2500.00, 1, 2500.00
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-CANCEL'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ON CONFLICT DO NOTHING;

  -- 5. RESERVA DE STOCK
  -- QA-ADMIN-PENDING: reservar 1 unidad de prod1
  UPDATE inventory SET reserved = reserved + 1, updated_at = now()
  WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PENDING: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PENDING'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  -- QA-ADMIN-PAID: reservar 1 unidad de prod2
  UPDATE inventory SET reserved = reserved + 1, updated_at = now()
  WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PAID: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PAID'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  -- QA-ADMIN-CANCEL: reservar 1 unidad de prod2
  UPDATE inventory SET reserved = reserved + 1, updated_at = now()
  WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-CANCEL: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-CANCEL'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  -- QA-ADMIN-PREPARING: reservar + confirmar venta de 1 unidad de prod1
  UPDATE inventory SET reserved = reserved + 1, updated_at = now()
  WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PREPARING: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  UPDATE inventory SET quantity = quantity - 1, reserved = reserved - 1, updated_at = now()
  WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'sale', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PREPARING: venta confirmada'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'sale');

  -- QA-ADMIN-SHIPPED: reservar + confirmar venta de 2 unidades de prod2
  UPDATE inventory SET reserved = reserved + 2, updated_at = now()
  WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'reservation', 'decrease', 2, 'order', o.id, 'QA-ADMIN-SHIPPED: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  UPDATE inventory SET quantity = quantity - 2, reserved = reserved - 2, updated_at = now()
  WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'sale', 'decrease', 2, 'order', o.id, 'QA-ADMIN-SHIPPED: venta confirmada'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'sale');

  -- QA-ADMIN-DELIVERED: reservar + confirmar venta de 1 unidad de prod1
  UPDATE inventory SET reserved = reserved + 1, updated_at = now()
  WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-DELIVERED: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  UPDATE inventory SET quantity = quantity - 1, reserved = reserved - 1, updated_at = now()
  WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'sale', 'decrease', 1, 'order', o.id, 'QA-ADMIN-DELIVERED: venta confirmada'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'sale');

  -- 6. PAGOS QA
  INSERT INTO payments (order_id, provider, status, amount, currency, metadata)
  SELECT o.id, 'mercadopago', 'pending', 1000.00, 'ARS', '{"qa":true,"fixture":"QA-ADMIN-PENDING"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PENDING'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = o.id);

  INSERT INTO payments (order_id, provider, status, amount, currency, metadata)
  SELECT o.id, 'mercadopago', 'approved', 3000.00, 'ARS', '{"qa":true,"fixture":"QA-ADMIN-PAID"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PAID'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = o.id);

  INSERT INTO payments (order_id, provider, status, amount, currency, metadata)
  SELECT o.id, 'mercadopago', 'approved', 1300.00, 'ARS', '{"qa":true,"fixture":"QA-ADMIN-PREPARING"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = o.id);

  INSERT INTO payments (order_id, provider, status, amount, currency, metadata)
  SELECT o.id, 'mercadopago', 'approved', 5800.00, 'ARS', '{"qa":true,"fixture":"QA-ADMIN-SHIPPED"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = o.id);

  INSERT INTO payments (order_id, provider, status, amount, currency, metadata)
  SELECT o.id, 'mercadopago', 'approved', 1000.00, 'ARS', '{"qa":true,"fixture":"QA-ADMIN-DELIVERED"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = o.id);

  INSERT INTO payments (order_id, provider, status, amount, currency, metadata)
  SELECT o.id, 'mercadopago', 'pending', 2500.00, 'ARS', '{"qa":true,"fixture":"QA-ADMIN-CANCEL"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-CANCEL'
  AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = o.id);

  -- 7. SHIPMENTS QA
  INSERT INTO shipments (order_id, provider, status, costo, estimated_days, provider_tracking_id, metadata)
  SELECT o.id, 'correo_argentino', 'pending', 500.00, 5, 'QA-ADMIN-TRACK-002', '{"qa":true,"fixture":"QA-ADMIN-PAID"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PAID'
  AND NOT EXISTS (SELECT 1 FROM shipments WHERE order_id = o.id);

  INSERT INTO shipments (order_id, provider, status, costo, estimated_days, provider_tracking_id, metadata)
  SELECT o.id, 'via_cargo', 'processing', 300.00, 3, 'QA-ADMIN-TRACK-003', '{"qa":true,"fixture":"QA-ADMIN-PREPARING"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM shipments WHERE order_id = o.id);

  INSERT INTO shipments (order_id, provider, status, costo, estimated_days, provider_tracking_id, metadata)
  SELECT o.id, 'crucero_express', 'in_transit', 800.00, 7, 'QA-ADMIN-TRACK-004', '{"qa":true,"fixture":"QA-ADMIN-SHIPPED"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM shipments WHERE order_id = o.id);

  INSERT INTO shipments (order_id, provider, status, costo, estimated_days, provider_tracking_id, metadata)
  SELECT o.id, 'oca', 'delivered', 0, NULL, 'QA-ADMIN-TRACK-005', '{"qa":true,"fixture":"QA-ADMIN-DELIVERED"}'::jsonb
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM shipments WHERE order_id = o.id);

END $$;

-- ============================================================================
-- 8. FUNCIÓN DE RESET QA: qa_reset_admin_order(p_order_id integer)
--    Restaura un fixture QA a su estado inicial conocido.
--    SEGURA: solo modificable por superuser, no expuesta al frontend.
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
  -- 1. Obtener el pedido
  SELECT id, numero_pedido, status, payment_status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  -- 2. Determinar estados iniciales según el fixture
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
      v_target_status := 'pending';
      v_target_payment_status := 'pending';
      v_target_payment_provider_status := 'pending';
      v_target_shipment_status := NULL;
    ELSE
      RAISE EXCEPTION 'Fixture QA no reconocido: %', v_order.numero_pedido;
  END CASE;

  -- 3. Restaurar estado del pedido
  UPDATE public.orders
  SET status = v_target_status,
      payment_status = v_target_payment_status,
      updated_at = now()
  WHERE id = p_order_id;

  -- 4. Restaurar pagos
  UPDATE public.payments
  SET status = v_target_payment_provider_status,
      updated_at = now()
  WHERE order_id = p_order_id;

  -- 5. Restaurar shipments
  IF v_target_shipment_status IS NULL THEN
    DELETE FROM public.shipments WHERE order_id = p_order_id;
  ELSE
    UPDATE public.shipments
    SET status = v_target_shipment_status,
        updated_at = now()
    WHERE order_id = p_order_id;
  END IF;

  -- 6. Restaurar inventario para cada item del pedido
  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.cantidad
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Buscar fila de inventario
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

    -- Verificar si existe reserva para este pedido
    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'reservation'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_reservation;

    -- Verificar si ya fue confirmada como venta
    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'sale'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_sale;

    -- Verificar si ya fue liberada
    SELECT EXISTS(
      SELECT 1 FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'release'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
    ) INTO v_has_release;

    IF v_has_sale THEN
      -- Caso: venta confirmada → revertir quantity y reserved a initial
      SELECT cantidad INTO v_sale_qty
      FROM public.inventory_movements
      WHERE inventory_id = v_inv.id
        AND tipo = 'sale'
        AND referencia_tipo = 'order'
        AND referencia_id = p_order_id
      LIMIT 1;

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
      -- Caso: reserva sin venta → solo liberar reserved
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
      -- Caso: ya fue liberado → limpiar movimientos y asegurar estado base
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

  -- 7. Retornar resultado
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
-- 9. RESTRICCIONES DE SEGURIDAD PARA la función QA
--    Solo superuser puede ejecutar. No exponer al frontend.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.qa_reset_admin_order(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qa_reset_admin_order(integer) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.qa_reset_admin_order(integer) TO postgres;

-- ============================================================================
-- FIN S4.19.2
--
-- NOTA: El índice idx_orders_one_pending_per_user fue eliminado por esta
-- migración porque los fixtures QA requieren 2 pedidos pending para el
-- mismo usuario (QA-ADMIN-PENDING y QA-ADMIN-CANCEL).
-- El índice se recreará en la limpieza final (S4.24).
-- ============================================================================
