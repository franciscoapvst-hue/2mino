import { useEffect, useRef } from 'react';
import './modal.css';

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ open, title, body, confirmLabel, tone = 'primary', onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="bo-modal-backdrop" onClick={onCancel}>
      <div className="bo-modal" role="alertdialog" aria-modal="true" aria-labelledby="bo-modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="bo-modal-title">{title}</h2>
        <p>{body}</p>
        <div className="bo-modal-actions">
          <button type="button" className="bo-btn bo-btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`bo-btn ${tone === 'danger' ? 'bo-btn-danger' : 'bo-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
