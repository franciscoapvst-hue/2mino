// ── Página de contenido: la capicúa ─────────────────────────────────────
// Tercera página escrita para cerrar la infracción de "contenido de poco
// valor" de AdSense y para darle profundidad al SEO.
//
// Apunta a "capicúa dominó" / "qué es capicúa en dominó": es una consulta
// específica, con intención clara, y es la jugada más característica del
// dominó dominicano — el diferencial del producto.
//
// El detalle de que el bono NO se aplica si pasaría el objetivo es propio de
// esta implementación (ms-salas/src/game/logic.ts, aplicarJugada): si cambia
// esa regla, hay que actualizar el texto.

import { BackIcon } from '../icons';

export default function CapicuaView({ onBack }: { onBack: () => void }) {
  return (
    <div className="pdemo">
      <div className="pdemo-inner">
        <button className="pdemo-back" onClick={onBack}><BackIcon /> Volver</button>

        <header className="pdemo-head">
          <h1>La capicúa en el dominó</h1>
          <p>Qué es, cuánto vale y por qué no se busca: se da.</p>
        </header>

        <article className="reglas-art">
          <section className="pdemo-section">
            <h2>Qué es una capicúa</h2>
            <p>
              Hay capicúa cuando cerrás la mano con una ficha que{' '}
              <strong>podía entrar por los dos extremos de la mesa</strong>. No es
              que la pongas de los dos lados —se juega una sola vez, de un lado—:
              lo que la define es que <em>los dos números de tu última ficha
              estaban abiertos</em>.
            </p>
            <p>
              El nombre viene de las palabras capicúas, las que se leen igual al
              derecho y al revés. La idea es la misma: la ficha cerraba el juego
              mirando para cualquier lado.
            </p>

            <h3>Un ejemplo concreto</h3>
            <p>
              Imaginá que la mesa quedó <strong>abierta en 5 de un lado y en 3
              del otro</strong>, y que tu única ficha es la <strong>5-3</strong>.
              La podés poner pegada al 5 o pegada al 3: entra por los dos lados.
              La jugás, te quedás sin fichas y cerraste con capicúa.
            </p>
            <p>
              Si en cambio la mesa estaba abierta en 5 y en 6, y tu última ficha
              era la 5-3, solo entraba por un lado. Cerraste la mano igual, pero
              es un dominó común: no hay capicúa.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Cuánto vale</h2>
            <p>
              En 2mino la capicúa vale un <strong>bono fijo de 30 puntos</strong>{' '}
              para tu equipo, en lugar de contar los pips que les quedaron a los
              rivales.
            </p>
            <p>
              Eso tiene una consecuencia que no todos notan:{' '}
              <strong>a veces la capicúa vale menos que un cierre normal</strong>.
              Si los rivales quedaron cargados —con dobles altos en la mano—, los
              pips reales pueden superar bastante los 30 del bono. La capicúa se
              celebra por lo que es, no siempre porque sea el cierre más caro.
            </p>

            <h3>La excepción del objetivo</h3>
            <p>
              Hay una regla que conviene tener clara: si el bono de 30 llevaría a
              tu equipo <em>por encima del objetivo</em> de la partida (100, 150 o
              200 según la sala), <strong>no se aplica</strong>. En su lugar se
              cuentan los pips reales del rival, que sí pueden cerrar la partida.
            </p>
            <p>
              En criollo: <strong>no se gana una partida con el bono de la
              capicúa</strong>. El bono es un premio de estilo dentro del juego,
              no un atajo para llegar al final.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>¿Se puede buscar una capicúa?</h2>
            <p>
              Poco, y ese es justamente su encanto. Para que se dé tienen que
              coincidir tres cosas que casi no controlás: que te quede{' '}
              <strong>una sola ficha</strong>, que esa ficha <strong>no sea un
              doble</strong> —un doble tiene el mismo número de los dos lados, así
              que si entra por un extremo entra por el mismo número— y que{' '}
              <strong>los dos extremos abiertos sean exactamente sus dos
              números</strong>.
            </p>
            <p>
              Lo que sí podés hacer es no arruinarla. Si te quedan dos fichas y
              una de ellas tiene números que están abiertos en los dos extremos,
              guardarla para el final te deja la puerta abierta. Es una decisión
              chica, de la última jugada, no un plan de toda la mano.
            </p>
            <p>
              Jugar buscando la capicúa a costa de todo lo demás suele salir caro:
              retener fichas para armarla es exactamente lo que te deja cargado si
              la mano termina en tranca.
            </p>
          </section>

          <section className="pdemo-section">
            <h2>Confusiones frecuentes</h2>
            <ul className="reglas-lista">
              <li>
                <strong>No es cerrar con doble.</strong> Un doble tiene el mismo
                número en las dos mitades: entra por un solo número, aunque haya
                dos extremos iguales. No hay capicúa.
              </li>
              <li>
                <strong>No es trancar.</strong> La tranca es que{' '}
                <em>nadie</em> pueda jugar y la mano se trabe; la capicúa es que{' '}
                <em>vos</em> cerrás quedándote sin fichas. Son cierres opuestos.
              </li>
              <li>
                <strong>No aplica en cualquier jugada.</strong> Solo cuenta si la
                ficha que entraba por los dos lados era la <em>última</em> que te
                quedaba. Si te quedan fichas, no cerraste nada.
              </li>
              <li>
                <strong>No siempre es el mejor cierre.</strong> Con rivales
                cargados, los pips reales pueden valer más que el bono.
              </li>
            </ul>
          </section>

          <section className="pdemo-section">
            <h2>Seguir leyendo</h2>
            <p>
              El resto del conteo —la victoria normal, la tranca y el objetivo de
              la partida— está en la{' '}
              <a href="/reglas-domino-dominicano">guía de reglas del dominó
              dominicano</a>. Y si jugás de a cuatro, en{' '}
              <a href="/domino-en-parejas">cómo jugar en parejas</a> está la parte
              de leer a tu compañero y jugar en equipo.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
