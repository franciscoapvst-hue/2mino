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
| `/frontend/*` | ms-frontend-landing | Preferencias de UI del usuario |
| `/salas/*` | ms-salas | CRUD de salas y jugadores |
| `/salas/:id/juego/*` | ms-salas | Iniciar partida, jugar, pasar |

### ms-usuarios (puerto 4000, interno)

Gestiona identidad y credenciales.

**Tablas:**

- `segmentos` — Agrupa configuración por tipo de usuario (ej. `tester` con todas las features).
- `usuarios` — Cuentas con `password_hash` (bcrypt).
- `reset_tokens` — Tokens de recuperación de contraseña.

Las migraciones se ejecutan al arrancar el servicio (`runMigrations()`).

### ms-frontend-landing (puerto 5000, interno)

Configuración del landing y overrides de preferencias por usuario.

**Tablas:**

- `landing_config` — Clave-valor global (registro habilitado, modos visibles, tema default…).
- `frontend_overrides` — Cambios del usuario respecto a su segmento (tema, idioma, opciones).

La respuesta de `/frontend/preferencias` fusiona segmento + overrides + landing.

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
- Detección de **capicúa** (30 pts) y **tranca** (30 pts al equipo con menos pips).
- Turnos, pasadas consecutivas y conteo de manos por asiento.

### Endpoints de juego

| Método | Ruta | Acción |
|--------|------|--------|
| POST | `/salas/:id/juego/iniciar` | Reparte y abre partida |
| GET | `/salas/:id/juego` | Estado público (sin manos ajenas) |
| POST | `/salas/:id/juego/jugar` | Jugar ficha `{ pieza, lado? }` |
| POST | `/salas/:id/juego/pasar` | Pasar turno |

El frontend consulta el estado periódicamente (polling) desde `GameBoard`.

## Seguridad

- Los microservicios **no publican puertos** en Docker Compose (solo `api-integracion` y `postgres` para debug).
- JWT en header `Authorization: Bearer <token>`.
- Contraseñas hasheadas con bcrypt en `ms-usuarios`.
- Salas privadas soportan `contrasena_hash` (campo preparado en esquema).

## Base de datos

Una sola instancia PostgreSQL (`2mino`) compartida por todos los servicios. Cada microservicio define y ejecuta sus propias migraciones al inicio; no hay herramienta de migraciones externa (Flyway/Liquibase).

## Despliegue

`docker-compose.yml` define el stack completo para VPS (referencia en Swagger: `https://api.2mino.com`). El frontend se sirve por separado (build estático de Vite) y apunta a la API pública.
