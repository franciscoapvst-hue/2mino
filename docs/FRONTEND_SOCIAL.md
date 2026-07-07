# Frontend social — mapa de archivos

Dónde vive cada pieza del frontend construido para
`docs/CASOS_DE_USO_SOCIAL.md`. Todo es **solo frontend**: `ms-social` no
existe todavía, así que las funciones de `api.social`/`api.historial` en
[src/api.ts](../src/api.ts) devuelven datos mock (ver
[src/mocks/social.ts](../src/mocks/social.ts)) con la misma forma que
tendrá el backend real. Cuando `ms-social` exista, solo hay que reemplazar
el cuerpo de esas funciones — los componentes no cambian.

**Excepción real (no mock)**: el leaderboard base (`api.ranked.leaderboard`)
y "unirse a sala por código" (`api.salas.porCodigo` + `unirse`) ya pegan a
los endpoints reales de `ms-salas`, porque esos ya existen.

## Vistas de pantalla completa (rutas en App.tsx)

| Vista (`AppView`) | Componente | Entra desde |
|---|---|---|
| `amigos` | [src/components/social/FriendsView.tsx](../src/components/social/FriendsView.tsx) | Ícono 👥 en el nav del Dashboard |
| `leaderboard` | [src/components/social/LeaderboardView.tsx](../src/components/social/LeaderboardView.tsx) | Card "Leaderboard" (sección Comunidad del Dashboard) |
| `historial` | [src/components/social/MatchHistoryView.tsx](../src/components/social/MatchHistoryView.tsx) | Card "Historial de partidas" (Dashboard) |
| `replay` | [src/components/social/ReplayViewer.tsx](../src/components/social/ReplayViewer.tsx) | Fila de `MatchHistoryView` → "Ver repetición" |

Todas comparten el header [PageHeader.tsx](../src/components/social/PageHeader.tsx)
(back + título) y se montan como `<div className="dash social-page ...">`
para heredar los tokens de color de [dashboard.css](../src/dashboard.css).
Estilos propios en [src/social.css](../src/social.css).

## Paneles / overlays (no son rutas)

| Pieza | Componente | Se monta en |
|---|---|---|
| Bandeja de entrada (dropdown) | [InboxPopover.tsx](../src/components/social/InboxPopover.tsx) | `Dashboard.tsx`, al hacer clic en la campana 🔔 |
| Perfil de jugador (modal) | [PlayerProfileModal.tsx](../src/components/social/PlayerProfileModal.tsx) | `LeaderboardView.tsx`, al hacer clic en una fila |
| Chat de partida (flotante) | [ChatPanel.tsx](../src/components/social/ChatPanel.tsx) | `GameBoard.tsx` (esquina inferior derecha, durante la partida) |
| Acciones post-partida | `PostGameActions` (función interna de `GameBoard.tsx`) | Dentro de `FinPartidaOverlay`, al terminar una partida |

## Motor y datos

| Archivo | Qué hace |
|---|---|
| [src/game/replay-engine.ts](../src/game/replay-engine.ts) | `aplicarMovimientoTablero` (reconstruye el tablero jugada a jugada) + `simularMano` (genera una mano de dominó **válida** para las repeticiones de ejemplo, jugando greedy sobre un mazo barajado real) |
| [src/hooks/useMeasuredWidth.ts](../src/hooks/useMeasuredWidth.ts) | Hook compartido (antes vivía duplicado dentro de `GameBoard.tsx`); lo usan `GameBoard` y `ReplayViewer` para medir el ancho del tablero |
| [src/mocks/social.ts](../src/mocks/social.ts) | Todos los datos de ejemplo: amigos, notificaciones, historial, perfiles, semilla de chat |
| [src/api.ts](../src/api.ts) → `api.social.*` / `api.historial.*` | Contrato de funciones 1:1 con los endpoints de `docs/CASOS_DE_USO_SOCIAL.md`. Cada una tiene un comentario `TODO(backend)` señalando qué reemplazar |

## Tipos nuevos (en `src/api.ts`)

`Amigo`, `Notificacion`, `TipoNotificacion`, `EstadoRelacion`, `PerfilJugador`,
`PartidaHistorial`, `ChatMensaje` — todos documentados con el endpoint real
que representan (ver comentarios en el archivo).

## Íconos nuevos (en `src/components/icons.tsx`)

`BellIcon`, `PeopleIcon`, `TrophyIcon`, `HistoryIcon`, `ChatIcon`,
`SmileIcon`, `SendIcon`, `PlayIcon`, `PauseIcon`, `SkipBackIcon`,
`SkipForwardIcon`, `PersonAddIcon`, `CheckIcon`, `XIcon`, `SearchIcon`.

## Qué falta para que esto sea real (recordatorio del doc de casos de uso)

- `ms-social` no existe: crearlo con las tablas de `docs/CASOS_DE_USO_SOCIAL.md`
  §2.1/§8.1 y reemplazar cada función de `api.social`/`api.historial`.
- `ms-salas` necesita `partida_movimientos` + `partida_resultados` (§5) para
  que el historial y el replay dejen de ser mock — ahora mismo
  `mockReplay()` genera una mano simulada válida, no la partida real jugada.
- El WS de presencia/chat/notificaciones (§0, §2.3, §8.2) — hoy `ChatPanel`
  solo hace eco local del mensaje que yo mismo escribo.
- `handleUnirseSala` en `App.tsx` navega a la lista de salas tras unirse
  (no hay una forma de saltar directo a la sala de espera desde afuera de
  `SalasView` todavía — sería una mejora aparte, no de este alcance).
