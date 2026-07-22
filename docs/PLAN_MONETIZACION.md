# Plan — Monetización y cumplimiento: anuncios + legal/footer/tiendas

**Sesión 5** · agrupa los puntos 7 y 9. Se apoya en el doc existente
`docs/Recomendaciones para la Aprobacion.md`.

## Contexto

La app está **cerca de la aprobación** (AdSense / tiendas) y el usuario quiere empezar a
**probar cómo se verían los anuncios** (punto 7) y agregar el **footer con soporte,
cumplimiento, privacidad y links a las tiendas** (punto 9). Ambos son "readiness de
aprobación", por eso van juntos.

Hoy ya existe `src/components/AdSlot.tsx` (AdSense, no-op sin `VITE_ADSENSE_CLIENT_ID`),
usado en dashboard y pantallas de espera. No hay footer legal.

## Alcance

**Sí (punto 7 — anuncios):**
- **Auditar qué falta para AdSense** y dejarlo listo para probar:
  - `VITE_ADSENSE_CLIENT_ID` + los `data-ad-slot` por ubicación (hoy vienen de env
    `VITE_ADSENSE_SLOT_*`). Documentar cuáles faltan.
  - El script de AdSense en `index.html` (verificar que esté y con el client id).
  - `ads.txt` en la raíz del sitio servida por nginx (requisito de AdSense).
  - Política de privacidad enlazada (requisito) — la provee el punto 9.
  - Modo **placeholder** para desarrollo: mostrar un recuadro "Publicidad (demo)" con el
    tamaño real del slot cuando no hay client id, para ver cómo se verían **sin** cuenta
    aprobada (hoy `AdSlot` no renderiza nada sin client id — sumar un flag
    `VITE_ADS_PLACEHOLDER=true`).
  - Revisar **dónde** van los ads (nunca durante una partida activa — ya es la regla) y
    que no rompan el layout de escritorio nuevo (S1).
- **No** integrar rewarded video acá (eso es de la economía) — solo display.

**Sí (punto 9 — footer legal):**
- **Footer** (aparece al bajar) con: contacto/soporte, cumplimiento, **política de
  privacidad**, términos, y **links a Google Play / App Store** (placeholders hasta
  publicar).
- Páginas/enlaces de **privacidad** y **términos** (contenido base, ruta propia o
  documento enlazado). La de privacidad es requisito de AdSense y de las tiendas.

**No:**
- Cobros/compra de doblones · SDK de tiendas · analytics avanzado.

## Dónde vive

- **Frontend**:
  - `src/components/AdSlot.tsx` — sumar el modo placeholder (`VITE_ADS_PLACEHOLDER`).
  - `src/components/Footer.tsx` (nuevo) — soporte, legal, stores; se muestra al pie del
    dashboard/landing.
  - `src/components/legal/PrivacidadView.tsx` / `TerminosView.tsx` (nuevos) + rutas
    `/privacidad`, `/terminos` en `App.tsx`.
  - `index.html` — verificar el script de AdSense.
- **nginx** (`nginx.conf`) — servir `ads.txt` (y `robots.txt` si falta) desde la raíz.
- **Contenido**: redactar privacidad/términos (base; revisión legal aparte).

## Etapas

1. **Auditoría AdSense**: checklist de qué falta (client id, slots, script, ads.txt,
   privacidad) — entregable corto, sin cambios de código todavía.
2. **Placeholder de ads** (`AdSlot` con `VITE_ADS_PLACEHOLDER`) para ver ubicaciones/
   tamaños en dev sin cuenta aprobada.
3. **Footer + páginas legales** (privacidad/términos, links a stores).
4. **`ads.txt`** en nginx + verificar el script en `index.html`.

## Verificación

Con `VITE_ADS_PLACEHOLDER=true`, se ven los recuadros de ad en sus ubicaciones sin romper
el layout (ni aparecer en partida activa). `curl http://localhost/ads.txt` → 200. El
footer muestra soporte/privacidad/términos/stores; las rutas `/privacidad` y `/terminos`
cargan. Checklist de AdSense revisado contra
`docs/Recomendaciones para la Aprobacion.md`.

## Fuera de alcance

Rewarded video (economía) · compra de doblones con dinero · SDK nativo de tiendas ·
revisión legal profesional del contenido (se marca como pendiente).
