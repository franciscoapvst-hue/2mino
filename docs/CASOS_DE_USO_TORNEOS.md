# Casos de uso — Torneos (detallado, clic por clic)

Extiende `docs/CASOS_DE_USO_BACKOFFICE.md` §7 (que ya tiene el schema base:
`torneos`, `torneo_fases`, `torneo_equipos`, `torneo_partidas`,
`torneo_campos_inscripcion`, `torneo_inscripcion_datos`). Este documento
NO repite ese schema — detalla los **flujos paso a paso** del admin (Back
Office) y del jugador, y agrega dos piezas nuevas: **pago con tarjeta vía
AZUL** (cuota de inscripción) y **notificaciones por correo del estado del
torneo**.

Es un documento de **casos de uso para aprobar**. El plan de ejecución
técnica (schema nuevo exacto, endpoints, orden de implementación, motor de
fases) se escribe DESPUÉS de que apruebes esto.

## Decisiones ya fijadas

- **AZUL — Página de Pago alojada**: el jugador ingresa la tarjeta en el
  sitio de AZUL (redirect), no en el nuestro. Nunca tocamos datos de
  tarjeta → sin certificación PCI de nuestro lado.
- **Cuota por equipo**: un solo pago cubre a la pareja; lo paga el jugador
  que crea el equipo (jugador 1). Torneos con cuota `0` = gratis (se saltan
  todo el paso de pago).
- **Reembolsos manuales**: el admin procesa cada reembolso desde el BO.
- **Avance de fase híbrido**: el sistema puede avanzar por fecha
  programada, y el admin puede forzar o posponer.
- **Moneda**: DOP (peso dominicano) por defecto — AZUL es RD.

---

## 1. Actores y estados

**Actores**: `Admin` (opera el Back Office), `Jugador 1` (crea el equipo y
paga), `Jugador 2` (se une con código), `Sistema` (scheduler, emails,
webhooks de pago).

**Estados del torneo**: `borrador` → `inscripcion` → `fase_inicial` →
`eliminatoria` → `finalizado`  ·  `cancelado` (desde casi cualquiera).

**Estados del equipo**: `pendiente_pago` → `pendiente_companero` →
`completo` → (`eliminado` / `campeon`).

**Estados del pago (AZUL)**: `iniciado` → `aprobado` / `declinado` /
`cancelado` / `expirado`  ·  `reembolsado` (desde `aprobado`).

---

## 2. Parte A — Back Office (Admin), clic por clic

### A1. Entrar a la sección Torneos
1. Admin abre el Back Office (PWA) e inicia sesión (segmento `admin`).
2. Clic en **"Torneos"** en el nav lateral.
3. Ve la lista de torneos con: nombre, estado (badge), fechas, nº de
   equipos inscritos / cupo, y — si tiene cuota — total recaudado.
4. Arriba a la derecha: botón **"+ Nuevo torneo"**.

### A2. Crear un torneo (asistente de 8 pasos)
Clic en **"+ Nuevo torneo"** abre un formulario por pasos (se guarda como
`borrador` en cualquier momento con **"Guardar borrador"**).

**Paso 1 — Datos básicos**
1. Escribe **Nombre** del torneo.
2. Elige **Modo** (clásico/rápido) y **Puntos objetivo** por partida
   (100/150/200).
3. Clic **"Siguiente"**.

**Paso 2 — Formato y criterio de clasificación**
1. Toggle **"Fase inicial (grupos)"** on/off.
   - Si ON: **Puntos objetivo de la fase inicial** (a cuánto se juega cada
     partida del grupo) y el **criterio de clasificación** (ver abajo).
2. Selector **Nº de fases eliminatorias** (1 = solo final, 2 = semi+final,
   3 = cuartos+semi+final…). El panel muestra en vivo cuántos equipos
   necesita ese formato ("para 3 fases eliminatorias: 8 equipos").
