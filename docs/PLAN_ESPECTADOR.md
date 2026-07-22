# Plan — Modo Espectador

**Sesión 7** · punto 4.

## Contexto

Se quiere un modo donde se puedan **espectar todas las partidas en curso**. Regla clave:
el espectador **no ve las fichas de nadie** (ni la mano propia de los jugadores), **solo
las fichas del tablero** (la cadena) + el marcador y de quién es el turno.

Ventaja: ya existe casi todo. `SnakeBoardReadOnly.tsx` dibuja un tablero sin interacción
(lo usa el visor de replays), y la proyección pública de la partida ya oculta las manos
ajenas (`manosReveladas` es null mientras se juega, `conteoManos` da solo el número).
Falta: **listar las partidas en curso** y una **proyección de espectador** (sin ninguna
mano) + la vista.

## Alcance

**Sí:**
- **Lista de partidas en vivo**: las salas `en_juego`, con jugadores, modo, marcador y
  cuántas fichas quedan — para elegir cuál mirar.
- **Vista de espectador** de una partida: el tablero (cadena) en vivo, el marcador, de
  quién es el turno, los nombres/avatars de los asientos y su **conteo** de fichas
  (número, no las fichas). **Sin** mano de nadie. Se actualiza en vivo por el mismo WS
  de la sala (`partida_actualizada`) o por poll.
- Entrada desde el dashboard/sidebar (S1): "Ver partidas en vivo".

**No:**
- Chat de espectadores · lista de espectadores · espectar rankeds privadas si se decide
  ocultarlas (configurable) · rebobinar en vivo (eso es replay, ya existe).

## Dónde vive

- **Backend `ms-salas`**:
  - `GET /espectar` — lista de partidas `en_juego` (reusa la query de salas + estado del
    juego; devuelve marcador/turno/conteo, nada de manos).
  - `GET /espectar/:salaId` — **proyección de espectador**: como `vistaPublica` pero con
    `miMano: []` y sin revelar ninguna mano (nueva proyección que NO recibe un
    `usuario_id`; oculta todas las manos, deja tablero/marcador/turno/conteoManos/
    asientos). Reutilizar el mismo estado, solo cambia la proyección.
  - El WS de la sala ya emite `partida_actualizada`; el espectador se suscribe igual
    (permitir la suscripción de no-jugadores en modo lectura, o caer al poll).
- **Gateway**: `/espectar` y `/espectar/:salaId` públicos (con o sin auth — decidir si
  invitados pueden espectar; probablemente sí, con verifyToken opcional).
- **Frontend**:
  - `src/components/espectador/EspectadorLista.tsx` + `EspectadorPartida.tsx` (nuevos).
    La partida reusa `SnakeBoardReadOnly` + marcador + asientos (avatar/nombre + conteo).
  - Rutas `/live` y `/live/:salaId` en `App.tsx` + entrada en nav.
  - `src/api.ts` — `api.espectar.lista()/partida(salaId)`.

## Etapas

1. **Proyección de espectador** (`ms-salas`: `vistaEspectador(partida)` que oculta TODAS
   las manos) + `GET /espectar/:salaId` + gateway.
2. **Lista de partidas en vivo** `GET /espectar` + gateway.
3. **Frontend**: lista + vista de partida reusando `SnakeBoardReadOnly`, actualización en
   vivo (WS/poll), avatar+nombre+conteo por asiento (depende del avatar en asientos de
   `PLAN_PERFIL.md` S3, si no, muestra inicial).
4. Entrada en dashboard/sidebar.

## Verificación

Con una partida real en curso, `/live` la lista; entrar a `/live/:salaId` muestra la
cadena del tablero, marcador y turno **en vivo** (se actualiza cuando los jugadores
mueven), el conteo de fichas por jugador, y **ninguna mano** (verificar en el payload que
no viajan las fichas de los jugadores). Al terminar la partida, la vista lo refleja y
sale de la lista de vivos.

## Fuera de alcance

Chat de espectadores · contador de espectadores · ocultar/permitir espectar por tipo de
sala (se puede sumar un flag después) · rebobinar en vivo.
