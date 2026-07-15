# Plan de ejecución — Torneos

Baja a tierra `docs/CASOS_DE_USO_TORNEOS.md` (flujos aprobados, clic por
clic) sobre el schema base de `docs/CASOS_DE_USO_BACKOFFICE.md` §7. Mismo
espíritu que `PLAN_REDIS.md`: qué se construye, dónde, en qué orden, y qué
NO se construye. Referencias a código real verificadas hoy.

**Decisiones ya fijadas** (no reabrir): AZUL Página de Pago alojada ·
cuota por equipo (paga jugador 1) · reembolso manual desde el BO · avance
de fase híbrido (auto por fecha + forzar/posponer) · Top N automático por
métrica configurable · reglas de partida sobrescribibles por torneo ·
notificaciones por email (10 tipos) · moneda DOP.

---

## 0. Prerrequisitos (bloquean todo lo demás)

Los torneos se administran desde el Back Office, y el BO hoy es un
frontend con **datos mock** (`2mino-BO/src/lib/api.ts`) — no existe
todavía la infraestructura admin del lado del juego:

1. **Segmento `admin` + `signToken` con `segmento` + `requireAdmin()`** en
   `api-integracion` (paso 1 del orden de `CASOS_DE_USO_BACKOFFICE.md` §9).
   Sin esto no hay forma de proteger `POST /admin/torneos`.
2. **`api-integracion/src/routes/admin.ts`** con el proxy `/admin/*` hacia
   los microservicios.
3. **Dominio verificado en Resend** (o el proveedor que sea): el sandbox
   `onboarding@resend.dev` solo envía al dueño de la cuenta — los emails
   de torneo van a CUALQUIER inscrito, así que sin dominio verificado la
   Etapa 6 no puede salir a producción.
4. **Credenciales de comercio AZUL** (MerchantID/AuthKeys + acceso al
   ambiente de pruebas): trámite externo, puede tardar — **iniciarlo ya**,
   aunque la Etapa 5 llegue después.

---

## 1. Dónde vive cada cosa

| Pieza | Servicio | Por qué |
|---|---|---|
| Tablas de torneo, motor de fases, scheduler | `ms-salas` | Ya es dueño de `salas`/`juegos`/ELO; el resultado de una partida nace ahí (`guardarPartida`, `routes/juegos.ts:37`) — reportar al torneo es una llamada de función local, sin salto HTTP |
| Pagos AZUL (`torneo_pagos`, hash, retornos) | `ms-salas` | El pago pertenece al equipo del torneo; separarlo en otro servicio duplicaría la coordinación de estados |
| Envío de emails | `ms-usuarios` | Ya tiene `email.ts` (Resend + plantilla de marca del PR 52). `ms-salas` NO duplica el sender: le pega a un endpoint interno nuevo `POST /interno/emails` (mismo patrón que `ms-social/routes/interno.ts` del trabajo de polling) con `{tipo, destinatarios, datos}`, fire-and-forget |
| UI admin (wizard 8 pasos, pestañas) | `2mino-BO` | Reemplaza el mock por el cliente real vía gateway `/admin/*` |
| UI jugador (listado, detalle, inscripción, "mi torneo") | `src/` | Detrás del flag `torneos_habilitado` (feature flag ya diseñado) |

---

## 2. Schema — delta sobre §7

§7 ya define `torneos`, `torneo_fases` (con `ventana_inicio/fin` propios —
los huecos entre fases ya caben en el dato), `torneo_equipos` (2 pasos,
`codigo_equipo`), `torneo_partidas`, `torneo_campos_inscripcion`,
`torneo_inscripcion_datos`. Lo nuevo:

```sql
-- torneos: columnas nuevas
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS estado_wizard      VARCHAR(20) NOT NULL DEFAULT 'borrador'; -- borrador antes de abrir inscripción
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS cuota_monto        INT NOT NULL DEFAULT 0;      -- centavos DOP; 0 = gratis
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS moneda             VARCHAR(3) NOT NULL DEFAULT 'DOP';
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS politica_reembolso TEXT;                        -- se muestra ANTES de pagar
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS reglas_override    JSONB NOT NULL DEFAULT '{}'; -- solo las claves cambiadas (Paso 3 del wizard)
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS avance_automatico  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS reglamento_pdf_url    TEXT; -- archivo subido (Paso 8), distinto de info_html (marketing) — el documento formal/legal
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS reglamento_pdf_nombre VARCHAR(120); -- nombre original del archivo, para el link de descarga

-- torneo_fases: criterio de clasificación por transición + estado operativo
ALTER TABLE torneo_fases ADD COLUMN IF NOT EXISTS clasifican_n INT;             -- Top N que pasa AL CERRAR esta fase (NULL en la final)
ALTER TABLE torneo_fases ADD COLUMN IF NOT EXISTS metrica      VARCHAR(20) NOT NULL DEFAULT 'puntos'
    CHECK (metrica IN ('puntos','elo_torneo','victorias'));                     -- solo relevante en tipo='inicial'
ALTER TABLE torneo_fases ADD COLUMN IF NOT EXISTS requiere_atencion BOOLEAN NOT NULL DEFAULT false; -- ventana vencida con partidas pendientes / empate en el corte

-- torneo_equipos: estado de pago en el ciclo de inscripción
--   pendiente_pago → pendiente_companero → completo (gratis salta el primero)
ALTER TABLE torneo_equipos DROP CONSTRAINT IF EXISTS torneo_equipos_estado_check;
ALTER TABLE torneo_equipos ADD CONSTRAINT torneo_equipos_estado_check
    CHECK (estado IN ('pendiente_pago','pendiente_companero','completo','eliminado','campeon'));

-- Pagos AZUL — una fila por INTENTO (reintento = fila nueva, OrderNumber nuevo)
CREATE TABLE IF NOT EXISTS torneo_pagos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID        NOT NULL REFERENCES torneos(id),
  equipo_id     UUID        NOT NULL REFERENCES torneo_equipos(id),
  order_number  VARCHAR(30) UNIQUE NOT NULL,          -- idempotencia con AZUL
  monto         INT         NOT NULL,                 -- centavos
  moneda        VARCHAR(3)  NOT NULL DEFAULT 'DOP',
  estado        VARCHAR(20) NOT NULL DEFAULT 'iniciado'
                CHECK (estado IN ('iniciado','aprobado','declinado','cancelado','expirado','reembolsado')),
  azul_respuesta JSONB,                               -- params de retorno verificados (auditoría)
  reembolso_motivo TEXT, reembolso_at TIMESTAMPTZ, reembolso_por UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelto_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pagos_equipo ON torneo_pagos (equipo_id);

-- Registro de emails de torneo — dedupe + auditoría
CREATE TABLE IF NOT EXISTS torneo_emails (
  torneo_id  UUID        NOT NULL,
  tipo       VARCHAR(30) NOT NULL,   -- 'inscripcion','equipo_completo','recordatorio_companero',...
  ref        VARCHAR(60) NOT NULL,   -- a qué refiere: equipo_id, partida_id, fase_id... según tipo
  enviado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (torneo_id, tipo, ref) -- un INSERT que conflictúa = ya se mandó, no repetir
);
```

Las **validaciones de fechas** (orden lógico grupos→eliminatorias, sin
solapamiento, hueco permitido, todo dentro del rango del torneo) van en el
código del endpoint de creación/edición, no en constraints — cruzan filas
de `torneo_fases` y el mensaje de error debe señalar la fila conflictiva.

---

## 3. Motor de torneo (el corazón — todo en `ms-salas`)

### 3.1 Generar las salas de una fase

`iniciarTorneo()` / `abrirFase(faseId)`:
1. Valida equipos `completo` = lo que el formato exige (v1 sin "bye").
2. Fase inicial: arma el todos-contra-todos del grupo; eliminatoria: cruces
   por seed (1º vs último, etc. — seed = posición en la tabla de la fase
   anterior). Inserta los cruces en `torneo_partidas` **sin sala todavía**
   — el bracket es visible desde que se conoce.
3. Cuando llega `ventana_inicio` de la fase (o al forzar), crea por cada
   cruce una **sala normal** reusando la creación existente de
   `matchmaking.ts` (`INSERT INTO salas … modo='torneo'`), con:
   - `sala_jugadores`: los 4 jugadores en posiciones fijas (parejas del
     torneo enfrentadas — mismo criterio de asientos que el 2v2 actual).
   - `salas.config` = `{ torneo: { torneoId, partidaId }, reglas: {…} }` —
     el set de overrides del Paso 3 del wizard, ya resuelto contra los
     valores globales (copia congelada: si el admin cambia una regla
     global a mitad de torneo, las partidas del torneo no cambian).
