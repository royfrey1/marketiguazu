-- ============================================================
-- F7 T2.1: Preparación de DB para órdenes, pagos e inventario
-- ============================================================
-- Cambios:
--   1. Índice UNIQUE parcial en orders (idempotencia de creación)
--   2. Índice UNIQUE parcial en payments (unicidad de provider)
--   3. Función reserve_stock (reserva atómica de stock)
--   4. Función confirm_sale (confirmación atómica de venta)
--   5. Función release_reservation (liberación atómica de reserva)
--
-- Reversible: DROP INDEX / DROP FUNCTION en orden inverso.
-- ============================================================


-- ============================================================
-- 1. IDEMPOTENCIA DE ORDERS
-- ============================================================
-- Un usuario no puede tener más de una order con status = 'pending'.
-- Previene órdenes duplicadas por doble click, retry, etc.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_pending_per_user
  ON orders (user_id)
  WHERE status = 'pending';


-- ============================================================
-- 2. UNICIDAD DE PAYMENTS
-- ============================================================
-- Un mismo provider + provider_payment_id no puede registrarse
-- dos veces. Previene webhooks duplicados.
-- WHERE provider_payment_id IS NOT NULL: permite múltiples
-- payments pending (sin ID externo) para una misma order.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_per_provider_id
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;


-- ============================================================
-- 3. FUNCIÓN reserve_stock
-- ============================================================
-- Reserva stock de forma atómica para un item de una order.
--
-- Parámetros:
--   p_product_id  → ID del producto
--   p_variant_id  → ID de la variante (NULL si no aplica)
--   p_cantidad     → Cantidad a reservar (debe ser > 0)
--   p_order_id     → ID de la order asociada
--
-- Comportamiento:
--   1. Busca inventory por product_id + variant_id
--   2. Bloquea la fila con FOR UPDATE
--   3. Verifica disponibilidad (quantity - reserved >= cantidad)
--   4. Incrementa reserved
--   5. Registra inventory_movement tipo 'reservation'
--
-- Variantes:
--   - producto sin variante: variant_id IS NULL
--   - producto con variante: variant_id = p_variant_id
--
-- Concurrencia:
--   FOR UPDATE garantiza que dos requests simultáneos no
--   reserven el mismo stock disponible.
-- ============================================================

CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id integer,
  p_variant_id integer,
  p_cantidad integer,
  p_order_id integer
)
RETURNS void AS $$
DECLARE
  v_inventory_id integer;
  v_quantity integer;
  v_reserved integer;
  v_available integer;
BEGIN
  -- Validar parámetros
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0. Recibido: %', p_cantidad;
  END IF;

  -- Buscar fila de inventario y bloquearla
  SELECT id, quantity, reserved
  INTO v_inventory_id, v_quantity, v_reserved
  FROM inventory
  WHERE product_id = p_product_id
    AND (
      (p_variant_id IS NULL AND variant_id IS NULL)
      OR
      (variant_id = p_variant_id)
    )
  FOR UPDATE;

  -- Verificar que exista
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
      p_product_id, p_variant_id;
  END IF;

  -- Calcular disponibilidad
  v_available := v_quantity - v_reserved;

  -- Verificar stock suficiente
  IF v_available < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
      p_product_id, v_available, p_cantidad;
  END IF;

  -- Incrementar reserved
  UPDATE inventory
  SET reserved = reserved + p_cantidad,
      updated_at = now()
  WHERE id = v_inventory_id;

  -- Registrar movimiento de reserva
  INSERT INTO inventory_movements (
    inventory_id, tipo, direccion, cantidad,
    referencia_tipo, referencia_id
  ) VALUES (
    v_inventory_id, 'reservation', 'decrease', p_cantidad,
    'order', p_order_id
  );
END;
$$ LANGUAGE plpgsql
SET search_path = public;


-- ============================================================
-- 4. FUNCIÓN confirm_sale
-- ============================================================
-- Confirma la venta de un item previamente reservado.
--
-- Parámetros:
--   p_product_id  → ID del producto
--   p_variant_id  → ID de la variante (NULL si no aplica)
--   p_cantidad     → Cantidad a confirmar (debe ser > 0)
--   p_order_id     → ID de la order asociada
--
-- Comportamiento:
--   1. Busca inventory por product_id + variant_id
--   2. Bloquea la fila con FOR UPDATE
--   3. Verifica idempotencia: no procesar si ya existe un
--      movimiento 'sale' para esta order/inventory
--   4. Disminuye quantity (stock físico confirmado)
--   5. Disminuye reserved (libera la reserva)
--   6. Registra inventory_movement tipo 'sale'
--
-- Idempotencia:
--   Si ya existe un movimiento 'sale' con referencia_tipo='order'
--   y referencia_id=p_order_id para esta inventory, la función
--   no hace nada (retorna sin error).
--
-- Nota sobre released:
--   El movimiento 'sale' implica quantity -= cantidad Y
--   reserved -= cantidad. No se registra un movimiento
--   'release' separado porque la reserva se libera implícitamente
--   al confirmar la venta. Esto evanta duplicación de registros.
--
-- Estado final:
--   quantity -= cantidad
--   reserved -= cantidad
--   available se mantiene consistente
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_sale(
  p_product_id integer,
  p_variant_id integer,
  p_cantidad integer,
  p_order_id integer
)
RETURNS void AS $$
DECLARE
  v_inventory_id integer;
  v_reserved integer;
