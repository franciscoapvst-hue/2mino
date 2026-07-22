import { useEffect, useState } from 'react';
import { api, type PartidaHistorial } from '../../api';
import PageHeader from './PageHeader';

type Props = {
  dark: boolean;
  onBack: () => void;
  onVerReplay: (salaId: string) => void;
};

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// Exportado: lo reusa PartidasRecientes.tsx (preview del dashboard) para
// no duplicar el look de cada fila.
export function HistoryRow({ p, onVerReplay }: { p: PartidaHistorial; onVerReplay: (id: string) => void }) {
  return (
    <button className={`history-row${p.gano ? ' history-row-win' : ' history-row-loss'}`} onClick={() => onVerReplay(p.sala_id)}>
      <span className={`history-result-pill${p.gano ? ' is-win' : ' is-loss'}`}>
        {p.gano ? 'Victoria' : 'Derrota'}
      </span>

      <span className="history-main">
        <span className="history-rival">vs @{p.rival_principal}</span>
        <span className="history-meta">
          {p.tipo_sala === 'ranked' ? 'Ranked' : 'Casual'} · {p.modo === 2 ? '1v1' : '2v2'} · {formatFecha(p.fecha)}
        </span>
      </span>

      <span className="history-score">{p.puntos_favor}–{p.puntos_contra}</span>

      <span className="history-tags">
        {p.capicua && <span className="history-tag" title="Capicúa">⚡</span>}
        {p.tranque && <span className="history-tag" title="Tranca">🔒</span>}
        {p.delta_elo !== null && (
          <span className={`history-delta${p.delta_elo >= 0 ? ' is-pos' : ' is-neg'}`}>
            {p.delta_elo >= 0 ? '+' : ''}{p.delta_elo}
          </span>
        )}
      </span>

      <span className="history-cta">Ver repetición →</span>
    </button>
  );
}

export default function MatchHistoryView({ dark, onBack, onVerReplay }: Props) {
  const [partidas, setPartidas] = useState<PartidaHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.historial.misPartidas()
      .then(setPartidas)
      .catch(() => setError('No se pudo cargar tu historial'));
  }, []);

  const jugadas = partidas?.length ?? 0;
  const ganadas = partidas?.filter(p => p.gano).length ?? 0;

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader
        title="Historial de partidas"
        subtitle={partidas ? `${jugadas} partidas · ${ganadas} ganadas` : undefined}
        onBack={onBack}
      />

      <main className="social-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {partidas === null && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando historial…</p></div>
        ) : partidas?.length === 0 ? (
          <div className="social-empty">
            <p className="social-empty-icon">📜</p>
            <p className="social-empty-msg">Todavía no has jugado ninguna partida</p>
            <p className="social-empty-sub">Cuando termines una, aparecerá aquí con su repetición.</p>
          </div>
        ) : (
          <div className="history-list">
            {partidas?.map(p => (
              <HistoryRow key={p.sala_id} p={p} onVerReplay={onVerReplay} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
