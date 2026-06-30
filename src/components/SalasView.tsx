import { useState, useEffect, useCallback, FormEvent } from 'react';
import { api, type Sala, type SalaJugador, type AuthUser } from '../api';

type Props = {
  user:         AuthUser;
  onBack:       () => void;
  onGameStart:  (sala: Sala) => void;
};

// ── Iconos ────────────────────────────────────────
function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      style={spinning ? { animation: 'spin 0.7s linear infinite' } : undefined}>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────
const MODO_LABEL: Record<string, string> = {
  clasico: 'Clásico', rapido: 'Rápido', torneo: 'Torneo',
};

function PlayerDots({ current, max }: { current: number; max: number }) {
  return (
    <div className="player-dots">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < current ? 'dot-on' : 'dot-off'}>●</span>
      ))}
    </div>
  );
}

// ── Sala card (en la lista) ───────────────────────
function SalaCard({
  sala, userId, onJoin, joining,
}: {
  sala: Sala; userId: string; onJoin: (id: string) => void; joining: boolean;
}) {
  const count    = sala.jugadores_count ?? sala.jugadores?.length ?? 0;
  const llena    = count >= sala.max_jugadores;
  const yaEstoy  = sala.jugadores?.some(j => j.usuario_id === userId);
  const btnLabel = yaEstoy ? 'Volver' : llena ? 'Llena' : 'Unirse';

  return (
    <div className={`sala-card${llena && !yaEstoy ? ' sala-card-full' : ''}`}>
      <div className="sala-card-top">
        <span className="sala-codigo">{sala.codigo}</span>
      </div>

      <div className="sala-card-body">
        <p className="sala-nombre">{sala.nombre ?? 'Sin nombre'}</p>
        <p className="sala-modo">{MODO_LABEL[sala.modo] ?? sala.modo}</p>
        <div className="sala-players-row">
          <PlayerDots current={count} max={sala.max_jugadores} />
          <span className="sala-players-text">{count}/{sala.max_jugadores}</span>
        </div>
      </div>

      <button
        className="sala-join-btn"
        disabled={(llena && !yaEstoy) || joining}
        onClick={() => onJoin(sala.id)}
      >
        {joining ? '…' : btnLabel}
      </button>
    </div>
  );
}

