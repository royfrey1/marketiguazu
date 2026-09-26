-- ============================================================
-- reportes_errores — versionado de tabla en uso real
-- ============================================================
-- La tabla existía solo en el remoto (nunca fue versionada) y la
-- usa el formulario público /report (reportService.create). Se
-- crea aquí con estructura y políticas idénticas al remoto
-- (snapshot 2026-09-25) para que un rebuild con supabase db push
-- no rompa esa funcionalidad.
--
-- Idempotente: en el remoto la tabla ya existe, por eso se usa
-- CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS (no cambia
-- nada en el proyecto actual; solo completa el historial).
--
-- Estructura remoto: id bigserial PK, created_at timestamptz
-- default now() nullable, nombre/email nullable, tipo_error y
-- descripcion NOT NULL, user_id uuid → auth.users(id) ON DELETE
-- SET NULL (constraint reportes_errores_user_id_fkey), sin
-- triggers, único índice = PK.
-- Política remoto: única política "Permitir inserciones públicas",
-- PERMISSIVE, FOR INSERT, roles {public}, WITH CHECK (true).
-- Sin política de SELECT: nadie lee la tabla por PostgREST.
-- ============================================================

CREATE TABLE IF NOT EXISTS reportes_errores (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  nombre      text,
  email       text,
  tipo_error  text NOT NULL,
  descripcion text NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS (ya estaba habilitada en el remoto; ALTER es no-op)
ALTER TABLE reportes_errores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserciones públicas" ON reportes_errores;
CREATE POLICY "Permitir inserciones públicas"
  ON reportes_errores
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK (true);

-- Privilegios equivalentes a los defaults de Supabase vigentes en
-- el remoto (anon/authenticated/service_role con ALL sobre tabla)
GRANT ALL ON TABLE reportes_errores TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE reportes_errores_id_seq TO anon, authenticated, service_role;
