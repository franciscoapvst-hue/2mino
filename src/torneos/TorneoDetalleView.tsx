import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { obtenerTorneo } from './mockData';
import type { Torneo, Fase } from './types';
import { BackIcon, TournamentIcon, DocumentIcon } from '../components/icons';
import './torneos.css';

type Props = {
  torneoId: string;
  onVolver: () => void;
  onInscribirme: (torneoId: string) => void;
  onUnirseConCodigo: (torneoId: string) => void;
};

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function FaseRow({ fase }: { fase: Fase }) {
  const estadoLabel = fase.estado === 'finalizada' ? 'Finalizada' : fase.estado === 'en_curso' ? 'En curso' : 'Pendiente';
  return (
    <div className={`tor-fase-row tor-fase-${fase.estado}`}>
      <div className="tor-fase-info">
        <span className="tor-fase-nombre">{fase.nombre}</span>
        <span className="tor-fase-meta">
          {formatoFechaHora(fase.ventanaInicio)} → {formatoFechaHora(fase.ventanaFin)}
          {fase.clasificanN && ` · clasifican ${fase.clasificanN}`}
        </span>
      </div>
      <span className={`tor-fase-estado tor-fase-estado-${fase.estado}`}>{estadoLabel}</span>
    </div>
  );
}

export default function TorneoDetalleView({ torneoId, onVolver, onInscribirme, onUnirseConCodigo }: Props) {
  const [torneo, setTorneo] = useState<Torneo | null>(null);

  useEffect(() => { obtenerTorneo(torneoId).then(setTorneo); }, [torneoId]);

  if (!torneo) {
    return (
      <div className="tor-shell">
        <div className="tor-loading-wrap"><p className="tor-loading">Cargando…</p></div>
      </div>
    );
  }

  const puedeInscribirse = torneo.estado === 'inscripcion' && !torneo.miEquipoId;
  const miEquipo = torneo.equipos.find(e => e.id === torneo.miEquipoId) ?? null;

  const infoHtmlSanitizado = torneo.infoHtml ? DOMPurify.sanitize(torneo.infoHtml) : null;

  const equiposOrdenados = [...torneo.equipos].sort((a, b) => b.puntos - a.puntos || b.eloTorneo - a.eloTorneo);

  return (
    <div className="tor-shell">
      <nav className="tor-nav">
        <button className="btn-back" onClick={onVolver}><BackIcon /> Torneos</button>
        <span className="tor-nav-title"><TournamentIcon /> {torneo.nombre}</span>
        <span aria-hidden style={{ width: 90 }} />
      </nav>

      <div className="tor-detalle-wrap">
        {/* Info del torneo: espacio para el HTML cargado por el admin
            (Paso 8 del wizard, sanitizado con DOMPurify) — si no cargó
            nada, se arma un detalle genérico con los datos estructurados.
            El título siempre se muestra para que quede claro que es un
            bloque editorial, distinto del texto genérico de respaldo. */}
        <section className="tor-panel">
          <h2 className="tor-panel-title">Sobre este torneo</h2>
          {infoHtmlSanitizado ? (
            <div className="tor-info-html" dangerouslySetInnerHTML={{ __html: infoHtmlSanitizado }} />
          ) : (
            <p className="tor-panel-text">
              {torneo.tieneFaseInicial ? 'Con fase de grupos previa a las eliminatorias.' : 'Eliminación directa desde el inicio.'}{' '}
              Cada partida se juega a {torneo.puntosObjetivo} puntos.
              {torneo.reglasOverride.puntosCapicua == null
                ? ' La capicúa no suma bonus en este torneo.'
                : ` Capicúa suma ${torneo.reglasOverride.puntosCapicua} puntos.`}
              {torneo.reglasOverride.puntosTranca != null && ` Tranca suma ${torneo.reglasOverride.puntosTranca} puntos.`}
            </p>
          )}
          <div className="tor-panel-facts">
            <span><strong>{formatoFechaHora(torneo.fechaInicio)}</strong> — {formatoFechaHora(torneo.fechaFin)}</span>
            <span>{torneo.equipos.length}/{torneo.maxEquipos} equipos</span>
            <span>{torneo.cuotaMonto > 0 ? `Cuota: RD$${(torneo.cuotaMonto / 100).toFixed(0)} por equipo` : 'Gratis'}</span>
          </div>
          {torneo.reglamentoPdfUrl && (
            <a
              className="tor-pdf-link"
              href={torneo.reglamentoPdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              <DocumentIcon />
              <span>
                Reglamento oficial (PDF)
                {torneo.reglamentoPdfNombre && <span className="tor-pdf-nombre"> — {torneo.reglamentoPdfNombre}</span>}
              </span>
            </a>
          )}
        </section>

        {/* Mi estado en el torneo */}
        {miEquipo && (
          <section className="tor-panel tor-panel-mine">
            <h2 className="tor-panel-title">Mi equipo</h2>
            <p className="tor-panel-text">
              {miEquipo.jugador1Username} &amp; {miEquipo.jugador2Username ?? <em>esperando compañero…</em>}
            </p>
            {miEquipo.estado === 'pendiente_companero' && (
              <div className="tor-codigo-box">
                <span className="tor-codigo-label">Comparte este código para completar tu equipo</span>
                <span className="tor-codigo-valor">{miEquipo.codigoEquipo}</span>
              </div>
            )}
            {miEquipo.estado === 'completo' && (
              <span className="tor-badge tor-badge-mine">Equipo completo — listo para jugar</span>
            )}
          </section>
        )}

        {/* Inscripción */}
        {puedeInscribirse && (
          <section className="tor-panel">
            <h2 className="tor-panel-title">Inscribirme</h2>
            <p className="tor-panel-text">
              Los torneos se juegan estrictamente en pareja. Inscribite y compartí un código con tu compañero,
              o unite a un equipo si ya tenés un código.
            </p>
            <div className="tor-inscribir-actions">
              <button className="btn-primary" onClick={() => onInscribirme(torneo.id)}>
                Inscribirme {torneo.cuotaMonto > 0 ? `(RD$${(torneo.cuotaMonto / 100).toFixed(0)})` : ''}
              </button>
              <button className="tor-btn-ghost" onClick={() => onUnirseConCodigo(torneo.id)}>
                Tengo un código
              </button>
            </div>
          </section>
        )}

        {/* Fases */}
        <section className="tor-panel">
          <h2 className="tor-panel-title">Fases</h2>
          <div className="tor-fases-list">
            {torneo.fases.map(f => <FaseRow key={f.id} fase={f} />)}
          </div>
        </section>

        {/* Posiciones */}
        {equiposOrdenados.length > 0 && (
          <section className="tor-panel">
            <h2 className="tor-panel-title">Equipos inscritos</h2>
            <div className="tor-table-wrap">
              <table className="tor-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>ELO torneo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {equiposOrdenados.map(e => (
                    <tr key={e.id} className={e.id === torneo.miEquipoId ? 'tor-row-mine' : undefined}>
                      <td>{e.nombre ?? `${e.jugador1Username} & ${e.jugador2Username ?? '—'}`}</td>
                      <td>{e.eloTorneo}</td>
                      <td>
                        <span className={`tor-badge tor-badge-${e.estado === 'completo' ? 'open' : e.estado === 'campeon' ? 'mine' : 'done'}`}>
                          {e.estado === 'pendiente_companero' ? 'Falta compañero' : e.estado === 'pendiente_pago' ? 'Pago pendiente' : e.estado === 'campeon' ? 'Campeón' : e.estado === 'eliminado' ? 'Eliminado' : 'Completo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