3. **Criterio de clasificación — quién pasa de fase (automático)**. Por
   cada transición (fase inicial → primera eliminatoria, y de una
   eliminatoria a la siguiente) el admin define:
   - **Cuántos pasan**: número exacto (**"Top 10"**), que debe calzar con
     el nº de equipos que la siguiente fase necesita. El panel valida en
     vivo: "Top 10 → llena una fase de cuartos (necesita 8)" marca un
     desajuste si no coincide.
   - **Por qué métrica se ordena** (para la fase inicial de grupos, donde
     no hay eliminación directa): **puntos acumulados** (default) /
     **ELO de torneo** / **victorias**, con desempates en cascada (ej.
     puntos → luego diferencia → luego ELO de torneo). En las fases
     eliminatorias no hace falta métrica: pasa el ganador de cada cruce.
   - El corte lo calcula el **`Sistema` automáticamente** al cerrar la
     fase (ver A5): ordena la tabla por la métrica elegida y toma el Top N.
     El admin no elige a mano quién pasa; solo confirma/ajusta si hubo un
     empate exacto en el borde del corte.
4. Clic **"Siguiente"**.

**Paso 3 — Reglas de la partida (por torneo)**
Cada torneo puede **sobrescribir las reglas globales del juego** (§6 de
`CASOS_DE_USO_BACKOFFICE.md`: `reglas_juego`) solo para SUS partidas — sin
tocar la config del juego normal. La pantalla arranca **precargada con los
valores globales**; el admin cambia solo lo que quiera para este torneo.

1. **Tiempo por jugada**: segundos que tiene cada jugador para tirar (o
   "sin límite"). Puede diferir del casual/ranked normal.
2. **Puntos objetivo por partida**: a cuánto se juega cada partida
   (100/150/200 u otro) — puede fijarse distinto al del juego general.
   *(Si la fase inicial define su propio puntaje en el Paso 2, ese manda
   para los grupos; este es el default de las eliminatorias.)*
3. **Capicúa**: toggle **suma / no suma**, y si suma, **cuántos puntos**
   (default global).
4. **Tranca (cierre) — a quién y cuánto suma**: configurable — p. ej.
   "suma al equipo con menos pintas: sí/no" y **cuántos puntos**; o
   "no suma" (la tranca solo cierra la mano).
5. **Bonus "pasó a todos" (+30)**: toggle suma / no suma + monto.
6. (Extensible) cualquier otra constante de `reglas_juego` que tenga
   sentido por-torneo (escalones de ELO no aplican; ELO de torneo arranca
   siempre en 1000 y es aparte del global).
7. Botón **"Restaurar valores globales"** (descarta overrides de este
   torneo). Clic **"Siguiente"**.

**Cómo se aplican** (a nivel de caso de uso): el torneo guarda un set de
**overrides de reglas**; cuando el motor genera una sala para una partida
del torneo, esa sala **hereda las reglas del torneo**, no las globales.
`salas.config` (JSONB, ya existe) es el lugar natural para llevar ese set,
de modo que la lógica de la partida (`logic.ts`, temporizador) lea las
reglas de la sala del torneo en vez del cache global de `reglas.ts`. El
detalle técnico va en el plan de ejecución.

**Paso 4 — Visibilidad y targeting**
1. Radio **Público** / **Privado**.
   - Si Privado: se genera un **código de invitación** (botón "Regenerar").
2. Rango de ELO (opcional): **ELO mínimo** y **ELO máximo** (vacío = sin
   límite → para todos).
3. Clic **"Siguiente"**.

**Paso 5 — Fechas y horarios por fase (modo híbrido)**
Cada fase tiene su **propio horario, independiente** — NO tienen que ser
consecutivas. Puede haber días intermedios entre una fase y la siguiente
(ej. grupos el sábado, cuartos el sábado siguiente).

1. **Fecha/hora de inicio** y **Fecha/hora de fin** generales del torneo
   (el rango que engloba todo — informativo, es lo que el jugador ve en el
   listado).
2. Una fila por fase, en orden, cada una con su **ventana propia**
   (desde/hasta):
   - **Fase inicial (grupos)**: ventana en la que los grupos deben
     completar todas sus partidas.
   - **Cada fase eliminatoria** (cuartos, semis, final): su propia
     ventana; dentro de ella, cada partida puede además tener un horario
     puntual (ver A6).
   - Entre el fin de una fase y el inicio de la siguiente **puede haber un
     hueco** (días intermedios) — es válido y esperado.
