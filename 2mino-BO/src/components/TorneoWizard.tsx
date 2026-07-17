import { useMemo, useState } from 'react';
import { createTorneo, updateTorneo, abrirInscripcionTorneo } from '../lib/api';
import type { TorneoCampo, TorneoDetalle, TorneoFase, TorneoInput } from '../lib/types';

// ── Asistente de 8 pasos (CASOS_DE_USO_TORNEOS.md §A2) ──────────────
// Crea o edita (solo borradores). "Guardar borrador" disponible en todo
// momento; "Abrir inscripción" solo al final. La validación autoritativa
// vive en ms-salas (validarEstructura) — acá se replica lo mínimo para
// avisar en vivo sin esperar el 400.

const PASOS = [
  'Datos básicos', 'Formato', 'Reglas de partida', 'Visibilidad',
  'Fechas por fase', 'Cuota', 'Campos de inscripción', 'Información',
] as const;

// Nombres canónicos de eliminatorias según cuántas fases hay.
function nombresEliminatorias(n: number): string[] {
  const todos = ['Dieciseisavos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];
  return todos.slice(todos.length - n);
}

// datetime-local ('YYYY-MM-DDTHH:mm') ↔ ISO. Vacío se conserva vacío para
// que el input no muestre "Invalid Date".
function aLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function aIso(local: string): string {
  return local ? new Date(local).toISOString() : '';
}

type FaseForm = { nombre: string; desde: string; hasta: string }; // fechas en formato local

type Props = {
  inicial: TorneoDetalle | null; // null = crear; borrador = editar
  onGuardado: () => void;
  onCerrar: () => void;
};

export default function TorneoWizard({ inicial, onGuardado, onCerrar }: Props) {
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Si estamos editando, el id ya existe; si es nuevo, se setea tras el
  // primer "Guardar borrador" (los siguientes pasan a ser PATCH).
  const [torneoId, setTorneoId] = useState<string | null>(inicial?.id ?? null);

  // ── Estado del formulario ─────────────────────────
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [modo, setModo] = useState<'clasico' | 'rapido'>(inicial?.modo ?? 'clasico');
  const [puntosObjetivo, setPuntosObjetivo] = useState(inicial?.puntos_objetivo ?? 100);
  const [conInicial, setConInicial] = useState(inicial?.tiene_fase_inicial ?? true);
  const [puntosClasificacion, setPuntosClasificacion] = useState<number | ''>(inicial?.puntos_clasificacion ?? '');
  const [numElim, setNumElim] = useState(inicial?.num_fases_eliminatorias ?? 1);
  const [maxEquipos, setMaxEquipos] = useState(inicial?.max_equipos ?? 8);
  const [metrica, setMetrica] = useState<'puntos' | 'elo_torneo' | 'victorias'>(
    (inicial?.fases.find(f => f.tipo === 'inicial')?.metrica) ?? 'puntos');
  const [visibilidad, setVisibilidad] = useState<'publico' | 'privado'>(inicial?.visibilidad ?? 'publico');
  const [eloMin, setEloMin] = useState<number | ''>(inicial?.elo_min ?? '');
  const [eloMax, setEloMax] = useState<number | ''>(inicial?.elo_max ?? '');
  const [fechaInicio, setFechaInicio] = useState(aLocal(inicial?.fecha_inicio ?? ''));
  const [fechaFin, setFechaFin] = useState(aLocal(inicial?.fecha_fin ?? ''));
  const [avanceAuto, setAvanceAuto] = useState(inicial?.avance_automatico ?? false);
  const [cuotaUsd, setCuotaUsd] = useState(((inicial?.cuota_monto ?? 0) / 100).toString());
  const [politica, setPolitica] = useState(inicial?.politica_reembolso ?? '');
  const [infoHtml, setInfoHtml] = useState(inicial?.info_html ?? '');
  // Reglas por torneo (Etapa 1: las dos claves globales que hoy aplican;
  // el motor las inyecta a salas.config en la Etapa 3)
  const overridesIniciales = inicial?.reglas_override ?? {};
  const [tiempoJugadaS, setTiempoJugadaS] = useState<string>(
    typeof overridesIniciales['tiempo_limite_jugada_ms'] === 'number'
      ? String((overridesIniciales['tiempo_limite_jugada_ms'] as number) / 1000) : '');
  const [puntosCapicua, setPuntosCapicua] = useState<string>(
    typeof overridesIniciales['puntos_capicua'] === 'number'
      ? String(overridesIniciales['puntos_capicua']) : '');

  const [fases, setFases] = useState<FaseForm[]>(() => {
    if (inicial?.fases.length) {
      return inicial.fases.map(f => ({
        nombre: f.nombre,
        desde: aLocal(f.ventana_inicio),
        hasta: aLocal(f.ventana_fin),
      }));
    }
    return [{ nombre: 'Fase de grupos', desde: '', hasta: '' }, { nombre: 'Final', desde: '', hasta: '' }];
  });

  const [campos, setCampos] = useState<TorneoCampo[]>(
    inicial?.campos_inscripcion.length
      ? inicial.campos_inscripcion
      : [
          { etiqueta: 'Nombre completo', tipo: 'texto', requerido: true },
          { etiqueta: 'Teléfono', tipo: 'telefono', requerido: true },
          { etiqueta: 'Cédula', tipo: 'texto', requerido: true },
        ],
  );

  const equiposPrimeraElim = 2 ** numElim;

  // Al cambiar el formato (paso 2), se regeneran las filas de fases
  // conservando las fechas ya escritas por posición.
  function regenerarFases(nuevaInicial: boolean, nuevoNumElim: number) {
    const nombres = [
      ...(nuevaInicial ? ['Fase de grupos'] : []),
      ...nombresEliminatorias(nuevoNumElim),
    ];
    setFases(prev => nombres.map((n, i) => ({
      nombre: n,
      desde: prev[i]?.desde ?? '',
      hasta: prev[i]?.hasta ?? '',
    })));
  }

  // Validación en vivo del paso 5 (espejo liviano del servidor)
  const erroresFases = useMemo(() => {
    const errs: (string | null)[] = fases.map(() => null);
    const ini = fechaInicio ? Date.parse(aIso(fechaInicio)) : NaN;
    const fin = fechaFin ? Date.parse(aIso(fechaFin)) : NaN;
    let finAnterior = -Infinity;
    fases.forEach((f, i) => {
      if (!f.desde || !f.hasta) return; // aún sin completar, no marcar en rojo
      const vIni = Date.parse(aIso(f.desde));
      const vFin = Date.parse(aIso(f.hasta));
      if (vFin <= vIni) { errs[i] = 'Termina antes de empezar'; return; }
      if (Number.isFinite(ini) && Number.isFinite(fin) && (vIni < ini || vFin > fin)) {
        errs[i] = 'Fuera del rango general del torneo'; return;
      }
      if (vIni < finAnterior) { errs[i] = 'Se solapa con la fase anterior'; return; }
      finAnterior = vFin;
    });
    return errs;
  }, [fases, fechaInicio, fechaFin]);

  function armarInput(): TorneoInput {
    const overrides: Record<string, unknown> = {};
    if (tiempoJugadaS.trim() !== '') overrides['tiempo_limite_jugada_ms'] = Number(tiempoJugadaS) * 1000;
    if (puntosCapicua.trim() !== '') overrides['puntos_capicua'] = Number(puntosCapicua);

    const fasesInput: TorneoFase[] = fases.map((f, i) => ({
      tipo: (conInicial && i === 0 ? 'inicial' : 'eliminatoria') as TorneoFase['tipo'],
      nombre: f.nombre,
      ventana_inicio: aIso(f.desde),
      ventana_fin: aIso(f.hasta),
      clasifican_n: conInicial && i === 0 ? equiposPrimeraElim : null,
      metrica,
    }));

    return {
      nombre: nombre.trim(),
      modo,
      puntos_objetivo: puntosObjetivo,
      tiene_fase_inicial: conInicial,
      puntos_clasificacion: puntosClasificacion === '' ? null : puntosClasificacion,
      num_fases_eliminatorias: numElim,
      max_equipos: maxEquipos,
      visibilidad,
      elo_min: eloMin === '' ? null : eloMin,
      elo_max: eloMax === '' ? null : eloMax,
      fecha_inicio: aIso(fechaInicio),
      fecha_fin: aIso(fechaFin),
      cuota_monto: Math.round(Number(cuotaUsd || '0') * 100),
      politica_reembolso: politica.trim() || null,
      reglas_override: overrides,
      avance_automatico: avanceAuto,
      info_html: infoHtml.trim() || null,
      fases: fasesInput,
      campos_inscripcion: campos.map((c, i) => ({ ...c, orden: i })),
    };
  }

  async function guardar(abrir: boolean) {
    setError(null);
    if (!nombre.trim()) { setError('El nombre es requerido (Paso 1).'); setPaso(0); return; }
    if (!fechaInicio || !fechaFin) { setError('Faltan las fechas generales (Paso 5).'); setPaso(4); return; }
    if (fases.some(f => !f.desde || !f.hasta)) { setError('Falta completar la ventana de alguna fase (Paso 5).'); setPaso(4); return; }

    setGuardando(true);
    try {
      const input = armarInput();
      const guardado = torneoId
        ? await updateTorneo(torneoId, input)
        : await createTorneo(input);
      setTorneoId(guardado.id);
      if (abrir) await abrirInscripcionTorneo(guardado.id);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el torneo.');
    } finally {
      setGuardando(false);
    }
  }

  const filaEstilo = { display: 'flex', gap: 12, flexWrap: 'wrap' as const };

  return (
    <div className="bo-modal-backdrop" onClick={onCerrar}>
      <div
        className="bo-modal bo-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tw-titulo"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div className="bo-modal-header">
          <h2 id="tw-titulo">{inicial ? `Editar: ${inicial.nombre}` : 'Nuevo torneo'}</h2>
          <button type="button" className="bo-btn bo-btn-ghost" onClick={onCerrar}>Cerrar</button>
        </div>

        {/* Barra de pasos */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 20px' }}>
          {PASOS.map((p, i) => (
            <button
              key={p}
              type="button"
              className={`bo-btn ${i === paso ? 'bo-btn-primary' : 'bo-btn-ghost'}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setPaso(i)}
            >
              {i + 1}. {p}
            </button>
          ))}
        </div>

        {error && <p className="bo-form-error">{error}</p>}

        {/* ── Paso 1: Datos básicos ── */}
        {paso === 0 && (
          <div style={filaEstilo}>
            <div className="bo-field" style={{ flex: 2, minWidth: 220 }}>
              <label htmlFor="tw-nombre">Nombre del torneo</label>
              <input id="tw-nombre" className="bo-input" style={{ width: '100%' }} value={nombre}
                onChange={(e) => setNombre(e.target.value)} placeholder="ej. Copa Capicúa Agosto" />
            </div>
            <div className="bo-field">
              <label htmlFor="tw-modo">Modo</label>
              <select id="tw-modo" className="bo-select" value={modo}
                onChange={(e) => setModo(e.target.value as typeof modo)}>
                <option value="clasico">Clásico</option>
                <option value="rapido">Rápido</option>
              </select>
            </div>
            <div className="bo-field">
              <label htmlFor="tw-puntos">Puntos objetivo por partida</label>
              <select id="tw-puntos" className="bo-select" value={puntosObjetivo}
                onChange={(e) => setPuntosObjetivo(Number(e.target.value))}>
                {[100, 150, 200].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Paso 2: Formato ── */}
        {paso === 1 && (
          <div>
            <div style={filaEstilo}>
              <div className="bo-field">
                <label htmlFor="tw-inicial">Fase inicial (grupos)</label>
                <select id="tw-inicial" className="bo-select" value={conInicial ? 'si' : 'no'}
                  onChange={(e) => { const v = e.target.value === 'si'; setConInicial(v); regenerarFases(v, numElim); }}>
                  <option value="si">Sí — todos contra todos, clasifican los mejores</option>
                  <option value="no">No — eliminación directa desde el arranque</option>
                </select>
              </div>
              <div className="bo-field">
                <label htmlFor="tw-elim">Fases eliminatorias</label>
                <select id="tw-elim" className="bo-select" value={numElim}
                  onChange={(e) => { const v = Number(e.target.value); setNumElim(v); regenerarFases(conInicial, v); }}>
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n} — {nombresEliminatorias(n).join(' → ')}</option>
                  ))}
                </select>
              </div>
              <div className="bo-field">
                <label htmlFor="tw-cupo">Cupo (equipos)</label>
                <input id="tw-cupo" className="bo-input" type="number" min={2} value={maxEquipos}
                  onChange={(e) => setMaxEquipos(Number(e.target.value))} style={{ width: 90 }} />
              </div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 12px' }}>
              La primera eliminatoria necesita <strong>{equiposPrimeraElim} equipos</strong>.{' '}
              {conInicial
                ? `La fase de grupos clasifica automáticamente al Top ${equiposPrimeraElim}.`
                : `Sin fase de grupos, el cupo debe ser exactamente ${equiposPrimeraElim} (sin "bye" en v1).`}
              {!conInicial && maxEquipos !== equiposPrimeraElim && (
                <span style={{ color: 'var(--danger, #e06060)' }}> ⚠ El cupo actual ({maxEquipos}) no calza.</span>
              )}
            </p>
            {conInicial && (
              <div style={filaEstilo}>
                <div className="bo-field">
                  <label htmlFor="tw-metrica">Métrica de clasificación (grupos)</label>
                  <select id="tw-metrica" className="bo-select" value={metrica}
                    onChange={(e) => setMetrica(e.target.value as typeof metrica)}>
                    <option value="puntos">Puntos acumulados</option>
                    <option value="elo_torneo">ELO de torneo</option>
                    <option value="victorias">Victorias</option>
                  </select>
                </div>
                <div className="bo-field">
                  <label htmlFor="tw-ptsclas">Puntos por partida en grupos (opcional)</label>
                  <input id="tw-ptsclas" className="bo-input" type="number" min={0}
                    value={puntosClasificacion}
                    onChange={(e) => setPuntosClasificacion(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={`default ${puntosObjetivo}`} style={{ width: 140 }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Paso 3: Reglas de la partida ── */}
        {paso === 2 && (
          <div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
              Sobrescribe las reglas globales SOLO para las partidas de este torneo.
              Vacío = usa el valor global vigente. (Más reglas por-torneo llegan con el
              motor de partidas — Etapa 3.)
            </p>
            <div style={filaEstilo}>
              <div className="bo-field">
                <label htmlFor="tw-tiempo">Tiempo por jugada (segundos)</label>
                <input id="tw-tiempo" className="bo-input" type="number" min={5} value={tiempoJugadaS}
                  onChange={(e) => setTiempoJugadaS(e.target.value)} placeholder="global" style={{ width: 120 }} />
              </div>
              <div className="bo-field">
                <label htmlFor="tw-capicua">Puntos por capicúa/tranca</label>
                <input id="tw-capicua" className="bo-input" type="number" min={0} value={puntosCapicua}
                  onChange={(e) => setPuntosCapicua(e.target.value)} placeholder="global (30)" style={{ width: 120 }} />
              </div>
              <button type="button" className="bo-btn bo-btn-ghost" style={{ alignSelf: 'flex-end' }}
                onClick={() => { setTiempoJugadaS(''); setPuntosCapicua(''); }}>
                Restaurar valores globales
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 4: Visibilidad ── */}
        {paso === 3 && (
          <div style={filaEstilo}>
            <div className="bo-field">
              <label htmlFor="tw-vis">Visibilidad</label>
              <select id="tw-vis" className="bo-select" value={visibilidad}
                onChange={(e) => setVisibilidad(e.target.value as typeof visibilidad)}>
                <option value="publico">Público — aparece en el listado de todos</option>
                <option value="privado">Privado — solo con código de invitación</option>
              </select>
              {visibilidad === 'privado' && (
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                  El código se genera al guardar (se puede rotar desde el detalle).
                </p>
              )}
            </div>
            <div className="bo-field">
              <label htmlFor="tw-elomin">ELO mínimo (opcional)</label>
              <input id="tw-elomin" className="bo-input" type="number" value={eloMin}
                onChange={(e) => setEloMin(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="sin límite" style={{ width: 120 }} />
            </div>
            <div className="bo-field">
              <label htmlFor="tw-elomax">ELO máximo (opcional)</label>
              <input id="tw-elomax" className="bo-input" type="number" value={eloMax}
                onChange={(e) => setEloMax(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="sin límite" style={{ width: 120 }} />
            </div>
          </div>
        )}

        {/* ── Paso 5: Fechas por fase ── */}
        {paso === 4 && (
          <div>
            <div style={filaEstilo}>
              <div className="bo-field">
                <label htmlFor="tw-fini">Inicio general del torneo</label>
                <input id="tw-fini" className="bo-input" type="datetime-local" value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="bo-field">
                <label htmlFor="tw-ffin">Fin general del torneo</label>
                <input id="tw-ffin" className="bo-input" type="datetime-local" value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              <div className="bo-field">
                <label htmlFor="tw-auto">Avance de fases</label>
                <select id="tw-auto" className="bo-select" value={avanceAuto ? 'auto' : 'manual'}
                  onChange={(e) => setAvanceAuto(e.target.value === 'auto')}>
                  <option value="manual">Manual — el admin avanza cada fase</option>
                  <option value="auto">Automático al llegar la fecha (forzable a mano)</option>
                </select>
              </div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 8px' }}>
              Cada fase tiene su ventana propia. Puede haber días de hueco entre fases; lo
              que no puede haber es solapamiento.
            </p>
            {fases.map((f, i) => (
              <div key={i} style={{ ...filaEstilo, alignItems: 'flex-end', marginBottom: 6 }}>
                <span style={{ minWidth: 150, fontWeight: 600, fontSize: 13, paddingBottom: 10 }}>{f.nombre}</span>
                <div className="bo-field" style={{ marginBottom: 0 }}>
                  <label>Desde</label>
                  <input className="bo-input" type="datetime-local" value={f.desde}
                    onChange={(e) => setFases(prev => prev.map((x, j) => j === i ? { ...x, desde: e.target.value } : x))} />
                </div>
                <div className="bo-field" style={{ marginBottom: 0 }}>
                  <label>Hasta</label>
                  <input className="bo-input" type="datetime-local" value={f.hasta}
                    onChange={(e) => setFases(prev => prev.map((x, j) => j === i ? { ...x, hasta: e.target.value } : x))} />
                </div>
                {erroresFases[i] && (
                  <span style={{ color: 'var(--danger, #e06060)', fontSize: 12, paddingBottom: 10 }}>
                    ⚠ {erroresFases[i]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Paso 6: Cuota ── */}
        {paso === 5 && (
          <div>
            <div style={filaEstilo}>
              <div className="bo-field">
                <label htmlFor="tw-cuota">Cuota por equipo (USD)</label>
                <input id="tw-cuota" className="bo-input" type="number" min={0} step="0.01" value={cuotaUsd}
                  onChange={(e) => setCuotaUsd(e.target.value)} style={{ width: 120 }} />
              </div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 12px' }}>
              0 = torneo gratis (los pasos de pago del jugador desaparecen). El cobro es por
              equipo y lo paga el jugador 1, procesado con <strong>PayPal en USD</strong> (PayPal no
              soporta pesos dominicanos — el jugador ve un equivalente en RD$ de referencia).
              Los reembolsos se hacen manualmente desde aquí.
            </p>
            {Number(cuotaUsd) > 0 && (
              <div className="bo-field">
                <label htmlFor="tw-politica">Política de reembolso (se muestra ANTES de pagar)</label>
                <textarea id="tw-politica" className="bo-input" rows={4} style={{ width: '100%', resize: 'vertical' }}
                  value={politica} onChange={(e) => setPolitica(e.target.value)}
                  placeholder="ej. Se reembolsa el 100% si el torneo se cancela; no hay reembolso por abandono del equipo." />
              </div>
            )}
          </div>
        )}

        {/* ── Paso 7: Campos de inscripción ── */}
        {paso === 6 && (
          <div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
              Lo que cada jugador llena al inscribirse (cada uno completa lo suyo).
            </p>
            {campos.map((c, i) => (
              <div key={i} style={{ ...filaEstilo, alignItems: 'flex-end', marginBottom: 6 }}>
                <div className="bo-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                  <label>Etiqueta</label>
                  <input className="bo-input" style={{ width: '100%' }} value={c.etiqueta}
                    onChange={(e) => setCampos(prev => prev.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x))} />
                </div>
                <div className="bo-field" style={{ marginBottom: 0 }}>
                  <label>Tipo</label>
                  <select className="bo-select" value={c.tipo}
                    onChange={(e) => setCampos(prev => prev.map((x, j) => j === i ? { ...x, tipo: e.target.value as TorneoCampo['tipo'] } : x))}>
                    <option value="texto">Texto</option>
                    <option value="numero">Número</option>
                    <option value="telefono">Teléfono</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={c.requerido}
                    onChange={(e) => setCampos(prev => prev.map((x, j) => j === i ? { ...x, requerido: e.target.checked } : x))} />
                  Requerido
                </label>
                <button type="button" className="bo-btn bo-btn-ghost" disabled={i === 0}
                  onClick={() => setCampos(prev => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
                  aria-label={`Subir ${c.etiqueta}`}>↑</button>
                <button type="button" className="bo-btn bo-btn-ghost" disabled={i === campos.length - 1}
                  onClick={() => setCampos(prev => { const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; })}
                  aria-label={`Bajar ${c.etiqueta}`}>↓</button>
                <button type="button" className="bo-btn bo-btn-danger"
                  onClick={() => setCampos(prev => prev.filter((_, j) => j !== i))}>Eliminar</button>
              </div>
            ))}
            <button type="button" className="bo-btn bo-btn-ghost" style={{ marginTop: 8 }}
              onClick={() => setCampos(prev => [...prev, { etiqueta: '', tipo: 'texto', requerido: false }])}>
              + Agregar campo
            </button>
          </div>
        )}

        {/* ── Paso 8: Información ── */}
        {paso === 7 && (
          <div>
            <div className="bo-field">
              <label htmlFor="tw-info">Contenido del detalle (HTML — reglas especiales, premios, sponsors)</label>
              <textarea id="tw-info" className="bo-input" rows={8} style={{ width: '100%', resize: 'vertical' }}
                value={infoHtml} onChange={(e) => setInfoHtml(e.target.value)}
                placeholder="Vacío = se arma un detalle genérico con los datos estructurados. Se sanitiza al mostrarse." />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Vista previa sanitizada y reglamento PDF adjunto llegan en la etapa de pulido
              (Etapa 6 del plan) — el schema ya los soporta.
            </p>
          </div>
        )}

        {/* ── Navegación + acciones ── */}
        <div className="bo-modal-actions" style={{ marginTop: 20, justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="bo-btn bo-btn-ghost" disabled={paso === 0}
              onClick={() => setPaso(p => p - 1)}>← Anterior</button>
            <button type="button" className="bo-btn bo-btn-ghost" disabled={paso === PASOS.length - 1}
              onClick={() => setPaso(p => p + 1)}>Siguiente →</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="bo-btn bo-btn-ghost" disabled={guardando}
              onClick={() => guardar(false)}>
              {guardando ? 'Guardando…' : 'Guardar borrador'}
            </button>
            {paso === PASOS.length - 1 && (
              <button type="button" className="bo-btn bo-btn-primary" disabled={guardando}
                onClick={() => guardar(true)}>
                {guardando ? 'Guardando…' : 'Abrir inscripción'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
