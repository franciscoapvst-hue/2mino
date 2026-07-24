# Plan — Modo Puzzle

**Sesión 6** · punto 2. Referencia: los puzzles de chess.com (punto 8).

## Contexto

No existe modo puzzle. Se quiere un modo con **puzzles divertidos de dominó** que sigan
la **teoría del juego** (bloqueo, conteo, forzar tranca, contar pips del rival, jugar la
capicúa, no "regalar" el doble, etc.) para que el jugador **avance como jugador**. Es
también el contador "problemas resueltos" del dashboard de escritorio (S1).

Ventaja: gran parte de la lógica ya existe y se reusa — `src/game/local-rules.ts`
(`puedeJugar`, `getExtremos`, `crearSet`), `DominoPiece`/`SnakeBoard` para dibujar, y el
patrón de vistas por ruta de `App.tsx`.

## Alcance

**Sí:**
- Un **puzzle** = un estado de tablero + tu mano + un objetivo, con **una (o pocas)
  jugadas correctas**. Ej.: "te toca, ¿qué ficha juega para trancar y ganar?" / "cuenta
  los pips y elige la jugada que fuerza el paso del rival".
- **Catálogo de puzzles** con dificultad y **tema/teoría** (bloqueo, conteo, capicúa…),
  y una **progresión** (se desbloquean / suben de dificultad; se guarda cuáles resolvió
  el usuario).
- **Validación de la solución** reusando `local-rules` (la jugada correcta y por qué).
- **Feedback didáctico**: al resolver, una explicación corta de la teoría aplicada.
- Contador `puzzles_resueltos` por usuario (para el dashboard).

**No (v1):**
- Editor de puzzles en el BO (v1 se siembran a mano / por seed, como los segmentos) ·
  puzzles multi-jugada largos · ranking de puzzles · generación automática.

## Dónde vive

- **Backend** (`ms-salas`, dueño de las reglas del juego):
  - Tabla `puzzles`: `id`, `dificultad`, `tema`, `tablero JSONB`, `mano JSONB`,
    `solucion JSONB` (jugada(s) correcta(s) + lado), `explicacion TEXT`, `orden`.
  - Tabla `puzzle_progreso`: `usuario_id`, `puzzle_id`, `resuelto_at`, `intentos`.
  - Rutas: `GET /puzzles/siguiente` (el próximo sin resolver según progresión),
    `GET /puzzles/:id`, `POST /puzzles/:id/intentar { pieza, lado }` → correcto/incorrecto
    + explicación; al acertar registra progreso.
  - Seed inicial (10-20 puzzles curados por tema/dificultad).
- **Gateway**: proxy público `/puzzles/*` (verifyToken).
- **Frontend**:
  - `src/components/puzzle/PuzzleView.tsx` (nuevo) — dibuja tablero+mano con
    `SnakeBoard`/`DominoPiece`, deja intentar, muestra correcto/incorrecto + explicación,
    botón "siguiente".
  - Ruta `/puzzles` en `App.tsx` + entrada en el dashboard/sidebar (S1).
  - `src/api.ts` — `api.puzzles.siguiente()/intentar()`, tipos.
- **`ms-usuarios`/dashboard** — el contador `puzzles_resueltos` (o exponerlo desde
  ms-salas `puzzle_progreso`).

## Etapas

1. **Schema + seed** (`ms-salas`: `puzzles`, `puzzle_progreso`) + 10-15 puzzles curados
   por tema (bloqueo, conteo, capicúa, tranca).
2. **Rutas** `GET /puzzles/siguiente|:id`, `POST /puzzles/:id/intentar` (validación con
   `local-rules`) + gateway.
3. **`PuzzleView`** (frontend) reusando `SnakeBoard`/`DominoPiece`, con feedback
   didáctico + progresión.
4. **Contador** de resueltos para el dashboard + entrada en nav.

## Verificación

Resolver un puzzle con la jugada correcta → "correcto" + explicación + avanza al
siguiente; una jugada incorrecta → "incorrecto" sin marcar resuelto; el progreso persiste
entre sesiones; el contador de "problemas resueltos" del dashboard sube.

## Fuera de alcance

Editor en el BO (v1 seed a mano) · generación automática de puzzles · ranking · puzzles
multi-jugada largos.
