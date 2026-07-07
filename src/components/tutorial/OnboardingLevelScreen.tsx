import { useState } from 'react';
import { Bone } from '../DominoStage';

export type NivelDomino = 'nada' | 'intermedio' | 'suficiente';

type Props = {
  dark: boolean;
  onElegir: (nivel: NivelDomino) => void | Promise<void>;
};

const OPCIONES: { nivel: NivelDomino; titulo: string; desc: string }[] = [
  { nivel: 'nada', titulo: 'Nada', desc: 'Nunca he jugado dominó — explícamelo desde cero.' },
  { nivel: 'intermedio', titulo: 'Intermedio', desc: 'Sé jugar, pero repasar la mesa y los controles no está de más.' },
  { nivel: 'suficiente', titulo: 'Lo suficiente', desc: 'Ya conozco el juego y esta app — llévame directo al lobby.' },
];

export default function OnboardingLevelScreen({ dark, onElegir }: Props) {
  const [eligiendo, setEligiendo] = useState<NivelDomino | null>(null);

  async function elegir(nivel: NivelDomino) {
    if (eligiendo) return;
    setEligiendo(nivel);
    await onElegir(nivel);
  }

  return (
    <div className={`dash social-page onb-shell${dark ? '' : ' is-light'}`}>
      <main className="social-body onb-body">
        <div className="onb-mark">
          <Bone a={6} b={6} className="onb-mark-tile" />
        </div>
        <h1>¿Qué tanto sabes de dominó?</h1>
        <p className="onb-sub">Así ajustamos si te conviene un repaso rápido de la mesa antes de jugar.</p>

        <div className="onb-options">
          {OPCIONES.map(o => (
            <button
              key={o.nivel}
              className="onb-option"
              disabled={eligiendo !== null}
              onClick={() => elegir(o.nivel)}
            >
              <span className="onb-option-title">
                {o.titulo}
                {eligiendo === o.nivel && <span className="onb-option-loading">…</span>}
              </span>
              <span className="onb-option-desc">{o.desc}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
