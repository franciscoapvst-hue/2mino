import { useState } from 'react';
import DominoPiece from './DominoPiece';
import { crearSet } from '../../game/local-rules';
import type { Val } from '../../game/local-rules';
import { BackIcon } from '../icons';

const SET = crearSet(); // 28 fichas

const ESTADOS = [
  { label: 'Normal',       props: {} },
  { label: 'Seleccionada', props: { selected: true } },
  { label: 'Jugable',      props: { playable: true } },
  { label: 'Deshabilitada',props: { disabled: true } },
  { label: 'Boca abajo',   props: { faceDown: true } },
  { label: 'Boca abajo V', props: { faceDown: true, orient: 'v' as const } },
];

export default function PieceDemo({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="pdemo">
      <div className="pdemo-inner">
        <button className="pdemo-back" onClick={onBack}><BackIcon /> Volver</button>

        <header className="pdemo-head">
          <h1>Fichas &amp; reglas</h1>
          <p>El set dominicano completo y cómo se ven las fichas en la mesa.</p>
        </header>

        {/* Set completo */}
        <section className="pdemo-section">
          <h2>Set completo <span>0–6 · 28 fichas</span></h2>
          <div className="pdemo-row">
            {SET.map(p => {
              const key = `${p.a}-${p.b}`;
              return (
                <DominoPiece
                  key={key}
                  a={p.a} b={p.b}
                  orient="h"
                  selected={selected === key}
                  playable={selected === null}
                  onClick={() => setSelected(s => s === key ? null : key)}
                />
              );
            })}
          </div>
        </section>

        {/* Dobles */}
        <section className="pdemo-section">
          <h2>Fichas dobles <span>se cruzan en el tablero</span></h2>
          <div className="pdemo-row">
            {([0,1,2,3,4,5,6] as Val[]).map(v => (
              <DominoPiece key={v} a={v} b={v} orient="v" />
            ))}
          </div>
        </section>

        {/* Estados */}
        <section className="pdemo-section">
          <h2>Estados</h2>
          <div className="pdemo-row pdemo-states">
            {ESTADOS.map(({ label, props }) => (
              <div key={label} className="pdemo-state">
                <span className="pdemo-state-label">{label}</span>
                <DominoPiece a={3} b={5} {...props} />
              </div>
            ))}
          </div>
        </section>

        {/* Reglas */}
        <section className="pdemo-section">
          <h2>Reglas dominicanas</h2>
          <div className="pdemo-rules">
            <div className="pdemo-rule">
              <span className="pdemo-rule-icon">🎯</span>
              <p><strong>Set:</strong> 0 (blanco) al 6 — 28 fichas en total.</p>
            </div>
            <div className="pdemo-rule">
              <span className="pdemo-rule-icon">🏆</span>
              <p><strong>Victoria normal:</strong> el ganador suma los pips restantes del equipo contrario.</p>
            </div>
            <div className="pdemo-rule">
              <span className="pdemo-rule-icon">⚡</span>
              <p><strong>Capicúa:</strong> si la última ficha encaja en ambos extremos del tablero → <em>30 puntos</em>.</p>
            </div>
            <div className="pdemo-rule">
              <span className="pdemo-rule-icon">🔒</span>
              <p><strong>Tranca:</strong> si todos pasan sin poder jugar → gana el equipo con menos pips → <em>30 puntos</em>.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
