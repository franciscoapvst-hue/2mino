# Plan — Rediseño de escritorio: dashboard, navegación lateral y torneos

**Sesión 1** · agrupa los puntos 1, 3 y 13. Referencia visual: chess.com (punto 8).

## Contexto

La app es **mobile-first** y en PC desaprovecha la pantalla: para ver los modos de
juego hay que scrollear. chess.com resuelve esto poniendo **todo above-the-fold** al
abrir: modos de juego, revisión de la última partida y contadores de stats
interesantes (racha de días, racha de victorias, problemas resueltos). En 2mino
aplican los dos primeros contadores hoy (no hay puzzles todavía — ver
`PLAN_PUZZLES.md`).

Hoy (`src/components/Dashboard.tsx` + `src/dashboard.css`): nav superior con íconos
(tema, fichas, amigos, bandeja, saldo, avatar, salir) y un `<main>` vertical largo
(hero de rango → "elige cómo jugar" → ranked destacado → casual/salas → torneos →
comunidad → modos). En PC eso deja medio dashboard fuera de vista.

## Alcance

**Sí:**
- Layout **responsive de dos columnas en PC** (≥ ~1024px): **sidebar izquierdo fijo**
  + área principal con todo lo importante above-the-fold. En móvil colapsa al layout
  actual (nav arriba, contenido apilado) — no romper lo que ya funciona.
- **Sidebar (punto 3)**: empaqueta amigos, tienda, fichas (PieceDemo), leaderboard,
  toggle de tema, y el perfil/salir. Se puede **duplicar** una opción (ej. leaderboard)
  para no tener que sacarla del contenido principal.
- **El sidebar persiste en TODA la app, incluida la partida (`/game`)**: es un **shell a
  nivel de app** (no un componente que viva sólo dentro del `Dashboard`). Envuelve el
  contenido ruteado, así que al entrar a una partida, la tienda, amigos, etc. el sidebar
  sigue visible en PC y no "salta" entre pantallas. En la partida el sidebar queda al
  costado y la mesa ocupa el resto del ancho. En móvil el sidebar colapsa (drawer/oculto)
  para no robarle espacio a la mesa.
- **Dashboard reordenado (punto 1)**: arriba y sin scroll — modos de juego (ranked/
  casual/salas), **tarjeta de "última partida"** con botón a su replay
  (`api.historial.misPartidas()` ya existe → tomar la más reciente), y una **fila de
  contadores** (racha de días jugados, racha de victorias, + ELO/partidas/ganadas/
  capicúas que ya da `api.social.perfilJugador`).
- **Banner de torneos llamativo (punto 13)**: hero destacado, distinto del resto,
  con la **fecha del próximo torneo** e imagen promocional. Es el eje de monetización.

**No (en esta sesión):**
- Puzzles (S6), racha real (S4) — el dashboard deja el **espacio y el componente** de
  esos contadores, mostrando 0/"—" hasta que esas sesiones aterricen.
- Rediseño del in-game (GameBoard) — solo el dashboard/shell.

## Dónde vive

- **Frontend, solo capa de presentación** (no toca backend salvo lo indicado):
  - `src/components/AppShell.tsx` (nuevo) — **shell a nivel de app**: sidebar fijo +
    slot para el contenido ruteado. Se monta en `src/App.tsx` envolviendo las rutas
    autenticadas (dashboard, tienda, amigos, leaderboard, historial y **también
    `/game/:salaId`**), para que el sidebar persista entre pantallas y dentro de la
    partida. En móvil el shell colapsa el sidebar (drawer) y deja el layout actual.
  - `src/components/AppSidebar.tsx` (nuevo) — el menú lateral en sí (usado por el shell).
  - `src/components/Dashboard.tsx` — deja de contener el nav; pasa a ser sólo el
    **contenido** del dashboard (hero, modos, última partida, stats), dentro del shell.
  - `src/components/game/GameBoard.tsx` — su nav propio se simplifica (el sidebar ya da
    la navegación global); en PC la mesa vive en el área de contenido junto al sidebar,
    en móvil el sidebar se oculta y la partida ocupa todo (como hoy).
  - `src/app-shell.css` (nuevo) / `src/dashboard.css` — grid `sidebar + contenido` con
    `@media (min-width: 1024px)`; colapso a 1 columna / drawer en móvil. Reusar tokens
    `--d-*`/`--amber`/`--teal`.
  - `src/components/UltimaPartidaCard.tsx` (nuevo) — usa `api.historial.misPartidas()`
    (ya existe) + link a `/replay/:salaId`.
  - `src/components/StatsFila.tsx` (nuevo) — contadores; consume `api.social.perfilJugador`
    (elo/partidas/ganadas/capicúas ya disponibles) + placeholders de racha/puzzles.
  - Banner de torneos: componente en el dashboard que llama a un endpoint nuevo de
    "próximo torneo".
