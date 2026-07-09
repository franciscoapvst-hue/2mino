import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { codigoDisponibleEn } from './salas';
import { crearPartida, PUNTOS_CAPICUA } from '../game/logic';
import type { Asiento, PartidaState } from '../game/logic';
import { ELO_INICIAL } from '../game/elo';
import {
  tryMatch2p, tryMatch4p, rangoPermitido, rellenoConBots,
  ESCALONES_RANGO as ESCALONES_RANGO_DEFECTO,
  PASO_MS as PASO_MS_DEFECTO,
  UMBRAL_RELLENO_MS as UMBRAL_RELLENO_MS_DEFECTO,
} from '../game/matchmaking';
import type { Ticket } from '../game/matchmaking';
import { resolverBotsEnSegundoPlano } from './juegos';
import { getRegla } from '../game/reglas';

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const AnySchema = { type: 'object', additionalProperties: true } as const;

// Matchmaking sirve casual y ranked. Partida estándar: el primer valor
// configurado en reglas_juego.puntos_objetivo, sin selector (las salas
// manuales sí lo eligen).
const PUNTOS_MM_DEFECTO = 100;

type Tipo = 'casual' | 'ranked';

async function getElo(usuarioId: string): Promise<number> {
  const { rows } = await pool.query('SELECT elo FROM ranked_ratings WHERE usuario_id = $1', [usuarioId]);
  return rows[0]?.elo ?? getRegla('elo_inicial', ELO_INICIAL);
}

// ELO de referencia para la cola. Casual empareja por orden de llegada
// (FIFO): todos con el mismo valor → el rango de ELO nunca bloquea.
async function eloRef(usuarioId: string, tipo: Tipo): Promise<number> {
  return tipo === 'casual' ? getRegla('elo_inicial', ELO_INICIAL) : getElo(usuarioId);
}

// ── Carga los tickets vigentes de un modo+tipo como Ticket[] ────────
async function cargarTickets(client: import('pg').PoolClient, modo: 2 | 4, tipo: Tipo): Promise<Ticket[]> {
  const { rows: colas } = await client.query(
    `SELECT id, modo, usuario_id, username, party_id, elo_referencia,
            EXTRACT(EPOCH FROM created_at) * 1000 AS creado_en
     FROM ranked_cola WHERE modo = $1 AND tipo = $2`,
    [modo, tipo],
  );
  const partyIds = colas.filter(c => c.party_id).map(c => c.party_id);
  const miembrosPorParty = new Map<string, { usuario_id: string; username: string }[]>();
  if (partyIds.length) {
    const { rows: miembros } = await client.query(
      'SELECT party_id, usuario_id, username FROM ranked_party_miembros WHERE party_id = ANY($1)',
      [partyIds],
    );
    for (const m of miembros) {
      const arr = miembrosPorParty.get(m.party_id) ?? [];
      arr.push({ usuario_id: m.usuario_id, username: m.username });
      miembrosPorParty.set(m.party_id, arr);
    }
  }

  return colas.map(c => {
    const miembros = c.party_id ? (miembrosPorParty.get(c.party_id) ?? []) : [{ usuario_id: c.usuario_id, username: c.username }];
    return {
      id: c.id,
      modo: c.modo as 2 | 4,
      usuarioIds: miembros.map(m => m.usuario_id),
      usernames:  miembros.map(m => m.username),
      elo: c.elo_referencia,
      creadoEn: Number(c.creado_en),
    };
  });
}

