import { useEffect, useState, type FormEvent } from 'react';
import { createSegmento, listSegmentos, toggleSegmentoEstado } from '../lib/api';
import type { Segmento } from '../lib/types';
import Badge from '../components/Badge';
import Toggle from '../components/Toggle';

export default function SegmentosView() {
  const [segmentos, setSegmentos] = useState<Segmento[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    listSegmentos().then(setSegmentos);
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre del segmento es requerido.');
      return;
    }
    if (segmentos?.some((s) => s.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
      setError('Ya existe un segmento con ese nombre.');
      return;
    }
    setSaving(true);
    await createSegmento({ nombre: nombre.trim(), descripcion: descripcion.trim() });
    setSaving(false);
    setNombre('');
    setDescripcion('');
    setShowForm(false);
    refresh();
  }

  async function handleToggleEstado(id: string, activo: boolean) {
    await toggleSegmentoEstado(id, activo);
    refresh();
  }

  return (
    <div>
      <div className="bo-page-header">
        <div>
          <h1>Segmentos</h1>
          <p>Plantillas de configuración por grupo de usuarios — cero cambios de schema, solo filas en `segmentos`.</p>
        </div>
        <button type="button" className="bo-btn bo-btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nuevo segmento'}
        </button>
      </div>

      {showForm && (
        <form className="bo-inline-form" onSubmit={handleCreate}>
          <div className="bo-field" style={{ marginBottom: 0 }}>
            <label htmlFor="seg-nombre">Nombre</label>
            <input id="seg-nombre" className="bo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. beta_tester" />
          </div>
          <div className="bo-field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="seg-desc">Descripción</label>
            <input
              id="seg-desc"
              className="bo-input"
              style={{ width: '100%' }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="para qué se usa este segmento"
            />
          </div>
          <button type="submit" className="bo-btn bo-btn-primary" disabled={saving} style={{ alignSelf: 'flex-end' }}>
            {saving ? 'Guardando…' : 'Crear'}
          </button>
        </form>
      )}
      {error && <p className="bo-form-error">{error}</p>}

      <div className="bo-table-wrap" style={{ marginTop: showForm || error ? 16 : 0 }}>
        {!segmentos ? (
          <p className="bo-table-empty">Cargando…</p>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th aria-label="Activar/desactivar" />
              </tr>
            </thead>
            <tbody>
              {segmentos.map((seg) => (
                <tr key={seg.id}>
                  <td style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>{seg.nombre}</td>
                  <td style={{ fontFamily: 'var(--font-ui)', whiteSpace: 'normal', color: 'var(--muted)', maxWidth: 480 }}>
                    {seg.descripcion || '—'}
                  </td>
                  <td>
                    <Badge tone={seg.activo ? 'success' : 'muted'}>{seg.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td>
                    <Toggle
                      checked={seg.activo}
                      label={`Activar segmento ${seg.nombre}`}
                      onChange={(next) => handleToggleEstado(seg.id, next)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
