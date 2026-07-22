import { useEffect, useState, type FormEvent } from 'react';
import { createTiendaItem, listTiendaItems, updateTiendaItem } from '../lib/api';
import type { TiendaItem } from '../lib/types';
import Badge from '../components/Badge';
import Toggle from '../components/Toggle';

const CATEGORIAS: TiendaItem['categoria'][] = ['ficha', 'tablero', 'avatar', 'marco_avatar'];

export default function TiendaView() {
  const [items, setItems] = useState<TiendaItem[] | null>(null);
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [categoria, setCategoria] = useState<TiendaItem['categoria']>('ficha');
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioNuevo, setPrecioNuevo] = useState('0');
  const [saving, setSaving] = useState(false);

  function refresh() {
    setError(null);
    listTiendaItems()
      .then((rows) => {
        setItems(rows);
        setPrecios(Object.fromEntries(rows.map((r) => [r.id, String(r.precio)])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar.'));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clave.trim() || !nombre.trim()) {
      setError('Clave y nombre son requeridos.');
      return;
    }
    const precio = Number(precioNuevo);
    if (!Number.isInteger(precio) || precio < 0) {
      setError('El precio debe ser un entero ≥ 0.');
      return;
    }
    setSaving(true);
    try {
      await createTiendaItem({ categoria, clave: clave.trim(), nombre: nombre.trim(), precio });
      setClave('');
      setNombre('');
      setPrecioNuevo('0');
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el ítem.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardarPrecio(item: TiendaItem) {
    const precio = Number(precios[item.id]);
    if (!Number.isInteger(precio) || precio < 0) {
      setErroresFila((prev) => ({ ...prev, [item.id]: 'Precio inválido (entero ≥ 0).' }));
      return;
    }
    setErroresFila((prev) => { const { [item.id]: _omit, ...resto } = prev; return resto; });
    setPending(item.id);
    try {
      const updated = await updateTiendaItem(item.id, { precio });
      setItems((prev) => prev?.map((i) => (i.id === item.id ? updated : i)) ?? null);
    } catch (err) {
      setErroresFila((prev) => ({ ...prev, [item.id]: err instanceof Error ? err.message : 'No se pudo guardar.' }));
    } finally {
      setPending(null);
    }
  }

  async function handleToggleDisponible(item: TiendaItem, disponible: boolean) {
    try {
      const updated = await updateTiendaItem(item.id, { disponible });
      setItems((prev) => prev?.map((i) => (i.id === item.id ? updated : i)) ?? null);
    } catch (err) {
      setErroresFila((prev) => ({ ...prev, [item.id]: err instanceof Error ? err.message : 'No se pudo actualizar.' }));
    }
  }

  return (
    <div>
      <div className="bo-page-header">
        <div>
          <h1>Tienda</h1>
          <p>
            Catálogo de cosméticos (docs/PLAN_COSMETICOS.md) — cambiar el precio o retirar un ítem
            de la tienda no toca código. Agregar uno acá lo suma al catálogo, pero para que se vea
            distinto en juego (una skin nueva de verdad) todavía hace falta código del lado del
            cliente (<code>src/skins.ts</code>, <code>game.css</code>) — esto no genera assets.
          </p>
        </div>
        <button type="button" className="bo-btn bo-btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nuevo ítem'}
        </button>
      </div>

      {showForm && (
        <form className="bo-inline-form" onSubmit={handleCreate}>
          <div className="bo-field" style={{ marginBottom: 0 }}>
            <label htmlFor="ti-categoria">Categoría</label>
            <select
              id="ti-categoria"
              className="bo-input"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as TiendaItem['categoria'])}
            >
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="bo-field" style={{ marginBottom: 0 }}>
            <label htmlFor="ti-clave">Clave</label>
            <input
              id="ti-clave" className="bo-input" value={clave}
              onChange={(e) => setClave(e.target.value)} placeholder="ej. ficha_zafiro"
            />
          </div>
          <div className="bo-field" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="ti-nombre">Nombre</label>
            <input
              id="ti-nombre" className="bo-input" style={{ width: '100%' }} value={nombre}
              onChange={(e) => setNombre(e.target.value)} placeholder="Nombre mostrado en la tienda"
            />
          </div>
          <div className="bo-field" style={{ marginBottom: 0 }}>
            <label htmlFor="ti-precio">Precio</label>
            <input
              id="ti-precio" type="number" min={0} className="bo-input" style={{ width: 90 }}
              value={precioNuevo} onChange={(e) => setPrecioNuevo(e.target.value)}
            />
          </div>
          <button type="submit" className="bo-btn bo-btn-primary" disabled={saving} style={{ alignSelf: 'flex-end' }}>
            {saving ? 'Guardando…' : 'Crear'}
          </button>
        </form>
      )}
      {error && <p className="bo-form-error">{error}</p>}

      <div className="bo-table-wrap" style={{ marginTop: showForm || error ? 16 : 0 }}>
        {!items ? (
          error ? null : <p className="bo-table-empty">Cargando…</p>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Clave</th>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Disponible</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><Badge tone="muted">{item.categoria}</Badge></td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-dim)' }}>{item.clave}</td>
                  <td style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>{item.nombre}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number" min={0} className="bo-input" style={{ width: 80 }}
                        value={precios[item.id] ?? ''}
                        onChange={(e) => setPrecios((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="bo-btn"
                        disabled={pending === item.id || precios[item.id] === String(item.precio)}
                        onClick={() => handleGuardarPrecio(item)}
                      >
                        {pending === item.id ? '…' : 'Guardar'}
                      </button>
                    </div>
                    {erroresFila[item.id] && <p className="bo-form-error" style={{ margin: '4px 0 0' }}>{erroresFila[item.id]}</p>}
                  </td>
                  <td>
                    <Toggle
                      checked={item.disponible}
                      label={`Disponible en la tienda: ${item.nombre}`}
                      onChange={(next) => handleToggleDisponible(item, next)}
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
