/**
 * Harness de desarrollo para SnakeBoard — NO es parte del build de
 * producción (vite build solo empaqueta index.html). Monta el componente
 * REAL con tableros sintéticos para verificar visualmente:
 *  - fantasma izq/der pegado a las puntas (fila centrada y serpiente)
 *  - giros en U, dobles junto al giro, mid-corner
 *  - fit-scale cuando la serpiente supera el alto del contenedor
 * Abrir en: http://localhost:5173/dev-board.html
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SnakeBoard from '../components/game/SnakeBoard';
import type { FichaTablero, Val, Pieza } from '../api';
import '../styles.css';
import '../game.css';

// Cadena válida: derVal(i) === izqVal(i+1). Cada ~4 fichas mete un doble.
function cadena(n: number): FichaTablero[] {
  const out: FichaTablero[] = [];
  let v: Val = 6;
  for (let i = 0; i < n; i++) {
    const esDoble = i % 4 === 2;
    const next: Val = esDoble ? v : (((v + i) % 7) as Val);
    out.push({ pieza: { a: v, b: next } as Pieza, izqVal: v, derVal: next });
    v = next;
  }
  return out;
}

const SIZE = 480;

function Caso({ titulo, n, conFantasma = true }: { titulo: string; n: number; conFantasma?: boolean }) {
  const tablero = cadena(n);
  const fantasma: Pieza | null = conFantasma
    ? ({ a: tablero[0].izqVal, b: tablero[tablero.length - 1].derVal } as Pieza)
    : null;
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: '#eee', fontFamily: 'monospace' }}>{titulo} — {n} fichas</h3>
      <div
        style={{
          width: SIZE, height: SIZE, overflow: 'hidden', border: '2px solid #e11',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#123524',
        }}
      >
        <SnakeBoard
          tablero={tablero}
          containerWidth={SIZE}
          nuevaFichaIdx={null}
          piezaFantasma={fantasma}
          canIzq={!!fantasma}
          canDer={!!fantasma}
          sobreIzq={false}
          sobreDer={false}
          onPlayIzq={() => {}}
          onPlayDer={() => {}}
          onDragOverIzq={() => {}}
          onDragOverDer={() => {}}
          onDragLeave={() => {}}
        />
      </div>
    </div>
  );
}

function Harness() {
  const [n, setN] = useState(3);
  return (
    <div style={{ padding: 24, background: '#0a0f0c', minHeight: '100vh' }}>
      <div style={{ marginBottom: 16 }}>
        {[1, 2, 3, 5, 6, 7, 8, 14, 20, 26].map(v => (
          <button key={v} onClick={() => setN(v)} style={{ fontSize: 16, marginRight: 6, fontWeight: n === v ? 700 : 400 }}>
            {v}
          </button>
        ))}
        <span style={{ color: '#eee', marginLeft: 12, fontFamily: 'monospace' }}>fichas: {n}</span>
      </div>
      <Caso titulo="Caso" n={n} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
