import { useEffect, useState } from 'react';
import { api, type LeaderboardEntry } from '../../api';
import { rangoDeElo } from '../../ranks';
import PageHeader from './PageHeader';
import PlayerProfileModal from './PlayerProfileModal';

type Props = {
  dark: boolean;
  onBack: () => void;
  miUsuarioId: string;
};

export default function LeaderboardView({ dark, onBack, miUsuarioId }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    // Endpoint real, ya existente en ms-salas (ver docs/CASOS_DE_USO_SOCIAL.md §4.1).
    api.ranked.leaderboard(100)
      .then(setEntries)
      .catch(() => setError('No se pudo cargar el leaderboard'));
  }, []);

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader
        title="Leaderboard"
        subtitle="Top 100 jugadores por ELO"
        onBack={onBack}
      />

      <main className="social-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {entries === null && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando leaderboard…</p></div>
        ) : entries?.length === 0 ? (
          <div className="social-empty">
            <p className="social-empty-icon">🏆</p>
            <p className="social-empty-msg">Todavía nadie ha jugado ranked</p>
            <p className="social-empty-sub">Sé el primero en aparecer aquí.</p>
          </div>
        ) : (
          <div className="lb-table" role="table">
            <div className="lb-row lb-row-head" role="row">
              <span className="lb-col-pos">#</span>
              <span className="lb-col-player">Jugador</span>
              <span className="lb-col-elo">ELO</span>
              <span className="lb-col-stat">Partidas</span>
              <span className="lb-col-stat">% victorias</span>
            </div>

            {entries?.map((e, i) => {
              const rango = rangoDeElo(e.elo);
              const pct = e.partidas > 0 ? Math.round((e.ganadas / e.partidas) * 100) : 0;
              return (
                <button
                  key={e.usuario_id}
                  className={`lb-row lb-row-body${e.usuario_id === miUsuarioId ? ' lb-row-me' : ''}`}
                  role="row"
                  onClick={() => setSeleccionado(e)}
                >
                  <span className="lb-col-pos">{i + 1}</span>
                  <span className="lb-col-player">
                    <span className="lb-avatar">{e.username[0].toUpperCase()}</span>
                    <span className="lb-username">@{e.username}</span>
                  </span>
                  <span className="lb-col-elo">
                    {rango.url && <img className="lb-rank-badge" src={rango.url} alt="" />}
                    {e.elo}
                  </span>
                  <span className="lb-col-stat">{e.partidas}</span>
                  <span className="lb-col-stat">{pct}%</span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {seleccionado && (
        <PlayerProfileModal entry={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  );
}
