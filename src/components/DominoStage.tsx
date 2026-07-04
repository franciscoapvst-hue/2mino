import { useRef, useCallback } from 'react';

// ── Ficha de dominó (hueso + pintas), material de marca ──
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};
const G = [22, 50, 78]; // rejilla 3×3 dentro de una mitad

function Half({ value }: { value: number }) {
  return (
    <>
      {PIPS[value].map(([c, r], i) => (
        <circle key={i} cx={G[c]} cy={G[r]} r={8.5} className="lg-pip" />
      ))}
    </>
  );
}

export function Bone({ a, b, className = '', style }: {
  a: number; b: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 100 200" className={`lg-bone ${className}`} style={style} aria-hidden="true">
      <rect x="3" y="3" width="94" height="194" rx="14" className="lg-bone-body" />
      <line x1="14" y1="100" x2="86" y2="100" className="lg-bone-divider" />
      <Half value={a} />
      <g transform="translate(0 100)"><Half value={b} /></g>
    </svg>
  );
}

// ── Escena de marca: la mesa de dominó de noche ──
export function DominoStage({ blurb }: { blurb?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
  }, []);

  return (
    <section className="lg-scene" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="lg-scene-inner">
        <div className="lg-tiles" aria-hidden="true">
          <Bone a={6} b={6} className="lg-tile lg-tile-1" />
          <Bone a={6} b={3} className="lg-tile lg-tile-2" />
          <Bone a={5} b={2} className="lg-tile lg-tile-3" />
        </div>

        <div className="lg-brand">
          <h1 className="lg-wordmark"><span>2</span>mino</h1>
          <p className="lg-tagline">Juega. Compite. Domina.</p>
          {blurb && <p className="lg-blurb">{blurb}</p>}
        </div>
      </div>
    </section>
  );
}