3. **Validaciones** (el formulario no deja guardar si fallan):
   - **Orden lógico fijo**: la fase inicial (grupos), si existe, va SIEMPRE
     primero; las eliminatorias van en secuencia (cuartos → semi → final).
     No se puede poner una fase de grupos después de una eliminatoria, ni
     reordenar las eliminatorias.
   - **Orden temporal**: el inicio de cada fase debe ser **posterior o
     igual al fin de la fase anterior** — se permite el hueco (día
     intermedio), pero **no el solapamiento** (una fase no puede empezar
     antes de que la anterior termine). Marca en rojo la fila que se
     solapa.
   - **Dentro del rango del torneo**: todas las ventanas caen entre la
     fecha de inicio y fin generales.
   - Cada ventana: `desde < hasta`.
4. Toggle **"Avanzar fases automáticamente al llegar la fecha"**:
   - ON: al llegar el **fin de la ventana** de una fase, el `Sistema`
     intenta cerrarla, calcular clasificados (Paso 2) y **generar la fase
     siguiente a su propia fecha de inicio** (no inmediatamente — respeta
     el hueco configurado). El admin igual puede forzar/posponer (A5).
   - OFF: solo avance manual (el admin aprieta "avanzar" cuando quiere).
5. Clic **"Siguiente"**.

**Paso 6 — Cuota de inscripción (pago)**
1. Campo **Cuota por equipo** (monto en DOP). `0` = torneo gratis (los
   pasos de pago del jugador desaparecen).
2. Si cuota > 0:
   - Se muestra que el cobro es **por equipo** (lo paga el jugador 1).
   - Campo de **texto de política de reembolso** (se le muestra al jugador
     ANTES de pagar — importante porque los reembolsos son manuales).
   - Aviso: "Los pagos se procesan con AZUL. Los reembolsos se hacen
     manualmente desde aquí."
3. Clic **"Siguiente"**.

**Paso 7 — Campos de inscripción**
1. Lista de campos que el jugador debe llenar (arranca con sugeridos:
   nombre completo, teléfono, cédula).
2. Por cada campo: **etiqueta**, **tipo** (texto/número/teléfono/email),
   **requerido** (sí/no), y arrastrar para **ordenar**.
3. Botones **"+ Agregar campo"** / **"Eliminar"** por fila.
4. Clic **"Siguiente"**.

**Paso 8 — Información estética y reglamento (opcional)**
1. Editor de **HTML/bloque de contenido** del torneo (reglas especiales,
   premios, sponsors, imágenes) — se muestra en el detalle que ve el
   jugador. Si se deja vacío, se arma un detalle genérico con los datos
   estructurados.
2. **Adjuntar reglamento en PDF** (opcional, aparte del HTML): campo de
   subida de archivo. Pensado para el documento formal/legal del torneo
   (bases, términos), distinto del contenido de marketing del HTML. Si no
   se adjunta nada, no aparece nada de lo siguiente — es opcional de
   punta a punta.
   - **En el detalle del torneo**: aparece como link de descarga
     ("Reglamento oficial (PDF)").
   - **En el formulario de inscripción (jugador 1 y jugador 2)**: el PDF
     se muestra **anexado dentro del propio formulario**, con una vista
     previa legible del documento (no solo un link) y un botón para
     abrirlo en una pestaña aparte. Debajo, un **checkbox obligatorio**
     "He leído y acepto las políticas del torneo" — el botón de enviar el
     formulario queda deshabilitado hasta marcarlo. Si el torneo no
     adjuntó PDF, no se pide ninguna aceptación (no hay nada que aceptar).
   - La vista previa se renderiza nosotros mismos (no un visor externo del
     navegador): así se lee siempre, sin depender de que el navegador del
     jugador tenga activada la opción de ver PDFs inline.
3. Botón **"Vista previa"** (renderiza sanitizado, como lo verá el
   jugador).
4. Clic **"Abrir inscripción"** → el torneo pasa de `borrador` a
   `inscripcion` y se vuelve visible/inscribible para los jugadores que
   califican.

### A3. Monitorear inscripciones
1. Admin abre un torneo en estado `inscripcion`.
2. Pestaña **"Equipos"**: tabla con cada equipo — nombre/jugadores, estado
   (`pendiente_pago` / `pendiente_companero` / `completo`), **estado del
   pago** (`aprobado` / `iniciado` / `declinado`), fecha de inscripción.
3. Filtros por estado. Contadores arriba: inscritos completos, incompletos,
   recaudado.
4. Clic en un equipo → ve los **datos de inscripción** de cada jugador
   (los campos configurables) y el detalle del pago.