// ── Crea sala + partida ya en juego para un grupo de asientos ───────
// Si el reparto forzó a un bot a abrir con el doble más alto (o hay varios
// bots seguidos antes del primer turno humano), esos pasos NO se resuelven
// acá — se resuelven después del COMMIT (ver intentarEmparejar), de a uno
// con delay, igual que cualquier otro turno de bot en juegos.ts.
async function crearSala(
  client: import('pg').PoolClient,
  modo: 2 | 4,
  tipo: Tipo,
  asientos: Asiento[],
): Promise<{ salaId: string; juegoId: string; partidaInicial: PartidaState }> {
  const puntosMm = getRegla('puntos_objetivo', [100, 150, 200])[0] ?? PUNTOS_MM_DEFECTO;

  const codigo = await codigoDisponibleEn('salas', '2M-');
  const { rows: salaRows } = await client.query(
    `INSERT INTO salas (codigo, creador_id, tipo, modo, max_jugadores, estado, started_at, config)
     VALUES ($1, $2, $3, 'clasico', $4, 'en_juego', NOW(), $5)
     RETURNING id`,
    [codigo, asientos[0].usuario_id, tipo, modo, JSON.stringify({ puntosObjetivo: puntosMm })],
  );
  const salaId = salaRows[0].id;

  for (const a of asientos) {
    await client.query(
      `INSERT INTO sala_jugadores (sala_id, usuario_id, username, posicion)
       VALUES ($1, $2, $3, $4)`,
      [salaId, a.usuario_id, a.username, a.posicion],
    );
  }

  const partidaInicial = crearPartida(asientos, puntosMm, getRegla('puntos_capicua', PUNTOS_CAPICUA));
  const { rows: juegoRows } = await client.query(
    `INSERT INTO juegos (sala_id, partida) VALUES ($1, $2) RETURNING id`,
    [salaId, JSON.stringify(partidaInicial)],
  );

  return { salaId, juegoId: juegoRows[0].id, partidaInicial };
}

/** Asientos 1&3 = equipo del primer grupo; 2&4 = equipo del segundo (4P). */
function asientosDesdeEquipos(equipoA: Ticket[], equipoB: Ticket[]): Asiento[] {
  const miembrosA = equipoA.flatMap(t => t.usuarioIds.map((id, j) => ({ id, u: t.usernames[j] })));
  const miembrosB = equipoB.flatMap(t => t.usuarioIds.map((id, j) => ({ id, u: t.usernames[j] })));
  return [
    { usuario_id: miembrosA[0].id, username: miembrosA[0].u, posicion: 1 },
    { usuario_id: miembrosB[0].id, username: miembrosB[0].u, posicion: 2 },
    { usuario_id: miembrosA[1].id, username: miembrosA[1].u, posicion: 3 },
    { usuario_id: miembrosB[1].id, username: miembrosB[1].u, posicion: 4 },
  ];
}

