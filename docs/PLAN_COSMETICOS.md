# Plan de ejecución — Cosméticos (fichas, tableros, avatares) + moneda virtual

Mismo espíritu que `PLAN_REDIS.md`/`PLAN_TORNEOS.md`: qué se construye,
dónde, en qué orden, y qué NO se construye todavía. Basado en código
verificado hoy (`DominoPiece.tsx`, `avatars.ts`, `ranks.ts`,
`ms-usuarios/src/db/pool.ts`).

**Punto de partida real, no un sistema nuevo desde cero**: ya existe medio
sistema de cosméticos sin saberlo —
- `src/avatars.ts` + `AvatarPicker.tsx`: catálogo de avatares con
  glob de assets, ya seleccionables. Hoy TODOS son gratis; falta la noción
  de "cuáles son míos".
- `DominoPiece.tsx`: el dibujo de la ficha (pips, fondo, trazo) sale de
  tres constantes (`PIPS`, `PIP_COLOR`, `fillFace`) — no hay ninguna
  imagen. Un "skin de fichas" es reemplazar esas constantes por variante,
  no un sistema de renderizado nuevo.

**Anti-referencia que esto debe respetar** (`PRODUCT.md`): nada de
sensación de casino/gambling. Esto descarta de entrada cualquier caja
sorpresa/gacha — la tienda es de **catálogo visible, precio fijo,
compra directa**. Se ve el ítem exacto antes de comprarlo, siempre.

---

## 0. Decisiones ya fijadas (no reabrir)

**Moneda: doblones.** Se gana **solo jugando** en v1 — nada de compra
con dinero real todavía (esa complejidad de cobros queda reservada para
cuando se implemente `PLAN_TORNEOS.md`/AZUL; reusarlo para top-up de
doblones es el v2 natural, no se mezcla ahora). **Cosméticos 100%
visuales** — cero efecto en partida, cero ventaja de legibilidad; si
algún ítem futuro diera aunque sea una ventaja mínima, no entra al
catálogo tal cual, se rediseña.

---

## 1. Alcance v1 vs. después

Igual que Torneos separó "motor" de "pagos", acá conviene separar
"un solo tipo de ítem" de "todo el catálogo":

| | v1 | v2 |
|---|---|---|
| Moneda | Doblones, se gana jugando | Comprar con dinero real (AZUL) |
| Cosmético | Skins de ficha (`DominoPiece`) **+ tableros** (`game.css`, adelantado desde v2 en la Etapa 4) | Marcos de avatar, avatares nuevos vendibles |
| Tienda | Catálogo simple, comprar/equipar | Rotación temporal, destacados, bundles |
| Progresión | — | Cosméticos de rango (se desbloquean, no se compran, al llegar a Oro/Platino/Diamante) |

Por qué fichas primero: es lo que más tiempo está en pantalla (mano +
cadena del tablero, siempre visible durante toda la partida), y el
componente ya está preparado para variar (3 constantes, no assets). Un
tablero nuevo toca CSS de `game.css`/`SnakeBoard.tsx` con más superficie
(fondo de la mesa, sombras, colores de zona de drop) — se hace después
con el mismo catálogo/inventario ya probado.

---

## 2. Dónde vive cada cosa

| Pieza | Servicio | Por qué |
|---|---|---|
| Saldo de doblones, catálogo de ítems, inventario, transacciones | **`ms-usuarios`** | Ya es dueño de `usuarios` y de todo lo "identidad del jugador" (avatar hoy vive ahí como columna). Un servicio nuevo (`ms-tienda`) sería más infraestructura (otro contenedor, otra entrada en `docker-compose.yml`, otro proxy en el gateway) para un dominio que en v1 es un puñado de tablas chicas — no se justifica todavía |
| Otorgar doblones al terminar partida | `ms-salas` → llamada interna a `ms-usuarios` | Mismo patrón que ya existe para emails (`POST /interno/...`, ver `PLAN_TORNEOS.md` §1): `ms-salas` sabe cuándo termina una partida (`guardarPartida`, `routes/juegos.ts:37`), pero el saldo vive en `ms-usuarios` — no se duplica ahí |
| Selector de skin equipado, aplicarlo a `DominoPiece`/avatar | `src/` | El equipado es un dato de `UserConfig` (mismo bucket `opciones` que ya usa tema/idioma/tutorial — ver `App.tsx: necesitaOnboarding`), no hace falta columna nueva en `usuarios` |
| Tienda (ver catálogo, comprar, saldo) | `src/` | Vista nueva en `App.tsx`, mismo patrón `view` de siempre |

