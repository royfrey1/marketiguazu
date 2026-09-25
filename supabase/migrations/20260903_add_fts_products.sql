-- F4 T2: Full Text Search para catálogo de productos
-- Configuración: español (es)
-- Campos: titulo, descripcion, marca
-- Reversible: puede eliminarse con DROP COLUMN + DROP INDEX

-- 1. Agregar columna generated para tsvector
ALTER TABLE products
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(descripcion, '')), 'B') ||
  setweight(to_tsvector('spanish', coalesce(marca, '')), 'C')
) STORED;

-- 2. Índice GIN para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(fts);

-- 3. Índice para filtros combinados (categoría + activo + precio)
CREATE INDEX IF NOT EXISTS idx_products_catalog ON products (activo, category_id, precio);

-- 4. Índice para ordenamiento por precio
CREATE INDEX IF NOT EXISTS idx_products_precio ON products (precio) WHERE activo = true;
