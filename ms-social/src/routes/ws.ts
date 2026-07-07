import { FastifyInstance } from 'fastify';
import { verifyRaw } from '../jwt';
import { pool } from '../db/pool';
import {
  registrarConexion, quitarConexion, enviarA,
  registrarEnSala, quitarDeSala, broadcastSala,
} from '../presencia';
import { usuarioEnSala } from '../http';

async function amigosDe(usuarioId: string): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT usuario_id_a, usuario_id_b FROM amigos WHERE usuario_id_a = $1 OR usuario_id_b = $1',
    [usuarioId],
  );
  return rows.map(r => r.usuario_id_a === usuarioId ? r.usuario_id_b : r.usuario_id_a);
}

export async function wsRoutes(app: FastifyInstance) {

  // ── WS /ws/social — presencia + notificaciones ─────
  // docs/CASOS_DE_USO_SOCIAL.md §2.3: un socket por usuario autenticado
  // (JWT en query string, ya que el navegador no permite headers custom
  // al abrir un WebSocket). Solo empuja eventos ya calculados server-side
  // — el cliente nunca muta estado por acá, eso sigue siendo POST HTTP.
  app.get<{ Querystring: { token?: string } }>('/ws/social', { websocket: true }, async (socket, req) => {
    const payload = verifyRaw(req.query.token);
    if (!payload) { socket.close(4001, 'Token inválido'); return; }
    const usuarioId = payload.sub;

    registrarConexion(usuarioId, socket);
    for (const amigoId of await amigosDe(usuarioId)) {
      enviarA(amigoId, { tipo: 'amigo_conectado', usuario_id: usuarioId });
    }

    socket.on('close', () => {
      quitarConexion(usuarioId, socket);
      amigosDe(usuarioId)
        .then(ids => ids.forEach(id => enviarA(id, { tipo: 'amigo_desconectado', usuario_id: usuarioId })))
        .catch(() => {});
    });
  });

  // ── WS /ws/chat/:salaId — chat de partida ───────────
  // Distinto del de arriba: este es por-sala, no por-usuario/global.
  app.get<{ Params: { salaId: string }; Querystring: { token?: string } }>(
    '/ws/chat/:salaId', { websocket: true }, async (socket, req) => {
      const payload = verifyRaw(req.query.token);
      if (!payload) { socket.close(4001, 'Token inválido'); return; }
      const { salaId } = req.params;

      // La validación de membresía es async (llama a ms-salas) — el
      // listener de mensajes se registra YA, sincrónico, para no perder
      // uno que llegue mientras se valida; mientras no esté validado, los
      // mensajes se ignoran. El cliente espera el evento 'listo' antes de
      // mandar nada (ver useSalaChat.ts) — evita la carrera de raíz, esto
      // es una red de seguridad extra por si algún cliente no espera.
      let validado = false;

      socket.on('message', async (raw: Buffer) => {
        if (!validado) return;
        let mensaje = '';
        try {
          const parsed = JSON.parse(raw.toString());
          mensaje = typeof parsed.mensaje === 'string' ? parsed.mensaje.trim() : '';
        } catch {
          return;
        }
        if (!mensaje || mensaje.length > 280) return;

        const { rows } = await pool.query(
          `INSERT INTO chat_mensajes (sala_id, usuario_id, username, mensaje)
           VALUES ($1, $2, $3, $4) RETURNING id, usuario_id, username, mensaje, created_at`,
          [salaId, payload.sub, payload.username, mensaje],
        );
        // Broadcast a TODOS, incluido el emisor: confirma el envío con el
        // mismo timestamp que quedó en base (evita divergencia cliente/servidor).
        broadcastSala(salaId, { tipo: 'mensaje_nuevo', mensaje: rows[0] });
      });

      socket.on('close', () => quitarDeSala(salaId, socket));

      // No confiar en que el cliente solo abre el socket de salas donde
      // está — se valida server-side siempre, contra ms-salas.
      const pertenece = await usuarioEnSala(salaId, payload.sub);
      if (!pertenece) { socket.close(4003, 'No pertenecés a esta sala'); return; }

      registrarEnSala(salaId, socket);
      validado = true;
      socket.send(JSON.stringify({ tipo: 'listo' }));
    },
  );
}
