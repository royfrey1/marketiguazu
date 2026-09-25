-- ============================================================
-- IGUAZÚ MARKETPLACE — ESQUEMA SQL FINAL
-- FASE 2 / TAREA 1.7.2
-- ============================================================
-- IMPORTANTE:
-- Este archivo contiene el esquema SQL aprobado en la Tarea 1.7.2.
-- Es el esquema estructural de referencia para la migración.
-- NO incluye la migración de datos legacy.
-- ============================================================

-- ============================================================
-- FASE 1: FUNCIONES AUXILIARES SIN DEPENDENCIA DE TABLAS
-- ============================================================

-- Secuencia para números de pedido
CREATE SEQUENCE order_number_seq START WITH 1 INCREMENT BY 1;

-- Generador de número de pedido: PED-00001, PED-00002, ...
-- Sin límite técnico. PED-100000 es válido.
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
BEGIN
  RETURN 'PED-' || LPAD(nextval('order_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Validación semántica de inventory_movements
CREATE OR REPLACE FUNCTION validate_movement_direction()
RETURNS trigger AS $$
BEGIN
  IF NEW.tipo IN ('restock', 'release', 'return') AND NEW.direccion != 'increase' THEN
    RAISE EXCEPTION 'El tipo % siempre debe ser increase', NEW.tipo;
  END IF;
  IF NEW.tipo IN ('sale', 'reservation') AND NEW.direccion != 'decrease' THEN
    RAISE EXCEPTION 'El tipo % siempre debe ser decrease', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- FASE 2: TABLAS (orden de dependencia FK)
-- ============================================================

-- ============================================================
-- 1. profiles
-- ============================================================
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  telefono   text,
  avatar_url text,
  ciudad     text,
  role       text NOT NULL DEFAULT 'customer'
             CHECK (role IN ('customer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ============================================================
-- 2. categories
-- ============================================================
CREATE TABLE categories (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre     text NOT NULL,
  slug       text NOT NULL UNIQUE,
  icono      text,
  parent_id  integer REFERENCES categories(id) ON DELETE SET NULL
             CHECK (parent_id IS NULL OR parent_id != id),
  sort_order integer NOT NULL DEFAULT 0,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ============================================================
-- 3. products
-- ============================================================
-- REGLA DE NEGOCIO:
--   Producto sin variantes: products.precio = precio real de venta.
--   Producto con variantes: products.precio = precio "desde" (referencia).
--     El precio real de venta es product_variants.precio.
-- ============================================================
CREATE TABLE products (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo          text NOT NULL,
  slug            text NOT NULL UNIQUE,
  descripcion     text,
  marca           text,
  category_id     integer NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
  precio_anterior numeric(12,2) CHECK (precio_anterior IS NULL OR precio_anterior >= 0),
  imagen_url      text,
  activo          boolean NOT NULL DEFAULT true,
  destacado       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz
);

-- ============================================================
-- 4. product_images
-- ============================================================
CREATE TABLE product_images (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt_text    text,
  sort_order  integer NOT NULL DEFAULT 0,
  es_principal boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. product_variants
-- ============================================================
-- UNIQUE(id, product_id) habilita la FK compuesta en inventory/cart_items.
-- ============================================================
CREATE TABLE product_variants (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id      integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
  precio_anterior numeric(12,2) CHECK (precio_anterior IS NULL OR precio_anterior >= 0),
  imagen_url      text,
  atributos       jsonb,
  activo          boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,
  UNIQUE (id, product_id)
);

-- ============================================================
-- 6. inventory
-- ============================================================
-- REGLAS:
--   variant_id IS NULL  → inventario del producto sin variante
--   variant_id IS NOT NULL → inventario de una variante específica
--   FK compuesta valida que variant_id pertenece a product_id.
--   available se calcula: quantity - reserved (NO se almacena).
--   ON DELETE RESTRICT: variante con inventario no se elimina físicamente.
-- ============================================================
CREATE TABLE inventory (
  id                   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id           integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id           integer,
  quantity             integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved             integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  low_stock_threshold  integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,
  CHECK (reserved <= quantity),
  FOREIGN KEY (variant_id, product_id)
    REFERENCES product_variants(id, product_id)
    ON DELETE RESTRICT
);

-- ============================================================
-- 7. inventory_movements
-- ============================================================
-- SEMÁNTICA DEFINITIVA:
--
-- tipo         | direccion  | Efecto quantity | Efecto reserved | Efecto available
-- -------------|------------|-----------------|-----------------|------------------
-- restock      | increase   | +cantidad       | —               | +cantidad
-- sale         | decrease   | -cantidad       | —               | -cantidad
-- reservation  | decrease   | —               | +cantidad       | -cantidad
-- release      | increase   | —               | -cantidad       | +cantidad
-- adjustment   | increase   | +cantidad       | —               | +cantidad
-- adjustment   | decrease   | -cantidad       | —               | -cantidad
-- return       | increase   | +cantidad       | —               | +cantidad
--
-- 'direccion' = impacto lógico sobre stock disponible.
-- 'cantidad' = SIEMPRE positiva (cantidad absoluta).
-- ============================================================
CREATE TABLE inventory_movements (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id    integer NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  tipo            text NOT NULL
                  CHECK (tipo IN ('restock','sale','reservation','release','adjustment','return')),
  direccion       text NOT NULL
                  CHECK (direccion IN ('increase','decrease')),
  cantidad        integer NOT NULL CHECK (cantidad > 0),
  referencia_tipo text,
  referencia_id   integer,
  notas           text,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. price_history
-- ============================================================
-- Target exclusivo: XOR.
--   producto: product_id informado, variant_id NULL
--   variante: variant_id informado, product_id NULL
-- ON DELETE RESTRICT en variant_id: variante con historial no se elimina.
-- ============================================================
CREATE TABLE price_history (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id      integer REFERENCES products(id) ON DELETE CASCADE,
  variant_id      integer REFERENCES product_variants(id) ON DELETE RESTRICT,
  precio_anterior numeric(12,2) NOT NULL CHECK (precio_anterior >= 0),
  precio_nuevo    numeric(12,2) NOT NULL CHECK (precio_nuevo >= 0),
  origen          text NOT NULL
                  CHECK (origen IN ('manual','promotion','bulk_update')),
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((product_id IS NOT NULL) <> (variant_id IS NOT NULL))
);

-- ============================================================
-- 9. favorites
-- ============================================================
CREATE TABLE favorites (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- ============================================================
-- 10. carts
-- ============================================================
-- Múltiples históricos, máximo 1 activo por usuario.
-- gen_random_uuid() nativo de PostgreSQL, sin dependencia de uuid-ossp.
-- ============================================================
CREATE TABLE carts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','abandoned','converted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ============================================================
-- 11. cart_items
-- ============================================================
-- precio_unitario = snapshot. NO es fuente definitiva para checkout.
-- FK compuesta valida que variant_id pertenece a product_id.
-- ON DELETE RESTRICT en variant_id: variante no se elimina físicamente.
-- ============================================================
CREATE TABLE cart_items (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id         uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id      integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      integer,
  cantidad        integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,
  FOREIGN KEY (variant_id, product_id)
    REFERENCES product_variants(id, product_id)
    ON DELETE RESTRICT
);

-- ============================================================
-- 12. addresses
-- ============================================================
CREATE TABLE addresses (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  calle         text NOT NULL,
  numero        text,
  piso          text,
  departamento  text,
  ciudad        text NOT NULL,
  provincia     text NOT NULL,
  codigo_postal text NOT NULL,
  pais          text NOT NULL DEFAULT 'Argentina',
  telefono      text,
  es_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);

-- ============================================================
-- 13. orders
-- ============================================================
-- SEPARACIÓN DE ESTADOS:
--   orders.status         → ciclo comercial
--   orders.payment_status → ciclo del pago
--   shipments.status      → ciclo logístico (tabla independiente)
-- NUMERO DE PEDIDO: PED-XXXXX, sin límite técnico.
-- ============================================================
CREATE TABLE orders (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  numero_pedido   text NOT NULL UNIQUE
                  DEFAULT generate_order_number(),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','preparing','shipped','delivered','cancelled')),
  payment_status  text NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending','approved','rejected','refunded','cancelled')),
  subtotal        numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  envio_costo     numeric(12,2) NOT NULL DEFAULT 0 CHECK (envio_costo >= 0),
  total           numeric(12,2) NOT NULL CHECK (total >= 0),
  direccion_envio jsonb NOT NULL,
  metodo_envio    text,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,
  CHECK (total = subtotal + envio_costo)
);

-- ============================================================
-- 14. order_items
-- ============================================================
-- SNAPSHOT HISTÓRICO: product_id/variant_id pueden ser NULL
-- si el producto fue eliminado (ON DELETE SET NULL).
-- ============================================================
CREATE TABLE order_items (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       integer REFERENCES products(id) ON DELETE SET NULL,
  variant_id       integer REFERENCES product_variants(id) ON DELETE SET NULL,
  nombre_producto  text NOT NULL,
  variante_nombre  text,
  sku              text,
  precio_unitario  numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
  cantidad         integer NOT NULL CHECK (cantidad > 0),
  subtotal         numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (subtotal = precio_unitario * cantidad)
);

-- ============================================================
-- 15. payments
-- ============================================================
-- Múltiples intentos por pedido. Sin datos sensibles de tarjetas.
-- ============================================================
CREATE TABLE payments (
  id                    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id              integer NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider              text NOT NULL CHECK (length(trim(provider)) > 0),
  provider_payment_id   text,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','refunded','cancelled')),
  amount                numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency              text NOT NULL DEFAULT 'ARS' CHECK (length(trim(currency)) = 3),
  metadata              jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz
);

-- ============================================================
-- 16. shipments
-- ============================================================
-- Entidad independiente. orders.status = comercial.
-- shipments.status = logístico. TEXT + CHECK para MVP.
-- ============================================================
CREATE TABLE shipments (
  id                    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id              integer NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider              text NOT NULL
                        CHECK (provider IN ('via_cargo','correo_argentino','crucero_express','oca','otro')),
  provider_tracking_id  text,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','shipped','in_transit','delivered','failed')),
  costo                 numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  estimated_days        integer CHECK (estimated_days IS NULL OR estimated_days > 0),
  metadata              jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz
);


-- ============================================================
-- FASE 3: ÍNDICES
-- ============================================================

-- categories
CREATE INDEX idx_categories_parent_id ON categories (parent_id);

-- products
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_activo ON products (activo) WHERE activo = true;
CREATE INDEX idx_products_destacado ON products (destacado) WHERE destacado = true;
CREATE INDEX idx_products_created_at ON products (created_at DESC);
CREATE INDEX idx_products_precio ON products (precio);

-- product_images
CREATE INDEX idx_product_images_product_id ON product_images (product_id);
CREATE INDEX idx_product_images_sort ON product_images (product_id, sort_order);
CREATE UNIQUE INDEX idx_product_images_one_principal
  ON product_images (product_id) WHERE es_principal = true;

-- product_variants
CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX idx_product_variants_sku ON product_variants (sku);

-- inventory
CREATE INDEX idx_inventory_product_id ON inventory (product_id);
CREATE INDEX idx_inventory_variant_id ON inventory (variant_id);
CREATE UNIQUE INDEX idx_inventory_one_per_product_no_variant
  ON inventory (product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX idx_inventory_one_per_variant
  ON inventory (product_id, variant_id) WHERE variant_id IS NOT NULL;

-- inventory_movements
CREATE INDEX idx_movements_inventory_id ON inventory_movements (inventory_id);
CREATE INDEX idx_movements_created_at ON inventory_movements (created_at DESC);

-- price_history
CREATE INDEX idx_price_history_product_id ON price_history (product_id);
CREATE INDEX idx_price_history_variant_id ON price_history (variant_id);
CREATE INDEX idx_price_history_created_at ON price_history (created_at DESC);

-- favorites
CREATE INDEX idx_favorites_user_id ON favorites (user_id);
CREATE INDEX idx_favorites_product_id ON favorites (product_id);

-- carts
CREATE UNIQUE INDEX idx_carts_one_active_per_user
  ON carts (user_id) WHERE status = 'active';

-- cart_items
CREATE INDEX idx_cart_items_cart_id ON cart_items (cart_id);
CREATE UNIQUE INDEX idx_cart_items_one_per_product_no_variant
  ON cart_items (cart_id, product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX idx_cart_items_one_per_variant
  ON cart_items (cart_id, product_id, variant_id) WHERE variant_id IS NOT NULL;

-- addresses
CREATE INDEX idx_addresses_user_id ON addresses (user_id);
CREATE UNIQUE INDEX idx_addresses_one_default_per_user
  ON addresses (user_id) WHERE es_default = true;

-- orders
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX idx_orders_numero_pedido ON orders (numero_pedido);

-- order_items
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

-- payments
CREATE INDEX idx_payments_order_id ON payments (order_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_provider_payment_id ON payments (provider_payment_id);

-- shipments
CREATE INDEX idx_shipments_order_id ON shipments (order_id);
CREATE INDEX idx_shipments_status ON shipments (status);


-- ============================================================
-- FASE 4: FUNCIONES DE VALIDACIÓN
-- ============================================================

-- SOLO validate_movement_direction() permanece.
-- Las funciones de validación de variante fueron eliminadas
-- y reemplazadas por FK compuesta nativa.


-- ============================================================
-- FASE 5: TRIGGERS
-- ============================================================

-- SOLO trg_validate_movement_direction permanece.
-- Los triggers de validación de variante fueron eliminados
-- y reemplazados por FK compuesta nativa.

CREATE TRIGGER trg_validate_movement_direction
  BEFORE INSERT OR UPDATE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION validate_movement_direction();


-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================
