import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { generarCodigo } from './salas';

// ── Torneos, Etapa 1 (docs/PLAN_TORNEOS.md §8): CRUD admin + validaciones.
// Sin motor todavía (iniciar/cerrar fase/salas = Etapas 3-4), sin equipos
// de jugador (Etapa 2), sin pagos (Etapa 5). Estos endpoints los consume
// solo el gateway vía /admin/* (requireAdmin) — acá no hay auth propia,
// igual que el resto de ms-salas (red interna).

// ── Tipos del body ────────────────────────────────
type FaseInput = {
  tipo: 'inicial' | 'eliminatoria';
  nombre: string;
  puntos_objetivo?: number;
  ventana_inicio: string;
  ventana_fin: string;
  clasifican_n?: number | null;
  metrica?: 'puntos' | 'elo_torneo' | 'victorias';
};

type CampoInput = {
  etiqueta: string;
  tipo?: 'texto' | 'numero' | 'telefono' | 'email';
  requerido?: boolean;
  orden?: number;
};

type TorneoInput = {
  nombre: string;
  modo?: 'clasico' | 'rapido';
  puntos_objetivo?: number;
  tiene_fase_inicial?: boolean;
  puntos_clasificacion?: number | null;
  num_fases_eliminatorias?: number;
  max_equipos: number;
  visibilidad?: 'publico' | 'privado';
  elo_min?: number | null;
  elo_max?: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  cuota_monto?: number;
  politica_reembolso?: string | null;
  reglas_override?: Record<string, unknown>;
  avance_automatico?: boolean;
  info_html?: string | null;
  creado_por: string;
  fases: FaseInput[];
  campos_inscripcion?: CampoInput[];
};

// ── Validación de estructura + fechas (Paso 5 del wizard) ──────────
// Devuelve el mensaje de error señalando la fase conflictiva, o null si
// todo bien. Va en código y no en constraints porque cruza filas y el
// error debe decir CUÁL fila choca (PLAN §2).
export function validarEstructura(t: TorneoInput): string | null {
  const numElim = t.num_fases_eliminatorias ?? 1;
  const conInicial = t.tiene_fase_inicial ?? true;
  const fases = t.fases ?? [];

  // Cantidad y orden lógico fijo: inicial (si existe) primero, luego
  // eliminatorias en secuencia — nunca reordenadas.
  const esperadas = (conInicial ? 1 : 0) + numElim;
  if (fases.length !== esperadas) {
    return `El formato define ${esperadas} fase(s) (${conInicial ? '1 inicial + ' : ''}${numElim} eliminatoria(s)) pero llegaron ${fases.length}`;
  }
  for (let i = 0; i < fases.length; i++) {
    const debeSerInicial = conInicial && i === 0;
    if (debeSerInicial && fases[i].tipo !== 'inicial') {
      return `La fase 1 debe ser la fase inicial (grupos) — llegó '${fases[i].tipo}'`;
    }
    if (!debeSerInicial && fases[i].tipo !== 'eliminatoria') {
      return `La fase "${fases[i].nombre}" debería ser eliminatoria — la fase inicial va siempre primero y es única`;
    }
  }

  // Fechas del torneo
  const ini = Date.parse(t.fecha_inicio);
  const fin = Date.parse(t.fecha_fin);
  if (!Number.isFinite(ini) || !Number.isFinite(fin)) return 'fecha_inicio/fecha_fin inválidas';
  if (fin <= ini) return 'La fecha de fin del torneo debe ser posterior a la de inicio';

  // Ventanas por fase: desde<hasta, sin solapamiento (hueco permitido),
  // todo dentro del rango general.
  let finAnterior = -Infinity;
  let nombreAnterior = '';
  for (const f of fases) {
    const vIni = Date.parse(f.ventana_inicio);
    const vFin = Date.parse(f.ventana_fin);
    if (!Number.isFinite(vIni) || !Number.isFinite(vFin)) {
      return `Ventana con fecha inválida en la fase "${f.nombre}"`;
    }
    if (vFin <= vIni) return `En la fase "${f.nombre}", la ventana termina antes (o igual) de empezar`;
    if (vIni < ini || vFin > fin) {
      return `La ventana de la fase "${f.nombre}" se sale del rango general del torneo`;
    }
    if (vIni < finAnterior) {
      return `La fase "${f.nombre}" se solapa con "${nombreAnterior}" — puede haber hueco entre fases, pero no solapamiento`;
    }
    finAnterior = vFin;
    nombreAnterior = f.nombre;
  }

  // Criterio de clasificación: la primera eliminatoria necesita 2^N
  // equipos; sin fase inicial el cupo debe calzar EXACTO (v1 sin "bye").
  const equiposPrimeraElim = 2 ** numElim;
  if (conInicial) {
    const inicial = fases[0];
    if ((inicial.clasifican_n ?? null) !== equiposPrimeraElim) {
      return `La fase inicial debe clasificar exactamente ${equiposPrimeraElim} equipos para llenar ${numElim} fase(s) eliminatoria(s) — llegó ${inicial.clasifican_n ?? 'vacío'}`;
    }
    if (t.max_equipos < equiposPrimeraElim) {
      return `max_equipos (${t.max_equipos}) es menor que los ${equiposPrimeraElim} equipos que necesita la primera eliminatoria`;
    }
  } else if (t.max_equipos !== equiposPrimeraElim) {
    return `Sin fase inicial, el cupo debe calzar exacto con el bracket: ${equiposPrimeraElim} equipos para ${numElim} fase(s) eliminatoria(s) (v1 sin "bye")`;
  }

  return null;
}

