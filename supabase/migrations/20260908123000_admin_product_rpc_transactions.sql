-- ============================================================
-- F8 T4.2.1: Atomicidad y consistencia de Crear/Editar Producto
-- ============================================================
-- Funciones RPC transaccionales para crear y actualizar productos.
-- Garantizan atomicidad: products + inventory + price_history
-- se confirman o revierten juntos.
-- ============================================================

-- ============================================================
-- 1. CREATE_ADMIN_PRODUCT
-- ============================================================
-- Crea producto + inventario inicial + precio historial.
-- Todo dentro de una transacción única.
-- Devuelve el producto creado como JSONB.

CREATE OR REPLACE FUNCTION public.create_admin_product(
  p_titulo text,
  p_slug text,
  p_category_id integer,
  p_precio numeric,
  p_descripcion text DEFAULT NULL,
  p_marca text DEFAULT NULL,
  p_precio_anterior numeric DEFAULT NULL,
  p_activo boolean DEFAULT true,
  p_destacado boolean DEFAULT false,
  p_peso_envio_gramos integer DEFAULT NULL,
  p_alto_paquete_cm integer DEFAULT NULL,
  p_ancho_paquete_cm integer DEFAULT NULL,
  p_largo_paquete_cm integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_product products%ROWTYPE;
BEGIN
  -- 1. Validar autorización admin
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No tenés permisos de administrador';
  END IF;

  -- 2. Insertar producto
  INSERT INTO products (
    titulo, slug, descripcion, marca, category_id,
    precio, precio_anterior, activo, destacado,
    peso_envio_gramos, alto_paquete_cm, ancho_paquete_cm, largo_paquete_cm
  ) VALUES (
    p_titulo, p_slug, p_descripcion, p_marca, p_category_id,
    p_precio, p_precio_anterior, p_activo, p_destacado,
    p_peso_envio_gramos, p_alto_paquete_cm, p_ancho_paquete_cm, p_largo_paquete_cm
  )
  RETURNING * INTO v_product;

  -- 3. Crear inventario inicial (quantity=0, reserved=0)
  INSERT INTO inventory (
    product_id, quantity, reserved, low_stock_threshold
  ) VALUES (
    v_product.id, 0, 0, 5
  );

  -- 4. Registrar precio inicial en price_history
  INSERT INTO price_history (
    product_id, precio_anterior, precio_nuevo, origen, user_id
  ) VALUES (
    v_product.id, v_product.precio, v_product.precio, 'manual', v_user_id
  );

  -- 5. Devolver producto creado como JSONB
  RETURN to_jsonb(v_product);
END;
$$;


-- ============================================================
-- 2. UPDATE_ADMIN_PRODUCT
-- ============================================================
-- Actualiza producto y registla cambio de precio si existe.
-- Transacción única: products update + price_history insert.
-- Devuelve el producto actualizado como JSONB.

CREATE OR REPLACE FUNCTION public.update_admin_product(
  p_product_id integer,
  p_titulo text,
  p_slug text,
  p_category_id integer,
  p_precio numeric,
  p_descripcion text DEFAULT NULL,
  p_marca text DEFAULT NULL,
  p_precio_anterior numeric DEFAULT NULL,
  p_activo boolean DEFAULT true,
  p_destacado boolean DEFAULT false,
  p_peso_envio_gramos integer DEFAULT NULL,
  p_alto_paquete_cm integer DEFAULT NULL,
  p_ancho_paquete_cm integer DEFAULT NULL,
  p_largo_paquete_cm integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_old_price numeric;
  v_product products%ROWTYPE;
BEGIN
  -- 1. Validar autorización admin
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No tenés permisos de administrador';
  END IF;

  -- 2. Obtener precio actual antes del update
  SELECT precio INTO v_old_price
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  -- 3. Actualizar producto
  UPDATE products SET
    titulo = p_titulo,
    slug = p_slug,
    descripcion = p_descripcion,
    marca = p_marca,
    category_id = p_category_id,
    precio = p_precio,
    precio_anterior = p_precio_anterior,
    activo = p_activo,
    destacado = p_destacado,
    peso_envio_gramos = p_peso_envio_gramos,
    alto_paquete_cm = p_alto_paquete_cm,
    ancho_paquete_cm = p_ancho_paquete_cm,
    largo_paquete_cm = p_largo_paquete_cm,
    updated_at = now()
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  -- 4. Si el precio cambió, registrar en price_history
  IF v_old_price IS DISTINCT FROM p_precio THEN
    INSERT INTO price_history (
      product_id, precio_anterior, precio_nuevo, origen, user_id
    ) VALUES (
      p_product_id, v_old_price, p_precio, 'manual', v_user_id
    );
  END IF;

  -- 5. Devolver producto actualizado como JSONB
  RETURN to_jsonb(v_product);
END;
$$;


-- ============================================================
-- PERMISOS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_admin_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_product TO authenticated;
