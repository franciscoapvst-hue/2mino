// ── Emisión y verificación de JWT (única fuente del secreto) ──
// Antes el secreto estaba duplicado en cada archivo de rutas. Aquí vive una
// sola vez. En producción el secreto DEBE venir del entorno; si falta, el
// gateway no arranca (evita firmar con un secreto público por defecto).
import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';

const secretEnv = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !secretEnv) {
  throw new Error('JWT_SECRET no definido: es obligatorio en producción');
}

const JWT_SECRET = secretEnv ?? 'dev-secret-change-in-production';
const JWT_EXPIRY  = '7d';

export type JwtPayload = { sub: string; username: string; segmento: string };

/** Firma un JWT de 7 días para un usuario. */
export function signToken(user: { id: string; username: string; segmento: string }): string {
  return jwt.sign(
    { sub: user.id, username: user.username, segmento: user.segmento },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
}

/**
 * Verifica el header `Authorization: Bearer <token>`.
 * Devuelve el payload si es válido, o `null` si falta, está mal formado o
 * expiró. No lanza.
 */
export function verifyToken(authHeader: string | undefined): JwtPayload | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const p = jwt.verify(authHeader.slice(7), JWT_SECRET) as jwt.JwtPayload;
    if (typeof p.sub !== 'string') return null;
    return {
      sub:      p.sub,
      username: typeof p.username === 'string' ? p.username : '',
      segmento: typeof p.segmento === 'string' ? p.segmento : '',
    };
  } catch {
    return null;
  }
}

/**
 * `preHandler` para rutas `/admin/*`: exige un JWT válido cuyo `segmento`
 * sea `admin`. Responde 401 si el token falta/es inválido, 403 si es válido
 * pero no es admin. Adjunta el payload en `req.admin` para que la ruta no
 * tenga que volver a verificar el token.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    return reply.code(401).send({ error: 'Token inválido o expirado' });
  }
  if (payload.segmento !== 'admin') {
    return reply.code(403).send({ error: 'Requiere segmento admin' });
  }
  (req as FastifyRequest & { admin: JwtPayload }).admin = payload;
}
