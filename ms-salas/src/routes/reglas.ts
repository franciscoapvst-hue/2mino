import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { invalidarRegla } from '../game/reglas';
import type { ReglaValor } from '../game/reglas';

const ErrorSchema = { type: 'object', properties: { error: { type: 'string' } } } as const;
const AnySchema    = { type: 'object', additionalProperties: true } as const;

// Tipo esperado de `valor` por clave — valida ANTES de guardar para que
// una edición mal formada desde el Back Office no deje una regla con un
// shape que el código que la lee no sepa interpretar.
type FormaValor = 'numero' | 'array' | 'limite_por_tipo';

const FORMA_POR_CLAVE: Record<string, FormaValor> = {
  elo_inicial:             'numero',
  k_factor:                'numero',
  puntos_capicua:          'numero',
  puntos_objetivo:         'array',
  escalones_rango:         'array',
  paso_escalon_ms:         'numero',
  umbral_relleno_ms:       'numero',
  tiempo_limite_jugada_ms: 'limite_por_tipo',
};

function validarForma(clave: string, valor: unknown): string | null {
  const forma = FORMA_POR_CLAVE[clave];
  if (!forma) return `Clave desconocida: '${clave}'`;
  if (forma === 'numero') {
    return typeof valor === 'number' ? null : 'El valor debe ser un número';
  }
  if (forma === 'array') {
    return Array.isArray(valor) && valor.every(v => typeof v === 'number')
      ? null : 'El valor debe ser un array de números';
  }
  // limite_por_tipo: { casual: number|null, ranked: number|null }
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return 'El valor debe ser un objeto {casual, ranked}';
  }
  const v = valor as Record<string, unknown>;
  const claveValida = (k: string) => k === 'casual' || k === 'ranked';
  const valorValido = (x: unknown) => x === null || typeof x === 'number';
  if (!Object.keys(v).every(claveValida) || !claveValida('casual') || !claveValida('ranked')) {
    return 'El objeto debe tener exactamente las claves casual y ranked';
  }
  if (!valorValido(v.casual) || !valorValido(v.ranked)) {
    return 'casual y ranked deben ser un número o null';
  }
  return null;
}

export async function reglasRoutes(app: FastifyInstance) {

  // ── GET /reglas ────────────────────────────────
  app.get('/reglas', {
    schema: {
      tags: ['reglas'], summary: 'Todas las reglas de juego configurables',
      response: { 200: { type: 'array', items: AnySchema } },
    },
  }, async (_req, reply) => {
    const { rows } = await pool.query(
      'SELECT clave, valor, descripcion, updated_at FROM reglas_juego ORDER BY clave',
    );
    return reply.send(rows);
  });

  // ── PATCH /reglas/:clave ───────────────────────
  app.patch<{ Params: { clave: string }; Body: { valor: ReglaValor } }>(
    '/reglas/:clave', {
      schema: {
        tags: ['reglas'], summary: 'Editar el valor de una regla de juego',
        params: { type: 'object', properties: { clave: { type: 'string' } } },
        // `valor` puede ser número, array u objeto según la clave — sin
        // "type" acá (AnySchema fuerza type:'object', rechazaría un número
        // o array antes de llegar a validarForma()). La validación real de
        // forma la hace validarForma() más abajo, no el schema de Fastify.
        body: { type: 'object', required: ['valor'], properties: { valor: {} } },
        response: { 200: AnySchema, 400: { ...ErrorSchema }, 404: { ...ErrorSchema } },
      },
    }, async (req, reply) => {
      const { clave } = req.params;
      const { valor } = req.body;

      const error = validarForma(clave, valor);
      if (error) return reply.code(400).send({ error });

      const { rows } = await pool.query(
        `UPDATE reglas_juego SET valor = $1, updated_at = NOW()
         WHERE clave = $2 RETURNING clave, valor, descripcion, updated_at`,
        [JSON.stringify(valor), clave],
      );
      if (!rows.length) return reply.code(404).send({ error: `Regla '${clave}' no encontrada` });

      invalidarRegla(clave, valor);
      return reply.send(rows[0]);
    },
  );
}
