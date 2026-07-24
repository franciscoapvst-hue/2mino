import DominoPiece from './game/DominoPiece';
import { SKIN_TABLERO_PREVIEW, skinTableroDef, type SkinFicha } from '../skins';
import { avatarUrl } from '../avatars';

// Preview visual de un cosmético para la tienda y el inventario. La ficha
// se dibuja de verdad (mini-DominoPiece con la skin) en vez de un swatch de
// color — así se ve el pip/número/material real, no una aproximación.
// Tablero: swatch de color por ahora (Etapa B lo cambia por la textura).
// Avatar: la propia imagen.
type Props = {
  categoria: string;
  clave:     string;
};

export default function CosmeticoPreview({ categoria, clave }: Props) {
  if (categoria === 'ficha') {
    return (
      <div className="cosmetico-preview cosmetico-preview-ficha">
        <DominoPiece a={6} b={3} orient="h" skin={clave as SkinFicha} style={{ width: 108, height: 58 }} />
      </div>
    );
  }

  if (categoria === 'tablero') {
    const def = skinTableroDef(clave);
    // Tablero de imagen: se muestra la textura real (con su logo horneado) —
    // el mejor "preview" posible es una miniatura de la propia mesa.
    if (def.tipo === 'imagen') {
      return (
        <div
          className="cosmetico-preview cosmetico-preview-tablero-img"
          style={{ backgroundImage: `url(${def.url})` }}
        >
          <DominoPiece a={5} b={2} orient="h" style={{ width: 68, height: 37 }} />
        </div>
      );
    }
    const color = SKIN_TABLERO_PREVIEW[clave] ?? '#0a0f0d';
    return (
      <div className="cosmetico-preview cosmetico-preview-tablero" style={{ background: color }}>
        <DominoPiece a={5} b={2} orient="h" style={{ width: 74, height: 40 }} />
      </div>
    );
  }

  if (categoria === 'avatar') {
    const url = avatarUrl(clave);
    return (
      <div className="cosmetico-preview cosmetico-preview-avatar">
        {url ? <img src={url} alt="" /> : <span className="cosmetico-preview-fallback">?</span>}
      </div>
    );
  }

  return <div className="cosmetico-preview" />;
}
