import { useEffect, useRef, useState } from 'react';
import { getUsuarioCompleto } from '../lib/api';
import type { UsuarioCompleto } from '../lib/types';
import Badge from './Badge';
import './modal.css';

type Props = {
  usuarioId: string | null;
  onClose: () => void;
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function UsuarioDetalleModal({ usuarioId, onClose }: Props) {
  const [detalle, setDetalle] = useState<UsuarioCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!usuarioId) return;
    setDetalle(null);
    setError(null);
    getUsuarioCompleto(usuarioId)
      .then(setDetalle)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el usuario.'));
  }, [usuarioId]);

  useEffect(() => {
    if (!usuarioId) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usuarioId, onClose]);

  if (!usuarioId) return null;

  return (
    <div className="bo-modal-backdrop" onClick={onClose}>
      <div
        className="bo-modal bo-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bo-user-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bo-modal-header">
          <h2 id="bo-user-modal-title">{detalle?.username ?? 'Usuario'}</h2>
          <button type="button" className="bo-btn bo-btn-ghost" ref={closeRef} onClick={onClose}>
            Cerrar
          </button>
        </div>

        {error && <p className="bo-form-error">{error}</p>}

        {!detalle && !error && <p className="bo-table-empty">Cargando…</p>}

        {detalle && (
          <div className="bo-detail-grid">
            <div className="bo-detail-field">
              <span className="bo-detail-label">Email</span>
              <span className="bo-detail-value">{detalle.email}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Estado</span>
              <Badge tone={detalle.activo ? 'success' : 'danger'}>
                {detalle.activo ? 'Activo' : 'Baneado'}
              </Badge>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Segmento</span>
              <span className="bo-detail-value">{detalle.segmento ?? '—'}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Avatar</span>
              <span className="bo-detail-value">{detalle.avatar ?? '—'}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">ELO</span>
              <span className="bo-detail-value">{detalle.elo}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Partidas jugadas</span>
              <span className="bo-detail-value">{detalle.partidas}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Partidas ganadas</span>
              <span className="bo-detail-value">{detalle.ganadas}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Cuenta creada</span>
              <span className="bo-detail-value">{fmtFecha(detalle.createdAt)}</span>
            </div>
            <div className="bo-detail-field">
              <span className="bo-detail-label">Última actualización</span>
              <span className="bo-detail-value">{fmtFecha(detalle.updatedAt)}</span>
            </div>
            {detalle.segmentoConfig && Object.keys(detalle.segmentoConfig).length > 0 && (
              <div className="bo-detail-field bo-detail-field-full">
                <span className="bo-detail-label">Config del segmento</span>
                <pre className="bo-detail-json">{JSON.stringify(detalle.segmentoConfig, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
