# Plan de refactor — mantenibilidad

> Auditoría de todo el proyecto (frontend + los 4 microservicios) con foco en
> mantenibilidad. Este documento **no cambia código**: describe qué duele, por
> qué, y en qué orden conviene atacarlo. Cada punto es independiente salvo donde
> se indica una dependencia.

## Principios

- **Nada de big-bang.** Cada punto se puede hacer en su propia rama/PR y dejar el
  proyecto funcionando. No hay que reescribir de cero.
- **Fuente única de verdad.** La mayoría de los problemas nacen de tener la misma
  información en dos sitios que luego divergen.
- **Red de seguridad antes de mover cosas grandes.** Tests sobre la lógica pura
  primero; así los refactors siguientes son seguros.

## Lo que ya está bien (no tocar)

Para calibrar: el proyecto está sano para su etapa. Conviene **preservar** estas
decisiones al refactorizar:

- Lógica de juego como **funciones puras** y **servidor autoritativo**
  (`ms-salas/src/game/logic.ts`). El cliente no decide reglas.
- Patrón **API Gateway**: los microservicios no publican puertos, solo
  `api-integracion`.
- **SQL parametrizado** en todas las consultas (sin inyección).
- **Esquemas OpenAPI** por ruta y Swagger UI en `/docs`.
- Documentación de arquitectura al día (`docs/ARQUITECTURA.md`).

---

## Hallazgos, por prioridad

Escala de esfuerzo: **S** (horas) · **M** (medio día) · **L** (varios días).

### P1 — Lógica de dominó duplicada front/back · esfuerzo M · riesgo alto si no se hace

**Qué:** `src/game/types.ts` y `ms-salas/src/game/logic.ts` son copias casi
idénticas (`crearSet`, `barajar`, `repartir`, `colocarFicha`, `getExtremos`,
`puedeJugar`, `esCapicua`, `sumaPips`, `calcResultado`).

**Evidencia de que ya divergen:**
- `ResultadoMano` en el front usa `ganador: 0|1|2|3`; en el back usa
  `ganadorSeat: number`.
- El front incluye `repartir`, `barajar` y `calcResultado`, que **solo tienen
  sentido en el servidor** (repartir y puntuar es autoritativo). El cliente solo
  necesita `puedeJugar`, `getExtremos`, `esCapicua` y los tipos, para validación
  visual.

**Propuesta:**
1. Crear un módulo compartido con la **verdad única** de tipos y reglas puras
   (`Val`, `Pieza`, `FichaTablero`, `Extremos`, `puedeJugar`, `getExtremos`,
   `colocarFicha`, `esCapicua`, `sumaPips`, `ResultadoMano`).
2. Opciones de empaquetado, de menor a mayor ceremonia:
   - Carpeta `shared/` importada por tsconfig paths (simple, sin publicar).
   - Workspace npm con paquete `@2mino/domino` (más limpio si crece).
3. El front deja de tener `repartir`/`barajar`/`calcResultado`.

**Riesgo de no hacerlo:** un cambio de regla obliga a editar dos archivos; si se
edita solo uno, el bug es silencioso (el cliente valida distinto de lo que el
servidor acepta).

---

### P2 — Auth y config del gateway repetidas · esfuerzo S · riesgo de seguridad

**Qué:** en `api-integracion` el patrón de autenticación está copiado a mano.

**Evidencia:**
- `JWT_SECRET` definido **3 veces** (`routes/auth.ts:5`, `routes/frontend.ts:5`,
  `routes/salas.ts:5`) con el mismo default inseguro
  `'dev-secret-change-in-production'`.
- El bloque "verificar `Bearer` → payload → 401 si falta" se repite **~11 veces**
  (todas las rutas de `routes/salas.ts`, más `frontend.ts` y `auth.ts`).

**Riesgo de seguridad:** si en producción no se define `JWT_SECRET`, el servicio
arranca igual con el secreto por defecto, que es público en este repo →
**cualquiera puede falsificar tokens**.

**Propuesta:**
1. Un solo módulo `auth.ts` con el secret y un helper de verificación.
2. Un `preHandler`/decorator de Fastify `app.authenticate` que ponga
   `req.user = { sub, username }` o responda 401; las rutas solo lo listan.
3. **Fail-fast:** el gateway se niega a arrancar si `NODE_ENV=production` y no hay
   `JWT_SECRET` explícito.

---

### P3 — Tests sobre la lógica pura · esfuerzo S · riesgo bajo, alto retorno

**Qué:** no hay ni un test en el proyecto.

**Por qué empezar aquí:** `ms-salas/src/game/logic.ts` es 100 % funciones puras
sin dependencias → trivial de testear y es donde un bug hace más daño. Es la red
de seguridad para P1 (mover la lógica a un módulo compartido) y para P5.

**Propuesta:** Vitest con casos para `aplicarJugada` (turno equivocado, ficha que
no encaja, elección de lado, cierre de mano), `aplicarPase` (no puedes pasar con
ficha jugable, tranca al completar la ronda de pases) y `calcResultado`
(normal / capicúa / tranca).

---

### P4 — Frontend sin router; estado solo en memoria · esfuerzo M · corrige bug real

**Qué:** `App.tsx` es una cadena de `if (view === …)` y la navegación
(`view`, `gameSala`) vive en `useState`.

**Evidencia / consecuencia:** al recargar la página se pierde todo el estado de
navegación. **Esta es la causa raíz de no poder volver a entrar a una partida en
curso** (además de que `SalasView` solo deja entrar a salas en estado
`esperando`).

**Propuesta:**
1. Introducir react-router (o, mínimo viable, reflejar `view` + `salaId` en la URL
   y rehidratar al cargar).
