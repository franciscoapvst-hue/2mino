// ── Verificación de JWT ──────────────────────────────────────────────
// Mismo JWT_SECRET que api-integracion (es quien firma los tokens); acá
// solo se verifica. En producción es obligatorio: si falta, no arranca
// (evita validar contra un secreto público por defecto).
import jwt from 'jsonwebtoken';

const secretEnv = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !secretEnv) {
  throw new Error('JWT_SECRET no definido: es obligatorio en producción');
}

const JWT_SECRET = secretEnv ?? 'dev-secret-change-in-production';

export type JwtPayload = { sub: string; username: string };

/** Verifica el header `Authorization: Bearer <token>`. `null` si falta/inválido. */
export function verifyToken(authHeader: string | undefined): JwtPayload | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyRaw(authHeader.slice(7));
}

/** Verifica un token "pelado" (sin el prefijo Bearer) — para el WS, que
 *  recibe el JWT por query string en vez de header. */
export function verifyRaw(token: string | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (typeof p.sub !== 'string') return null;
    return { sub: p.sub, username: typeof p.username === 'string' ? p.username : '' };
  } catch {
    return null;
  }
}
