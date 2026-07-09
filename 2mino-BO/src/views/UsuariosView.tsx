import { useEffect, useMemo, useState } from 'react';
import { listSegmentos, listUsuarios, setUsuarioEstado, setUsuarioSegmento } from '../lib/api';
import type { Segmento, Usuario } from '../lib/types';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [query, setQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<Usuario | null>(null);

  function refresh(q = query) {
    listUsuarios(q).then(setUsuarios);
  }

  useEffect(() => {
    listSegmentos().then(setSegmentos);
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
    const updated = await setUsuarioSegmento(u.id, segmentoId);
    setUsuarios((prev) => prev?.map((x) => (x.id === u.id ? updated : x)) ?? null);
  }

  async function confirmEstadoToggle() {
    if (!confirmTarget) return;
    const updated = await setUsuarioEstado(confirmTarget.id, !confirmTarget.activo);
    setUsuarios((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
    setConfirmTarget(null);
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

      <div className="bo-table-wrap">
        {!usuarios ? (
          <p className="bo-table-empty">Cargando…</p>
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
                  <td style={{ fontFamily: 'var(--font-ui)', fontWeight: 600 }}>{u.username}</td>
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

      {segmentoById.size === 0 && null}
    </div>
  );
}