// ── Sala de espera ────────────────────────────────
function WaitingRoom({
  sala, userId, onSalir, saliendo, onIniciar, iniciando,
}: {
  sala: Sala; userId: string; onSalir: () => void; saliendo: boolean;
  onIniciar: () => void; iniciando: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copyCodigo() {
    navigator.clipboard.writeText(sala.codigo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const slots = Array.from({ length: sala.max_jugadores }, (_, i) => {
    const jugador = sala.jugadores?.find(j => j.posicion === i + 1) ?? null;
    return { posicion: i + 1, jugador };
  });

  const soyCreador = sala.creador_id === userId;

  return (
    <div className="waiting-room">
      <div className="waiting-header">
        <div className="waiting-code-wrap">
          <span className="waiting-code-label">Código de sala</span>
          <div className="waiting-code-row">
            <span className="waiting-code">{sala.codigo}</span>
            <button className="btn-copy" onClick={copyCodigo} title="Copiar código">
              <CopyIcon />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
        <div className="waiting-meta">
          <span>{MODO_LABEL[sala.modo]}</span>
          <span className="waiting-meta-sep">·</span>
          <span>{sala.max_jugadores} jugadores</span>
        </div>
        {sala.nombre && <p className="waiting-nombre">{sala.nombre}</p>}
      </div>

      <div className="slot-grid" style={{ gridTemplateColumns: `repeat(${sala.max_jugadores}, 1fr)` }}>
        {slots.map(({ posicion, jugador }) => (
          <SlotCard
            key={posicion}
            posicion={posicion}
            jugador={jugador}
            esMio={jugador?.usuario_id === userId}
            esCreador={jugador?.usuario_id === sala.creador_id}
          />
        ))}
      </div>

      <div className="waiting-actions">
        {soyCreador && (
          <button
            className="btn-primary waiting-start-btn"
            onClick={onIniciar}
            disabled={iniciando || sala.estado !== 'esperando'}
          >
            {iniciando ? 'Iniciando…' : sala.estado === 'en_juego' ? 'Partida en curso' : 'Iniciar partida'}
          </button>
        )}
        <button className="btn-salir" onClick={onSalir} disabled={saliendo}>
          {saliendo ? 'Saliendo…' : 'Salir de la sala'}
        </button>
      </div>
    </div>
  );
}

function SlotCard({ posicion, jugador, esMio, esCreador }: {
  posicion: number; jugador: SalaJugador | null; esMio: boolean; esCreador: boolean;
}) {
  if (!jugador) {
    return (
      <div className="slot slot-empty">
        <span className="slot-pos">{posicion}</span>
        <span className="slot-waiting">Esperando…</span>
      </div>
    );
  }

  return (
    <div className={`slot slot-filled${esMio ? ' slot-me' : ''}`}>
      <span className="slot-avatar">{jugador.username[0].toUpperCase()}</span>
      <span className="slot-username">@{jugador.username}</span>
      {esCreador && <span className="slot-host-badge">creador</span>}
    </div>
  );
}

// ── Create form ───────────────────────────────────
type CreateBody = { nombre: string; modo: 'clasico'|'rapido'|'torneo'; max_jugadores: 2|4 };

function CreateForm({ onCrear, creating }: { onCrear: (b: CreateBody) => void; creating: boolean }) {
  const [nombre, setNombre] = useState('');
  const [modo,   setModo]   = useState<'clasico'|'rapido'|'torneo'>('clasico');
  const [max,    setMax]    = useState<2|4>(4);

  function submit(e: FormEvent) {
    e.preventDefault();
    onCrear({ nombre, modo, max_jugadores: max });
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <div className="create-form-grid">
        <div className="field">
          <span className="field-label">Nombre (opcional)</span>
          <input
            type="text" value={nombre} maxLength={60} placeholder="Ej: Partida de amigos"
            onChange={e => setNombre(e.target.value)} disabled={creating}
          />
        </div>

        <div className="create-options">
          <div className="option-group">
            <span className="field-label">Modo</span>
            <div className="toggle-row">
              {(['clasico','rapido','torneo'] as const).map(m => (
                <button key={m} type="button"
                  className={`toggle-btn${modo === m ? ' active' : ''}`}
                  onClick={() => setModo(m)} disabled={creating}>
                  {MODO_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="option-group">
            <span className="field-label">Jugadores</span>
            <div className="toggle-row">
              {([2, 4] as const).map(n => (
                <button key={n} type="button"
                  className={`toggle-btn${max === n ? ' active' : ''}`}
                  onClick={() => setMax(n)} disabled={creating}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button type="submit" className="btn-primary create-submit-btn" disabled={creating}>
        {creating ? 'Creando…' : 'Crear sala'}
      </button>
    </form>
  );
}

// ── Main view ─────────────────────────────────────
export default function SalasView({ user, onBack, onGameStart }: Props) {
  const [salas,       setSalas]       = useState<Sala[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [joining,     setJoining]     = useState<string | null>(null);
  const [saliendo,    setSaliendo]    = useState(false);
  const [iniciando,   setIniciando]   = useState(false);
  const [sala,        setSala]        = useState<Sala | null>(null);
  const [searchCode,  setSearchCode]  = useState('');
  const [searching,   setSearching]   = useState(false);
  const [searchErr,   setSearchErr]   = useState<string | null>(null);

  const loadSalas = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await api.salas.listar();
      setSalas(data);
    } catch {
      setError('No se pudieron cargar las salas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSalas(); }, [loadSalas]);

  // Poll sala de espera cada 4 segundos
  useEffect(() => {
    if (!sala) return;
    const id = setInterval(async () => {
      try {
        const actualizada = await api.salas.detalle(sala.id);
        if (actualizada.estado === 'en_juego') {
          onGameStart(actualizada);
          return;
        }
        setSala(actualizada);
      } catch { /* silencioso */ }
    }, 4000);
    return () => clearInterval(id);
  }, [sala?.id]);

  async function handleJoin(salaId: string) {
    setJoining(salaId);
    try {
      const detalle = await api.salas.unirse(salaId);
      setSala(detalle);
      loadSalas(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'Ya estás en esta sala') {
        const detalle = await api.salas.detalle(salaId).catch(() => null);
        if (detalle) setSala(detalle);
        else setError(msg);
      } else {
        setError(msg || 'Error al unirse');
      }
    } finally {
      setJoining(null);
    }
  }

  async function handleCrear(body: CreateBody) {
    setCreating(true);
    try {
      const detalle = await api.salas.crear(body);
      setSala(detalle);
      setShowCreate(false);
      loadSalas(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear la sala');
    } finally {
      setCreating(false);
    }
  }

  async function handleSalir() {
    if (!sala) return;
    setSaliendo(true);
    try {
      await api.salas.salir(sala.id);
      setSala(null);
      loadSalas(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al salir');
    } finally {
      setSaliendo(false);
    }
  }

  async function handleIniciar() {
    if (!sala) return;
    setIniciando(true);
    try {
      await api.juego.iniciar(sala.id);
      onGameStart(sala);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al iniciar la partida');
    } finally {
      setIniciando(false);
    }
  }

  async function handleSearchCode(e: FormEvent) {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setSearching(true);
    setSearchErr(null);
    try {
      const detalle = await api.salas.porCodigo(searchCode);
      if (detalle.estado !== 'esperando') {
        setSearchErr('Esa sala ya no está disponible');
        return;
      }
      // Si ya estoy dentro, ir directo
      const yaEstoy = detalle.jugadores?.some(j => j.usuario_id === user.id);
      if (yaEstoy) { setSala(detalle); return; }
      await handleJoin(detalle.id);
    } catch {
      setSearchErr('Código no encontrado');
    } finally {
      setSearching(false);
    }
  }

  // ── Si estoy en una sala, mostrar sala de espera ──
  if (sala) {
    return (
      <div className="salas-page">
        <nav className="salas-nav">
          <button className="btn-back" onClick={() => setSala(null)}>
            <BackIcon /> Lista de salas
          </button>
        </nav>
        <div className="salas-content">
          <WaitingRoom
            sala={sala}
            userId={user.id}
            onSalir={handleSalir}
            saliendo={saliendo}
            onIniciar={handleIniciar}
            iniciando={iniciando}
          />
        </div>
      </div>
    );
  }

  // ── Lista de salas ────────────────────────────────
  return (
    <div className="salas-page">
      <nav className="salas-nav">
        <button className="btn-back" onClick={onBack}>
          <BackIcon /> Lobby
        </button>
        <h2 className="salas-nav-title">Salas Abiertas</h2>
        <button
          className="btn-icon-round"
          onClick={() => loadSalas(true)}
          disabled={refreshing}
          title="Actualizar"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </nav>

      <div className="salas-content">
        {/* Toolbar */}
        <div className="salas-toolbar">
          <button
            className={`btn-create-sala${showCreate ? ' active' : ''}`}
            onClick={() => setShowCreate(s => !s)}
          >
            {showCreate ? '✕ Cancelar' : '+ Crear sala'}
          </button>

          <form className="search-code-form" onSubmit={handleSearchCode}>
            <input
              type="text"
              className="search-code-input"
              placeholder="Código de sala (2M-XXXX)"
              value={searchCode}
              onChange={e => { setSearchCode(e.target.value.toUpperCase()); setSearchErr(null); }}
              maxLength={8}
              disabled={searching}
            />
            <button type="submit" className="search-code-btn" disabled={searching || !searchCode.trim()}>
              {searching ? '…' : 'Buscar'}
            </button>
          </form>
        </div>

        {searchErr && <div className="api-error" style={{ marginBottom: 12 }}>⚠ {searchErr}</div>}

        {/* Create form */}
        {showCreate && (
          <CreateForm onCrear={handleCrear} creating={creating} />
        )}

        {error && <div className="api-error" style={{ marginBottom: 12 }}>⚠ {error}</div>}

        {/* Lista */}
        {loading ? (
          <div className="salas-loading">
            <div className="boot-spinner" />
            <p>Cargando salas…</p>
          </div>
        ) : salas.length === 0 ? (
          <div className="salas-empty">
            <p className="salas-empty-icon">🁣</p>
            <p className="salas-empty-msg">No hay salas abiertas en este momento</p>
            <p className="salas-empty-sub">¡Crea una y espera a que se unan!</p>
          </div>
        ) : (
          <div className="salas-grid">
            {salas.map(s => (
              <SalaCard
                key={s.id}
                sala={s}
                userId={user.id}
                onJoin={handleJoin}
                joining={joining === s.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
