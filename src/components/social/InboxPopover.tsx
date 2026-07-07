import { useEffect, useState } from 'react';
import { api, type Notificacion } from '../../api';
import { CheckIcon, XIcon } from '../icons';

type Props = {
  onClose: () => void;
  /** Unirse a una sala/party por código (stub — wire a la navegación real de matchmaking/salas). */
  onUnirseSala?: (codigo: string) => void;
};

function tiempoRelativo(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export default function InboxPopover({ onClose, onUnirseSala }: Props) {
  const [items, setItems] = useState<Notificacion[] | null>(null);
  const [resolviendo, setResolviendo] = useState<string | null>(null);

  useEffect(() => {
    api.social.notificaciones().then(setItems).catch(() => setItems([]));
  }, []);

  async function responder(n: Notificacion, accion: 'aceptar' | 'rechazar') {
    // n.id es el ID de la NOTIFICACIÓN (tabla notificaciones); los
    // endpoints de aceptar/rechazar necesitan el ID de la SOLICITUD
    // (tabla solicitudes_amistad), que viaja en el payload.
    const solicitudId = n.payload.solicitud_id;
    if (!solicitudId) return;

    setResolviendo(n.id);
    try {
      if (accion === 'aceptar') await api.social.aceptarSolicitud(solicitudId);
      else await api.social.rechazarSolicitud(solicitudId);
      setItems(prev => prev?.filter(x => x.id !== n.id) ?? prev);
    } finally {
      setResolviendo(null);
    }
  }

  async function marcarLeida(n: Notificacion) {
    if (n.leida) return;
    await api.social.marcarLeida(n.id);
    setItems(prev => prev?.map(x => x.id === n.id ? { ...x, leida: true } : x) ?? prev);
  }

  function unirse(n: Notificacion) {
    const codigo = n.payload.sala_codigo ?? n.payload.party_codigo;
    if (codigo) onUnirseSala?.(codigo);
    marcarLeida(n);
  }

  return (
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div className="inbox-popover" role="dialog" aria-label="Bandeja de entrada">
        <header className="inbox-head">
          <h2>Bandeja de entrada</h2>
        </header>

        <div className="inbox-list">
          {items === null ? (
            <div className="social-loading social-loading-compact"><div className="boot-spinner" /></div>
          ) : items.length === 0 ? (
            <p className="inbox-empty">No tienes notificaciones nuevas</p>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                className={`inbox-item${n.leida ? '' : ' inbox-item-unread'}`}
                onClick={() => marcarLeida(n)}
              >
                <span className="inbox-item-avatar">{n.de_username[0].toUpperCase()}</span>
                <div className="inbox-item-body">
                  <p className="inbox-item-text">
                    <strong>@{n.de_username}</strong>{' '}
                    {n.tipo === 'solicitud_amistad' && 'quiere ser tu amigo'}
                    {n.tipo === 'amistad_aceptada' && 'aceptó tu solicitud de amistad'}
                    {n.tipo === 'invitacion_partida' && 'te invitó a una partida'}
                  </p>
                  <span className="inbox-item-time">{tiempoRelativo(n.created_at)}</span>

                  {n.tipo === 'solicitud_amistad' && (
                    <div className="inbox-item-actions">
                      <button
                        className="inbox-action-btn inbox-action-accept"
                        disabled={resolviendo === n.id}
                        onClick={e => { e.stopPropagation(); responder(n, 'aceptar'); }}
                      >
                        <CheckIcon /> Aceptar
                      </button>
                      <button
                        className="inbox-action-btn"
                        disabled={resolviendo === n.id}
                        onClick={e => { e.stopPropagation(); responder(n, 'rechazar'); }}
                      >
                        <XIcon /> Rechazar
                      </button>
                    </div>
                  )}

                  {n.tipo === 'invitacion_partida' && (
                    <div className="inbox-item-actions">
                      <button
                        className="inbox-action-btn inbox-action-accept"
                        onClick={e => { e.stopPropagation(); unirse(n); }}
                      >
                        Unirse — {n.payload.sala_codigo ?? n.payload.party_codigo}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
