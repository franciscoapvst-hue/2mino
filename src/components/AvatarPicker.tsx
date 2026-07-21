import { useState } from 'react';
import { avatarOptions } from '../avatars';

type Props = {
  actual:   string | null | undefined;
  onClose:  () => void;
  onElegir: (avatar: string) => Promise<void>;
};

export default function AvatarPicker({ actual, onClose, onElegir }: Props) {
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        {avatarOptions.length === 0 ? (
          <p className="avatar-picker-empty">Todavía no hay fotos de perfil disponibles.</p>
        ) : (
          <div className="avatar-grid">
            {avatarOptions.map(a => (
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