---

## 3. Schema — todo nuevo, vive en `ms-usuarios`

```sql
-- Saldo del jugador. Fila 1:1 con usuarios, separada de la tabla
-- usuarios para no tocar esa tabla con algo que cambia mucho más seguido.
CREATE TABLE IF NOT EXISTS billeteras (
  usuario_id  UUID        PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  saldo       INT         NOT NULL DEFAULT 0 CHECK (saldo >= 0), -- doblones, entero (sin centavos: no es dinero real)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de movimientos — nunca se hace UPDATE del saldo a mano en
-- otro lado: TODO movimiento pasa por una fila acá + el UPDATE del saldo,
-- en la misma transacción. Así el saldo siempre es auditable/reconstruible.
CREATE TABLE IF NOT EXISTS billetera_movimientos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id),
  monto       INT         NOT NULL,           -- positivo = ingreso, negativo = gasto
  motivo      VARCHAR(30) NOT NULL,           -- 'partida_completada','racha_diaria','compra_item','ajuste_admin'
  ref         VARCHAR(60),                    -- partida_id / item_id / lo que corresponda, según motivo
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billetera_mov_usuario ON billetera_movimientos (usuario_id);

-- Catálogo de cosméticos. v1 solo categoria='ficha'; el resto ya
-- modelado para no rehacer la tabla cuando lleguen tableros/avatares.
CREATE TABLE IF NOT EXISTS tienda_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   VARCHAR(20) NOT NULL CHECK (categoria IN ('ficha','tablero','avatar','marco_avatar')),
  clave       VARCHAR(40) UNIQUE NOT NULL,    -- 'ficha_ambar', 'ficha_carey' — la variante que lee el frontend
  nombre      VARCHAR(60) NOT NULL,           -- nombre mostrado en la tienda
  precio      INT         NOT NULL CHECK (precio >= 0),
  disponible  BOOLEAN     NOT NULL DEFAULT true, -- retirar de la tienda sin borrar (quien ya lo tiene, lo conserva)
  orden       INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Qué compró cada jugador. Un ítem comprado es para siempre (no hay
-- "alquiler" ni expiración en v1).
CREATE TABLE IF NOT EXISTS inventario (
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id),
  item_id     UUID        NOT NULL REFERENCES tienda_items(id),
  comprado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, item_id)
);
```

**Nota sobre `precio >= 0`**: los ítems que se ganan por rango (v2,
ver §1) o los que vienen gratis por default (la ficha clásica de
siempre) se modelan con `precio = 0` y una regla de negocio aparte
("no aparece en la tienda para comprar, se entrega sola") — no hace
falta un booleano extra todavía.

**Qué NO necesita tabla nueva**: el ítem *equipado* (cuál de los que
tengo estoy usando ahora) es un dato chico y de lectura frecuente en
cada partida — va en `usuarios_config.opciones` (el mismo bucket JSONB
que ya usa `tutorial_estado`/tema, ver `App.tsx`), como
`{ "skin_ficha": "ficha_ambar" }`. Guardarlo ahí evita un JOIN extra en
cada carga de partida.

---

## 4. Cómo se gana moneda (sin oler a casino)

Fuentes honestas y visibles, ninguna aleatoria:

- **Partida completada**: monto fijo chico (ej. 5 doblones), sin
  importar si ganó o perdió — recompensa por jugar, no por azar.
- **Primera partida del día**: bonus fijo (ej. 15 doblones), una vez
  por día calendario — mismo tipo de guard que `torneo_emails` (una
  fila del día ya existente = no repetir).
- **Ranked ganado**: monto algo mayor que casual (ej. 10 vs 5) — refuerza
  "el rango importa" sin ser una lotería.

Todas se calculan y otorgan en el mismo punto donde hoy se otorga ELO/
historial (`guardarPartida`, `routes/juegos.ts:37`) — una llamada interna
más junto a la que ya se va a agregar para reportar a torneo (si ese plan
se implementa antes, se suman ahí mismo; si no, es un bloque nuevo
análogo).

**Explícitamente NO**: cofres/sobres con contenido aleatorio, "ruleta
diaria", multiplicadores de racha con animación de casino, ni timers de
urgencia ("¡oferta termina en 2 horas!"). Ninguno de estos encaja con
"cálido, nítido, con orgullo" ni con el anti-reference de `PRODUCT.md`.

