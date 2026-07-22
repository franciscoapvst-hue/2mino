# Plan — Identidad y perfil del jugador

**Sesión 3** · agrupa los puntos 5 y 12. Referencia: chess.com (punto 8).

## Contexto

Hoy el avatar (columna `avatar` en `usuarios`, elegido con `AvatarPicker`, resuelto por
`src/avatars.ts` `avatarUrl()`) se ve en el dashboard, amigos y leaderboard, **pero no
en la partida** ni consistentemente en la búsqueda de amigos — "no vale de nada tener un
avatar si solo tú lo ves" (punto 5). Y no hay forma de **personalizar el perfil**
(punto 12): descripción, bandera del país, emojis al lado del nombre (ej.
`Francisco🇩🇴👮🏾`).

## Alcance

**Sí (punto 5 — avatar en todos lados):**
- **En partida**: mostrar el avatar de cada asiento en `GameBoard` (el sub-componente
  `OpSeat` y el propio jugador hoy muestran solo el username). El estado de partida ya
  trae `asientos[].usuario_id`/`username`; sumar `avatar` a esa proyección (viene de
  `usuarios`).
- **Búsqueda de amigos y lista de amigos**: verificar que `avatar` se muestre en el
  autocompletar (`GET /usuarios/buscar` ya devuelve `avatar`) y en cada fila. Rellenar
  huecos donde hoy sale la inicial.
- Reusar `avatarUrl()` y el fallback de iniciales que ya existen.

**Sí (punto 12 — edición de perfil):**
- Campos nuevos de perfil: **descripción** (texto corto), **país/bandera** (código de
  país → emoji de bandera), **emojis personalizados** al lado del nombre.
- **Pantalla/modal de edición de perfil** para el propio usuario.
- Mostrar esos campos donde se ve el perfil: `PlayerProfileModal`, la fila de amigos,
  el header del dashboard (nombre + emojis), y en partida (nombre + emojis + bandera).

**No:**
- Marcos de avatar (cosmético aparte) · perfiles públicos con URL propia · seguir/
  seguidores.

## Dónde vive

- **Backend `ms-usuarios`**: agregar a `usuarios` (o a un `usuarios_perfil` 1:1, mismo
  criterio que la billetera para no engordar `usuarios`) `descripcion VARCHAR(160)`,
  `pais VARCHAR(2)` (ISO-3166 alpha-2 → bandera), `emojis VARCHAR(40)`. Endpoints:
  `PATCH /usuarios/:id/perfil`. Incluir estos campos + `avatar` en las proyecciones que
  ya devuelven jugadores.
- **`ms-salas`**: sumar `avatar` (y opcionalmente `pais`/`emojis`) a la proyección de
  `asientos` de la partida — join/lookup contra `usuarios` al armar el estado, o
  cachearlo en la sala al sentarse (mismo patrón que ya guarda `username` en
  `sala_jugadores`). **Preferible cachear al sentarse** para no cruzar servicios en cada
  poll.
- **Gateway**: `PATCH /perfil` (verifyToken → `PATCH /usuarios/:sub/perfil`), y exponer
  los campos nuevos en `/auth/me` y en las respuestas de social.
- **Frontend**:
  - `src/components/ProfileEditView.tsx` (nuevo) o modal — form de descripción/bandera/
    emojis (selector de país → bandera, input de emojis con validación de longitud).
  - `src/api.ts` — `api.putPerfil(...)`, tipos.
  - `src/components/game/GameBoard.tsx` (`OpSeat` + asiento propio) — render del avatar.
  - `src/components/social/PlayerProfileModal.tsx` y las filas de amigos — mostrar
    descripción/bandera/emojis.
  - Helper `paisAEmoji(codigo)` (regional indicator symbols) para la bandera.

## Etapas

1. **Avatar en partida** (`ms-salas` cachea `avatar` en `sala_jugadores` al sentarse +
   lo proyecta; `GameBoard`/`OpSeat` lo renderiza). El más pedido, bajo riesgo.
2. **Avatar consistente** en búsqueda/lista de amigos (frontend, backend ya lo da).
3. **Schema + endpoint de perfil** (`ms-usuarios`: descripcion/pais/emojis + `PATCH
   /usuarios/:id/perfil`) + gateway `PATCH /perfil` + `/auth/me` extendido.
4. **Pantalla de edición** (frontend) + mostrar los campos en modal de perfil, amigos,
   dashboard y partida.

## Verificación

En una partida real, cada asiento muestra el avatar correcto (y bandera/emojis si se
implementaron); editar el perfil (descripción/bandera/emojis) persiste y se refleja en
el dashboard, en el modal de perfil que ve un amigo, y en la partida. Validar longitudes
(descripción ≤160, emojis ≤ N caracteres) y sanitizar.

## Fuera de alcance

Marcos de avatar · verificación de identidad · moderación de descripciones (se puede
sumar un filtro básico de palabras si hace falta, no en v1).
