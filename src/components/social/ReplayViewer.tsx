import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { Movimiento, ReplayData, ResultadoMano } from '../../game/replay-engine';
import { agruparPorMano, resultadoDeMano, tableroHastaMovimiento } from '../../game/replay-engine';
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

function textoResultadoMano(r: ResultadoMano, nombreDeEquipo: (eq: 0 | 1) => string): string {
  const equipoTxt = r.equipo !== null ? nombreDeEquipo(r.equipo) : '—';
  if (r.tipo === 'paso_a_todos') {
    if (r.noCaben) return `¡Bono "pasó a todos"! Pero no caben — no suma, sigue la partida`;
    // La mano no tuvo cierre formal: el bono empujó el marcador al
    // objetivo a mitad de mano y ahí terminó la partida.
    return `¡Bono "pasó a todos"! +${r.puntos} para el equipo de ${equipoTxt} — así cerró la partida`;
  }
  if (r.tipo === 'tranca') {
    if (r.noCaben) return 'Tranca — ¡No caben! (se pasaría de objetivo, no suma)';
    return r.equipo === null ? 'Tranca — empate, nadie suma' : `Tranca — gana el equipo de ${nombreDeEquipo(r.equipo)}`;
  }
  return r.tipo === 'capicua' ? `¡Capicúa! Gana el equipo de ${equipoTxt}` : `Mano ganada por el equipo de ${equipoTxt}`;
}

export default function ReplayViewer({ dark, salaId, onBack }: Props) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manoActual, setManoActual] = useState(0);
  const [indice, setIndice] = useState(-1); // -1 = tablero vacío, antes del primer movimiento DE ESTA MANO
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState<typeof VELOCIDADES[number]>(1);
  const [boardWidth, boardRef] = useMeasuredWidth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.historial.replay(salaId)
      .then(setData)
      .catch(() => setError('No se pudo cargar la repetición'));
  }, [salaId]);

  // Movimientos agrupados por mano — cada mano arranca con el tablero
  // vacío (se reparten fichas nuevas), nunca se mezclan entre sí.
  const gruposPorMano = useMemo(() => (data ? agruparPorMano(data.movimientos) : []), [data]);
  const totalManos = gruposPorMano.length;
  const movimientosDeEstaMano = gruposPorMano[manoActual] ?? [];
  const total = movimientosDeEstaMano.length;
  const numeroManoActual = movimientosDeEstaMano[0]?.numeroMano ?? manoActual + 1;
  const resultadoDeEstaMano = data ? resultadoDeMano(data.manos, numeroManoActual) : null;

  // Autoplay — se detiene al llegar al final de la mano actual (no avanza
  // solo a la siguiente, para que el jugador vea el resultado con calma).
  useEffect(() => {
    if (!reproduciendo) return;
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
  }, [reproduciendo, velocidad, total]);

  const nombreDeSeat = useMemo(() => (seat: number) => data?.asientos[seat]?.username ?? '—', [data]);
  const nombreDeEquipo = useMemo(() => (eq: 0 | 1) => {
    if (!data) return '—';
    const nombres = data.asientos.filter((_, i) => i % 2 === eq).map(a => `@${a.username}`);
    return nombres.join(' y ') || '—';
  }, [data]);

  const tablero = tableroHastaMovimiento(movimientosDeEstaMano, indice);
  const movActual = indice >= 0 ? movimientosDeEstaMano[indice] : null;
  const terminadaEstaMano = total > 0 && indice === total - 1;
  const esUltimaMano = manoActual === totalManos - 1;

  function irAIndice(i: number) {
    setReproduciendo(false);
    setIndice(Math.max(-1, Math.min(total - 1, i)));
  }

  function togglePlay() {
    if (indice >= total - 1) setIndice(-1); // si ya terminó, reinicia al darle play
    setReproduciendo(r => !r);
  }

  function irAMano(i: number) {
    if (i < 0 || i >= totalManos) return;
    setReproduciendo(false);
    setManoActual(i);
    setIndice(-1);
  }

  const resultadoTexto = resultadoDeEstaMano ? textoResultadoMano(resultadoDeEstaMano, nombreDeEquipo) : null;

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader title="Repetición" subtitle={data ? `${data.asientos.map(a => `@${a.username}`).join(' vs ')}` : undefined} onBack={onBack} />

      <main className="social-body replay-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {!data && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando repetición…</p></div>
        ) : data ? (
          <>
            {totalManos > 1 && (
              <div className="replay-manos-nav">
                <button className="replay-btn" onClick={() => irAMano(manoActual - 1)} disabled={manoActual === 0} aria-label="Mano anterior">
                  ‹
                </button>
                <div className="replay-manos-dots">
                  {gruposPorMano.map((_, i) => (
                    <span key={i} className={`replay-mano-dot${i === manoActual ? ' is-active' : ''}${i < manoActual ? ' is-done' : ''}`} />
                  ))}
                </div>
                <span className="replay-manos-label">Mano {manoActual + 1} de {totalManos}</span>
                <button className="replay-btn" onClick={() => irAMano(manoActual + 1)} disabled={manoActual === totalManos - 1} aria-label="Mano siguiente">
                  ›
                </button>
              </div>
            )}

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

            {resultadoTexto && terminadaEstaMano && (
              <div className="replay-result-banner">
                {resultadoTexto}
                {resultadoDeEstaMano?.marcador && (
                  <span className="replay-result-marcador">
                    {' '}· {resultadoDeEstaMano.marcador[0]} - {resultadoDeEstaMano.marcador[1]}
                  </span>
                )}
              </div>
            )}

            {terminadaEstaMano && !esUltimaMano && (
              <button className="replay-siguiente-mano-btn" onClick={() => irAMano(manoActual + 1)}>
                Mano siguiente →
              </button>
            )}

            <div className="replay-controls">
              <div className="replay-scrub">
                <input
                  type="range"
                  min={-1}
                  max={total - 1}
                  value={indice}
                  onChange={e => irAIndice(Number(e.target.value))}
                />
              </div>

              <div className="replay-buttons">
                <button className="replay-btn" onClick={() => irAIndice(-1)} aria-label="Reiniciar mano">
                  <SkipBackIcon />
                </button>
                <button className="replay-btn replay-btn-step" onClick={() => irAIndice(indice - 1)} disabled={indice <= -1} aria-label="Jugada anterior">
                  ‹
                </button>
                <button className="replay-btn replay-btn-play" onClick={togglePlay} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}>
                  {reproduciendo ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button className="replay-btn replay-btn-step" onClick={() => irAIndice(indice + 1)} disabled={indice >= total - 1} aria-label="Jugada siguiente">
                  ›
                </button>
                <button className="replay-btn" onClick={() => irAIndice(total - 1)} aria-label="Ir al final de la mano">
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
