import type { ReactNode } from 'react';
import { BackIcon } from '../icons';

type Props = {
  title:    string;
  subtitle?: string;
  onBack:   () => void;
  right?:   ReactNode;
};

// Header compartido por las vistas de pantalla completa nuevas
// (Amigos, Leaderboard, Historial, Replay) — mismo look que .dash-nav
// para que se sientan parte del mismo producto que el Dashboard.
export default function PageHeader({ title, subtitle, onBack, right }: Props) {
  return (
    <nav className="social-nav">
      <button className="dash-icon-btn" onClick={onBack} aria-label="Volver">
        <BackIcon />
      </button>
      <div className="social-nav-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="social-nav-right">{right}</div>}
    </nav>
  );
}
