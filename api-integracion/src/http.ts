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

// Sin esto, un microservicio colgado (ej. ms-salas atascado en una query)
// cuelga la request del gateway indefinidamente con él — un solo servicio
// lento se convierte en un apagón de todo lo que pasa por acá.
const TIMEOUT_MS = 10_000;

/** Llamada HTTP genérica a cualquier microservicio interno */
export async function callService(
  base: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutErr = new Error(`Timeout esperando respuesta de ${base}${path}`);
      (timeoutErr as Error & { statusCode: number }).statusCode = 504;
      throw timeoutErr;
    }
    const connErr = new Error(`No se pudo conectar con ${base}${path}`);
    (connErr as Error & { statusCode: number }).statusCode = 502;
    throw connErr;
  } finally {
    clearTimeout(timeout);
  }
}
