// ── Página de contenido: glosario ───────────────────────────────────────
// Apunta a consultas de término suelto ("qué es dominar en dominó", "qué
// significa tranca", "qué es el pozo"). Son búsquedas cortas y muy
// específicas: quien las hace quiere una definición, no un artículo.
//
// Solo entran términos que ocurren de verdad en una partida de 2mino. No se
// inventa jerga para engordar la página — contenido de relleno es
// exactamente lo que penaliza AdSense.

import type { ReactNode } from 'react';
import { BackIcon } from '../icons';

type Termino = { termino: string; definicion: ReactNode };

const LA_MESA: Termino[] = [
  {
    termino: 'Ficha',
    definicion: <>Cada una de las 28 piezas del set. Está dividida en dos mitades, cada una con un número del 0 al 6.</>,
  },
  {
    termino: 'Pips',
    definicion: <>Los puntos dibujados en cada mitad de la ficha. Son lo que se cuenta al cerrar la mano: la 6-4 vale 10 pips.</>,
  },
  {
    termino: 'Doble',
    definicion: <>La ficha que tiene el mismo número en sus dos mitades (0-0, 1-1… 6-6). Hay siete, y son las más difíciles de colocar porque entran por un solo número.</>,
  },
  {
    termino: 'Extremos',
    definicion: <>Los dos números abiertos en las puntas de la cadena. Son los únicos lugares donde se puede poner una ficha.</>,
  },
  {
    termino: 'Palo',
    definicion: <>El número del que tenés varias fichas. "Estar cargado de cincos" es tener los cincos como palo.</>,
  },
  {
    termino: 'Pozo',
    definicion: <>Las fichas que no se repartieron. Solo existe en partidas de dos jugadores: quedan 14 y se roba de ahí cuando no hay jugada.</>,
  },
];

const LAS_JUGADAS: Termino[] = [
  {
    termino: 'Salida',
    definicion: <>La primera ficha de la mano. En la primera mano sale quien tiene el doble más alto y está obligado a abrir con él; después abre quien ganó la mano anterior, con la ficha que quiera.</>,
  },
  {
    termino: 'Pasar',
    definicion: <>Perder el turno por no tener ninguna ficha que encaje. Solo se puede pasar si de verdad no hay jugada — y le avisa a toda la mesa qué números no tenés.</>,
  },
  {
    termino: 'Robar',
    definicion: <>Tomar una ficha del pozo cuando no tenés jugada, en partidas de dos. Se roba de a una y hay que hacerlo antes de poder pasar.</>,
  },
  {
    termino: 'Cargado',
    definicion: <>Tener muchos pips en la mano. Es peligroso: si la mano se tranca, esos puntos van a la cuenta contraria.</>,
  },
];

const LOS_CIERRES: Termino[] = [
  {
    termino: 'Dominar',
    definicion: <>Quedarse sin fichas y cerrar la mano. El equipo suma los pips que les quedaron a los rivales.</>,
  },
  {
    termino: 'Capicúa',
    definicion: <>Cerrar con una ficha que entraba por los dos extremos. Suma un bono fijo de 30 puntos en vez de los pips del rival.</>,
  },
  {
    termino: 'Tranca',
    definicion: <>La mano se traba porque nadie puede jugar. Gana el equipo con menos pips en la mano, y suma todos los pips que quedaron sobre la mesa.</>,
  },
  {
    termino: 'Pasó a todos',
    definicion: <>Ponés una ficha, todos los demás pasan y el turno vuelve a vos. Suma un bono de 30 puntos y la mano continúa.</>,
  },
];

const LA_PARTIDA: Termino[] = [
  {
    termino: 'Mano',
    definicion: <>Dos cosas, según el contexto: las fichas que tenés, y también cada ronda completa desde el reparto hasta el cierre. Una partida son varias manos.</>,
  },
  {
    termino: 'Partida',
    definicion: <>El juego completo, a puntos. Se reparte tantas veces como haga falta hasta que un equipo llega al objetivo: 100, 150 o 200 según la sala.</>,
  },
  {
    termino: 'Objetivo',
    definicion: <>Los puntos que hay que alcanzar para ganar la partida. Los bonos fijos no se aplican si te harían pasarlo; los pips de una tranca sí se suman completos.</>,
  },
];

function Bloque({ titulo, terminos }: { titulo: string; terminos: Termino[] }) {
  return (
    <section className="pdemo-section">
      <h2>{titulo}</h2>
      <dl className="reglas-glosario">
        {terminos.map(t => (
          <div key={t.termino}>
            <dt>{t.termino}</dt>
            <dd>{t.definicion}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function GlosarioView({ onBack }: { onBack: () => void }) {
  return (
    <div className="pdemo">
      <div className="pdemo-inner">
        <button className="pdemo-back" onClick={onBack}><BackIcon /> Volver</button>

        <header className="pdemo-head">
          <h1>Glosario del dominó dominicano</h1>
          <p>Qué significa cada palabra que vas a escuchar en la mesa.</p>
        </header>

        <article className="reglas-art">
          <Bloque titulo="La mesa y las fichas" terminos={LA_MESA} />
          <Bloque titulo="Las jugadas"          terminos={LAS_JUGADAS} />
          <Bloque titulo="Los cierres"          terminos={LOS_CIERRES} />
          <Bloque titulo="La partida"           terminos={LA_PARTIDA} />

          <section className="pdemo-section">
            <h2>Seguir leyendo</h2>
            <p>
              Cada término está explicado en detalle en las guías: las{' '}
              <a href="/reglas-domino-dominicano">reglas completas</a>,{' '}
              <a href="/domino-en-parejas">cómo jugar en parejas</a>,{' '}
              <a href="/capicua-domino">la capicúa</a>,{' '}
              <a href="/tranca-domino">la tranca</a> y la{' '}
              <a href="/estrategia-domino">estrategia para principiantes</a>.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
