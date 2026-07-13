# Arquitectura

## Visión general

2mino sigue un patrón de **microservicios** con un **API Gateway** (`api-integracion`) como único punto de entrada público. La lógica de negocio se reparte por dominio; PostgreSQL es la fuente de verdad persistente.

→ Ver [diagrama de integración (Mermaid)](DIAGRAMAS.md#integración-de-servicios)

## Servicios

### api-integracion (puerto 3000)

- Expone la API REST al frontend.
- Valida y emite **JWT** (7 días de validez).
- Aplica **CORS** según `CORS_ORIGIN`.
- Reenvía peticiones a los microservicios internos.
- Documentación OpenAPI en `/docs`.

**Rutas principales:**

| Prefijo | Destino | Descripción |
|---------|---------|-------------|
| `/auth/*` | ms-usuarios | Registro, login, forgot-password, `/auth/me` |
| `/frontend/*` | ms-frontend-landing | Preferencias de UI del usuario, feature flags públicas |
| `/salas/*` | ms-salas | CRUD de salas y jugadores, `/salas/activa` (para reintegrarse) |
| `/salas/:id/juego/*` | ms-salas | Iniciar partida, jugar, pasar, listo, abandonar |
| `/ranked/*` | ms-salas | Matchmaking, ELO, leaderboard, parties |
| `/social/*` | ms-social | Amigos, notificaciones, chat |
| `/admin/*` | varios | Back Office — requiere JWT con segmento admin |

`callService` (en `http.ts`) tiene timeout de 10s con `AbortController`
en cada llamada a un microservicio interno — sin esto, uno colgado
colgaba la request del gateway indefinidamente con él. Rate limiting
(`@fastify/rate-limit`) global (300 req/min por IP) y más estricto
(10 req/min) en los endpoints de `/auth/*`.

### ms-usuarios (puerto 4000, interno)

Gestiona identidad y credenciales.

**Tablas:**

- `segmentos` — Agrupa configuración por tipo de usuario (ej. `tester` con todas las features).
- `usuarios` — Cuentas con `password_hash` (bcrypt), `email_verificado` (bool).
- `reset_tokens` — Tokens de recuperación de contraseña.
- `email_verificacion_tokens` — Tokens de confirmación de cuenta (mismo patrón que `reset_tokens`, 24hs de validez).

Las migraciones se ejecutan al arrancar el servicio (`runMigrations()`).

**Confirmación de cuenta por email** (2026-07): el registro
(`POST /usuarios`) ya no loguea directo — crea la cuenta con
`email_verificado=false`, genera un token y manda un email con
`enviarEmailVerificacion()` (`ms-usuarios/src/email.ts`, API HTTP de
Resend). `POST /usuarios/verificar` (login) rechaza con `403` y
`code: 'EMAIL_NO_VERIFICADO'` si la cuenta no está confirmada. El link del
email (`/verificar-email/:token` en el frontend) llama a
`POST /auth/verificar-email` en el gateway, que firma sesión directo si el
token es válido — clickear el link ya loguea, sin pedir contraseña de
nuevo. Cuentas que ya existían antes de este cambio quedaron
`email_verificado=true` por default (nunca recibieron el mail, exigírselas
las hubiera dejado afuera).

Se probó primero con SMTP directo contra IONOS (nodemailer) y se
descartó: más superficie de fallo (puerto/TLS/STARTTLS/auth) para
depurar sin visibilidad real de qué pasa del otro lado. Resend es un
POST HTTP con la API key en el header, sin protocolo de por medio.

Variables de entorno nuevas (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`)
— con `ENABLE_EMAIL=false` (default) no se manda nada real, solo se
loguea (dev local sin API key real). `EMAIL_FROM` con un dominio propio
(en vez de `onboarding@resend.dev`) requiere verificar ese dominio en
Resend (Domains → agregar registros DNS).

### ms-frontend-landing (puerto 5000, interno)

Configuración del landing y overrides de preferencias por usuario.

**Tablas:**

- `landing_config` — Clave-valor global (registro habilitado, modos visibles, tema default…).
- `frontend_overrides` — Cambios del usuario respecto a su segmento (tema, idioma, opciones).

La respuesta de `/frontend/preferencias` fusiona segmento + overrides + landing.

### ms-social (puerto 6200, interno)

Amigos, notificaciones, chat de partida — todo lo "en vivo" vía WebSocket.

**Tablas:** `amigos`, `solicitudes_amistad`, `notificaciones`, `chat_mensajes`.

**WebSockets** (`routes/ws.ts`):
- `/ws/social` — un socket por usuario autenticado, empuja presencia y
  notificaciones ya calculadas server-side.
- `/ws/chat/:salaId` — por-sala, no por-usuario; valida membresía contra
  `ms-salas` (`usuarioEnSala`, HTTP) antes de aceptar mensajes.

Presencia/sockets viven en memoria del proceso (`presencia.ts`) — **no
sobrevive a más de una réplica** sin agregar un pub/sub (Redis u otro):
un aviso para un usuario conectado a otra instancia nunca llegaría. Ver
`docs/ESCALABILIDAD.md` (local, no versionado) para el detalle.

### ms-salas (puerto 6001)

Salas multijugador y partidas de dominó.

**Tablas:**

- `salas` — Metadatos: código, estado, tipo, modo, max jugadores.
- `sala_jugadores` — Quién está en cada sala, posición, equipo, listo.
- `juegos` — Estado serializado de la partida en curso (JSON en columna `partida`).

**Estados de sala:** `esperando` → `en_juego` → `finalizada` | `cancelada`

**Modos:** `clasico`, `rapido`, `torneo`  
**Tipos:** `casual`, `ranked`

## Lógica de juego

La partida es **autoritativa en el servidor** (`ms-salas/src/game/logic.ts`). El frontend tiene un espejo en `src/game/types.ts` solo para validación visual (qué fichas se pueden jugar, extremos del tablero).

### Reglas implementadas

- Set estándar 0–6 (28 fichas), 7 por jugador con 4 jugadores.
- Colocación en extremos izquierdo/derecho del tablero.
- Partida a puntos (`puntosObjetivo`, configurable desde el BO vía
  `reglas_juego`), varias manos hasta que un equipo llega al objetivo.
- **Capicúa**: bono fijo (`puntosCapicua`, default 30). Si ese bono
  llevaría el marcador por encima del objetivo, no se aplica — se
  sustituye por los pips reales del rival (como un cierre normal), que sí
  pueden terminar la partida aunque también se pasen.
- **Tranca** (nadie puede jugar): gana el equipo con menos pips en mano y
  suma **todos** los pips que quedan sobre la mesa (de ambos equipos, no
  solo el rival). A diferencia del bono de capicúa, los pips de una
  tranca siempre se aplican en su totalidad, incluso si superan el
  objetivo — no hay "no caben" para pips reales, solo para bonos fijos.
- **"Pasó a todos"**: bono fijo (+30) cuando todos los rivales pasaron y
  vuelve a jugar quien puso la última ficha. Si llevaría el marcador por
  encima del objetivo, no se aplica nada (no hay pips equivalentes acá,
  la mano sigue jugándose).
- Turnos, pasadas consecutivas, conteo de manos por asiento, tiempo
  límite por jugada opcional (`limiteJugadaMs`, resuelto el servidor solo
  con el bot/timeout si se vence).

### Endpoints de juego

| Método | Ruta | Acción |
|--------|------|--------|
| POST | `/salas/:id/juego/iniciar` | Reparte y abre partida |
| GET | `/salas/:id/juego` | Estado público (sin manos ajenas; revela todas al cerrar mano) |
| POST | `/salas/:id/juego/jugar` | Jugar ficha `{ pieza, lado? }` |
| POST | `/salas/:id/juego/pasar` | Pasar turno |
| POST | `/salas/:id/juego/listo` | Confirmar listo para la siguiente mano |
| POST | `/salas/:id/juego/abandonar` | Abandonar (derrota; aplica ELO en ranked) |
| GET | `/salas/activa` | Sala `en_juego` del usuario, si tiene una (reintegrarse tras desconexión) |

El frontend consulta el estado por polling desde `GameBoard`
(`src/hooks/usePoll.ts`) — con back-pressure: la siguiente consulta se
programa recién cuando la anterior resolvió o falló, nunca en paralelo,
para no apilar requests si el backend está lento. El mismo hook cubre
los demás polls de la app (matchmaking, sala de espera, notificaciones).

## Seguridad

- Los microservicios **no publican puertos** en Docker Compose (solo `api-integracion` y `postgres` para debug).
- JWT en header `Authorization: Bearer <token>`.
- Contraseñas hasheadas con bcrypt en `ms-usuarios`.
- Salas privadas soportan `contrasena_hash` (campo preparado en esquema).

## Base de datos

Una sola instancia PostgreSQL (`2mino`) compartida por todos los servicios. Cada microservicio define y ejecuta sus propias migraciones al inicio; no hay herramienta de migraciones externa (Flyway/Liquibase).

`max_connections=200` (subido del default de 100). Cada uno de los 4
servicios con acceso a la base (`ms-usuarios`, `ms-salas`, `ms-social`,
`ms-frontend-landing`) fija `max: 15` en su pool de `pg` — antes usaban
el default de 10 sin declararlo.

## Despliegue

`docker-compose.yml` define el stack completo para VPS (referencia en Swagger: `https://api.2mino.com`). El frontend se sirve por separado (build estático de Vite) y apunta a la API pública.

- **Healthchecks** en los 6 contenedores de aplicación (antes solo
  Postgres los tenía), vía su `/health`. `api-integracion`, `frontend` y
  `caddy` esperan `service_healthy` de su dependencia antes de arrancar.
- **Compresión** en Caddy (`encode zstd gzip`) — cubre tanto los assets
  estáticos como las respuestas del gateway vía `/api/` desde un solo
  lugar (~69% menos peso en el bundle principal).
- Ver `docs/ESCALABILIDAD.md` (local, no versionado) para el resto del
  roadmap de infraestructura pendiente (mover CI del VPS, monitoreo,
  WebSocket para el estado de la partida, y qué haría falta para poder
  correr más de una instancia de cada servicio).