---

## 5. Sistema de skins de ficha — el cambio concreto en código

`DominoPiece.tsx` hoy tiene `PIP_COLOR` y `fillFace` como constantes de
módulo. Se convierten en un mapa de paletas + un prop nuevo:

```ts
// DominoPiece.tsx — antes: constantes sueltas. Después:
export type SkinFicha = 'clasica' | 'ambar' | 'carey' | /* ... */ ;

const SKINS: Record<SkinFicha, { fillFace: string; pipColor: Record<Val, string> }> = {
  clasica: { fillFace: '#ffffff', pipColor: PIP_COLOR /* la de siempre */ },
  ambar:   { fillFace: '#fdf3e2', pipColor: { /* paleta cálida, un solo tono + variantes */ } },
  // ...
};
```

`DominoPieceProps` gana `skin?: SkinFicha = 'clasica'`. `GameBoard.tsx`
lee `partida` o `session.config.opciones.skin_ficha` **una vez** y lo
pasa hacia abajo a cada `<DominoPiece>` (mano, tablero, ghost) — no cada
componente decide por su cuenta, para que las fichas de una misma
partida siempre se vean consistentes con lo que el jugador eligió.

**Importante — legibilidad, no solo estética** (`PRODUCT.md`:
accesibilidad, WCAG AA): cualquier paleta nueva de pips debe mantener
±el mismo contraste que la actual contra `fillFace` de esa skin. Esto se
verifica por skin al agregarla (mismo criterio que ya se sigue en
`impeccable` para contraste de texto), no se derivan colores random.

**Fondo/tablero (v2)**: mismo mecanismo, pero el prop vive un nivel
arriba (`GameBoard`/`SnakeBoard`), y en vez de un mapa de colores es un
`className`/`data-tablero` que dispara variables CSS distintas
(`--g-bg`, sombras) — no assets rasterizados, para no repetir el peso de
imagen que ya se corrigió en las insignias de rango.

---

## 6. Endpoints (gateway público `/` → `ms-usuarios`, con `verifyToken`)

- `GET /tienda/items` — catálogo `disponible=true`, con `ya_comprado`
  resuelto contra el inventario del usuario autenticado.
- `GET /billetera` — saldo actual.
- `POST /tienda/items/:id/comprar` — valida saldo suficiente, inserta
  en `inventario` + fila de `billetera_movimientos` (motivo
  `compra_item`, monto negativo) + `UPDATE billeteras SET saldo = saldo - precio`,
  **todo en una transacción** con `SELECT ... FOR UPDATE` sobre la fila
  de `billeteras` (evita comprar dos veces "a la vez" con saldo justo —
  mismo espíritu de concurrencia que ya usa el matchmaking con advisory
  locks, aunque acá alcanza con el lock de fila normal de Postgres).
- `GET /inventario` — lo que el usuario ya posee, por categoría.

**Interno** (no expuesto en el gateway, mismo patrón que
`ms-social/routes/interno.ts`):
- `POST /interno/billetera/:usuarioId/otorgar` — `{ monto, motivo, ref }`,
  llamado por `ms-salas` al cerrar partida. Idempotente por
  `(usuario_id, motivo, ref)` si `ref` está presente (ej. no otorgar dos
  veces por la misma `partida_id` si el cliente reintenta el cierre).

---

## 7. Frontend

- **Nav/dashboard**: saldo de doblones visible junto al avatar (mismo
  lugar donde hoy está `dash-user`), con un ícono nuevo simple (no un
  ícono "de moneda" genérico tipo casino — algo consistente con la
  ficha, ej. un pequeño punto/pip estilizado).
- **Vista Tienda** (`src/components/TiendaView.tsx`, nueva, mismo patrón
  `view` de `App.tsx`): grid de ítems con precio, estado
  (comprado/comprable/sin saldo), botón comprar con confirmación simple
  (no modal pesado — mismo criterio de "dos clics" que ya usa
  `SalasView` para cerrar sala).
- **Equipar**: dentro de la Tienda o de un picker análogo a
  `AvatarPicker.tsx` — elegir entre lo que ya tengo, guarda en
  `opciones.skin_ficha` vía `api.putPreferencias` (ya existe, mismo
  endpoint que usa el tutorial).