### A4. Iniciar el torneo
1. Con el cupo lleno (o a criterio del admin), clic **"Iniciar torneo"**.
2. El sistema **valida**: nº de equipos `completo` calza con el formato
   (para v1, sin "bye" — si no calza, muestra el faltante y no deja
   iniciar).
3. Modal de confirmación: "Se van a generar N salas de la primera fase y
   se notificará a los inscritos. ¿Confirmar?".
4. Clic **"Confirmar"** → estado pasa a `fase_inicial` (o `eliminatoria`
   si no hay fase inicial), se generan las salas emparejando equipos, y el
   `Sistema` dispara los emails "tu partida está lista" (ver §5).

### A5. Cerrar una fase y clasificar (híbrido + Top N automático)
1. En un torneo en curso, pestaña **"Fases"**: cada fase con su estado
   (`pendiente`/`en_curso`/`finalizada`), su **ventana** (fechas) y
   progreso ("6/8 partidas jugadas"). La tabla de posiciones de la fase
   inicial es visible acá, ordenada por la métrica del criterio (Paso 2).
2. **Cálculo automático de quién pasa**: al cerrar una fase, el `Sistema`
   ordena la tabla por la métrica configurada (puntos / ELO de torneo /
   victorias, con desempates) y toma el **Top N** definido en el Paso 2.
   El admin no elige a mano — solo se le pide confirmar si hay un **empate
   exacto justo en el corte** (ej. Top 10 pero el 10.º y 11.º empatan en
   todo): ahí el admin desempata o agrega un mini-desempate.
3. **Automático (si el toggle está ON)**: al llegar el **fin de la
   ventana** de la fase, el `Sistema` intenta cerrarla. Si todas las
   partidas terminaron, aplica el Top N y **programa la fase siguiente
   para su propia fecha de inicio** (respeta el hueco entre fases — no
   arranca la siguiente de inmediato). Si faltan partidas por jugar, **no
   avanza solo**: marca la fase "vencida — requiere atención" y avisa al
   admin.
4. **Manual / forzar**: botón **"Cerrar y avanzar ahora"** — si faltan
   partidas, el admin decide en un modal: resolver las pendientes por
   criterio (walkover al equipo presente, etc.) o posponer. Igual aplica
   el Top N automático sobre lo jugado.
5. **Posponer**: botón **"Posponer fase"** reprograma la ventana (desde/
   hasta) de esa fase y las posteriores si hace falta — respetando las
   mismas validaciones de orden/solapamiento del Paso 5.
6. Al avanzar: se generan las salas de la fase siguiente (a su fecha), y
   salen los emails "avanzaste" / "eliminado" / "tu próxima partida (con
   horario)".

### A6. Reprogramar una partida eliminatoria
1. En la pestaña "Fases", clic en una partida eliminatoria → **"Cambiar
   horario"**.
2. Elige nueva **fecha/hora programada** → guardar → email a los 4
   jugadores de esa partida con el nuevo horario.

### A7. Reembolsos manuales
1. Pestaña **"Pagos"** del torneo (o desde un equipo puntual).
2. Lista de pagos `aprobado`. Por cada uno: botón **"Reembolsar"**.
3. Modal: monto (prellenado con el total), motivo. Clic **"Confirmar
   reembolso"** → el sistema llama a AZUL para el void/refund, marca el
   pago `reembolsado`, y envía email "reembolso procesado".
4. Caso equipo incompleto: si un equipo quedó `pendiente_companero` y el
   torneo arranca sin él, esos equipos aparecen resaltados en "Pagos" para
   reembolsar (el admin decide).

### A8. Cancelar / finalizar
1. **Cancelar**: botón **"Cancelar torneo"** (con confirmación). Estado →
   `cancelado`, emails a todos los inscritos. Si había pagos, el admin
   va a A7 a reembolsar (el sistema le lista los pendientes).
2. **Finalizar**: al cerrarse la última fase, estado → `finalizado`, se
   corona el campeón y salen los emails de "torneo finalizado".

---

## 3. Parte B — Jugador (usuario final), clic por clic

### B1. Descubrir el torneo
1. En el **Dashboard**, si el flag `torneos_habilitado` está activo, ve la
   card **"Torneos"**. Clic.
2. **Listado**: solo los torneos que puede ver (su ELO dentro del rango +
   visibilidad). Cada card: nombre, estado, fecha de inicio, cupo, y
   **"Cuota: RD$X"** o **"Gratis"**.