4. Marca `torneo_partidas.sala_id` y dispara el email "tu partida está
   lista" (con dedupe vía `torneo_emails`).

### 3.2 Reglas por torneo dentro de la partida

Hoy `logic.ts`/el temporizador leen constantes del cache global
(`game/reglas.ts`, `getRegla`). Cambio: las funciones puras ya reciben
varios de estos valores como parámetro — se completa ese patrón y las
**rutas** resuelven el valor así:

```
valor = sala.config.reglas?.[clave] ?? getRegla(clave, default)
```

Un solo punto de resolución (`reglasDeSala(sala)`) usado por
`routes/juegos.ts` al construir el contexto de la jugada. **Es el cambio
más delicado del plan**: toca el camino de los 92 tests de `ms-salas` —
los tests existentes deben seguir en verde con `config.reglas` vacío, y se
agregan tests nuevos con overrides (capicúa que no suma, tranca con otro
monto, tiempo por jugada distinto).

### 3.3 Reportar el resultado al torneo

En `guardarPartida()` (`routes/juegos.ts:37`) ya existe el bloque
`terminada` que registra ELO/historial. Se agrega, en el mismo lugar:

```
if (terminada && salaEsDeTorneo) →
  UPDATE torneo_partidas (ganador, puntos, capicúas/tranques de la partida)
  UPDATE torneo_equipos   (stats incrementales + elo_torneo con deltaElo() existente)
  marcar eliminado_en si la fase es eliminatoria
  email resultado ("avanzaste"/"eliminado" se decide al cerrar la FASE, no acá)
```

Llamada de función local + mismas transacciones que ya usa el bloque de
ranked — sin HTTP, sin registro doble.

### 3.4 Cierre de fase + Top N automático

`cerrarFase(faseId, {forzada})`:
1. Si quedan partidas sin jugar: si `forzada`, el admin resolvió cada
   pendiente en el modal (walkover — se registra en `torneo_partidas` con
   un flag `walkover=true`); si no, marca `requiere_atencion` y avisa.
2. Fase inicial: `ORDER BY métrica elegida` con desempates en cascada
   (puntos → victorias → elo_torneo → si el EMPATE EXACTO cae justo en el
   corte del Top N → `requiere_atencion`, el admin desempata en el BO).
   Eliminatoria: pasan los ganadores de cada cruce.
3. Genera los cruces de la fase siguiente (§3.1 paso 2) — las salas
   esperan a su `ventana_inicio`.
4. Última fase cerrada → torneo `finalizado`, `campeon` en
   `torneo_equipos`, email masivo final.

### 3.5 Scheduler híbrido

Un `setInterval` de 60s en `ms-salas` (hoy no existe ninguno — verificado)
que, **protegido con `pg_try_advisory_lock`** (mismo patrón que el
matchmaking, `matchmaking.ts:138` — así no rompe con réplicas, coherente
con `PLAN_REDIS.md`), revisa:

- Fases `pendiente` cuya `ventana_inicio` llegó → crear salas (§3.1.3) +
  emails.
- Fases `en_curso` cuya `ventana_fin` pasó y `avance_automatico=true` →
  `cerrarFase()` (que NO avanza sola si hay pendientes — marca atención).
- Recordatorios: equipo `pendiente_companero` con >X horas (email 3),
  torneo que empieza en <24h (email 4). Dedupe por `torneo_emails`.

El admin siempre puede `forzar`/`posponer` por encima (los endpoints de
§4 llaman a las mismas funciones del motor).

---

## 4. Endpoints

**Admin (gateway `/admin/*` → ms-salas, con `requireAdmin()`)**
- `POST /admin/torneos` (borrador) · `PATCH /admin/torneos/:id` (editar
  wizard, valida fechas/formato) · `POST /admin/torneos/:id/abrir-inscripcion`
- `GET /admin/torneos` · `GET /admin/torneos/:id` (config + fases +
  equipos + posiciones + recaudado)
- `POST /admin/torneos/:id/iniciar` · `POST /admin/torneos/:id/fases/:faseId/cerrar`
  (con body de resoluciones walkover) · `PATCH .../fases/:faseId/posponer`
