# Plan de implementación de Redis — escalar a múltiples instancias

Complementa `docs/ESCALABILIDAD.md` (auditoría). Aquella responde *qué se
rompe primero*; esta responde *qué hay que hacer con Redis para poder
correr 2+ copias de un microservicio* el día que una sola instancia deje
de alcanzar.

**Cuándo ejecutar esto**: NO hoy. Es el Tier 3 de la auditoría — recién
importa cuando una sola instancia de `ms-social` o `ms-salas` sature CPU
de verdad (medido en Grafana, no supuesto). Los Tier 1 y 2 (pool de
Postgres, timeouts del gateway, rate limiting, sacar CI del VPS) duelen
antes y no necesitan Redis. Este documento existe para que, cuando llegue
el día, el trabajo esté pensado y no haya que improvisar bajo presión.

---

## 1. Qué NO necesita Redis (no sobre-diseñar)

Tres piezas que uno esperaría que fueran el problema, y no lo son —
importante para no meter Redis donde no hace falta:

- **Autenticación**: JWT stateless (`api-integracion/src/jwt.ts`). Cualquier
  réplica valida cualquier token sin coordinación. Ya escala.
- **Matchmaking**: **ya es seguro entre instancias.** Las colas viven en
  Postgres (`ranked_cola`, `ranked_parties`, `ranked_party_miembros`), no
  en memoria, y el emparejamiento se serializa con un **advisory lock de
  Postgres** por `(modo, tipo)` (`matchmaking.ts:138`,
  `pg_advisory_xact_lock`). Dos polls simultáneos —en la misma o en
  distinta réplica— no pueden emparejar el mismo ticket dos veces. El tick
  se dispara por request (el poll del cliente), no por un interval de
  fondo, así que tampoco hay problema de "N réplicas corriendo N ticks".
  *(Corrige la impresión de la auditoría de que el matchmaking era estado
  en memoria — no lo es.)*
- **Estado de la partida**: cada partida es un blob JSON en Postgres
  (`juegos.partida`), no en memoria. Cualquier réplica de `ms-salas` puede
  atender una jugada de cualquier partida.

**Conclusión**: Redis entra por UNA razón principal (fan-out de WebSockets
en `ms-social`) y de paso resuelve dos coordinaciones menores en
`ms-salas`. No es una reescritura.

---

## 2. Los 3 puntos que sí bloquean 2+ réplicas

| # | Pieza | Archivo | Qué pasa con 2 réplicas | Solución |
|---|---|---|---|---|
| A | Sockets de presencia/chat en un `Map` local, sin bus | `ms-social/src/presencia.ts:14,44` | Un aviso para un usuario conectado a la réplica B nunca llega si quien lo dispara está en la A | **Redis pub/sub** (bloqueador real) |
| B | Cache de `reglas_juego` en memoria del proceso | `ms-salas/src/game/reglas.ts:11` | El BO edita una regla → solo la réplica que atendió el PATCH se entera; la otra sigue con config vieja hasta reiniciar | **Redis pub/sub** (canal de invalidación) |
| C | Mutex de bots/turnos vencidos: `Set` en memoria | `ms-salas/src/routes/juegos.ts:189` (`resolucionesEnCurso`) | Dos jugadores en réplicas distintas disparan el mismo movimiento de bot por duplicado | **Lock distribuido** (Redis *o* advisory lock de PG) |

---

## 3. Infraestructura Redis

### 3.1 El contenedor

Una sola instancia de Redis, dentro del mismo `docker-compose.yml`, misma
red interna. **No se expone a internet** (mismo criterio que
`api-integracion`): solo lo alcanzan los microservicios por la red Docker.

```yaml
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save "" --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru
    # Sin persistencia: todo lo que Redis guarda acá es coordinación
    # efímera (locks con TTL, pub/sub, cache invalidable). Si Redis se
    # reinicia, cada servicio recarga reglas de Postgres y los sockets se
    # reconectan — nada que persistir. Por eso --save "" y appendonly no.
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [interna]
```

`REDIS_URL: redis://redis:6379` en el `environment` de `ms-social` y
`ms-salas` (y del gateway si se agrega rate limiting compartido, §6).