// clasifican_n de las eliminatorias es determinístico (la mitad avanza) —
// se calcula acá, el wizard solo define el Top N de la fase inicial.
function clasificanDeEliminatoria(ordenElim: number, numElim: number): number | null {
  if (ordenElim === numElim) return null; // la final no clasifica a nadie
  return 2 ** (numElim - ordenElim);
}

async function codigoInvitacionDisponible(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generarCodigo('TR-');
    const { rows } = await pool.query('SELECT id FROM torneos WHERE codigo_invitacion = $1', [code]);
    if (!rows.length) return code;
  }
  throw new Error('No se pudo generar un código único');
}

// Inserta fases + campos de un torneo (dentro de la transacción del caller).
// Reemplazo total: el PATCH borra y re-inserta — más simple que un diff y
// seguro mientras el torneo está en borrador (nada referencia las fases aún).
async function insertarFasesYCampos(
  client: { query: (q: string, p?: unknown[]) => Promise<unknown> },
  torneoId: string,
  t: TorneoInput,
) {
  const conInicial = t.tiene_fase_inicial ?? true;
  const numElim = t.num_fases_eliminatorias ?? 1;
  for (let i = 0; i < t.fases.length; i++) {
    const f = t.fases[i];
    const orden = conInicial ? i : i + 1; // 0 reservado a la inicial
    const ordenElim = conInicial ? i : i + 1;
    const clasifican = f.tipo === 'inicial'
      ? f.clasifican_n
      : clasificanDeEliminatoria(ordenElim, numElim);
    await client.query(
      `INSERT INTO torneo_fases (torneo_id, tipo, orden, nombre, puntos_objetivo,
         ventana_inicio, ventana_fin, clasifican_n, metrica)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [torneoId, f.tipo, orden, f.nombre, f.puntos_objetivo ?? t.puntos_objetivo ?? 100,
       f.ventana_inicio, f.ventana_fin, clasifican, f.metrica ?? 'puntos'],
    );
  }
  for (let i = 0; i < (t.campos_inscripcion ?? []).length; i++) {
    const c = t.campos_inscripcion![i];
    await client.query(
      `INSERT INTO torneo_campos_inscripcion (torneo_id, etiqueta, tipo, requerido, orden)
       VALUES ($1,$2,$3,$4,$5)`,
      [torneoId, c.etiqueta, c.tipo ?? 'texto', c.requerido ?? true, c.orden ?? i],
    );
  }
}

// ── Schemas Swagger ───────────────────────────────
const ErrorSchema = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const TorneoResumenSchema = {
  type: 'object',
  properties: {
    id:            { type: 'string', format: 'uuid' },
    nombre:        { type: 'string' },
    estado:        { type: 'string' },
    modo:          { type: 'string' },
    visibilidad:   { type: 'string' },
    max_equipos:   { type: 'integer' },
    equipos_inscritos: { type: 'integer' },
    cuota_monto:   { type: 'integer' },
    moneda:        { type: 'string' },
    fecha_inicio:  { type: 'string', format: 'date-time' },
    fecha_fin:     { type: 'string', format: 'date-time' },
    created_at:    { type: 'string', format: 'date-time' },
  },
} as const;

// El detalle devuelve el torneo completo + fases + equipos; sin lista
// exhaustiva de propiedades (additionalProperties) para no duplicar acá
// cada columna — el contrato fino lo valida el BO con sus tipos.
const TorneoDetalleSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

// ─────────────────────────────────────────────────
export async function torneosRoutes(app: FastifyInstance) {

  // ── POST /torneos — crear (queda en borrador) ───
  app.post<{ Body: TorneoInput }>('/torneos', {
    schema: {
      tags:        ['torneos'],
      summary:     'Crear un torneo (borrador)',
      description: 'Config completa del wizard. Valida estructura y fechas de fases; queda en estado borrador hasta abrir inscripción.',
      body: {
        type: 'object',
        required: ['nombre', 'max_equipos', 'fecha_inicio', 'fecha_fin', 'creado_por', 'fases'],
        properties: {
          nombre:                  { type: 'string', minLength: 3, maxLength: 80 },
          modo:                    { type: 'string', enum: ['clasico', 'rapido'], default: 'clasico' },
          puntos_objetivo:         { type: 'integer', minimum: 50, default: 100 },
          tiene_fase_inicial:      { type: 'boolean', default: true },
          puntos_clasificacion:    { type: ['integer', 'null'] },
          num_fases_eliminatorias: { type: 'integer', minimum: 1, maximum: 5, default: 1 },
          max_equipos:             { type: 'integer', minimum: 2 },
          visibilidad:             { type: 'string', enum: ['publico', 'privado'], default: 'publico' },
          elo_min:                 { type: ['integer', 'null'] },
          elo_max:                 { type: ['integer', 'null'] },
          fecha_inicio:            { type: 'string', format: 'date-time' },
          fecha_fin:               { type: 'string', format: 'date-time' },
          cuota_monto:             { type: 'integer', minimum: 0, default: 0, description: 'Centavos USD (PayPal no soporta DOP)' },
          politica_reembolso:      { type: ['string', 'null'] },
          reglas_override:         { type: 'object', additionalProperties: true, default: {} },
          avance_automatico:       { type: 'boolean', default: false },
          info_html:               { type: ['string', 'null'] },
          creado_por:              { type: 'string', format: 'uuid' },
          fases: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['tipo', 'nombre', 'ventana_inicio', 'ventana_fin'],
              properties: {
                tipo:            { type: 'string', enum: ['inicial', 'eliminatoria'] },
                nombre:          { type: 'string', minLength: 2, maxLength: 40 },
                puntos_objetivo: { type: 'integer', minimum: 50 },
                ventana_inicio:  { type: 'string', format: 'date-time' },
                ventana_fin:     { type: 'string', format: 'date-time' },
                clasifican_n:    { type: ['integer', 'null'] },
                metrica:         { type: 'string', enum: ['puntos', 'elo_torneo', 'victorias'] },
              },
            },
          },
          campos_inscripcion: {
            type: 'array',
            items: {
              type: 'object',
              required: ['etiqueta'],
              properties: {
                etiqueta:  { type: 'string', minLength: 1, maxLength: 60 },
                tipo:      { type: 'string', enum: ['texto', 'numero', 'telefono', 'email'] },
                requerido: { type: 'boolean' },
                orden:     { type: 'integer' },
              },
            },
          },
        },
      },
      response: {
        201: TorneoDetalleSchema,
        400: { description: 'Estructura o fechas inválidas', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const t = req.body;
    const errorEstructura = validarEstructura(t);
    if (errorEstructura) return reply.code(400).send({ error: errorEstructura });

    const codigo = (t.visibilidad === 'privado') ? await codigoInvitacionDisponible() : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO torneos (nombre, modo, puntos_objetivo, tiene_fase_inicial,
           puntos_clasificacion, num_fases_eliminatorias, max_equipos, visibilidad,
           codigo_invitacion, elo_min, elo_max, fecha_inicio, fecha_fin, cuota_monto,
           politica_reembolso, reglas_override, avance_automatico, info_html, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [t.nombre, t.modo ?? 'clasico', t.puntos_objetivo ?? 100, t.tiene_fase_inicial ?? true,
         t.puntos_clasificacion ?? null, t.num_fases_eliminatorias ?? 1, t.max_equipos,
         t.visibilidad ?? 'publico', codigo, t.elo_min ?? null, t.elo_max ?? null,
         t.fecha_inicio, t.fecha_fin, t.cuota_monto ?? 0, t.politica_reembolso ?? null,
         JSON.stringify(t.reglas_override ?? {}), t.avance_automatico ?? false,
         t.info_html ?? null, t.creado_por],
      );
      const torneo = rows[0];
      await insertarFasesYCampos(client, torneo.id, t);
      await client.query('COMMIT');

      const fases = await pool.query(
        'SELECT * FROM torneo_fases WHERE torneo_id = $1 ORDER BY orden', [torneo.id]);
      return reply.code(201).send({ ...torneo, fases: fases.rows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── PATCH /torneos/:id — editar el wizard ───────
  // Solo en borrador: una vez abierta la inscripción hay equipos/dinero
  // colgando de esta config — cambiarla a mitad de camino es otra feature
  // (y otro cuidado), no este endpoint.
  app.patch<{ Params: { id: string }; Body: TorneoInput }>('/torneos/:id', {
    schema: {
      tags:    ['torneos'],
      summary: 'Editar un torneo en borrador (reemplaza config, fases y campos)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: TorneoDetalleSchema,
        400: { description: 'Estructura inválida',    ...ErrorSchema },
        404: { description: 'Torneo no encontrado',   ...ErrorSchema },
        409: { description: 'Ya no está en borrador', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const t = req.body;
    const errorEstructura = validarEstructura(t);
    if (errorEstructura) return reply.code(400).send({ error: errorEstructura });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const actual = await client.query(
        'SELECT estado, visibilidad, codigo_invitacion FROM torneos WHERE id = $1 FOR UPDATE',
        [req.params.id]);
      if (!actual.rows.length) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Torneo no encontrado' });
      }
      if (actual.rows[0].estado !== 'borrador') {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'Solo se puede editar un torneo en borrador' });
      }

      // Código de invitación: se conserva si ya era privado; se genera si
      // pasa a privado; se limpia si pasa a público.
      let codigo: string | null = actual.rows[0].codigo_invitacion;
      if ((t.visibilidad ?? 'publico') === 'privado') {
        if (!codigo) codigo = await codigoInvitacionDisponible();
      } else {
        codigo = null;
      }

      const { rows } = await client.query(
        `UPDATE torneos SET nombre=$1, modo=$2, puntos_objetivo=$3, tiene_fase_inicial=$4,
           puntos_clasificacion=$5, num_fases_eliminatorias=$6, max_equipos=$7, visibilidad=$8,
           codigo_invitacion=$9, elo_min=$10, elo_max=$11, fecha_inicio=$12, fecha_fin=$13,
           cuota_monto=$14, politica_reembolso=$15, reglas_override=$16, avance_automatico=$17,
           info_html=$18, updated_at=NOW()
         WHERE id = $19 RETURNING *`,
        [t.nombre, t.modo ?? 'clasico', t.puntos_objetivo ?? 100, t.tiene_fase_inicial ?? true,
         t.puntos_clasificacion ?? null, t.num_fases_eliminatorias ?? 1, t.max_equipos,
         t.visibilidad ?? 'publico', codigo, t.elo_min ?? null, t.elo_max ?? null,
         t.fecha_inicio, t.fecha_fin, t.cuota_monto ?? 0, t.politica_reembolso ?? null,
         JSON.stringify(t.reglas_override ?? {}), t.avance_automatico ?? false,
         t.info_html ?? null, req.params.id],
      );

      await client.query('DELETE FROM torneo_fases WHERE torneo_id = $1', [req.params.id]);
      await client.query('DELETE FROM torneo_campos_inscripcion WHERE torneo_id = $1', [req.params.id]);
      await insertarFasesYCampos(client, req.params.id, t);
      await client.query('COMMIT');

      const fases = await pool.query(
        'SELECT * FROM torneo_fases WHERE torneo_id = $1 ORDER BY orden', [req.params.id]);
      return reply.send({ ...rows[0], fases: fases.rows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── POST /torneos/:id/abrir-inscripcion ─────────
  app.post<{ Params: { id: string } }>('/torneos/:id/abrir-inscripcion', {
    schema: {
      tags:    ['torneos'],
      summary: 'Pasar de borrador a inscripción (visible para jugadores)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: TorneoDetalleSchema,
        404: { description: 'Torneo no encontrado', ...ErrorSchema },
        409: { description: 'No está en borrador',  ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE torneos SET estado = 'inscripcion', updated_at = NOW()
       WHERE id = $1 AND estado = 'borrador' RETURNING *`,
      [req.params.id],
    );
    if (!rows.length) {
      const existe = await pool.query('SELECT estado FROM torneos WHERE id = $1', [req.params.id]);
      if (!existe.rows.length) return reply.code(404).send({ error: 'Torneo no encontrado' });
      return reply.code(409).send({ error: `El torneo ya está en estado '${existe.rows[0].estado}', no en borrador` });
    }
    return reply.send(rows[0]);
  });

  // ── GET /torneos — listado admin ────────────────
  app.get('/torneos', {
    schema: {
      tags:    ['torneos'],
      summary: 'Listar todos los torneos (incluye borradores) con conteo de equipos',
      response: {
        200: { type: 'array', items: TorneoResumenSchema },
      },
    },
  }, async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT t.id, t.nombre, t.estado, t.modo, t.visibilidad, t.max_equipos,
              t.cuota_monto, t.moneda, t.fecha_inicio, t.fecha_fin, t.created_at,
              COUNT(e.id) FILTER (WHERE e.estado = 'completo')::int AS equipos_inscritos
       FROM torneos t
       LEFT JOIN torneo_equipos e ON e.torneo_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
    );
    return reply.send(rows);
  });

  // ── GET /torneos/:id — detalle completo ─────────
  app.get<{ Params: { id: string } }>('/torneos/:id', {
    schema: {
      tags:    ['torneos'],
      summary: 'Detalle: config + fases + equipos (ordenados como tabla de posiciones)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: TorneoDetalleSchema,
        404: { description: 'Torneo no encontrado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM torneos WHERE id = $1', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Torneo no encontrado' });

    const [fases, equipos, campos] = await Promise.all([
      pool.query('SELECT * FROM torneo_fases WHERE torneo_id = $1 ORDER BY orden', [req.params.id]),
      pool.query(
        `SELECT * FROM torneo_equipos WHERE torneo_id = $1
         ORDER BY puntos DESC, victorias DESC, elo_torneo DESC, inscrito_at`,
        [req.params.id]),
      pool.query(
        'SELECT * FROM torneo_campos_inscripcion WHERE torneo_id = $1 ORDER BY orden',
        [req.params.id]),
    ]);
    return reply.send({
      ...rows[0],
      fases: fases.rows,
      equipos: equipos.rows,
      campos_inscripcion: campos.rows,
    });
  });

  // ── PATCH /torneos/:id/estado — cancelar ────────
  // v1 admin solo cancela a mano; 'finalizado' lo pondrá el motor al
  // cerrar la última fase (Etapa 4).
  app.patch<{ Params: { id: string }; Body: { estado: 'cancelado' } }>('/torneos/:id/estado', {
    schema: {
      tags:    ['torneos'],
      summary: 'Cancelar un torneo',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['estado'],
        properties: { estado: { type: 'string', enum: ['cancelado'] } },
      },
      response: {
        200: TorneoDetalleSchema,
        404: { description: 'Torneo no encontrado',    ...ErrorSchema },
        409: { description: 'Ya finalizado/cancelado', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE torneos SET estado = 'cancelado', finalizado_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND estado NOT IN ('finalizado', 'cancelado') RETURNING *`,
      [req.params.id],
    );
    if (!rows.length) {
      const existe = await pool.query('SELECT estado FROM torneos WHERE id = $1', [req.params.id]);
      if (!existe.rows.length) return reply.code(404).send({ error: 'Torneo no encontrado' });
      return reply.code(409).send({ error: `El torneo ya está '${existe.rows[0].estado}'` });
    }
    return reply.send(rows[0]);
  });

  // ── POST /torneos/:id/codigo — rotar invitación ─
  app.post<{ Params: { id: string } }>('/torneos/:id/codigo', {
    schema: {
      tags:    ['torneos'],
      summary: 'Regenerar el código de invitación (solo torneos privados)',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: {
          type: 'object',
          properties: { codigo_invitacion: { type: 'string' } },
        },
        404: { description: 'Torneo no encontrado', ...ErrorSchema },
        409: { description: 'El torneo es público', ...ErrorSchema },
      },
    },
  }, async (req, reply) => {
    const actual = await pool.query(
      'SELECT visibilidad FROM torneos WHERE id = $1', [req.params.id]);
    if (!actual.rows.length) return reply.code(404).send({ error: 'Torneo no encontrado' });
    if (actual.rows[0].visibilidad !== 'privado') {
      return reply.code(409).send({ error: 'Solo los torneos privados tienen código de invitación' });
    }
    const codigo = await codigoInvitacionDisponible();
    await pool.query(
      'UPDATE torneos SET codigo_invitacion = $1, updated_at = NOW() WHERE id = $2',
      [codigo, req.params.id]);
    return reply.send({ codigo_invitacion: codigo });
  });
}
