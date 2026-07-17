import { useEffect, useMemo, useState } from 'react';
import { deleteUsuario, listSegmentos, listUsuarios, setUsuarioEstado, setUsuarioSegmento } from '../lib/api';
import type { Segmento, Usuario } from '../lib/types';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';
import UsuarioDetalleModal from '../components/UsuarioDetalleModal';

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [query, setQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<Usuario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh(q = query) {
    setError(null);
    listUsuarios(q)
      .then(setUsuarios)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar.'));
  }

  useEffect(() => {
    listSegmentos().then(setSegmentos).catch(() => {});
    refresh('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => refresh(query), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const segmentoById = useMemo(() => new Map(segmentos.map((s) => [s.id, s])), [segmentos]);

  async function handleSegmentoChange(u: Usuario, segmentoId: string) {
    try {
      const updated = await setUsuarioSegmento(u.id, segmentoId);
      setUsuarios((prev) => prev?.map((x) => (x.id === u.id ? updated : x)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el segmento.');
    }
  }

  async function confirmEstadoToggle() {
    if (!confirmTarget) return;
    try {
      const updated = await setUsuarioEstado(confirmTarget.id, !confirmTarget.activo);
      setUsuarios((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
    } finally {
      setConfirmTarget(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setEliminando(true);
    try {
      await deleteUsuario(deleteTarget.id);
      setUsuarios((prev) => prev?.filter((x) => x.id !== deleteTarget.id) ?? null);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div>
      <div className="bo-page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Banear no borra nada — flag `activo`, reversible, no rompe FKs de salas/ranked/amigos.</p>
        </div>
      </div>

      <div className="bo-toolbar">
        <input
          className="bo-input"
          style={{ width: 280 }}
          placeholder="Buscar por username o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <p className="bo-form-error" style={{ marginBottom: 12 }}>
          {error} — <button type="button" className="bo-link-btn" onClick={() => refresh()}>reintentar</button>
        </p>
      )}

      <div className="bo-table-wrap">
        {!usuarios ? (
          error ? null : <p className="bo-table-empty">Cargando…</p>
        ) : usuarios.length === 0 ? (
          <p className="bo-table-empty">Sin resultados para "{query}".</p>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Segmento</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button
                      type="button"
                      className="bo-link-btn"
                      style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}
                      onClick={() => setDetalleId(u.id)}
                    >
                      {u.username}
                    </button>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                  <td>
                    <select
                      className="bo-select"
                      value={u.segmentoId}
                      onChange={(e) => handleSegmentoChange(u, e.target.value)}
                      aria-label={`Segmento de ${u.username}`}
                    >
                      {segmentos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge tone={u.activo ? 'success' : 'danger'}>{u.activo ? 'Activo' : 'Baneado'}</Badge>
                  </td>
                  <td>
                    <div className="bo-table-actions">
                      <button
                        type="button"
                        className={`bo-btn ${u.activo ? 'bo-btn-danger' : 'bo-btn-ghost'}`}
                        onClick={() => setConfirmTarget(u)}
                      >
                        {u.activo ? 'Banear' : 'Reactivar'}
                      </button>
                      <button
                        type="button"
                        className="bo-btn bo-btn-danger"
                        onClick={() => setDeleteTarget(u)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title={confirmTarget?.activo ? `Banear a ${confirmTarget?.username}` : `Reactivar a ${confirmTarget?.username}`}
        body={
          confirmTarget?.activo
            ? 'La cuenta queda desactivada de inmediato: no podrá iniciar sesión hasta que la reactives. No se borra ningún dato.'
            : 'La cuenta vuelve a poder iniciar sesión con normalidad.'
        }
        confirmLabel={confirmTarget?.activo ? 'Banear' : 'Reactivar'}
        tone={confirmTarget?.activo ? 'danger' : 'primary'}
        onConfirm={confirmEstadoToggle}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Eliminar a ${deleteTarget?.username}`}
        body={
          'Borrado real, no reversible (a diferencia de banear). Libera el ' +
          'email y el username para volver a registrarse — útil para ' +
          'cuentas de prueba. Si esta cuenta jugó partidas reales contra ' +
          'otros usuarios, su historial/amigos pueden mostrar una ' +
          'referencia rota; para jugadores reales, preferir "Banear".'
        }
        confirmLabel={eliminando ? 'Eliminando…' : 'Eliminar'}
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <UsuarioDetalleModal usuarioId={detalleId} onClose={() => setDetalleId(null)} />

      {segmentoById.size === 0 && null}
    </div>
  );
}
