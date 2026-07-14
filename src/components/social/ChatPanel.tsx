import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChatIcon, SendIcon, SmileIcon, XIcon } from '../icons';
import type { ChatMensaje } from '../../api';

type Props = {
  mensajes: ChatMensaje[];
  enviar: (mensaje: string) => void;
  miUsuarioId: string;
};

// Set curado de emoji Unicode nativos (sin librería externa — ver
// docs/CASOS_DE_USO_SOCIAL.md §8.3: nada de picker custom pesado,
// el mensaje viaja como texto plano normal).
const EMOJIS = ['😀', '😂', '😎', '🔥', '💪', '👏', '🎉', '🤔', '😅', '😤', '🎲', '🁣', '⚡', '🔒', '🏆', '😭', '🙌', '👀'];

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ mensajes, enviar: enviarWs, miUsuarioId }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // El primer cambio de `mensajes` es la carga del historial (no son
  // mensajes "nuevos" sin leer) — se salta con este ref.
  const historialCargado = useRef(false);

  useEffect(() => {
    if (!historialCargado.current) { historialCargado.current = true; return; }
    if (!abierto) setNoLeidos(n => n + 1);
  }, [mensajes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, abierto]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    enviarWs(texto);
    setTexto('');
    setEmojiAbierto(false);
  }

  function insertarEmoji(e: string) {
    setTexto(t => t + e);
  }

  return (
    <div className={`chat-widget${abierto ? ' is-open' : ''}`}>
      {abierto && (
        <div className="chat-panel">
          <header className="chat-panel-head">
            <span>Chat de la partida</span>
            <button className="friend-icon-btn" onClick={() => setAbierto(false)} aria-label="Cerrar chat">
              <XIcon />
            </button>
          </header>

          <div className="chat-messages" ref={listRef}>
            {mensajes.length === 0 && <p className="chat-empty">Todavía no hay mensajes. ¡Saluda! 👋</p>}
            {mensajes.map(m => (
              <div key={m.id} className={`chat-msg${m.usuario_id === miUsuarioId ? ' chat-msg-mine' : ''}`}>
                {m.usuario_id !== miUsuarioId && <span className="chat-msg-author">@{m.username}</span>}
                <span className="chat-msg-bubble">{m.mensaje}</span>
                <span className="chat-msg-time">{formatHora(m.created_at)}</span>
              </div>
            ))}
          </div>

          {emojiAbierto && (
            <div className="chat-emoji-grid">
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => insertarEmoji(e)}>{e}</button>
              ))}
            </div>
          )}

          <form className="chat-input-row" onSubmit={enviar}>
            <button type="button" className="chat-emoji-toggle" onClick={() => setEmojiAbierto(o => !o)} aria-label="Emojis">
              <SmileIcon />
            </button>
            <input
              type="text"
              maxLength={280}
              placeholder="Escribe un mensaje…"
              value={texto}
              onChange={e => setTexto(e.target.value)}
            />
            <button type="submit" className="chat-send-btn" disabled={!texto.trim()} aria-label="Enviar">
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      <button
        className="chat-fab"
        onClick={() => { setAbierto(o => !o); setNoLeidos(0); }}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir chat'}
      >
        <ChatIcon />
        {!abierto && noLeidos > 0 && <span className="chat-fab-badge">{noLeidos}</span>}
      </button>
    </div>
  );
}