**Por qué sin persistencia**: presencia, locks y cache son estado
reconstruible. Un Redis que arranca vacío no pierde nada importante —
`ms-salas` recarga `reglas_juego` de Postgres al bootear, los clientes
reabren sus WebSockets. Simplifica todo (nada de AOF/RDB, backups,
corrupción).

### 3.2 Cliente compartido

Cada servicio tiene su propio `package.json` (no hay lib compartida en el
monorepo), así que se agrega `ioredis` a `ms-social` y `ms-salas` y un
módulo chico `src/redis.ts` en cada uno:

```ts
// ms-social/src/redis.ts  (y equivalente en ms-salas)
import Redis from 'ioredis';

const URL = process.env.REDIS_URL;

// Sin REDIS_URL (dev local sin Redis), exporta null y cada usuario del
// módulo cae a su comportamiento de instancia única. Así el dev local
// sigue andando sin levantar Redis, igual que ENABLE_EMAIL=false.
export const redis = URL ? new Redis(URL, { lazyConnect: false, maxRetriesPerRequest: 3 }) : null;

// Pub/sub necesita una conexión aparte: una vez que un cliente entra en
// modo "subscribe" no puede ejecutar comandos normales (limitación de
// Redis, no de ioredis).
export const redisSub = URL ? new Redis(URL) : null;
```

**Degradación elegante**: si `REDIS_URL` no está seteada, `redis === null`
y cada punto de uso mantiene el comportamiento actual de instancia única.
Redis se vuelve obligatorio solo cuando de verdad se corren 2+ réplicas.

---

## 4. Workstream A — `ms-social` pub/sub (el bloqueador real)

Es el 80% del valor: sin esto, `ms-social` no puede tener más de una copia.

### Idea

Hoy `enviarA(usuarioId, payload)` y `broadcastSala(salaId, payload)`
recorren un `Map` local y escriben en los sockets de ESTE proceso. Con
pub/sub: publican el evento en Redis, **todas** las réplicas lo reciben,
y cada una lo entrega a los sockets que tenga localmente. El `Map` local
no desaparece — sigue siendo el registro de "qué sockets tengo yo"; lo que
cambia es que la *decisión de a quién enviar* pasa a ser global.

### Cambios en `presencia.ts`

```ts
import { redis, redisSub } from './redis';

const CANAL_USUARIO = 'social:usuario';   // { usuarioId, payload }
const CANAL_SALA    = 'social:sala';      // { salaId, payload }

// Entrega SOLO local (lo que hoy hace enviarA/broadcastSala directo)
function entregarLocalUsuario(usuarioId: string, payload: unknown) { /* Map local actual */ }
function entregarLocalSala(salaId: string, payload: unknown)       { /* Map local actual */ }

// API pública: si hay Redis, publica (todas las réplicas entregan a los
// suyos); si no, entrega local directo (instancia única, como hoy).
export function enviarA(usuarioId: string, payload: unknown): void {
  if (redis) redis.publish(CANAL_USUARIO, JSON.stringify({ usuarioId, payload }));
  else entregarLocalUsuario(usuarioId, payload);
}
export function broadcastSala(salaId: string, payload: unknown): void {
  if (redis) redis.publish(CANAL_SALA, JSON.stringify({ salaId, payload }));
  else entregarLocalSala(salaId, payload);
}

// Al arrancar (index.ts), cada réplica se suscribe una vez:
export function iniciarPubSub(): void {
  if (!redisSub) return;
  redisSub.subscribe(CANAL_USUARIO, CANAL_SALA);
  redisSub.on('message', (canal, raw) => {
    const m = JSON.parse(raw);
    if (canal === CANAL_USUARIO) entregarLocalUsuario(m.usuarioId, m.payload);
    else                          entregarLocalSala(m.salaId, m.payload);
  });
}
```

**Nota sutil (auto-entrega)**: con pub/sub, la réplica que publica también
recibe su propio mensaje por la suscripción y entrega a sus locales — así
que `enviarA` NO debe entregar local *además* de publicar (sería doble).
El código de arriba ya lo hace bien: publica O entrega local, nunca ambos.

### `estaConectado(usuarioId)` — presencia global

Hoy es `conectados.has(usuarioId)` (solo mira este proceso). Con réplicas,
un usuario puede estar conectado a otra. Se necesita presencia compartida:

```ts
// Al registrar/quitar conexión, marcar en un set de Redis con TTL:
//   registrar: redis.sadd(`presencia:${usuarioId}`, instanciaId); + expire
//   quitar:    redis.srem(...)
// estaConectado pasa a async: redis.exists(`presencia:${usuarioId}`)
```

Alternativa más simple si `estaConectado` no está en un hot path: un solo
`SET presencia:online` con `SADD usuarioId` y TTL por heartbeat. A definir
al implementar según cómo se use hoy (`grep estaConectado`).

### Balanceador y WebSockets

- El socket en sí queda pineado a la réplica que lo aceptó (una conexión
  TCP no migra). El pub/sub NO cambia eso — cambia que *cualquier* réplica
  pueda hacer llegar un mensaje a ese socket.
- **No hace falta sticky sessions para correctitud** una vez que está el
  pub/sub: el cliente abre un WS, se queda en una réplica, y los eventos
  le llegan sin importar dónde se originen. Sticky ayuda solo a que un
  reconnect vuelva a la misma réplica (menor churn), no es obligatorio.
- Caddy ya es el reverse proxy: balancear es agregar varias upstreams.
  Ver §7.

---

## 5. Workstream B — invalidación de `reglas_juego` por pub/sub

Barato una vez que Redis ya está para el Workstream A. El PATCH del BO que
cambia una regla publica la invalidación; todas las réplicas de `ms-salas`
actualizan su cache local.

```ts
// ms-salas/src/game/reglas.ts
const CANAL_REGLAS = 'salas:regla-invalidada';   // { clave, valor }

// invalidarRegla (hoy solo toca la cache local) pasa a publicar también:
export function invalidarRegla(clave: string, valor: ReglaValor): void {
  cache.set(clave, valor);                                  // la propia réplica
  redis?.publish(CANAL_REGLAS, JSON.stringify({ clave, valor }));  // las demás
}

// Al arrancar, suscribirse y aplicar:
export function iniciarSubReglas(): void {
  redisSub?.subscribe(CANAL_REGLAS);
  redisSub?.on('message', (canal, raw) => {
    if (canal !== CANAL_REGLAS) return;
    const { clave, valor } = JSON.parse(raw);
    cache.set(clave, valor);
  });
}
```

Sin Redis (`redis === null`): `invalidarRegla` sigue funcionando igual que
hoy (instancia única). Cero regresión.

**Ojo con el canal compartido**: si `ms-social` y `ms-salas` comparten la
misma instancia de Redis, usar prefijos de canal por servicio
(`social:*`, `salas:*`) para que un `subscribe` no reciba mensajes del
otro. Ya está reflejado en los nombres de arriba.

---

## 6. Workstream C — mutex de bots distribuido

`resolucionesEnCurso` (`juegos.ts:189`) evita procesar el mismo bot dos
veces. Con réplicas hace falta que el lock sea global. **Dos opciones:**

**Opción 1 — Advisory lock de Postgres (recomendada).** El repo YA usa
este patrón y funciona entre instancias (`matchmaking.ts:138`). No agrega
dependencia de Redis en el hot path del juego:

```ts
// En vez del Set en memoria:
const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [hashJuego(juegoId)]);
if (!rows[0].ok) return;                       // otra réplica ya lo está resolviendo
try { /* resolver bot */ } finally {
  await client.query('SELECT pg_advisory_unlock($1)', [hashJuego(juegoId)]);
}
```

**Opción 2 — Lock en Redis.** Si se prefiere no cargar más a Postgres:

```ts
const ok = await redis.set(`lock:bot:${juegoId}`, '1', 'PX', 10000, 'NX');
if (!ok) return;
try { /* resolver */ } finally { await redis.del(`lock:bot:${juegoId}`); }
```

**Recomendación**: Opción 1. Es consistente con el matchmaking, no suma a
Redis un rol en el camino crítico de cada jugada, y el `finally` cierra el
lock aunque falle. Redis queda reservado para lo que *solo* Redis resuelve
bien (pub/sub de sockets).

---

## 7. Correr varias réplicas — mecánica

Una vez hechos A/B/C, escalar es declarativo:

```yaml
  ms-social:
    deploy:
      replicas: 2        # docker compose up -d --scale ms-social=2
    # (quitar cualquier "ports:" con puerto fijo del host — con réplicas
    #  no puede haber dos atando el mismo puerto; se alcanzan por la red
    #  interna vía el balanceador)
```

