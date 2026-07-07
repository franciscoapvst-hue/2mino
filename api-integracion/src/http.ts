const MS_USUARIOS_BASE = () =>
  (process.env.MS_USUARIOS_URL ?? 'http://localhost:4000').trim();

const MS_SALAS_BASE = () =>
  (process.env.MS_SALAS_URL ?? 'http://localhost:6001').trim();

const MS_SOCIAL_BASE = () =>
  (process.env.MS_SOCIAL_URL ?? 'http://localhost:6200').trim();

export async function callSalas(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return callService(MS_SALAS_BASE(), path, method, body);
}

/** Llama a ms-usuarios (mantiene compatibilidad con las rutas de auth) */
export async function callMs(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return callService(MS_USUARIOS_BASE(), path, method, body);
}

/** Llama a ms-social (amigos, notificaciones, chat) */
export async function callSocial(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return callService(MS_SOCIAL_BASE(), path, method, body);
}

/** Llamada HTTP genérica a cualquier microservicio interno */
export async function callService(
  base: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, data };
}
