import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { runMigrations } from './db/pool';
import { amigosRoutes } from './routes/amigos';
import { notificacionesRoutes } from './routes/notificaciones';
import { chatRoutes } from './routes/chat';
import { wsRoutes } from './routes/ws';
import { internoRoutes } from './routes/interno';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { strict: false } },
});

app.register(websocket);

app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       '2mino — ms-social',
      description: 'Amigos, bandeja de entrada, presencia y chat de partida.',
      version:     '1.0.0',
    },
    tags: [
      { name: 'social', description: 'Amigos, solicitudes, notificaciones, chat' },
      { name: 'system', description: 'Estado del servicio' },
    ],
  },
});

app.register(swaggerUi, { routePrefix: '/docs' });

app.register(amigosRoutes);
app.register(notificacionesRoutes);
app.register(chatRoutes);
app.register(wsRoutes);
app.register(internoRoutes);

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
}, async () => ({ service: 'ms-social', status: 'ok' }));

async function start() {
  try {
    await runMigrations();
    const port = Number(process.env.PORT) || 6200;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Swagger UI → http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
