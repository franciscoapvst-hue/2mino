import { useEffect, useState } from 'react';
import {
  listTorneos, getTorneo, abrirInscripcionTorneo, cancelarTorneo, rotarCodigoTorneo,
} from '../lib/api';
import type { TorneoDetalle, TorneoResumen } from '../lib/types';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';
import TorneoWizard from '../components/TorneoWizard';

// Etapa 1 (docs/PLAN_TORNEOS.md): listado + detalle + wizard de creación.
// Iniciar torneo / cerrar fases / pagos llegan en Etapas 3-5.

const TONO_ESTADO: Record<string, 'success' | 'danger' | 'muted' | 'warning'> = {
  borrador: 'muted',
  inscripcion: 'success',
  fase_inicial: 'warning',
  eliminatoria: 'warning',
  finalizado: 'muted',
  cancelado: 'danger',
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtCuota(centavos: number) {
  return centavos === 0 ? 'Gratis' : `US$ ${(centavos / 100).toFixed(2)}`;
}

export default function TorneosView() {
  const [torneos, setTorneos] = useState<TorneoResumen[] | null>(null);
  const [detalle, setDetalle] = useState<TorneoDetalle | null>(null);
  const [wizardAbierto, setWizardAbierto] = useState(false);
  const [editando, setEditando] = useState<TorneoDetalle | null>(null);
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    listTorneos()
      .then(setTorneos)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar.'));
  }

  useEffect(refresh, []);

  async function abrirDetalle(id: string) {
    try {
      setDetalle(await getTorneo(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el torneo.');
    }
  }

  async function handleAbrirInscripcion(id: string) {
    try {
      await abrirInscripcionTorneo(id);
      refresh();
      await abrirDetalle(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la inscripción.');
    }
  }

  async function handleCancelar() {
    if (!confirmCancelar) return;
    try {
      await cancelarTorneo(confirmCancelar);
      refresh();
      if (detalle?.id === confirmCancelar) await abrirDetalle(confirmCancelar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar.');
    } finally {
      setConfirmCancelar(null);
    }
  }

  async function handleRotarCodigo(id: string) {
    try {
      await rotarCodigoTorneo(id);
      await abrirDetalle(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rotar el código.');
    }
  }

  return (
    <div>
      <div className="bo-page-header">
        <div>
          <h1>Torneos</h1>
          <p>Etapa 1: crear/editar torneos y abrir inscripción. Iniciar el bracket y cerrar fases llegan con el motor (Etapas 3-4).</p>
        </div>
        <button type="button" className="bo-btn bo-btn-primary" onClick={() => { setEditando(null); setWizardAbierto(true); }}>
          + Nuevo torneo
        </button>
      </div>

      {error && (
        <p className="bo-form-error" style={{ marginBottom: 12 }}>
          {error} — <button type="button" className="bo-link-btn" onClick={refresh}>reintentar</button>
        </p>
      )}

      <div className="bo-table-wrap">
        {!torneos ? (
          error ? null : <p className="bo-table-empty">Cargando…</p>
        ) : torneos.length === 0 ? (
          <p className="bo-table-empty">Todavía no hay torneos. Crea el primero con "+ Nuevo torneo".</p>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Torneo</th>
                <th>Estado</th>
                <th>Equipos</th>
                <th>Cuota</th>
                <th>Fechas</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {torneos.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="bo-link-btn"
                      style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}
                      onClick={() => abrirDetalle(t.id)}>
                      {t.nombre}
                    </button>
                    <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>
                      {t.modo} · {t.visibilidad}
                    </span>
                  </td>
                  <td><Badge tone={TONO_ESTADO[t.estado] ?? 'muted'}>{t.estado}</Badge></td>
                  <td>{t.equipos_inscritos}/{t.max_equipos}</td>
                  <td>{fmtCuota(t.cuota_monto)}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {fmtFecha(t.fecha_inicio)} — {fmtFecha(t.fecha_fin)}
                  </td>
                  <td>
                    <div className="bo-table-actions">
                      {t.estado === 'borrador' && (
                        <button type="button" className="bo-btn bo-btn-primary"
                          onClick={() => handleAbrirInscripcion(t.id)}>
                          Abrir inscripción
                        </button>
                      )}
                      {!['finalizado', 'cancelado'].includes(t.estado) && (
                        <button type="button" className="bo-btn bo-btn-danger"
                          onClick={() => setConfirmCancelar(t.id)}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detalle ── */}
      {detalle && (
        <div className="bo-modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="bo-modal bo-modal-wide" role="dialog" aria-modal="true"
            onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="bo-modal-header">
              <h2>{detalle.nombre} <Badge tone={TONO_ESTADO[detalle.estado] ?? 'muted'}>{detalle.estado}</Badge></h2>
              <button type="button" className="bo-btn bo-btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>

            <div className="bo-detail-grid">
              <div className="bo-detail-field">
                <span className="bo-detail-label">Formato</span>
                <span className="bo-detail-value">
                  {detalle.tiene_fase_inicial ? 'Grupos + ' : ''}{detalle.num_fases_eliminatorias} eliminatoria(s) · {detalle.modo} · a {detalle.puntos_objetivo}
                </span>
              </div>
              <div className="bo-detail-field">
                <span className="bo-detail-label">Cupo</span>
                <span className="bo-detail-value">{detalle.equipos.length}/{detalle.max_equipos} equipos</span>
              </div>
              <div className="bo-detail-field">
                <span className="bo-detail-label">Cuota</span>
                <span className="bo-detail-value">{fmtCuota(detalle.cuota_monto)}</span>
              </div>
              <div className="bo-detail-field">
                <span className="bo-detail-label">Visibilidad</span>
                <span className="bo-detail-value">
                  {detalle.visibilidad}
                  {detalle.codigo_invitacion && <> · código <strong>{detalle.codigo_invitacion}</strong></>}
                </span>
              </div>
              <div className="bo-detail-field">
                <span className="bo-detail-label">Rango ELO</span>
                <span className="bo-detail-value">
                  {detalle.elo_min ?? 'sin mín.'} — {detalle.elo_max ?? 'sin máx.'}
                </span>
              </div>
              <div className="bo-detail-field">
                <span className="bo-detail-label">Avance de fases</span>
                <span className="bo-detail-value">{detalle.avance_automatico ? 'Automático por fecha' : 'Manual'}</span>
              </div>
            </div>

            <h3 style={{ margin: '18px 0 8px' }}>Fases</h3>
            <table className="bo-table">
              <thead>
                <tr><th>Fase</th><th>Tipo</th><th>Ventana</th><th>Clasifican</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {detalle.fases.map((f) => (
                  <tr key={f.id ?? f.nombre}>
                    <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                    <td>{f.tipo}</td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {fmtFechaHora(f.ventana_inicio)} → {fmtFechaHora(f.ventana_fin)}
                    </td>
                    <td>{f.clasifican_n ? `Top ${f.clasifican_n}${f.tipo === 'inicial' ? ` por ${f.metrica}` : ''}` : '—'}</td>
                    <td><Badge tone={f.estado === 'finalizada' ? 'muted' : f.estado === 'en_curso' ? 'success' : 'warning'}>{f.estado ?? 'pendiente'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ margin: '18px 0 8px' }}>Equipos inscritos ({detalle.equipos.length})</h3>
            {detalle.equipos.length === 0 ? (
              <p className="bo-table-empty">Sin equipos todavía{detalle.estado === 'borrador' ? ' — la inscripción no está abierta' : ''}.</p>
            ) : (
              <table className="bo-table">
                <thead>
                  <tr><th>#</th><th>Equipo</th><th>Estado</th><th>Pts</th><th>V/D</th><th>ELO torneo</th></tr>
                </thead>
                <tbody>
                  {detalle.equipos.map((e, i) => (
                    <tr key={e.id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        {e.nombre ?? `${e.jugador1_username} & ${e.jugador2_username ?? '?'}`}
                        <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>{e.codigo_equipo}</span>
                      </td>
                      <td><Badge tone={e.estado === 'completo' ? 'success' : 'warning'}>{e.estado}</Badge></td>
                      <td>{e.puntos}</td>
                      <td>{e.victorias}/{e.derrotas}</td>
                      <td>{e.elo_torneo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="bo-modal-actions" style={{ marginTop: 18 }}>
              {detalle.estado === 'borrador' && (
                <>
                  <button type="button" className="bo-btn bo-btn-ghost"
                    onClick={() => { setEditando(detalle); setDetalle(null); setWizardAbierto(true); }}>
                    Editar
                  </button>
                  <button type="button" className="bo-btn bo-btn-primary"
                    onClick={() => handleAbrirInscripcion(detalle.id)}>
                    Abrir inscripción
                  </button>
                </>
              )}
              {detalle.visibilidad === 'privado' && !['finalizado', 'cancelado'].includes(detalle.estado) && (
                <button type="button" className="bo-btn bo-btn-ghost"
                  onClick={() => handleRotarCodigo(detalle.id)}>
                  Regenerar código
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {wizardAbierto && (
        <TorneoWizard
          inicial={editando}
          onCerrar={() => setWizardAbierto(false)}
          onGuardado={() => { setWizardAbierto(false); refresh(); }}
        />
      )}

      <ConfirmModal
        open={!!confirmCancelar}
        title="Cancelar torneo"
        body="El torneo pasa a 'cancelado' y deja de ser visible/inscribible para los jugadores. Esta acción no se puede deshacer. (Los reembolsos, cuando haya pagos, se gestionan aparte.)"
        confirmLabel="Cancelar torneo"
        tone="danger"
        onConfirm={handleCancelar}
        onCancel={() => setConfirmCancelar(null)}
      />
    </div>
  );
}
