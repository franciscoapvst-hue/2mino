# Load test — matchmaking casual

Mide cuántos jugadores concurrentes aguanta el flujo real: invitado → cola
casual 1v1 → emparejar → poll de la partida. Ver `docs/ESCALABILIDAD.md`
para el contexto (auditoría por código, sin carga real medida — este test
es lo que faltaba).

## Requisitos

- Docker (para correr `grafana/k6` sin instalar nada más).
- El stack local levantado (`docker compose up -d`), gateway respondiendo
  en `127.0.0.1:3000`.

## Antes de correrlo: subir el rate limit local

`api-integracion` tiene un límite global de 300 req/min/IP y uno propio de
10 req/min/IP en `/auth/*` (`src/index.ts`, `src/routes/auth.ts`). Como
k6 pega desde una sola IP (el contenedor del load test), ese límite se
agota en segundos y el test termina midiendo el rate limiter, no el techo
real de Postgres/CPU.

Para medir el techo real, subir temporalmente esos `max` (por ejemplo a
`100000`) en el código, `docker compose up -d --build api-integracion`,
correr el test, y **revertir el cambio + rebuildear de nuevo** apenas
termine — no dejar el gateway así.

**Nunca correr esto contra producción con el rate limit deshabilitado —
es la única barrera real contra abuso hoy (`docs/ESCALABILIDAD.md`).**

## Correrlo

```bash
docker run --rm -i grafana/k6 run - < load-test/casual-matchmaking.js
```

Contra otro host/puerto:

```bash
docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 grafana/k6 run - < load-test/casual-matchmaking.js
```

Etapas de VUs custom (JSON de k6 `stages`):

```bash
docker run --rm -i -e STAGES='[{"duration":"1m","target":300}]' grafana/k6 run - < load-test/casual-matchmaking.js
```

## Qué mirar en el resultado

- `http_req_failed` por etapa — en qué escalón de VUs empieza a fallar.
- `http_req_duration` (p95) — en qué punto la latencia se dispara antes
  de que aparezcan errores (aviso temprano).
- `matchmaking_timeouts` — jugadores que nunca emparejaron en 30s (cola
  no está drenando, no necesariamente el mismo cuello de botella que los
  errores HTTP).
- `tiempo_hasta_match_ms` — cuánto tarda en emparejar bajo carga.

Nota: corrido contra el stack local (tu máquina), no contra el VPS real
de 2 vCPU / 4GB — sirve para encontrar el orden de magnitud y confirmar
qué se rompe primero, no como número final de producción.
