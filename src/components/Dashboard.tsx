import type { ReactNode } from 'react';
import type { AuthUser, UserConfig } from '../api';

type Props = {
  user:          AuthUser;
  config:        UserConfig;
  dark:          boolean;
  onToggleTheme: () => void;
  onLogout:      () => void;
  onGoToSalas:   () => void;
  onPieceDemo:   () => void;
};

// ── Icons ─────────────────────────────────────────
function DominoTile() {
  return (
    <svg width="40" height="20" viewBox="0 0 52 26" aria-hidden>
      <rect width="52" height="26" rx="5" fill="#0d0520" stroke="#a855f7" strokeWidth="1.5" />
      <line x1="26" y1="4" x2="26" y2="22" stroke="#a855f7" strokeWidth="1" />
      <circle cx="13" cy="9"  r="2.4" fill="#e9d5ff" />
      <circle cx="13" cy="17" r="2.4" fill="#e9d5ff" />
      <circle cx="37" cy="8"  r="2.4" fill="#e9d5ff" />
      <circle cx="42" cy="13" r="2.4" fill="#e9d5ff" />
      <circle cx="37" cy="18" r="2.4" fill="#e9d5ff" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"   x2="6.34"  y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function CasualIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      {/* Domino 1 — landscape, línea divisoria VERTICAL */}
      <rect x="2" y="6" width="52" height="19" rx="4"
        fill="currentColor" opacity=".12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="28" y1="6" x2="28" y2="25" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="19" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="12"   r="2.2" fill="currentColor" />
      <circle cx="43" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="19"   r="2.2" fill="currentColor" />

      {/* Domino 2 — landscape, línea divisoria VERTICAL */}
      <rect x="2" y="31" width="52" height="19" rx="4"
        fill="currentColor" opacity=".20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="28" y1="31" x2="28" y2="50" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="15" cy="40.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="37"   r="2.2" fill="currentColor" />
      <circle cx="43" cy="40.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="44"   r="2.2" fill="currentColor" />
    </svg>
  );
}

function RankedIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      {/* Trophy */}
      <path d="M28 6 L34 22 L50 22 L37 31 L42 47 L28 38 L14 47 L19 31 L6 22 L22 22 Z"
        fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="28" cy="26" r="5" fill="currentColor" opacity=".5" />
    </svg>
  );
}

function SalasIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      {/* Grid of 4 door/room squares */}
      <rect x="6"  y="6"  width="19" height="19" rx="4" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5" />
      <rect x="31" y="6"  width="19" height="19" rx="4" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6"  y="31" width="19" height="19" rx="4" fill="currentColor" opacity=".28" stroke="currentColor" strokeWidth="1.5" />
      <rect x="31" y="31" width="19" height="19" rx="4" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5" />
      {/* Plus sign on bottom-left to indicate "create" */}
      <line x1="15.5" y1="37" x2="15.5" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="11.5" y1="41" x2="19.5" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Mode card ─────────────────────────────────────
type ModeCardProps = {
  title:   string;
  desc:    string;
  icon:    ReactNode;
  action:  string;
  variant: 'casual' | 'ranked' | 'salas';
  soon?:   boolean;
  onClick?: () => void;
};

function ModeCard({ title, desc, icon, action, variant, soon = true, onClick }: ModeCardProps) {
  return (
    <div className={`mode-card mode-${variant}`}>
      {soon && <span className="mode-soon">Próximamente</span>}
      <div className="mode-icon-wrap">{icon}</div>
      <div className="mode-info">
        <h3 className="mode-title">{title}</h3>
        <p className="mode-desc">{desc}</p>
      </div>
      <button className="mode-btn" disabled={soon} onClick={onClick}>
        {action}
      </button>
    </div>
  );
}

// ── Dashboard / Lobby ─────────────────────────────
export default function Dashboard({ user, config, dark, onToggleTheme, onLogout, onGoToSalas, onPieceDemo }: Props) {
  return (
    <div className="lobby-shell">

      {/* ── Nav ─────────────────────────────────── */}
      <nav className="lobby-nav">
        <div className="lobby-brand">
          <DominoTile />
          <span className="lobby-brand-name">2mino</span>
        </div>

        <div className="lobby-nav-right">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          <div className="lobby-user">
            <span className="lobby-avatar">{user.username[0].toUpperCase()}</span>
            <span className="lobby-username">@{user.username}</span>
            <span className="lobby-badge">{config.segmento}</span>
          </div>

          <button
            className="btn-nav-logout"
            style={{ background: 'rgba(168,85,247,.12)', borderColor: 'rgba(168,85,247,.3)' }}
            onClick={onPieceDemo}
            title="Ver fichas"
          >
            🁣 Fichas
          </button>

          <button className="btn-nav-logout" onClick={onLogout}>
            Salir
          </button>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────── */}
      <main className="lobby-body">
        <div className="lobby-greeting">
          <h2>
            ¡Hola, <span className="greeting-name">{user.username}</span>!
          </h2>
          <p>Elige cómo quieres jugar hoy</p>
        </div>

        <div className="mode-grid">
          <ModeCard
            variant="casual"
            title="Partida Casual"
            desc="Juega sin presión. Practica, diviértete y mejora tu juego sin afectar tu ranking."
            icon={<CasualIcon />}
            action="Buscar partida"
          />
          <ModeCard
            variant="ranked"
            title="Partida Ranked"
            desc="Compite por tu posición. Cada partida cuenta hacia tu clasificación global."
            icon={<RankedIcon />}
            action="Buscar ranked"
          />
          <ModeCard
            variant="salas"
            title="Salas Abiertas"
            desc="Explora partidas en curso, únete a una sala o crea la tuya para jugar con amigos."
            icon={<SalasIcon />}
            action="Ver salas"
            soon={false}
            onClick={onGoToSalas}
          />
        </div>

        {/* Modos de juego disponibles */}
        <div className="lobby-modes-row">
          <span className="lobby-modes-label">Modos:</span>
          {config.modos_juego.map(m => (
            <span key={m} className="lobby-mode-chip">{m}</span>
          ))}
        </div>
      </main>
    </div>
  );
}
