const MS_SOCIAL_BASE   = () => (process.env.MS_SOCIAL_URL   ?? 'http://localhost:6200').trim();
const MS_USUARIOS_BASE = () => (process.env.MS_USUARIOS_URL ?? 'http://localhost:4000').trim();

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

// ── Otorgar doblones ganados jugando (docs/PLAN_COSMETICOS.md Etapa 2) ──
// Fire-and-forget a ms-usuarios (dueño de la billetera — ms-salas no toca
// esas tablas directo, mismo criterio de dominio que el ELO sí es de
// ms-salas): un fallo acá no debe tumbar el cierre de la partida ya
// persistido. La idempotencia vive del otro lado (índice único por
// usuario+motivo+ref), así que reintentar el mismo otorgamiento es
// inofensivo. A diferencia del "poke" a ms-social, este SÍ lleva body, así
// que corresponde mandar Content-Type (ver la nota de callService en
// docs/ARQUITECTURA.md: el problema era mandarlo SIN body, no al revés).
export function otorgarDoblones(usuarioId: string, monto: number, motivo: string, ref: string): void {
  fetch(`${MS_USUARIOS_BASE()}/interno/billetera/${usuarioId}/otorgar`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ monto, motivo, ref }),
  }).catch(() => { /* ms-usuarios caído/lento: no es motivo para fallar la partida */ });
}
