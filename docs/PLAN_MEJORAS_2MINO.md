# Índice de mejoras 2mino — mapa de sesiones

Los 13 puntos de mejora pedidos, agrupados en **7 sesiones de trabajo** cohesivas.
Cada sesión tiene su propio `docs/PLAN_*.md` con contexto, alcance, dónde vive el
código, etapas mergeables y verificación.

> **Nota sobre el punto 8**: "Adjunto verás algunas de las cosas de chess.com que
> quiero replicar" — **el adjunto no llegó / no es visible.** Los planes se armaron
> con las descripciones de texto (que ya referencian chess.com con claridad). Cuando
> re-compartas las capturas, ajusto los planes que correspondan (sobre todo el de
> escritorio y el de perfil).

---

## Mapa punto → sesión

| # | Mejora | Sesión / archivo |
|---|--------|------------------|
| 1 | Disposición en PC (desaprovecha pantalla, todo above-the-fold como chess.com) | **S1** · `PLAN_ESCRITORIO.md` |
| 3 | Menú lateral en PC (amigos, tienda, fichas, tema, leaderboard) | **S1** · `PLAN_ESCRITORIO.md` |
| 13 | Botón de torneos más llamativo (banner, fecha próximo torneo, promo) | **S1** · `PLAN_ESCRITORIO.md` |
| 10 | Más tipos de fichas (8-bit, realistas…) mismo tamaño, distinta estética | **S2** · `PLAN_COSMETICOS_V3.md` |
| 11 | Nuevo enfoque de tableros (textura tileable + logo manual) | **S2** · `PLAN_COSMETICOS_V3.md` |
| 5 | Mostrar avatar en partida, búsqueda de amigos, entre amigos | **S3** · `PLAN_PERFIL.md` |
| 12 | Pantalla de edición de perfil (descripción, bandera, emojis) | **S3** · `PLAN_PERFIL.md` |
| 6 | Racha semanal que recompensa con doblones (incentivo diario) | **S4** · `PLAN_RETENCION.md` |
| 7 | Anuncios: qué falta, empezar a probar cómo se ven | **S5** · `PLAN_MONETIZACION.md` |
| 9 | Footer al bajar: soporte, cumplimiento, privacidad, links a stores | **S5** · `PLAN_MONETIZACION.md` |
| 2 | Modo Puzzle (puzzles de dominó con teoría/progresión) | **S6** · `PLAN_PUZZLES.md` |
| 4 | Modo Espectador (ver partidas en vivo, solo fichas del tablero) | **S7** · `PLAN_ESPECTADOR.md` |
| 8 | Addons de chess.com (referencia visual) | *transversal — alimenta S1, S3, S6* |

---

## Por qué estos agrupamientos

- **S1** junta 1+3+13 porque son **un solo rediseño del shell de escritorio**: layout
  above-the-fold, navegación lateral y el banner de torneos son la misma superficie
  (el dashboard en PC). Separarlos duplicaría trabajo de layout.
- **S2** junta 10+11 porque ambos son **el sistema de cosméticos** ya existente
  (`skins.ts`, `DominoPiece`, `game.css`, Tienda) — se tocan los mismos archivos.
- **S3** junta 5+12 porque son **identidad del jugador**: cómo se ve y se presenta
  (avatar en todos lados + descripción/bandera/emojis).
- **S4** es la **economía/retención** (racha) — depende de que exista la billetera
  (ya construida) y de retomar "ganar jugando" (Etapa 2 de `PLAN_COSMETICOS.md`,
  pospuesta). Alimenta los contadores del dashboard de S1.
- **S5** junta 7+9 porque ambos son **readiness de aprobación** (AdSense + tiendas):
  los anuncios y los enlaces legales/soporte se piden juntos para aprobar el sitio/app.
- **S6** y **S7** son **features nuevas grandes e independientes** (puzzle, espectador),
  cada una su sesión.

---

## Orden sugerido (valor + dependencias)

1. **S2 — Cosméticos v3** — arregla el dolor actual de los tableros (pixelado, item 11)
   y suma fichas; momentum de lo ya construido, bajo riesgo.
2. **S1 — Escritorio** — el de mayor impacto visible; IA fundacional para el resto.
   (Los contadores de racha/puzzles del dashboard se completan cuando lleguen S4/S6.)
3. **S3 — Perfil e identidad** — el avatar en partida es un hueco obvio (item 5).
4. **S4 — Retención (racha + ganar jugando)** — cierra la economía; alimenta S1.
5. **S5 — Anuncios + legal** — la app está cerca de aprobación; probar ads + legal.
6. **S6 — Puzzles** — feature nueva grande.
7. **S7 — Espectador** — feature nueva, menor prioridad.

## Dependencias entre sesiones

- **S1** muestra contadores que producen **S4** (racha) y **S6** (puzzles resueltos):
  se construye con los stats que ya existen (ELO, partidas, ganadas, capicúas) y se
  suman los nuevos a medida que S4/S6 aterrizan. No bloquea.
- **S1 (banner de torneos)** consume la fecha del próximo torneo de `PLAN_TORNEOS.md`
  (ms-salas ya tiene el schema de torneos).
- **S4** reusa `billeteras`/`billetera_movimientos` (ya construidas en `PLAN_COSMETICOS.md`).
- **S3 (avatar)** reusa `avatars.ts`/`avatarUrl()` y la columna `avatar` existentes.
