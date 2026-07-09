# Bugs conocidos

Registro de bugs reales reportados, pendientes de fix. No confundir con
`docs/CASOS_DE_USO_BACKOFFICE.md` (eso es diseño de features nuevas) —
esto es lo que ya existe y está roto.

---

## 1. ✅ RESUELTO — Cola de matchmaking no reconecta a la cola/partida en curso

**Síntoma**: si un jugador ya está en una cola de matchmaking (ranked o
casual) y, desde otra pestaña/dispositivo o tras recargar, intenta entrar
a buscar partida de nuevo, no lo reconecta a la cola en la que ya estaba
ni a la partida si ya le tocó — puede terminar duplicado en dos colas, o
perdiendo el estado de la búsqueda en curso.

**Fix aplicado**:
- `src/components/MatchmakingView.tsx`: al montar (sin link de invitación
  de por medio), consulta `GET /ranked/cola/estado` antes de mostrar el
  menú — si hay una cola o partida en curso, reconecta directo a esa
  pantalla en vez de ofrecer "buscar" de nuevo. Muestra un spinner
  ("Verificando si ya tenías una búsqueda en curso…") mientras resuelve.
- `ms-salas/src/routes/matchmaking.ts` (`POST /ranked/cola/entrar`): el
  chequeo de "ya estás en cola" solo miraba `usuario_id` — los tickets de
  party van por `party_id` sin `usuario_id`, así que un jugador ya en cola
  vía su equipo podía crear un segundo ticket (solo) en paralelo. Ahora
  también chequea `party_id` vía `ranked_party_miembros`.

Verificado: registro → cola → reload de página → dashboard → reentrar a
matchmaking → reconecta directo a "Buscando partida" sin pasar por el
menú (Playwright). Y por API: usuario en cola vía party que intenta
`entrar` solo recibe `400 "Ya estás en cola"` en vez de duplicar ticket.

---

## 2. Pantalla de repetición (replay) no agrupa por mano

**Contexto**: una partida se juega a un puntaje objetivo (100/150/200) y
dentro de ella puede haber **varias manos** — cada mano termina al
llegar alguien a la cantidad de puntos de esa mano puntual (o por
tranca), no de la partida completa. Hoy el replay no refleja esa
jerarquía.

**Síntoma**: la pantalla de repetición muestra todas las jugadas de la
partida en una sola secuencia plana, sin indicar dónde termina una mano y
empieza la siguiente.

**Comportamiento esperado**: las jugadas deben agruparse visualmente por
mano (ej. "Mano 1", "Mano 2"...), cada una con su propio resultado
parcial (quién ganó esa mano, cuántos puntos sumó), no solo el resultado
final de la partida completa.

**Sospechosos**: `src/game/replay-engine.ts` (o el componente que
consume su output) — probablemente no está usando el límite de mano
(`hubo_capicua`/cierre de mano) como separador de grupos.

---

## 3. Fichas de repetición no escalan bien en manos largas

**Síntoma**: cuando una mano tiene muchas jugadas, la pantalla de
repetición se ve mal — las fichas no reducen de tamaño lo suficiente para
que la secuencia completa quepa/se lea bien.

**Comportamiento esperado**: el tamaño de ficha debe reducirse más
agresivamente cuando la cantidad de jugadas de la mano es alta, y la
navegación debe dejar ver el tablero **jugada por jugada** (no solo el
estado final), para poder repasar la mano paso a paso.

**Sospechosos**: mismo componente de replay que el bug #2 — el cálculo de
tamaño de ficha probablemente tiene un piso que no baja lo suficiente
para manos largas, y falta un control de "siguiente/anterior jugada"
explícito si no existe ya.

---

## 4. 2v2 en equipo no funciona en partida casual

**Síntoma**: crear/jugar una partida casual en modo equipo (2v2) no
funciona — reportado sin más detalle todavía, hace falta reproducir para
aislar si es un problema de matchmaking casual (armado de parties/equipos),
de creación de sala, o de la lógica de turnos 2v2 dentro del `GameBoard`.

**Siguiente paso**: reproducir el flujo completo (crear party de 2,
buscar partida casual 2v2, ver qué falla exactamente — no arma la sala,
arma mal los equipos, o rompe una vez adentro) antes de asumir dónde está
la causa raíz.

**Sospechosos**: `ms-salas/src/game/matchmaking.ts` (rama casual 2v2),
`src/` — flujo de creación de party y armado de equipos para casual.
