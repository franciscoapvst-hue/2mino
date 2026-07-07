# Casos de uso — Amigos, Leaderboard, Historial, Chat

Documento de bajo nivel para implementar: sistema de amigos + bandeja de
entrada + presencia, leaderboard top 100, historial de partidas con
repeticiones, solicitud de amistad post-partida, revancha/invitar compañero,
y chat en partida con emojis.

Convenciones ya establecidas en el proyecto (ver `docs/REFACTOR.md`,
`ms-*/src/db/pool.ts`) que este documento respeta:

- Migraciones con `CREATE TABLE IF NOT EXISTS` + bloque `ALTERS` separado
  (`ADD COLUMN IF NOT EXISTS`) para evolucionar schema sin perder datos.
- Gateway (`api-integracion`) es la única puerta pública; los microservicios
  internos no se exponen directo. Todas las rutas nuevas de cara al frontend
  se agregan ahí, con JWT verificado vía `verifyToken(req.headers.authorization)`.
- IDs de usuario son `UUID`, vienen del JWT (`payload.sub`), nunca se confía
  en un `usuario_id` del body para "quién soy yo".
- Cada microservicio corre sus propias migraciones al arrancar
  (`runMigrations()` en `db/pool.ts`).

---

## 0. Decisión arquitectónica transversal: tiempo real

Hoy **todo el proyecto es polling** (matchmaking, cola, estado de partida —
ver `ms-salas/src/routes/matchmaking.ts` y `MatchmakingView.tsx`). Eso es
aceptable para "¿ya me emparejaron?" cada 2s, pero **no sirve** para:

- Chat en partida (latencia de 2-5s en un chat es inaceptable).
- Presencia online de amigos (poll de outras N conexiones cada pocos segundos
  no escala y da falsos "desconectado").
- Notificaciones de bandeja de entrada (solicitud de amistad, invitación a
  partida) en tiempo real.

**Lineamiento explícito**: introducir **WebSocket** (no Socket.IO — usar
`@fastify/websocket`, ya que todo el backend es Fastify y evita traer un
segundo protocolo/dependencia pesada) para exactamente estos tres flujos:
chat de partida, presencia de amigos, notificaciones de bandeja de entrada.
**Todo lo demás sigue con polling** (no reinventar lo que ya funciona:
matchmaking, estado de sala, estado de partida por jugada).

Justificación de por qué WS y no SSE: se necesita bidireccional (el cliente
envía mensajes de chat), así que WebSocket es la elección natural sobre
Server-Sent Events (que es solo servidor→cliente).

