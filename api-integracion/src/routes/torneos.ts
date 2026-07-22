import { FastifyInstance } from 'fastify';
import { callSalas } from '../http';
import { verifyToken } from '../jwt';

const AnySchema = { type: 'object', additionalProperties: true } as const;

// Público (autenticado) — a diferencia de /admin/torneos/* (admin.ts,
// requireAdmin), esto lo puede pedir cualquier jugador logueado. Por ahora
// un solo endpoint (docs/PLAN_ESCRITORIO.md, Etapa 4); el resto del flujo
// de torneos del jugador (listado/detalle/inscripción) todavía es mock en
// el frontend — ver src/torneos/mockData.ts.
export async function torneosGatewayRoutes(app: FastifyInstance) {
  app.get('/torneos/proximo', {
    schema: {
      tags: ['torneos'], summary: 'Próximo torneo público abierto a inscripción (o null)',
      security: [{ bearerAuth: [] }],
      response: { 200: AnySchema, 401: { type: 'object', properties: { error: { type: 'string' } } } },
    },
  }, async (req, reply) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) { reply.code(401).send({ error: 'Token requerido' }); return; }
    const { status, data } = await callSalas('/torneos/proximo', 'GET');
    return reply.code(status).send(data);
  });
}
