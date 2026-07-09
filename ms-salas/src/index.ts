import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { runMigrations } from './db/pool';
import { salasRoutes } from './routes/salas';
import { juegosRoutes } from './routes/juegos';
import { rankedRoutes } from './routes/ranked';
import { matchmakingRoutes } from './routes/matchmaking';
import { historialRoutes } from './routes/historial';
import { reglasRoutes } from './routes/reglas';
import { cargarReglas } from './game/reglas';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { strict: false } },
});

app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       '2mino — ms-salas',
      description: 'Gestión de salas de juego: creación, listado, unirse y salir.',
      version:     '1.0.0',
    },
    tags: [
      { name: 'salas',  description: 'Operaciones sobre salas de juego' },
      { name: 'juego',  description: 'Estado y movimientos de la partida' },
      { name: 'ranked', description: 'ELO y clasificación' },
    ],
  },
});

app.register(swaggerUi, { routePrefix: '/docs' });

app.register(salasRoutes);
app.register(juegosRoutes);
app.register(rankedRoutes);
app.register(matchmakingRoutes);
app.register(historialRoutes);
app.register(reglasRoutes);

app.get('/health', {
  schema: {
    tags: ['system'],
    response: {
      200: {
        type: 'object',
        properties: { service: { type: 'string' }, status: { type: 'string' } },
      },
    },
  },
}, async () => ({ service: 'ms-salas', status: 'ok' }));

async function start() {
  try {
    await runMigrations();
    await cargarReglas();
    const port = Number(process.env.PORT) || 6001;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Swagger UI → http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
