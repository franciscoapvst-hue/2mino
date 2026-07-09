import { useEffect, useState } from 'react';
import { listFlags, toggleFlag } from '../lib/api';
import type { FeatureFlag } from '../lib/types';
import Toggle from '../components/Toggle';
import Badge from '../components/Badge';

export default function FeatureFlagsView() {
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    listFlags()
      .then(setFlags)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar.'));
  }

  useEffect(refresh, []);

  async function handleToggle(clave: string, next: boolean) {
    setPending(clave);
    try {
      const updated = await toggleFlag(clave, next);
      setFlags((prev) => prev?.map((f) => (f.clave === clave ? updated : f)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="bo-page-header">
        <div>
          <h1>Feature flags</h1>
          <p>
            Proxy directo a <code>GET/PATCH /config/:clave</code> de <code>ms-frontend-landing</code> — activar o
            desactivar no requiere redeploy.
          </p>
        </div>
      </div>

      <div className="bo-table-wrap">
        {error ? (
          <p className="bo-table-empty bo-form-error">
            {error} — <button type="button" className="bo-link-btn" onClick={refresh}>reintentar</button>
          </p>
        ) : !flags ? (
          <p className="bo-table-empty">Cargando…</p>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Clave</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th aria-label="Activar/desactivar" />
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.clave}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-dim)' }}>{flag.clave}</td>
                  <td style={{ fontFamily: 'var(--font-ui)', whiteSpace: 'normal', color: 'var(--ink)', maxWidth: 420 }}>
                    {flag.descripcion}
                  </td>
                  <td>
                    <Badge tone={flag.habilitado ? 'accent' : 'muted'}>{flag.habilitado ? 'Habilitado' : 'Deshabilitado'}</Badge>
                  </td>
                  <td>
                    <Toggle
                      checked={flag.habilitado}
                      disabled={pending === flag.clave}
                      label={`Activar ${flag.clave}`}
                      onChange={(next) => handleToggle(flag.clave, next)}
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
