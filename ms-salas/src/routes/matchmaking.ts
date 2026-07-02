import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { codigoDisponibleEn } from './salas';
import { crearPartida } from '../game/logic';
import type { Asiento } from '../game/logic';
import { ELO_INICIAL } from '../game/elo';
import { tryMatch2p, tryMatch4p, rangoPermitido } from '../game/matchmaking';
import type { Ticket } from '../game/matchmaking';

const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const AnySchema = { type: 'object', additionalProperties: true } as const;

// Partida ranked estándar: sin selector de puntos en matchmaking (a
// diferencia de las salas manuales, que sí lo eligen).
const PUNTOS_RANKED = 100;

async function getElo(usuarioId: string): Promise<number> {
  const { rows } = await pool.query('SELECT elo FROM ranked_ratings WHERE usuario_id = $1', [usuarioId]);
  return rows[0]?.elo ?? ELO_INICIAL;
}

// ── Carga los tickets vigentes de un modo como Ticket[] ─────────────
async function cargarTickets(client: import('pg').PoolClient, modo: 2 | 4): Promise<Ticket[]> {
  const { rows: colas } = await client.query(
    `SELECT id, modo, usuario_id, username, party_id, elo_referencia,
            EXTRACT(EPOCH FROM created_at) * 1000 AS creado_en
     FROM ranked_cola WHERE modo = $1`,
    [modo],
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

// ── Crea sala + partida ranked ya en juego, para un grupo de asientos ──
async function crearSalaRanked(
  client: import('pg').PoolClient,
  modo: 2 | 4,
  asientos: Asiento[],
): Promise<string> {
  const codigo = await codigoDisponibleEn('salas', '2M-');
  const { rows: salaRows } = await client.query(
    `INSERT INTO salas (codigo, creador_id, tipo, modo, max_jugadores, estado, started_at, config)
     VALUES ($1, $2, 'ranked', 'clasico', $3, 'en_juego', NOW(), $4)
     RETURNING id`,
    [codigo, asientos[0].usuario_id, modo, JSON.stringify({ puntosObjetivo: PUNTOS_RANKED })],
  );
  const salaId = salaRows[0].id;

  for (const a of asientos) {
    await client.query(
      `INSERT INTO sala_jugadores (sala_id, usuario_id, username, posicion)
       VALUES ($1, $2, $3, $4)`,
      [salaId, a.usuario_id, a.username, a.posicion],
    );
  }

  const partida = crearPartida(asientos, PUNTOS_RANKED);
  await client.query('INSERT INTO juegos (sala_id, partida) VALUES ($1, $2)', [salaId, JSON.stringify(partida)]);

  return salaId;
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

// ── Intenta emparejar el modo dado; crea la sala si hay match ───────
// Serializado con un advisory lock por modo: dos polls simultáneos no
// pueden emparejar al mismo ticket dos veces.
async function intentarEmparejar(modo: 2 | 4): Promise<{ matched: boolean; salaId?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [90000 + modo]);

    const tickets = await cargarTickets(client, modo);
    const ahora = Date.now();

    let asientos: Asiento[] | null = null;
    let idsAEliminar: string[] = [];

    if (modo === 2) {
      const m = tryMatch2p(tickets, ahora);
      if (m) {
        asientos = [
          { usuario_id: m.par[0].usuarioIds[0], username: m.par[0].usernames[0], posicion: 1 },
          { usuario_id: m.par[1].usuarioIds[0], username: m.par[1].usernames[0], posicion: 2 },
        ];
        idsAEliminar = [m.par[0].id, m.par[1].id];
      }
    } else {
      const m = tryMatch4p(tickets, ahora);
      if (m) {
        asientos = asientosDesdeEquipos(m.equipoA, m.equipoB);
        idsAEliminar = [...m.equipoA, ...m.equipoB].map(t => t.id);
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

    const salaId = await crearSalaRanked(client, modo, asientos);

    await client.query('DELETE FROM ranked_cola WHERE id = ANY($1)', [idsAEliminar]);

    if (partiesInvolucradas.length) {
      await client.query(
        `UPDATE ranked_parties SET estado = 'matched', updated_at = NOW() WHERE id = ANY($1)`,
        [partiesInvolucradas.map(p => p.party_id)],
      );
    }

    await client.query('COMMIT');
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
  return { en_cola: true, modo, es_party: esParty, espera_ms: 0, rango_actual: rangoPermitido(0) };
}

export async function matchmakingRoutes(app: FastifyInstance) {

  // ── PARTY ──────────────────────────────────────────

  app.post<{ Body: { usuario_id: string; username: string } }>('/ranked/party', {
    schema: {
      tags: ['ranked'], summary: 'Crear party (equipo por invitación, ranked 4P)',
      body: {
        type: 'object', required: ['usuario_id', 'username'],
        properties: { usuario_id: { type: 'string' }, username: { type: 'string' } },
      },
      response: { 201: AnySchema },
    },
  }, async (req, reply) => {
    const { usuario_id, username } = req.body;
    const codigo = await codigoDisponibleEn('ranked_parties', 'PT-');
    const { rows } = await pool.query(
      `INSERT INTO ranked_parties (codigo, creador_id) VALUES ($1, $2) RETURNING id, codigo, estado, creador_id`,
      [codigo, usuario_id],
    );
    await pool.query(
      'INSERT INTO ranked_party_miembros (party_id, usuario_id, username) VALUES ($1, $2, $3)',
      [rows[0].id, usuario_id, username],
    );
    return reply.code(201).send(rows[0]);
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
        await pool.query(
          'INSERT INTO ranked_party_miembros (party_id, usuario_id, username) VALUES ($1, $2, $3)',
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

      const elos = await Promise.all(miembros.map((m: any) => getElo(m.usuario_id)));
      const eloRef = Math.round((elos[0] + elos[1]) / 2);

      await pool.query(
        'INSERT INTO ranked_cola (modo, party_id, elo_referencia) VALUES (4, $1, $2)',
        [party.id, eloRef],
      );
      await pool.query(`UPDATE ranked_parties SET estado = 'en_cola', updated_at = NOW() WHERE id = $1`, [party.id]);

      const resultado = await intentarEmparejar(4);
      return reply.send(respuestaCola(resultado, 4, true));
    });

  // ── COLA (solo) ─────────────────────────────────────

  app.post<{ Body: { usuario_id: string; username: string; modo: 2 | 4 } }>('/ranked/cola/entrar', {
    schema: {
      tags: ['ranked'], summary: 'Entrar a la cola ranked (solo, sin equipo)',
      body: {
        type: 'object', required: ['usuario_id', 'username', 'modo'],
        properties: {
          usuario_id: { type: 'string' }, username: { type: 'string' },
          modo: { type: 'integer', enum: [2, 4] },
        },
      },
      response: { 200: AnySchema, 400: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const { usuario_id, username, modo } = req.body;

    const { rows: yaEnCola } = await pool.query(
      'SELECT 1 FROM ranked_cola WHERE usuario_id = $1', [usuario_id]);
    if (yaEnCola.length) return reply.code(400).send({ error: 'Ya estás en cola' });

    const elo = await getElo(usuario_id);
    await pool.query(
      'INSERT INTO ranked_cola (modo, usuario_id, username, elo_referencia) VALUES ($1, $2, $3, $4)',
      [modo, usuario_id, username, elo],
    );

    const resultado = await intentarEmparejar(modo);
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
    if (!ticket) return reply.send({ en_cola: false });

    const resultado = await intentarEmparejar(ticket.modo);
    if (resultado.matched) {
      return reply.send({ en_cola: false, matched: true, sala_id: resultado.salaId });
    }

    const esperaMs = Date.now() - new Date(ticket.created_at).getTime();
    return reply.send({
      en_cola: true,
      modo: ticket.modo,
      es_party: !!ticket.party_id,
      espera_ms: esperaMs,
      rango_actual: rangoPermitido(esperaMs),
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
