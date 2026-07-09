# Design

Mood: **torre de control, madrugada** — luz fría de instrumentos sobre
fondo casi negro, silencioso, preciso. Nada de calidez: el panel es una
consola de operaciones, no una experiencia de marca.

## Color strategy

Restrained. Neutros casi puros + un único acento saturado (primary) para
acciones/foco, más un acento frío secundario (accent) para estados
"activo"/destacado. Colores semánticos separados para éxito/peligro/aviso
— en un panel de datos el color de estado es información, no decoración.

## Palette (OKLCH)

```css
:root {
  /* Neutros — casi negro puro, sin tinte cálido */
  --bg:          oklch(0.100 0.000 0);
  --bg-raised:   oklch(0.140 0.006 241.7);
  --surface:     oklch(0.175 0.008 241.7);
  --surface-hi:  oklch(0.220 0.010 241.7);
  --border:      oklch(0.290 0.012 241.7);
  --ink:         oklch(0.930 0.004 241.7);
  --muted:       oklch(0.640 0.012 241.7);
  --muted-dim:   oklch(0.460 0.010 241.7);

  /* Marca — cobalto de la torre de control */
  --primary:      oklch(0.578 0.130 241.7);
  --primary-hi:   oklch(0.660 0.140 241.7);
  --primary-ink:  oklch(0.980 0.004 241.7); /* texto sobre primary */

  /* Acento frío secundario — luz de instrumento, estados "activo" */
  --accent:       oklch(0.760 0.130 195);
  --accent-ink:   oklch(0.120 0.010 195);

  /* Semánticos — estado, no decoración */
  --success:      oklch(0.650 0.150 150);
  --success-ink:  oklch(0.980 0.010 150);
  --danger:       oklch(0.600 0.200 25);
  --danger-ink:   oklch(0.980 0.010 25);
  --warning:      oklch(0.760 0.150 80);
  --warning-ink:  oklch(0.150 0.010 80);
}
```

Light mode existe solo como fallback accesible (`prefers-color-scheme:
light` invertido con los mismos roles); el panel es dark-first por
diseño, no una adaptación.

## Typography

Contraste geométrico + monoespaciado: **IBM Plex Sans** para chrome de UI
(nav, botones, labels) + **IBM Plex Mono** para todo dato tabular (IDs,
ELO, fechas, JSON de config) — el monoespaciado es lo que hace que una
tabla de números se pueda escanear en columna. Nunca dos sans genéricas
compitiendo.

- H1 (título de sección): Plex Sans 600, clamp(1.375rem, 2vw, 1.75rem)
- H2 (subsección): Plex Sans 600, 1.125rem
- Body: Plex Sans 400, 0.9375rem
- Tabular/código: Plex Mono 400/500, 0.8125rem, `font-variant-numeric:
  tabular-nums`

## Layout

- Shell: nav lateral fija angosta (íconos + label) + contenido con
  scroll propio — nunca la página entera scrollea, las tablas sí.
  z-scale: `nav(10) < content(0) < dropdown(100) < modal-backdrop(200)
  < modal(210) < toast(300)`.
- Tablas: densidad alta, fila de 40px, hover con `--surface-hi`, no
  zebra-stripe (compite con el monoespaciado).
- Formularios: una columna, labels arriba del input, nunca inline a la
  derecha (rompe el escaneo vertical).
- Sin cards anidadas. Un panel = un `--surface` con borde `--border`,
  nunca card-dentro-de-card.

## Components

- **Toggle (feature flag)**: pill de 36×20px, thumb circular; `off` en
  `--surface-hi`/`--border`, `on` en `--accent` con thumb `--accent-ink`.
  Estado siempre visible por color + posición, nunca solo por texto.
- **Badge de estado** (activo/baneado/pendiente/completo): pill sólido,
  texto según regla de contraste (blanco sobre saturado, oscuro sobre
  pálido) — `success`/`danger`/`warning`/`muted` mapeados 1:1 a estados
  de datos, nunca decorativos.
- **Botón primario**: `--primary` bg, `--primary-ink` texto, radio 8px.
  **Botón peligroso** (banear, eliminar): `--danger` bg, siempre con
  modal de confirmación — nunca un solo clic ejecuta una acción
  destructiva.
- **Modal de confirmación**: `--bg-raised` + backdrop `oklch(0 0 0 /
  0.6)`, centrado, foco atrapado, cierra con Esc.
- **Input de búsqueda/filtro**: `--surface` bg, borde `--border`, focus
  ring `--primary` 2px.

## Motion

Mínimo e intencional: transiciones de 120-160ms `ease-out` en
hover/focus/toggle, sin rebote. Modal entra con fade + scale sutil
(0.98→1). Todo respeta `prefers-reduced-motion: reduce` (crossfade
instantáneo). Nada de motion decorativo — es una herramienta, no una
demo.
