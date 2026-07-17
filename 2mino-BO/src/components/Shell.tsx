import { useState, type ReactNode } from 'react';
import AmbienteSwitcher from './AmbienteSwitcher';
import './shell.css';

const GRAFANA_LAUNCHER_URL = 'http://localhost:4590/start';
const GRAFANA_URL = 'http://localhost:3030';

export type View = 'flags' | 'usuarios' | 'segmentos' | 'reglas' | 'torneos';

const NAV: { view: View; label: string; hint: string }[] = [
  { view: 'flags', label: 'Feature flags', hint: 'FF' },
  { view: 'usuarios', label: 'Usuarios', hint: 'US' },
  { view: 'segmentos', label: 'Segmentos', hint: 'SG' },
  { view: 'reglas', label: 'Reglas del juego', hint: 'RJ' },
  { view: 'torneos', label: 'Torneos', hint: 'TR' },
];

type Props = {
  active: View;
  onNavigate: (view: View) => void;
  adminUsername: string;
  onLogout: () => void;
  children: ReactNode;
};

export default function Shell({ active, onNavigate, adminUsername, onLogout, children }: Props) {
  const [abriendoGrafana, setAbriendoGrafana] = useState(false);

  // El click dispara scripts/grafana-launcher.cjs (ventana aparte, la
  // levanta iniciar-bo.bat) — abre el túnel de métricas si hace falta y
  // levanta monitoring/docker-compose.yml, recién ahí navega la pestaña.
  // La pestaña se abre EN BLANCO acá mismo (síncrono con el click) y se
  // navega después del await — si se llamara a window.open() recién
  // después del fetch, el navegador ya no lo cuenta como gesto del
  // usuario y bloquea el popup.
  async function handleAbrirGrafana() {
    const pestaña = window.open('', '_blank');
    setAbriendoGrafana(true);
    try {
      await fetch(GRAFANA_LAUNCHER_URL);
    } catch {
      /* lanzador no disponible — se navega igual, por si Grafana ya
         estaba arriba de una sesión anterior */
    } finally {
      setAbriendoGrafana(false);
      if (pestaña) pestaña.location.href = GRAFANA_URL;
    }
  }

  return (
    <div className="bo-shell">
      <nav className="bo-nav" aria-label="Navegación del Back Office">
        <div className="bo-nav-brand">
          <span className="bo-nav-brand-mark" aria-hidden="true" />
          <span>2mino BO</span>
        </div>
        <div className="bo-nav-ambiente">
          <AmbienteSwitcher />
        </div>
        <ul className="bo-nav-list">
          {NAV.map((item) => (
            <li key={item.view}>
              <button
                type="button"
                className={`bo-nav-item${item.view === active ? ' is-active' : ''}`}
                onClick={() => onNavigate(item.view)}
                aria-current={item.view === active ? 'page' : undefined}
              >
                <span className="bo-nav-item-hint">{item.hint}</span>
                {item.label}
              </button>
            </li>
          ))}
          <li>
            {/* No es una vista interna (no cambia `active`) — dispara
                scripts/grafana-launcher.cjs (túnel de métricas + docker
                compose up en monitoring/) y abre el dashboard en una
                pestaña aparte. Puerto 3030, no 3001: ese lo usa el túnel
                a producción (scripts/tunnel-prod.cjs). */}
            <button
              type="button"
              className="bo-nav-item"
              onClick={handleAbrirGrafana}
              disabled={abriendoGrafana}
            >
              <span className="bo-nav-item-hint">GF</span>
              {abriendoGrafana ? 'Iniciando…' : 'Grafana ↗'}
            </button>
          </li>
        </ul>
        <div className="bo-nav-footer">
          <span className="bo-nav-user" title={adminUsername}>
            {adminUsername}
          </span>
          <button type="button" className="bo-nav-logout" onClick={onLogout}>
            Salir
          </button>
        </div>
      </nav>
      <main className="bo-content">{children}</main>
    </div>
  );
}
