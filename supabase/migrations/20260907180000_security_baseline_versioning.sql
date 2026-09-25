-- ============================================================
-- F8 T1.1 — Versionar línea base de seguridad del Admin
-- ============================================================
-- Esta migración versiona funciones y políticas que existen
-- en el remoto pero NO están en el repositorio.
--
-- NO elimina ni recrea nada que ya funcione.
-- Usa CREATE OR REPLACE para ser idempotente.
-- ============================================================

-- ============================================================
-- 1. Función is_admin()
--    Existe en remoto: SECURITY DEFINER, STABLE,
--    search_path='public', CONSULTA profiles.role
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$function$;

-- ============================================================
-- 2. Trigger: prevent_role_escalation()
--    Previene que usuarios no-admin cambien su propio role.
--    Ejecuta BEFORE UPDATE en profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Bloquear cambio de ID
  NEW.id := OLD.id;

  -- Verificar si el usuario actual es admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin_user;

  -- Si no es admin, forzar el role anterior
  IF NOT is_admin_user THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. Trigger: validate_movement_direction()
--    Valida coherencia entre tipo y dirección de movimientos.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_movement_direction()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.tipo IN ('restock', 'release', 'return') AND NEW.direccion != 'increase' THEN
    RAISE EXCEPTION 'El tipo % siempre debe ser increase', NEW.tipo;
  END IF;
  IF NEW.tipo IN ('sale', 'reservation') AND NEW.direccion != 'decrease' THEN
    RAISE EXCEPTION 'El tipo % siempre debe ser decrease', NEW.tipo;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 4. Asegurar que el trigger prevent_role_escalation exista
--    en la tabla profiles (puede que ya exista en remoto)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_prevent_role_escalation'
    AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_prevent_role_escalation
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_role_escalation();
  END IF;
END $$;

-- ============================================================
-- 5. Asegurar que el trigger validate_movement_direction
--    exista en inventory_movements
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_movement_direction'
    AND tgrelid = 'public.inventory_movements'::regclass
  ) THEN
    CREATE TRIGGER trg_validate_movement_direction
      BEFORE INSERT OR UPDATE ON public.inventory_movements
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_movement_direction();
  END IF;
END $$;

-- ============================================================
-- 6. Política INSERT faltante en profiles
--    RegisterPage inserta perfil directamente desde el cliente.
--    Sin esta política, el registro FALLA.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================================
-- 7. Policy DELETE own (necesaria para que usuarios puedan
--    eliminar su propia cuenta si se requiere en el futuro)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'profiles_delete_own'
  ) THEN
    CREATE POLICY profiles_delete_own
      ON public.profiles
      FOR DELETE
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;
