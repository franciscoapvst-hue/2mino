import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type PartidaHistorial } from '../api';
import { HistoryRow } from './social/MatchHistoryView';

const MAX_PREVIEW = 3;

// ── Vista previa de "últimas partidas" (docs/PLAN_ESCRITORIO.md,
// Etapa 3 — ampliada a pedido: no alcanza con una sola, como en
// chess.com se quiere una lista corta con link a "ver todas"). Reusa
// el mismo HistoryRow que ya pinta el historial completo, para no
// tener dos estéticas distintas de "fila de partida" en la app.
//
// `partidas` opcional: el Dashboard ya trae el historial (para calcular la
// racha), así que se lo pasa y evitamos un segundo fetch. Sin prop, cae al
// fetch propio (sigue usable de forma independiente).
export default function PartidasRecientes({ partidas: partidasProp }: { partidas?: PartidaHistorial[] | null } = {}) {
  const navigate = useNavigate();
  const [partidasFetched, setPartidasFetched] = useState<PartidaHistorial[] | null>(null);
  const controlado = partidasProp !== undefined;

  useEffect(() => {
    if (controlado) return; // el padre provee los datos
    api.historial.misPartidas()
      .then(setPartidasFetched)
      .catch(() => setPartidasFetched([]));
  }, [controlado]);

  const partidas = controlado ? partidasProp : partidasFetched;
  if (!partidas || partidas.length === 0) return null;

  return (
    <section className="dash-partidas">
      <div className="dash-partidas-head">
        <h2 className="dash-section-title dash-section-title-tight">Últimas partidas</h2>
        <button className="dash-partidas-vertodas" onClick={() => navigate('/history')}>
          Ver todas →
        </button>
      </div>
      <div className="dash-partidas-list">
        {partidas.slice(0, MAX_PREVIEW).map(p => (
          <HistoryRow key={p.sala_id} p={p} onVerReplay={(id) => navigate(`/replay/${id}`)} />
        ))}
      </div>
    </section>
  );
}
