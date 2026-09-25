-- ============================================================
-- FIX F8 T4.4.3 — Corregir grants de adjust_stock
-- ============================================================
-- Revoke EXECUTE de roles innecesarios.
-- Mantener solo authenticated (frontend admin).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.adjust_stock(integer, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(integer, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(integer, integer, text, text) FROM postgres;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(integer, integer, text, text) FROM service_role;
