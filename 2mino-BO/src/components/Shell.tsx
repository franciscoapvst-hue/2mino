import type { ReactNode } from 'react';
import AmbienteSwitcher from './AmbienteSwitcher';
import './shell.css';

export type View = 'flags' | 'usuarios' | 'segmentos' | 'reglas';

const NAV: { view: View; label: string; hint: string }[] = [
  { view: 'flags', label: 'Feature flags', hint: 'FF' },
  { view: 'usuarios', label: 'Usuarios', hint: 'US' },
  { view: 'segmentos', label: 'Segmentos', hint: 'SG' },
  { view: 'reglas', label: 'Reglas del juego', hint: 'RJ' },
];

type Props = {
  active: View;
  onNavigate: (view: View) => void;
  adminUsername: string;
  onLogout: () => void;
  children: ReactNode;
};

export default function Shell({ active, onNavigate, adminUsername, onLogout, children }: Props) {
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