// ── Intenta emparejar modo+tipo; crea la sala si hay match ──────────
// Serializado con un advisory lock por (modo,tipo): dos polls simultáneos
// no pueden emparejar al mismo ticket dos veces.
async function intentarEmparejar(modo: 2 | 4, tipo: Tipo): Promise<{ matched: boolean; salaId?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [90000 + modo * 10 + (tipo === 'casual' ? 1 : 0)]);

    const tickets = await cargarTickets(client, modo, tipo);
    const ahora = Date.now();
    const escalones = getRegla('escalones_rango', ESCALONES_RANGO_DEFECTO);
    const pasoMs = getRegla('paso_escalon_ms', PASO_MS_DEFECTO);
    const umbralRellenoMs = getRegla('umbral_relleno_ms', UMBRAL_RELLENO_MS_DEFECTO);

    let asientos: Asiento[] | null = null;
    let idsAEliminar: string[] = [];

    if (modo === 2) {
      const m = tryMatch2p(tickets, ahora, escalones, pasoMs);
      if (m) {
        asientos = [
          { usuario_id: m.par[0].usuarioIds[0], username: m.par[0].usernames[0], posicion: 1 },
          { usuario_id: m.par[1].usuarioIds[0], username: m.par[1].usernames[0], posicion: 2 },
        ];
        idsAEliminar = [m.par[0].id, m.par[1].id];
      }
    } else {
      const m = tryMatch4p(tickets, ahora, escalones, pasoMs, umbralRellenoMs);
      if (m) {
        asientos = asientosDesdeEquipos(m.equipoA, m.equipoB);
        idsAEliminar = [...m.equipoA, ...m.equipoB].map(t => t.id);
      }
    }

    // Casual: si nadie real emparejó y algún ticket ya esperó BOT_FILL_MS,
    // rellena con bots en vez de seguir esperando. El ranked nunca toca
    // esta rama (bots no deben afectar ELO).
    if (!asientos && tipo === 'casual') {
      const relleno = rellenoConBots(tickets, modo, ahora);
      if (relleno) {
        asientos = relleno.asientos;
        idsAEliminar = relleno.idsAEliminar;
      }
    }

    if (!asientos) {
      await client.query('COMMIT');
      return { matched: false };
    }

    // Party(s) involucradas: leer ANTES de borrar los tickets de cola.
    const { rows: partiesInvolucradas } = await client.query(
      'SELECT DISTINCT party_id FROM ranked_cola WHERE id = ANY($1) AND party_id IS NOT NULL',
      [idsAEliminar],
    );

    const { salaId, juegoId, partidaInicial } = await crearSala(client, modo, tipo, asientos);

    await client.query('DELETE FROM ranked_cola WHERE id = ANY($1)', [idsAEliminar]);

    if (partiesInvolucradas.length) {
      await client.query(
        `UPDATE ranked_parties SET estado = 'matched', updated_at = NOW() WHERE id = ANY($1)`,
        [partiesInvolucradas.map(p => p.party_id)],
      );
    }

    await client.query('COMMIT');
    // Recién después del commit: si no, el UPDATE de este resolver corre
    // contra una fila de `juegos` que otra conexión todavía no puede ver.
    resolverBotsEnSegundoPlano(juegoId, salaId, partidaInicial);
    return { matched: true, salaId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Da forma de ColaEstado (front) a un intento recién hecho. */
function respuestaCola(
  resultado: { matched: boolean; salaId?: string },
  modo: 2 | 4,
  esParty: boolean,
) {
  if (resultado.matched) return { en_cola: false, matched: true, sala_id: resultado.salaId };
  // El ticket se acaba de crear en esta misma llamada: espera ~0.
  const rango = rangoPermitido(0, getRegla('escalones_rango', ESCALONES_RANGO_DEFECTO), getRegla('paso_escalon_ms', PASO_MS_DEFECTO));
  return { en_cola: true, modo, es_party: esParty, espera_ms: 0, rango_actual: rango };
}

export async function matchmakingRoutes(app: FastifyInstance) {

  // ── PARTY ──────────────────────────────────────────

  app.post<{ Body: { usuario_id: string; username: string; tipo?: Tipo } }>('/ranked/party', {
    schema: {
      tags: ['ranked'], summary: 'Crear party (equipo por invitación, 4P)',
      body: {
        type: 'object', required: ['usuario_id', 'username'],
        properties: {
          usuario_id: { type: 'string' }, username: { type: 'string' },
          tipo: { type: 'string', enum: ['casual', 'ranked'] },
        },
      },
      response: { 201: AnySchema },
    },
  }, async (req, reply) => {
    const { usuario_id, username } = req.body;
    const tipo: Tipo = req.body.tipo === 'casual' ? 'casual' : 'ranked';
    const codigo = await codigoDisponibleEn('ranked_parties', 'PT-');
    const { rows } = await pool.query(
      `INSERT INTO ranked_parties (codigo, creador_id, tipo) VALUES ($1, $2, $3) RETURNING id, codigo, estado, creador_id, tipo`,
      [codigo, usuario_id, tipo],
    );
    await pool.query(
      'INSERT INTO ranked_party_miembros (party_id, usuario_id, username) VALUES ($1, $2, $3)',
      [rows[0].id, usuario_id, username],
    );
    // El frontend (Party.miembros) espera este array desde la creación
    // misma — sin él, PartyView revienta al leer `party.miembros.length`
    // apenas se crea el equipo (antes de que nadie más se una).
    return reply.code(201).send({ ...rows[0], miembros: [{ usuario_id, username }] });
  });

  app.get<{ Params: { codigo: string } }>('/ranked/party/:codigo', {
    schema: {
      tags: ['ranked'], summary: 'Estado de una party',
      params: { type: 'object', properties: { codigo: { type: 'string' } } },
      response: { 200: AnySchema, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM ranked_parties WHERE codigo = $1', [req.params.codigo]);
    if (!rows.length) return reply.code(404).send({ error: 'Party no encontrada' });
    const { rows: miembros } = await pool.query(
      'SELECT usuario_id, username FROM ranked_party_miembros WHERE party_id = $1 ORDER BY joined_at',
      [rows[0].id],
    );
    return reply.send({ ...rows[0], miembros });
  });

  app.post<{ Params: { codigo: string }; Body: { usuario_id: string; username: string } }>(
    '/ranked/party/:codigo/unirse', {
      schema: {
        tags: ['ranked'], summary: 'Unirse a una party por código',
        params: { type: 'object', properties: { codigo: { type: 'string' } } },
        body: {
          type: 'object', required: ['usuario_id', 'username'],
          properties: { usuario_id: { type: 'string' }, username: { type: 'string' } },
        },
        response: { 200: AnySchema, 400: { ...ErrorSchema }, 404: { ...ErrorSchema }, 409: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { usuario_id, username } = req.body;
      const { rows } = await pool.query('SELECT * FROM ranked_parties WHERE codigo = $1', [req.params.codigo]);
      if (!rows.length) return reply.code(404).send({ error: 'Party no encontrada' });
      const party = rows[0];
      if (party.estado !== 'esperando') return reply.code(400).send({ error: 'La party ya no acepta jugadores' });

      const { rows: miembros } = await pool.query(
        'SELECT usuario_id FROM ranked_party_miembros WHERE party_id = $1', [party.id]);
      const yaEsta = miembros.some((m: any) => m.usuario_id === usuario_id);
      if (!yaEsta) {
        if (miembros.length >= 2) return reply.code(409).send({ error: 'La party ya está completa' });
        // ON CONFLICT DO NOTHING: dos llamadas concurrentes a /unirse del
        // mismo usuario (ej. React StrictMode invocando dos veces el
        // efecto de autoJoin en dev) pasan ambas el chequeo de arriba
        // antes de que cualquiera inserte — sin esto, la segunda
        // insertion choca contra la PK (party_id, usuario_id) y tira 500.
        await pool.query(
          `INSERT INTO ranked_party_miembros (party_id, usuario_id, username)
           VALUES ($1, $2, $3) ON CONFLICT (party_id, usuario_id) DO NOTHING`,
          [party.id, usuario_id, username],
        );
      }
      const { rows: miembrosFinal } = await pool.query(
        'SELECT usuario_id, username FROM ranked_party_miembros WHERE party_id = $1 ORDER BY joined_at', [party.id]);
      return reply.send({ ...party, miembros: miembrosFinal });
    });

  app.post<{ Params: { codigo: string }; Body: { usuario_id: string } }>(
    '/ranked/party/:codigo/salir', {
      schema: {
        tags: ['ranked'], summary: 'Salir de una party',
        params: { type: 'object', properties: { codigo: { type: 'string' } } },
        body: { type: 'object', required: ['usuario_id'], properties: { usuario_id: { type: 'string' } } },
        response: { 200: AnySchema, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { rows } = await pool.query('SELECT * FROM ranked_parties WHERE codigo = $1', [req.params.codigo]);
      if (!rows.length) return reply.code(404).send({ error: 'Party no encontrada' });
      const party = rows[0];

      await pool.query('DELETE FROM ranked_cola WHERE party_id = $1', [party.id]);
      await pool.query(
        'DELETE FROM ranked_party_miembros WHERE party_id = $1 AND usuario_id = $2',
        [party.id, req.body.usuario_id],
      );
      const { rows: restantes } = await pool.query(
        'SELECT usuario_id FROM ranked_party_miembros WHERE party_id = $1', [party.id]);
      if (!restantes.length) {
        await pool.query(`UPDATE ranked_parties SET estado = 'cancelada', updated_at = NOW() WHERE id = $1`, [party.id]);
      } else {
        await pool.query(`UPDATE ranked_parties SET estado = 'esperando', updated_at = NOW() WHERE id = $1`, [party.id]);
      }
      return reply.send({ ok: true });
    });

  app.post<{ Params: { codigo: string }; Body: { usuario_id: string } }>(
    '/ranked/party/:codigo/cola', {
      schema: {
        tags: ['ranked'], summary: 'Meter la party (2/2) a la cola ranked 4P',
        params: { type: 'object', properties: { codigo: { type: 'string' } } },
        body: { type: 'object', required: ['usuario_id'], properties: { usuario_id: { type: 'string' } } },
        response: { 200: AnySchema, 400: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { rows } = await pool.query('SELECT * FROM ranked_parties WHERE codigo = $1', [req.params.codigo]);
      if (!rows.length) return reply.code(404).send({ error: 'Party no encontrada' });
      const party = rows[0];
      if (party.estado === 'en_cola') return reply.code(400).send({ error: 'La party ya está en cola' });
      if (party.estado !== 'esperando') return reply.code(400).send({ error: 'La party no está disponible' });

      const { rows: miembros } = await pool.query(
        'SELECT usuario_id FROM ranked_party_miembros WHERE party_id = $1', [party.id]);
      if (miembros.length !== 2) return reply.code(400).send({ error: 'La party necesita 2 jugadores para buscar partida' });

      const tipo: Tipo = party.tipo === 'casual' ? 'casual' : 'ranked';
      const refs = await Promise.all(miembros.map((m: any) => eloRef(m.usuario_id, tipo)));
      const ref = Math.round((refs[0] + refs[1]) / 2);

      await pool.query(
        'INSERT INTO ranked_cola (modo, tipo, party_id, elo_referencia) VALUES (4, $1, $2, $3)',
        [tipo, party.id, ref],
      );
      await pool.query(`UPDATE ranked_parties SET estado = 'en_cola', updated_at = NOW() WHERE id = $1`, [party.id]);

      const resultado = await intentarEmparejar(4, tipo);
      return reply.send(respuestaCola(resultado, 4, true));
    });

  // ── COLA (solo) ─────────────────────────────────────

  app.post<{ Body: { usuario_id: string; username: string; modo: 2 | 4; tipo?: Tipo } }>('/ranked/cola/entrar', {
    schema: {
      tags: ['ranked'], summary: 'Entrar a la cola (solo, sin equipo)',
      body: {
        type: 'object', required: ['usuario_id', 'username', 'modo'],
        properties: {
          usuario_id: { type: 'string' }, username: { type: 'string' },
          modo: { type: 'integer', enum: [2, 4] },
          tipo: { type: 'string', enum: ['casual', 'ranked'] },
        },
      },
      response: { 200: AnySchema, 400: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const { usuario_id, username, modo } = req.body;
    const tipo: Tipo = req.body.tipo === 'casual' ? 'casual' : 'ranked';

    // Ojo: los tickets de party NO llevan usuario_id (van por party_id, ver
    // crearSala/cargarTickets) — un chequeo que solo mirara usuario_id no
    // detecta que este jugador ya está en cola vía su equipo, y dejaría
    // crear un segundo ticket (solo) en paralelo al de la party.
    const { rows: yaEnCola } = await pool.query(
      `SELECT 1 FROM ranked_cola c
       WHERE c.usuario_id = $1
          OR c.party_id IN (SELECT party_id FROM ranked_party_miembros WHERE usuario_id = $1)`,
      [usuario_id],
    );
    if (yaEnCola.length) return reply.code(400).send({ error: 'Ya estás en cola' });

    const ref = await eloRef(usuario_id, tipo);
    await pool.query(
      'INSERT INTO ranked_cola (modo, tipo, usuario_id, username, elo_referencia) VALUES ($1, $2, $3, $4, $5)',
      [modo, tipo, usuario_id, username, ref],
    );

    const resultado = await intentarEmparejar(modo, tipo);
    return reply.send(respuestaCola(resultado, modo, false));
  });

  app.get<{ Querystring: { usuario_id: string } }>('/ranked/cola/estado', {
    schema: {
      tags: ['ranked'], summary: 'Estado de mi cola (dispara un intento de emparejar)',
      querystring: { type: 'object', required: ['usuario_id'], properties: { usuario_id: { type: 'string' } } },
      response: { 200: AnySchema },
    },
  }, async (req, reply) => {
    const { usuario_id } = req.query;

    // ¿Ticket propio (solo)?
    const { rows: soloRows } = await pool.query(
      'SELECT * FROM ranked_cola WHERE usuario_id = $1', [usuario_id]);

    // ¿Miembro de una party con ticket en cola?
    const { rows: partyRows } = await pool.query(
      `SELECT c.* FROM ranked_cola c
       JOIN ranked_party_miembros m ON m.party_id = c.party_id
       WHERE m.usuario_id = $1`,
      [usuario_id],
    );

    const ticket = soloRows[0] ?? partyRows[0];
    if (!ticket) {
      // Sin ticket puede significar dos cosas muy distintas:
      //  (a) el usuario canceló / nunca entró, o
      //  (b) OTRO jugador disparó el match y consumió este ticket — este
      //      usuario fue emparejado pero aún no lo sabe.
      // Distinguimos (b) buscando una sala recién iniciada por matchmaking
      // donde este usuario ya es jugador. Sin esto, quien no dispara el
      // match se va al menú por error ("saca a uno de los dos").
      const { rows: salaReciente } = await pool.query(
        `SELECT s.id FROM salas s
         JOIN sala_jugadores sj ON sj.sala_id = s.id
         WHERE sj.usuario_id = $1 AND s.estado = 'en_juego'
           AND s.started_at > NOW() - INTERVAL '60 seconds'
         ORDER BY s.started_at DESC LIMIT 1`,
        [usuario_id],
      );
      if (salaReciente.length) {
        return reply.send({ en_cola: false, matched: true, sala_id: salaReciente[0].id });
      }
      return reply.send({ en_cola: false });
    }

    const resultado = await intentarEmparejar(ticket.modo, ticket.tipo);
    if (resultado.matched) {
      return reply.send({ en_cola: false, matched: true, sala_id: resultado.salaId });
    }

    const esperaMs = Date.now() - new Date(ticket.created_at).getTime();
    return reply.send({
      en_cola: true,
      modo: ticket.modo,
      es_party: !!ticket.party_id,
      espera_ms: esperaMs,
      rango_actual: rangoPermitido(esperaMs, getRegla('escalones_rango', ESCALONES_RANGO_DEFECTO), getRegla('paso_escalon_ms', PASO_MS_DEFECTO)),
    });
  });

  app.post<{ Body: { usuario_id: string } }>('/ranked/cola/salir', {
    schema: {
      tags: ['ranked'], summary: 'Cancelar búsqueda (solo o party)',
      body: { type: 'object', required: ['usuario_id'], properties: { usuario_id: { type: 'string' } } },
      response: { 200: AnySchema },
    },
  }, async (req, reply) => {
    const { usuario_id } = req.body;
    const { rowCount } = await pool.query('DELETE FROM ranked_cola WHERE usuario_id = $1', [usuario_id]);
    if (!rowCount) {
      const { rows } = await pool.query(
        `DELETE FROM ranked_cola c USING ranked_party_miembros m
         WHERE m.party_id = c.party_id AND m.usuario_id = $1
         RETURNING c.party_id`,
        [usuario_id],
      );
      if (rows.length) {
        await pool.query(`UPDATE ranked_parties SET estado = 'esperando', updated_at = NOW() WHERE id = $1`, [rows[0].party_id]);
      }
    }
    return reply.send({ ok: true });
  });
}
