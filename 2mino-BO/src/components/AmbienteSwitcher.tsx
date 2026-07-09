import { AMBIENTES, getAmbiente, setAmbiente, type Ambiente } from '../lib/env';
import { logout } from '../lib/api';
import './ambiente-switcher.css';

export default function AmbienteSwitcher() {
  const actual = getAmbiente();

  function elegir(a: Ambiente) {
    if (a === actual) return;
    const opcion = AMBIENTES.find((x) => x.id === a);
    if (!opcion?.disponible) return;

    // Prod es real: confirmación explícita antes de cambiar el contexto
    // de todo lo que se ve/edita en el panel a partir de acá.
    if (a === 'prod') {
      const ok = window.confirm(
        'Vas a conectarte a PRODUCCIÓN.\n\nA partir de acá vas a ver y poder modificar usuarios, segmentos y ' +
        'feature flags reales. ¿Continuar?',
      );
      if (!ok) return;
    }

    // Un JWT de un ambiente no sirve en otro (usuarios y JWT_SECRET
    // distintos) — cambiar de ambiente siempre implica loguearse de nuevo.
    setAmbiente(a);
    logout();
    window.location.reload();
  }

  return (
    <div className={`amb-switch amb-switch-${actual}`} role="radiogroup" aria-label="Ambiente">
      {AMBIENTES.map((amb) => (
        <button
          key={amb.id}
          type="button"
          role="radio"
          aria-checked={amb.id === actual}
          disabled={!amb.disponible}
          className={`amb-btn amb-btn-${amb.id}${amb.id === actual ? ' is-active' : ''}`}
          onClick={() => elegir(amb.id)}
          title={amb.disponible ? amb.label : `${amb.label}: no configurado`}
        >
          {amb.label}
        </button>
      ))}
    </div>
  );
}
