import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Salas de juego (activas e inactivas)
  CREATE TABLE IF NOT EXISTS salas (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          VARCHAR(8)  UNIQUE NOT NULL,
    nombre          VARCHAR(60),
    creador_id      UUID        NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'esperando'
                    CHECK (estado IN ('esperando','en_juego','finalizada','cancelada')),
    tipo            VARCHAR(20) NOT NULL DEFAULT 'casual'
                    CHECK (tipo IN ('casual','ranked')),
    modo            VARCHAR(20) NOT NULL DEFAULT 'clasico'
                    CHECK (modo IN ('clasico','rapido','torneo')),
    max_jugadores   INT         NOT NULL DEFAULT 4 CHECK (max_jugadores IN (2, 4)),
    privada         BOOLEAN     NOT NULL DEFAULT false,
    contrasena_hash TEXT,
    config          JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
  );

  -- Jugadores dentro de una sala
  CREATE TABLE IF NOT EXISTS sala_jugadores (
    sala_id     UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    usuario_id  UUID        NOT NULL,
    username    VARCHAR(20) NOT NULL,
    posicion    INT         NOT NULL CHECK (posicion BETWEEN 1 AND 4),
    equipo      INT         CHECK (equipo IN (1, 2)),
    listo       BOOLEAN     NOT NULL DEFAULT false,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sala_id, usuario_id)
  );

  CREATE INDEX IF NOT EXISTS idx_salas_estado   ON salas(estado);
  CREATE INDEX IF NOT EXISTS idx_salas_codigo   ON salas(codigo);
  CREATE INDEX IF NOT EXISTS idx_salas_creador  ON salas(creador_id);
  CREATE INDEX IF NOT EXISTS idx_sala_jug_sala  ON sala_jugadores(sala_id);
`;

export async function runMigrations() {
  await pool.query(SCHEMA);
  console.log('✓ Migrations OK (ms-salas)');
}
