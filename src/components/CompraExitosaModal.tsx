import { useEffect } from 'react';
import type { TiendaItem } from '../api';
import CosmeticoPreview from './CosmeticoPreview';

// Feedback de compra (docs/PLAN_COSMETICOS.md, Tienda v2 Etapa C). Celebración
// cálida en estilo de marca — un brillo ámbar/teal, nada de tragamonedas. La
// animación es puramente CSS y se apaga con prefers-reduced-motion (ver
// tienda.css). Ofrece equipar de una, para cerrar el loop comprar→usar.
type Props = {
  item:      TiendaItem;
  equipando: boolean;
  onEquipar: () => void;
  onClose:   () => void;
};

export default function CompraExitosaModal({ item, equipando, onEquipar, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const equipable = item.categoria === 'ficha' || item.categoria === 'tablero';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compra-modal" onClick={e => e.stopPropagation()}>
        <div className="compra-modal-glow" aria-hidden="true" />
        <div className="compra-modal-preview">
          <CosmeticoPreview categoria={item.categoria} clave={item.clave} />
        </div>
        <h3 className="compra-modal-titulo">¡Ya es tuyo!</h3>
        <p className="compra-modal-nombre">{item.nombre}</p>
        <div className="compra-modal-acciones">
          {equipable && (
            <button className="compra-modal-equipar" onClick={onEquipar} disabled={equipando}>
              {equipando ? 'Equipando…' : 'Equipar ahora'}
            </button>
          )}
          <button className="compra-modal-seguir" onClick={onClose}>
            {equipable ? 'Seguir' : 'Listo'}
          </button>
        </div>
      </div>
    </div>
  );
}
