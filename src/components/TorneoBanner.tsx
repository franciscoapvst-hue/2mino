import { useEffect, useState } from 'react';
import { api, type TorneoProximo } from '../api';
import GameIcon from './GameIcons';

// ── Banner de torneos (docs/PLAN_ESCRITORIO.md, punto 13/Etapa 4) ──
// Eje de monetización: hero destacado, distinto del resto de tarjetas,
// con la fecha del próximo torneo público abierto a inscripción. Si no
// hay ninguno (o falla la carga), no renderiza nada — no vale la pena
// un hueco vacío o un placeholder por un torneo que no existe.
export default function TorneoBanner({ onClick }: { onClick: () => void }) {
  const [torneo, setTorneo] = useState<TorneoProximo | null>(null);

  useEffect(() => {
    api.torneos.proximo()
      .then(setTorneo)
      .catch(() => setTorneo(null));
  }, []);

  if (!torneo) return null;

  const fecha = new Date(torneo.fecha_inicio).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <button className="dash-torneo-banner" onClick={onClick}>
      <span className="dash-torneo-icon"><GameIcon name="torneos" size={56} /></span>
      <span className="dash-torneo-body">
        <span className="dash-torneo-kicker">Torneo abierto</span>
        <span className="dash-torneo-nombre">{torneo.nombre}</span>
        <span className="dash-torneo-fecha">Empieza el {fecha}</span>
      </span>
      <span className="dash-torneo-cta">Inscribirme →</span>
    </button>
  );
}
