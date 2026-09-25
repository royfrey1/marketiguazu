-- ============================================================
-- product_specifications:动态的技术规格键值对，按产品分组
-- ============================================================

CREATE TABLE product_specifications (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text NOT NULL,
  value       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

-- Índices
CREATE INDEX idx_product_specifications_product_id ON product_specifications(product_id);
CREATE INDEX idx_product_specifications_product_sort ON product_specifications(product_id, sort_order, id);

-- RLS
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY product_specifications_admin_all
  ON product_specifications
  FOR ALL
  USING (is_admin());

-- Lectura pública: solo de productos activos
CREATE POLICY product_specifications_public_read
  ON product_specifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_specifications.product_id
        AND products.activo = true
    )
  );

-- Permisos
GRANT SELECT ON product_specifications TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON product_specifications TO authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_product_specifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_product_specifications_updated_at
  BEFORE UPDATE ON product_specifications
  FOR EACH ROW
  EXECUTE FUNCTION update_product_specifications_updated_at();
