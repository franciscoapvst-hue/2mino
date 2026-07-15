import { useEffect, useState } from 'react';
import { listarTorneos } from './mockData';
import type { Torneo } from './types';
import { BackIcon, TournamentIcon } from '../components/icons';
import './torneos.css';

type Props = {
  onVerTorneo: (id: string) => void;
  onVolver: () => void;
};

function formatoFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}

function badgeEstado(estado: Torneo['estado']): { label: string; tone: string } {
  switch (estado) {
    case 'inscripcion':   return { label: 'Inscripción abierta', tone: 'tor-badge-open' };
    case 'fase_inicial':  return { label: 'Fase de grupos', tone: 'tor-badge-live' };
    case 'eliminatoria':  return { label: 'Eliminatorias', tone: 'tor-badge-live' };
    case 'finalizado':    return { label: 'Finalizado', tone: 'tor-badge-done' };
    case 'cancelado':     return { label: 'Cancelado', tone: 'tor-badge-done' };
  }
}

export default function TorneosListView({ onVerTorneo, onVolver }: Props) {
  const [torneos, setTorneos] = useState<Torneo[] | null>(null);

  useEffect(() => { listarTorneos().then(setTorneos); }, []);

  return (
    <div className="tor-shell">
      <nav className="tor-nav">
        <button className="btn-back" onClick={onVolver}><BackIcon /> Volver</button>
        <span className="tor-nav-title"><TournamentIcon /> Torneos</span>
        <span aria-hidden style={{ width: 90 }} />
      </nav>

      <div className="tor-list-wrap">
        {!torneos ? (
          <p className="tor-loading">Cargando torneos…</p>
        ) : torneos.length === 0 ? (
          <p className="tor-loading">No hay torneos disponibles para vos ahora mismo.</p>
        ) : (
          <div className="tor-list">
            {torneos.map(t => {
              const badge = badgeEstado(t.estado);
              const inscrito = !!t.miEquipoId;
              return (
                <button key={t.id} className="tor-card" onClick={() => onVerTorneo(t.id)}>
                  <div className="tor-card-top">
                    <span className={`tor-badge ${badge.tone}`}>{badge.label}</span>
                    {inscrito && <span className="tor-badge tor-badge-mine">Estás inscrito</span>}
                  </div>
                  <h3 className="tor-card-title">{t.nombre}</h3>
                  <p className="tor-card-meta">
                    {formatoFecha(t.fechaInicio)} – {formatoFecha(t.fechaFin)} · {t.equipos.length}/{t.maxEquipos} equipos
                  </p>
                  <div className="tor-card-foot">
                    <span className="tor-card-cuota">
                      {t.cuotaMonto > 0 ? `RD$${(t.cuotaMonto / 100).toFixed(0)} por equipo` : 'Gratis'}
                    </span>
                    <span className="tor-card-cta">Ver torneo →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
