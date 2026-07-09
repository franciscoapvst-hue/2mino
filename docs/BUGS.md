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

## 4. ✅ RESUELTO — 2v2 en equipo no funciona en partida casual

**Síntoma**: crear/jugar una partida casual en modo equipo (2v2) no
funciona.

**Causas reales (4 bugs distintos en la misma feature, ninguno específico
de "casual" — afectaba igual al 2v2 en equipo ranked)**:

1. `POST /ranked/party` (`ms-salas/src/routes/matchmaking.ts`) devolvía
   la fila de `ranked_parties` SIN el array `miembros` — `PartyView`
   (`src/components/MatchmakingView.tsx`) lee `party.miembros.length` de
   entrada y crasheaba al renderizar apenas se creaba el equipo (pantalla
   en negro, ni siquiera se llegaba a ver el código de invitación).
2. `leerCodigoPartyDeUrl()` (`src/App.tsx`) parseaba `/party/:codigo` Y
   limpiaba la URL (`history.replaceState`) dentro del inicializador de
   `useState` — React 18 StrictMode invoca ese inicializador dos veces en
   dev para detectar funciones impuras; la primera invocación (descartada)
   ya limpiaba la URL, así que la segunda nunca encontraba el código. El
   link de invitación quedaba roto en dev (movido a una constante de
   módulo, se calcula una sola vez).
3. El creador de la party nunca refrescaba su `party` local tras crearla
   — se quedaba viendo "Esperando compañero…" para siempre aunque el
   invitado ya se hubiera unido del lado del servidor, y el botón
   "Buscar partida (2v2)" nunca se habilitaba (agregado poll cada 2s en
   `MatchmakingView.tsx` mientras `pantalla === 'party'`).
4. Solo el creador llamaba a `buscarConParty()` — el compañero invitado
   nunca disparaba ningún poll propio, así que si la partida ya había
   emparejado (sala creada, bots rellenando huecos) nunca se enteraba y
   se quedaba en el lobby para siempre (mismo poll de arriba extendido a
   avisar el match).
   
   De paso, `POST /ranked/party/:codigo/unirse` tenía una carrera (dos
   llamadas concurrentes al mismo `unirse` — típico con StrictMode —
   podían chocar contra la PK `(party_id, usuario_id)` y tirar 500);
   arreglado con `ON CONFLICT DO NOTHING`.

**Verificado**: dos sesiones reales (Playwright, dos usuarios distintos)
— creador crea equipo casual, comparte link, invitado se une, creador
arranca la búsqueda, ambos entran automáticamente al tablero (2v2 real,
huecos rellenados con bots tras el timeout de casual).
