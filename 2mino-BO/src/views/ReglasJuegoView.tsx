import { useEffect, useState } from 'react';
import { listReglas, updateRegla } from '../lib/api';
import type { ReglaJuego } from '../lib/types';

export default function ReglasJuegoView() {
  const [reglas, setReglas] = useState<ReglaJuego[] | null>(null);
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});

  function refresh() {
    setError(null);
    listReglas()
      .then((rows) => {
        setReglas(rows);
        setEditados(Object.fromEntries(rows.map((r) => [r.clave, JSON.stringify(r.valor)])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar.'));
  }

  useEffect(refresh, []);

  async function handleGuardar(clave: string) {
    let valor: unknown;
    try {
      valor = JSON.parse(editados[clave]);
    } catch {
      setErroresFila((prev) => ({ ...prev, [clave]: 'JSON inválido — revisá la sintaxis.' }));
      return;
    }
    setErroresFila((prev) => { const { [clave]: _omit, ...resto } = prev; return resto; });
    setPending(clave);
    try {
      const updated = await updateRegla(clave, valor);
      setReglas((prev) => prev?.map((r) => (r.clave === clave ? updated : r)) ?? null);
      setEditados((prev) => ({ ...prev, [clave]: JSON.stringify(updated.valor) }));
    } catch (err) {
      setErroresFila((prev) => ({ ...prev, [clave]: err instanceof Error ? err.message : 'No se pudo guardar.' }));
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="bo-page-header">
        <div>
          <h1>Reglas del juego</h1>
          <p>
            Constantes de la partida (ELO, puntajes, matchmaking) editables sin redeploy —
            proxy directo a <code>GET/PATCH /reglas/:clave</code> de <code>ms-salas</code>.
          </p>
        </div>
      </div>

      <div className="bo-table-wrap">
        {error ? (
          <p className="bo-table-empty bo-form-error">
            {error} — <button type="button" className="bo-link-btn" onClick={refresh}>reintentar</button>
          </p>
        ) : !reglas ? (
          <p className="bo-table-empty">Cargando…</p>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Clave</th>
                <th>Descripción</th>
                <th>Valor (JSON)</th>
                <th aria-label="Guardar" />
              </tr>
            </thead>
            <tbody>
              {reglas.map((regla) => (
                <tr key={regla.clave}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-dim)' }}>{regla.clave}</td>
                  <td style={{ fontFamily: 'var(--font-ui)', whiteSpace: 'normal', color: 'var(--ink)', maxWidth: 360 }}>
                    {regla.descripcion}
                  </td>
                  <td>
                    <textarea
                      className="bo-input"
                      style={{ fontFamily: 'var(--font-mono)', width: '100%', minWidth: 160, resize: 'vertical' }}
                      rows={1}
                      value={editados[regla.clave] ?? ''}
                      onChange={(e) => setEditados((prev) => ({ ...prev, [regla.clave]: e.target.value }))}
                    />
                    {erroresFila[regla.clave] && (
                      <p className="bo-form-error" style={{ margin: '4px 0 0' }}>{erroresFila[regla.clave]}</p>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="bo-btn bo-btn-primary"
                      disabled={pending === regla.clave}
                      onClick={() => handleGuardar(regla.clave)}
                    >
                      {pending === regla.clave ? 'Guardando…' : 'Guardar'}
                    </button>
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