3. Clic en un torneo → **Detalle**: el `info_html` del admin (o el
   genérico), fechas, formato, y botón **"Inscribirme"** (si está en
   `inscripcion` y el jugador califica).

### B2. Inscribirse como Jugador 1 (crea el equipo + paga)
1. Clic **"Inscribirme"**.
2. **Formulario dinámico**: llena sus campos configurables (nombre,
   teléfono, cédula…). Validación en vivo de requeridos.
3. (Opcional) nombre del equipo.
4. Clic **"Continuar"**.
5. **Si el torneo es gratis**: se crea el equipo (`pendiente_companero`),
   salta directo al paso B2.9 (código). Fin del pago.
6. **Si tiene cuota**: pantalla de **resumen de pago** — monto, política de
   reembolso (la que escribió el admin), y botón **"Pagar con tarjeta
   (AZUL)"**. Debajo, un texto: "Serás redirigido a la página segura de
   AZUL. No ingreses datos de tarjeta fuera de ese sitio."
7. Clic **"Pagar con tarjeta"** → **redirect a la Página de Pago de AZUL**
   (ver §4 para el detalle del flujo de pago).
8. Vuelve de AZUL:
   - **Aprobado** → equipo creado en `pendiente_companero`, pago
     `aprobado`. Continúa a B2.9.
   - **Declinado/Cancelado** → pantalla "el pago no se completó" con botón
     **"Reintentar"** (vuelve a B2.6). No se crea el equipo (o queda
     `pendiente_pago` reintentar).
9. **Pantalla de código**: "¡Estás dentro! Falta tu compañero." Muestra el
   **código de equipo** + botón **"Copiar link"** + botones de compartir.
   Aviso de que el equipo no compite hasta que el compañero se una.
10. Recibe **email** de confirmación (inscripción + pago) con el código
    para reenviar (ver §5).

### B3. Compartir el código
1. Clic **"Copiar link"** → copia `…/torneos/:id/unirse/:codigo`.
2. Lo manda por WhatsApp/chat de `ms-social`/donde sea.

