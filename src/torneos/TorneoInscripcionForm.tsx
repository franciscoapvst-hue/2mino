import { useEffect, useState } from 'react';
import { obtenerTorneo, crearEquipo, simularPago } from './mockData';
import type { Torneo, CampoInscripcion } from './types';
import { BackIcon } from '../components/icons';
import PdfPreview from './PdfPreview';
import './torneos.css';

type Props = {
  torneoId: string;
  onVolver: () => void;
  onListo: (torneoId: string) => void;
};

type Paso = 'form' | 'pago' | 'procesando' | 'codigo';

function Campo({ campo, valor, onChange }: { campo: CampoInscripcion; valor: string; onChange: (v: string) => void }) {
  const inputType = campo.tipo === 'email' ? 'email' : campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text';
  return (
    <label className="tor-field">
      <span className="tor-field-label">{campo.etiqueta}{campo.requerido && <span className="tor-field-req"> *</span>}</span>
      <input
        className="tor-input"
        type={inputType}
        value={valor}
        onChange={e => onChange(e.target.value)}
        required={campo.requerido}
      />
    </label>
  );
}

export default function TorneoInscripcionForm({ torneoId, onVolver, onListo }: Props) {
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [paso, setPaso] = useState<Paso>('form');
  const [equipoId, setEquipoId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false);

  useEffect(() => { obtenerTorneo(torneoId).then(setTorneo); }, [torneoId]);

  if (!torneo) {
    return <div className="tor-shell"><div className="tor-loading-wrap"><p className="tor-loading">Cargando…</p></div></div>;
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const faltante = torneo!.campos.find(c => c.requerido && !respuestas[c.clave]?.trim());
    if (faltante) {
      setError(`Falta completar: ${faltante.etiqueta}`);
      return;
    }
    if (torneo!.reglamentoPdfUrl && !aceptaPoliticas) {
      setError('Tenés que aceptar las políticas del torneo para continuar.');
      return;
    }
    if (torneo!.cuotaMonto > 0) {
      setPaso('pago');
    } else {
      setPaso('procesando');
      crearYAvanzar();
    }
  }

  async function crearYAvanzar() {
    const { equipo, requierePago } = await crearEquipo(torneo!.id, { nombreEquipo, respuestas });
    setEquipoId(equipo.id);
    if (requierePago) {
      setPaso('pago');
    } else {
      setCodigo(equipo.codigoEquipo);
      setPaso('codigo');
    }
  }

  async function handlePagar() {
    setPaso('procesando');
    // Mock: crea el equipo (si no existe) y simula el retorno "aprobado" de AZUL.
    let id = equipoId;
    if (!id) {
      const { equipo } = await crearEquipo(torneo!.id, { nombreEquipo, respuestas });
      id = equipo.id;
      setEquipoId(id);
    }
    const equipoActualizado = await simularPago(torneo!.id, id);
    setCodigo(equipoActualizado.codigoEquipo);
    setPaso('codigo');
  }

  return (
    <div className="tor-shell">
      <nav className="tor-nav">
        <button className="btn-back" onClick={onVolver}><BackIcon /> Cancelar</button>
        <span className="tor-nav-title">Inscribirme — {torneo.nombre}</span>
        <span aria-hidden style={{ width: 90 }} />
      </nav>

      <div className="tor-form-wrap">
        {paso === 'form' && (
          <form className="tor-panel" onSubmit={handleSubmitForm}>
            <h2 className="tor-panel-title">Tus datos</h2>
            <p className="tor-panel-text">
              Vas a crear el equipo — luego compartís un código con tu compañero para completarlo.
            </p>
            <label className="tor-field">
              <span className="tor-field-label">Nombre del equipo (opcional)</span>
              <input className="tor-input" value={nombreEquipo} onChange={e => setNombreEquipo(e.target.value)} placeholder="ej. Los Capicúas" />
            </label>
            {torneo.campos.map(c => (
              <Campo
                key={c.id}
                campo={c}
                valor={respuestas[c.clave] ?? ''}
                onChange={v => setRespuestas(r => ({ ...r, [c.clave]: v }))}
              />
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
              disabled={!!torneo.reglamentoPdfUrl && !aceptaPoliticas}
            >
              {torneo.cuotaMonto > 0 ? 'Continuar al pago' : 'Crear mi equipo'}
            </button>
          </form>
        )}

        {paso === 'pago' && (
          <div className="tor-panel">
            <h2 className="tor-panel-title">Pago de inscripción</h2>
            <div className="tor-pago-resumen">
              <span>Cuota por equipo</span>
              <strong>RD${(torneo.cuotaMonto / 100).toFixed(0)}</strong>
            </div>
            {torneo.politicaReembolso && (
              <p className="tor-panel-text tor-politica">{torneo.politicaReembolso}</p>
            )}
            <p className="tor-aviso-azul">
              Serás redirigido a la página segura de AZUL. No ingreses datos de tarjeta fuera de ese sitio.
            </p>
            <button className="btn-primary tor-form-submit" onClick={handlePagar}>
              Pagar con tarjeta (AZUL)
            </button>
            <p className="tor-mock-note">* Mock de diseño: este botón simula un pago aprobado, no llama a AZUL todavía.</p>
          </div>
        )}

        {paso === 'procesando' && (
          <div className="tor-panel tor-procesando">
            <div className="tor-spinner" />
            <p className="tor-panel-text">Procesando pago…</p>
          </div>
        )}

        {paso === 'codigo' && codigo && (
          <div className="tor-panel tor-panel-mine">
            <h2 className="tor-panel-title">¡Estás dentro!</h2>
            <p className="tor-panel-text">Falta tu compañero — tu equipo no compite hasta que se una.</p>
            <div className="tor-codigo-box">
              <span className="tor-codigo-label">Código de tu equipo</span>
              <span className="tor-codigo-valor">{codigo}</span>
            </div>
            <button className="btn-primary tor-form-submit" onClick={() => onListo(torneo.id)}>
              Ir al torneo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