**Escalado (fuera de alcance del MVP, dejar anotado)**: con una sola
instancia de cada microservicio, la presencia y las salas de chat se pueden
mantener en memoria del proceso (`Map<usuario_id, WebSocket>`). El día que
haya más de una instancia corriendo detrás de un load balancer, esto se
rompe (un usuario conectado a la instancia A no ve mensajes de alguien
conectado a la instancia B) y hay que introducir Redis pub/sub como bus de
eventos entre instancias. No implementar esto ahora; solo evitar decisiones
que lo hagan imposible después (ej: no asumir en el código que "todos los
conectados están en este proceso" de forma que sea difícil de cambiar luego).

---

## 1. Nuevo microservicio: `ms-social`

**Decisión: sí, crear un microservicio nuevo.** Alternativas consideradas y
descartadas:

- Meterlo en `ms-usuarios`: `ms-usuarios` es "interno, no expuesto
  directamente" (ver su `swagger` description) y su responsabilidad es
  identidad/auth. Amigos + chat + presencia es un dominio distinto con
  conexiones WS persistentes; mezclarlo complica el ciclo de vida del
  servicio de auth (que debe ser ligero y sin estado de conexión).
- Meterlo en `ms-salas`: `ms-salas` ya concentra salas + juego + ranked +
  matchmaking. Agregar amigos/chat/presencia lo sobrecarga y acopla dominios
  que no tienen por qué compartir deploy (un bug en el chat no debería poder
  tumbar el matchmaking).

`ms-social` posee: `amigos`, `solicitudes_amistad`, `notificaciones`
(bandeja de entrada), `chat_mensajes`, y el estado de presencia en memoria.
Sigue el mismo esqueleto que los demás (`Fastify` + `pg` + swagger + rutas +
`db/pool.ts` con `runMigrations`), puerto sugerido `6200` (siguiente libre
tras `ms-salas` en `6100`).

**Consume**:
- `ms-usuarios` (`GET /usuarios/:id`) para validar que un usuario existe y
  traer su username/avatar al aceptar una solicitud.
- `ms-salas` (`GET /salas/:id`) para saber quién está en una sala al mandar
  una invitación a partida o una solicitud de amistad post-partida.

**Gateway**: nuevas rutas en `api-integracion/src/routes/social.ts` (nuevo
archivo, mismo patrón que `ranked.ts`), registradas en `index.ts`. Variable
de entorno `MS_SOCIAL_URL` (default `http://localhost:6200`), agregada a
`http.ts` como `callSocial()` análogo a `callSalas()`.

---

## 2. Sistema de amigos + bandeja de entrada + presencia

### 2.1 Tablas nuevas (en `ms-social`)

```sql
-- Relación de amistad. Simétrica: una fila cubre ambos sentidos
-- (se consulta con usuario_id_a = $1 OR usuario_id_b = $1).
-- Se normaliza el orden (menor UUID primero) para evitar filas duplicadas
-- A-B / B-A.
CREATE TABLE IF NOT EXISTS amigos (
  usuario_id_a  UUID        NOT NULL,
  usuario_id_b  UUID        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id_a, usuario_id_b),
  CHECK (usuario_id_a < usuario_id_b)
);
CREATE INDEX IF NOT EXISTS idx_amigos_b ON amigos(usuario_id_b);

-- Solicitudes de amistad pendientes/resueltas.
CREATE TABLE IF NOT EXISTS solicitudes_amistad (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  de_usuario_id UUID        NOT NULL,
  a_usuario_id  UUID        NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_at   TIMESTAMPTZ,
  -- Solo una solicitud pendiente por par ordenado de usuarios a la vez.
  UNIQUE (de_usuario_id, a_usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_solicitud_destino ON solicitudes_amistad(a_usuario_id, estado);

-- Bandeja de entrada unificada: solicitudes de amistad, amistad aceptada,
-- invitaciones a partida. Una fila por notificación, tipo la distingue.
CREATE TABLE IF NOT EXISTS notificaciones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID        NOT NULL,          -- destinatario
  tipo         VARCHAR(30) NOT NULL
               CHECK (tipo IN ('solicitud_amistad','amistad_aceptada','invitacion_partida')),
  de_usuario_id UUID       NOT NULL,          -- quien origina
  de_username  VARCHAR(20) NOT NULL,          -- desnormalizado, evita join a ms-usuarios en el listado
  payload      JSONB       NOT NULL DEFAULT '{}', -- ej: { solicitud_id, sala_id, codigo }
  leida        BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(usuario_id, leida, created_at DESC);
```

### 2.2 Endpoints nuevos (`ms-social`, expuestos vía gateway)

| Ruta | Método | Descripción |
|---|---|---|
| `/amigos` | GET | Lista de amigos del usuario autenticado, con `conectado: boolean` (de presencia en memoria) |
| `/amigos/:usuarioId` | DELETE | Eliminar amistad |
| `/solicitudes` | POST | Enviar solicitud `{ a_usuario_id }`. Si ya son amigos o ya hay pendiente → 409 |
| `/solicitudes/:id/aceptar` | POST | Acepta: inserta en `amigos`, marca solicitud `aceptada`, crea notificación `amistad_aceptada` para el que la envió |
| `/solicitudes/:id/rechazar` | POST | Marca `rechazada` |
| `/notificaciones` | GET | Bandeja de entrada, paginada, más recientes primero |
| `/notificaciones/:id/leer` | POST | Marca leída |
| `/notificaciones/no-leidas/count` | GET | Badge del ícono de campana en el nav |

### 2.3 WebSocket (`ms-social`, `/ws/social`)

Un único endpoint WS por usuario autenticado (JWT en query string al conectar,
ej `wss://.../ws/social?token=...`, verificado igual que en el gateway).
Al conectar:

1. Verificar JWT → `usuario_id`.
2. Registrar en el mapa en memoria `conectados: Map<usuario_id, WebSocket>`.
3. Broadcast a los amigos de ese usuario: evento `{ tipo: 'amigo_conectado', usuario_id }`.
4. Al desconectar (`close`): remover del mapa, broadcast `amigo_desconectado`.

Eventos que el servidor empuja por este socket:

- `amigo_conectado` / `amigo_desconectado`
- `notificacion_nueva` (cuando llega una solicitud, se acepta una amistad, o
  llega invitación a partida — el POST correspondiente, además de insertar en
  `notificaciones`, hace `conectados.get(destinatario)?.send(...)` si está
  online)

**Lineamiento explícito**: el WS es solo para *push* de eventos ya calculados
server-side. El cliente **nunca** debe mutar estado directo por WS (mandar
"acéptame como amigo" por el socket); esas acciones siguen siendo POST HTTP
normales por el gateway, y el WS solo notifica que pasó algo. Esto mantiene
un único punto de verdad/autorización (el endpoint HTTP) y el WS simple.

### 2.4 Frontend

- Nuevo `src/hooks/useSocialSocket.ts`: abre el WS una vez en el layout
  autenticado (ej. en `App.tsx` al montar sesión), expone estado de amigos
  conectados y cuenta de no leídas vía contexto React simple (no hace falta
  Redux/Zustand para esto).
- Nuevo componente `FriendsPanel.tsx` (lista de amigos + botón agregar +
  estado conectado con punto verde) y `InboxPanel.tsx` (bandeja: solicitudes,
  aceptaciones, invitaciones a partida, cada una con acción inline
  aceptar/rechazar/unirse).
- Ícono de campana en `Dashboard.tsx` nav (mismo lugar que hoy está el
  botón "Fichas"), con badge de `notificaciones/no-leidas/count` (polling
  cada 30s como fallback + actualización inmediata por WS cuando llega
  `notificacion_nueva` — el WS es la vía rápida, el poll es red de seguridad
  si el socket se cayó).

---

## 3. Invitar amigo a partida directamente

Reusa `notificaciones` (tipo `invitacion_partida`) y el mecanismo de invite-
por-código que **ya existe** para las parties de ranked
(`ranked_parties` / `POST /ranked/party` / link `/party/:codigo`, ver
`MatchmakingView.tsx` y `App.tsx::leerCodigoPartyDeUrl`). No se reinventa el
mecanismo de invitación por código; se le agrega un canal de entrega directo.

**Flujo bajo nivel**:

1. Usuario A está en una sala (o crea una party ranked) → `salas.codigo` o
   `ranked_parties.codigo` ya existe (endpoints existentes de `ms-salas`).
2. A hace clic en "Invitar a [amigo]" en `FriendsPanel` → gateway
   `POST /social/invitar-partida { a_usuario_id, sala_codigo }` (nuevo,
   `ms-social`).
3. `ms-social` valida que A y el destinatario son amigos (consulta propia
   tabla `amigos`), y opcionalmente llama a `ms-salas` (`GET /salas/codigo/:codigo`)
   solo para confirmar que la sala sigue `esperando` antes de notificar (evita
   invitar a una sala que ya cerró).
4. Inserta en `notificaciones` con `payload: { sala_codigo }`. Si el
   destinatario está conectado, push inmediato por WS.
5. El destinatario ve la invitación en `InboxPanel`, botón "Unirse" navega
   a `/party/:codigo` o llama directo `api.salas.porCodigo` + `unirse`
   (endpoints **existentes**, no hay que crear nada del lado de `ms-salas`).

**Tabla nueva**: ninguna adicional a las de la sección 2 (`notificaciones`
ya cubre esto vía `tipo='invitacion_partida'`).

---

## 4. Leaderboard top 100 + perfil de jugador

### 4.1 Lo que ya existe (reusar, no duplicar)

`ms-salas` ya tiene:
- `ranked_ratings` (elo, partidas, ganadas por usuario)
- `ranked_historial` (una fila por jugador por partida ranked: elo antes/después, delta, gano)
- `GET /ranked/leaderboard?limit=` (`ms-salas/src/routes/ranked.ts:95`, ya
  expuesto en el gateway en `api-integracion/src/routes/ranked.ts:30`)
- `GET /ranked/:usuarioId` para elo + historial reciente de un usuario

**Lineamiento explícito**: el leaderboard top 100 es el mismo endpoint
existente con `?limit=100`. No crear un microservicio ni tabla nueva para
esto — solo hay que **ampliar los datos que ya trae** (capicúas, tranques —
ver sección 5, esos contadores viven en la tabla nueva `partida_resultados`
de `ms-salas`) y construir la UI.

### 4.2 Qué falta

- `ranked_historial` no tiene columnas de capicúas/tranques — esos se
  calculan de la tabla nueva `partida_resultados` (sección 5.1), que vive
  en el mismo microservicio (`ms-salas`) y cubre TODAS las partidas
  (casual+ranked), no solo ranked. El leaderboard hace `JOIN` entre
  `ranked_ratings` y un agregado de `partida_resultados` filtrado a
  `tipo_sala = 'ranked'`.

- Endpoint nuevo `GET /ranked/leaderboard/:usuarioId/perfil` (`ms-salas`,
  expuesto vía gateway) que agrega:
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE capicua)               AS total_capicuas,
    COUNT(*) FILTER (WHERE tranque_ganado)         AS total_tranques_ganados,
    COUNT(*) FILTER (WHERE tranque_perdido)        AS total_tranques_perdidos,
    COUNT(*)                                       AS total_partidas_jugadas
  FROM partida_resultados
  WHERE usuario_id = $1
  ```
  combinado con `ranked_ratings` (elo actual) y `ranked_historial` (progresión
  de elo, para un gráfico de línea si se quiere).

- **Lineamiento explícito de paginación**: top 100 no necesita paginación
  cursor-based (es un límite fijo, la query ya tiene `ORDER BY elo DESC LIMIT
  100`, con índice existente `idx_ranked_ratings_elo`). No sobre-diseñar esto.

### 4.3 Frontend

- Nueva vista `LeaderboardView.tsx`, tabla con posición/username/avatar
  (`avatarUrl` ya existe)/rango (`rangoDeElo` ya existe)/elo/partidas/%
  victorias. Fila clickeable → abre `PlayerProfileModal.tsx` con el detalle
  de la sección 4.2 y un link a "ver historial de partidas" (sección 5) si
  es el propio usuario o si `perfil_publico` (ya existe como feature flag
  en `segmento_config`, ver `ms-usuarios/src/db/pool.ts:24`) está activo
  para ese jugador.

---

## 5. Historial de partidas propio + repeticiones (replay)

### 5.1 Problema real a resolver primero

Hoy `juegos.partida` es **un solo TEXT que se sobreescribe** en cada jugada
(`ms-salas/src/routes/juegos.ts`, comentario explícito en
`ms-salas/src/db/pool.ts:49-52`: "se sobreescribe en cada movimiento"). Esto
es correcto para servir el estado actual rápido, pero significa que **hoy no
existe ningún registro histórico de las jugadas** — al terminar la partida
solo queda el último estado (fase `fin_partida`), no cómo se llegó ahí. Sin
esto no hay replay posible.

**Se necesitan dos tablas nuevas en `ms-salas`**:

```sql
-- Log de movimientos, append-only. Una fila por jugada/pase/tranca.
-- Esto es lo que permite reconstruir la partida completa para el replay.
CREATE TABLE IF NOT EXISTS partida_movimientos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id       UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
  numero_mano   INT         NOT NULL,
  orden         INT         NOT NULL,        -- secuencia dentro de la mano, empieza en 0
  seat          INT         NOT NULL,
  tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('jugar','pasar')),
  pieza_a       INT,                          -- null si tipo='pasar'
  pieza_b       INT,
  lado          VARCHAR(6)  CHECK (lado IN ('izq','der') OR lado IS NULL),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sala_id, numero_mano, orden)
);
CREATE INDEX IF NOT EXISTS idx_partida_mov_sala ON partida_movimientos(sala_id, numero_mano, orden);