- `PATCH /admin/torneos/:id/partidas/:partidaId/fecha` (reprogramar)
- `GET /admin/torneos/:id/pagos` · `POST /admin/torneos/:id/pagos/:pagoId/reembolsar`
- `PATCH /admin/torneos/:id/estado` (cancelar)

**Jugador (gateway público con `verifyToken` → ms-salas)**
- `GET /torneos` (filtrado por ELO/visibilidad/flag) · `GET /torneos/:id`
  (detalle + mi equipo + mi próxima partida + posiciones)
- `POST /torneos/:id/equipos` (jugador 1: datos → si cuota>0 devuelve
  formulario AZUL; si gratis, crea directo) · `GET /torneos/:id/equipos/:codigo`
  · `POST /torneos/:id/equipos/:codigo/unirse` (jugador 2)
- `POST /torneos/:id/pago/iniciar` (regenera intento tras declinado)
- `POST|GET /torneos/pago/retorno/:resultado` — **públicas** (AZUL redirige
  el navegador acá): verifican el hash de respuesta server-side, actualizan
  `torneo_pagos` + equipo, y `302` al frontend con el resultado. La
  verificación es idempotente por `order_number`.

---

## 5. AZUL — flujo técnico

1. `POST /torneos/:id/equipos` con cuota>0 → crea equipo
   `pendiente_pago` + fila `torneo_pagos` (`iniciado`,
   `order_number = TOR-{6 chars}-{seq}`) → responde los campos del
   formulario de la Página de Pago: MerchantID, monto/ITBIS en centavos,
   OrderNumber, `ApprovedUrl/DeclinedUrl/CancelUrl` (apuntan al gateway,
   §4) y el **AuthHash** (HMAC con las llaves del comercio — algoritmo y
   nombres de campo exactos se confirman contra el manual vigente de AZUL
   al implementar; van encapsulados en UN módulo `ms-salas/src/azul.ts`).
2. El frontend arma un `<form>` oculto con esos campos y hace submit →
   navegador del jugador va a AZUL.
3. Retorno → gateway verifica el hash de respuesta, marca
   `aprobado|declinado|cancelado`, mueve el equipo a
   `pendiente_companero` si aprobó, y redirige al front.
4. `iniciado` con >2h sin retorno → el scheduler lo marca `expirado`.
5. **Dev local**: `ENABLE_PAGOS=false` (default) → el backend simula
   aprobado sin ir a AZUL (mismo criterio que `ENABLE_EMAIL`). Contra el
   **ambiente de pruebas de AZUL** recién en la verificación de la Etapa 5.
6. Llaves solo en `.env` del VPS. Nunca datos de tarjeta de nuestro lado.

**Reembolso manual**: botón del BO → `azul.ts` llama la operación de
void/refund de AZUL con la referencia original → `reembolsado` + email 10.
Si la API de reembolso de AZUL no estuviera habilitada para el comercio,
fallback v1: el admin lo hace en el portal de AZUL y el botón solo marca
el estado (decidir al tener las credenciales — el BO no cambia).

---

## 6. Emails (10 tipos, tabla en CASOS_DE_USO_TORNEOS.md §5)

- `ms-usuarios`: endpoint interno `POST /interno/emails` (no expuesto en el
  gateway) + un builder por tipo junto a `construirEmailVerificacion()` —
  misma plantilla de marca (ficha 6-6 en tablas, fieltro, ámbar).
- `ms-salas` dispara fire-and-forget con `.catch()` silencioso (un email
  caído nunca rompe una jugada ni un cierre de fase) — mismo criterio que
  `avisarPartidaActualizada`.
- Dedupe: `INSERT INTO torneo_emails … ON CONFLICT DO NOTHING` ANTES de
  enviar; si conflictúa, no se envía. Los masivos (inicio de fase, final)
  iteran equipos con ese guard — un reintento del scheduler no duplica.

---

## 7. Frontend

**Jugador (`src/`)** — detrás de `torneos_habilitado`:
- Vistas nuevas en `App.tsx` (mismo patrón de `view` actual): listado,
  detalle (con `info_html` **sanitizado con DOMPurify**), formulario
  dinámico de inscripción, pantalla de código/compartir, retorno de pago,
  "mi torneo" (bracket/grupo, mi próxima partida con horario, posiciones).
- Rutas parseadas a mano como las existentes (`/verificar-email/:token`):
  `/torneos/:id/unirse/:codigo` y `/torneos/pago/resultado`.
