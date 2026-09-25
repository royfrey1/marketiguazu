-- ============================================================
-- FIX F8 T4.4.3.1 — Refinar grants de inventory_admin_view
-- ============================================================
-- authenticated tiene ALL (CRUD) sobre la vista.
-- Solo debe tener SELECT (lectura).
-- Los ajustes de stock se hacen via adjust_stock(), no vía la vista.
-- ============================================================

REVOKE ALL ON public.inventory_admin_view FROM authenticated;
GRANT SELECT ON public.inventory_admin_view TO authenticated;