- **`DominoPiece` en todos sus usos** (`GameBoard`, `PieceDemo`,
  `SnakeBoard` si aplica): recibe la skin equipada.

---

## 8. Plan de implementación (cada etapa es mergeable sola)

### Etapa 1 — Schema + lectura (`ms-usuarios`) — ✅ hecho

- [x] `ms-usuarios/src/db/pool.ts`: agregar las 4 tablas de §3
      (`billeteras`, `billetera_movimientos`, `tienda_items`,
      `inventario`), mismo patrón `CREATE TABLE IF NOT EXISTS` que ya
      usa el archivo. `usuario_id` con `ON DELETE CASCADE` en las 4 (no
      solo en `billeteras` como decía el schema original) — si no, el
      borrado real de usuario del Back Office (`DELETE /usuarios/:id`)
      rompe con violación de FK apenas alguien tenga algo en `inventario`
      o `billetera_movimientos`.
- [x] Seed a mano (INSERT directo, sin panel admin todavía — igual que
      los `segmentos` hoy) de 3 ítems `categoria='ficha'`: la skin
      `clasica` con `precio=0` (para que todo usuario nuevo la tenga sin
      comprarla — ver nota de inventario más abajo) + 2 skins pagas.
      Además, backfill idempotente (`INSERT ... SELECT ... ON CONFLICT DO
      NOTHING`) para que los usuarios que ya existían antes de esta
      migración también reciban la skin gratis, no solo las altas nuevas.
- [x] `ms-usuarios/src/routes/tienda.ts` (nuevo): `GET /tienda/items`
      (join contra `inventario` del usuario del token → `ya_comprado`),
      `GET /usuarios/:id/billetera` (crea la fila on-demand si no existe,
      `INSERT ... ON CONFLICT DO NOTHING` antes de leer), `GET
      /usuarios/:id/inventario`.
- [x] Al crear un usuario nuevo (registro, Google, invitado —
      `routes/usuarios.ts`, las 3 altas, no solo el registro), insertar
      también su fila en `inventario` para el ítem `clasica` vía
      `otorgarSkinClasica()` — así "lo que tengo" siempre incluye la skin
      por defecto sin caso especial en el frontend.
- [x] Gateway: `api-integracion/src/routes/tienda.ts` — `GET /tienda/items`,
      `GET /billetera`, `GET /inventario`, todas con `verifyToken` (mismo
      patrón que `PATCH /auth/avatar`).
- [x] `src/api.ts`: tipos (`TiendaItem`, `Billetera`, `InventarioItem`) +
      `api.tienda.items()`, `api.tienda.inventario()`,
      `api.billetera.saldo()`.

Verificado en Docker local: migración corre limpia, catálogo devuelve los
3 ítems sembrados, usuario existente recibe `clasica` por el backfill,
usuario nuevo (registro) la recibe automático al verificar el email,
billetera se crea on-demand con saldo 0, y el borrado real de un usuario
con inventario ya no viola FK (cascada limpia).

### Etapa 2 — Otorgar doblones al jugar (depende de 1)

- [ ] `ms-usuarios/src/routes/interno.ts` (nuevo, no expuesto en
      gateway): `POST /interno/billetera/:usuarioId/otorgar`
      `{ monto, motivo, ref }` — transacción: `INSERT
      billetera_movimientos` + `UPDATE billeteras SET saldo = saldo +
      monto`. Idempotente si `ref` viene seteado (`UNIQUE
      (usuario_id, motivo, ref)` o `ON CONFLICT DO NOTHING` según motivo).
- [ ] `ms-salas/src/routes/juegos.ts`: en el bloque `terminada` de
      `guardarPartida` (línea ~37, junto al ELO/historial), agregar la
      llamada fire-and-forget a `/interno/billetera/.../otorgar` con el
      monto según §4 (partida completada + bonus ranked). Mismo criterio
      de "un email caído no rompe una jugada" que ya usa
      `avisarPartidaActualizada`.
- [ ] Bonus "primera partida del día": mismo endpoint, `motivo
      ='racha_diaria'`, `ref = fecha de hoy (YYYY-MM-DD)` — el `UNIQUE`
      lo vuelve automáticamente "una vez por día" sin lógica de fechas
      en el código.

### Etapa 3 — Comprar (depende de 1) — ✅ hecho

