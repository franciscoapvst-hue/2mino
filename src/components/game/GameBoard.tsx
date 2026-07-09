import { useState, useEffect, useRef, useCallback } from 'react';
import DominoPiece from './DominoPiece';
import SnakeBoard from './SnakeBoard';
import { puedeJugar, getExtremos } from '../../game/local-rules';
import { api } from '../../api';
import type { PartidaPublica, Pieza, Sala, AuthUser } from '../../api';
import { BackIcon, PersonAddIcon } from '../icons';
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth';
import ChatPanel from '../social/ChatPanel';
import AdSlot from '../AdSlot';

type Props = {
  sala: Sala;
  user: AuthUser;
  onExit: () => void;
  /** Acciones sociales post-partida (§6/§7 de docs/CASOS_DE_USO_SOCIAL.md) — opcionales, stubs. */
  onRevancha?: () => void;
  onInvitarCompanero?: (usuarioId: string) => void;
  onAgregarAmigo?: (usuarioId: string, username: string) => void;
};

export default function GameBoard({ sala, user, onExit, onRevancha, onInvitarCompanero, onAgregarAmigo }: Props) {
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

  // Aviso efímero del bonus "+30 pasó a todos" o de un turno vencido por tiempo
  const [eventoVisible, setEventoVisible] = useState<{ tipo: 'paso_a_todos' | 'tiempo_agotado'; seat: number } | null>(null);
  const eventoPrevRef = useRef<string | null>(null);

  useEffect(() => {
    const ev = partida?.ultimoEvento;
    if (!ev) return;
    // Firma única por evento: turnoEmpiezaEn se re-sella (Date.now()) en
    // CADA cambio de turno, incluidos los forzados por tiempo — a
    // diferencia de basarse en el marcador (no todo evento lo cambia, ej.
    // dos tiempo_agotado seguidos del mismo asiento sin puntos de por
    // medio tendrían la misma firma y el segundo banner nunca se vería).
    const firma = `${ev.tipo}:${ev.seat}:${partida.turnoEmpiezaEn}`;
    if (eventoPrevRef.current === firma) return;
    eventoPrevRef.current = firma;
    setEventoVisible({ tipo: ev.tipo, seat: ev.seat });
    const id = setTimeout(() => setEventoVisible(null), 3000);
    return () => clearTimeout(id);
  }, [partida?.ultimoEvento, partida?.turnoEmpiezaEn]);

  // ── Countdown del tiempo límite por jugada ────
  // Se recalcula localmente cada segundo a partir de turnoEmpiezaEn/
  // limiteJugadaMs, y se resincroniza solo con el poll de 2s existente
  // (no hay websocket de partida, ver GameBoard/PartidaPublica).
  const [restanteMs, setRestanteMs] = useState<number | null>(null);
  useEffect(() => {
    if (!partida || partida.fase !== 'jugando' || partida.limiteJugadaMs == null) {
      setRestanteMs(null);
      return;
    }
    const calcular = () => Math.max(0, partida.limiteJugadaMs! - (Date.now() - partida.turnoEmpiezaEn));
    setRestanteMs(calcular());
    const id = setInterval(() => setRestanteMs(calcular()), 1000);
    return () => clearInterval(id);
  }, [partida?.fase, partida?.limiteJugadaMs, partida?.turnoEmpiezaEn, partida?.turno]);

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

  // ── Listo para la siguiente mano ──────────────
  async function handleListo() {
    if (jugando) return;
    setJugando(true);
    try {
      setPartida(await api.juego.listo(sala.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar');
      setTimeout(() => setError(null), 2500);
    } finally {
      setJugando(false);
    }
  }

  // ── Salir de la partida ───────────────────────
  // En ranked, salir a mitad = derrota (aplica ELO). Se confirma antes.
  // En casual o si ya terminó, se sale sin más.
  const [confirmSalir, setConfirmSalir] = useState(false);

  function onClickSalir() {
    const enCurso = partida && partida.fase !== 'fin_partida';
    if (enCurso) setConfirmSalir(true);   // confirma en ranked Y casual
    else onExit();
  }

  async function handleAbandonar() {
    setConfirmSalir(false);
    try {
      await api.juego.abandonar(sala.id);
    } catch { /* aunque falle, salimos igual */ }
    onExit();
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
  const esMiTurno = partida.fase === 'jugando' && partida.turno === partida.miSeat;
  const maxJ      = partida.maxJugadores;

  // Mano 1: apertura obligada (p. ej. el 6-6) — solo esa ficha es jugable
  const forzada = partida.tablero.length === 0 ? partida.salidaForzada : null;
  const esForzada = (p: Pieza) =>
    !forzada || (p.a === forzada.a && p.b === forzada.b) || (p.a === forzada.b && p.b === forzada.a);

  const puedoPasar = esMiTurno && ext !== null &&
    !partida.miMano.some(p => { const o = puedeJugar(p, ext); return o.izq || o.der; });

  // Zonas de juego: la ficha activa (arrastrando o tocada) se previsualiza
  // en las puntas donde REALMENTE se puede jugar — si vale en ambas,
  // aparece en ambas; si solo en una, solo ahí (nunca "las dos porque sí").
  const piezaActiva = arrastrando ?? selectedPiece;
  const opsActiva = piezaActiva && ext ? puedeJugar(piezaActiva, ext) : null;
  const showZones = esMiTurno && piezaActiva !== null && ext !== null;
  const canIzq = showZones && (opsActiva?.izq ?? false);
  const canDer = showZones && (opsActiva?.der ?? false);

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

  const turnoLabel =
      partida.fase === 'fin_partida' ? 'Partida terminada'
    : partida.fase === 'entre_manos' ? `Mano ${partida.numeroMano} terminada`
    : partida.tablero.length === 0   ? (esMiTurno ? '¡Sales tú!' : `Sale ${nombreAsiento(partida.turno)}`)
    : esMiTurno ? '¡Tu turno!' : `Turno de ${nombreAsiento(partida.turno)}`;

  const miEq = partida.miEquipo ?? 0;
  const marcadorNos   = partida.marcador[miEq];
  const marcadorEllos = partida.marcador[miEq === 0 ? 1 : 0];

  return (
    <div className="game-shell">
      {/* ── Nav ─────────────────────────────────── */}
      <nav className="game-nav">
        <button className="btn-back" onClick={onClickSalir}><BackIcon /> Salir</button>
        <span className="game-room-code">{sala.codigo}</span>
        <span className={`game-turn-indicator${esMiTurno ? ' my-turn' : ''}`}>{turnoLabel}</span>
        {restanteMs !== null && (
          <span className={`game-turn-countdown${restanteMs <= 5000 ? ' countdown-urgente' : ''}`}>
            ⏱ {Math.ceil(restanteMs / 1000)}s
          </span>
        )}
      </nav>

      {/* ── Marcador ─────────────────────────────── */}
      <div className="score-bar">
        <span className="score-team score-nos">
          Nosotros <strong>{marcadorNos}</strong>
        </span>
        <span className="score-target">Mano {partida.numeroMano} · a {partida.puntosObjetivo}</span>
        <span className="score-team score-ellos">
          <strong>{marcadorEllos}</strong> Ellos
        </span>
      </div>

      {error && <div className="game-error-banner">⚠ {error}</div>}
      {eventoVisible && (
        <div className="game-event-banner">
          {eventoVisible.tipo === 'tiempo_agotado'
            ? <>⏱ ¡Se acabó el tiempo de {nombreAsiento(eventoVisible.seat)}! Jugamos por {partida.miSeat === eventoVisible.seat ? 'ti' : 'él/ella'}.</>
            : <>⚡ +30 · ¡{nombreAsiento(eventoVisible.seat)} pasó a todos!</>}
        </div>
      )}

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
              piezaFantasma={piezaActiva}
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
            const jugable = (ops.izq || ops.der) && esForzada(p);
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

      {/* ── Fin de mano: resultado + listos ──────── */}
      {partida.fase === 'entre_manos' && (
        <ManoOverlay
          partida={partida}
          nombreAsiento={nombreAsiento}
          onListo={handleListo}
          confirmando={jugando}
        />
      )}

      {/* ── Fin de partida ───────────────────────── */}
      {partida.fase === 'fin_partida' && (
        <FinPartidaOverlay
          partida={partida}
          onExit={onExit}
          onRevancha={onRevancha}
          onInvitarCompanero={onInvitarCompanero}
          onAgregarAmigo={onAgregarAmigo}
        />
      )}

      {/* ── Confirmar abandono (ranked) ──────────── */}
      {confirmSalir && (
        <div className="game-result-overlay">
          <div className="game-result-card">
            <h2>¿Abandonar la partida?</h2>
            <p className="result-detail">
              {sala.tipo === 'ranked'
                ? <>Es una partida ranked. Si sales ahora <strong>cuentas como derrota</strong>: pierdes ELO y el rival lo gana.</>
                : <>Si sales ahora <strong>se termina la partida</strong> para todos.</>}
            </p>
            <button className="btn-primary" onClick={handleAbandonar}>
              {sala.tipo === 'ranked' ? 'Salir y perder' : 'Salir'}
            </button>
            <button className="btn-salir" onClick={() => setConfirmSalir(false)}>Seguir jugando</button>
          </div>
        </div>
      )}

      <ChatPanel salaId={sala.id} miUsuarioId={user.id} miUsername={user.username} />
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

function MarcadorResumen({ partida }: { partida: PartidaPublica }) {
  const miEq = partida.miEquipo ?? 0;
  return (
    <p className="result-marcador">
      Nosotros <strong>{partida.marcador[miEq]}</strong>
      <span className="result-marcador-sep"> — </span>
      <strong>{partida.marcador[miEq === 0 ? 1 : 0]}</strong> Ellos
      <span className="result-marcador-obj"> · a {partida.puntosObjetivo}</span>
    </p>
  );
}

function tituloResultado(
  r: NonNullable<PartidaPublica['resultadoMano']>,
  partida: PartidaPublica,
  nombreAsiento: (seat: number) => string,
): { titulo: string; detalle: string } {
  const miEq = partida.miEquipo ?? 0;
  if (r.tipo === 'tranca') {
    if (r.noCaben) {
      return {
        titulo: '🔒 ¡No caben!',
        detalle: `Esos ${r.puntos} pts se pasarían de ${partida.puntosObjetivo} — no suman. Sigue la partida.`,
      };
    }
    return {
      titulo: '🔒 Tranca',
      detalle: r.equipoGanador === null ? 'Empate: nadie suma'
             : r.equipoGanador === miEq ? '¡Menos pips: sumamos nosotros!'
             : 'Menos pips: suman ellos',
    };
  }
  const gane = equipoDeSeat(r.ganadorSeat) === miEq;
  return {
    titulo:  r.tipo === 'capicua' ? '⚡ ¡Capicúa!' : gane ? '🏆 Mano ganada' : '😓 Mano perdida',
    detalle: gane ? '¡Bien jugado!' : `Cerró ${nombreAsiento(r.ganadorSeat)}`,
  };
}

const equipoDeSeat = (seat: number) => seat % 2;

/** Suma de pips de una mano — para mostrar junto a las fichas reveladas al cerrar la mano. */
const sumaPips = (mano: Pieza[]) => mano.reduce((s, p) => s + p.a + p.b, 0);

function ManoOverlay({ partida, nombreAsiento, onListo, confirmando }: {
  partida: PartidaPublica;
  nombreAsiento: (seat: number) => string;
  onListo: () => void;
  confirmando: boolean;
}) {
  const r = partida.resultadoMano;
  if (!r) return null;
  const { titulo, detalle } = tituloResultado(r, partida, nombreAsiento);
  const yaListo = partida.miSeat >= 0 && partida.listos[partida.miSeat];
  const nListos = partida.listos.filter(Boolean).length;

  return (
    <div className="game-result-overlay">
      <div className="game-result-card">
        <h2>{titulo}</h2>
        {r.tipo === 'tranca' && r.noCaben ? (
          <p className="result-points result-points-no-caben">+0 pts</p>
        ) : (
          <p className="result-points">+{r.puntos} pts</p>
        )}
        <p className="result-detail">{detalle}</p>
        <MarcadorResumen partida={partida} />
        {partida.manosReveladas && (
          <div className="result-manos-reveladas">
            {partida.manosReveladas.map((mano, seat) => (
              <div key={seat} className="result-mano-jugador">
                <span className="result-mano-nombre">{nombreAsiento(seat)}</span>
                <div className="result-mano-fichas">
                  {mano.length === 0 ? (
                    <span className="result-mano-vacia">¡Dominó! Sin fichas</span>
                  ) : (
                    mano.map((p, i) => (
                      <DominoPiece key={i} a={p.a} b={p.b} orient="v" style={{ width: 26, height: 48 }} />
                    ))
                  )}
                </div>
                <span className="result-mano-suma">{sumaPips(mano)} puntos</span>
              </div>
            ))}
          </div>
        )}
        <p className="result-detail">Sale {nombreAsiento(partida.salida)}</p>
        <button className="btn-primary" onClick={onListo} disabled={yaListo || confirmando}>
          {yaListo
            ? `Esperando… (${nListos}/${partida.maxJugadores})`
            : 'Listo para la siguiente mano'}
        </button>

        <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_MANO} />
      </div>
    </div>
  );
}

function FinPartidaOverlay({ partida, onExit, onRevancha, onInvitarCompanero, onAgregarAmigo }: {
  partida: PartidaPublica;
  onExit: () => void;
  onRevancha?: () => void;
  onInvitarCompanero?: (usuarioId: string) => void;
  onAgregarAmigo?: (usuarioId: string, username: string) => void;
}) {
  const miEq = partida.miEquipo ?? 0;
  const gane = partida.equipoGanadorPartida === miEq;
  // ¿Terminó por abandono? (y no fui yo quien se fue)
  const abandono = partida.abandonadoPorSeat !== null;
  const abandonoDeOtro = abandono && partida.abandonadoPorSeat !== partida.miSeat;

  const titulo = abandonoDeOtro && gane ? '🏆 ¡Ganaste! el rival abandonó'
               : gane ? '🏆 ¡Partida ganada!'
               : '😓 Partida perdida';
  const detalle = abandonoDeOtro && gane ? 'Un rival dejó la partida.'
                : abandono && !gane ? 'Tu equipo abandonó la partida.'
                : gane ? '¡Alcanzaron el objetivo!'
                : 'El rival alcanzó el objetivo';

  // Rivales (equipo contrario) y compañero (mismo equipo, si 2v2), para las
  // acciones sociales de abajo. Ver docs/CASOS_DE_USO_SOCIAL.md §6/§7.
  const companero = partida.maxJugadores === 4
    ? partida.asientos.find((_, seat) => seat !== partida.miSeat && seat % 2 === miEq)
    : undefined;
  const rivales = partida.asientos.filter((_, seat) => seat % 2 !== miEq);

  return (
    <div className="game-result-overlay">
      <div className="game-result-card">
        <h2>{titulo}</h2>
        <MarcadorResumen partida={partida} />
        <p className="result-detail">{detalle}</p>

        {!abandono && (
          <PostGameActions
            rivales={rivales}
            companero={companero}
            onRevancha={onRevancha}
            onInvitarCompanero={onInvitarCompanero}
            onAgregarAmigo={onAgregarAmigo}
          />
        )}

        <button className="btn-primary" onClick={onExit}>Volver a la sala</button>
      </div>
    </div>
  );
}

// ── Acciones sociales post-partida (revancha, agregar amigo, compañero) ──
function PostGameActions({ rivales, companero, onRevancha, onInvitarCompanero, onAgregarAmigo }: {
  rivales: { usuario_id: string; username: string }[];
  companero?: { usuario_id: string; username: string };
  onRevancha?: () => void;
  onInvitarCompanero?: (usuarioId: string) => void;
  onAgregarAmigo?: (usuarioId: string, username: string) => void;
}) {
  const [agregados, setAgregados] = useState<Set<string>>(new Set());

  function handleAgregar(usuarioId: string, username: string) {
    onAgregarAmigo?.(usuarioId, username);
    setAgregados(prev => new Set(prev).add(usuarioId));
  }

  if (!onRevancha && !onInvitarCompanero && !onAgregarAmigo) return null;

  return (
    <div className="post-game-actions">
      {rivales.length > 0 && onAgregarAmigo && (
        <div className="post-game-friends">
          {rivales.map(r => (
            <button
              key={r.usuario_id}
              className="post-game-btn post-game-btn-ghost"
              disabled={agregados.has(r.usuario_id)}
              onClick={() => handleAgregar(r.usuario_id, r.username)}
            >
              <PersonAddIcon /> {agregados.has(r.usuario_id) ? `Solicitud enviada a @${r.username}` : `Agregar a @${r.username}`}
            </button>
          ))}
        </div>
      )}

      <div className="post-game-row">
        {onRevancha && (
          <button className="post-game-btn post-game-btn-teal" onClick={onRevancha}>
            Jugar de nuevo
          </button>
        )}
        {companero && onInvitarCompanero && (
          <button className="post-game-btn post-game-btn-amber" onClick={() => onInvitarCompanero(companero.usuario_id)}>
            Invitar a @{companero.username} de nuevo
          </button>
        )}
      </div>
    </div>
  );
}
