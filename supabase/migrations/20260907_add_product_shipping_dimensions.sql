-- ============================================================
-- F7 T2.2.2 — Agregar datos logísticos de despacho a products
-- ============================================================
-- Estos campos representan el PAQUETE LISTO PARA DESPACHO.
-- Vivirán en products para el MVP. Posteriormente podrían
-- evolucionar a product_variants o a una estructura dedicada.
--
-- Los campos son NULL inicialmente porque los productos
-- existentes no tienen datos logísticos cargados.
-- NO se realiza backfill de datos ficticios.
-- ============================================================

-- 1. Agregar columnas (NULL por defecto para compatibilidad)
ALTER TABLE products
  ADD COLUMN peso_envio_gramos integer,
  ADD COLUMN alto_paquete_cm   integer,
  ADD COLUMN ancho_paquete_cm  integer,
  ADD COLUMN largo_paquete_cm  integer;

-- 2. CHECK constraints individuales (valores físicamente válidos)
-- peso: > 0 y <= 25000 gramos (límite API MiCorreo /rates)
ALTER TABLE products
  ADD CONSTRAINT chk_products_peso_envio_gramos
  CHECK (peso_envio_gramos IS NULL OR (peso_envio_gramos > 0 AND peso_envio_gramos <= 25000));

-- dimensiones: > 0 y <= 150 cm (límite API MiCorreo /rates)
ALTER TABLE products
  ADD CONSTRAINT chk_products_alto_paquete_cm
  CHECK (alto_paquete_cm IS NULL OR (alto_paquete_cm > 0 AND alto_paquete_cm <= 150));

ALTER TABLE products
  ADD CONSTRAINT chk_products_ancho_paquete_cm
  CHECK (ancho_paquete_cm IS NULL OR (ancho_paquete_cm > 0 AND ancho_paquete_cm <= 150));

ALTER TABLE products
  ADD CONSTRAINT chk_products_largo_paquete_cm
  CHECK (largo_paquete_cm IS NULL OR (largo_paquete_cm > 0 AND largo_paquete_cm <= 150));

-- 3. Regla de consistencia: TODOS NULL o TODOS NOT NULL
-- No permitir estados parciales (ej: peso cargado sin dimensiones).
-- Se implementa con una condición XOR lógica:
--   (peso IS NULL AND alto IS NULL AND ancho IS NULL AND largo IS NULL)
--   OR
--   (peso IS NOT NULL AND alto IS NOT NULL AND ancho IS NOT NULL AND largo IS NOT NULL)
ALTER TABLE products
  ADD CONSTRAINT chk_products_shipping_dimensions_complete
  CHECK (
    (peso_envio_gramos IS NULL AND alto_paquete_cm IS NULL AND ancho_paquete_cm IS NULL AND largo_paquete_cm IS NULL)
    OR
    (peso_envio_gramos IS NOT NULL AND alto_paquete_cm IS NOT NULL AND ancho_paquete_cm IS NOT NULL AND largo_paquete_cm IS NOT NULL)
  );
