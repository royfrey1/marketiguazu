-- ============================================================
-- FIX F8 T4.4.3 — Backfill de inventory para productos existentes
-- ============================================================
-- 8 productos (ids 7-14) no tienen fila de inventory.
-- 1 producto (id=17) ya tiene inventory correctamente.
-- 0 product_variants existen.
--
-- Crea inventory solo para productos que NO tengan
-- fila con variant_id IS NULL.
--
-- Valores: quantity=0, reserved=0, low_stock_threshold=5
-- No modifica inventory existente.
-- ============================================================

INSERT INTO inventory (product_id, quantity, reserved, low_stock_threshold)
SELECT p.id, 0, 0, 5
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM inventory i
  WHERE i.product_id = p.id AND i.variant_id IS NULL
);
