import { useState, useEffect, useRef, useCallback } from 'react';
import DominoPiece from './DominoPiece';
import SnakeBoard from './SnakeBoard';
import { puedeJugar, getExtremos } from '../../game/local-rules';
import { api } from '../../api';
import type { PartidaPublica, Pieza, Sala, AuthUser } from '../../api';

type Props = { sala: Sala; user: AuthUser; onExit: () => void };

/**
 * Mide el ancho de un contenedor con ResizeObserver.
 * Usa callback ref: funciona aunque el nodo se monte tarde
 * (p. ej. tras el guard de carga) o se desmonte.
 */
function useMeasuredWidth(): [number, (el: HTMLElement | null) => void] {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const refCb = useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(entries =>
      setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    roRef.current = ro;
  }, []);

  return [width, refCb];
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

export default function GameBoard({ sala, user, onExit }: Props) {
  const [partida,       setPartida]       = useState<PartidaPublica | null>(null);
  const [cargando,      setCargando]      = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [jugando,       setJugando]       = useState(false);
  const [arrastrando,   setArrastrando]   = useState<Pieza | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Pieza | null>(null);
  const [sobreZona,     setSobreZona]     = useState<'izq' | 'der' | null>(null);
  const [nuevaFichaIdx, setNuevaFichaIdx] = useState<number | null>(null);
  const [boardWidth, boardRef] = useMeasuredWidth();
  const [handWidth,  handRef]  = useMeasuredWidth();

  // ── Carga y polling ────────────────────────────
  const fetchPartida = useCallback(async () => {
    try {
      const p = await api.juego.estado(sala.id);
      setPartida(prev => {
        if (prev && p.tablero.length > prev.tablero.length) {
          const lado = p.ultimaJugada?.lado ?? 'der';
          setNuevaFichaIdx(lado === 'der' ? p.tablero.length - 1 : 0);
          setTimeout(() => setNuevaFichaIdx(null), 600);
        }
        return p;
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }, [sala.id]);

  useEffect(() => {
    fetchPartida();
    const id = setInterval(fetchPartida, 2000);
    return () => clearInterval(id);
  }, [fetchPartida]);

  // ── Jugar ficha (API) ─────────────────────────
  async function handleJugar(pieza: Pieza, lado?: 'izq' | 'der') {
    if (jugando) return;
    setJugando(true);
    setSelectedPiece(null);
    setArrastrando(null);
    setSobreZona(null);
    try {
      const nueva = await api.juego.jugar(sala.id, pieza, lado);
      const ladoJugado = nueva.ultimaJugada?.lado ?? 'der';
      setNuevaFichaIdx(ladoJugado === 'der' ? nueva.tablero.length - 1 : 0);
      setTimeout(() => setNuevaFichaIdx(null), 600);
      setPartida(nueva);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Jugada inválida');
      setTimeout(() => setError(null), 2500);
    } finally {
      setJugando(false);
    }
  }

  // ── Pasar turno ───────────────────────────────
  async function handlePasar() {
    if (jugando) return;
    setJugando(true);
    setSelectedPiece(null);
    try {
      setPartida(await api.juego.pasar(sala.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No puedes pasar');
      setTimeout(() => setError(null), 2500);
    } finally {
      setJugando(false);
    }
  }

  // ── Tap-para-seleccionar (funciona en móvil y desktop) ──
  function onTapPieza(pieza: Pieza) {
    if (!esMiTurno || jugando) return;

    // Deseleccionar si se toca la misma ficha
    if (selectedPiece?.a === pieza.a && selectedPiece?.b === pieza.b) {
      setSelectedPiece(null);
      return;
    }

    if (!ext) {
      // Tablero vacío → abrir directamente
      handleJugar(pieza);
      return;
    }

    const ops = puedeJugar(pieza, ext);
    if (!ops.izq && !ops.der) return;

    if (ops.izq && ops.der) {
      // Ambos extremos válidos → mostrar zonas de elección
      setSelectedPiece(pieza);
    } else {
      // Solo un lado → jugar directamente
      handleJugar(pieza, ops.der ? 'der' : 'izq');
    }
  }

  // ── Handlers unificados de zona (drag + tap) ──
  function handlePlayIzq() {
    const pieza = arrastrando ?? selectedPiece;
    if (!pieza) return;
    handleJugar(pieza, 'izq');
  }

  function handlePlayDer() {
    const pieza = arrastrando ?? selectedPiece;
    if (!pieza) return;
    handleJugar(pieza, 'der');
  }

  // ── Drag (desktop) ────────────────────────────
  function onDragStart(e: React.DragEvent<HTMLDivElement>, pieza: Pieza) {
    e.dataTransfer.setData('pieza', JSON.stringify(pieza));
    e.dataTransfer.effectAllowed = 'move';
    setSelectedPiece(null);
    setArrastrando(pieza);
  }

  function onDragEnd() {
    setArrastrando(null);
    setSobreZona(null);
  }

  // ── Guards de carga ───────────────────────────
  if (cargando) {
    return (
      <div className="game-shell">
        <div className="game-loading">
          <div className="boot-spinner" />
          <p>Cargando partida…</p>
        </div>
      </div>
    );
  }

  if (!partida) {
    return (
      <div className="game-shell">
        <div className="game-loading">
          <p>No se encontró la partida.</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={onExit}>Volver</button>
        </div>
      </div>
    );
  }

  // ── Derivados ─────────────────────────────────
  const ext       = getExtremos(partida.tablero);
  const esMiTurno = partida.turno === partida.miSeat && !partida.resultado;
  const maxJ      = partida.maxJugadores;

  const puedoPasar = esMiTurno && ext !== null &&
    !partida.miMano.some(p => { const o = puedeJugar(p, ext); return o.izq || o.der; });

  // Zonas de juego: visibles cuando arrastro O tengo ficha seleccionada
  const selOps = selectedPiece && ext ? puedeJugar(selectedPiece, ext) : null;
  const showZones = esMiTurno && (arrastrando !== null || selectedPiece !== null);
  const canIzq = showZones && (arrastrando !== null ? true : (selOps?.izq ?? false));
  const canDer = showZones && (arrastrando !== null ? true : (selOps?.der ?? false));

  // Escala de piezas en la mano: ajusta para que quepan todas en el ancho disponible
  const HAND_VW = 54, HAND_VH = 100, HAND_GAP = 6;
  const nPiezas = Math.max(1, partida.miMano.length);
  const handScale = handWidth > 0
    ? Math.min(1, (handWidth - (nPiezas - 1) * HAND_GAP) / (nPiezas * HAND_VW))
    : 1;
  const pieceW = Math.floor(HAND_VW * handScale);
  const pieceH = Math.floor(HAND_VH * handScale);

  const nombreAsiento = (seat: number) => partida.asientos[seat]
    ? `@${partida.asientos[seat].username}` : '—';

  const turnoLabel = partida.resultado
    ? 'Partida terminada'
    : esMiTurno ? '¡Tu turno!' : `Turno de ${nombreAsiento(partida.turno)}`;

  return (
    <div className="game-shell">
      {/* ── Nav ─────────────────────────────────── */}
      <nav className="game-nav">
        <button className="btn-back" onClick={onExit}><BackIcon /> Salir</button>
        <span className="game-room-code">{sala.codigo}</span>
        <span className={`game-turn-indicator${esMiTurno ? ' my-turn' : ''}`}>{turnoLabel}</span>
      </nav>

      {error && <div className="game-error-banner">⚠ {error}</div>}

      {/* ── Mesa ────────────────────────────────── */}
      <div className={`game-table table-${maxJ}p`}>
        {maxJ === 4 && (
          <div className="seat seat-left">
            <OpSeat nombre={nombreAsiento(1)} count={partida.conteoManos[1] ?? 0} activo={partida.turno === 1} position="side" />
          </div>
        )}
        <div className="seat seat-top">
          <OpSeat
            nombre={nombreAsiento(maxJ === 2 ? 1 : 2)}
            count={partida.conteoManos[maxJ === 2 ? 1 : 2] ?? 0}
            activo={partida.turno === (maxJ === 2 ? 1 : 2)}
          />
        </div>
        {maxJ === 4 && (
          <div className="seat seat-right">
            <OpSeat nombre={nombreAsiento(3)} count={partida.conteoManos[3] ?? 0} activo={partida.turno === 3} position="side" />
          </div>
        )}

        {/* ── Tablero ───────────────────────────── */}
        <div className="board-center" ref={boardRef}>
          {partida.tablero.length === 0 ? (
            <div className="board-empty-wrap">
              <p className="board-empty-hint">
                {esMiTurno ? 'Toca o arrastra una ficha para abrir' : 'Esperando apertura…'}
              </p>
              {/* Zona de drop cuando está arrastrando con tablero vacío */}
              {esMiTurno && arrastrando && (
                <div
                  className={`drop-zone-open${sobreZona === 'der' ? ' dz-sobre' : ''}`}
                  onDragOver={e => { e.preventDefault(); setSobreZona('der'); }}
                  onDrop={e => { e.preventDefault(); setSobreZona(null); handleJugar(arrastrando); }}
                  onDragLeave={() => setSobreZona(null)}
                >
                  Suelta aquí para abrir
                </div>
              )}
            </div>
          ) : boardWidth > 0 ? (
            <SnakeBoard
              tablero={partida.tablero}
              containerWidth={boardWidth}
              nuevaFichaIdx={nuevaFichaIdx}
              showZones={showZones}
              canIzq={canIzq}
              canDer={canDer}
              sobreIzq={sobreZona === 'izq'}
              sobreDer={sobreZona === 'der'}
              onPlayIzq={handlePlayIzq}
              onPlayDer={handlePlayDer}
              onDragOverIzq={e => { e.preventDefault(); setSobreZona('izq'); }}
              onDragOverDer={e => { e.preventDefault(); setSobreZona('der'); }}
              onDragLeave={() => setSobreZona(null)}
            />
          ) : null}
        </div>
      </div>

      {/* ── Mi mano ──────────────────────────────── */}
      <div className="my-hand-zone">
        <div className="my-hand" ref={handRef}>
          {partida.miMano.map((p, i) => {
            const ops     = ext ? puedeJugar(p, ext) : { izq: true, der: true };
            const jugable = ops.izq || ops.der;
            const isSel   = selectedPiece?.a === p.a && selectedPiece?.b === p.b;
            const canPlay = esMiTurno && jugable && !jugando;
            return (
              <DominoPiece
                key={i}
                a={p.a} b={p.b}
                orient="v"
                selected={isSel}
                playable={canPlay && !isSel}
                disabled={!canPlay}
                draggable={canPlay}
                onDragStart={canPlay ? e => onDragStart(e, p) : undefined}
                onDragEnd={onDragEnd}
                onClick={canPlay ? () => onTapPieza(p) : undefined}
                style={{ width: pieceW, height: pieceH }}
              />
            );
          })}
        </div>

        {esMiTurno && (
          <button
            className="btn-pasar"
            disabled={!puedoPasar || jugando}
            onClick={handlePasar}
          >
            Pasar
          </button>
        )}
      </div>

      {/* ── Resultado ────────────────────────────── */}
      {partida.resultado && (
        <ResultadoOverlay
          resultado={partida.resultado}
          miSeat={partida.miSeat}
          nombreAsiento={nombreAsiento}
          onExit={onExit}
        />
      )}
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────
function OpSeat({ nombre, count, activo, position = 'top' }: {
  nombre: string; count: number; activo: boolean;
  position?: 'top' | 'side';
}) {
  const [cw, ref] = useMeasuredWidth();

  const n   = Math.max(1, count);
  const GAP = 3;

  let orient: 'h' | 'v', pW: number, pH: number;
  if (position === 'side') {
    // Columna estrecha → fichas horizontales apiladas verticalmente
    const s = cw > 0 ? Math.min(1, cw / 100) : 1;
    orient = 'h';
    pW = Math.floor(100 * s);
    pH = Math.floor(54 * s);
  } else {
    // Fila ancha → fichas verticales en fila horizontal
    const s = cw > 0 ? Math.min(1, (cw - (n - 1) * GAP) / (n * 54)) : 1;
    orient = 'v';
    pW = Math.floor(54 * s);
    pH = Math.floor(100 * s);
  }

  return (
    <div className={`opponent-seat${activo ? ' seat-active' : ''}`}>
      <span className="opponent-name">{nombre}</span>
      <div
        ref={ref}
        className={`opponent-pieces${position === 'side' ? ' pieces-side' : ''}`}
      >
        {Array.from({ length: count }).map((_, i) => (
          <DominoPiece
            key={i} a={0} b={0} faceDown orient={orient}
            style={{ width: pW, height: pH }}
          />
        ))}
      </div>
    </div>
  );
}

function ResultadoOverlay({ resultado, miSeat, nombreAsiento, onExit }: {
  resultado: PartidaPublica['resultado'];
  miSeat: number;
  nombreAsiento: (seat: number) => string;
  onExit: () => void;
}) {
  if (!resultado) return null;

  let titulo: string, detalle: string;
  if (resultado.tipo === 'tranca') {
    titulo  = '🔒 Tranca';
    detalle = `Gana el equipo ${resultado.equipoGanador === 0 ? 'A' : 'B'} con menos pips`;
  } else if (resultado.tipo === 'capicua') {
    titulo  = '⚡ ¡Capicúa!';
    detalle = resultado.ganadorSeat === miSeat ? '¡Ganaste tú!' : `Ganó ${nombreAsiento(resultado.ganadorSeat)}`;
  } else {
    titulo  = resultado.ganadorSeat === miSeat ? '🏆 ¡Ganaste!' : '😓 Perdiste';
    detalle = resultado.ganadorSeat === miSeat ? '¡Bien jugado!' : `Ganó ${nombreAsiento(resultado.ganadorSeat)}`;
  }

  return (
    <div className="game-result-overlay">
      <div className="game-result-card">
        <h2>{titulo}</h2>
        <p className="result-points">+{resultado.puntos} pts</p>
        <p className="result-detail">{detalle}</p>
        <button className="btn-primary" onClick={onExit}>Volver a la sala</button>
      </div>
    </div>
  );
}
