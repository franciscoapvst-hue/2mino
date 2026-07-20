import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { runMigrations } from './db/pool';
import { salasRoutes, limpiarSalasIncompletas, limpiarPartidasAbandonadas } from './routes/salas';
import { juegosRoutes } from './routes/juegos';
import { rankedRoutes } from './routes/ranked';
import { matchmakingRoutes, limpiarColaExpirada } from './routes/matchmaking';
import { historialRoutes } from './routes/historial';
import { reglasRoutes } from './routes/reglas';
import { torneosRoutes } from './routes/torneos';
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
app.register(torneosRoutes);

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

    // Cada minuto: salas 'esperando' que no se llenaron en 5 min y
    // 'cancelada' viejas (limpiarSalasIncompletas), partidas 'en_juego'
    // sin ningún movimiento en 30 min (limpiarPartidasAbandonadas — las
    // marca 'cancelada', el propio limpiarSalasIncompletas las termina de
    // borrar 5 min después) y tickets de cola con más de 3 min esperando
    // sin emparejar (limpiarColaExpirada). Ver comentarios en
    // routes/salas.ts y routes/matchmaking.ts — los tres nacieron de
    // basura real encontrada en producción (partidas de hasta 10 días
    // "en_juego", un ticket de cola de 10 días esperando).
    setInterval(async () => {
      try {
        const salasIncompletas = await limpiarSalasIncompletas();
        if (salasIncompletas > 0) app.log.info(`Limpieza: ${salasIncompletas} sala(s) incompleta(s) borrada(s)`);
      } catch (err) {
        app.log.error(err, 'Error en limpieza de salas incompletas');
      }
      try {
        const partidasAbandonadas = await limpiarPartidasAbandonadas();
        if (partidasAbandonadas > 0) app.log.info(`Limpieza: ${partidasAbandonadas} partida(s) abandonada(s) cancelada(s)`);
      } catch (err) {
        app.log.error(err, 'Error en limpieza de partidas abandonadas');
      }
      try {
        const colaExpirada = await limpiarColaExpirada();
        if (colaExpirada > 0) app.log.info(`Limpieza: ${colaExpirada} ticket(s) de cola expirado(s) borrado(s)`);
      } catch (err) {
        app.log.error(err, 'Error en limpieza de cola expirada');
      }
    }, 60_000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