- **Backend (mínimo, para el banner)**: `ms-salas` — endpoint público
  `GET /torneos/proximo` (el más cercano en estado inscripción/programado) proxeado por
  el gateway. El schema de torneos ya existe (`PLAN_TORNEOS.md`).

## Etapas

1. ✅ **Shell a nivel de app** (`AppShell.tsx` + `AppSidebar.tsx`, montado en `App.tsx`
   como layout route con `<Outlet/>`, envolviendo las rutas autenticadas incluida
   `/game`): sidebar fijo en PC + slot de contenido; drawer/colapso en móvil. Navegación
   migrada al sidebar (con íconos coloridos generados). Verificado: no se remonta al
   navegar, persiste dentro de la partida y colapsa bien en móvil.
2. ✅ **Dashboard como contenido** dentro del shell + **above-the-fold**: ranked/casual/
   salas pasaron de banner-gigante+fila-de-2 a una sola fila de 3 cards; se sacó la
   sección "Comunidad" (leaderboard/historial, redundante con el sidebar) y los chips de
   "Modos". Medido: 746px de contenido en 1366×768 (viewport 768) — sin scroll.
3. ✅ **`UltimaPartidaCard.tsx`** (última de `api.historial.misPartidas()`, link a replay)
   + **`StatsFila.tsx`** (ELO/partidas/ganadas/capicúas vía `api.ranked.me()` +
   `api.social.perfilJugador()`; racha de días/victorias en "—" hasta S4). Grid
   `auto-fit` para que stats ocupe todo el ancho si todavía no hay última partida.
4. ✅ **`GET /torneos/proximo`** (ms-salas, filtra `estado='inscripcion' AND
   visibilidad='publico'`) + proxy público nuevo en el gateway (`api-integracion/src/
   routes/torneos.ts`, separado de `/admin/torneos/*`) + **`TorneoBanner.tsx`** (no
   renderiza nada si no hay torneo). Verificado end-to-end con un torneo real ya
   sembrado.
5. ✅ **GameBoard dentro del shell**: no hizo falta tocar `GameBoard.tsx` — su nav propio
   ya era mínimo (Salir/código/turno, sin duplicar el sidebar) y el layout ya convivía
   bien desde la Etapa 1. Reverificado con una partida real: mesa arranca en x=248 sin
   overlap ni scroll horizontal en PC, ancho completo en móvil con sidebar oculto.

**Nota de infra**: `ms-salas` y `api-integracion` corren en Docker desde una imagen
compilada (sin volumes de hot-reload) — cambios de backend necesitan
`docker compose build <servicio> && docker compose up -d <servicio>`, no alcanza con
`restart`.

## Verificación

`tsc` limpio en frontend; en navegador a 1366×768 y 1920×1080: todo above-the-fold, el
sidebar navega a cada sección, la tarjeta de última partida linkea al replay correcto,
el banner muestra la fecha del próximo torneo. **Entrar a una partida (`/game/:salaId`) y
confirmar que el sidebar sigue visible y funcional en PC**, y que la mesa convive bien a
su lado (sin romper drag/drop ni el layout del tablero). Probar el colapso a móvil
(375px): el sidebar se oculta/drawer y la partida ocupa todo, idéntico a hoy.

## Fuera de alcance

Puzzles y su contador real (S6) · racha real (S4) · rediseño de la **lógica** o el
tablero del in-game (solo se integra GameBoard al shell y se ajusta su layout; la mesa,
fichas y reglas quedan como están).
