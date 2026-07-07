import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Sala, type AuthUser, type Party, type ColaEstado, type TipoJuego } from '../api';
import { BackIcon, CasualIcon, RankedIcon } from './icons';
import { Bone } from './DominoStage';
import { rangoDeElo } from '../ranks';

type Props = {
  user: AuthUser;
  tipo: TipoJuego;               // 'casual' | 'ranked'
  dark: boolean;
  onBack: () => void;
  onGameStart: (sala: Sala) => void;
  /** Código de party a unirse automáticamente (viene de un link de invitación). */
  autoJoinCodigo?: string | null;
};

type Pantalla = 'menu' | 'cola' | 'party';

// ── Menú principal ─────────────────────────────────
function Menu({ tipo, onSolo2, onSolo4, onCrearParty }: {
  tipo: TipoJuego; onSolo2: () => void; onSolo4: () => void; onCrearParty: () => void;
}) {
  return (
    <div className="mm-menu">
      <button className="mm-mode-card" onClick={onSolo2}>
        <span className="mm-mode-icon">{tipo === 'ranked' ? <RankedIcon /> : <CasualIcon />}</span>
        <span className="mm-mode-body">
          <h3>1v1 aleatorio</h3>
          <p>Búsqueda individual contra cualquier jugador de tu nivel.</p>
        </span>
        <span className="mm-mode-cta">Buscar →</span>
      </button>
      <button className="mm-mode-card" onClick={onSolo4}>
        <span className="mm-mode-icon">{tipo === 'ranked' ? <RankedIcon /> : <CasualIcon />}</span>
        <span className="mm-mode-body">
          <h3>2v2 aleatorio</h3>
          <p>Búsqueda individual; el equipo se arma con quien empareje.</p>
        </span>
        <span className="mm-mode-cta">Buscar →</span>
      </button>
      <button className="mm-mode-card mm-mode-team" onClick={onCrearParty}>
        <span className="mm-mode-icon"><Bone a={6} b={6} className="mm-mode-tile" /></span>
        <span className="mm-mode-body">
          <h3>2v2 en equipo</h3>
          <p>Invita a tu compañero con un link y buscan partida juntos.</p>
        </span>
        <span className="mm-mode-cta">Crear equipo →</span>
      </button>
    </div>
  );
}

// ── Pantalla de cola (solo o party) ────────────────
function ColaView({ estado, tipo, onCancelar, cancelando }: {
  estado: Extract<ColaEstado, { en_cola: true }>;
  tipo: TipoJuego;
  onCancelar: () => void;
  cancelando: boolean;
}) {
  const segundos = Math.floor(estado.espera_ms / 1000);
  return (
    <div className="mm-panel mm-cola">
      <div className="mm-cola-tiles" aria-hidden="true">
        <Bone a={6} b={3} className="mm-cola-tile mm-cola-tile-a" />
        <Bone a={5} b={5} className="mm-cola-tile mm-cola-tile-b" />
      </div>
      <div className="boot-spinner" />
      <h3>Buscando partida{estado.es_party ? ' — en equipo' : ''}…</h3>
      <p className="mm-cola-meta">
        {estado.modo === 2 ? '1 vs 1' : '2 vs 2'} · {segundos}s
        {tipo === 'ranked' && <> · rango ±{estado.rango_actual} ELO</>}
      </p>
      <button className="mm-ghost-btn" onClick={onCancelar} disabled={cancelando}>
        {cancelando ? 'Cancelando…' : 'Cancelar búsqueda'}
      </button>
    </div>
  );
}

