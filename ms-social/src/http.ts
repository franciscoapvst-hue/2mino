const MS_USUARIOS_BASE = () => (process.env.MS_USUARIOS_URL ?? 'http://localhost:4000').trim();
const MS_SALAS_BASE    = () => (process.env.MS_SALAS_URL    ?? 'http://localhost:6001').trim();

async function callService(
  base: string, path: string, method: string, body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export type UsuarioResumen = { id: string; username: string; avatar: string | null };

/** Trae username/avatar reales de ms-usuarios; null si no existe. */
export async function obtenerUsuario(usuarioId: string): Promise<UsuarioResumen | null> {
  const { status, data } = await callService(MS_USUARIOS_BASE(), `/usuarios/${usuarioId}`, 'GET');
  if (status !== 200) return null;
  const d = data as { id: string; username: string; avatar: string | null };
  return { id: d.id, username: d.username, avatar: d.avatar ?? null };
}

/** Resuelve username → UUID (para "agregar amigo por username"). */
export async function obtenerUsuarioPorUsername(username: string): Promise<UsuarioResumen | null> {
  const { status, data } = await callService(
    MS_USUARIOS_BASE(), `/usuarios/por-username/${encodeURIComponent(username)}`, 'GET',
  );
  if (status !== 200) return null;
  const d = data as { id: string; username: string; avatar: string | null };
  return { id: d.id, username: d.username, avatar: d.avatar ?? null };
}

/** ELO actual (o el default de ms-salas si el usuario nunca jugó ranked). */
export async function obtenerElo(usuarioId: string): Promise<number> {
  const { status, data } = await callService(MS_SALAS_BASE(), `/ranked/${usuarioId}`, 'GET');
  if (status !== 200) return 1000;
  return (data as { elo?: number }).elo ?? 1000;
}

export type SalaResumen = { id: string; codigo: string; estado: string };

/** Confirma que una sala existe y sigue esperando jugadores. */
export async function obtenerSalaPorCodigo(codigo: string): Promise<SalaResumen | null> {
  const { status, data } = await callService(MS_SALAS_BASE(), `/salas/codigo/${codigo}`, 'GET');
  if (status !== 200) return null;
  return data as SalaResumen;
}

/** Confirma que un usuario pertenece a una sala (para el WS de chat). */
export async function usuarioEnSala(salaId: string, usuarioId: string): Promise<boolean> {
  const { status, data } = await callService(MS_SALAS_BASE(), `/salas/${salaId}`, 'GET');
  if (status !== 200) return false;
  const sala = data as { jugadores?: { usuario_id: string }[] };
  return (sala.jugadores ?? []).some(j => j.usuario_id === usuarioId);
}
