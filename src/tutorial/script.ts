// ── Guion del tutorial interactivo ────────────────────────────────
// Nada de esto toca el backend: es una partida 100% simulada en el
// cliente, con la misma estructura visual que GameBoard real (mismas
// clases game-*, score-bar, my-hand, etc. — ver src/game.css), para que
// lo aprendido acá se vea idéntico a la partida de verdad.
export type PasoId =
  | 'bienvenida' | 'marcador' | 'turno' | 'mesa' | 'jugar' | 'pasar' | 'chat' | 'salir' | 'fin';

// Qué elemento de la pantalla se resalta en cada paso (o null = ninguno).
export type Foco = 'score' | 'turno' | 'mesa' | 'mano' | 'pasar' | 'chat' | 'salir' | null;

export type Paso = {
  id: PasoId;
  foco: Foco;
  titulo: string;
  cuerpo: string;
  /** 'siguiente' = botón manual · 'jugar-pieza'/'pasar' = requiere esa acción en la mesa falsa. */
  accion: 'siguiente' | 'jugar-pieza' | 'pasar' | 'terminar';
};

export const PASOS: Paso[] = [
  {
    id: 'bienvenida', foco: null,
    titulo: '¡Bienvenido a la mesa!',
    cuerpo: 'Te mostramos lo básico en unos pasos rápidos. Puedes saltarlo cuando quieras con el botón de arriba.',
    accion: 'siguiente',
  },
  {
    id: 'marcador', foco: 'score',
    titulo: 'El marcador',
    cuerpo: '“Nosotros” es tu equipo, “Ellos” el equipo rival. Una partida se juega a 100, 150 o 200 puntos — el primero que llega, gana.',
    accion: 'siguiente',
  },
  {
    id: 'turno', foco: 'turno',
    titulo: 'De quién es el turno',
    cuerpo: 'Este aviso cambia entre “¡Tu turno!” y el nombre de quien le toca. Solo puedes jugar una ficha cuando es tu turno.',
    accion: 'siguiente',
  },
  {
    id: 'mesa', foco: 'mesa',
    titulo: 'La mesa',
    cuerpo: 'Las fichas se acomodan solas en fila. Cuando ya no caben, la cadena gira — como una serpiente.',
    accion: 'siguiente',
  },
  {
    id: 'jugar', foco: 'mano',
    titulo: 'Jugar una ficha',
    cuerpo: 'Toca la ficha resaltada para jugarla. En una partida real solo se resaltan las que de verdad te sirven en ese momento.',
    accion: 'jugar-pieza',
  },
  {
    id: 'pasar', foco: 'pasar',
    titulo: 'Pasar turno',
    cuerpo: 'Si ninguna ficha de tu mano encaja en la mesa, usa “Pasar”. Pruébalo.',
    accion: 'pasar',
  },
  {
    id: 'chat', foco: 'chat',
    titulo: 'Chat de la partida',
    cuerpo: 'Con este botón hablas con tu rival o compañero — con emojis incluidos.',
    accion: 'siguiente',
  },
  {
    id: 'salir', foco: 'salir',
    titulo: 'Salir de la partida',
    cuerpo: 'Ojo con esto: en partidas ranked, salir a mitad cuenta como derrota y pierdes ELO.',
    accion: 'siguiente',
  },
  {
    id: 'fin', foco: null,
    titulo: '¡Listo!',
    cuerpo: 'Ya sabes lo esencial — el resto lo aprendes jugando. Nos vemos en la mesa.',
    accion: 'terminar',
  },
];
