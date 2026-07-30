// ── Artículo de reglas (contenido indexable) ────────────────────────────
// Vive aparte de PieceDemo para no mezclar el demo visual de fichas con el
// texto largo, pero se renderiza dentro de esa página: /reglas-domino-dominicano
// se prerenderiza en el build (scripts/prerender.mjs), así que este texto es
// HTML real para cualquier crawler, no algo que aparece recién con JS.
//
// Las reglas describen lo que ESTE juego implementa de verdad
// (ms-salas/src/game/logic.ts), no el dominó "en general": la salida
// obligada con el doble más alto, el bono de capicúa que no se aplica si
// pasaría el objetivo, la tranca que suma TODOS los pips de la mesa, y el
// robo del pozo solo en 1vs1. Si cambia la lógica, hay que actualizar esto.

export default function ReglasArticulo() {
  return (
    <article className="reglas-art">
      <section className="pdemo-section">
        <h2>Cómo se juega al dominó dominicano</h2>
        <p>
          El dominó dominicano se juega con el set completo de <strong>28 fichas</strong>,
          del blanco (0) al seis. Lo que lo distingue de otras variantes no es el
          set, sino cómo se cuentan los puntos: se juega <strong>en parejas</strong>,
          la partida dura varias manos hasta llegar a un objetivo de puntos, y hay
          jugadas —la capicúa, la tranca— que valen distinto que en el dominó
          común.
        </p>
        <p>
          En 2mino podés jugar de dos formas: <strong>en parejas</strong> (cuatro
          jugadores, dos contra dos) o <strong>uno contra uno</strong>. Las reglas
          son las mismas salvo un detalle importante, el pozo, que se explica más
          abajo.
        </p>

        <h3>El reparto</h3>
        <p>
          Cada jugador recibe <strong>siete fichas</strong>. Con cuatro jugadores
          eso agota el set: las 28 fichas quedan repartidas y no sobra ninguna.
          Con dos jugadores se reparten 14 y las <strong>otras 14 quedan en el
          pozo</strong>, boca abajo, para robar durante la mano.
        </p>
        <p>
          En parejas, los compañeros se sientan <strong>enfrentados</strong>: el
          turno va rotando y nunca juegan dos del mismo equipo seguidos. Los
          puntos son del equipo, no del jugador.
        </p>

        <h3>Quién sale</h3>
        <p>
          La primera mano la abre quien tenga el <strong>doble más alto</strong>, y
          está obligado a salir con esa ficha. Con cuatro jugadores eso es siempre
          el doble seis, porque están todas repartidas. En uno contra uno el doble
          seis puede haber quedado en el pozo; en ese caso sale el doble más alto
          que sí se repartió, y si nadie tiene dobles, abre el primer jugador.
        </p>
        <p>
          De ahí en adelante, <strong>la mano siguiente la abre quien ganó la
          anterior</strong>, y esta vez puede salir con la ficha que quiera. Si la
          mano terminó trancada, abre quien trancó —siempre que su equipo se haya
          llevado los puntos—; si no, le toca al jugador de la derecha.
        </p>
      </section>

      <section className="pdemo-section">
        <h2>El turno: jugar, pasar o robar</h2>
        <p>
          En tu turno tenés que colocar una ficha que <strong>encaje en alguno de
          los dos extremos</strong> de la cadena. La mesa crece hacia los dos
          lados y vos elegís de qué lado poner. Los dobles se cruzan, pero eso es
          presentación: no cambian el número que queda abierto.
        </p>

        <h3>Cuándo se pasa</h3>
        <p>
          Solo podés pasar si <strong>no tenés ninguna ficha jugable</strong>. No
          es una decisión estratégica: si tenés con qué jugar, jugás. Un pase es
          información valiosa para todos en la mesa — cuando alguien pasa, todos
          saben qué números no tiene, y eso cambia el resto de la mano.
        </p>

        <h3>Robar del pozo (solo en 1vs1)</h3>
        <p>
          En las partidas de dos jugadores quedaron 14 fichas sin repartir. Si te
          toca jugar y no tenés ficha que entre, <strong>tenés que robar del
          pozo</strong> antes de poder pasar: se toma de a una ficha por vez, y
          podés seguir robando mientras el pozo tenga fichas. Recién cuando el
          pozo queda vacío y seguís sin poder jugar, se pasa el turno.
        </p>
        <p>
          Con cuatro jugadores esto no aplica: como no sobra ninguna ficha, no hay
          pozo del que robar.
        </p>
      </section>

      <section className="pdemo-section">
        <h2>Cómo termina una mano</h2>
        <p>Una mano se cierra de dos maneras.</p>

        <h3>Dominó</h3>
        <p>
          Alguien se queda <strong>sin fichas</strong>. Su equipo suma todos los
          puntos —los <em>pips</em>— que les quedaron en la mano a los rivales.
          Cuantas más fichas cargadas les queden, más grande el golpe.
        </p>

        <h3>Tranca</h3>
        <p>
          Nadie puede jugar y el juego se traba. Acá no gana el que trancó, sino el
          equipo que tenga <strong>menos pips en la mano</strong>. Y el detalle que
          más se confunde: ese equipo suma <strong>todos los pips que quedaron
          sobre la mesa</strong>, los de los dos equipos, no solo los del rival.
          Por eso una tranca bien armada puede valer mucho más que un dominó.
        </p>
      </section>

      <section className="pdemo-section">
        <h2>Cómo se cuentan los puntos</h2>

        <h3>Capicúa</h3>
        <p>
          Si la <strong>última ficha que ponés encajaba en los dos extremos</strong> de
          la mesa, cerraste con capicúa y tu equipo suma un bono de{' '}
          <strong>30 puntos</strong> en vez de los pips del rival. Es la jugada más
          celebrada del dominó dominicano, y no se busca: se da.
        </p>
        <p>
          Hay una excepción: si ese bono llevaría a tu equipo <em>por encima</em> del
          objetivo de la partida, no se aplica y se cuentan los pips reales del
          rival. O sea, no se gana una partida con el bono de capicúa — se gana
          jugando.
        </p>

        <h3>Pasó a todos</h3>
        <p>
          Si ponés una ficha y <strong>todos los demás pasan</strong>, volviendo el
          turno a vos, tu equipo suma <strong>30 puntos</strong> de bono y la mano
          sigue. Igual que con la capicúa, el bono no se aplica si te haría pasar
          el objetivo.
        </p>

        <h3>Ganar la partida</h3>
        <p>
          La partida se juega <strong>a puntos</strong>, no a una sola mano: se
          reparte de nuevo tantas veces como haga falta hasta que un equipo llega
          al objetivo, que puede ser de <strong>100, 150 o 200 puntos</strong> según
          cómo se haya creado la sala. Los pips de una tranca siempre se suman
          completos, aunque con eso se pase del objetivo.
        </p>
      </section>

      <section className="pdemo-section">
        <h2>Glosario rápido</h2>
        <dl className="reglas-glosario">
          <dt>Pips</dt>
          <dd>Los puntos dibujados en cada mitad de la ficha. Son los que se cuentan al cerrar la mano.</dd>
          <dt>Dominó</dt>
          <dd>Quedarse sin fichas y cerrar la mano.</dd>
          <dt>Capicúa</dt>
          <dd>Cerrar con una ficha que entraba por los dos extremos de la mesa.</dd>
          <dt>Tranca</dt>
          <dd>La mano se traba porque nadie puede jugar. Gana quien tenga menos pips en la mano.</dd>
          <dt>Pozo</dt>
          <dd>Las fichas que no se repartieron. Solo existe en partidas de dos jugadores.</dd>
          <dt>Paso</dt>
          <dd>Perder el turno por no tener ninguna ficha que encaje.</dd>
        </dl>
      </section>
    </article>
  );
}
