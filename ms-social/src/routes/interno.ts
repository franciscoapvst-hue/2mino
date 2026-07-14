import { FastifyInstance } from 'fastify';
import { broadcastSala } from '../presencia';

// ── Rutas internas, solo llamadas por otros microservicios (nunca por el
// gateway ni el cliente) — mismo principio de "los microservicios no
// publican puertos" del resto del proyecto: esto vive detrás de la red
// Docker interna, no hay JWT que validar porque no hay usuario del otro lado.
export async function internoRoutes(app: FastifyInstance) {

  // ── POST /interno/salas/:salaId/avisar-partida ──────
  // Llamado por ms-salas (fire-and-forget) tras cada jugada/pase/mano nueva
  // /jugada de bot, para que el WS de chat de la sala (ya abierto durante
  // toda la partida, ver useSalaChat.ts) le avise al cliente que hay estado
  // nuevo para pedir — reusa el socket y el mapa de salas conectadas que ya
  // tiene el chat (docs/ESCALABILIDAD.md, "WebSocket poke + fetch").
  app.post<{ Params: { salaId: string } }>('/interno/salas/:salaId/avisar-partida', {
    schema: {
      tags:    ['system'],
      summary: 'Avisa por WS a los conectados a una sala que el estado de la partida cambió (interno, llamado por ms-salas)',
      params: {
        type: 'object',
        properties: { salaId: { type: 'string', format: 'uuid' } },
      },
      response: { 204: { type: 'null' } },
    },
  }, async (req, reply) => {
    broadcastSala(req.params.salaId, { tipo: 'partida_actualizada' });
    return reply.code(204).send();
  });
}
