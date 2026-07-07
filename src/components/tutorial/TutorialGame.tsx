import { useMemo, useState } from 'react';
import DominoPiece from '../game/DominoPiece';
import SnakeBoard from '../game/SnakeBoard';
import { BackIcon, ChatIcon } from '../icons';
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth';
import { aplicarMovimientoTablero } from '../../game/replay-engine';
import type { FichaTablero, Pieza } from '../../api';
import { PASOS } from '../../tutorial/script';

type Props = {
  onSkip: () => void;
  onFinish: () => void;
};

// Mano falsa: la primera ficha (6-6) es la que se enseña a jugar —
// tablero vacío, cualquier ficha abriría, pero solo ese doble se resalta
// para que el paso sea inequívoco.
const MANO_INICIAL: Pieza[] = [
  { a: 6, b: 6 },
  { a: 3, b: 5 },
  { a: 2, b: 2 },
  { a: 1, b: 4 },
];

export default function TutorialGame({ onSkip, onFinish }: Props) {
  const [paso, setPaso] = useState(0);
  const [tablero, setTablero] = useState<FichaTablero[]>([]);
  const [mano, setMano] = useState<Pieza[]>(MANO_INICIAL);
  const [jugada, setJugada] = useState(false); // paso "jugar" ya resuelto
  const [pasado, setPasado] = useState(false);  // paso "pasar" ya resuelto
  const [boardWidth, boardRef] = useMeasuredWidth();

  const actual = PASOS[paso];

  const avanzar = () => setPaso(p => Math.min(p + 1, PASOS.length - 1));
  const retroceder = () => setPaso(p => Math.max(p - 1, 0));

  function jugarFicha(pieza: Pieza) {
    setTablero(t => aplicarMovimientoTablero(t, pieza, 'der'));
    setMano(m => m.filter(p => !(p.a === pieza.a && p.b === pieza.b)));
    setJugada(true);
    setTimeout(avanzar, 500);
  }

  function pasarTurno() {
    setPasado(true);
    setTimeout(avanzar, 400);
  }

  const focoClase = useMemo(() => (zona: NonNullable<typeof actual.foco>) =>
    actual.foco === zona ? ' tut-focus' : '', [actual.foco]);

  return (
    <div className="game-shell tut-shell">
      {/* ── Nav (idéntico a GameBoard, con el botón de saltar fijo) ── */}
      <nav className="game-nav">
        <button className={`btn-back${focoClase('salir')}`} onClick={actual.foco === 'salir' ? avanzar : undefined}>
          <BackIcon /> Salir
        </button>
        <span className="game-room-code">TUTORIAL</span>
        <span className="game-turn-indicator my-turn tut-turn-demo">¡Tu turno!</span>
        <button className="tut-skip" onClick={onSkip}>Saltar tutorial ✕</button>
      </nav>

      {/* ── Marcador ─────────────────────────────── */}
      <div className={`score-bar${focoClase('score')}`}>
        <span className="score-team score-nos">Nosotros <strong>0</strong></span>
        <span className="score-target">Mano 1 · a 100</span>
        <span className="score-team score-ellos"><strong>0</strong> Ellos</span>
      </div>

      {/* ── Mesa ────────────────────────────────── */}
      <div className={`game-table table-2p${focoClase('mesa')}`}>
        <div className="seat seat-top">
          <div className="opponent-seat">
            <span className="opponent-name">@Rival</span>
            <div className="opponent-pieces">
              {Array.from({ length: 4 }).map((_, i) => (
                <DominoPiece key={i} a={0} b={0} faceDown orient="v" style={{ width: 32, height: 58 }} />
              ))}
            </div>
          </div>
        </div>

        <div className={`board-center${focoClase('turno')}`} ref={boardRef}>
          {tablero.length === 0 ? (
            <p className="board-empty-hint">Toca la ficha resaltada para abrir</p>
          ) : boardWidth > 0 ? (
            <SnakeBoard
              tablero={tablero}
              containerWidth={boardWidth}
              nuevaFichaIdx={null}
              piezaFantasma={null}
              canIzq={false}
              canDer={false}
              sobreIzq={false}
              sobreDer={false}
              onPlayIzq={() => {}}
              onPlayDer={() => {}}
              onDragOverIzq={() => {}}
              onDragOverDer={() => {}}
              onDragLeave={() => {}}
            />
          ) : null}
        </div>
      </div>

      {/* ── Mi mano ──────────────────────────────── */}
      <div className="my-hand-zone">
        <div className={`my-hand${focoClase('mano')}`}>
          {mano.map((p, i) => {
            const esLaDeEnseñar = actual.accion === 'jugar-pieza' && i === 0 && !jugada;
            return (
              <DominoPiece
                key={`${p.a}-${p.b}`}
                a={p.a} b={p.b}
                orient="v"
                playable={esLaDeEnseñar}
                disabled={!esLaDeEnseñar}
                onClick={esLaDeEnseñar ? () => jugarFicha(p) : undefined}
                style={{ width: 54, height: 100 }}
              />
            );
          })}
        </div>

        <button
          className={`btn-pasar${focoClase('pasar')}`}
          disabled={!(actual.accion === 'pasar' && !pasado)}
          onClick={actual.accion === 'pasar' ? pasarTurno : undefined}
        >
          Pasar
        </button>
      </div>

      {/* ── Chat: solo cosmético, sin conectar al backend real ───── */}
      <div className="chat-widget">
        <button
          className={`chat-fab${focoClase('chat')}`}
          onClick={actual.foco === 'chat' ? avanzar : undefined}
          aria-label="Chat de la partida (demo)"
        >
          <ChatIcon />
        </button>
      </div>

      {/* ── Panel guía (coachmark) ───────────────── */}
      <div className="tut-coach">
        <div className="tut-coach-dots">
          {PASOS.map((p, i) => (
            <span key={p.id} className={`tut-dot${i === paso ? ' is-active' : i < paso ? ' is-done' : ''}`} />
          ))}
        </div>
        <h2>{actual.titulo}</h2>
        <p>{actual.cuerpo}</p>
        <div className="tut-coach-actions">
          {paso > 0 && (
            <button className="tut-coach-back" onClick={retroceder}>← Atrás</button>
          )}
          {actual.accion === 'terminar' ? (
            <button className="tut-coach-next tut-coach-finish" onClick={onFinish}>Empezar a jugar</button>
          ) : actual.accion === 'siguiente' ? (
            <button className="tut-coach-next" onClick={avanzar}>Siguiente →</button>
          ) : (
            <button className="tut-coach-next tut-coach-ghost" onClick={avanzar}>Saltar este paso →</button>
          )}
        </div>
      </div>
    </div>
  );
}
