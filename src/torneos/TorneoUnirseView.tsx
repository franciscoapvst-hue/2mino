import { useEffect, useState } from 'react';
import { obtenerTorneo, unirseConCodigo } from './mockData';
import type { Torneo, CampoInscripcion } from './types';
import { BackIcon } from '../components/icons';
import PdfPreview from './PdfPreview';
import './torneos.css';

type Props = {
  torneoId: string;
  onVolver: () => void;
  onListo: (torneoId: string) => void;
};

function Campo({ campo, valor, onChange }: { campo: CampoInscripcion; valor: string; onChange: (v: string) => void }) {
  const inputType = campo.tipo === 'email' ? 'email' : campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text';
  return (
    <label className="tor-field">
      <span className="tor-field-label">{campo.etiqueta}{campo.requerido && <span className="tor-field-req"> *</span>}</span>
      <input className="tor-input" type={inputType} value={valor} onChange={e => onChange(e.target.value)} required={campo.requerido} />
    </label>
  );
}

export default function TorneoUnirseView({ torneoId, onVolver, onListo }: Props) {
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [codigo, setCodigo] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [unido, setUnido] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false);

  useEffect(() => { obtenerTorneo(torneoId).then(setTorneo); }, [torneoId]);

  if (!torneo) {
    return <div className="tor-shell"><div className="tor-loading-wrap"><p className="tor-loading">Cargando…</p></div></div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!codigo.trim()) { setError('Ingresá el código de tu equipo.'); return; }
    const faltante = torneo!.campos.find(c => c.requerido && !respuestas[c.clave]?.trim());
    if (faltante) { setError(`Falta completar: ${faltante.etiqueta}`); return; }
    if (torneo!.reglamentoPdfUrl && !aceptaPoliticas) {
      setError('Tenés que aceptar las políticas del torneo para continuar.');
      return;
    }

    setCargando(true);
    const resultado = await unirseConCodigo(torneo!.id, codigo.trim().toUpperCase(), respuestas);
    setCargando(false);
    if ('error' in resultado) { setError(resultado.error); return; }
    setUnido(true);
  }

  return (
    <div className="tor-shell">
      <nav className="tor-nav">
        <button className="btn-back" onClick={onVolver}><BackIcon /> Cancelar</button>
        <span className="tor-nav-title">Unirme — {torneo.nombre}</span>
        <span aria-hidden style={{ width: 90 }} />
      </nav>

      <div className="tor-form-wrap">
        {unido ? (
          <div className="tor-panel tor-panel-mine">
            <h2 className="tor-panel-title">¡Equipo completo!</h2>
            <p className="tor-panel-text">Ya están inscritos en el torneo.</p>
            <button className="btn-primary tor-form-submit" onClick={() => onListo(torneo.id)}>Ir al torneo</button>
          </div>
        ) : (
          <form className="tor-panel" onSubmit={handleSubmit}>
            <h2 className="tor-panel-title">Unirme a un equipo</h2>
            <p className="tor-panel-text">Pegá el código que te compartió tu compañero.</p>
            <label className="tor-field">
              <span className="tor-field-label">Código de equipo</span>
              <input
                className="tor-input tor-input-codigo"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="EJ. CAP42X"
                maxLength={10}
              />
            </label>
            {torneo.campos.map(c => (
              <Campo key={c.id} campo={c} valor={respuestas[c.clave] ?? ''} onChange={v => setRespuestas(r => ({ ...r, [c.clave]: v }))} />
            ))}

            {torneo.reglamentoPdfUrl && (
              <div className="tor-politicas">
                <span className="tor-field-label">Reglamento del torneo</span>
                <div className="tor-pdf-preview-wrap">
                  <PdfPreview url={torneo.reglamentoPdfUrl} />
                </div>
                <a className="tor-pdf-open-link" href={torneo.reglamentoPdfUrl} target="_blank" rel="noreferrer">
                  Abrir en una pestaña nueva ↗
                </a>
                <label className="tor-checkbox">
                  <input
                    type="checkbox"
                    checked={aceptaPoliticas}
                    onChange={e => setAceptaPoliticas(e.target.checked)}
                  />
                  <span>He leído y acepto las políticas del torneo</span>
                </label>
              </div>
            )}

            {error && <p className="tor-form-error">{error}</p>}
            <button
              type="submit"
              className="btn-primary tor-form-submit"
              disabled={cargando || (!!torneo.reglamentoPdfUrl && !aceptaPoliticas)}
            >
              {cargando ? 'Uniendo…' : 'Unirme'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