- [x] `ms-usuarios/src/routes/tienda.ts`: `POST
      /tienda/items/:id/comprar` — transacción con `SELECT ... FOR
      UPDATE` sobre la fila de `billeteras` del usuario, valida
      `saldo >= precio`, inserta `inventario` (si ya existe la fila,
      409 "ya lo tenés"), descuenta saldo, registra movimiento
      `compra_item`. `usuarioId` viaja en el body (lo resuelve el
      gateway del JWT, `ms-usuarios` no tiene noción de token).
- [x] `src/components/TiendaView.tsx` (nuevo): grid de ítems, precio,
      estado (comprado/comprable/sin saldo), botón comprar con
      confirmación de dos clics (mismo patrón que `sv-close-btn` de
      `SalasView`).
- [x] `src/App.tsx`: ruta `/tienda` (react-router, no un `view` de
      `App.tsx` como decía este plan — ese ya no es el mecanismo de
      navegación del proyecto), entrada desde el ícono de saldo del
      dashboard.
- [x] `tienda.css` (nuevo, mismo criterio de namespacing que
      `salas.css`/`landing.css`): tokens reusados de `dashboard.css`
      (`--d-bg`, `--amber`, `--teal`), nada de paleta nueva. Reusa
      además `.social-page`/`.social-body`/`.social-nav` de
      `social.css` (mismo patrón que ya comparten Amigos/Leaderboard/
      Historial vía `PageHeader`).
- [x] `Dashboard.tsx`: saldo visible junto al avatar (`.dash-saldo`),
      ícono nuevo `DoblonIcon` (mini-tile de dominó con 3 pips, no un
      ícono de moneda genérico — ver `icons.tsx`).

Verificado en Docker + navegador: catálogo muestra `Gratis`/precio/
estado por ítem, saldo insuficiente devuelve 402 y deshabilita el botón,
compra exitosa descuenta saldo y persiste en `inventario`, re-comprar el
mismo ítem da 409, ítem inexistente da 404. Confirmación de dos clics
probada en el navegador (primer clic arma "¿Comprar por N?", solo el
segundo ejecuta). Verificado en modo claro y oscuro.

**Listo para v2 (compra de doblones con dinero real, PayPal/Azul) sin
tocar este código**: el desembolso ya pasa por `billetera_movimientos`
con un campo `motivo` de texto libre — cuando exista un webhook de pago,
solo agrega una fila con `motivo='compra_doblones'` + `UPDATE saldo`
dentro de la misma transacción (mismo patrón que ya usa `comprar`, nada
de rediseño de schema). No se implementó ningún botón de "comprar
doblones" en el frontend todavía — sería UI prometiendo un flujo que no
existe.

### Etapa 4 — Skins de ficha y tablero en juego (depende de 3) — ✅ hecho

**Cambio de alcance respecto al plan original**: la Etapa 5/v2 tenía
"tableros" reservado para después de cerrar 1-4. Se adelantó a esta
etapa (decisión explícita del usuario, no un despiste) — mismo mecanismo
que ficha, mismo esfuerzo, y da un catálogo con más variedad desde ya.
Lo que sigue siendo v2 real: cosméticos de rango, compra con dinero real,
panel de catálogo en el BO (ver Etapa 5 abajo).

- [x] `src/skins.ts` (nuevo): un solo lugar para `SkinFicha`/`SkinTablero`,
      `skinFichaDe()`/`skinTableroDe()` (parsean `opciones.skin_ficha`/
      `skin_tablero`, con fallback a `'clasica'`/`'clasico'`), y los mapas
      de color (`SKIN_FICHA_FILL`, `SKIN_TABLERO_PREVIEW`) — evita repetir
      el parseo en cada componente que necesita saber qué tiene equipado
      el jugador.
- [x] `DominoPiece.tsx`: `fillFace` fijo → `SKIN_FICHA_FILL[skin]`, prop
      `skin?: SkinFicha`. Las 3 skins se mantienen en la misma familia de
      luminancia "casi blanco" que la clásica a propósito — así
      `PIP_COLOR` (ya certificado con buen contraste sobre blanco) sigue
      siendo legible sin recalcular contraste pip por pip.
- [x] `GameBoard.tsx`: recibe `config: UserConfig` (antes no lo recibía
      en absoluto), lee `skinFichaDe`/`skinTableroDe` una vez, pasa `skin`
      a la mano y a `ManoOverlay` (fichas reveladas), y `data-tablero` al
      `.game-shell` raíz. `SnakeBoard.tsx` recibe `skinFicha` y lo aplica
      a las fichas del tablero y a las 2 fantasma/ghost. `PieceDemo.tsx`
      recibe `skin` opcional (lee la sesión si existe, `'clasica'` si no
      hay sesión — la ruta sigue siendo pública).