- "Jugar ahora" entra a la sala con el `GameBoard` existente sin cambios
  de UI (las reglas custom ya viajan en la sala).

**Admin (`2mino-BO`)**:
- Reemplazar mock por cliente real (el diseño del BO ya prevé que solo
  cambia `src/lib/api.ts`).
- Wizard de 8 pasos (con "guardar borrador"), pestañas Equipos / Fases
  (progreso, posiciones, botones cerrar/forzar/posponer, badge "requiere
  atención") / Pagos (reembolsar).

---

## 8. Orden de implementación (cada etapa es mergeable sola)

| Etapa | Qué entrega | Depende de |
|---|---|---|
| **0** | Prerrequisitos §0 (admin infra + trámite AZUL + dominio email en paralelo) | — |
| **1** | Schema completo (§2) + CRUD de torneo con wizard y **validaciones de fechas/formato** + listado/detalle admin. Sin motor: se pueden crear torneos borrador/inscripción | 0 |
| **2** | Inscripción **gratis** end-to-end: equipos 2 pasos con código, formulario dinámico, vistas jugador (listado/detalle/unirse), emails 1-3 | 1 |
| **3** | Motor mínimo: `iniciar` → salas de fase 1 (con `config.reglas`), **reglas por torneo en la partida (§3.2 — lo delicado, tests)**, reporte de resultado (§3.3), posiciones en vivo, emails 5-7 | 2 |
| **4** | Cierre de fase + Top N + walkover + avance **manual**; después el scheduler híbrido (§3.5) con posponer/forzar y emails 4/8/9 | 3 |
| **5** | Pagos AZUL (§5): `azul.ts`, retornos, `pendiente_pago`, reembolso manual + pestaña Pagos del BO, email 10. Verificación contra ambiente de pruebas de AZUL | 2 (paralelo a 3-4) |
| **6** | Pulido: `info_html` con vista previa, recordatorios del scheduler, badge "requiere atención", conciliación de pagos huérfanos | 3-5 |

Racional del orden: la Etapa 2 ya da valor (torneos gratis jugables a
mano con avance manual llega en la 4); el pago (5) es ortogonal al motor
(3-4) — pueden ir en paralelo si el trámite de AZUL demora; y lo más
riesgoso técnicamente (§3.2, tocar las reglas del juego) queda aislado en
la 3 con su propia batería de tests.

## 9. Verificación por etapa

- **1**: crear torneo con fases solapadas / grupos después de eliminatoria
  → el endpoint rechaza con el error correcto. Wizard guarda borrador.
- **2**: dos usuarios reales de prueba completan el flujo de código;
  tercero intenta unirse a equipo completo → error claro.
- **3**: `vitest` de `ms-salas` en verde (92 existentes + nuevos de
  overrides); partida de torneo con capicúa-no-suma verifica el marcador;
  el resultado aparece en `torneo_partidas`/posiciones.
- **4**: torneo de 4 equipos jugado completo en local (bots ayudan);
  Top N con empate en el corte → `requiere_atencion`; scheduler con
  ventanas de minutos avanza solo y respeta el hueco entre fases.
- **5**: tarjetas de prueba de AZUL (aprobada/declinada/cancelada);
  cerrar la pestaña en AZUL → `expirado`; reembolso de punta a punta.
- **6**: emails reales de cada tipo a una casilla propia (dedupe: forzar
  el scheduler dos veces no duplica).

## 10. Fuera de alcance v1 (ya acordado + consecuencias del plan)

Brackets con "bye" · cuota por jugador/configurable · reembolso
automático · notificaciones in-app (campana) · multi-moneda ·
tokenización DataVault · doble eliminación/loser bracket · y **espectador**
(ver partidas de torneo ajenas): no estaba en los casos de uso — anotado
como candidato natural para después, no se construye ahora.

---

*Basado en código verificado: `salas.config` JSONB y `modo='torneo'` ya
existen (`ms-salas/src/db/pool.ts:16-35`), `guardarPartida` como único
punto de cierre (`routes/juegos.ts:37`), advisory locks como patrón de
concurrencia (`matchmaking.ts:138`), email builder (`ms-usuarios/src/
email.ts`), endpoint interno como patrón inter-servicio
(`ms-social/routes/interno.ts`). El detalle de campos/hash de AZUL se
confirma contra su manual al arrancar la Etapa 5.*
