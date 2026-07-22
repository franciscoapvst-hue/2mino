import { useEffect, useState } from 'react';
import { api } from '../api';

type Stats = { elo: number; partidas: number; ganadas: number; capicuas: number };

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="dash-stat">
      <span className="dash-stat-value">{value}</span>
      <span className="dash-stat-label">{label}</span>
    </div>
  );
}

// ── Fila de contadores (docs/PLAN_ESCRITORIO.md, Etapa 3) ──────────
// ELO/partidas/ganadas/capicúas ya existen (api.ranked.me() +
// api.social.perfilJugador()); racha de días/victorias quedan como
// placeholder "—" hasta que aterrice la racha real (PLAN_RETENCION.md,
// S4) — el plan es explícito en dejar el hueco, no inventar el dato.
export default function StatsFila() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelado = false;
    api.ranked.me()
      .then(async r => {
        const entry = { usuario_id: r.usuario_id, username: '', elo: r.elo, partidas: r.partidas, ganadas: r.ganadas };
        const perfil = await api.social.perfilJugador(entry).catch(() => null);
        if (cancelado) return;
        setStats({ elo: r.elo, partidas: r.partidas, ganadas: r.ganadas, capicuas: perfil?.capicuas ?? 0 });
      })
      .catch(() => { if (!cancelado) setStats(null); }); // invitado o sin ranked aún
    return () => { cancelado = true; };
  }, []);

  return (
    <div className="dash-stats-fila">
      <StatTile label="Racha de días" value="—" />
      <StatTile label="Racha de victorias" value="—" />
      <StatTile label="ELO" value={stats?.elo ?? '—'} />
      <StatTile label="Partidas" value={stats?.partidas ?? '—'} />
      <StatTile label="Ganadas" value={stats?.ganadas ?? '—'} />
      <StatTile label="Capicúas" value={stats?.capicuas ?? '—'} />
    </div>
  );
}
