# Frontend

SPA en React + TypeScript servida por Vite. No usa React Router: la navegación se controla con estado en `App.tsx`.

## Vistas

| Vista | Componente | Acceso |
|-------|------------|--------|
| Login / Register / Forgot | `LoginForm`, `RegisterForm`, `ForgotPasswordForm` | Público |
| Dashboard | `Dashboard` | Autenticado |
| Salas | `SalasView` | Autenticado |
| Partida | `GameBoard` | Autenticado, dentro de una sala |
| Demo de fichas | `PieceDemo` | Desde dashboard (dev/diseño) |

## Flujo de sesión

1. Al cargar, `App` busca token en `localStorage` / `sessionStorage` (`tokenStore` en `api.ts`).
2. Si existe, llama a `api.me()` y `api.getPreferencias()`.
3. Restaura tema (`dark` / `light`) desde preferencias o `localStorage` (`2mino-theme`).
4. Logout limpia token y vuelve a login.
5. Con la sesión ya seteada (login fresco o restaurada), si el feature
   flag `reintegro_partida_activa_habilitado` está activo (`api.featureFlags()`),
   consulta `api.salas.activa()` una sola vez — si hay una partida
   `en_juego`, `Dashboard` muestra un banner para reintegrarse (ver
   `docs/CASOS_DE_USO_SOCIAL.md` §11).

## Cliente API (`src/api.ts`)

- Base URL: `/api` (proxy de Vite en dev).
- Tipos exportados: `AuthUser`, `UserConfig`, `Sala`, `PartidaPublica`, `Pieza`, etc.
- Módulos: `api.auth`, `api.salas`, `api.juego`, preferencias de frontend.

## Tema visual

- Clase `light` en `<html>` activa modo claro.
- Variables CSS en `styles.css` definen colores, bordes y sombras.
- Toggle en auth card y dashboard.

## Pantalla de juego

Componentes principales en `src/components/game/`:

| Archivo | Rol |
|---------|-----|
| `GameBoard.tsx` | Contenedor: polling, turnos, drag-and-drop, UI de partida |
| `SnakeBoard.tsx` | Render del tablero en cadena (layout tipo "serpiente") |
| `DominoPiece.tsx` | Ficha individual (pips, orientación, estados) |
| `PieceDemo.tsx` | Sandbox visual de fichas |

### GameBoard — comportamiento

- Carga estado con `api.juego.estado(salaId)`.
- **Polling** periódico (2s) para sincronizar con otros jugadores, vía
  `src/hooks/usePoll.ts` — con back-pressure: programa la siguiente
  consulta recién cuando la anterior resolvió o falló, nunca en
  paralelo. El mismo hook lo usan `MatchmakingView`, `SalasView` y
  `Dashboard` para sus propios polls (cola/party, sala de espera,
  notificaciones).
- Validación local con `puedeJugar` / `getExtremos` de `src/game/types.ts`.
- Acciones: jugar ficha (`api.juego.jugar`), pasar (`api.juego.pasar`).
- `ResizeObserver` para adaptar el tablero al ancho del contenedor.
- Reordenar la mano: arrastrar una ficha sobre otra la reordena (drag
  HTML5 en desktop, gesto táctil con umbral en móvil) — orden puramente
  del cliente, se reinicia al repartir una mano nueva.

### SnakeBoard

Renderiza la cadena de fichas del tablero adaptándose al espacio disponible. Recibe el ancho medido desde `GameBoard`.

### DominoPiece

Representación SVG/CSS de una ficha `{ a, b }` con orientación horizontal o vertical.

## Lógica de dominó (cliente)

`src/game/types.ts` duplica las funciones de utilidad del servidor:

- `crearSet`, `barajar`, `repartir`
- `getExtremos`, `puedeJugar`, `esCapicua`
- Tipos `Pieza`, `FichaTablero`, `Val`

El cliente **no decide** el resultado de una jugada; solo anticipa qué es legal mostrar en UI. El servidor en `ms-salas/src/game/logic.ts` es autoritativo.

## Estructura de carpetas

```
src/
├── App.tsx
├── main.tsx
├── api.ts
├── styles.css
├── game/
│   └── types.ts
└── components/
    ├── Dashboard.tsx
    ├── SalasView.tsx
    ├── LoginForm.tsx
    ├── RegisterForm.tsx
    ├── ForgotPasswordForm.tsx
    └── game/
        ├── GameBoard.tsx
        ├── SnakeBoard.tsx
        ├── DominoPiece.tsx
        └── PieceDemo.tsx
```

## Desarrollo UI

```powershell
npm run dev
```

Cambios en componentes de juego se prueban creando una sala, uniendo jugadores (varias pestañas/usuarios) e iniciando partida desde `SalasView`.

Para iterar solo el diseño de fichas, usar **Piece Demo** desde el dashboard.
