# Contexto del proyecto — Back Office de 2mino

`2mino-BO` es una carpeta más del monorepo `2mino` (mismo repo git, mismo
historial de commits desde acá en adelante) — antes era un repo git
separado, pero se fusionó a propósito **sin conservar ese historial**
(sigue disponible en `github.com/franciscoapvst-hue/2mino-BO` si hiciera
falta consultarlo). El motivo del cambio: la mayoría del trabajo real que
falta (segmento `admin`, `requireAdmin()`, endpoints `/admin/*`) toca a
la vez `api-integracion`/`ms-usuarios` Y el panel — con dos repos
separados eso eran siempre dos PRs/pushes por feature, sin forma de
commitear el cambio como una unidad atómica. Tiene su propio
`package.json`/Vite/`node_modules` (no comparte build con el resto del
monorepo — mismo patrón que `ms-usuarios`, `ms-salas`, etc., cada uno con
su propio `package.json`), pero el Back Office **depende** de la API del
juego (nunca toca la base de datos directo).

## Qué es esto

Panel de administración interno (uso único: el dueño del proyecto) para
gestionar usuarios, segmentos, feature flags, torneos y reglas del juego
— todo a través de los microservicios que ya existen en `2mino`
(`api-integracion`, `ms-usuarios`, `ms-salas`, `ms-frontend-landing`).
Nunca lo ve un jugador. Ver [`../PRODUCT.md`](../PRODUCT.md) (propósito,
usuario único, brand personality) y [`../DESIGN.md`](../DESIGN.md)
(paleta OKLCH, tipografía, componentes — estética "torre de control",
deliberadamente opuesta al fieltro/ámbar del juego).

El diseño completo de casos de uso, endpoints nuevos y schema de DB vive
en **`../docs/CASOS_DE_USO_BACKOFFICE.md`** (en el OTRO repo, `2mino`, un
nivel arriba) — es el documento de referencia para todo lo que falta
construir del lado de backend. No confundir con `../docs/BUGS.md`, que
son bugs del juego en sí, sin relación con el Back Office.

## Estado actual

**Cero mock — todo el panel habla contra el backend real de `2mino`.**

- `src/lib/env.ts` + `AmbienteSwitcher` — selector Dev/QA/Prod, visible
  en el login y en el nav. La URL activa vive en `localStorage`, no en
  build-time — cambiar de ambiente desloguea y recarga (un JWT de un
  ambiente no sirve en otro). Dev por default `localhost:3000`; Prod
  por default `localhost:3001` (túnel SSH al VPS en un puerto distinto
  al de dev, para no chocar — ver `VITE_API_URL_PROD` en `.env.example`
  y §10.1 más abajo). QA sin URL configurada = botón deshabilitado.
- `src/views/LoginView.tsx` — `POST /auth/login`, rechaza cuentas cuyo
  `segmento !== 'admin'`.
- `src/views/FeatureFlagsView.tsx` — `GET/PATCH /admin/feature-flags[/:clave]`
  (proxy directo a `ms-frontend-landing`).
- `src/views/UsuariosView.tsx` — `GET /admin/usuarios?q=`, `PATCH
  /admin/usuarios/:id/segmento`, `PATCH /admin/usuarios/:id/estado`
  (ban/reactivar). Sin columna ELO en la tabla — click en el username
  abre `UsuarioDetalleModal` (`GET /admin/usuarios/:id`), que sí trae
  perfil + segmento + ELO/partidas/ganadas en una sola llamada. Esto
  cruza tablas de `ms-usuarios` (usuarios/segmentos) con
  `ranked_ratings` de `ms-salas` (misma base física) vía la función
  PL/pgSQL `usuario_completo()` en `ms-usuarios/src/db/pool.ts` — se
  usó una función y no una VIEW a propósito: PL/pgSQL no valida que las
  tablas referenciadas existan al crearse (solo al invocarse), lo que
  evita que la migración de `ms-usuarios` falle si corre antes de que
  `ms-salas` haya creado `ranked_ratings` (el orden de arranque entre
  contenedores no está garantizado).
- `src/views/SegmentosView.tsx` — `GET/POST /admin/segmentos`, `PATCH
  /admin/segmentos/:id/estado`.
- `src/lib/api.ts` — un solo `adminFetch()` autenticado para todo
  `/admin/*`; mapea el snake_case de `ms-usuarios` (`segmento_id`) al
  camelCase que ya esperaban las vistas (`segmentoId`), para no tocarlas.
- `src/lib/types.ts` — `FeatureFlag`/`Usuario` ya matchean la forma real
  de sus tablas (`FeatureFlag` sin `etiqueta`, no existe esa columna en
  `landing_config`; `Usuario` sin `elo`/`creadoEn`, no se muestran hoy).
- Recorrido reciente en git log: se probó empaquetar como app de
  escritorio (Electron), se revirtió (`DESIGN.md` §14 documenta por qué:
  overhead de mantener un segundo target de build para un panel de uso
  interno), y quedó como **PWA instalable** (`vite-plugin-pwa`,
  `scripts/serve-pwa.cjs`) que corre localmente — con el service worker
  **desactivado en dev** (`devOptions.enabled: false`): activarlo causó
  confusión real (bundle viejo cacheado sirviéndose aunque el código en
  disco ya hubiera cambiado). Para probar el SW de verdad: `npm run
  build && npm run serve:pwa` (o `preview`), nunca en `npm run dev`.

