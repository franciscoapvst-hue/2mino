// ── WS de chat de una sala (docs/CASOS_DE_USO_SOCIAL.md §8.2) ───────
// Distinto de useSocialSocket: este es por-sala, no por-usuario/global.
// Carga el historial por REST y después escucha (y manda) mensajes por WS.
//
// Este mismo socket, ya abierto todo el tiempo que dura la partida (lo usa
// GameBoard, esté el chat abierto o no), se reusa para el aviso "poke" de
// docs/ESCALABILIDAD.md: cuando ms-salas persiste una jugada, avisa a
// ms-social y esta hace broadcast `partida_actualizada` a todos los
// conectados a la sala — evita abrir un segundo WS solo para eso.
import { useEffect, useRef, useState } from 'react';
import { api, tokenStore, type ChatMensaje } from '../api';

function wsUrl(path: string, token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}

export function useSalaChat(
  salaId: string,
  miUsername: string,
  onPartidaActualizada?: () => void,
): {
  mensajes: ChatMensaje[];
  enviar: (mensaje: string) => void;
} {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  // El servidor valida membresía (llamada async a ms-salas) antes de
  // aceptar mensajes; espera su 'listo' en vez de mandar apenas abre el
  // socket, si no el primer mensaje puede llegar antes de que termine de
  // validar y se pierde.
  const listoRef = useRef(false);
  // Ref para no reabrir el socket cada vez que el caller pasa un callback
  // con identidad nueva (ej. fetchPartida recreado por un useCallback).
  const onPartidaActualizadaRef = useRef(onPartidaActualizada);
  onPartidaActualizadaRef.current = onPartidaActualizada;

  useEffect(() => {
    api.social.chatHistorial(salaId, miUsername).then(setMensajes).catch(() => {});
  }, [salaId, miUsername]);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;

    let cerrado = false;
    listoRef.current = false;
    const ws = new WebSocket(wsUrl(`/ws/chat/${salaId}`, token));
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      if (cerrado) return;
      let msg: { tipo?: string; mensaje?: ChatMensaje };
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.tipo === 'listo') {
        listoRef.current = true;
      } else if (msg.tipo === 'mensaje_nuevo' && msg.mensaje) {
        setMensajes(prev => [...prev, msg.mensaje!]);
      } else if (msg.tipo === 'partida_actualizada') {
        onPartidaActualizadaRef.current?.();
      }
    };

    return () => {
      cerrado = true;
      listoRef.current = false;
      ws.close();
    };
  }, [salaId]);

  function enviar(mensaje: string) {
    const t = mensaje.trim();
    if (!t || !listoRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ mensaje: t }));
  }

  return { mensajes, enviar };
}
