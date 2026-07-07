import { useEffect, useRef, useState } from 'react';
import { api, type Amigo, type EstadoRelacion, type UsuarioBusqueda } from '../../api';
import { avatarUrl } from '../../avatars';
import { rangoDeElo } from '../../ranks';
import { PersonAddIcon, SearchIcon, XIcon } from '../icons';
import PageHeader from './PageHeader';

type Props = {
  dark: boolean;
  onBack: () => void;
  /** Invitar a un amigo a mi partida/party actual (stub — sin sala activa aquí no hace nada real). */
  onInvitarPartida?: (amigo: Amigo) => void;
  /** Presencia vista en vivo por el WS (usuario_id → conectado), pisa el
   *  valor del fetch inicial cuando hay un evento explícito para ese ID. */
  conectadosEnVivo?: Map<string, boolean>;
};

function FriendRow({ amigo, onInvitar, onEliminado }: {
  amigo: Amigo;
  onInvitar?: (a: Amigo) => void;
  onEliminado: (usuarioId: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const foto = avatarUrl(amigo.avatar);
  const rango = rangoDeElo(amigo.elo);

  async function confirmarEliminar() {
    setEliminando(true);
    try {
      await api.social.eliminarAmigo(amigo.usuario_id);
      onEliminado(amigo.usuario_id);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <li className="friend-row">
      <span className={`friend-avatar${amigo.conectado ? ' is-online' : ''}`}>
        {foto ? <img src={foto} alt="" /> : amigo.username[0].toUpperCase()}
        <span className="friend-presence-dot" aria-hidden="true" />
      </span>

      <span className="friend-meta">
        <span className="friend-username">@{amigo.username}</span>
        <span className="friend-status">
          {amigo.conectado ? 'En línea' : 'Desconectado'}
        </span>
      </span>

      <span className="friend-rank" title={`${rango.nombre} · ELO ranked`}>
        {rango.url && <img src={rango.url} alt="" />}
        {amigo.elo}
      </span>

      <span className="friend-actions">
        {onInvitar && (
          <button className="friend-btn" onClick={() => onInvitar(amigo)} title="Invitar a partida">
            Invitar
          </button>
        )}
        {confirmando ? (
          <>
            <button className="friend-btn friend-btn-danger" onClick={confirmarEliminar} disabled={eliminando}>
              {eliminando ? '…' : 'Confirmar'}
            </button>
            <button className="friend-icon-btn" onClick={() => setConfirmando(false)} aria-label="Cancelar">
              <XIcon />
            </button>
          </>
        ) : (
          <button className="friend-icon-btn" onClick={() => setConfirmando(true)} aria-label="Eliminar amigo" title="Eliminar amigo">
            <XIcon />
          </button>
        )}
      </span>
    </li>
  );
}

// ── Buscador con resultados en vivo (autocompletar) ─────────────────
function BuscadorAmigos({ onSolicitudEnviada }: { onSolicitudEnviada: (usuarioId: string) => void }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<UsuarioBusqueda[] | null>(null);
  const [estados, setEstados] = useState<Record<string, EstadoRelacion>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const ultimaBusqueda = useRef(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Cierra al clickear afuera — más confiable que onBlur (que puede
  // cerrar el dropdown antes de que el click en "Agregar" siquiera
  // llegue a procesarse, según el navegador).
  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResultados(null); setBuscando(false); return; }

    setBuscando(true);
    const id = ++ultimaBusqueda.current;
    const t = setTimeout(async () => {
      try {
        const r = await api.social.buscarUsuarios(term);
        if (ultimaBusqueda.current !== id) return; // llegó una búsqueda más nueva mientras esperaba
        setResultados(r);
        if (r.length) {
          const est = await api.social.estadoRelacion(r.map(u => u.id));
          if (ultimaBusqueda.current === id) setEstados(est);
        }
      } catch {
        if (ultimaBusqueda.current === id) setResultados([]);
      } finally {
        if (ultimaBusqueda.current === id) setBuscando(false);
      }
    }, 300); // debounce: no golpear el gateway en cada tecla

    return () => clearTimeout(t);
  }, [q]);

  // El estado (pendiente/amigo/ninguno) queda en memoria desde la última
  // vez que se consultó — si el otro usuario acepta/rechaza mientras el
  // dropdown está cerrado, no hay forma de enterarse sin volver a
  // preguntar. Se refresca cada vez que se reabre (foco), que es cuando
  // el usuario efectivamente vuelve a mirar el resultado.
  async function refrescarEstados() {
    if (!resultados?.length) return;
    try {
      const est = await api.social.estadoRelacion(resultados.map(u => u.id));
      setEstados(est);
    } catch { /* deja el estado anterior si falla */ }
  }

  async function agregar(u: UsuarioBusqueda) {
    setEnviando(u.id);
    try {
      await api.social.enviarSolicitud(u.id);
      setEstados(prev => ({ ...prev, [u.id]: 'pendiente' }));
      onSolicitudEnviada(u.id);
    } catch (e) {
      // 409 = ya son amigos o ya había una solicitud pendiente (mandada
      // por otra vía, ej. desde el fin de partida) — el estado real ya
      // está resuelto, no hay que dejar el botón de "Agregar" colgado.
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('amigos')) setEstados(prev => ({ ...prev, [u.id]: 'amigo' }));
      else if (msg.includes('pendiente')) setEstados(prev => ({ ...prev, [u.id]: 'pendiente' }));
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="friend-search" ref={contenedorRef}>
      <div className="friend-add-form">
        <span className="friend-add-icon"><SearchIcon /></span>
        <input
          type="text"
          placeholder="Buscar por nombre de usuario…"
          value={q}
          onChange={e => { setQ(e.target.value); setAbierto(true); }}
          onFocus={() => { setAbierto(true); refrescarEstados(); }}
        />
      </div>

      {abierto && q.trim().length >= 2 && (
        <div className="friend-search-results">
          {buscando ? (
            <div className="friend-search-loading"><div className="boot-spinner" /></div>
          ) : resultados?.length === 0 ? (
            <p className="friend-search-empty">No hay usuarios que coincidan con "@{q.trim()}"</p>
          ) : (
            resultados?.map(u => {
              const estado = estados[u.id] ?? 'ninguno';
              const foto = avatarUrl(u.avatar);
              return (
                <div key={u.id} className="friend-search-row">
                  <span className="friend-avatar friend-avatar-sm">
                    {foto ? <img src={foto} alt="" /> : u.username[0].toUpperCase()}
                  </span>
                  <span className="friend-username">@{u.username}</span>
                  {estado === 'amigo' ? (
                    <span className="friend-search-tag">Ya son amigos</span>
                  ) : estado === 'pendiente' ? (
                    <span className="friend-search-tag">Pendiente</span>
                  ) : (
                    <button
                      type="button"
                      className="friend-btn"
                      disabled={enviando === u.id}
                      onClick={() => agregar(u)}
                    >
                      <PersonAddIcon /> {enviando === u.id ? 'Enviando…' : 'Agregar'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function FriendsView({ dark, onBack, onInvitarPartida, conectadosEnVivo }: Props) {
  const [amigos, setAmigos] = useState<Amigo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    api.social.amigos()
      .then(setAmigos)
      .catch(() => setError('No se pudo cargar tu lista de amigos'));
  }, []);

  function handleSolicitudEnviada() {
    setEnviado(true);
    setTimeout(() => setEnviado(false), 2500);
  }

  function handleEliminado(usuarioId: string) {
    setAmigos(prev => prev?.filter(a => a.usuario_id !== usuarioId) ?? prev);
  }

  // El WS pisa el valor del fetch inicial solo para los IDs de los que ya
  // vimos un evento explícito de conexión/desconexión esta sesión.
  const amigosConPresenciaViva = amigos?.map(a => ({
    ...a, conectado: conectadosEnVivo?.get(a.usuario_id) ?? a.conectado,
  })) ?? null;

  const conectados = amigosConPresenciaViva?.filter(a => a.conectado) ?? [];
  const desconectados = amigosConPresenciaViva?.filter(a => !a.conectado) ?? [];

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader
        title="Amigos"
        subtitle={amigos ? `${conectados.length} en línea · ${amigos.length} en total` : undefined}
        onBack={onBack}
      />

      <main className="social-body">
        <BuscadorAmigos onSolicitudEnviada={handleSolicitudEnviada} />

        {enviado && <div className="social-toast">Solicitud enviada</div>}
        {error && <div className="social-error">⚠ {error}</div>}

        {amigos === null && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando amigos…</p></div>
        ) : amigos?.length === 0 ? (
          <div className="social-empty">
            <p className="social-empty-icon">👥</p>
            <p className="social-empty-msg">Todavía no tienes amigos agregados</p>
            <p className="social-empty-sub">Busca a alguien arriba, o agrégalo desde el resumen de una partida.</p>
          </div>
        ) : (
          <>
            {conectados.length > 0 && (
              <section className="friend-group">
                <h2 className="friend-group-title">En línea — {conectados.length}</h2>
                <ul className="friend-list">
                  {conectados.map(a => (
                    <FriendRow key={a.usuario_id} amigo={a} onInvitar={onInvitarPartida} onEliminado={handleEliminado} />
                  ))}
                </ul>
              </section>
            )}
            {desconectados.length > 0 && (
              <section className="friend-group">
                <h2 className="friend-group-title">Desconectados — {desconectados.length}</h2>
                <ul className="friend-list">
                  {desconectados.map(a => (
                    <FriendRow key={a.usuario_id} amigo={a} onInvitar={onInvitarPartida} onEliminado={handleEliminado} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
