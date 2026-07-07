import { useEffect, useState } from 'react';
import { api, type LeaderboardEntry, type PerfilJugador } from '../../api';
import { rangoDeElo } from '../../ranks';

type Props = {
  entry: LeaderboardEntry;
  onClose: () => void;
};

// Mini gráfico de progresión de ELO, SVG puro (sin librería de charts
// para algo de 12 puntos — no vale la pena la dependencia).
function EloSparkline({ puntos }: { puntos: { fecha: string; elo: number }[] }) {
  if (puntos.length < 2) return null;
  const W = 280, H = 64, PAD = 4;
  const elos = puntos.map(p => p.elo);
  const min = Math.min(...elos), max = Math.max(...elos);
  const rango = Math.max(1, max - min);
  const pts = puntos.map((p, i) => {
    const x = PAD + (i / (puntos.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p.elo - min) / rango) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="profile-sparkline" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--amber, #ef9f2e)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlayerProfileModal({ entry, onClose }: Props) {
  const [perfil, setPerfil] = useState<PerfilJugador | null>(null);

  useEffect(() => {
    api.social.perfilJugador(entry).then(setPerfil);
  }, [entry]);

  const rango = rangoDeElo(entry.elo);
  const pct = entry.partidas > 0 ? Math.round((entry.ganadas / entry.partidas) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <header className="profile-head">
          <span className="profile-avatar">{entry.username[0].toUpperCase()}</span>
          <div>
            <h2>@{entry.username}</h2>
            <span className="profile-rank" title={rango.nombre}>
              {rango.url && <img src={rango.url} alt="" />}
              {rango.nombre} · {entry.elo} ELO
            </span>
          </div>
        </header>

        <div className="profile-stats-grid">
          <div className="profile-stat">
            <span className="profile-stat-value">{entry.partidas}</span>
            <span className="profile-stat-label">Partidas</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{pct}%</span>
            <span className="profile-stat-label">Victorias</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{perfil ? perfil.capicuas : '—'}</span>
            <span className="profile-stat-label">Capicúas</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{perfil ? perfil.tranques_ganados : '—'}</span>
            <span className="profile-stat-label">Tranques ganados</span>
          </div>
        </div>

        {perfil ? (
          <div className="profile-elo-history">
            <span className="profile-section-label">Progresión de ELO</span>
            <EloSparkline puntos={perfil.progresion_elo} />
          </div>
        ) : (
          <div className="social-loading social-loading-compact"><div className="boot-spinner" /></div>
        )}

        <button className="btn-salir" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
