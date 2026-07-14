const MS_SOCIAL_BASE = () => (process.env.MS_SOCIAL_URL ?? 'http://localhost:6200').trim();

// ── Aviso "poke" a ms-social (docs/ESCALABILIDAD.md) ────────────────
// Fire-and-forget: no bloquea la respuesta al jugador ni tumba la jugada
// si ms-social está caído o lento — el polling de 20s sigue siendo la red
// de seguridad. ms-social reusa el WS de chat de la sala (ya abierto
// mientras dura la partida) para avisarle al cliente que pida el estado
// nuevo; el aviso no lleva el estado en sí, cada jugador sigue pidiendo
// su propia vista enmascarada por GET /juego.
export function avisarPartidaActualizada(salaId: string): void {
  fetch(`${MS_SOCIAL_BASE()}/interno/salas/${salaId}/avisar-partida`, { method: 'POST' })
    .catch(() => { /* ms-social caído/lento: no es motivo para fallar la jugada */ });
}
