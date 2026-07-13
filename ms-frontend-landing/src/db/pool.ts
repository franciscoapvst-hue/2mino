import { Pool } from 'pg';

// max explícito — ver ms-salas/src/db/pool.ts para el motivo.
export const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 15,
});

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Solo guarda lo que el usuario cambió respecto a su segmento
  DROP TABLE IF EXISTS frontend;

  CREATE TABLE IF NOT EXISTS frontend_overrides (
    usuario_id  UUID        PRIMARY KEY,
    tema        VARCHAR(10) CHECK (tema IN ('dark', 'light')),
    idioma      VARCHAR(5),
    opciones    JSONB       NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Configuración global del landing (clave-valor)
  CREATE TABLE IF NOT EXISTS landing_config (
    clave       VARCHAR(100) PRIMARY KEY,
    valor       JSONB        NOT NULL,
    descripcion TEXT,
    habilitado  BOOLEAN      NOT NULL DEFAULT true,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- Valores por defecto del landing
  INSERT INTO landing_config (clave, valor, descripcion) VALUES
    ('registro_habilitado',  'true',                                          'Permite el registro de nuevos usuarios'),
    ('login_habilitado',     'true',                                          'Permite iniciar sesión'),
    ('modos_juego',          '["clasico","rapido"]',                          'Modos de juego visibles en el landing'),
    ('tema_default',         '"dark"',                                        'Tema visual por defecto para nuevos usuarios'),
    ('idiomas_disponibles',  '["es","en"]',                                   'Idiomas disponibles en la app'),
    ('secciones_landing',    '["hero","caracteristicas","como_jugar","tabla_clasificacion"]',
                                                                              'Secciones del landing habilitadas')
  ON CONFLICT (clave) DO NOTHING;
`;

export async function runMigrations() {
  await pool.query(SCHEMA);
  console.log('✓ Migrations OK (ms-frontend-landing)');
}
