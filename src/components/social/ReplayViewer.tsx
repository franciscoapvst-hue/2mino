import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { Movimiento, ReplayData } from '../../game/replay-engine';
import { tableroHastaMovimiento } from '../../game/replay-engine';
import SnakeBoardReadOnly from '../game/SnakeBoardReadOnly';
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from '../icons';
import PageHeader from './PageHeader';

type Props = {
  dark: boolean;
  salaId: string;
  onBack: () => void;
};

const VELOCIDADES = [1, 2, 4] as const;
const MS_BASE = 900;

function describirMovimiento(m: Movimiento, nombre: string): string {
  if (m.tipo === 'pasar') return `${nombre} pasó`;
  const p = m.pieza!;
  return `${nombre} jugó ${p.a}|${p.b} — ${m.lado === 'der' ? 'derecha' : 'izquierda'}`;
}

export default function ReplayViewer({ dark, salaId, onBack }: Props) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indice, setIndice] = useState(-1); // -1 = tablero vacío, antes del primer movimiento
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState<typeof VELOCIDADES[number]>(1);
  const [boardWidth, boardRef] = useMeasuredWidth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.historial.replay(salaId)
      .then(setData)
      .catch(() => setError('No se pudo cargar la repetición'));
  }, [salaId]);

  const total = data?.movimientos.length ?? 0;

  // Autoplay
  useEffect(() => {
    if (!reproduciendo || !data) return;
    timerRef.current = setInterval(() => {
      setIndice(i => {
        if (i >= total - 1) {
          setReproduciendo(false);
          return i;
        }
        return i + 1;
      });
    }, MS_BASE / velocidad);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [reproduciendo, velocidad, data, total]);

  const nombreDeSeat = useMemo(() => (seat: number) => data?.asientos[seat]?.username ?? '—', [data]);

  const tablero = data ? tableroHastaMovimiento(data.movimientos, indice) : [];
  const movActual = data && indice >= 0 ? data.movimientos[indice] : null;
  const terminado = total > 0 && indice === total - 1;

  function togglePlay() {
    if (indice >= total - 1) setIndice(-1); // si ya terminó, reinicia al darle play
    setReproduciendo(r => !r);
  }

  const resultadoTexto = (() => {
    if (!terminado || !data) return null;
    const { tipo, ganadorSeat, equipoGanador } = data.resultado;
    if (tipo === 'tranca') {
      return equipoGanador === null ? 'Tranca — empate, nadie suma' : `Tranca — gana el equipo de ${equipoGanador === 0 ? nombreDeSeat(0) : nombreDeSeat(1)}`;
    }
    const nombre = ganadorSeat !== null ? nombreDeSeat(ganadorSeat) : '—';
    return tipo === 'capicua' ? `¡Capicúa! Cierra ${nombre}` : `Mano ganada por ${nombre}`;
  })();

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader title="Repetición" subtitle={data ? `${data.asientos.map(a => `@${a.username}`).join(' vs ')}` : undefined} onBack={onBack} />

      <main className="social-body replay-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {!data && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando repetición…</p></div>
        ) : data ? (
          <>
            <div className="replay-caption">
              {movActual
                ? <span>Jugada {indice + 1}/{total} · {describirMovimiento(movActual, nombreDeSeat(movActual.seat))}</span>
                : <span>Jugada 0/{total} · Toca ▶ para reproducir</span>}
            </div>

            <div className="replay-board" ref={boardRef}>
              <SnakeBoardReadOnly
                tablero={tablero}
                containerWidth={boardWidth}
                emptyHint="La mesa está vacía todavía"
                emptyClassName="replay-board-empty"
              />
            </div>

            {resultadoTexto && (
              <div className="replay-result-banner">{resultadoTexto}</div>
            )}

            <div className="replay-controls">
              <div className="replay-scrub">
                <input
                  type="range"
                  min={-1}
                  max={total - 1}
                  value={indice}
                  onChange={e => { setReproduciendo(false); setIndice(Number(e.target.value)); }}
                />
              </div>

              <div className="replay-buttons">
                <button className="replay-btn" onClick={() => { setReproduciendo(false); setIndice(-1); }} aria-label="Reiniciar">
                  <SkipBackIcon />
                </button>
                <button className="replay-btn replay-btn-play" onClick={togglePlay} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}>
                  {reproduciendo ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button className="replay-btn" onClick={() => { setReproduciendo(false); setIndice(total - 1); }} aria-label="Ir al final">
                  <SkipForwardIcon />
                </button>

                <div className="replay-speeds">
                  {VELOCIDADES.map(v => (
                    <button
                      key={v}
                      className={`replay-speed-btn${velocidad === v ? ' active' : ''}`}
                      onClick={() => setVelocidad(v)}
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
