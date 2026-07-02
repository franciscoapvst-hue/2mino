import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, type AuthUser, type UserConfig } from '../api';
import { DominoTile, SunIcon, MoonIcon, CasualIcon, RankedIcon, SalasIcon } from './icons';

type Props = {
  user:          AuthUser;
  config:        UserConfig;
  dark:          boolean;
  onToggleTheme: () => void;
  onLogout:      () => void;
  onGoToSalas:   () => void;
  onGoToRanked:  () => void;
  onPieceDemo:   () => void;
};

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
export default function Dashboard({ user, config, dark, onToggleTheme, onLogout, onGoToSalas, onGoToRanked, onPieceDemo }: Props) {
  const [elo, setElo] = useState<number | null>(null);

  useEffect(() => {
    api.ranked.me()
      .then(r => setElo(r.elo))
      .catch(() => setElo(null)); // sin ranked aún: no romper el lobby
  }, []);

  return (
    <div className="lobby-shell">

      {/* ── Nav ─────────────────────────────────── */}
      <nav className="lobby-nav">
        <div className="lobby-brand">
          <DominoTile width={40} height={20} />
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
            {elo !== null && <span className="lobby-elo" title="ELO ranked">⭐ {elo}</span>}
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
            soon={false}
            onClick={onGoToRanked}
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
