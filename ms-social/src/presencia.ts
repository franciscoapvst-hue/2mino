// ── Presencia y sockets en memoria del proceso ──────────────────────
// docs/CASOS_DE_USO_SOCIAL.md §0: con una sola instancia esto vive en
// memoria (Map). El día que haya más de una instancia detrás de un load
// balancer esto se rompe (un usuario en la instancia A no ve a uno en la
// B) y hace falta Redis pub/sub como bus de eventos — NO implementar
// ahora, solo no asumir en el código de arriba que "todos los conectados
// están en este proceso" de forma que sea difícil de cambiar después.
import type { WebSocket } from 'ws';

// ── Socket global por usuario (WS de presencia/notificaciones) ──────
const conectados = new Map<string, Set<WebSocket>>();

export function registrarConexion(usuarioId: string, ws: WebSocket): void {
  const set = conectados.get(usuarioId) ?? new Set<WebSocket>();
  set.add(ws);
  conectados.set(usuarioId, set);
}

export function quitarConexion(usuarioId: string, ws: WebSocket): void {
  const set = conectados.get(usuarioId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) conectados.delete(usuarioId);
}

export function estaConectado(usuarioId: string): boolean {
  return conectados.has(usuarioId);
}

export function enviarA(usuarioId: string, payload: unknown): void {
  const set = conectados.get(usuarioId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    try { ws.send(msg); } catch { /* socket muerto, se limpia en 'close' */ }
  }
}

// ── Sockets por sala (WS de chat) ────────────────────────────────────
const salasConectadas = new Map<string, Set<WebSocket>>();

export function registrarEnSala(salaId: string, ws: WebSocket): void {
  const set = salasConectadas.get(salaId) ?? new Set<WebSocket>();
  set.add(ws);
  salasConectadas.set(salaId, set);
}

export function quitarDeSala(salaId: string, ws: WebSocket): void {
  const set = salasConectadas.get(salaId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) salasConectadas.delete(salaId);
}

export function broadcastSala(salaId: string, payload: unknown): void {
  const set = salasConectadas.get(salaId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    try { ws.send(msg); } catch { /* socket muerto, se limpia en 'close' */ }
  }
}
