import { Pool } from 'pg';

// max explícito — ver ms-salas/src/db/pool.ts para el motivo.
export const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 15,
});

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Segmentos de usuarios (agrupan configuración por tipo de usuario)
  CREATE TABLE IF NOT EXISTS segmentos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT,
    config      JSONB       NOT NULL DEFAULT '{}',
    activo      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO segmentos (nombre, descripcion, config) VALUES (
    'tester',
    'Segmento de prueba con todas las opciones habilitadas',
    '{"tema":"dark","idioma":"es","modos_juego":["clasico","rapido","torneo"],"features":{"registro_habilitado":true,"login_habilitado":true,"tabla_clasificacion":true,"perfil_publico":true,"chat_partida":true,"replay":true}}'
  ) ON CONFLICT (nombre) DO NOTHING;

  -- Segmento real de producción: mismas features que 'tester' (nada que
  -- restringir todavía), pero es el que se asigna por defecto a los
  -- usuarios que se registran de verdad. 'tester' queda para cuentas de
  -- prueba/QA creadas a propósito con ese segmento.
  INSERT INTO segmentos (nombre, descripcion, config) VALUES (
    'jugador',
    'Segmento estándar para usuarios reales',
    '{"tema":"dark","idioma":"es","modos_juego":["clasico","rapido","torneo"],"features":{"registro_habilitado":true,"login_habilitado":true,"tabla_clasificacion":true,"perfil_publico":true,"chat_partida":true,"replay":true}}'
  ) ON CONFLICT (nombre) DO NOTHING;

  -- Segmento admin: no accede al juego, solo al Back Office. requireAdmin()
  -- en api-integracion exige payload.segmento === 'admin' en cada /admin/*.
  INSERT INTO segmentos (nombre, descripcion, config) VALUES (
    'admin',
    'Acceso al Back Office (uso interno, no jugadores)',
    '{}'
  ) ON CONFLICT (nombre) DO NOTHING;

  -- Segmento invitado: puede jugar casual/salas y usar el chat, pero no
  -- accede a ranked (bloqueado en api-integracion/src/routes/ranked.ts,
  -- auth()) ni a torneos (cuando exista esa feature, debe aplicar el mismo
  -- chequeo — ver docs/CASOS_DE_USO_TORNEOS.md).
  INSERT INTO segmentos (nombre, descripcion, config) VALUES (
    'invitado',
    'Sesión sin registro — sin acceso a ranked ni torneos',
    '{"tema":"dark","idioma":"es","modos_juego":["clasico","rapido"],"features":{"registro_habilitado":true,"login_habilitado":true,"tabla_clasificacion":true,"perfil_publico":false,"chat_partida":true,"replay":false}}'
  ) ON CONFLICT (nombre) DO NOTHING;

  CREATE TABLE IF NOT EXISTS usuarios (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(20) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT        NOT NULL,
    segmento_id   UUID        REFERENCES segmentos(id),
    avatar        VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Agrega segmento_id a tablas existentes que no lo tengan
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS segmento_id UUID REFERENCES segmentos(id);
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar VARCHAR(100);

  -- Ban reversible (Back Office, docs/CASOS_DE_USO_BACKOFFICE.md §3): un
  -- DELETE real rompería las FK de salas/ranked_historial/amigos; un flag
  -- es reversible y no rompe integridad. POST /usuarios/verificar rechaza
  -- el login si activo=false.
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

  -- Verificación de email obligatoria para poder loguear (POST
  -- /usuarios/verificar la exige). DEFAULT true para no trabar a cuentas
  -- que ya existían antes de este flag — nunca recibieron el mail, así
  -- que exigírselas ahora las dejaría afuera. El registro nuevo
  -- (POST /usuarios) inserta email_verificado=false explícito, pisando
  -- este default solo para cuentas creadas de acá en adelante.
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT true;

  -- Asigna segmento tester a usuarios sin segmento
  UPDATE usuarios
  SET segmento_id = (SELECT id FROM segmentos WHERE nombre = 'tester')
  WHERE segmento_id IS NULL;

  CREATE TABLE IF NOT EXISTS reset_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token       VARCHAR(64) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_reset_tokens_token    ON reset_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_usuario  ON reset_tokens(usuario_id);

  -- Mismo patrón que reset_tokens, para el link de confirmación de cuenta.
  CREATE TABLE IF NOT EXISTS email_verificacion_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token       VARCHAR(64) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_email_verif_token    ON email_verificacion_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_email_verif_usuario  ON email_verificacion_tokens(usuario_id);

  -- Back Office §3 "ver detalle": perfil + segmento + ELO en una sola
  -- consulta. ranked_ratings es propiedad de ms-salas (otro servicio,
  -- misma base física) — a diferencia de una VIEW, una función PL/pgSQL
  -- NO valida contra el catálogo las tablas que referencia hasta que se
  -- LLAMA (no cuando se crea). Eso evita que esta migración falle si
  -- corre antes de que ms-salas haya creado ranked_ratings todavía (el
  -- orden de arranque de los contenedores no está garantizado). Para
  -- cuando el Back Office de verdad la use, todo el stack ya está arriba.
  CREATE OR REPLACE FUNCTION usuario_completo(p_usuario_id UUID)
  RETURNS TABLE (
    id              UUID,
    username        VARCHAR,
    email           VARCHAR,
    avatar          VARCHAR,
    activo          BOOLEAN,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    segmento_id     UUID,
    segmento        VARCHAR,
    segmento_config JSONB,
    elo             INT,
    partidas        INT,
    ganadas         INT
  )
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    RETURN QUERY
    SELECT
      u.id, u.username, u.email, u.avatar, u.activo, u.created_at, u.updated_at,
      u.segmento_id, s.nombre, s.config,
      COALESCE(r.elo, 1000), COALESCE(r.partidas, 0), COALESCE(r.ganadas, 0)
    FROM usuarios u
    LEFT JOIN segmentos s       ON s.id = u.segmento_id
    LEFT JOIN ranked_ratings r  ON r.usuario_id = u.id
    WHERE u.id = p_usuario_id;
  END;
  $fn$;
`;

export async function runMigrations() {
  await pool.query(SCHEMA);
  console.log('✓ Migrations OK');
}
