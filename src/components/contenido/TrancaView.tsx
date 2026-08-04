// ── Página de contenido: la tranca ──────────────────────────────────────
// Apunta a "tranca dominó" / "cómo se cuenta la tranca". Es la regla que más
// se confunde: mucha gente cree que da un bono fijo, y no — el equipo
// ganador suma TODOS los pips que quedaron sobre la mesa.
//
// Verificado contra ms-salas/src/game/logic.ts (aplicarPase): gana el equipo
// con menos pips en mano; los pips se suman completos aunque superen el
// objetivo (a diferencia de los bonos fijos como la capicúa, que sí tienen
// tope). La salida siguiente es de quien trancó, si su equipo ganó.

import { BackIcon } from '../icons';

export default function TrancaView({ onBack }: { onBack: () => void }) {
  return (
    <div className="pdemo">
      <div className="pdemo-inner">
        <button className="pdemo-back" onClick={onBack}><BackIcon /> Volver</button>

        <header className="pdemo-head">
          <h1>La tranca en el dominó</h1>
          <p>Cuándo se traba la mano, quién gana y cómo se cuentan los puntos.</p>
        </header>

        <article className="reglas-art">
          <section className="pdemo-section">
            <h2>Qué es una tranca</h2>
            <p>
              Una mano se tranca cuando <strong>ningún jugador puede
              jugar</strong>: los dos extremos de la mesa están en números que
              nadie tiene, y la ronda da la vuelta completa en pases. El juego se
              traba y la mano termina ahí, sin que nadie se quede sin fichas.
            </p>
            <p>
              No es un empate. La mano se cierra igual y{' '}
              <strong>alguien se lleva los puntos</strong> — solo que se
              determina contando, no jugando.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Quién gana la tranca</h2>
            <p>
              Gana el equipo que tenga <strong>menos pips sumados en la
              mano</strong>. Ojo con esto: <strong>no gana el que trancó</strong>.
              Trancar es simplemente haber puesto la ficha que dejó a todos sin
              jugada; si al contar resulta que tu equipo tiene más pips, el
              trancado eres tú.
            </p>
            <p>
              En parejas se suman las fichas de los <em>dos</em> compañeros y se
              compara contra la suma de la pareja rival. Por eso a veces conviene
              que tu compañero se descargue aunque a ti te deje incómodo: lo que
              cuenta es el total del equipo.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Cuántos puntos vale</h2>
            <p>
              Aquí está el detalle que más se confunde, y el que hace de la tranca
              una jugada temible: el equipo ganador suma{' '}
              <strong>todos los pips que quedaron sobre la mesa</strong> — los
              suyos y los del rival, todo junto.
            </p>
            <p>
              No es un bono fijo de 30 como la capicúa. Si entre los cuatro
              jugadores quedaron fichas cargadas, una tranca puede valer{' '}
              <strong>bastante más que un dominó normal</strong>, donde solo se
              cuentan los pips del rival.
            </p>

            <h3>Y no tiene tope</h3>
            <p>
              A diferencia de los bonos fijos —la capicúa, el "pasó a todos"—,
              que no se aplican si te harían pasar el objetivo de la partida,{' '}
              <strong>los pips de una tranca se suman completos siempre</strong>,
              aunque con eso te pases del objetivo y cierres la partida.
            </p>
            <p>
              Dicho de otro modo: <strong>con una tranca sí se puede ganar la
              partida de un golpe</strong>. Con el bono de una capicúa, no.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Cómo se traba una mano a propósito</h2>
            <p>
              Trancar no siempre es accidente. Si vas contando lo que salió,
              puedes provocarlo.
            </p>

            <h3>Cerrar los dos extremos en el mismo número</h3>
            <p>
              La forma clásica: dejar la mesa abierta{' '}
              <strong>en el mismo número de los dos lados</strong>, cuando ya
              salieron casi todas las fichas de ese número. Si quedan pocas en
              juego y tú tienes las que faltan, el resto no tiene con qué entrar.
            </p>

            <h3>Insistir en el número que el rival no tiene</h3>
            <p>
              Cuando un rival pasa, te está diciendo qué números no tiene. Si
              logras que los dos extremos queden en palos que él pasó, ese jugador
              está fuera; si además tu compañero te acompaña, la mano se traba
              sola.
            </p>

            <h3>Contar antes de trancar</h3>
            <p>
              Lo importante: <strong>antes de cerrar el juego, cuenta</strong>. Si
              te quedan un 6-6 y un 5-4 en la mano, tienes 21 pips y probablemente
              pierdas el conteo. Trancar con la mano cargada es regalarle al rival
              todos los puntos de la mesa.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Quién sale después</h2>
            <p>
              La mano siguiente la abre <strong>quien trancó</strong>, siempre que
              su equipo se haya llevado los puntos. Si trancó y perdió el conteo,
              la salida pasa al jugador siguiente.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Errores frecuentes</h2>
            <ul className="reglas-lista">
              <li>
                <strong>Creer que la tranca da 30 puntos.</strong> No: da todos
                los pips de la mesa. Es una de las confusiones más comunes.
              </li>
              <li>
                <strong>Creer que gana el que trancó.</strong> Gana el que tiene
                menos pips. Son cosas distintas y a veces opuestas.
              </li>
              <li>
                <strong>Trancar cargado.</strong> Si no contaste tu mano antes de
                cerrar el juego, estás apostando a ciegas.
              </li>
              <li>
                <strong>Guardar dobles altos "por si acaso".</strong> El 6-6 vale
                12 pips en tu contra. En una mano que huele a tranca, es lo
                primero que hay que soltar.
              </li>
            </ul>
          </section>

          <section className="pdemo-section">
            <h2>Seguir leyendo</h2>
            <p>
              El resto del conteo está en la{' '}
              <a href="/reglas-domino-dominicano">guía de reglas</a>, y el otro
              cierre especial en{' '}
              <a href="/capicua-domino">qué es la capicúa</a>. Para el juego de
              equipo, mira <a href="/domino-en-parejas">cómo jugar en parejas</a>.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