// ── Lobby de party (crear/invitar/unirse) ──────────
function PartyView({ party, userId, onBuscar, buscando, onSalir, onCopyLink }: {
  party: Party; userId: string; onBuscar: () => void; buscando: boolean;
  onSalir: () => void; onCopyLink: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const soyCreador = party.creador_id === userId;
  const completa = party.miembros.length === 2;

  function copiar() {
    onCopyLink();
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="mm-panel mm-party">
      <span className="mm-party-label">Código de equipo</span>
      <div className="mm-party-code-row">
        <span className="mm-party-code">{party.codigo}</span>
        <button className="mm-copy-btn" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar link'}</button>
      </div>

      <div className="mm-party-slots">
        {[0, 1].map(i => {
          const m = party.miembros[i];
          return (
            <div key={i} className={`mm-party-slot${m ? ' is-filled' : ''}`}>
              {m
                ? <><span className="mm-party-avatar">{m.username[0].toUpperCase()}</span>@{m.username}</>
                : 'Esperando compañero…'}
            </div>
          );
        })}
      </div>

      {soyCreador ? (
        <button className="mm-primary-btn" onClick={onBuscar} disabled={!completa || buscando}>
          {buscando ? 'Iniciando…' : completa ? 'Buscar partida (2v2)' : 'Esperando al equipo…'}
        </button>
      ) : (
        <p className="mm-cola-meta">Solo el creador del equipo puede iniciar la búsqueda.</p>
      )}
      <button className="mm-ghost-btn" onClick={onSalir}>Salir del equipo</button>
    </div>
  );
}

export default function MatchmakingView({ user, tipo, dark, onBack, onGameStart, autoJoinCodigo }: Props) {
  const [pantalla, setPantalla]   = useState<Pantalla>('menu');
  const [party, setParty]         = useState<Party | null>(null);
  const [cola, setCola]           = useState<ColaEstado | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const [elo, setElo]             = useState<number | null>(null);
  const partyCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (tipo !== 'ranked') return;
    api.ranked.me().then(r => setElo(r.elo)).catch(() => setElo(null));
  }, [tipo]);

  // Invite link consumido al entrar a esta vista: unirse automáticamente.
  useEffect(() => {
    if (!autoJoinCodigo) return;
    (async () => {
      try {
        const p = await api.ranked.unirseParty(autoJoinCodigo);
        setParty(p);
        partyCodeRef.current = p.codigo;
        setPantalla('party');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'No se pudo unir al equipo');
      }
    })();
  }, [autoJoinCodigo]);

  // Poll de la cola mientras estamos buscando
  useEffect(() => {
    if (pantalla !== 'cola') return;
    let cancelado = false;
    const tick = async () => {
      try {
        const st = await api.ranked.estadoCola();
        if (cancelado) return;
        if (st.en_cola) { setCola(st); return; }
        if (st.matched) {
          const sala = await api.salas.detalle(st.sala_id);
          onGameStart(sala);
        } else {
          // se salió de la cola por otra vía; volver al menú
          setPantalla('menu');
        }
      } catch { /* silencioso, reintenta en el próximo tick */ }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { cancelado = true; clearInterval(id); };
  }, [pantalla, onGameStart]);

  const buscarSolo = useCallback(async (modo: 2 | 4) => {
    setBusy(true); setError(null);
    try {
      const st = await api.ranked.entrarCola(modo, tipo);
      if (st.en_cola) { setCola(st); setPantalla('cola'); }
      else if (st.matched) {
        const sala = await api.salas.detalle(st.sala_id);
        onGameStart(sala);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar a la cola');
    } finally {
      setBusy(false);
    }
  }, [onGameStart, tipo]);

  async function crearParty() {
    setBusy(true); setError(null);
    try {
      const p = await api.ranked.crearParty(tipo);
      setParty(p);
      partyCodeRef.current = p.codigo;
      setPantalla('party');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el equipo');
    } finally {
      setBusy(false);
    }
  }

  async function buscarConParty() {
    if (!party) return;
    setBusy(true); setError(null);
    try {
      const st = await api.ranked.partyACola(party.codigo);
      if (st.en_cola) { setCola(st); setPantalla('cola'); }
      else if (st.matched) {
        const sala = await api.salas.detalle(st.sala_id);
        onGameStart(sala);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la búsqueda');
    } finally {
      setBusy(false);
    }
  }

  async function salirParty() {
    if (!party) return;
    try { await api.ranked.salirParty(party.codigo); } catch { /* noop */ }
    setParty(null);
    setPantalla('menu');
  }

  async function cancelarCola() {
    setBusy(true);
    try { await api.ranked.salirCola(); } catch { /* noop */ }
    setCola(null);
    setBusy(false);
    setPantalla(party ? 'party' : 'menu');
  }

  function copiarLink() {
    if (!party) return;
    const url = `${window.location.origin}/party/${party.codigo}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  // Salir: limpia cualquier ticket de cola y/o party para no dejar al
  // usuario "buscando" fantasma tras volver al lobby.
  async function salirMatchmaking() {
    if (pantalla === 'cola') { try { await api.ranked.salirCola(); } catch { /* noop */ } }
    if (party) { try { await api.ranked.salirParty(party.codigo); } catch { /* noop */ } }
    onBack();
  }

  const titulo = tipo === 'ranked' ? 'Partida Ranked' : 'Partida Casual';
  const subtitulo = pantalla === 'menu'
    ? 'Elige cómo quieres buscar partida'
    : pantalla === 'party'
    ? 'Invita a tu compañero'
    : 'Buscando rival…';
  const rango = elo !== null ? rangoDeElo(elo) : null;

  return (
    <div className={`dash mm-shell${dark ? '' : ' is-light'}`}>
      <nav className="social-nav">
        <button className="dash-icon-btn" onClick={salirMatchmaking} aria-label="Volver al lobby">
          <BackIcon />
        </button>
        <div className="social-nav-title">
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
        </div>
        {rango && (
          <div className="social-nav-right">
            <span className="mm-elo-chip" title={`${rango.nombre} · ELO ranked`}>
              {rango.url && <img src={rango.url} alt="" />}
              {elo}
            </span>
          </div>
        )}
      </nav>

      <div className="social-body mm-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {pantalla === 'menu' && (
          <Menu
            tipo={tipo}
            onSolo2={() => buscarSolo(2)}
            onSolo4={() => buscarSolo(4)}
            onCrearParty={crearParty}
          />
        )}

        {pantalla === 'party' && party && (
          <PartyView
            party={party}
            userId={user.id}
            onBuscar={buscarConParty}
            buscando={busy}
            onSalir={salirParty}
            onCopyLink={copiarLink}
          />
        )}

        {pantalla === 'cola' && cola?.en_cola && (
          <ColaView estado={cola} tipo={tipo} onCancelar={cancelarCola} cancelando={busy} />
        )}
      </div>
    </div>
  );
}