**Para promover una cuenta a `admin`**: ya se puede hacer desde la propia
UI (Usuarios → cambiar segmento a `admin`) una vez que exista al menos
un admin. Para la primera cuenta (bootstrap), a mano:

```sql
UPDATE usuarios SET segmento_id = (SELECT id FROM segmentos WHERE nombre='admin')
WHERE username = 'tu-usuario';
```

**Dos bugs reales encontrados y arreglados al conectar el primer
endpoint real** (dejarlos anotados por si aparecen de nuevo en otro
endpoint nuevo):
- El CORS del gateway (`api-integracion/src/index.ts`) no incluía
  `PATCH` en `methods` — rompía el toggle silenciosamente desde el
  navegador (bloqueado en el preflight; `curl` no lo detecta porque no
  hace preflight).
- `UserSchema` de `/auth/*` (`api-integracion/src/routes/auth.ts`) no
  declaraba `segmento` — Fastify serializa la respuesta según el schema,
  así que aunque el JWT sí llevara el segmento, el objeto `user` de la
  respuesta HTTP lo perdía.

### Cómo correrlo

```
npm run dev          # vite dev, localhost:5174
npm run build         # tsc -b && vite build
npm run serve:pwa     # sirve el build de la PWA
npm run lint          # oxlint
```

Para que cualquier vista funcione hace falta el stack de `2mino`
corriendo (`docker compose up -d` en la raíz) — `api-integracion` en
`localhost:3000`. Ya no hay ninguna vista que funcione sin backend.

**Se mantiene local, nunca se despliega al VPS.** El pipeline (`../Jenkinsfile`)
detecta si un push solo tocó `2mino-BO/` y en ese caso salta type-check,
tests, Sonar y el deploy — no tiene sentido correr nada de eso para un
panel que no se sube a ningún lado. Además, `../.dockerignore` excluye
esta carpeta para que no infle el build context de la imagen del
frontend. Si en algún momento esto cambia (se decide desplegarlo), hay
que revisar ambos archivos.

## Próximos pasos (orden ya fijado en `CASOS_DE_USO_BACKOFFICE.md` §9)

1. ✅ Segmento `admin` + `signToken` con `segmento` + `requireAdmin()` en
   `api-integracion`.
2. ✅ Feature flags reales (`GET/PATCH /admin/feature-flags`).
3. ✅ Usuarios y segmentos reales (CRUD + ban, `usuarios.activo`).
4. **Siguiente**: Reglas del juego, torneos, analítica, CRM/pagos — ver
   el documento completo para el detalle de cada uno (schema SQL
   incluido). Reglas del juego es lo más chico de este grupo (una tabla
   `reglas_juego`, mismo patrón clave→valor que `landing_config`); torneos
   es lo más grande y depende de que esto ya esté sólido.

## Conexión a producción

Ver `CASOS_DE_USO_BACKOFFICE.md` §10.1: el panel **no expone
`api-integracion` a internet** — en el VPS solo está publicado en
`127.0.0.1:3000` (loopback, `docker-compose.yml` raíz), nunca la interfaz
pública. Se llega por túnel SSH, pero no hace falta correrlo a mano:

```
2mino-BO/conectar-prod.bat
```

Doble click, deja la ventana abierta mientras uses "Prod" en el panel.
Por dentro corre `scripts/tunnel-prod.cjs` (Node + `ssh2`), que lee la
clave root de `../CREDENCIALES.md` y abre `localhost:3001 ->
127.0.0.1:3000` en el VPS — sin pedir contraseña ni requerir el cliente
`ssh` de Windows. El selector de ambiente (`src/lib/env.ts`) ya apunta
"Prod" a `localhost:3001` (puerto distinto a Dev a propósito, para poder
tener el Docker local Y el túnel activos a la vez).

**Si el login con "Prod" da error de red**: lo más probable es que el
túnel no esté corriendo — abrí `conectar-prod.bat` primero.

Las credenciales del VPS (SSH, Postgres, JWT secrets, etc.) **no viven en
este repo** — están en `../CREDENCIALES.md` (gitignoreado, archivo local
en el repo del juego, un nivel arriba).

## Cosas a NO olvidar

- El Back Office **nunca** toca Postgres directo — siempre pasa por los
  microservicios existentes vía `api-integracion`, igual que el frontend
  de jugadores (`2mino/src`).
- Identidad visual deliberadamente distinta a la del juego (ver
  anti-references en `PRODUCT.md`): nada de fieltro/ámbar/calidez, es
  denso y "clínico" a propósito.
- Cuando se conecte el backend real, solo debería cambiar
  `src/lib/api.ts` (y quizás `types.ts` si el contrato real difiere del
  mock) — las vistas no deberían necesitar tocarse si las firmas se
  mantienen.
