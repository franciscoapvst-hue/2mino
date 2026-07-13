import { Pool } from 'pg';

// max explícito — ver ms-salas/src/db/pool.ts para el motivo.
export const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 15,
});

// docs/CASOS_DE_USO_SOCIAL.md §2.1/§8.1 — mismas convenciones que el
// resto del proyecto: CREATE TABLE IF NOT EXISTS + bloque ALTERS aparte.
const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Relación de amistad. Simétrica: una fila cubre ambos sentidos
  -- (se consulta con usuario_id_a = $1 OR usuario_id_b = $1). Se
  -- normaliza el orden (menor UUID primero) para no duplicar A-B / B-A.
  CREATE TABLE IF NOT EXISTS amigos (
    usuario_id_a  UUID        NOT NULL,
    usuario_id_b  UUID        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id_a, usuario_id_b),
    CHECK (usuario_id_a < usuario_id_b)
  );
  CREATE INDEX IF NOT EXISTS idx_amigos_b ON amigos(usuario_id_b);

  -- Solicitudes de amistad pendientes/resueltas.
  CREATE TABLE IF NOT EXISTS solicitudes_amistad (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    de_usuario_id UUID        NOT NULL,
    a_usuario_id  UUID        NOT NULL,
    estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelta_at   TIMESTAMPTZ,
    UNIQUE (de_usuario_id, a_usuario_id)
  );
  CREATE INDEX IF NOT EXISTS idx_solicitud_destino ON solicitudes_amistad(a_usuario_id, estado);

  -- Bandeja de entrada unificada: solicitudes de amistad, amistad
  -- aceptada, invitaciones a partida. Una fila por notificación.
  CREATE TABLE IF NOT EXISTS notificaciones (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    UUID        NOT NULL,
    tipo          VARCHAR(30) NOT NULL
                  CHECK (tipo IN ('solicitud_amistad','amistad_aceptada','invitacion_partida')),
    de_usuario_id UUID        NOT NULL,
    de_username   VARCHAR(20) NOT NULL,
    de_avatar     VARCHAR(100),
    payload       JSONB       NOT NULL DEFAULT '{}',
    leida         BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(usuario_id, leida, created_at DESC);

  -- Mensajes de chat por sala. sala_id es referencia LÓGICA a salas de
  -- ms-salas (microservicios distintos, sin FK física ni DB compartida) —
  -- se valida por HTTP (GET /salas/:id), no con una constraint.
  CREATE TABLE IF NOT EXISTS chat_mensajes (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_id     UUID         NOT NULL,
    usuario_id  UUID         NOT NULL,
    username    VARCHAR(20)  NOT NULL,
    mensaje     VARCHAR(280) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_chat_sala ON chat_mensajes(sala_id, created_at);
`;

const ALTERS = ``;

export async function runMigrations() {
  await pool.query(SCHEMA);
  if (ALTERS.trim()) await pool.query(ALTERS);
  console.log('✓ Migrations OK (ms-social)');
}