- [x] `game.css`: `.game-shell[data-tablero="roble"|"esmeralda"]` +
      variante `:root.light` de cada una — mismo mecanismo que preveía
      el plan original (variables CSS, no assets rasterizados).
      `'clasico'` no tiene selector propio (usa el `.game-shell` base).
- [x] Picker de equipar: dentro de `TiendaView` (no un modal aparte) —
      cada ítem ya comprado muestra "Equipar"/"Equipada" en vez del botón
      de compra; `api.putPreferencias({ opciones: { ...actual, skin_ficha
      | skin_tablero: clave } })`, mismo merge no-destructivo que ya usa
      `guardarOpcionesTutorial` en `App.tsx`.
- [x] Backend: `otorgarSkinClasica` → `otorgarItemsGratis` (generalizado
      a "todo ítem con precio=0", no solo la ficha `clasica` — así el
      tablero `clasico` se otorga solo, sin tocar la función de nuevo el
      día que se agregue otro ítem gratis). Backfill de `db/pool.ts`
      actualizado al mismo criterio.
- [x] Dashboard/nav: saldo visible junto a `dash-user` (ya hecho en
      Etapa 3).

Verificado en Docker + navegador, partida real 1v1 entre dos cuentas:
equipar Ámbar (ficha) + Esmeralda (tablero) desde la Tienda, entrar a una
sala, jugar la apertura — `data-tablero="esmeralda"` en el `.game-shell`
real (`--g-bg: #071a16`), ficha de la mano y ficha ya puesta en el
tablero ambas con `fill="#fdf3e2"` (ámbar), estados `disabled`/`faceDown`
siguen ignorando la skin (gris/dorso oscuro) como estaba diseñado.
`PieceDemo` (Ver fichas) también muestra la skin equipada.

### Etapa 4.1 — Panel de catálogo en 2mino-BO (adelantado desde v2) — ✅ hecho

**Otro cambio de alcance explícito**: v1 preveía sembrar el catálogo a
mano por SQL (§10 de este plan decía exactamente eso). El usuario pidió
adelantar el panel de administración — con dos requisitos: (1) tiene que
poder editarse el precio/disponibilidad de cada ítem, y (2) tiene que
pasar por una API real, nunca por un llamado directo a la base desde el
BO (eso rompería el modelo de seguridad — todo pasa por JWT+gateway) ni
por un microservicio nuevo (mismo razonamiento del §2: un puñado de
tablas chicas no justifica otro contenedor).

- [x] `ms-usuarios/src/routes/tienda.ts`: `GET /tienda/items?todos=true`
      (catálogo completo, incluso `disponible=false`, sin `ya_comprado`
      — mismo criterio que `GET /segmentos?incluirInactivos=true`),
      `POST /tienda/items` (crear), `PATCH /tienda/items/:id` (editar
      `nombre`/`precio`/`disponible`/`orden` — nunca `categoria`/`clave`,
      esas dos están acopladas al código del cliente que las lee por
      clave: `src/skins.ts`, `game.css`).
- [x] `api-integracion/src/routes/admin.ts`: `GET/POST /admin/tienda/items`
      + `PATCH /admin/tienda/items/:id`, mismo patrón `requireAdmin` +
      proxy a `ms-usuarios` que ya usan torneos/segmentos/usuarios acá.
- [x] `2mino-BO`: vista nueva "Tienda" (`views/TiendaView.tsx`) — tabla
      con precio editable inline + botón Guardar (mismo patrón que
      `ReglasJuegoView`) y Toggle de disponible (mismo patrón que
      `SegmentosView`), más un formulario de alta de ítem nuevo.

Verificado en Docker + BO real: editar precio se refleja de inmediato en
`GET /tienda/items` del jugador; togglear disponible saca/mete el ítem
de la tienda pública; crear un ítem nuevo aparece en la lista; sin token
admin da 403 (probado con la cuenta `tester`, segmento `jugador`).
Nota tal como quedó documentada en la propia vista del BO: crear un ítem
nuevo lo suma al catálogo/precio, pero que se vea distinto de verdad en
partida (una skin nueva, no solo una fila más) sigue necesitando código
del cliente — esto no genera assets ni mapas de color solos.

