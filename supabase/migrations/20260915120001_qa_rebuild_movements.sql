-- Re-create inventory movements after reset test
DO $$
DECLARE
  v_prod1_id integer;
  v_prod2_id integer;
  v_inv_prod1 integer;
  v_inv_prod2 integer;
BEGIN
  SELECT id INTO v_prod1_id FROM products WHERE slug = 'qa-admin-producto-test-1';
  SELECT id INTO v_prod2_id FROM products WHERE slug = 'qa-admin-producto-test-2';
  SELECT id INTO v_inv_prod1 FROM inventory WHERE product_id = v_prod1_id AND variant_id IS NULL;
  SELECT id INTO v_inv_prod2 FROM inventory WHERE product_id = v_prod2_id AND variant_id IS NULL;

  -- QA-ADMIN-PENDING: reservar 1 unidad de prod1
  UPDATE inventory SET reserved = reserved + 1, updated_at = now() WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PENDING: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PENDING'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  -- QA-ADMIN-PAID: reservar 1 unidad de prod2
  UPDATE inventory SET reserved = reserved + 1, updated_at = now() WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PAID: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PAID'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  -- QA-ADMIN-CANCEL: reservar 1 unidad de prod2
  UPDATE inventory SET reserved = reserved + 1, updated_at = now() WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-CANCEL: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-CANCEL'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  -- QA-ADMIN-PREPARING: reservar + confirmar venta de 1 unidad de prod1
  UPDATE inventory SET reserved = reserved + 1, updated_at = now() WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PREPARING: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  UPDATE inventory SET quantity = quantity - 1, reserved = reserved - 1, updated_at = now() WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'sale', 'decrease', 1, 'order', o.id, 'QA-ADMIN-PREPARING: venta confirmada'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-PREPARING'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'sale');

  -- QA-ADMIN-SHIPPED: reservar + confirmar venta de 2 unidades de prod2
  UPDATE inventory SET reserved = reserved + 2, updated_at = now() WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'reservation', 'decrease', 2, 'order', o.id, 'QA-ADMIN-SHIPPED: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  UPDATE inventory SET quantity = quantity - 2, reserved = reserved - 2, updated_at = now() WHERE id = v_inv_prod2;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod2, 'sale', 'decrease', 2, 'order', o.id, 'QA-ADMIN-SHIPPED: venta confirmada'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-SHIPPED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod2 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'sale');

  -- QA-ADMIN-DELIVERED: reservar + confirmar venta de 1 unidad de prod1
  UPDATE inventory SET reserved = reserved + 1, updated_at = now() WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'reservation', 'decrease', 1, 'order', o.id, 'QA-ADMIN-DELIVERED: reserva'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'reservation');

  UPDATE inventory SET quantity = quantity - 1, reserved = reserved - 1, updated_at = now() WHERE id = v_inv_prod1;
  INSERT INTO inventory_movements (inventory_id, tipo, direccion, cantidad, referencia_tipo, referencia_id, notas)
  SELECT v_inv_prod1, 'sale', 'decrease', 1, 'order', o.id, 'QA-ADMIN-DELIVERED: venta confirmada'
  FROM orders o WHERE o.numero_pedido = 'QA-ADMIN-DELIVERED'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE inventory_id = v_inv_prod1 AND referencia_tipo = 'order' AND referencia_id = o.id AND tipo = 'sale');
END $$;
