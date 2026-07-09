import SnakeBoard from './SnakeBoard';
import type { FichaTablero } from '../../api';

type Props = {
  tablero: FichaTablero[];
  containerWidth: number;
  emptyHint: string;
  emptyClassName?: string;
};

/** SnakeBoard sin interacción (replay, tutorial): mismo layout serpiente
 *  que la partida real, sin drag/tap/fantasma — todo lo interactivo es
 *  no-op. */
export default function SnakeBoardReadOnly({ tablero, containerWidth, emptyHint, emptyClassName }: Props) {
  if (tablero.length === 0) {
    return <p className={emptyClassName}>{emptyHint}</p>;
  }
  if (containerWidth <= 0) return null;

  return (
    <SnakeBoard
      tablero={tablero}
      containerWidth={containerWidth}
      nuevaFichaIdx={null}
      piezaFantasma={null}
      canIzq={false}
      canDer={false}
      sobreIzq={false}
      sobreDer={false}
      onPlayIzq={() => {}}
      onPlayDer={() => {}}
      onDragOverIzq={() => {}}
      onDragOverDer={() => {}}
      onDragLeave={() => {}}
    />
  );
}
