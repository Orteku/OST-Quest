-- ═══════════════════════════════════════════════════════════════════════════
-- Esquema para el sistema de auth personalizado (reemplaza Supabase Auth)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tabla de usuarios ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        UNIQUE,
  password_hash TEXT,                               -- solo para provider='email'
  provider     TEXT        NOT NULL DEFAULT 'email', -- email | google | discord | twitch | steam
  provider_id  TEXT,                                -- ID en el proveedor externo
  username     TEXT        UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);

-- ── Tokens de reset de contraseña ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limpieza automática de tokens expirados (opcional, cron o trigger)
-- Se puede hacer manualmente con: DELETE FROM password_reset_tokens WHERE expires_at < NOW();

-- ── Actualizar la tabla scores para referenciar public.users en lugar de auth.users ──
-- ATENCIÓN: hacer esto después de migrar los usuarios existentes

-- ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_user_id_fkey;
-- ALTER TABLE public.scores
--   ADD CONSTRAINT scores_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── Columna streak en users (para el ranking) ───────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;

-- ── Desacoplar scores de auth.users → public.users ───────────────────────────
-- El Worker usa service_role key, que bypassa FK. Aun así, quitamos la FK
-- antigua para que no bloquee inserciones de usuarios nuevos.
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_user_id_fkey;

-- ── RLS: el Worker usa service_role key → bypassa RLS ────────────────────────
-- Las tablas no necesitan RLS si solo accede el Worker con service_role.
-- Si en algún momento el cliente accede directamente a Supabase, habilitar:

-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "users_self" ON public.users FOR SELECT USING (id = auth.uid());

-- ── Índices de rendimiento ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS users_email_idx       ON public.users (email);
CREATE INDEX IF NOT EXISTS users_provider_idx    ON public.users (provider, provider_id);
CREATE INDEX IF NOT EXISTS users_username_idx    ON public.users (username);
CREATE INDEX IF NOT EXISTS reset_token_token_idx ON public.password_reset_tokens (token);
