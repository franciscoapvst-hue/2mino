# Plan de videos publicitarios

Cómo empezar a comercializar 2mino con video corto. Mismo espíritu que el
resto de los `PLAN_*.md`: qué se hace, en qué orden, y qué NO se promete.

---

## 1. Qué se puede prometer hoy (y qué no)

Antes de escribir un guion, el inventario honesto de lo que existe. Un anuncio
que promete algo que la app no hace se paga dos veces: en pauta y en
reputación.

| Se puede mostrar | Estado |
|---|---|
| Partidas 1vs1 y en parejas (2v2) | ✅ funciona |
| Reglas dominicanas: capicúa, tranca, "pasó a todos", a puntos | ✅ funciona |
| Jugar **sin registrarse** (sesión de invitado) | ✅ funciona |
| Jugar **sin descargar nada**, en el navegador | ✅ funciona |
| Salas privadas con enlace para invitar | ✅ funciona |
| Chat en vivo durante la partida | ✅ funciona |
| Ranking ELO, de bronce a diamante | ✅ funciona |
| Repeticiones jugada por jugada | ✅ funciona |
| Fichas y tableros personalizables | ✅ funciona |
| Torneos con bracket | ✅ implementado |

**NO decir:**

- ❌ *"Descarga la app"* — **no hay app móvil**. Google Play y App Store dicen
  "Próximamente" en el footer. Decirlo manda a la gente a buscar algo que no
  existe y se pierde la conversión entera.
- ❌ *"Compra doblones"* — la compra con dinero real está **apagada**
  (`ENABLE_PAGOS=false`, ver `docs/PENDIENTES.md`).
- ❌ Nada que suene a apuesta, casino o premio en dinero. Es el
  anti-referente explícito del producto (`PRODUCT.md`) y además complica la
  aprobación de pauta en Meta y TikTok, que tienen políticas duras con juego
  de azar.

> Que no haya app **no es una debilidad para el anuncio: es el gancho**.
> "Sin descargar nada" elimina la fricción más cara del embudo. La mayoría de
> los competidores necesitan una instalación de 80 MB antes de la primera
> ficha.

---

## 2. El diferencial real

"Dominó online" no diferencia: hay decenas. Lo que sí:

1. **Son las reglas de aquí.** La mayoría de las apps internacionales usan
   dominó de bloqueo o mexicano. Un dominicano nota en treinta segundos que no
   hay capicúa, que la tranca se cuenta mal, que no se juega a 200. Ese
   reconocimiento —"esto sí es como se juega"— es el diferencial más fuerte y
   el más fácil de mostrar en video.
2. **Se juega con tu gente, no con desconocidos.** El dominó es social. El
   enlace de sala privada convierte el grupo de WhatsApp en la mesa.
3. **Cero fricción.** Del enlace a la primera ficha sin instalar ni
   registrarse.

Todo el material debería apoyarse en uno de estos tres. Si un video no dice
ninguno, probablemente no hace falta.

---

## 3. A quién le hablamos

**Primario — República Dominicana, 25-55.** Ya juegan dominó. No hay que
explicarles el juego, hay que convencerlos de que este lo hace bien.

**Secundario — la diáspora (NY, NJ, Florida, Puerto Rico).** Vale la pena
tratarlo aparte porque el mensaje es distinto y el valor por usuario es mayor:
tienen el hábito, la nostalgia y un problema real —no tienen con quién jugar—
que la app resuelve literalmente. Es el segmento con el gancho emocional más
fuerte.

---

## 4. La pieza clave: el enlace de invitación

2mino tiene un bucle viral que la mayoría de los juegos no tiene: creas una
sala privada, mandas el enlace al grupo, y quien lo abre está jugando sin
instalar ni registrarse.

**Eso convierte a cada jugador en distribución.** La pauta no debería
optimizarse para "un usuario nuevo", sino para **un usuario que invita a
tres**. Casi todos los videos deberían terminar con alguien mandando el
enlace, no con un logo.

