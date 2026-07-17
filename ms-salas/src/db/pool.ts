import { Pool } from 'pg';

// max explícito: sin esto, pg usa 10 por defecto y los 4 servicios juntos
// (cada uno con su propio pool) ya reservaban ~40 de los 100 connections
// que trae Postgres por defecto, en reposo. Ver max_connections en
// docker-compose.yml (subido a 200 para dar margen).
export const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 15,
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
    ('tiempo_limite_jugada_ms', '{"casual":null,"ranked":null}', 'Tiempo límite por turno para jugar, según tipo de partida — null = sin límite'),
    ('delay_fin_mano_ms',  '2000',                     'Espera (ms) antes de mostrar la pantalla de fin de mano, para ver el tablero final un momento antes')
  ON CONFLICT (clave) DO NOTHING;

  -- ── Torneos (docs/PLAN_TORNEOS.md §2, sobre CASOS_DE_USO_BACKOFFICE §7.2) ──
  -- Config completa definida por el admin ANTES de abrir inscripción, para
  -- que el bracket se genere determinístico al iniciar.
  --
  -- Nota vs. el schema del doc: un solo campo estado (con 'borrador' como
  -- primer valor) en vez de estado + estado_wizard por separado — dos
  -- columnas de estado solapadas eran fuente segura de inconsistencia
  -- (¿qué significa estado_wizard='borrador' + estado='eliminatoria'?).
  -- Misma información, una sola fuente de verdad.
  CREATE TABLE IF NOT EXISTS torneos (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                  VARCHAR(80) NOT NULL,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador','inscripcion','fase_inicial','eliminatoria','finalizado','cancelado')),
    modo                    VARCHAR(20) NOT NULL DEFAULT 'clasico'
                            CHECK (modo IN ('clasico','rapido')),
    max_jugadores           INT         NOT NULL DEFAULT 4 CHECK (max_jugadores = 4), -- siempre 2 equipos de 2; un torneo nunca es 1v1
    max_equipos             INT         NOT NULL CHECK (max_equipos >= 2),
    puntos_objetivo         INT         NOT NULL DEFAULT 100,  -- puntaje default de cada partida (las fases pueden sobrescribirlo)
    tiene_fase_inicial      BOOLEAN     NOT NULL DEFAULT true,
    puntos_clasificacion    INT,                               -- puntos acumulados para clasificar en fase inicial (NULL si no hay fase inicial)
    num_fases_eliminatorias INT         NOT NULL DEFAULT 1 CHECK (num_fases_eliminatorias >= 1),
    visibilidad             VARCHAR(10) NOT NULL DEFAULT 'publico'
                            CHECK (visibilidad IN ('publico','privado')),
    codigo_invitacion       VARCHAR(10),                       -- solo si visibilidad='privado'
    elo_min                 INT,                               -- targeting opcional (NULL = sin límite)
    elo_max                 INT,
    fecha_inicio            TIMESTAMPTZ NOT NULL,              -- rango general publicado (informativo)
    fecha_fin               TIMESTAMPTZ NOT NULL,
    -- Cuota de inscripción: PayPal no soporta DOP, la moneda real de cobro
    -- es USD (docs/PLAN_TORNEOS.md §0/§5); el RD$ que ve el jugador es
    -- solo un equivalente visual.
    cuota_monto             INT         NOT NULL DEFAULT 0 CHECK (cuota_monto >= 0), -- centavos USD; 0 = gratis
    moneda                  VARCHAR(3)  NOT NULL DEFAULT 'USD',
    politica_reembolso      TEXT,                              -- se muestra ANTES de pagar
    reglas_override         JSONB       NOT NULL DEFAULT '{}', -- solo las claves cambiadas vs. reglas_juego globales
    avance_automatico       BOOLEAN     NOT NULL DEFAULT false,
    info_html               TEXT,                              -- contenido de marketing del detalle (se sanitiza al renderizar)
    reglamento_pdf_url      TEXT,                              -- documento formal/legal (distinto de info_html)
    reglamento_pdf_nombre   VARCHAR(120),
    creado_por              UUID        NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inicia_at               TIMESTAMPTZ,                       -- momento REAL de iniciar (puede diferir de fecha_inicio)
    finalizado_at           TIMESTAMPTZ,
    CHECK (fecha_fin > fecha_inicio),
    CHECK (elo_min IS NULL OR elo_max IS NULL OR elo_max >= elo_min)
  );
  CREATE INDEX IF NOT EXISTS idx_torneos_estado ON torneos(estado);

  -- Fases del torneo. Se insertan al CREAR/EDITAR el wizard (no al iniciar):
  -- el paso 5 define la ventana propia de cada fase y esas validaciones
  -- cruzan filas — tenerlas como filas desde el borrador simplifica editar.
  -- clasifican_n generaliza el "clasifican_por_grupo" del doc §7.2 a un N
  -- por transición (PLAN §2): cuántos pasan AL CERRAR esta fase (NULL en
  -- la final). metrica solo aplica a tipo='inicial' (en eliminatorias pasa
  -- el ganador de cada cruce).
  CREATE TABLE IF NOT EXISTS torneo_fases (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id         UUID        NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    tipo              VARCHAR(20) NOT NULL CHECK (tipo IN ('inicial','eliminatoria')),
    orden             INT         NOT NULL,           -- 0 = fase inicial (si existe), 1..N = eliminatorias
    nombre            VARCHAR(40) NOT NULL,           -- 'Fase de grupos' / 'Cuartos de final' / 'Semifinal' / 'Final'
    puntos_objetivo   INT         NOT NULL,
    ventana_inicio    TIMESTAMPTZ NOT NULL,
    ventana_fin       TIMESTAMPTZ NOT NULL,
    clasifican_n      INT,
    metrica           VARCHAR(20) NOT NULL DEFAULT 'puntos'
                      CHECK (metrica IN ('puntos','elo_torneo','victorias')),
    requiere_atencion BOOLEAN     NOT NULL DEFAULT false, -- ventana vencida con partidas pendientes / empate en el corte
    estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','en_curso','finalizada')),
    UNIQUE (torneo_id, orden),
    CHECK (ventana_fin > ventana_inicio)
  );
  CREATE INDEX IF NOT EXISTS idx_torneo_fases_torneo ON torneo_fases(torneo_id, orden);

  -- Unidad de inscripción y estadística: SIEMPRE una pareja. Inscripción
  -- en dos pasos: jugador1 crea el equipo y comparte codigo_equipo;
  -- jugador2 se une con él. Con cuota>0 arranca en 'pendiente_pago';
  -- gratis salta directo a 'pendiente_companero'.
  CREATE TABLE IF NOT EXISTS torneo_equipos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id         UUID        NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    nombre            VARCHAR(40),                    -- opcional; si falta se muestra "user1 & user2"
    estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente_companero'
                      CHECK (estado IN ('pendiente_pago','pendiente_companero','completo','eliminado','campeon')),
    codigo_equipo     VARCHAR(10) NOT NULL UNIQUE,
    jugador1_id       UUID        NOT NULL,
    jugador1_username VARCHAR(20) NOT NULL,
    jugador2_id       UUID,                           -- NULL mientras falta el compañero
    jugador2_username VARCHAR(20),
    inscrito_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completado_at     TIMESTAMPTZ,
    eliminado_en      UUID        REFERENCES torneo_fases(id), -- fase en la que cayó (NULL en carrera)
    -- Estadísticas del torneo (aparte del ELO global de ranked — ver doc §7.2):
    elo_torneo        INT         NOT NULL DEFAULT 1000,
    puntos            INT         NOT NULL DEFAULT 0,
    victorias         INT         NOT NULL DEFAULT 0,
    derrotas          INT         NOT NULL DEFAULT 0,
    capicuas          INT         NOT NULL DEFAULT 0,
    tranques          INT         NOT NULL DEFAULT 0,
    UNIQUE (torneo_id, jugador1_id),
    UNIQUE (torneo_id, jugador2_id),  -- múltiples NULL permitidos: no bloquea equipos pendientes
    CHECK (jugador1_id <> jugador2_id)
  );
  CREATE INDEX IF NOT EXISTS idx_torneo_equipos_torneo ON torneo_equipos(torneo_id);

  -- Registro por partida jugada — trazabilidad (el replay vive en la sala).
  CREATE TABLE IF NOT EXISTS torneo_partidas (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id         UUID        NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    fase_id           UUID        NOT NULL REFERENCES torneo_fases(id) ON DELETE CASCADE,
    sala_id           UUID        REFERENCES salas(id) ON DELETE SET NULL, -- NULL hasta que el motor crea la sala (el bracket es visible antes)
    ronda             INT         NOT NULL DEFAULT 1,
    equipo1_id        UUID        NOT NULL REFERENCES torneo_equipos(id),
    equipo2_id        UUID        NOT NULL REFERENCES torneo_equipos(id),
    fecha_programada  TIMESTAMPTZ,                    -- horario puntual (solo eliminatorias)
    ganador_equipo_id UUID        REFERENCES torneo_equipos(id),
    puntos_equipo1    INT         NOT NULL DEFAULT 0,
    puntos_equipo2    INT         NOT NULL DEFAULT 0,
    hubo_capicua      BOOLEAN     NOT NULL DEFAULT false,
    hubo_tranque      BOOLEAN     NOT NULL DEFAULT false,
    walkover          BOOLEAN     NOT NULL DEFAULT false, -- resuelta por el admin al forzar cierre de fase, no jugada
    jugada_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (equipo1_id <> equipo2_id)
  );
  CREATE INDEX IF NOT EXISTS idx_torneo_partidas_torneo ON torneo_partidas(torneo_id, fase_id);

  -- Campos del formulario de inscripción, definidos por el admin (Paso 7).
  CREATE TABLE IF NOT EXISTS torneo_campos_inscripcion (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id  UUID        NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    etiqueta   VARCHAR(60) NOT NULL,
    tipo       VARCHAR(10) NOT NULL DEFAULT 'texto'
               CHECK (tipo IN ('texto','numero','telefono','email')),
    requerido  BOOLEAN     NOT NULL DEFAULT true,
    orden      INT         NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_torneo_campos_torneo ON torneo_campos_inscripcion(torneo_id, orden);

  -- Respuestas de cada jugador al formulario (cada uno llena LO SUYO — por
  -- eso jugador_id en la PK, no solo el equipo).
  CREATE TABLE IF NOT EXISTS torneo_inscripcion_datos (
    equipo_id  UUID        NOT NULL REFERENCES torneo_equipos(id) ON DELETE CASCADE,
    campo_id   UUID        NOT NULL REFERENCES torneo_campos_inscripcion(id) ON DELETE CASCADE,
    jugador_id UUID        NOT NULL,
    valor      TEXT        NOT NULL,
    PRIMARY KEY (equipo_id, campo_id, jugador_id)
  );

  -- Pagos PayPal — una fila por INTENTO (reintento = fila nueva, Order nuevo).
  -- paypal_capture_id aparte del order_id: el refund va sobre la captura.
  CREATE TABLE IF NOT EXISTS torneo_pagos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id         UUID        NOT NULL REFERENCES torneos(id),
    equipo_id         UUID        NOT NULL REFERENCES torneo_equipos(id),
    paypal_order_id   VARCHAR(30) UNIQUE NOT NULL,
    monto             INT         NOT NULL,            -- centavos USD
    moneda            VARCHAR(3)  NOT NULL DEFAULT 'USD',
    estado            VARCHAR(20) NOT NULL DEFAULT 'iniciado'
                      CHECK (estado IN ('iniciado','aprobado','declinado','cancelado','expirado','reembolsado')),
    paypal_capture_id VARCHAR(30),
    paypal_respuesta  JSONB,
    reembolso_motivo  TEXT,
    reembolso_at      TIMESTAMPTZ,
    reembolso_por     UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_at       TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_torneo_pagos_equipo ON torneo_pagos(equipo_id);

  -- Registro de emails de torneo — dedupe + auditoría: un INSERT que
  -- conflictúa = ya se mandó, no repetir.
  CREATE TABLE IF NOT EXISTS torneo_emails (
    torneo_id  UUID        NOT NULL,
    tipo       VARCHAR(30) NOT NULL,
    ref        VARCHAR(60) NOT NULL,   -- equipo_id / partida_id / fase_id según tipo
    enviado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (torneo_id, tipo, ref)
  );
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
