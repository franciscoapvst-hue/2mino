// ── WS de presencia + notificaciones (docs/CASOS_DE_USO_SOCIAL.md §2.3) ──
// Un socket por usuario, abierto una vez en el layout autenticado (ver
// App.tsx). Sin Context/Provider: el resultado de este hook se pasa hacia
// abajo como props (mismo patrón de prop-drilling que ya usa el resto de
// la app — no hay precedente de Context acá, no hace falta introducirlo).
import { useEffect, useRef, useState } from 'react';

export type SocialSocketState = {
  /**
   * Estado de presencia visto EN VIVO por el socket, por usuario_id.
   * Es un Map (no un Set) a propósito: hace falta distinguir "vi un
   * evento diciendo que se desconectó" de "nunca vi un evento de este
   * usuario" — con un Set ambos casos se ven iguales ("no está"), y un
   * amigo que ya estaba online ANTES de abrir el socket (sin evento de
   * conexión propio) se mostraría mal al desconectarse. El consumidor
   * hace `enVivo.get(id) ?? valorDelFetchInicial`.
   */
  enVivo: Map<string, boolean>;
  /** Se incrementa cada vez que llega `notificacion_nueva` — los
   *  consumidores lo ponen en un useEffect(deps) para refetch inmediato. */
  notifVersion: number;
};

function wsUrl(path: string, token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}

export function useSocialSocket(token: string | null): SocialSocketState {
  const [enVivo, setEnVivo] = useState<Map<string, boolean>>(new Map());
  const [notifVersion, setNotifVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    let cerrado = false;
    const ws = new WebSocket(wsUrl('/ws/social', token));
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      if (cerrado) return;
      let msg: { tipo?: string; usuario_id?: string };
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.tipo === 'amigo_conectado' && msg.usuario_id) {
        setEnVivo(prev => new Map(prev).set(msg.usuario_id!, true));
      } else if (msg.tipo === 'amigo_desconectado' && msg.usuario_id) {
        setEnVivo(prev => new Map(prev).set(msg.usuario_id!, false));
      } else if (msg.tipo === 'notificacion_nueva') {
        setNotifVersion(v => v + 1);
      }
    };

    return () => {
      cerrado = true;
      ws.close();
    };
  }, [token]);

  return { enVivo, notifVersion };
}