**Balanceo con Caddy** (ya es el reverse proxy del stack): Caddy soporta
upstreams múltiples y `lb_policy`. Para WebSockets (`ms-social`), Caddy
hace proxy de WS de forma transparente; con pub/sub no se necesita
`sticky` para correctitud (§4). Ejemplo conceptual en el `Caddyfile`:

```
  reverse_proxy ms-social:5000 {
    lb_policy round_robin
  }
```

(Docker resuelve `ms-social` a las N réplicas vía DNS interno; Caddy
balancea entre ellas.)

**Gateway y ms-salas** son stateless para requests HTTP (todo el estado
está en Postgres/Redis), así que escalan igual con `--scale`. El único
cuidado es el pool de Postgres: N réplicas × `max` del pool no puede pasar
`max_connections` de Postgres — atar esto al Tier 1 de la auditoría
(ponerle `max` explícito al pool antes de multiplicar réplicas), o meter
**PgBouncer** delante de Postgres si se escala en serio.

---

## 8. Bonus — rate limiting compartido (engancha con Tier 1 de la auditoría)

El Tier 1 #3 de la auditoría pide rate limiting en login/registro/
matchmaking. Con una sola instancia, `@fastify/rate-limit` en memoria
alcanza. Con réplicas del gateway, el límite tiene que ser **compartido**
(si no, N réplicas = N× el límite real). `@fastify/rate-limit` acepta un
store de Redis:

```ts
app.register(rateLimit, { redis, max: 10, timeWindow: '1 minute' });
```

O sea: si se hace el rate limiting del Tier 1 pensando ya en Redis como
store opcional, no hay que rehacerlo al escalar. No es obligatorio hoy
(en memoria alcanza para una instancia), solo una nota para no pintarse
en una esquina.

---

## 9. Orden de implementación

1. **Infra**: contenedor `redis` en compose + módulo `redis.ts` en
   `ms-social` y `ms-salas` (con degradación a `null`). Nada cambia de
   comportamiento todavía — solo queda el cableado listo.
2. **Workstream A** (`ms-social` pub/sub) — el bloqueador real y el mayor
   valor. Verificar con 2 réplicas locales que un evento originado en la
   réplica A llega a un socket de la B.
3. **Workstream B** (invalidación de reglas) — barato, mismo Redis.
4. **Workstream C** (mutex de bots) — recomendado por advisory lock de PG,
   ni siquiera toca Redis.
5. **Escalar de verdad**: `--scale`, Caddy con upstreams, y atar el `max`
   del pool de Postgres (o PgBouncer). Recién acá se corren 2+ réplicas en
   producción.

Cada paso es independiente y no rompe el modo instancia-única (todo
degrada con `redis === null`). Se puede mergear A sin haber hecho C.

---

## 10. Fuera de alcance / riesgos anotados

- **No** se mueve el estado de la partida ni el matchmaking a Redis: ya
  viven bien en Postgres. Meter Redis ahí sería sobre-ingeniería y una
  fuente de inconsistencia (dos fuentes de verdad).
- **Presencia con TTL/heartbeat** (§4, `estaConectado` global) tiene un
  detalle fino: si una réplica muere sin limpiar sus entradas de
  presencia, quedan "fantasmas" hasta que expire el TTL. Aceptable con TTL
  corto + heartbeat; anotarlo al implementar.
- **Redis como punto único de fallo**: con pub/sub, si Redis cae, los
  eventos entre réplicas dejan de propagarse (cada réplica sigue sirviendo
  a sus propios sockets, pero se pierde el fan-out). Para una sola
  instancia de Redis es aceptable en esta escala; Redis Sentinel/cluster
  es un problema de un orden de magnitud más de usuarios que el que motiva
  este plan.
- **Este plan asume que primero se hicieron los Tier 1 de la auditoría**
  (pool de Postgres con `max`, timeouts del gateway, healthchecks). Correr
  réplicas sin eso multiplica los problemas que el Tier 1 arregla, en vez
  de resolverlos.

---

*Basado en revisión de código (`presencia.ts`, `reglas.ts`, `juegos.ts`,
`matchmaking.ts`, `docker-compose.yml`), no en carga real medida. Pensado
para ejecutarse el día que Grafana muestre una instancia saturada — no
antes.*
