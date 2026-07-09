# Product

## Register

product

## Users

Un único administrador (el dueño del proyecto 2mino) usando el panel desde
escritorio, en sesiones de trabajo prolongadas y locales (no se despliega
a un VPS). Necesita escanear tablas de datos rápido, tomar decisiones
(banear, activar flags, editar segmentos) con confianza, y no confundirse
con el juego — este panel nunca lo ve un jugador.

## Product Purpose

Back Office de 2mino: gestiona usuarios, segmentos, feature flags,
torneos y reglas del juego a través de los microservicios existentes
(nunca toca la base de datos directo). Esta primera fase de frontend
cubre los primeros 3 pasos del orden de implementación: login admin,
feature flags, y usuarios/segmentos (CRUD + ban). El éxito es un panel
donde cada acción de datos (buscar, editar, activar/desactivar) se hace
en el menor número de clics posible, sin ambigüedad sobre el estado
actual de cada fila.

## Brand Personality

Clínico y denso. Prioriza la legibilidad de datos sobre la decoración.
Nada de calidez ni identidad "de marca" — es una herramienta interna, no
una experiencia de producto. Tono de consola de operaciones: preciso,
silencioso, confía en que el admin ya sabe lo que está haciendo.

## Anti-references

No debe parecerse al juego (`2mino/src`): nada de fieltro, ámbar, ficha de
dominó, ni calidez caribeña. No debe ser un dashboard SaaS genérico con
tarjetas de métricas y gradientes. No debe imitar admin panels de
plantilla (Material Dashboard, AdminLTE) con exceso de iconografía y
sombras — la austeridad es la marca.

## Design Principles

- Densidad sobre aire: las tablas priorizan filas visibles por pantalla.
- Estado siempre visible: todo toggle/badge comunica su estado sin
  necesitar hover ni tooltip.
- Cero ambigüedad en acciones destructivas: banear/desactivar siempre
  pide confirmación explícita, nunca un solo clic accidental.
- Reutilización de patrones: una tabla, un formulario y un toggle se ven
  y comportan igual en todas las secciones del panel.
- Datos mockeados hoy, contrato real mañana: la capa de datos está
  aislada (un cliente API) para que conectar el backend real no toque UI.

## Accessibility & Inclusion

Contraste AA como mínimo en todo el panel (uso prolongado de pantalla).
Soporte de `prefers-reduced-motion`. Navegable por teclado (tablas, forms,
modales de confirmación) dado que es una herramienta de trabajo, no una
landing.
