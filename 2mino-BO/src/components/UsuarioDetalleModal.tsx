import { useEffect, useRef, useState } from 'react';
import {
  ajustarSaldoUsuario, getUsuarioBilletera, getUsuarioCompleto, getUsuarioInventario,
} from '../lib/api';
import type { Billetera, InventarioItem, UsuarioCompleto } from '../lib/types';
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

  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [inventario, setInventario] = useState<InventarioItem[] | null>(null);
  const [ajuste, setAjuste] = useState('100');
  const [ajustando, setAjustando] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState<string | null>(null);

  function refreshCosmeticos(id: string) {
    getUsuarioBilletera(id).then(setBilletera).catch(() => {});
    getUsuarioInventario(id).then(setInventario).catch(() => {});
  }

  useEffect(() => {
    if (!usuarioId) return;
    setDetalle(null);
    setError(null);
    setBilletera(null);
    setInventario(null);
    setErrorAjuste(null);
    getUsuarioCompleto(usuarioId)
      .then(setDetalle)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el usuario.'));
    refreshCosmeticos(usuarioId);
  }, [usuarioId]);

  async function handleAjustarSaldo() {
    if (!usuarioId) return;
    const monto = Number(ajuste);
    if (!Number.isInteger(monto) || monto === 0) {
      setErrorAjuste('El monto debe ser un entero distinto de 0 (negativo para descontar).');
      return;
    }
    setAjustando(true);
    setErrorAjuste(null);
    try {
      const nuevo = await ajustarSaldoUsuario(usuarioId, monto);
      setBilletera(nuevo);
    } catch (err) {
      setErrorAjuste(err instanceof Error ? err.message : 'No se pudo ajustar el saldo.');
    } finally {
      setAjustando(false);
    }
  }

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

        {/* ── Cosméticos (docs/PLAN_COSMETICOS.md) ──────────────── */}
        {detalle && (
          <div className="bo-modal-section">
            <h3 className="bo-modal-section-title">Cosméticos</h3>

            <div className="bo-detail-grid" style={{ marginBottom: 12 }}>
              <div className="bo-detail-field">
                <span className="bo-detail-label">Saldo</span>
                <span className="bo-detail-value">
                  {billetera ? `${billetera.saldo} doblones` : '…'}
                </span>
              </div>
            </div>

            <div className="bo-inline-form" style={{ marginBottom: 12 }}>
              <div className="bo-field" style={{ marginBottom: 0 }}>
                <label htmlFor="ajuste-monto">Ajustar saldo</label>
                <input
                  id="ajuste-monto" type="number" className="bo-input" style={{ width: 110 }}
                  value={ajuste} onChange={(e) => setAjuste(e.target.value)}
                />
              </div>
              <button
                type="button" className="bo-btn bo-btn-primary" disabled={ajustando}
                style={{ alignSelf: 'flex-end' }}
                onClick={handleAjustarSaldo}
              >
                {ajustando ? 'Guardando…' : 'Aplicar'}
              </button>
            </div>
            {errorAjuste && <p className="bo-form-error">{errorAjuste}</p>}

            {!inventario ? (
              <p className="bo-table-empty">Cargando…</p>
            ) : inventario.length === 0 ? (
              <p className="bo-table-empty">No tiene ningún cosmético todavía.</p>
            ) : (
              <div className="bo-table-wrap">
                <table className="bo-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Clave</th>
                      <th>Nombre</th>
                      <th>Comprado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map((it) => (
                      <tr key={it.item_id}>
                        <td><Badge tone="muted">{it.categoria}</Badge></td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-dim)' }}>{it.clave}</td>
                        <td style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>{it.nombre}</td>
                        <td style={{ color: 'var(--muted)' }}>{fmtFecha(it.comprado_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