### B4. Unirse como Jugador 2 (con el código)
1. Abre el link (o pega el código desde el detalle del torneo → **"Unirme
   con código"**).
2. Ve **"Te estás uniendo al equipo de @jugador1 en [Torneo]"**.
3. **Formulario dinámico**: llena SUS propios campos de inscripción.
4. Clic **"Unirme"**.
   - **Cuota por equipo → el Jugador 2 NO paga** (ya pagó el jugador 1).
     El equipo pasa a `completo`.
5. Pantalla de confirmación: "¡Equipo completo! Ya están inscritos." +
   **email** de inscripción completa a ambos.
6. Validaciones: si el equipo ya está completo, o el jugador ya está en
   otro equipo del mismo torneo → mensaje de error claro.

### B5. Esperar el inicio / ver mi estado
1. En el detalle del torneo (ya inscrito), ve **"Mi equipo"**: estado
   (completo/incompleto), mi compañero, y — cuando arranca — **"Mi próxima
   partida"** con rival y horario.
2. Antes del inicio recibe **email** "el torneo comienza pronto".

### B6. Jugar mi partida del torneo
1. Cuando el admin inicia/avanza fase y se genera la sala, el jugador:
   - Recibe **email** "tu partida está lista" con el horario y un botón
     **"Ir a mi partida"**.
   - En el dashboard/detalle del torneo aparece **"Jugar ahora"** (activo
     desde la hora programada).
2. Clic **"Ir a mi partida"** / **"Jugar ahora"** → entra a la **sala
   normal de juego 2v2** (reusa el `GameBoard` existente).
3. Juega la partida como cualquier 2v2. Al terminar, el resultado se
   registra en el torneo automáticamente.

### B7. Ver resultado / avanzar / quedar eliminado
1. Al cerrar su partida, ve el resultado y — según la fase — **"Avanzaste
   a [siguiente fase]"** o **"Quedaste eliminado"**.
2. Recibe el **email** correspondiente.

### B8. Ver posiciones y final
1. Pestaña **"Posiciones"** del torneo: tabla con ELO de torneo,
   victorias/derrotas, capicúas, tranques por equipo.
2. Al finalizar, el detalle muestra el **campeón** y la posición del propio
   equipo. **Email** "torneo finalizado".

---

## 4. Parte C — Pago con AZUL (Página de Pago), clic por clic + flujo

Usamos la **Página de Pago alojada** de AZUL: el jugador ingresa la tarjeta
en el sitio de AZUL, nosotros solo iniciamos y verificamos.

### Flujo
1. Jugador (en B2.7) clic **"Pagar con tarjeta"**.
2. **Nuestro backend** crea un registro de pago (`estado=iniciado`),
   genera un `OrderNumber` único, y arma el formulario de AZUL con los
   campos requeridos (monto en centavos, moneda DOP, `OrderNumber`, URLs
   de retorno `Approved/Declined/Cancel`, y un **hash de autenticación**
   calculado con las llaves del comercio — integridad de los datos).
   *(Los nombres/uso exactos de los campos y el algoritmo del hash se
   confirman contra el manual de integración vigente de AZUL al
   implementar.)*
3. El navegador del jugador es **redirigido (POST) a la Página de Pago de
   AZUL**.
4. **En el sitio de AZUL** el jugador ingresa número de tarjeta, fecha,
   CVV, y confirma. (Nada de esto pasa por nosotros.)
5. AZUL procesa y **redirige de vuelta** a una de nuestras URLs:
   - `ApprovedUrl` (aprobado), `DeclinedUrl` (rechazado), `CancelUrl` (el
     jugador canceló). AZUL incluye parámetros de respuesta + un **hash de
     respuesta**.
6. **Nuestro backend verifica el hash de respuesta** (que la respuesta es
   genuina de AZUL y no fue manipulada), y actualiza el pago:
   `aprobado` / `declinado` / `cancelado`. Solo si `aprobado`, el equipo
   queda inscrito.
7. Se redirige al jugador a la pantalla de resultado correspondiente (B2.8).

### Casos borde (a manejar)
- **Doble envío / reintento**: el `OrderNumber` único evita cobrar dos
  veces por el mismo intento; un reintento genera uno nuevo.
- **Jugador cierra la pestaña en AZUL**: el pago queda `iniciado`; un
  chequeo posterior (o el estado que reporte AZUL) lo mueve a
  `expirado`/`cancelado`. El equipo no se activa.
- **Aprobado pero falla nuestro guardado**: la verificación es
  idempotente por `OrderNumber` — se puede reconciliar; el pago aprobado
  en AZUL es la fuente de verdad, y aparece en el BO para conciliar.
- **Moneda/impuestos**: DOP; si aplica ITBIS, se calcula y se envía
  separado (a confirmar con AZUL/contabilidad).

### Seguridad
- Nunca almacenamos datos de tarjeta (los maneja AZUL).
- Las llaves del comercio (auth del hash) viven solo en el backend, en el
  `.env` del VPS — nunca en el frontend ni en el repo.

---

## 5. Parte D — Notificaciones por correo (estado del torneo)

Reusa la infraestructura de email ya existente (`ms-usuarios/src/email.ts`,
Resend — misma plantilla de marca del correo de verificación). Cada evento
del torneo dispara un correo con el mismo diseño (ficha 6-6, fieltro,
ámbar). Todos con un botón de acción claro y sin datos sensibles.

| # | Evento (trigger) | Destinatario | Contenido / CTA |
|---|---|---|---|
| 1 | Jugador 1 se inscribe y (si aplica) paga | Jugador 1 | Confirmación + **código para el compañero** + "Comparte para completar tu equipo" |
| 2 | Jugador 2 se une → equipo `completo` | Ambos | "¡Equipo completo! Están inscritos en [Torneo]" |
| 3 | Pasaron X horas y el equipo sigue incompleto | Jugador 1 | Recordatorio "aún falta tu compañero" + código |
| 4 | Falta poco para `fecha_inicio` | Todos los inscritos completos | "El torneo comienza pronto" + fecha |
| 5 | Se genera la sala de su partida (inicio/avance de fase) | Los 4 jugadores de esa partida | "Tu partida está lista" + **horario** + botón "Ir a mi partida" |
| 6 | Se reprograma una partida (A6) | Los 4 jugadores | "Cambió el horario de tu partida" + nuevo horario |
| 7 | Cierra su partida | Equipo | Resultado + "Avanzaste a [fase]" o "Quedaste eliminado" |
| 8 | Torneo `finalizado` | Todos | Campeón + tu posición final |
| 9 | Torneo `cancelado` | Todos los inscritos | Aviso + (si pagó) "te contactaremos para el reembolso" |
| 10 | Admin procesa un reembolso (A7) | Jugador que pagó | "Tu reembolso fue procesado" + monto |

**Notas**:
- Los emails 5/7 son los de mayor volumen (uno por partida) — se mandan en
  lote al iniciar/avanzar fase.
- Reutiliza `construirEmail…()` (patrón del PR 52): un builder de HTML por
  tipo de correo, con la misma plantilla de marca.
- Fuera del email: las notificaciones **in-app** (campana de `ms-social`)
  se pueden sumar después reusando `notificaciones` — no en el v1 salvo que
  lo pidas.

---

## 6. Datos nuevos respecto a §7 (a nivel de caso de uso)

El schema base ya está en §7. Estos casos de uso agregan (el detalle exacto
va en el plan de ejecución):

- **Pagos**: una tabla de pagos por equipo (`torneo_pagos`) — `equipo_id`,
  `order_number`, `monto`, `moneda`, `estado`, ids/respuesta de AZUL,
  timestamps, y datos del reembolso. Más columnas en `torneos` para la
  cuota (`cuota_monto`, `moneda`, `politica_reembolso_texto`).
- **Reglas de partida por torneo**: un set de overrides de `reglas_juego`
  guardado en el torneo (JSONB `reglas_override` en `torneos`, o filas por
  clave). Solo las claves que el admin cambió; el resto cae a los valores
  globales. Al generar cada sala del torneo, esos overrides se copian a
  `salas.config` (JSONB, ya existe) para que la partida los use en vez del
  cache global de `reglas.ts`. Claves típicas: `tiempo_limite_jugada_ms`,
  `puntos_objetivo`, `puntos_capicua` (+ suma sí/no), `puntos_tranca` (+ a
  quién / sí/no), `puntos_paso_a_todos` (+ sí/no).
- **Horario independiente por fase**: `torneo_fases` en §7 ya tiene
  `ventana_inicio`/`ventana_fin` por fila — así que fases con horarios
  distintos y huecos intermedios **ya están soportadas en el dato**; lo
  nuevo es la **validación** (orden lógico fijo grupos→eliminatorias, sin
  solapamiento pero con hueco permitido) y el flag "avanzar
  automáticamente".
- **Criterio de clasificación (Top N automático)**: por cada transición de
  fase, cuántos pasan (`clasifican_por_grupo` de §7 se generaliza a un N
  por transición) + la **métrica de orden** (`puntos` / `elo_torneo` /
  `victorias`) y el orden de desempates. El `Sistema` calcula el corte solo
  al cerrar la fase; el admin solo interviene ante un empate exacto en el
  borde.
- **Scheduler híbrido**: el mecanismo de `Sistema` que revisa las ventanas
  de cada fase, cierra la vencida, aplica el Top N y **agenda la siguiente
  a su propia fecha** (respetando el hueco) — la pieza más delicada del v1.
- **Notificaciones**: un registro de emails enviados por torneo (para no
  duplicar y para auditar), o reusar el patrón fire-and-forget del email
  de verificación.

---

## 7. Fuera de alcance del v1 (para no sobre-diseñar)

- **Reembolso automático** por AZUL: en el v1 es manual desde el BO (tu
  decisión). El botón "Reembolsar" llama a AZUL, pero lo dispara el admin,
  no el sistema solo.
- **Cuota por jugador** o **configurable**: v1 es siempre por equipo.
- **Brackets con "bye"** (nº de inscritos que no calza con las fases):
  v1 exige que calce exacto.
- **Notificaciones in-app** (campana): v1 es solo por email.
- **Tokenización/guardar tarjeta** (DataVault de AZUL) para pagos futuros:
  fuera del v1.
- **Multi-moneda / USD**: v1 solo DOP.

---

*Cuando apruebes estos casos de uso (o marques qué sacar/cambiar), escribo
el **plan de ejecución**: schema nuevo exacto, endpoints admin/jugador, el
motor de fases y emparejamiento, la integración sala↔torneo (cómo `ms-salas`
sabe que una sala es de torneo y reporta el resultado), el flujo técnico de
AZUL, el scheduler híbrido, y el orden de implementación por etapas.*
