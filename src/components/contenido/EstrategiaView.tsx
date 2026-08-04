// ── Página de contenido: estrategia para principiantes ──────────────────
// Apunta a "cómo jugar bien al dominó" / "estrategia dominó" / "trucos de
// dominó". Es la consulta de quien ya sabe las reglas y quiere dejar de
// jugar de memoria.
//
// Los números son verificables y no adorno: 28 fichas, 7 por jugador con
// cuatro, y cada número aparece 8 veces (está en 7 fichas, y en su doble
// cuenta dos). Ese último dato es la base de todo el conteo.

import { BackIcon } from '../icons';

export default function EstrategiaView({ onBack }: { onBack: () => void }) {
  return (
    <div className="pdemo">
      <div className="pdemo-inner">
        <button className="pdemo-back" onClick={onBack}><BackIcon /> Volver</button>

        <header className="pdemo-head">
          <h1>Estrategia de dominó para principiantes</h1>
          <p>
            Siete ideas que separan a quien juega de memoria de quien juega
            pensando.
          </p>
        </header>

        <article className="reglas-art">
          <section className="pdemo-section">
            <h2>1. Mirá tu mano antes de la primera jugada</h2>
            <p>
              Antes de poner nada, contá <strong>cuántas fichas tenés de cada
              número</strong>. Si tenés cuatro cincos, los cincos son tu palo: te
              conviene que la mesa esté abierta en cinco la mayor cantidad de
              turnos posible.
            </p>
            <p>
              Y contá los pips que cargás. Si arrancás con 6-6, 6-5 y 5-5 tenés 34
              puntos en la mano: si esa mano se tranca y perdés el conteo, se los
              regalás al rival enteros.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>2. Cada número aparece ocho veces</h2>
            <p>
              Este es el dato que hace posible contar. En el set de 28 fichas,{' '}
              <strong>cada número está en siete fichas</strong> — del 0 al 6 — y
              en su propio doble cuenta dos veces. Total:{' '}
              <strong>ocho apariciones por número</strong>.
            </p>
            <p>
              O sea: si ya se jugaron seis cincos y vos tenés otro, queda uno solo
              afuera. Con esa cuenta sabés si podés cerrar el juego en cinco o si
              alguien te va a entrar. No hace falta seguir los siete números:{' '}
              <strong>alcanza con vigilar dos o tres</strong>, sobre todo el tuyo
              y el que más se está jugando.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>3. Soltá las cargadas temprano</h2>
            <p>
              Los dobles altos y las fichas de seis y cinco pesan mucho si la mano
              termina en tranca. Al principio de la mano hay muchos números
              abiertos y es fácil colocarlas; sobre el final, la mesa se cierra y
              te quedás con ellas.
            </p>
            <p>
              Los dobles son el caso extremo: entran por un solo número, así que
              son las fichas más difíciles de colocar. <strong>Si podés jugar el
              doble, jugalo</strong> — esperar "el momento ideal" es como se
              quedan trabados los principiantes.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>4. Un pase es información gratis</h2>
            <p>
              Cuando un jugador pasa, está anunciando que{' '}
              <strong>no tiene ninguno de los dos números abiertos</strong>. Esa
              información no vence: vale por el resto de la mano.
            </p>
            <p>
              Usala en las dos direcciones. Si un rival pasó en cuatros, insistir
              en cuatro lo deja fuera del juego. Si tu compañero pasó en cuatros,
              cerrar el juego en cuatro lo está dejando fuera a él.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>5. No trabes tu propio juego</h2>
            <p>
              Es el error clásico de quien viene del dominó de dos: jugar la mejor
              ficha propia sin mirar qué deja abierto. Si tenés cinco fichas de
              seis y cerrás los dos extremos en otro número,{' '}
              <strong>te bloqueaste solo</strong>.
            </p>
            <p>
              Antes de poner, mirá qué número queda abierto <em>después</em> de tu
              jugada, no solo si la ficha entra.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>6. Elegí el lado, no solo la ficha</h2>
            <p>
              Cuando una ficha entra por los dos extremos, tenés una decisión que
              mucha gente pasa por alto: <strong>de qué lado la ponés cambia qué
              número queda abierto</strong>, y por lo tanto quién puede jugar
              después.
            </p>
            <p>
              Es la herramienta más directa que tenés para controlar la mesa: dejar
              abierto el número que tu compañero domina, o el que el rival ya pasó.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>7. Pensá en el cierre desde la mitad</h2>
            <p>
              Cuando te quedan tres o cuatro fichas, dejá de improvisar y decidí
              cómo querés terminar la mano:
            </p>
            <ul className="reglas-lista">
              <li>
                <strong>Si vas liviano de pips</strong>, trabar el juego te
                conviene: en una tranca gana quien menos carga, y se lleva todos
                los pips de la mesa.
              </li>
              <li>
                <strong>Si vas cargado</strong>, buscá dominar — quedarte sin
                fichas — o al menos descargar lo pesado antes de que la mesa se
                cierre.
              </li>
              <li>
                <strong>Si te queda una sola ficha</strong> y sus dos números
                están abiertos, cerraste con capicúa.
              </li>
            </ul>
          </section>

          <section className="pdemo-section">
            <h2>Practicar</h2>
            <p>
              Casi todo esto se entrena contando, no memorizando. Si todavía no
              tenés firmes las reglas, están en la{' '}
              <a href="/reglas-domino-dominicano">guía del dominó dominicano</a>;
              para el juego de equipo,{' '}
              <a href="/domino-en-parejas">cómo jugar en parejas</a>; y los dos
              cierres especiales, en{' '}
              <a href="/capicua-domino">la capicúa</a> y{' '}
              <a href="/tranca-domino">la tranca</a>.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