BEGIN
  -- Validar parámetros
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0. Recibido: %', p_cantidad;
  END IF;

  -- Buscar fila de inventario y bloquearla
  SELECT id, reserved
  INTO v_inventory_id, v_reserved
  FROM inventory
  WHERE product_id = p_product_id
    AND (
      (p_variant_id IS NULL AND variant_id IS NULL)
      OR
      (variant_id = p_variant_id)
    )
  FOR UPDATE;

  -- Verificar que exista
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
      p_product_id, p_variant_id;
  END IF;

  -- Verificar idempotencia: si ya se registró la venta, no repetir
  IF EXISTS (
    SELECT 1 FROM inventory_movements
    WHERE inventory_id = v_inventory_id
      AND tipo = 'sale'
      AND referencia_tipo = 'order'
      AND referencia_id = p_order_id
  ) THEN
    RETURN;
  END IF;

  -- Verificar que haya reserva suficiente
  IF v_reserved < p_cantidad THEN
    RAISE EXCEPTION 'Reserva insuficiente para producto %. Reservado: %, a confirmar: %',
      p_product_id, v_reserved, p_cantidad;
  END IF;

  -- Confirmar venta: disminuir quantity y reserved
  UPDATE inventory
  SET quantity = quantity - p_cantidad,
      reserved = reserved - p_cantidad,
      updated_at = now()
  WHERE id = v_inventory_id;

  -- Registrar movimiento de venta
  INSERT INTO inventory_movements (
    inventory_id, tipo, direccion, cantidad,
    referencia_tipo, referencia_id
  ) VALUES (
    v_inventory_id, 'sale', 'decrease', p_cantidad,
    'order', p_order_id
  );
END;
$$ LANGUAGE plpgsql
SET search_path = public;


-- ============================================================
-- 5. FUNCIÓN release_reservation
-- ============================================================
-- Libera stock reservado sin confirmar la venta.
-- Se usa cuando el pago es rechazado, cancelado o expira.
--
-- Parámetros:
--   p_product_id  → ID del producto
--   p_variant_id  → ID de la variante (NULL si no aplica)
--   p_cantidad     → Cantidad a liberar (debe ser > 0)
--   p_order_id     → ID de la order asociada
--
-- Comportamiento:
--   1. Busca inventory por product_id + variant_id
--   2. Bloquea la fila con FOR UPDATE
--   3. Verifica idempotencia: no procesar si ya existe un
--      movimiento 'release' o 'sale' para esta order/inventory
--   4. Disminuye reserved
--   5. Registra inventory_movement tipo 'release'
--
-- Idempotencia:
--   - Si ya existe un 'release' para esta order/inventory: retorna
--   - Si ya existe un 'sale' para esta order/inventory: retorna
--     (el 'sale' ya incluyó la liberación de reserved)
--
-- Estado final:
--   reserved -= cantidad
--   quantity sin cambios
--   available += cantidad
-- ============================================================

CREATE OR REPLACE FUNCTION release_reservation(
  p_product_id integer,
  p_variant_id integer,
  p_cantidad integer,
  p_order_id integer
)
RETURNS void AS $$
DECLARE
  v_inventory_id integer;
  v_reserved integer;
BEGIN
  -- Validar parámetros
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0. Recibido: %', p_cantidad;
  END IF;

  -- Buscar fila de inventario y bloquearla
  SELECT id, reserved
  INTO v_inventory_id, v_reserved
  FROM inventory
  WHERE product_id = p_product_id
    AND (
      (p_variant_id IS NULL AND variant_id IS NULL)
      OR
      (variant_id = p_variant_id)
    )
  FOR UPDATE;

  -- Verificar que exista
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventario no encontrado para producto %, variante %',
      p_product_id, p_variant_id;
  END IF;

  -- Verificar idempotencia: si ya se liberó, no repetir
  IF EXISTS (
    SELECT 1 FROM inventory_movements
    WHERE inventory_id = v_inventory_id
      AND referencia_tipo = 'order'
      AND referencia_id = p_order_id
      AND tipo IN ('release', 'sale')
  ) THEN
    RETURN;
  END IF;

  -- Verificar que haya reserva que liberar
  IF v_reserved < p_cantidad THEN
    RAISE EXCEPTION 'Reserva insuficiente para liberar. Reservado: %, a liberar: %',
      v_reserved, p_cantidad;
  END IF;

  -- Liberar reserva
  UPDATE inventory
  SET reserved = reserved - p_cantidad,
      updated_at = now()
  WHERE id = v_inventory_id;

  -- Registrar movimiento de liberación
  INSERT INTO inventory_movements (
    inventory_id, tipo, direccion, cantidad,
    referencia_tipo, referencia_id
  ) VALUES (
    v_inventory_id, 'release', 'increase', p_cantidad,
    'order', p_order_id
  );
END;
$$ LANGUAGE plpgsql
SET search_path = public;
