import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { codigoDisponibleEn, getSalaConJugadores } from './salas';
import { abrirTablero, colocarFicha, getExtremos, puedeJugar, equipoDe } from '../game/logic';
import type { Val, Pieza, FichaTablero } from '../game/logic';

const ErrorSchema = { type: 'object', properties: { error: { type: 'string' } } } as const;
const AnySchema    = { type: 'object', additionalProperties: true } as const;

// ── Reconstruye el resultado (tipo/ganador) de la ÚLTIMA mano jugada ──
// partida_resultados guarda agregados de TODA la partida (capicuas y
// trancas acumuladas), pero el replay necesita el resultado puntual de
// la mano que cerró — se reconstruye desde el propio log de movimientos,
// con la misma lógica de tablero que ya usa logic.ts en el servidor.
export type MovimientoRow = {
  numero_mano: number; orden: number; seat: number; tipo: string;
  pieza_a: number | null; pieza_b: number | null; lado: string | null;
};

export function resultadoUltimaMano(
  movimientos: MovimientoRow[],
  equipoGanadorPartida: 0 | 1 | null,
): { tipo: 'normal' | 'capicua' | 'tranca'; ganadorSeat: number | null; equipoGanador: 0 | 1 | null } {
  if (!movimientos.length) return { tipo: 'normal', ganadorSeat: null, equipoGanador: equipoGanadorPartida };

  const ultimoNumeroMano = Math.max(...movimientos.map(m => m.numero_mano));
  const deLaMano = movimientos
    .filter(m => m.numero_mano === ultimoNumeroMano)
    .sort((a, b) => a.orden - b.orden);

  let tablero: FichaTablero[] = [];
  let ultimoJugar: MovimientoRow | null = null;

  for (const m of deLaMano) {
    if (m.tipo !== 'jugar' || m.pieza_a === null || m.pieza_b === null) continue;
    const pieza: Pieza = { a: m.pieza_a as Val, b: m.pieza_b as Val };
    if (tablero.length === 0) {
      tablero = [abrirTablero(pieza)];
    } else {
      const ext = getExtremos(tablero)!;
      const lado = (m.lado as 'izq' | 'der' | null) ?? (puedeJugar(pieza, ext).der ? 'der' : 'izq');
      const valorConectado = lado === 'der' ? ext.der : ext.izq;
      const nueva = colocarFicha(pieza, valorConectado, lado);
      tablero = lado === 'der' ? [...tablero, nueva] : [nueva, ...tablero];
    }
    ultimoJugar = m;
  }

  // Último movimiento fue un pase (o no hubo jugadas) → tranca.
  if (!ultimoJugar || deLaMano[deLaMano.length - 1].tipo === 'pasar') {
    return { tipo: 'tranca', ganadorSeat: null, equipoGanador: equipoGanadorPartida };
  }

  const ext = getExtremos(tablero)!;
  const capicua = ext.izq === ext.der;
  return {
    tipo: capicua ? 'capicua' : 'normal',
    ganadorSeat: ultimoJugar.seat,
    equipoGanador: equipoDe(ultimoJugar.seat),
  };
}

