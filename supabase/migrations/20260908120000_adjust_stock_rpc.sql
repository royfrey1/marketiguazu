-- ============================================================
-- F8 T4.4.3 — RPC adjust_stock() para administración de inventario
-- ============================================================
-- Función transaccional para ajuste administrativo de stock.
--
-- Parámetros:
--   p_inventory_id  → ID del registro de inventory
--   p_quantity      → Nueva cantidad absoluta de stock
--   p_tipo          → Tipo de movimiento: restock | adjustment | return
--   p notas         → Motivo del ajuste (opcional)
--
-- Validaciones:
--   1. is_admin() = true
--   2. inventory existe
--   3. p_quantity >= reserved (no puede bajar stock por debajo de reservas)
--   4. p_quantity >= 0
--
-- Efecto:
--   - UPDATE inventory.quantity
--   - INSERT en inventory_movements
--   - created_by = auth.uid()
--
-- Atomicidad: BEGIN implícito. Si falla cualquier paso, todo se revierte.
-- ============================================================

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_inventory_id integer,
  p_quantity integer,
  p_tipo text,
  p_notas text DEFAULT NULL
)
RETURNS SETOF public.inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_admin boolean;
  v_current_quantity integer;
  v_reserved integer;
  v_product_id integer;
  v_direccion text;
  v_cantidad_abs integer;
BEGIN
  -- 1. Verificar admin
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin';
  END IF;

  -- 2. Validar tipo
  IF p_tipo NOT IN ('restock', 'adjustment', 'return') THEN
    RAISE EXCEPTION 'Tipo de ajuste inválido: %. Permitidos: restock, adjustment, return', p_tipo;
  END IF;

  -- 3. Buscar inventory y bloquear
  SELECT quantity, reserved, product_id
  INTO v_current_quantity, v_reserved, v_product_id
  FROM inventory
  WHERE id = p_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de inventario no encontrado (id: %)', p_inventory_id;
  END IF;

  -- 4. Validar cantidad
  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'La cantidad no puede ser negativa: %', p_quantity;
  END IF;

  IF p_quantity < v_reserved THEN
    RAISE EXCEPTION 'No se puede reducir stock a % porque hay % unidades reservadas. Stock mínimo permitido: %',
      p_quantity, v_reserved, v_reserved;
  END IF;

  -- 5. Calcular dirección y cantidad absoluta
  IF p_quantity > v_current_quantity THEN
    v_direccion := 'increase';
    v_cantidad_abs := p_quantity - v_current_quantity;
  ELSIF p_quantity < v_current_quantity THEN
    v_direccion := 'decrease';
    v_cantidad_abs := v_current_quantity - p_quantity;
  ELSE
    -- Sin cambio, no crear movimiento
    RETURN QUERY SELECT * FROM inventory WHERE id = p_inventory_id;
    RETURN;
  END IF;

  -- 6. Actualizar quantity
  UPDATE inventory
  SET quantity = p_quantity,
      updated_at = now()
  WHERE id = p_inventory_id;

  -- 7. Registrar movimiento
  INSERT INTO inventory_movements (
    inventory_id, tipo, direccion, cantidad,
    notas, created_by
  ) VALUES (
    p_inventory_id, p_tipo, v_direccion, v_cantidad_abs,
    p_notas, auth.uid()
  );

  -- 8. Retornar estado actualizado
  RETURN QUERY SELECT * FROM inventory WHERE id = p_inventory_id;
END;
$function$;

-- ============================================================
-- GRANTS
-- ============================================================
-- Frontend autenticado (admin) llama adjust_stock via supabase.rpc()
-- RLS en inventory/inventory_movements controla acceso directo.
-- SECURITY DEFINER permite a la función operar con privilegios elevados.
-- ============================================================
GRANT EXECUTE ON FUNCTION public.adjust_stock(integer, integer, text, text) TO authenticated;