**Corrección sobre la marcha**: el catálogo (Tienda) y el inventario
*de un usuario* (qué posee + su saldo) son cosas distintas — el primer
pase de esta etapa solo cubrió el catálogo. Agregado después, mismo
patrón admin+JWT:
- [x] `ms-usuarios/src/routes/tienda.ts`: `POST
      /usuarios/:id/billetera/ajuste` — ajuste manual de saldo (motivo
      `ajuste_admin`, ya anticipado desde la Etapa 1), transacción con
      `FOR UPDATE`, nunca deja el saldo negativo.
- [x] `api-integracion/src/routes/admin.ts`: `GET
      /admin/usuarios/:id/inventario`, `GET
      /admin/usuarios/:id/billetera`, `POST
      /admin/usuarios/:id/ajuste-saldo` — reusan los endpoints internos
      de `ms-usuarios` que ya existían para el propio jugador (Etapa 1),
      solo que por `:id` en vez de resolver del JWT.
- [x] `2mino-BO`: sección "Cosméticos" dentro de
      `UsuarioDetalleModal.tsx` (el modal que ya se abre al hacer click
      en un usuario en `UsuariosView`) — saldo, tabla de lo que posee, y
      un ajuste rápido de saldo (+/- doblones) para dar saldo de prueba
      a una cuenta sin tocar SQL.

Verificado en BO real: abrir el detalle de `tester` muestra su saldo e
inventario reales; ajustar +25 se refleja al toque sin recargar la
página.

### Etapa 5 — v2, aparte (no arrancar sin cerrar 1-4)

Cosméticos que se desbloquean por rango en vez de comprarse (Oro/
Platino/Diamante) · compra de doblones con dinero real (reusa `azul.ts`/
PayPal de `PLAN_TORNEOS.md` cuando exista — el desembolso ya pasa por
`billetera_movimientos` con `motivo` libre, ver nota de la Etapa 3, así
que esto es agregar un endpoint/webhook, no rediseñar el schema) ·
marcos de avatar, avatares nuevos vendibles · otorgar doblones al jugar
(Etapa 2 del plan original — explícitamente pospuesta por el usuario,
no implementada todavía).

---

## 9. Verificación por etapa

- **1**: `GET /tienda/items` devuelve el catálogo sembrado; usuario
  nuevo tiene `saldo=0` automático (verificar el trigger/default, no un
  paso manual de "crear billetera" que se pueda olvidar — más simple:
  crearla on-demand en el primer `GET /billetera` si no existe, con
  `INSERT ... ON CONFLICT DO NOTHING`).
- **2**: jugar una partida completa (casual y ranked) y confirmar el
  monto correcto en `billetera_movimientos` + saldo actualizado; cerrar
  la misma partida dos veces (reintento de red) no otorga doblones dos
  veces.
- **3**: comprar con saldo justo funciona; comprar con saldo insuficiente
  da error claro; comprar el mismo ítem dos veces no duplica fila de
  inventario ni cobra dos veces (test de concurrencia: dos compras
  simultáneas del mismo ítem con saldo para una sola).
- **4**: equipar una skin y verificar que aparece igual en mano, tablero
  y `PieceDemo`; contraste de pips verificado en la skin nueva (no solo
  la clásica).

---

## 10. Fuera de alcance v1

Cofres/loot boxes (nunca, por diseño — no es "todavía no", es "no") ·
avatares/marcos comprables · compra con dinero real · cosméticos de
temporada con expiración · regalar/transferir ítems entre jugadores ·
reembolso de compras de tienda.

(Tableros comprables y el panel de administración de catálogo en
`2mino-BO` estaban acá originalmente — ambos se adelantaron a la Etapa 4,
ver más arriba.)

---

*Basado en código verificado: `DominoPiece.tsx` (constantes de dibujo,
sin assets), `avatars.ts`/`AvatarPicker.tsx` (catálogo ya existente, sin
noción de propiedad), `ranks.ts` (mismo patrón de glob de assets),
`App.tsx` (`opciones` como bucket de preferencias, `necesitaOnboarding`),
`ms-usuarios/src/db/pool.ts` (convención de schema: UUID pk, `IF NOT
EXISTS`, `ALTER TABLE` incremental), patrón de endpoint interno de
`ms-social/routes/interno.ts` y de `PLAN_TORNEOS.md` §1.*
