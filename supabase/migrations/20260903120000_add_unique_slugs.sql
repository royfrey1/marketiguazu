-- F4 T5: UNIQUE constraints para slugs
-- Reversible: DROP INDEX IF EXISTS

-- Products slug UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique ON products (slug);

-- Categories slug UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON categories (slug);