2. Ruta `/sala/:id/juego` que, si la partida sigue `en_juego`, entre directo al
   tablero. Elimina el parche de "no recargar".

---

### P5 — SnakeBoard: layout imperativo con casos entrelazados · esfuerzo M · dolor vivo

**Qué:** `computeLayout` en `src/components/game/SnakeBoard.tsx` es un bucle que
decide a la vez escala, orientación (doble vs normal), cuándo girar, X, Y y el
flip de valores en filas impares. Cada regla nueva es un `if` que interactúa con
los demás.

**Evidencia:** la regla "los dobles van atravesados" chocó con "el giro son dos
verticales", y se resolvió con un lookahead a `tablero[i+1]`
(`dobleJuntoAlGiro`). Ese enfoque seguirá rompiéndose (dos dobles juntos cerca de
un giro, doble como segunda ficha de la vuelta, etc.).

**Propuesta — pipeline en dos fases con una costura testeable:**
1. `planChain(tablero) → PlannedTile[]`, cada una con
   `{ ficha, atravesada, giraDespués }`. **Lógica de cadena pura**, sin píxeles;
   el lookahead es indexar un array. La regla "no dos verticales seguidas" se
   vuelve un invariante de una línea aquí.
2. `layout(plan, escala) → PlacedPiece[]`, un cursor con rumbo (tortuga) que
   emite `x/y/w/h`. **Geometría pura**, sin conocimiento de dominó.
3. Tests sobre `planChain` (fase 1) independientes del render.

**Nota de producto pendiente:** falta fijar la especificación visual exacta
(fidelidad completa con dobles atravesados y vueltas en U de dos fichas, vs. un
modelo simplificado). Decidir eso **antes** de reescribir; determina cuánta
geometría hay en la fase 2.

---

### P6 — Componentes grandes con responsabilidades mezcladas · esfuerzo M · riesgo bajo

**Qué:**
- `SalasView.tsx` (481 líneas) junta lista + `SalaCard` + `WaitingRoom` +
  formulario de crear + todo el fetching y el polling.
- `GameBoard.tsx` (416) mezcla polling, drag, tap y orquestación del layout.
- Iconos SVG (`BackIcon`, `RefreshIcon`, `CopyIcon`, `DominoTile`, `SunIcon`…)
  **copiados** entre `App.tsx`, `SalasView.tsx` y `GameBoard.tsx`.

**Propuesta:**
1. Extraer hooks de datos: `useSalas()` (lista + polling), `usePartida(salaId)`
   (estado + polling + jugar/pasar). Los componentes quedan de presentación.
2. Carpeta `src/components/icons/` con cada icono una sola vez.
3. Separar `SalasView` en `SalaList`, `SalaCard`, `WaitingRoom`, `CreateSalaForm`.

---

### P7 — Concurrencia en la base de datos · esfuerzo S–M · riesgo bajo pero real

**Qué:** operaciones de lectura-luego-escritura sin transacción ni bloqueo.

**Evidencia:**
- `POST /salas/:id/unirse` (`ms-salas/src/routes/salas.ts`) lee la sala, calcula
  la posición libre y luego inserta. Dos jugadores simultáneos podrían tomar la
  misma posición o superar `max_jugadores`.
- `jugar`/`pasar` (`routes/juegos.ts`) hacen leer-modificar-escribir del JSON
  `partida` sin bloqueo; el polling concurrente agrava la ventana.

**Propuesta:** envolver en transacción con `SELECT … FOR UPDATE` sobre la sala/juego,
y añadir un constraint único `(sala_id, posicion)` en `sala_jugadores` como red.
El riesgo es bajo porque el juego es por turnos, pero es barato de blindar.

---

### P8 — Configuración dispersa e inconsistente · esfuerzo S · relacionado con P2

**Qué:** valores de entorno con defaults repartidos y contradictorios.

**Evidencia:**
- `MS_SALAS_URL` default `http://localhost:6001` (`http.ts:5`) pero
  `docker-compose.yml` usa el puerto **6000**, que además está en la lista de
  "bad ports" de `fetch`/undici → rompe las llamadas. (Ya trackeado aparte.)
- Secreto JWT por defecto (ver P2).

**Propuesta:** un módulo de config por servicio que lea y **valide** el entorno al
arranque (falla rápido si falta algo obligatorio), con los puertos y URLs en un
solo lugar. Elegir un puerto válido y único para ms-salas (p. ej. 6100) y usarlo
de forma consistente en docker-compose, defaults y docs.

---

## Orden sugerido

Por dependencias y retorno:

1. **P3 (tests de la lógica pura)** — red de seguridad, barato.
2. **P1 (lógica de dominó compartida)** — apoyado en P3; mata una clase de bugs
   silenciosos.
3. **P2 + P8 (auth + config del gateway)** — bajo esfuerzo, cierra el hueco de
   seguridad del secreto por defecto.
4. **P5 (SnakeBoard en dos fases)** — una vez decidida la especificación visual;
   resultado visible.
5. **P4 (router + navegación persistida)** — arregla de raíz la re-entrada a
   partidas.
6. **P6 (partir componentes + hooks + iconos)** — mejora continua, sin urgencia.
7. **P7 (concurrencia en DB)** — blindaje; hacer antes de abrir a tráfico real.

## Decisiones abiertas (requieren tu criterio)

- **P1:** ¿carpeta `shared/` con tsconfig paths, o workspace npm con paquete?
- **P5:** especificación visual del snake (fidelidad completa vs. simplificada).
- **P4:** ¿react-router, o solución mínima reflejando estado en la URL?
