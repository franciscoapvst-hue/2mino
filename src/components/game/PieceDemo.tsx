import { useState } from 'react';
import DominoPiece from './DominoPiece';
import { crearSet } from '../../game/types';
import type { Val } from '../../game/types';

const SET = crearSet(); // 28 fichas

export default function PieceDemo({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="piece-demo">
      <button className="btn-back" style={{ marginBottom: 24 }} onClick={onBack}>
        ← Volver
      </button>

      {/* Set completo */}
      <div className="piece-demo-section">
        <h3>Set completo — 0 a 6 (28 fichas)</h3>
        <div className="piece-demo-row">
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
      </div>

      {/* Fichas dobles (verticales) */}
      <div className="piece-demo-section">
        <h3>Fichas dobles (vertical)</h3>
        <div className="piece-demo-row">
          {([0,1,2,3,4,5,6] as Val[]).map(v => (
            <DominoPiece key={v} a={v} b={v} orient="v" />
          ))}
        </div>
      </div>

      {/* Estados */}
      <div className="piece-demo-section">
        <h3>Estados</h3>
        <div className="piece-demo-row">
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '.75rem', marginBottom: 6 }}>Normal</p>
            <DominoPiece a={3} b={5} />
          </div>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '.75rem', marginBottom: 6 }}>Seleccionada</p>
            <DominoPiece a={3} b={5} selected />
          </div>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '.75rem', marginBottom: 6 }}>Jugable</p>
            <DominoPiece a={3} b={5} playable />
          </div>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '.75rem', marginBottom: 6 }}>Deshabilitada</p>
            <DominoPiece a={3} b={5} disabled />
          </div>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '.75rem', marginBottom: 6 }}>Boca abajo</p>
            <DominoPiece a={3} b={5} faceDown />
          </div>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: '.75rem', marginBottom: 6 }}>Boca abajo V</p>
            <DominoPiece a={3} b={5} faceDown orient="v" />
          </div>
        </div>
      </div>

      {/* Info reglas */}
      <div className="piece-demo-section">
        <h3>Reglas dominicanas</h3>
        <div style={{ color: 'var(--text-dim)', fontSize: '.9rem', lineHeight: 1.7, maxWidth: 520 }}>
          <p>🎯 <strong style={{ color: 'var(--text)' }}>Set:</strong> 0 (blanco) al 6 — 28 fichas en total.</p>
          <p>🏆 <strong style={{ color: 'var(--text)' }}>Victoria normal:</strong> el ganador suma los pips restantes del equipo contrario.</p>
          <p>⚡ <strong style={{ color: 'var(--text)' }}>Capicúa:</strong> si la última ficha encaja en ambos extremos del tablero → <strong style={{ color: '#c084fc' }}>30 puntos</strong>.</p>
          <p>🔒 <strong style={{ color: 'var(--text)' }}>Tranca:</strong> si todos pasan sin poder jugar → gana el equipo con menos pips → <strong style={{ color: '#c084fc' }}>30 puntos</strong>.</p>
        </div>
      </div>
    </div>
  );
}
