import { useState, useEffect, useRef, useCallback } from 'react';
import DominoPiece from './DominoPiece';
import SnakeBoard from './SnakeBoard';
import { puedeJugar, getExtremos } from '../../game/types';
import { api } from '../../api';
import type { PartidaPublica, Pieza, Sala, AuthUser } from '../../api';

type Props = {
  sala:   Sala;
  user:   AuthUser;
  onExit: () => void;
};

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

export default function GameBoard({ sala, user, onExit }: Props) {
  const [partida,     setPartida]     = useState<PartidaPublica | null>(null);
  const [cargando,    setCargando]    = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [jugando,     setJugando]     = useState(false);
  const [arrastrando, setArrastrando] = useState<Pieza | null>(null);
  const [sobreZona,   setSobreZona]   = useState<'izq' | 'der' | null>(null);
  const [nuevaFichaIdx, setNuevaFichaIdx] = useState<number | null>(null);
  const [boardWidth,  setBoardWidth]  = useState(600);

  const prevLenRef    = useRef(0);
  const boardCenterRef = useRef<HTMLDivElement>(null);

  // ── Carga y polling del estado del juego ─────────
  const fetchPartida = useCallback(async () => {
    try {
      const p = await api.juego.estado(sala.id);
      setPartida(prev => {
        // Detectar pieza nueva en tablero para animación
        if (prev && p.tablero.length > prev.tablero.length) {
          const ladoNuevo = p.ultimaJugada?.lado ?? 'der';
          const idx = ladoNuevo === 'der' ? p.tablero.length - 1 : 0;
          setNuevaFichaIdx(idx);
          setTimeout(() => setNuevaFichaIdx(null), 600);
        }
        prevLenRef.current = p.tablero.length;
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

  // Mide el ancho del contenedor del tablero (para escalar fichas)
  useEffect(() => {
    const el = boardCenterRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setBoardWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setBoardWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // ── Jugar una ficha ───────────────────────────────
  async function handleJugar(pieza: Pieza, lado?: 'izq' | 'der') {
    if (jugando) return;
    setJugando(true);
    try {
      const nueva = await api.juego.jugar(sala.id, pieza, lado);
      const ladoJugado = nueva.ultimaJugada?.lado ?? 'der';
      const idx = ladoJugado === 'der' ? nueva.tablero.length - 1 : 0;
      setNuevaFichaIdx(idx);
      setTimeout(() => setNuevaFichaIdx(null), 600);
      setPartida(nueva);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Jugada inválida');
      setTimeout(() => setError(null), 2500);
    } finally {
      setJugando(false);
      setArrastrando(null);
    }
  }

  // ── Pasar turno ───────────────────────────────────
  async function handlePasar() {
    if (jugando) return;
    setJugando(true);
    try {
      const nueva = await api.juego.pasar(sala.id);
      setPartida(nueva);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No puedes pasar');
      setTimeout(() => setError(null), 2500);
    } finally {
      setJugando(false);
    }
  }

  // ── Drag handlers ─────────────────────────────────
  function onDragStart(e: React.DragEvent, pieza: Pieza) {
    e.dataTransfer.setData('pieza', JSON.stringify(pieza));
    e.dataTransfer.effectAllowed = 'move';
    setArrastrando(pieza);
  }

  function onDragOver(e: React.DragEvent, zona: 'izq' | 'der') {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setSobreZona(zona);
  }

  function onDrop(e: React.DragEvent, lado: 'izq' | 'der') {
    e.preventDefault();
    setSobreZona(null);
    const data = e.dataTransfer.getData('pieza');
    if (!data) return;
    const pieza = JSON.parse(data) as Pieza;
    handleJugar(pieza, lado);
  }

  function onDragEnd() {
    setArrastrando(null);
    setSobreZona(null);
  }

  // ── Derivados de estado ───────────────────────────
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

  const ext          = getExtremos(partida.tablero);
  const esMiTurno    = partida.turno === partida.miSeat && !partida.resultado;
  const maxJ         = partida.maxJugadores;

  const puedoPasar = esMiTurno && ext !== null &&
    !partida.miMano.some(p => { const o = puedeJugar(p, ext); return o.izq || o.der; });

  const nombreAsiento = (seat: number) => {
    const a = partida.asientos[seat];
    return a ? `@${a.username}` : '—';
  };

  // Indicador de turno
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

      {error && (
        <div className="game-error-banner">⚠ {error}</div>
      )}

      {/* ── Mesa ────────────────────────────────── */}
      <div className={`game-table table-${maxJ}p`}>

        {/* Rivales / compañero */}
        {maxJ === 4 && (
          <div className="seat seat-left">
            <OpSeat nombre={nombreAsiento(1)} count={partida.conteoManos[1] ?? 0} activo={partida.turno === 1} />
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
            <OpSeat nombre={nombreAsiento(3)} count={partida.conteoManos[3] ?? 0} activo={partida.turno === 3} />
          </div>
        )}

        {/* ── Tablero ───────────────────────────── */}
        <div className="board-center" ref={boardCenterRef}>
          {partida.tablero.length === 0 ? (
            <>
              <p className="board-empty-hint">
                {esMiTurno ? 'Arrastra una ficha para abrir el tablero' : 'Esperando apertura…'}
              </p>
              {esMiTurno && arrastrando && (
                <div
                  className={`drop-zone-open${sobreZona === 'der' ? ' dz-sobre' : ''}`}
                  onDragOver={e => onDragOver(e, 'der')}
                  onDrop={e => onDrop(e, 'der')}
                  onDragLeave={() => setSobreZona(null)}
                >
                  Suelta aquí para abrir
                </div>
              )}
            </>
          ) : (
            <SnakeBoard
              tablero={partida.tablero}
              containerWidth={boardWidth}
              nuevaFichaIdx={nuevaFichaIdx}
              isDragging={esMiTurno && arrastrando !== null}
              sobreIzq={sobreZona === 'izq'}
              sobreDer={sobreZona === 'der'}
              onDragOverIzq={e => onDragOver(e, 'izq')}
              onDragOverDer={e => onDragOver(e, 'der')}
              onDropIzq={e => onDrop(e, 'izq')}
              onDropDer={e => onDrop(e, 'der')}
              onDragLeave={() => setSobreZona(null)}
            />
          )}
        </div>
      </div>

      {/* ── Mi mano ──────────────────────────────── */}
      <div className="my-hand-zone">
        <div className="my-hand">
          {partida.miMano.map((p, i) => {
            const ops = ext ? puedeJugar(p, ext) : { izq: true, der: true };
            const jugable = ops.izq || ops.der;
            const dragg   = esMiTurno && jugable && !jugando;
            return (
              <DominoPiece
                key={i}
                a={p.a} b={p.b}
                orient="v"
                playable={esMiTurno && jugable}
                disabled={!esMiTurno || !jugable}
                draggable={dragg}
                onDragStart={dragg ? e => onDragStart(e, p) : undefined}
                onDragEnd={onDragEnd}
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
            Pasar turno
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

// ── Sub-componentes ──────────────────────────────
function OpSeat({ nombre, count, activo }: { nombre: string; count: number; activo: boolean }) {
  return (
    <div className={`opponent-seat${activo ? ' seat-active' : ''}`}>
      <span className="opponent-name">{nombre}</span>
      <div className="opponent-pieces">
        {Array.from({ length: count }).map((_, i) => (
          <DominoPiece key={i} a={0} b={0} faceDown orient="v" />
        ))}
      </div>
    </div>
  );
}

function DropZone({ lado, activa, sobre, onDragOver, onDrop, onDragLeave }: {
  lado: 'izq' | 'der'; activa: boolean; sobre: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop:     (e: React.DragEvent) => void;
  onDragLeave: () => void;
}) {
  if (!activa) return null;
  return (
    <div
      className={`drop-zone${sobre ? ' dz-sobre' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {lado === 'izq' ? '◀' : '▶'}
    </div>
  );
}

function ResultadoOverlay({ resultado, miSeat, nombreAsiento, onExit }: {
  resultado: PartidaPublica['resultado'];
  miSeat:    number;
  nombreAsiento: (seat: number) => string;
  onExit: () => void;
}) {
  if (!resultado) return null;

  let titulo: string;
  let detalle: string;

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