Detalle técnico que conviene cuidar antes de gastar: ese enlace se comparte
por WhatsApp, así que la vista previa (`og:image`) importa. Ya está hecha
(`public/og.png`, ver `docs/SEO.md`).

---

## 5. Los seis conceptos

Todos verticales 9:16, sin depender del audio (la mayoría mira sin sonido:
**subtítulos quemados siempre**).

### 1. "Mándalo al grupo" — el bucle viral
**Duración:** 15-20 s · **Prioridad: la más alta**

Alguien crea sala, copia el enlace, lo pega en el grupo de WhatsApp. Corte
rápido: cuatro personas en cuatro lugares distintos, la misma mesa en
pantalla. Termina con la primera ficha cayendo.

**Gancho (primeros 2 s):** el pantallazo del grupo de WhatsApp con el enlace.
Es una imagen que el público reconoce al instante.
**CTA:** "Crea la mesa y manda el link."

### 2. "Capicúa" — el momento
**Duración:** 8-12 s · **Prioridad: alta**

Solo la jugada. Mesa abierta en dos números, la última ficha entra por los
dos lados, la animación de cierre, el marcador subiendo. Sin explicación.

**Gancho:** la ficha entrando. Quien sabe, sabe — y quien no, pregunta.
**CTA:** ninguno explícito, solo la marca. Este video es para que lo
compartan, no para convertir.

### 3. "Con tu gente, donde estén" — diáspora
**Duración:** 25-30 s · **Prioridad: alta (segmento de mayor valor)**

Pantalla dividida: alguien en un apartamento con nieve afuera, alguien en un
colmado en Santo Domingo. Misma mesa. Se pican por el chat. Cierra con una
capicúa y la reacción de los dos.

**Gancho:** el contraste visual de los dos lugares en el primer segundo.
**CTA:** "Juega con los tuyos, aunque estén lejos."

### 4. "Así se juega aquí" — el diferencial de reglas
**Duración:** 20-25 s · **Prioridad: media**

Enumeración rápida sobre imágenes de la app: capicúa 30 · tranca, todos los
pips de la mesa · pasó a todos · a 200 · en parejas. Ritmo de lista, corte
por cada regla.

**Gancho:** "Si tu app de dominó no tiene capicúa, no es dominó."
**CTA:** enlace a la guía de reglas (`/reglas-domino-dominicano`) — de paso
alimenta el SEO con tráfico real.

### 5. "En cinco segundos" — demoler la fricción
**Duración:** 10-15 s · **Prioridad: media**

Grabación de pantalla en tiempo real, **sin cortes ni acelerado**: abrir el
enlace → "Entrar como invitado" → estás jugando. Con cronómetro en pantalla
para que se note que no hay truco.

**Gancho:** el cronómetro arrancando.
**CTA:** "Sin descargar. Sin registrarte."

### 6. "El pique" — el chat
**Duración:** 15 s · **Prioridad: baja (bueno para orgánico)**

El dominó es tanto la conversación como las fichas. Mostrar el chat en vivo
durante una mano cerrada, con la picadera yendo y viniendo.

**Gancho:** un mensaje gracioso del chat como primer cuadro.

---

## 6. Producción: lo realista

Sin equipo ni presupuesto de producción, y está bien: **en este nicho la
autenticidad rinde más que el valor de producción**. Un video demasiado
pulido parece anuncio; uno con manos reales y una mesa real parece la
verdad.

- **Base:** grabación de pantalla de la app. Ya se ve bien —mesa oscura,
  ámbar, fichas animadas—, no hace falta maquillarla.
- **B-roll:** teléfono, primeros planos de manos, fichas reales, una mesa de
  verdad, un colmado. Es lo que da alma.
- **Gente real:** familia y amigos jugando. No actores.
- **Audio:** usar las librerías nativas de cada plataforma. Música con
  derechos hace que te bajen el video o te bloqueen la pauta.
- **Subtítulos quemados**, siempre.
- **Sin voz en off** al principio: cuesta más y rinde menos que texto en
  pantalla.

Regla de oro del formato corto: **los primeros dos segundos deciden todo.**
Nunca abrir con el logo — abrir con la jugada, el enlace o el contraste.

