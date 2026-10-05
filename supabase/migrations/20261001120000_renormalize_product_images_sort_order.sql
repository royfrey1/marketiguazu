-- Renormaliza product_images.sort_order a 0..n-1 por producto.
-- Motivo: existen empates de sort_order (legacy) que hacen no-op a los
-- botones subir/bajar del admin (swapear dos valores iguales no cambia nada).
-- Migración de datos, idempotente: solo escribe donde el valor difiere.
-- Orden de desempate: sort_order actual, created_at, id.

WITH ranked AS (
  SELECT
    id,
    product_id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id
      ORDER BY sort_order, created_at, id
    ) - 1 AS new_order
  FROM public.product_images
  WHERE product_id IN (
    SELECT product_id
    FROM public.product_images
    GROUP BY product_id, sort_order
    HAVING COUNT(*) > 1
  )
)
UPDATE public.product_images pi
SET sort_order = ranked.new_order
FROM ranked
WHERE pi.id = ranked.id
  AND pi.sort_order IS DISTINCT FROM ranked.new_order;
