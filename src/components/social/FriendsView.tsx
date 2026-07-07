import { useEffect, useState, type FormEvent } from 'react';
import { api, type Amigo } from '../../api';
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

export default function FriendsView({ dark, onBack, onInvitarPartida, conectadosEnVivo }: Props) {
  const [amigos, setAmigos] = useState<Amigo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    api.social.amigos()
      .then(setAmigos)
      .catch(() => setError('No se pudo cargar tu lista de amigos'));
  }, []);

  async function handleAgregar(e: FormEvent) {
    e.preventDefault();
    const u = username.trim().replace(/^@/, '');
    if (!u) return;
    setEnviando(true);
    setEnviado(null);
    try {
      await api.social.enviarSolicitud(u);
      setEnviado(u);
      setUsername('');
    } catch {
      setError('No se pudo enviar la solicitud');
    } finally {
      setEnviando(false);
    }
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
        <form className="friend-add-form" onSubmit={handleAgregar}>
          <span className="friend-add-icon"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Agregar por nombre de usuario"
            value={username}
            onChange={e => { setUsername(e.target.value); setEnviado(null); }}
            disabled={enviando}
          />
          <button type="submit" disabled={enviando || !username.trim()}>
            <PersonAddIcon /> {enviando ? 'Enviando…' : 'Agregar'}
          </button>
        </form>

        {enviado && <div className="social-toast">Solicitud enviada a @{enviado}</div>}
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
