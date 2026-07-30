# SEO

Cómo está armado el SEO de 2mino, qué hay que hacer después de deployar, y
cómo agregar contenido nuevo sin romperlo.

Punto de partida (2026-07-30): lo único que veía un buscador era
`<title>2mino</title>` y un `<body>` con el div vacío de la SPA. Sin
description, sin Open Graph, sin datos estructurados, y `/sitemap.xml`
devolvía 200 con el `index.html` — para un crawler, peor que un 404.

---

## El problema de fondo: es una SPA

El HTML que sirve nginx tiene el `<body>` vacío; todo se renderiza en el
cliente. Google ejecuta JavaScript y termina viendo la página, pero lo hace
más tarde y con menos peso; **el resto de los crawlers no ejecutan nada**.

La solución no fue migrar a un framework con SSR (invasivo y arriesgado), sino
atacar las dos capas por separado:

| Capa | Qué la cubre |
|---|---|
| `<head>` (title, description, OG, JSON-LD) | Estático en `index.html` |
| Contenido de la raíz | Bloque `<noscript>` de `index.html` |
| Contenido de las páginas públicas | **Prerender** en tiempo de build |

## Prerender (SSG sin navegador)

`npm run build` corre, después del build del cliente:

1. `vite build --config vite.config.prerender.ts` → compila `src/prerender.tsx`
   a un bundle de Node (`dist-prerender/prerender.mjs`).
2. `node scripts/prerender.mjs` → renderiza cada página, la inyecta en el
   cascarón de `dist/index.html` y escribe `dist/<ruta>.html`.

**Sin Puppeteer/Chromium a propósito.** El VPS recompila las imágenes él mismo
en cada deploy (ver `DEPLOY.md`), y un navegador headless ahí competiría por
CPU y RAM con el tráfico real. Alcanza `renderToStaticMarkup` porque las vistas
públicas no dependen del navegador.

**Por qué se pueden renderizar sueltas:** ninguna usa el contexto `useApp()` —
solo props y `useNavigate`. Por eso van dentro de un `StaticRouter` sin montar
`<App/>`, que sí rompería en Node: `App.tsx` lee `localStorage` en un
inicializador de `useState`, o sea **durante el render**.

**Se escribe `<ruta>.html`, no `<ruta>/index.html`.** Con el patrón de
directorio, nginx responde 301 agregando la barra final, y ahí la URL servida
deja de coincidir con su `<link rel="canonical">` (que apunta sin barra):
señal contradictoria para el buscador y un redirect de más en cada link
interno. Con `try_files $uri $uri.html …` responde 200 directo.

**La raíz no se prerenderiza.** `dist/index.html` es el fallback de *todas* las
rutas, incluidas las privadas; inyectarle el landing haría que un usuario
logueado entrando a `/home` viera ese contenido un instante antes de que React
lo reemplace. Para `/` vale el `<noscript>`.

## Fuente única de verdad

Los títulos y descripciones viven **solo** en `src/seo.ts` (`META_POR_RUTA`),
y los consumen los dos lados:

- `src/prerender.tsx` → los escribe en el `<head>` del HTML estático.
- `src/App.tsx` → actualiza el `<title>` al navegar dentro de la SPA (el
  documento no se recarga, así que si no, quedaría el de la página anterior).

Si cambia un título, cambia en los dos lugares a la vez. **No dupliques esos
textos en otro archivo.**

## Agregar una página pública nueva

1. Sumar su `title`/`description` a `META_POR_RUTA` en `src/seo.ts`.
2. Sumar la ruta y su componente a `ELEMENTO_POR_RUTA` en `src/prerender.tsx`.
   Solo sirve si el componente no depende de `useApp()` ni del navegador
   durante el render.
3. Agregar la `<url>` en `public/sitemap.xml`.
4. `npm run build` y confirmar que aparece en la salida del prerender.

## Imagen social (og:image)

`public/og.png` (1200×630, ~88 kB) la genera `scripts/generar-og.mjs` con la
paleta de pips de `src/skins.ts` y las proporciones de ficha de
`DominoPiece.tsx`. **No corre en el build**: es un artefacto estable
commiteado. Para rediseñarla:

```bash
node scripts/generar-og.mjs
```

Depende de `sharp`, que hoy está en `node_modules` de forma transitiva. Si
falta: `npm i -D sharp`, regenerar, y listo — no se fija como dependencia por
ser una herramienta de un solo uso con binarios nativos pesados.

Importa sobre todo por los enlaces de invitación a sala privada
(`/party/:codigo`), que se comparten por WhatsApp: sin imagen llegan pelados.

---

## ⚠️ Después de deployar

### 1. Verificar el robots.txt (Cloudflare)

Cloudflare está delante de Caddy y hoy responde un `robots.txt` **gestionado
por él** (trae `Content-Signal: search=yes,ai-train=no` y bloquea los crawlers
de entrenamiento de IA). Permite buscadores, así que no molesta — pero hay que
confirmar si el `public/robots.txt` del origen se aplica o Cloudflare lo pisa:

```bash
curl https://2mino.online/robots.txt
```

Si no aparece la línea `Sitemap: https://2mino.online/sitemap.xml`, hay que
cargarla desde el panel de Cloudflare en vez del repo.

### 2. Comprobar que las páginas se sirven bien

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://2mino.online/reglas-domino-dominicano   # 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://2mino.online/piece-demo  # 301
curl -s https://2mino.online/sitemap.xml | head -3                                        # XML, no HTML
```

### 3. Google Search Console

Sin esto, Google tarda mucho más en descubrir el sitio. Es el paso que
convierte todo lo anterior en indexación real.

1. Entrar a <https://search.google.com/search-console> con la cuenta de Google
   del proyecto.
2. Agregar una propiedad. **Conviene la de tipo "Dominio"** (no "Prefijo de
   URL"): cubre `http`/`https`, con y sin `www`, y todos los subdominios de una.
   Se verifica con un registro TXT.
3. Copiar el TXT que da Search Console y cargarlo en el DNS de **Cloudflare**
   (DNS → Records → Add record → tipo TXT). Volver y confirmar la verificación;
   la propagación suele ser de minutos.
4. En **Sitemaps**, enviar: `sitemap.xml`.
5. Con **Inspección de URLs**, pedir indexación a mano de las dos páginas que
   importan al principio:
   - `https://2mino.online/`
   - `https://2mino.online/reglas-domino-dominicano`
6. A los días, revisar el informe de páginas: ahí se ve si algo quedó
   "Descubierta pero no indexada" o con canonical distinto al declarado.

**Expectativa realista:** indexar lleva días; rankear para consultas
competitivas como "dominó online gratis", **semanas o meses** y con más
contenido. Esto pone los cimientos, no da resultados inmediatos.

### 4. Bing Webmaster Tools (opcional, barato)

<https://www.bing.com/webmasters> — permite importar la propiedad desde Search
Console. Vale la pena porque Bing renderiza JavaScript bastante peor que
Google, así que es justo donde más rinde el prerender.

---

## Qué NO se hizo, a propósito

- **`aggregateRating` / reseñas en el JSON-LD**: markup que no se corresponde
  con la página está penalizado, además de ser falso.
- **Prerender del landing**: ver arriba (la raíz es el fallback de todas las
  rutas).
- **Contenido nuevo**: el eje elegido es el genérico `dominó online gratis`,
  que es competitivo. Los cimientos ya están; para rankear ahí hace falta
  **profundidad de contenido** (guías, artículos), y conviene escribirla
  *dentro* de la app para que el prerender la publique sola, en vez de páginas
  HTML sueltas fuera de la SPA que habría que mantener aparte.
