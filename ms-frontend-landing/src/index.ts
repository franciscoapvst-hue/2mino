import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { runMigrations } from './db/pool';
import { landingRoutes } from './routes/landing';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { strict: false } },
});

// ── OpenAPI / Swagger ─────────────────────────────
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       '2mino — ms-frontend-landing (interno)',
      description: 'Gestiona la configuración del landing y las preferencias de frontend por usuario.',
      version:     '1.0.0',
    },
    servers: [
      { url: 'http://localhost:5000',          description: 'Local' },
      { url: 'http://ms-frontend-landing:5000', description: 'Red Docker interna' },
    ],
    tags: [
      { name: 'config',       description: 'Opciones globales del landing (habilitadas/deshabilitadas)' },
      { name: 'preferencias', description: 'Preferencias de frontend por usuario' },
      { name: 'system',       description: 'Estado del servicio' },
    ],
  },
});

app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
  staticCSP: true,
});

// ── Rutas ─────────────────────────────────────────
app.register(landingRoutes);

app.get('/health', {
  schema: {
    tags:    ['system'],
    summary: 'Health check',
    response: {
      200: {
        type: 'object',
        properties: {
          service: { type: 'string' },
          status:  { type: 'string' },
        },
      },
    },
  },
}, async () => ({ service: 'ms-frontend-landing', status: 'ok' }));

// ── Arranque ──────────────────────────────────────
async function start() {
  try {
    await runMigrations();
    const port = Number(process.env.PORT) || 5000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Swagger UI → http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