---

## 7. Dónde publicar, y en qué orden

**Facebook e Instagram (Meta)** — la plataforma principal para este público
en RD. Reels + feed. El segmento de 35+ está fuerte en Facebook, que en otros
mercados ya no aplica pero aquí sí.

**TikTok** — para el público más joven y para que la capicúa circule sola.
Es donde el video #2 puede rendir sin pauta.

**YouTube Shorts** — el más barato de mantener: se sube lo mismo, cuesta poco
y queda indexado, lo que además ayuda al SEO.

**WhatsApp** no es plataforma de pauta, pero **es donde ocurre la
distribución real**. No se compra: se diseña para ella (ver §4).

**Orden sugerido:**

1. **Orgánico primero, 2-3 semanas.** Publicar los seis videos sin pauta.
   Sale gratis y dice cuál funciona antes de poner dinero. Es el paso que más
   se saltea y el que más plata ahorra.
2. **Pauta chica sobre el ganador.** Poner presupuesto solo detrás del que ya
   mostró retención orgánica, empezando por RD.
3. **Recién después, la diáspora** (video #3), segmentando por ubicación e
   interés en RD. El clic ahí cuesta más, así que conviene entrar con un
   creativo ya validado.

---

## 8. Qué medir

El error clásico sería medir instalaciones — no hay app. Y las vistas no
significan nada por sí solas. Lo que importa, en orden:

1. **Sesiones de invitado creadas** (`POST /auth/invitado`) — el primer
   compromiso real.
2. **Partidas terminadas** — que hayan jugado de verdad, no solo entrado.
3. **Salas privadas creadas** — la señal de que el bucle viral corre.
4. **Vuelta al día siguiente** — la única métrica que dice si el producto
   retiene o solo entretuvo diez minutos.

Los cuatro números salen de datos que la app ya guarda. **Antes de publicar
el primer video conviene anotar los valores de hoy**, porque sin línea de
base no se puede saber si algo funcionó.

---

## 9. Antes de gastar en pauta

Traer gente a un producto que no está listo para recibirla es la forma más
rápida de quemar el dinero. Chequeo previo:

- [ ] **El login con Google funciona.** Estaba roto en `www` por
      `origin_mismatch` (ver `docs/PENDIENTES.md`). Si alguien llega del
      anuncio y no puede entrar, se perdió.
- [ ] **La vista previa del enlace se ve bien** al pegarlo en WhatsApp.
- [ ] **Línea de base de las métricas de §8** anotada.
- [ ] **Probar el recorrido completo desde un teléfono ajeno**, con datos
      móviles, sin sesión iniciada. Es el recorrido real del anuncio y casi
      nunca se prueba así.

Una cosa que **ya está resuelta** y que suele hundir a los juegos
multijugador nuevos: el arranque en frío. Si alguien llega y no hay nadie
conectado, a los 10 segundos la mesa se completa con bots
(`BOT_FILL_MS`, `ms-salas/src/game/bots.ts`). Nadie se topa con una sala
vacía. Es una razón sólida para poder anunciar desde ya.

---

## 10. Lo que no hay que hacer

- **Prometer app móvil.** No existe todavía.
- **Abrir con el logo.** Se pierden los dos segundos que deciden.
- **Explicar el dominó.** El público ya sabe jugar; explicarles insulta.
- **Sonar a casino.** Ni "gana premios", ni "apuesta", ni ruleta. Rompe el
  producto y complica la aprobación de la pauta.
- **Pautar los seis videos a la vez.** Orgánico primero: es gratis y elige
  mejor que la intuición.
- **Comprar seguidores o vistas.** Ensucia los datos justo cuando la decisión
  depende de ellos.

---

## 11. Primer paso concreto

Grabar el **video #1 ("Mándalo al grupo")** y el **#2 ("Capicúa")**. Los dos
salen de una sola sesión de grabación de pantalla, no necesitan actores, y
cubren los dos extremos: el que explica el producto y el que se comparte
solo.

Publicarlos sin pauta y esperar una semana antes de decidir cualquier gasto.
