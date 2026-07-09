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

## Estado actual (rama `feature1.0`)

Frontend scaffolded, **sin backend real conectado todavía**:

- `src/views/LoginView.tsx` — login admin.
- `src/views/FeatureFlagsView.tsx` — listar/activar-desactivar flags.
- `src/views/UsuariosView.tsx` — buscar/listar usuarios, cambiar
  segmento, banear/reactivar.
- `src/views/SegmentosView.tsx` — listar/crear/activar-desactivar
  segmentos.
- `src/lib/api.ts` — **cliente mock**: reproduce el contrato de
  `CASOS_DE_USO_BACKOFFICE.md` (§2 login, §3 usuarios, §4 segmentos, §5
  feature flags) contra `localStorage`/`sessionStorage`, no contra
  `api-integracion`. Es el único archivo a reemplazar cuando el backend
  real exista — las vistas ya consumen sus firmas de función, no hacen
  `fetch` directo.
- `src/lib/types.ts` — tipos (`Segmento`, `Usuario`, `FeatureFlag`,
  `AdminSession`) — deben mantenerse en sync con lo que devuelva el
  backend real cuando se conecte.
- Recorrido reciente en git log: se probó empaquetar como app de
  escritorio (Electron), se revirtió (`DESIGN.md` §14 documenta por qué:
  overhead de mantener un segundo target de build para un panel de uso
  interno), y quedó como **PWA instalable** (`vite-plugin-pwa`,
  `scripts/serve-pwa.cjs`) que corre localmente.

### Cómo correrlo

```
npm run dev          # vite dev, localhost (puerto por defecto de Vite)
npm run build         # tsc -b && vite build
npm run serve:pwa     # sirve el build de la PWA
npm run lint          # oxlint
```

No hay stack de Docker ni backend propio en este repo — todo el dato hoy
es mock local. No hace falta levantar nada de `2mino` para trabajar en UI.

**Se mantiene local, nunca se despliega al VPS.** El pipeline (`../Jenkinsfile`)
detecta si un push solo tocó `2mino-BO/` y en ese caso salta type-check,
tests, Sonar y el deploy — no tiene sentido correr nada de eso para un
panel que no se sube a ningún lado. Además, `../.dockerignore` excluye
esta carpeta para que no infle el build context de la imagen del
frontend. Si en algún momento esto cambia (se decide desplegarlo), hay
que revisar ambos archivos.

## Próximos pasos (orden ya fijado en `CASOS_DE_USO_BACKOFFICE.md` §9)

1. Segmento `admin` + `signToken` con `segmento` + `requireAdmin()` en
   `api-integracion` (repo `2mino`) — sin esto no hay manera real de
   proteger `/admin/*`.
2. Feature flags: reemplazar el mock por `GET/PATCH /admin/feature-flags`
   (proxy directo a `ms-frontend-landing`, que ya expone
   `GET /config/todas` / `PATCH /config/:clave` — el gateway solo necesita
   reenviar).
3. Usuarios y segmentos (CRUD + ban) — necesita `GET /admin/usuarios`
   nuevo en `ms-usuarios` (hoy no hay listado, solo `GET /usuarios/:id`).
4. Reglas del juego, torneos, analítica, CRM/pagos — ver el documento
   completo para el detalle de cada uno (schema SQL incluido).

## Conexión al backend real (cuando exista)

Ver `CASOS_DE_USO_BACKOFFICE.md` §10.1: el panel **no expone
`api-integracion` a internet**. Se conecta vía túnel SSH manual:

```bash
ssh -N -L 3000:127.0.0.1:3000 root@74.208.119.150
```

y `VITE_API_URL` del Back Office apunta a `http://localhost:3000` — mismo
cliente HTTP sirve para dev local (api-integracion corriendo en la
máquina) o producción (túnel hacia el VPS), sin que el panel sepa la
diferencia.

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
