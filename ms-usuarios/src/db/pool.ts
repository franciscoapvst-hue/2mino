import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DB_URL,
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
`;

export async function runMigrations() {
  await pool.query(SCHEMA);
  console.log('✓ Migrations OK');
}
