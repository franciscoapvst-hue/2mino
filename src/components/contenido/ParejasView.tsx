// ── Página de contenido: dominó en parejas ──────────────────────────────
// Segunda página escrita para cerrar la infracción de "contenido de poco
// valor" de AdSense y para darle profundidad al SEO (el eje elegido, "dominó
// por parejas", es competitivo y no se rankea con una página delgada).
//
// Se prerenderiza en el build (src/prerender.tsx → scripts/prerender.mjs), así
// que este texto es HTML real para cualquier crawler.
//
// Reusa el armazón visual de PieceDemo (.pdemo*, .reglas-art) a propósito: es
// la misma clase de página —encabezado, botón de volver, texto de lectura
// corrida— y no hace falta un sistema de estilos nuevo.

import { BackIcon } from '../icons';

export default function ParejasView({ onBack }: { onBack: () => void }) {
  return (
    <div className="pdemo">
      <div className="pdemo-inner">
        <button className="pdemo-back" onClick={onBack}><BackIcon /> Volver</button>

        <header className="pdemo-head">
          <h1>Cómo jugar dominó en parejas</h1>
          <p>
            Cómo se arman los equipos, qué se puede comunicar y cómo se juega
            pensando de a dos.
          </p>
        </header>

        <article className="reglas-art">
          <section className="pdemo-section">
            <h2>Cómo se arman las parejas</h2>
            <p>
              El dominó en parejas se juega <strong>cuatro jugadores, dos contra
              dos</strong>. Los compañeros se sientan <strong>enfrentados</strong>,
              nunca al lado: así el turno alterna siempre entre un jugador de un
              equipo y uno del otro, y ningún equipo juega dos veces seguidas.
            </p>
            <p>
              Esa disposición no es decorativa — es lo que hace que el juego
              funcione. Como entre vos y tu compañero siempre juega un rival, cada
              ficha que ponés le llega a tu compañero <em>después</em> de que el
              rival tuvo su oportunidad de cerrar el número. Jugar en parejas es,
              en buena medida, abrirle camino a alguien que va a jugar dos turnos
              más tarde.
            </p>
            <p>
              <strong>Los puntos son del equipo</strong>, no del jugador. No
              importa quién de los dos cierre la mano: lo que se anota va a la
              cuenta de la pareja. Por eso a veces la mejor jugada es la que a vos
              te deja peor pero le sirve a tu compañero.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Qué se puede comunicar y qué no</h2>
            <p>
              Esta es la parte que más se discute en cualquier mesa. La regla
              general del dominó en parejas es simple: <strong>no se pueden hacer
              señas ni decir qué fichas tenés</strong>. Nada de gestos, toques en
              la mesa ni frases en clave.
            </p>
            <p>
              Lo que sí es legítimo —y es la mitad del juego— es{' '}
              <strong>la información que se transmite jugando</strong>. Cada ficha
              que ponés y cada vez que pasás dice algo, y tu compañero está
              obligado a leerlo. Eso no es trampa: es la comunicación real del
              dominó.
            </p>
            <p>
              Jugando online el tema se simplifica solo: no hay señas posibles
              porque no se ven las caras. En 2mino hay chat durante la partida,
              pero se usa para lo de siempre —celebrar, quejarse del cierre— y
              cantar tus fichas por ahí es exactamente el mismo antideportivo que
              hacerlo con la mano en una mesa real.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Cómo leer a tu compañero</h2>
            <p>
              Todo lo que necesitás saber está en lo que ya pasó en la mesa. Tres
              señales valen más que el resto.
            </p>

            <h3>Un pase es información, no un accidente</h3>
            <p>
              Cuando alguien pasa, está diciendo en voz alta que{' '}
              <strong>no tiene ninguno de los dos números abiertos</strong>. Esa
              información no se borra: si tu compañero pasó en cincos y sietes más
              tarde el juego vuelve a abrirse en cinco, ya sabés que ahí no te
              puede ayudar.
            </p>
            <p>
              Al revés también sirve: si un rival pasa en un número, ese número se
              vuelve tu arma. Insistir en un palo que el rival no tiene lo obliga
              a pasar de nuevo y te acerca al "pasó a todos".
            </p>

            <h3>Con qué sale tu compañero</h3>
            <p>
              La ficha de salida casi siempre indica <strong>de qué palo está
              cargado</strong>. Si tu compañero abre en cuatro, lo más probable es
              que tenga varios cuatros. Mantener ese número abierto suele ser
              mejor que imponer el tuyo.
            </p>

            <h3>Qué ficha eligió cuando tenía varias</h3>
            <p>
              Cuando un jugador podía poner en los dos extremos y eligió uno, la
              elección dice algo: normalmente está cuidando el número que dejó
              abierto, o cerrando el que le conviene a los rivales.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Estrategia básica de pareja</h2>

            <h3>Cuidar el número de tu compañero</h3>
            <p>
              Si sabés en qué palo está fuerte, evitá cerrarlo. Es el error más
              común de quien viene de jugar uno contra uno: se juega la mejor
              ficha propia sin mirar que deja al compañero sin salida.
            </p>

            <h3>Ahogar al rival que pasó</h3>
            <p>
              Un rival que pasó en un número es un rival al que podés dejar sin
              jugar. Si entre vos y tu compañero pueden mantener los dos extremos
              en palos que él no tiene, ese jugador queda fuera de la mano.
            </p>

            <h3>Soltar las fichas cargadas temprano</h3>
            <p>
              Los dobles altos y las fichas de seis y cinco pesan mucho si la mano
              termina en tranca, porque ahí se cuentan los pips que te quedaron.
              Jugarlas al principio, cuando todavía hay muchos números abiertos,
              suele salir más barato que quedártelas para el final.
            </p>

            <h3>Contar lo que ya salió</h3>
            <p>
              Son 28 fichas y siete por jugador. Llevar la cuenta de cuántas
              quedan de cada número —sobre todo de los dobles, que son únicos— es
              lo que separa a un jugador que reacciona de uno que decide. No hace
              falta memorizar las 28: alcanza con seguir dos o tres palos.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Errores comunes</h2>
            <ul className="reglas-lista">
              <li>
                <strong>Jugar solo tu mano.</strong> En parejas, la mano buena es
                la del equipo. Guardar una ficha que le abre el juego a tu
                compañero suele valer más que descargar la tuya.
              </li>
              <li>
                <strong>Ignorar los pases.</strong> Un pase es la información más
                barata de la mesa y la que más se desaprovecha.
              </li>
              <li>
                <strong>Quedarse con los dobles.</strong> Si la mano se tranca, los
                dobles altos son los que hacen perder el conteo.
              </li>
              <li>
                <strong>Cerrar el juego sin necesidad.</strong> Trancar conviene
                solo si tenés menos pips que el rival; si no, le estás regalando
                todos los puntos de la mesa.
              </li>
            </ul>
          </section>

          <section className="pdemo-section">
            <h2>Jugar en parejas en 2mino</h2>
            <p>
              Podés entrar a una partida de cuatro directamente desde la búsqueda
              de rival, y el sistema arma los equipos. Si querés jugar con tu
              compañero de siempre, creá una <strong>sala privada</strong> y
              pasale el enlace: los dos entran a la misma mesa y quedan
              enfrentados.
            </p>
            <p>
              Si todavía no conocés el detalle de cómo se cuentan los puntos —la
              capicúa, la tranca, el objetivo de la partida—, está todo en la{' '}
              <a href="/reglas-domino-dominicano">guía de reglas del dominó
              dominicano</a>.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
