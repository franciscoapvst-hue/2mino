import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Sala, type AuthUser, type Party, type ColaEstado } from '../api';
import { BackIcon } from './icons';

type Props = {
  user: AuthUser;
  onBack: () => void;
  onGameStart: (sala: Sala) => void;
  /** Código de party a unirse automáticamente (viene de un link de invitación). */
  autoJoinCodigo?: string | null;
};

type Pantalla = 'menu' | 'cola' | 'party';

// ── Menú principal ─────────────────────────────────
function Menu({ onSolo2, onSolo4, onCrearParty }: {
  onSolo2: () => void; onSolo4: () => void; onCrearParty: () => void;
}) {
  return (
    <div className="ranked-menu">
      <button className="ranked-mode-card" onClick={onSolo2}>
        <h3>1v1 aleatorio</h3>
        <p>Búsqueda individual contra cualquier jugador de tu nivel.</p>
      </button>
      <button className="ranked-mode-card" onClick={onSolo4}>
        <h3>2v2 aleatorio</h3>
        <p>Búsqueda individual; el equipo se arma con quien empareje.</p>
      </button>
      <button className="ranked-mode-card ranked-mode-team" onClick={onCrearParty}>
        <h3>2v2 en equipo</h3>
        <p>Invita a tu compañero con un link y buscan partida juntos.</p>
      </button>
    </div>
  );
}

// ── Pantalla de cola (solo o party) ────────────────
function ColaView({ estado, onCancelar, cancelando }: {
  estado: Extract<ColaEstado, { en_cola: true }>;
  onCancelar: () => void;
  cancelando: boolean;
}) {
  const segundos = Math.floor(estado.espera_ms / 1000);
  return (
    <div className="ranked-cola">
      <div className="boot-spinner" />
      <h3>Buscando partida{estado.es_party ? ' — en equipo' : ''}…</h3>
      <p className="ranked-cola-meta">
        {estado.modo === 2 ? '1 vs 1' : '2 vs 2'} · {segundos}s · rango ±{estado.rango_actual} ELO
      </p>
      <button className="btn-salir" onClick={onCancelar} disabled={cancelando}>
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
    <div className="party-lobby">
      <p className="party-code-label">Código de equipo</p>
      <div className="party-code-row">
        <span className="party-code">{party.codigo}</span>
        <button className="btn-copy" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar link'}</button>
      </div>

      <div className="party-slots">
        {[0, 1].map(i => {
          const m = party.miembros[i];
          return (
            <div key={i} className={`party-slot${m ? ' party-slot-filled' : ''}`}>
              {m
                ? <><span className="slot-avatar">{m.username[0].toUpperCase()}</span>@{m.username}</>
                : 'Esperando compañero…'}
            </div>
          );
        })}
      </div>

      {soyCreador ? (
        <button className="btn-primary" onClick={onBuscar} disabled={!completa || buscando}>
          {buscando ? 'Iniciando…' : completa ? 'Buscar partida (2v2)' : 'Esperando al equipo…'}
        </button>
      ) : (
        <p className="ranked-cola-meta">Solo el creador del equipo puede iniciar la búsqueda.</p>
      )}
      <button className="btn-salir" onClick={onSalir}>Salir del equipo</button>
    </div>
  );
}

export default function RankedView({ user, onBack, onGameStart, autoJoinCodigo }: Props) {
  const [pantalla, setPantalla]   = useState<Pantalla>('menu');
  const [party, setParty]         = useState<Party | null>(null);
  const [cola, setCola]           = useState<ColaEstado | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const partyCodeRef = useRef<string | null>(null);

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
      const st = await api.ranked.entrarCola(modo);
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
  }, [onGameStart]);

  async function crearParty() {
    setBusy(true); setError(null);
    try {
      const p = await api.ranked.crearParty();
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

  return (
    <div className="salas-page">
      <nav className="salas-nav">
        <button className="btn-back" onClick={onBack}><BackIcon /> Lobby</button>
        <h2>Partida Ranked</h2>
      </nav>

      <div className="salas-content ranked-content">
        {error && <div className="game-error-banner">⚠ {error}</div>}

        {pantalla === 'menu' && (
          <Menu
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
          <ColaView estado={cola} onCancelar={cancelarCola} cancelando={busy} />
        )}
      </div>
    </div>
  );
}
