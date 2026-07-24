import { useEffect, useState } from 'react';
import { api } from '../api';
import { avatarOptions } from '../avatars';

type Props = {
  actual:   string | null | undefined;
  onClose:  () => void;
  onElegir: (avatar: string) => Promise<void>;
};

// Gated por posesión (docs/PLAN_COSMETICOS.md Etapa E): solo se ofrecen los
// avatares que el usuario ya tiene en su inventario — hoy los 8 originales
// son gratis para todos, así que en la práctica esto no oculta nada todavía;
// empieza a filtrar de verdad cuando se agreguen avatares pagos nuevos.
export default function AvatarPicker({ actual, onClose, onElegir }: Props) {
  const [poseidos, setPoseidos] = useState<Set<string> | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.tienda.inventario()
      .then(items => setPoseidos(new Set(items.filter(i => i.categoria === 'avatar').map(i => i.clave))))
      .catch(() => setPoseidos(new Set())); // fallo de red: mejor mostrar vacío que ofrecer algo no poseído
  }, []);

  const opciones = poseidos === null ? null : avatarOptions.filter(a => poseidos.has(a.file));

  async function elegir(file: string) {
    setGuardando(file);
    setError(null);
    try {
      await onElegir(file);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el avatar');
      setGuardando(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="avatar-picker" onClick={e => e.stopPropagation()}>
        <h3>Elige tu foto de perfil</h3>

        {error && <div className="avatar-picker-error">⚠ {error}</div>}

        {opciones === null ? (
          <p className="avatar-picker-empty">Cargando…</p>
        ) : opciones.length === 0 ? (
          <p className="avatar-picker-empty">Todavía no tienes ninguna foto de perfil. Consigue una en la Tienda.</p>
        ) : (
          <div className="avatar-grid">
            {opciones.map(a => (
              <button
                key={a.file}
                className={`avatar-option${a.file === actual ? ' avatar-option-selected' : ''}`}
                disabled={guardando !== null}
                onClick={() => elegir(a.file)}
              >
                <img src={a.url} alt="" />
                {guardando === a.file && <span className="avatar-option-loading"><span className="avatar-option-spinner" /></span>}
              </button>
            ))}
          </div>
        )}

        <button className="avatar-picker-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