export async function historialRoutes(app: FastifyInstance) {

  // ── GET /salas/mis-partidas ──────────────────────
  // Historial propio, paginado por cursor (created_at de la última fila
  // vista) para no degradar con miles de filas — ver docs/CASOS_DE_USO_SOCIAL.md §5.5.
  app.get<{ Querystring: { usuario_id: string; cursor?: string; limit?: number } }>(
    '/salas/mis-partidas', {
      schema: {
        tags: ['salas'], summary: 'Historial de partidas propio (paginado)',
        querystring: {
          type: 'object', required: ['usuario_id'],
          properties: {
            usuario_id: { type: 'string', format: 'uuid' },
            cursor:     { type: 'string', format: 'date-time' },
            limit:      { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          },
        },
        response: { 200: { type: 'array', items: AnySchema } },
      },
    }, async (req, reply) => {
      const { usuario_id, cursor, limit = 20 } = req.query;
      const params: unknown[] = [usuario_id];
      let cursorSQL = '';
      if (cursor) { params.push(cursor); cursorSQL = `AND s.finished_at < $${params.length}`; }
      params.push(limit);

      const { rows } = await pool.query(
        `SELECT
           pr.sala_id, s.finished_at AS fecha, pr.tipo_sala, s.max_jugadores AS modo,
           pr.gano, pr.puntos_favor, pr.puntos_contra, pr.capicua,
           (pr.tranques_ganados > 0 OR pr.tranques_perdidos > 0) AS tranque,
           rh.delta AS delta_elo,
           rival.username AS rival_principal
         FROM partida_resultados pr
         JOIN salas s ON s.id = pr.sala_id
         LEFT JOIN ranked_historial rh ON rh.sala_id = pr.sala_id AND rh.usuario_id = pr.usuario_id
         LEFT JOIN LATERAL (
           SELECT sj.username FROM partida_resultados pr2
           JOIN sala_jugadores sj ON sj.sala_id = pr2.sala_id AND sj.usuario_id = pr2.usuario_id
           WHERE pr2.sala_id = pr.sala_id AND pr2.equipo <> pr.equipo
           LIMIT 1
         ) rival ON true
         WHERE pr.usuario_id = $1 ${cursorSQL}
         ORDER BY s.finished_at DESC
         LIMIT $${params.length}`,
        params,
      );
      return reply.send(rows);
    },
  );

  // ── GET /salas/:id/replay ─────────────────────────
  app.get<{ Params: { id: string } }>('/salas/:id/replay', {
    schema: {
      tags: ['salas'], summary: 'Movimientos + resultado por mano para reconstruir la partida (replay)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: { 200: AnySchema, 404: { ...ErrorSchema } },
    },
  }, async (req, reply) => {
    const { id } = req.params;

    const { rows: salaRows } = await pool.query('SELECT id FROM salas WHERE id = $1', [id]);
    if (!salaRows.length) return reply.code(404).send({ error: 'Sala no encontrada' });

    const [{ rows: jugadores }, { rows: movimientos }, { rows: puntosRows }, { rows: ganadorRows }] = await Promise.all([
      pool.query(
        'SELECT usuario_id, username FROM sala_jugadores WHERE sala_id = $1 ORDER BY posicion',
        [id],
      ),
      pool.query(
        `SELECT numero_mano, orden, seat, tipo, pieza_a, pieza_b, lado
         FROM partida_movimientos WHERE sala_id = $1 ORDER BY numero_mano, orden`,
        [id],
      ),
      // partida_puntos solo existe para partidas jugadas después de que se
      // agregó esta tabla — puede venir vacío para partidas viejas. Incluye
      // paso_a_todos: una mano puede terminar SIN cierre formal (normal/
      // capicúa/tranca) si el bono empujó el marcador al objetivo a mitad
      // de mano — el frontend elige qué mostrar (ver ReplayViewer).
      pool.query(
        `SELECT numero_mano, tipo, equipo, puntos, no_caben, marcador_0, marcador_1
         FROM partida_puntos WHERE sala_id = $1 ORDER BY numero_mano, turno`,
        [id],
      ),
      pool.query(
        'SELECT equipo FROM partida_resultados WHERE sala_id = $1 AND gano = true LIMIT 1',
        [id],
      ),
    ]);

    const equipoGanadorPartida: 0 | 1 | null = ganadorRows[0]?.equipo ?? null;

    // Partidas viejas (sin filas en partida_puntos, jugadas antes de que
    // existiera esta tabla): fallback a reconstruir solo el resultado de
    // la última mano — no hay forma de recuperar el desglose de las manos
    // anteriores para esas partidas, se perdió al no haberlo guardado en
    // su momento. `marcador: null` marca explícitamente ese dato como
    // desconocido (el frontend no debe mostrar un marcador inventado).
    const resultadoFinal = resultadoUltimaMano(movimientos, equipoGanadorPartida);
    const manos = puntosRows.length
      ? puntosRows.map(p => ({
          numeroMano: p.numero_mano,
          tipo:       p.tipo as 'normal' | 'capicua' | 'tranca',
          equipo:     p.equipo,
          puntos:     p.puntos,
          noCaben:    p.no_caben,
          marcador:   [p.marcador_0, p.marcador_1] as [number, number] | null,
        }))
      : [{
          numeroMano: movimientos.length ? Math.max(...movimientos.map(m => m.numero_mano)) : 1,
          tipo:       resultadoFinal.tipo,
          equipo:     resultadoFinal.equipoGanador,
          puntos:     0,
          noCaben:    false,
          marcador:   null,
        }];

    return reply.send({
      salaId: id,
      asientos: jugadores,
      movimientos: movimientos.map(m => ({
        numeroMano: m.numero_mano,
        orden:      m.orden,
        seat:       m.seat,
        tipo:       m.tipo,
        ...(m.pieza_a !== null && m.pieza_b !== null ? { pieza: { a: m.pieza_a, b: m.pieza_b } } : {}),
        ...(m.lado ? { lado: m.lado } : {}),
      })),
      manos,
      // Deprecado: se mantiene por compatibilidad, es el resultado de la
      // última mano nada más. Usar `manos` para el desglose completo.
      resultado: resultadoUltimaMano(movimientos, equipoGanadorPartida),
    });
  });

  // ── POST /salas/:id/revancha ──────────────────────
  // Crea una sala nueva con los mismos jugadores de la sala vieja (mismo
  // tipo/modo/max_jugadores), en estado 'esperando' — no auto-une a nadie,
  // cada quien entra por invitación (docs/CASOS_DE_USO_SOCIAL.md §7.1).
  app.post<{ Params: { id: string }; Body: { solicitante_id: string } }>(
    '/salas/:id/revancha', {
      schema: {
        tags: ['salas'], summary: 'Crear una revancha (misma gente, sala nueva)',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
        body: {
          type: 'object', required: ['solicitante_id'],
          properties: { solicitante_id: { type: 'string', format: 'uuid' } },
        },
        response: { 201: AnySchema, 400: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { id } = req.params;
      const salaVieja = await getSalaConJugadores(id);
      if (!salaVieja) return reply.code(404).send({ error: 'Sala no encontrada' });
      if (!salaVieja.jugadores.some((j: any) => j.usuario_id === req.body.solicitante_id)) {
        return reply.code(400).send({ error: 'No participaste en esa partida' });
      }

      const codigo = await codigoDisponibleEn('salas', '2M-');
      const { rows: nuevaRows } = await pool.query(
        `INSERT INTO salas (codigo, creador_id, tipo, modo, max_jugadores, estado, config)
         VALUES ($1, $2, $3, $4, $5, 'esperando', $6)
         RETURNING id`,
        [
          codigo, req.body.solicitante_id, salaVieja.tipo, salaVieja.modo, salaVieja.max_jugadores,
          JSON.stringify(typeof salaVieja.config === 'string' ? JSON.parse(salaVieja.config) : salaVieja.config),
        ],
      );
      const salaId = nuevaRows[0].id;

      // El solicitante entra automático (posición 1); el resto se invita
      // (sección 3 del doc) — el gateway dispara esas notificaciones.
      await pool.query(
        `INSERT INTO sala_jugadores (sala_id, usuario_id, username, posicion) VALUES ($1,$2,$3,1)`,
        [salaId, req.body.solicitante_id, salaVieja.jugadores.find(
          (j: any) => j.usuario_id === req.body.solicitante_id,
        )?.username ?? ''],
      );

      const otros = salaVieja.jugadores.filter((j: any) => j.usuario_id !== req.body.solicitante_id);
      const nuevaSala = await getSalaConJugadores(salaId);
      return reply.code(201).send({ sala: nuevaSala, invitar: otros });
    },
  );
}
