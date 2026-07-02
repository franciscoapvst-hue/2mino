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

  -- Partida en curso de una sala.
  -- El estado completo (manos, tablero, turno...) se guarda como UN solo
  -- registro de texto (JSON serializado) en vez de una fila por jugada,
  -- ya que es una partida temporal que se sobreescribe en cada movimiento.
  CREATE TABLE IF NOT EXISTS juegos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id     UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    estado      VARCHAR(20) NOT NULL DEFAULT 'jugando'
                CHECK (estado IN ('jugando','terminado')),
    partida     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_juegos_sala_id ON juegos(sala_id);

  -- ── Ranked / ELO ─────────────────────────────────────────────────
  -- Rating vigente por usuario. Lo escribe SOLO ms-salas al terminar
  -- una partida ranked. username desnormalizado para el leaderboard.
  CREATE TABLE IF NOT EXISTS ranked_ratings (
    usuario_id  UUID        PRIMARY KEY,
    username    VARCHAR(20) NOT NULL,
    elo         INT         NOT NULL DEFAULT 1000,
    partidas    INT         NOT NULL DEFAULT 0,
    ganadas     INT         NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Historial: una fila por jugador por partida ranked (progreso/auditoría).
  -- UNIQUE(usuario_id, sala_id) hace idempotente la aplicación del ELO.
  CREATE TABLE IF NOT EXISTS ranked_historial (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID        NOT NULL,
    sala_id      UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    elo_antes    INT         NOT NULL,
    elo_despues  INT         NOT NULL,
    delta        INT         NOT NULL,
    gano         BOOLEAN     NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, sala_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ranked_hist_usuario ON ranked_historial(usuario_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ranked_ratings_elo  ON ranked_ratings(elo DESC);

  -- ── Matchmaking ranked ───────────────────────────────────────────
  -- Party: pareja que quiere entrar junta a la cola 2v2 (mismo equipo).
  -- Tamaño fijo 2; solo aplica a ranked 4P.
  CREATE TABLE IF NOT EXISTS ranked_parties (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(8)  UNIQUE NOT NULL,
    creador_id  UUID        NOT NULL,
    estado      VARCHAR(20) NOT NULL DEFAULT 'esperando'
                CHECK (estado IN ('esperando','en_cola','matched','cancelada')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ranked_party_miembros (
    party_id    UUID        NOT NULL REFERENCES ranked_parties(id) ON DELETE CASCADE,
    usuario_id  UUID        NOT NULL,
    username    VARCHAR(20) NOT NULL,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (party_id, usuario_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ranked_party_codigo ON ranked_parties(codigo);

  -- Cola de emparejamiento. Un ticket es SOLO (un usuario) o de PARTY
  -- (party_id set, los miembros salen de ranked_party_miembros).
  -- elo_referencia = elo propio (solo) o promedio de la pareja (party).
  CREATE TABLE IF NOT EXISTS ranked_cola (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    modo            INT         NOT NULL CHECK (modo IN (2, 4)),
    usuario_id      UUID,                 -- set si es ticket solo
    username        VARCHAR(20),          -- idem, solo para ticket solo
    party_id        UUID        REFERENCES ranked_parties(id) ON DELETE CASCADE,
    elo_referencia  INT         NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((usuario_id IS NOT NULL) <> (party_id IS NOT NULL)) -- exactamente uno
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_ranked_cola_usuario
    ON ranked_cola(usuario_id) WHERE usuario_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_ranked_cola_party
    ON ranked_cola(party_id) WHERE party_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_ranked_cola_modo ON ranked_cola(modo, created_at);
`;

// Cambios sobre tablas que pueden ya existir de un arranque previo
// (CREATE TABLE IF NOT EXISTS no las actualiza). Cada ALTER es idempotente.
const ALTERS = `
  ALTER TABLE ranked_cola ADD COLUMN IF NOT EXISTS username VARCHAR(20);
`;

export async function runMigrations() {
  await pool.query(SCHEMA);
  await pool.query(ALTERS);
  console.log('✓ Migrations OK (ms-salas)');
}
