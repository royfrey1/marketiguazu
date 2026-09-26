-- ============================================================
-- Sincronización de RLS con el estado real del proyecto remoto
--
-- Migración de "estado ya vigente": habilita RLS y recrea,
-- idénticas a las que hoy están activas en el proyecto remoto
-- (snapshot de pg_policies consultado el 2026-09-25), las
-- políticas de las tablas que las migraciones locales no
-- definían explícitamente.
--
-- No agrega comportamiento nuevo: si la base se reconstruye
-- desde cero con `supabase db push`, queda con el mismo estado
-- de seguridad que el remoto hoy. Se usa DROP POLICY IF EXISTS
-- + CREATE POLICY para que la migración sea idempotente y
-- garantice la definición exacta del remoto.
-- No se tocan GRANT: los permisos de tabla se heredan de los
-- privilegios por defecto de Supabase en el esquema public.
-- Requiere is_admin() (ya creada en
-- 20260907180000_security_baseline_versioning.sql).
-- ============================================================

-- ------------------------------------------------------------
-- carts: CRUD propio + admin total
-- ------------------------------------------------------------
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carts_select_own ON carts;
CREATE POLICY carts_select_own
  ON carts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS carts_insert_own ON carts;
CREATE POLICY carts_insert_own
  ON carts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS carts_update_own ON carts;
CREATE POLICY carts_update_own
  ON carts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS carts_delete_own ON carts;
CREATE POLICY carts_delete_own
  ON carts
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS carts_admin_all ON carts;
CREATE POLICY carts_admin_all
  ON carts
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- cart_items: CRUD propio (vía carrito del usuario) + admin total
-- ------------------------------------------------------------
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cart_items_select_own ON cart_items;
CREATE POLICY cart_items_select_own
  ON cart_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cart_items_insert_own ON cart_items;
CREATE POLICY cart_items_insert_own
  ON cart_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cart_items_update_own ON cart_items;
CREATE POLICY cart_items_update_own
  ON cart_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cart_items_delete_own ON cart_items;
CREATE POLICY cart_items_delete_own
  ON cart_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cart_items_admin_all ON cart_items;
CREATE POLICY cart_items_admin_all
  ON cart_items
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- favorites: CRUD propio (sin UPDATE) + admin total
-- ------------------------------------------------------------
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_select_own ON favorites;
CREATE POLICY favorites_select_own
  ON favorites
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS favorites_insert_own ON favorites;
CREATE POLICY favorites_insert_own
  ON favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS favorites_delete_own ON favorites;
CREATE POLICY favorites_delete_own
  ON favorites
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS favorites_admin_all ON favorites;
CREATE POLICY favorites_admin_all
  ON favorites
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- addresses: CRUD propio + SELECT de admin
-- ------------------------------------------------------------
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addresses_select_own ON addresses;
CREATE POLICY addresses_select_own
  ON addresses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_insert_own ON addresses;
CREATE POLICY addresses_insert_own
  ON addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_update_own ON addresses;
CREATE POLICY addresses_update_own
  ON addresses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_delete_own ON addresses;
CREATE POLICY addresses_delete_own
  ON addresses
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS addresses_admin_select ON addresses;
CREATE POLICY addresses_admin_select
  ON addresses
  FOR SELECT
  USING (is_admin());

-- ------------------------------------------------------------
-- products: lectura pública de activos + admin total
-- ------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_public_read ON products;
CREATE POLICY products_public_read
  ON products
  FOR SELECT
  USING (activo = true);

DROP POLICY IF EXISTS products_admin_all ON products;
CREATE POLICY products_admin_all
  ON products
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- categories: lectura pública de activos + admin total
-- ------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_public_read ON categories;
CREATE POLICY categories_public_read
  ON categories
  FOR SELECT
  USING (activo = true);

DROP POLICY IF EXISTS categories_admin_all ON categories;
CREATE POLICY categories_admin_all
  ON categories
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- price_history: solo admin (sin lectura pública)
-- ------------------------------------------------------------
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_history_admin_all ON price_history;
CREATE POLICY price_history_admin_all
  ON price_history
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- product_images: lectura pública si el producto está activo + admin total
-- ------------------------------------------------------------
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_images_public_read ON product_images;
CREATE POLICY product_images_public_read
  ON product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_images.product_id
        AND products.activo = true
    )
  );

DROP POLICY IF EXISTS product_images_admin_all ON product_images;
CREATE POLICY product_images_admin_all
  ON product_images
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- product_variants: lectura pública si variante y producto activos + admin total
-- ------------------------------------------------------------
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variants_public_read ON product_variants;
CREATE POLICY product_variants_public_read
  ON product_variants
  FOR SELECT
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variants.product_id
        AND products.activo = true
    )
  );

DROP POLICY IF EXISTS product_variants_admin_all ON product_variants;
CREATE POLICY product_variants_admin_all
  ON product_variants
  FOR ALL
  USING (is_admin());

-- ------------------------------------------------------------
-- profiles: CRUD propio + SELECT de admin + acceso total de admin
-- ------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own
  ON profiles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_delete_own ON profiles;
CREATE POLICY profiles_delete_own
  ON profiles
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_select ON profiles;
CREATE POLICY profiles_admin_select
  ON profiles
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS profiles_admin_all ON profiles;
CREATE POLICY profiles_admin_all
  ON profiles
  FOR ALL
  USING (is_admin());
