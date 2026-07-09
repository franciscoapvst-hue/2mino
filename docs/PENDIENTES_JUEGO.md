# Features pendientes del juego

Registro de features nuevas pedidas para la partida en sí (`GameBoard`/
`ms-salas`), pendientes de implementar. No confundir con `docs/BUGS.md`
(eso es lo que ya existe y está roto) ni con
`docs/CASOS_DE_USO_BACKOFFICE.md` (features del panel de administración
— aunque la #2 de acá conecta directo con ese documento, ver abajo).

---

## 1. Mostrar las fichas de los participantes al final de cada mano

**Pedido**: al cerrar una mano (dominó/capicúa/tranca), antes de pasar a
la siguiente, los jugadores deben poder ver las fichas que le quedaron
en la mano a **todos** los participantes — hoy `ManoOverlay`
(`src/components/game/GameBoard.tsx`) solo muestra el resultado (título,
puntos, marcador), nunca las fichas restantes de nadie.

**Por qué importa**: en dominó tradicional, mostrar las fichas al cerrar
la mano es lo que permite verificar el conteo de pips de una tranca (y
en general, transparencia — nadie puede dudar de cómo se calcularon los
puntos). Hoy el jugador tiene que confiar en el número que aparece, sin
poder ver de dónde salió.

**Dónde mirar**:
- `ms-salas/src/game/logic.ts` — `PartidaState.manos` ya tiene las fichas
  de TODOS los asientos en todo momento (server-autoritativo), pero
  `vistaPublica()` solo expone `miMano` (las propias) y `conteoManos`
  (cantidad, no el contenido) de los demás — por diseño, para no
  revelarle la mano rival a mitad de partida.
- Al cerrar una mano (`resultadoMano !== null`, fase `entre_manos`), YA
  no hay razón para seguir ocultando las fichas de esa mano que recién
  terminó — hay que decidir si `vistaPublica()` expone las manos
  completas de todos SOLO cuando `fase === 'entre_manos'` (o
  `'fin_partida'`), o si conviene un endpoint/campo separado
  (`manosReveladas`) para no tocar el contrato de `miMano`/`conteoManos`
  que ya consume el resto del código.
- Frontend: `ManoOverlay` en `GameBoard.tsx` necesita una fila más
  mostrando cada jugador con sus fichas restantes (o "sin fichas" si
  cerró por dominó).

**Nota**: esto es contenido nuevo del lado del servidor (hoy la mano
ajena nunca viaja al cliente), no es solo un cambio visual.

---

## 2. Tiempo límite para jugar, configurable por tipo de partida desde el Back Office

**Pedido**: cada jugador debe tener un tiempo límite para hacer su
jugada (aplica/pasar), variable según el tipo de partida (casual vs
ranked, posiblemente también por modo clásico/rápido). Este límite tiene
que poder configurarse desde el Back Office, sin redeploy.

**Encaja directo en el plan ya escrito**: `docs/CASOS_DE_USO_BACKOFFICE.md`
§6 ("Reglas del juego") ya preveía este tipo de configuración —incluso
antes de que se pidiera esto puntual— con el mismo patrón clave→valor
que `landing_config`. Se agregó ahí la fila propuesta
`tiempo_limite_jugada_ms` (objeto `{"casual": ms, "ranked": ms}`,
`null` = sin límite).

**Qué falta decidir/diseñar cuando se implemente**:
- **Qué pasa al agotarse el tiempo**: ¿se pasa el turno automáticamente
  (como un pase forzado), se juega una ficha al azar, o se abandona la
  mano? El comportamiento más parecido a como ya funcionan los bots
  (`ms-salas/src/game/bots.ts`, siempre juegan la primera ficha jugable)
  sería lo más simple de reusar: agotado el tiempo, tratar al jugador
  como si fuera un bot por un turno.
- **Dónde vive el reloj**: server-autoritativo (ms-salas) para que no se
  pueda hacer trampa desde el cliente — probablemente un timestamp
  `turnoEmpiezaEn` en `PartidaState`, chequeado en cada request (o un
  timer del lado del servidor que dispare el pase forzado).
- **UI**: countdown visible en `GameBoard.tsx` (barra o número), con
  aviso cuando queda poco tiempo.
- Esto depende de que el paso 1 del plan del Back Office
  (`docs/CASOS_DE_USO_BACKOFFICE.md` §9) — segmento `admin` — y el paso 4
  (reglas del juego, tabla `reglas_juego`) ya estén implementados;
  reglas del juego es justo el próximo paso pendiente del roadmap del BO.
