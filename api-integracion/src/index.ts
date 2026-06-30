import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './routes/auth';
import { frontendRoutes } from './routes/frontend';
import { salasGatewayRoutes } from './routes/salas';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { strict: false } },
});

// ── CORS ─────────────────────────────────────────
app.register(cors, {
  origin:  process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// ── OpenAPI / Swagger ─────────────────────────────
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       '2mino — API de Integración',
      description: 'Punto de entrada público. Autentica usuarios y orquesta los microservicios internos.',
      version:     '1.0.0',
    },
    servers: [
      { url: 'http://localhost:3000',   description: 'Local' },
      { url: 'https://api.2mino.com',   description: 'Producción (VPS IONOS)' },
    ],
    tags: [
      { name: 'auth',     description: 'Registro, login y recuperación de contraseña' },
      { name: 'frontend', description: 'Configuración del landing y preferencias de usuario' },
      { name: 'salas',    description: 'Salas de juego: crear, listar, unirse y salir' },
      { name: 'juego',    description: 'Estado y movimientos de la partida' },
      { name: 'system',   description: 'Estado del servicio' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'JWT obtenido en /auth/login o /auth/register',
        },
      },
    },
  },
});

app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking:  true,
  },
  staticCSP: true,
});

// ── Rutas ─────────────────────────────────────────
app.register(authRoutes);
app.register(frontendRoutes);
app.register(salasGatewayRoutes);

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
}, async () => ({ service: 'api-integracion', status: 'ok' }));

// ── Arranque ──────────────────────────────────────
async function start() {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Swagger UI → http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
