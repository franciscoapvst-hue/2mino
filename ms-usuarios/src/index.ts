import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { runMigrations } from './db/pool';
import { usuariosRoutes, limpiarInvitadosAbandonados } from './routes/usuarios';
import { tiendaRoutes } from './routes/tienda';
import { internoRoutes } from './routes/interno';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { strict: false } },
});

// ── OpenAPI / Swagger ─────────────────────────────
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title:       '2mino — ms-usuarios (interno)',
      description: 'Microservicio interno de gestión de usuarios. No expuesto directamente al público.',
      version:     '1.0.0',
    },
    servers: [
      { url: 'http://localhost:4000',    description: 'Local' },
      { url: 'http://ms-usuarios:4000',  description: 'Red Docker interna' },
    ],
    tags: [
      { name: 'usuarios', description: 'Gestión de usuarios y autenticación' },
      { name: 'tienda',   description: 'Cosméticos: billetera, catálogo, inventario' },
      { name: 'system',   description: 'Estado del servicio' },
    ],
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
app.register(usuariosRoutes);
app.register(tiendaRoutes);
app.register(internoRoutes);

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
}, async () => ({ service: 'ms-usuarios', status: 'ok' }));

// ── Arranque ──────────────────────────────────────
async function start() {
  try {
    await runMigrations();
    const port = Number(process.env.PORT) || 4000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Swagger UI → http://localhost:${port}/docs`);

    // Cada hora, borra cuentas invitado de más de 24h (ver
    // limpiarInvitadosAbandonados() en routes/usuarios.ts).
    setInterval(async () => {
      try {
        const borrados = await limpiarInvitadosAbandonados();
        if (borrados > 0) app.log.info(`Limpieza: ${borrados} invitado(s) abandonado(s) borrado(s)`);
      } catch (err) {
        app.log.error(err, 'Error en limpieza de invitados abandonados');
      }
    }, 60 * 60_000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
