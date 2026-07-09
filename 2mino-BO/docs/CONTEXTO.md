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

- `src/views/LoginView.tsx` — login admin. **Real**: `POST /auth/login`
  contra `api-integracion`, rechaza cuentas cuyo `segmento !== 'admin'`.
- `src/views/FeatureFlagsView.tsx` — listar/activar-desactivar flags.
  **Real**: `GET/PATCH /admin/feature-flags[/:clave]` (proxy directo a
  `ms-frontend-landing`, protegido por `requireAdmin()`).
- `src/views/UsuariosView.tsx` — buscar/listar usuarios, cambiar
  segmento, banear/reactivar. **Todavía mock** (paso 3 pendiente).
- `src/views/SegmentosView.tsx` — listar/crear/activar-desactivar
  segmentos. **Todavía mock** (paso 3 pendiente).
- `src/lib/api.ts` — mitad real, mitad mock: login/feature-flags pegan a
  `api-integracion` (`VITE_API_URL`, default `http://localhost:3000`);
  usuarios/segmentos siguen contra `localStorage` hasta que exista el
  backend correspondiente. Las funciones mock quedan claramente
  delimitadas al final del archivo.
- `src/lib/types.ts` — `FeatureFlag` ya matchea la forma real de
  `landing_config` (`clave`, `valor`, `descripcion`, `habilitado`,
  `updated_at` — sin `etiqueta`, esa columna no existe).
- Recorrido reciente en git log: se probó empaquetar como app de
  escritorio (Electron), se revirtió (`DESIGN.md` §14 documenta por qué:
  overhead de mantener un segundo target de build para un panel de uso
  interno), y quedó como **PWA instalable** (`vite-plugin-pwa`,
  `scripts/serve-pwa.cjs`) que corre localmente.

**Para promover una cuenta a `admin` hoy** (no hay UI todavía, paso 3):

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

Para que login/feature-flags funcionen de verdad hace falta el stack de
`2mino` corriendo (`docker compose up -d` en la raíz) — `api-integracion`
en `localhost:3000`. Usuarios/segmentos no lo necesitan (mock puro).

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
3. **Siguiente**: Usuarios y segmentos (CRUD + ban) — necesita
   `GET /admin/usuarios` nuevo en `ms-usuarios` (hoy no hay listado, solo
   `GET /usuarios/:id`), más `PATCH /admin/usuarios/:id/segmento` y
   `PATCH /admin/usuarios/:id/estado` (ban, requiere columna
   `usuarios.activo`).
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
