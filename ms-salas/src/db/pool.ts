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

  -- ── Historial + replay (docs/CASOS_DE_USO_SOCIAL.md §5) ───────────
  -- Log de movimientos, append-only. Una fila por jugada/pase. Permite
  -- reconstruir la partida completa para el replay.
  CREATE TABLE IF NOT EXISTS partida_movimientos (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id       UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    numero_mano   INT         NOT NULL,
    orden         INT         NOT NULL,
    seat          INT         NOT NULL,
    tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('jugar','pasar')),
    pieza_a       INT,
    pieza_b       INT,
    lado          VARCHAR(6)  CHECK (lado IN ('izq','der') OR lado IS NULL),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sala_id, numero_mano, orden)
  );
  CREATE INDEX IF NOT EXISTS idx_partida_mov_sala ON partida_movimientos(sala_id, numero_mano, orden);

  -- Resultado agregado por jugador por partida (historial propio,
  -- leaderboard de capicúas/tranques, estadísticas de perfil). Se
  -- inserta una vez, al llegar la partida a fase 'fin_partida'.
  CREATE TABLE IF NOT EXISTS partida_resultados (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id            UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    usuario_id         UUID        NOT NULL,
    equipo             INT         NOT NULL CHECK (equipo IN (0, 1)),
    gano               BOOLEAN     NOT NULL,
    tipo_sala          VARCHAR(20) NOT NULL CHECK (tipo_sala IN ('casual','ranked')),
    capicua            BOOLEAN     NOT NULL DEFAULT false,
    tranques_ganados   INT         NOT NULL DEFAULT 0,
    tranques_perdidos  INT         NOT NULL DEFAULT 0,
    puntos_favor       INT         NOT NULL,
    puntos_contra      INT         NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sala_id, usuario_id)
  );
  CREATE INDEX IF NOT EXISTS idx_partida_result_usuario ON partida_resultados(usuario_id, created_at DESC);

  -- Ledger de puntos: una fila por CADA evento que suma (o intenta sumar)
  -- puntos durante la partida — cierre de mano (normal/capicúa/tranca,
  -- incluye "no caben") y el bonus "pasó a todos". turno referencia el
  -- número corto de partida_movimientos (no su UUID) que originó el punto,
  -- para poder ubicar "en qué jugada se ganó cada punto" sin tener que
  -- recorrer el JSON de juegos. marcador_0/marcador_1 guardan el
  -- marcador YA acumulado después de este evento (evita tener que sumar
  -- todas las filas anteriores para saber el score en un punto dado).
  CREATE TABLE IF NOT EXISTS partida_puntos (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id       UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    numero_mano   INT         NOT NULL,
    turno         INT         NOT NULL,
    tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('normal','capicua','tranca','paso_a_todos')),
    equipo        INT         CHECK (equipo IN (0, 1)),  -- NULL = tranca empatada, nadie suma
    puntos        INT         NOT NULL,                  -- lo que otorga/otorgaría (ver no_caben)
    no_caben      BOOLEAN     NOT NULL DEFAULT false,     -- true: no se sumó (ver fix "no caben")
    marcador_0    INT         NOT NULL,
    marcador_1    INT         NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sala_id, turno, tipo)
  );
  CREATE INDEX IF NOT EXISTS idx_partida_puntos_sala ON partida_puntos(sala_id, numero_mano);

  -- Config editable en caliente, sin redeploy — mismo patrón clave/valor
  -- que landing_config (ms-frontend-landing). Sin columna habilitado: a
  -- diferencia de un feature flag, estas filas siempre están activas.
  CREATE TABLE IF NOT EXISTS reglas_juego (
    clave       VARCHAR(50) PRIMARY KEY,
    valor       JSONB       NOT NULL,
    descripcion TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO reglas_juego (clave, valor, descripcion) VALUES
    ('elo_inicial',        '1000',                     'ELO inicial de un jugador nuevo'),
    ('k_factor',           '32',                       'Sensibilidad del cambio de ELO por partida'),
    ('puntos_capicua',     '30',                       'Bonus por capicúa o tranca'),
    ('puntos_objetivo',    '[100,150,200]',            'Opciones de puntaje al crear una sala'),
    ('escalones_rango',    '[50,100,200,400,800]',     'Ampliación de rango ELO del matchmaking por tiempo de espera'),
    ('paso_escalon_ms',    '15000',                    'Milisegundos entre cada escalón de rango'),
    ('umbral_relleno_ms',  '15000',                    'Espera de una party antes de rellenar con jugadores solos'),
    ('tiempo_limite_jugada_ms', '{"casual":null,"ranked":null}', 'Tiempo límite por turno para jugar, según tipo de partida — null = sin límite')
  ON CONFLICT (clave) DO NOTHING;
`;

// Cambios sobre tablas que pueden ya existir de un arranque previo
// (CREATE TABLE IF NOT EXISTS no las actualiza). Cada ALTER es idempotente.
const ALTERS = `
  ALTER TABLE ranked_cola ADD COLUMN IF NOT EXISTS username VARCHAR(20);
  -- Matchmaking sirve para casual y ranked: se distinguen por tipo.
  ALTER TABLE ranked_cola    ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'ranked';
  ALTER TABLE ranked_parties ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'ranked';

  -- Número de jugada corto y legible (1, 2, 3...) para toda la partida,
  -- sin resetear por mano — a diferencia de orden (que sí resetea en
  -- cada mano) y del id (UUID largo, incómodo para referenciar "en qué
  -- jugada pasó tal cosa"). partida_puntos.turno apunta acá.
  ALTER TABLE partida_movimientos ADD COLUMN IF NOT EXISTS turno INT;

  -- Backfill para partidas que ya existían antes de este campo — no-op
  -- una vez que todas las filas ya tienen turno asignado.
  UPDATE partida_movimientos m
  SET turno = sub.turno
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY sala_id ORDER BY numero_mano, orden) AS turno
    FROM partida_movimientos
  ) sub
  WHERE m.id = sub.id AND m.turno IS NULL;

  ALTER TABLE partida_movimientos ALTER COLUMN turno SET NOT NULL;
`;

export async function runMigrations() {
  await pool.query(SCHEMA);
  await pool.query(ALTERS);
  console.log('✓ Migrations OK (ms-salas)');
}
