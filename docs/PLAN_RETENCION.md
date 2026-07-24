# Plan — Retención y economía: racha semanal + ganar jugando

**Sesión 4** · punto 6 + retoma la **Etapa 2 pospuesta** de `PLAN_COSMETICOS.md`
("ganar doblones jugando"). Referencia: chess.com (rachas).

## Contexto

Los doblones (`billeteras`/`billetera_movimientos`, ya construidos) hoy **solo** se
consiguen por ajuste de admin. Falta darle al jugador un **incentivo diario** (punto 6):
una **racha semanal** que premie jugar cada día con doblones. Y falta la fuente base:
**ganar doblones al jugar** (Etapa 2 del plan de cosméticos, que se pospuso). Las dos
cosas son la misma pieza: "razones para volver y jugar", y alimentan los contadores del
dashboard de escritorio (`PLAN_ESCRITORIO.md`, racha de días / de victorias).

**Regla dura (decisión ya tomada, `PLAN_COSMETICOS.md`)**: los doblones se ganan
jugando; **nadie pierde doblones por perder**; no hay apuestas.

## Alcance

**Sí:**
- **Ganar jugando (Etapa 2)**: al cerrar una partida, otorgar un monto fijo por partida
  completada (gane o pierda) + bonus por ganar ranked. Idempotente por `partida_id`.
- **Racha diaria/semanal (punto 6)**: contar días consecutivos con al menos una partida.
  - Bonus fijo por **primera partida del día** (una vez por día calendario).
  - **Recompensa creciente por racha semanal** (ej. día 1..7 sube el bonus; completar 7
    días da un premio mayor). Sin timers de urgencia manipulativos, pero sí el clásico
    "no rompas la racha".
- Exponer el estado de racha para el dashboard: `racha_dias`, `racha_maxima`,
  `jugado_hoy`, próximo premio.

**No:**
- Compra de doblones con dinero real (eso es otra etapa, ya planeada) · loot boxes
  (prohibido por diseño) · ligas/temporadas.

## Dónde vive

- **`ms-usuarios`** (dueño de la billetera):
  - `POST /interno/billetera/:usuarioId/otorgar { monto, motivo, ref }` — endpoint
    **interno** (no expuesto), idempotente por `(usuario_id, motivo, ref)`. Motivos:
    `partida_completada`, `racha_diaria`, `racha_semana`.
  - Tabla `rachas` (o derivar de `billetera_movimientos`): `usuario_id`,
    `ultimo_dia_jugado DATE`, `racha_dias INT`, `racha_maxima INT`. Se actualiza al
    otorgar `racha_diaria`.
  - `GET /usuarios/:id/racha` → estado para el dashboard.
- **`ms-salas`** (`routes/juegos.ts`, en el cierre de partida `guardarPartida`, junto al
  ELO/historial): llamada fire-and-forget a `/interno/billetera/.../otorgar` con el monto
  de "partida completada" + bonus ranked. Mismo criterio de "un email caído no rompe la
  jugada" que ya usa `avisarPartidaActualizada`. El bonus de racha diaria/semanal lo
  resuelve `ms-usuarios` al recibir el `motivo='racha_diaria'` (calcula si hoy es un día
  nuevo consecutivo y paga el escalón correspondiente).
- **Gateway**: `GET /racha` (verifyToken → `ms-usuarios`).
- **Frontend**: contador de racha en el dashboard (S1) + un aviso cálido "¡+N doblones
  por tu racha de X días!" al entrar si corresponde (sin animación de casino).

## Etapas

1. **Ganar jugando** (Etapa 2): `POST /interno/billetera/.../otorgar` idempotente +
   llamada desde `ms-salas` al cerrar partida. Verificar montos y no-duplicación.
2. **Racha diaria**: tabla `rachas` + lógica "primera del día" (`ref = YYYY-MM-DD`) +
   `GET /racha`.
3. **Escalón semanal**: recompensa creciente por días consecutivos; premio al completar
   la semana.
4. **Frontend**: contador de racha en el dashboard + aviso de recompensa.

## Verificación

Jugar una partida (ganada y perdida) → confirmar el monto en `billetera_movimientos`
**sin restar por perder**; cerrar la misma partida dos veces (reintento) no duplica.
Jugar en días distintos (simular cambiando `ultimo_dia_jugado`) → la racha sube y paga el
escalón correcto; saltarse un día la reinicia. `GET /racha` refleja el estado.

## Fuera de alcance

Compra de doblones con dinero / rewarded ads (otra etapa) · ligas/temporadas · cofres.