-- Resultado agregado por jugador por partida (para historial propio,
-- leaderboard de capicúas/tranques, y estadísticas de perfil).
-- Se inserta UNA vez, cuando la partida llega a fase 'fin_partida'
-- (mismo punto donde hoy se llama aplicarEloRanked en juegos.ts).
CREATE TABLE IF NOT EXISTS partida_resultados (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id            UUID        NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
  usuario_id         UUID        NOT NULL,
  equipo             INT         NOT NULL CHECK (equipo IN (0, 1)),
  gano               BOOLEAN     NOT NULL,
  tipo_sala          VARCHAR(20) NOT NULL CHECK (tipo_sala IN ('casual','ranked')),
  capicua            BOOLEAN     NOT NULL DEFAULT false,   -- ganó al menos una mano por capicúa
  tranques_ganados   INT         NOT NULL DEFAULT 0,
  tranques_perdidos  INT         NOT NULL DEFAULT 0,
  puntos_favor       INT         NOT NULL,
  puntos_contra      INT         NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sala_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_partida_result_usuario ON partida_resultados(usuario_id, created_at DESC);
```

### 5.2 Cambios en `logic.ts` (mínimos, aditivos)

`PartidaState` necesita acumular por partida (no solo la última mano) los
contadores que van a `partida_resultados`. Agregar al tipo:

```ts
// Acumulado durante toda la partida; se resetea solo en crearPartida.
capicuasPorEquipo: [number, number];
trancasPorEquipo:  [number, number]; // trancas ganadas por equipo (empate no suma a nadie)
```

Se incrementan en `aplicarJugada`/`aplicarPase` en el mismo punto donde hoy
se arma `ResultadoMano` (no hay que tocar la lógica de puntaje, solo sumar un
contador al lado). Esto es aditivo y no cambia comportamiento existente —
**bajo riesgo de regresión**, pero hay que correr `logic.test.ts` después.

### 5.3 Persistencia del log de movimientos

**Dónde**: en las rutas existentes `POST /salas/:id/juego/jugar` y
`POST /salas/:id/juego/pasar` (`ms-salas/src/routes/juegos.ts`), justo
después de aplicar la jugada con éxito, un `INSERT` a `partida_movimientos`
con el `numero_mano`/`orden` actuales (que ya están en `PartidaState`).

**Volumen**: una partida a 100 puntos son, en el peor caso, unas pocas
decenas de jugadas por mano × varias manos — nada que preocupe a Postgres.
No hace falta batchear ni mover esto a un job async; el `INSERT` extra por
jugada es despreciable comparado con el `UPDATE` que ya se hace a `juegos`.

### 5.4 Persistir el resultado al terminar

En `guardarPartida` (`juegos.ts`), donde ya se detecta `fase === 'fin_partida'`
y se llama `aplicarEloRanked` en un try/catch (no tumba la jugada si falla):
agregar, en el mismo punto, un `INSERT ... ON CONFLICT DO NOTHING` a
`partida_resultados` por cada asiento de `partida.asientos`, usando
`partida.capicuasPorEquipo`/`trancasPorEquipo`/`marcador` ya en el estado.
El `UNIQUE(sala_id, usuario_id)` + `ON CONFLICT DO NOTHING` lo hace
idempotente igual que `ranked_historial` (mismo patrón ya usado en el
proyecto).

### 5.5 Endpoints nuevos (`ms-salas`, vía gateway)

| Ruta | Método | Descripción |
|---|---|---|
| `/salas/mis-partidas` | GET | Historial propio: `JOIN partida_resultados` por `usuario_id` del JWT, paginado (`?cursor=&limit=20`, cursor = `created_at` de la última fila vista — evitar `OFFSET` para no degradar con miles de filas) |
| `/salas/:id/replay` | GET | Devuelve `partida_movimientos` ordenados + `sala_jugadores` (asientos) + resultado final, todo lo necesario para reconstruir la partida en el cliente |

### 5.6 Frontend — reproductor de repeticiones

**Lineamiento explícito**: el replay **no** debe ser un video ni requerir
guardar frames — se reconstruye reproduciendo el log de movimientos contra
la **misma lógica pura ya existente** en `src/game/local-rules.ts` (el motor
de predicción visual del cliente), aplicando cada movimiento del log en
orden con un control de play/pause/velocidad. Esto reusa código en vez de
duplicar la lógica del tablero.

- Nuevo componente `ReplayViewer.tsx`: recibe el array de movimientos de
  `/salas/:id/replay`, mantiene un índice de "movimiento actual", y en cada
  paso llama a la misma función de aplicar-jugada de `local-rules.ts` sobre
  un estado de tablero local (no toca el backend, es 100% cliente).
  Controles: ⏮ ⏸ ▶ ⏭, slider de progreso, velocidad 1x/2x/4x.
- Nueva vista `MatchHistoryView.tsx`: lista de `mis-partidas` (fecha, rival,
  resultado, si hubo capicúa/tranque, delta de ELO si fue ranked), cada fila
  abre `ReplayViewer`.
- Acceso: desde `Dashboard.tsx`, nuevo `PlayCard` o entrada de nav "Historial".

---

## 6. Solicitud de amistad a integrantes de una partida

No requiere tabla nueva (reusa `solicitudes_amistad` de la sección 2).

**Flujo bajo nivel**:

1. Durante o al terminar una partida, `GameBoard.tsx` ya tiene
   `partida.asientos` (usuario_id + username de cada jugador, viene del
   estado existente `PartidaPublica.asientos`).
   Nada nuevo que consultar: el dato ya está en memoria del componente.
2. En `FinPartidaOverlay` (`GameBoard.tsx:542`), agregar por cada rival
   (excluir al propio usuario) un botón "Agregar como amigo" si aún no son
   amigos y no hay solicitud pendiente.
   - Para saber "¿ya somos amigos / ya hay solicitud pendiente?" sin flood de
     requests: el gateway responde esto en el mismo payload que ya se pide al
     entrar al overlay — **no** un endpoint por-jugador. Alternativa: al cargar
     `FinPartidaOverlay`, un solo `POST /social/estado-relacion { usuario_ids: [...] }`
     (nuevo, `ms-social`) que devuelve `{ [usuario_id]: 'amigo' | 'pendiente' | 'ninguno' }`
     para todos los asientos de una sola vez.
3. Clic en "Agregar" → `POST /social/solicitudes { a_usuario_id }` (ya
   definido en 2.2).

---

## 7. Revancha / invitar compañero a la próxima partida

Dos casos distintos, mismo mecanismo subyacente (crear una sala/party nueva
con jugadores pre-seleccionados), **ambos ya cubiertos por endpoints
existentes de `ms-salas`** — esto es orquestación de frontend + notificación,
no lógica de juego nueva.

### 7.1 "Revancha" (mismos 2 o 4 jugadores, otra partida ya)

1. En `FinPartidaOverlay`, botón "Jugar de nuevo" (solo visible si la
   partida no fue abandono).
2. El creador original hace clic → gateway nuevo
   `POST /salas/:id/revancha` (`ms-salas`, nuevo, pero internamente **solo
   llama a la lógica ya existente de `crearSala`** de `salas.ts` con los
   mismos `usuario_id` de `sala_jugadores` de la sala vieja, mismo `tipo`/`modo`/`max_jugadores`).
3. Se crea la sala nueva en estado `esperando`. Para cada jugador ≠ creador,
   `ms-social` inserta una `notificacion` tipo `invitacion_partida` (mismo
   mecanismo de la sección 3) con el código de la sala nueva.
4. Los demás ven la invitación en su bandeja y se unen con el flujo existente.

**Por qué no auto-unir a todos de una**: un jugador pudo cerrar la pestaña o
ya no querer seguir; forzarlo a una sala nueva sin confirmación es mal UX.
Se invita, no se arrastra.

### 7.2 "Invitar a mi compañero a la próxima" (specific a 2v2 ranked, mismo partner)

Esto es casi textualmente el flujo de **party ranked que ya existe**
(`POST /ranked/party` + `POST /ranked/party/:codigo/unirse`,
`MatchmakingView.tsx`). Al terminar una partida ranked 2v2, en vez de crear
una sala directa (7.1), se crea una **party** con el mismo compañero de
equipo (`equipoDe(seat)` de la sección de lógica ya identifica quién es del
mismo equipo) usando el endpoint de party existente, y se le manda la
notificación de invitación con el código de party en vez de código de sala.

**Lineamiento explícito**: no crear un tipo de invitación nuevo para esto —
`notificaciones.payload` simplemente distingue `{ sala_codigo }` vs
`{ party_codigo }`, y el frontend en `InboxPanel` decide a qué endpoint de
unirse llamar según cuál campo venga poblado.

---

## 8. Chat en partida con emojis

### 8.1 Tabla nueva (en `ms-social`, no en `ms-salas`)

```sql
-- Mensajes de chat por sala. Vive en ms-social (dominio de comunicación),
-- no en ms-salas (dominio de juego) — mismo principio de separación de
-- responsabilidades del resto del documento.
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id     UUID        NOT NULL,   -- referencia lógica a salas de ms-salas;
                                       -- SIN FK física (son microservicios distintos,
                                       -- no comparten base de datos)
  usuario_id  UUID        NOT NULL,
  username    VARCHAR(20) NOT NULL,   -- desnormalizado, evita join cross-servicio para pintar el chat
  mensaje     VARCHAR(280) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sala ON chat_mensajes(sala_id, created_at);
```

**Nota importante de arquitectura**: `sala_id` es una referencia *lógica* a
la tabla `salas` de `ms-salas`, no una foreign key real — cada microservicio
tiene su propia base de datos (patrón ya establecido: `ms-usuarios`,
`ms-salas` y `ms-frontend-landing` corren cada uno su propio Postgres/schema,
ver los distintos `DB_URL` en `docker-compose.yml`). La validez de
`sala_id` se verifica llamando a `ms-salas` (`GET /salas/:id`), no con una
constraint de base de datos.

**Retención**: sin límite estricto para el MVP (volumen bajo). Si se vuelve
un problema, un job de limpieza que borre `chat_mensajes` de salas
`finalizada`/`cancelada` con más de N días — **no implementar ahora**, dejar
anotado como mejora futura.

### 8.2 WebSocket de sala (`ms-social`, `/ws/chat/:salaId`)

Distinto del socket de la sección 2 (ese es por-usuario/global; este es
por-sala). Al conectar:

1. Verificar JWT → `usuario_id`.
2. Verificar que el usuario pertenece a esa sala: `GET /salas/:id` en
   `ms-salas` y chequear que `usuario_id` está en `jugadores` — **no confiar
   en que el cliente solo abre el socket de salas donde está**, validar
   server-side siempre.
3. Registrar el socket en un mapa `salasConectadas: Map<sala_id, Set<WebSocket>>`.
4. Al recibir un mensaje del cliente `{ mensaje: string }`:
   - Validar longitud (≤280 chars) y que no esté vacío tras trim.
   - Insertar en `chat_mensajes`.
   - Broadcast a todos los sockets de `salasConectadas.get(sala_id)`
     (incluido el emisor, para confirmar el envío con el mismo timestamp
     que quedó en base — evita divergencia entre "lo que yo creo que mandé"
     y "lo que se guardó").
5. Al desconectar: remover del set (no hay lógica de "usuario salió del
   chat" más allá de esto — el chat no tiene presencia propia, reusa la
   presencia global de la sección 2 si se quiere mostrar "escribiendo").

### 8.3 Emojis

**Lineamiento explícito**: nada de subir imágenes ni un picker propio de
emoji custom — usar emoji Unicode nativos (`😀🎉🁣` etc, ya el proyecto usa
emoji Unicode en toda la UI, ej. `🁣 Fichas` en `Dashboard.tsx`, `⚠` en los
formularios). Un picker de emoji **de librería ligera** en frontend
(ej. `emoji-picker-react`, ~30KB) que inserta el carácter Unicode directo en
el `<input>` de texto — el backend nunca necesita saber "esto es un emoji",
simplemente viaja como parte del `VARCHAR(280)` del mensaje.

### 8.4 Endpoint REST complementario

| Ruta | Método | Descripción |
|---|---|---|
| `/social/chat/:salaId` | GET | Historial de mensajes al entrar a la sala (antes de que el WS empiece a emitir nuevos) — paginado hacia atrás por `created_at` |

### 8.5 Frontend

- Nuevo `src/hooks/useSalaChat.ts`: abre el WS de chat al entrar a
  `GameBoard.tsx` (o a la sala de espera pre-partida, `SalasView.tsx`), carga
  historial inicial vía REST, escucha nuevos mensajes por WS.
- Nuevo componente `ChatPanel.tsx`: lista de mensajes + input + botón emoji,
  panel lateral o flotante en `GameBoard.tsx` (colapsable en móvil, dado que
  el tablero ya usa bastante espacio — ver `useMeasuredWidth` existente en
  `GameBoard.tsx` para el patrón de responsive ya usado ahí).

---

## 9. Resumen de impacto por microservicio

| Microservicio | Tablas nuevas | Tablas modificadas | Endpoints nuevos | Notas |
|---|---|---|---|---|
| **`ms-social`** (nuevo) | `amigos`, `solicitudes_amistad`, `notificaciones`, `chat_mensajes` | — | Amigos, solicitudes, notificaciones, invitar-partida, estado-relación, chat REST + 2 WS (`/ws/social`, `/ws/chat/:salaId`) | Puerto sugerido `6200`. Sin FK física hacia `ms-salas`/`ms-usuarios`; valida por HTTP |
| **`ms-salas`** | `partida_movimientos`, `partida_resultados` | `PartidaState` en `logic.ts` (aditivo: `capicuasPorEquipo`, `trancasPorEquipo`) | `/salas/mis-partidas`, `/salas/:id/replay`, `/salas/:id/revancha`, `/ranked/leaderboard/:usuarioId/perfil` | El log de movimientos se inserta en las rutas `jugar`/`pasar` ya existentes |
| **`ms-usuarios`** | — | — | — | Solo se consume (`GET /usuarios/:id`), sin cambios |
| **`api-integracion`** | — | — | Nuevo `routes/social.ts` (proxy) + rutas nuevas agregadas a `routes/ranked.ts` y `routes/salas.ts` existentes | Nueva env var `MS_SOCIAL_URL`, nuevo `callSocial()` en `http.ts` |
| **frontend** | — | — | `FriendsPanel`, `InboxPanel`, `LeaderboardView`, `PlayerProfileModal`, `MatchHistoryView`, `ReplayViewer`, `ChatPanel` + hooks `useSocialSocket`, `useSalaChat` | Reusa `avatarUrl`/`rangoDeElo`/`local-rules.ts` existentes, no duplica lógica |

---

## 10. Orden de implementación sugerido

Cada bloque es entregable y probable de testear de forma aislada, siguiendo
el patrón ya usado en el proyecto (feature por feature, con tests unitarios
de lógica pura + verificación e2e manual antes de mergear):

1. **`partida_movimientos` + `partida_resultados`** (sección 5) primero,
   porque el leaderboard extendido (4) y el historial (5) dependen de que
   estos datos existan desde ya — cuanto antes se capture, antes hay datos
   reales para probar el resto.
2. **`ms-social` base**: tablas + amigos + solicitudes + endpoint
   estado-relación (secciones 2, 6) — sin WS todavía, solo REST + polling
   simple como primer corte funcional.
3. **WebSocket de presencia + notificaciones** (sección 2.3) sobre lo
   anterior.
4. **Invitar a partida + revancha + invitar compañero** (secciones 3, 7) —
   depende de 2 y 5 ya existiendo.
5. **Leaderboard extendido + perfil de jugador** (sección 4).
6. **Historial + replay viewer** (sección 5.5/5.6).
7. **Chat de partida** (sección 8) al final: es el más aislado (su propio WS,
   su propia tabla), no bloquea ni es bloqueado por nada de lo anterior.
