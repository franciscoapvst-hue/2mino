// Íconos dimensionales de destino (modos/secciones) — raster, generados y
// extraídos de una hoja de Gemini (ver src/assets/iconos/).
//
// Convención deliberada, misma que usa chess.com:
//   · COLORIDO + dimensional  -> destinos: Ranked, Casual, Salas, Torneos…
//   · LÍNEA (icons.tsx)       -> chrome de utilidad: Amigos, Bandeja, tema…
// No mezclar: estos son escenas con varios objetos y por debajo de ~40px se
// vuelven ilegibles (probado: a 22px la mesa es una mancha). Los de utilidad
// viven a 16px, por eso siguen siendo SVG de línea.
import rankedImg      from '../assets/iconos/ranked.webp';
import casualImg      from '../assets/iconos/casual.webp';
import salasImg       from '../assets/iconos/salas.webp';
import torneosImg     from '../assets/iconos/torneos.webp';
import leaderboardImg from '../assets/iconos/leaderboard.webp';
import historialImg   from '../assets/iconos/historial.webp';

const SRC = {
  ranked:      rankedImg,
  casual:      casualImg,
  salas:       salasImg,
  torneos:     torneosImg,
  leaderboard: leaderboardImg,
  historial:   historialImg,
} as const;

export type GameIconName = keyof typeof SRC;

/** Ícono de destino. `size` en px — no bajar de 40 (ver nota de arriba). */
export default function GameIcon({ name, size = 48 }: { name: GameIconName; size?: number }) {
  return (
    <img
      src={SRC[name]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="game-icon"
      loading="lazy"
      decoding="async"
    />
  );
}
