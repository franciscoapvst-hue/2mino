import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, type AuthUser, type UserConfig } from '../api';
import { SunIcon, MoonIcon, CasualIcon, RankedIcon, SalasIcon } from './icons';
import { Bone } from './DominoStage';
import { avatarUrl } from '../avatars';
import { rangoDeElo, progresoRango } from '../ranks';
import AvatarPicker from './AvatarPicker';

type Props = {
  user:          AuthUser;
  config:        UserConfig;
  dark:          boolean;
  onToggleTheme: () => void;
  onLogout:      () => void;
  onGoToSalas:   () => void;
  onGoToRanked:  () => void;
  onGoToCasual:  () => void;
  onPieceDemo:   () => void;
  onAvatarChange: (avatar: string) => void;
};

// ── Tarjeta de modo secundario (casual / salas) ────
function PlayCard({ icon, title, desc, action, accent, onClick }: {
  icon: ReactNode; title: string; desc: string; action: string;
  accent: 'teal' | 'neutral'; onClick: () => void;
}) {
  return (
    <button className={`dash-card dash-card-${accent}`} onClick={onClick}>
      <span className="dash-card-icon">{icon}</span>
      <span className="dash-card-body">
        <span className="dash-card-title">{title}</span>
        <span className="dash-card-desc">{desc}</span>
      </span>
      <span className="dash-card-cta">{action} →</span>
    </button>
  );
}

// ── Dashboard / Lobby ─────────────────────────────
export default function Dashboard({ user, config, dark, onToggleTheme, onLogout, onGoToSalas, onGoToRanked, onGoToCasual, onPieceDemo, onAvatarChange }: Props) {
  const [elo, setElo] = useState<number | null>(null);
  const [avatarAbierto, setAvatarAbierto] = useState(false);
  const foto = avatarUrl(user.avatar);

  useEffect(() => {
    api.ranked.me()
      .then(r => setElo(r.elo))
      .catch(() => setElo(null)); // sin ranked aún: no romper el lobby
  }, []);

  const rango = elo !== null ? rangoDeElo(elo) : null;
  const prog  = elo !== null ? progresoRango(elo) : null;

  return (
    <div className={`dash${dark ? '' : ' is-light'}`}>

      {/* ── Nav ─────────────────────────────────── */}
      <nav className="dash-nav">
        <div className="dash-brand">
          <Bone a={6} b={6} className="dash-brand-tile" />
          <span className="dash-wordmark"><span>2</span>mino</span>
        </div>

        <div className="dash-nav-right">
          <button
            className="dash-icon-btn"
            onClick={onToggleTheme}
            aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          <button className="dash-icon-btn dash-pieces" onClick={onPieceDemo} title="Ver fichas">
            <Bone a={3} b={5} className="dash-pieces-tile" />
          </button>

          <button
            className="dash-user"
            onClick={() => setAvatarAbierto(true)}
            title="Cambiar foto de perfil"
          >
            <span className="dash-avatar">
              {foto ? <img src={foto} alt="" /> : user.username[0].toUpperCase()}
            </span>
            <span className="dash-user-meta">
              <span className="dash-username">@{user.username}</span>
              <span className="dash-segmento">{config.segmento}</span>
            </span>
          </button>

          <button className="dash-logout" onClick={onLogout}>Salir</button>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────── */}
      <main className="dash-body">

        {/* Saludo + panel de rango */}
        <section className="dash-hero">
          <div className="dash-greeting">
            <p className="dash-hello">Hola,</p>
            <h1>{user.username}</h1>
            <p className="dash-sub">La mesa está servida. ¿Listo para dominar?</p>
          </div>

          <aside className="dash-rank">
            {rango ? (
              <>
                <div className="dash-rank-badge">
                  {rango.url
                    ? <img src={rango.url} alt={`Rango ${rango.nombre}`} />
                    : <span className="dash-rank-fallback">★</span>}
                </div>
                <div className="dash-rank-info">
                  <span className="dash-rank-name">{rango.nombre}</span>
                  <span className="dash-rank-elo">{elo} <em>ELO</em></span>
                  {prog && prog.siguiente ? (
                    <div className="dash-rank-prog">
                      <div className="dash-rank-track">
                        <div className="dash-rank-fill" style={{ width: `${prog.pct}%` }} />
                      </div>
                      <span className="dash-rank-next">
                        {prog.faltan} para {prog.siguiente}
                      </span>
                    </div>
                  ) : (
                    <span className="dash-rank-next">Rango máximo</span>
                  )}
                </div>
              </>
            ) : (
              <div className="dash-rank-empty">
                <span className="dash-rank-badge dash-rank-badge-empty">★</span>
                <div className="dash-rank-info">
                  <span className="dash-rank-name">Sin rango</span>
                  <span className="dash-rank-next">Juega tu primera ranked para clasificar</span>
                </div>
              </div>
            )}
          </aside>
        </section>

        {/* Elige cómo jugar */}
        <h2 className="dash-section-title">Elige cómo jugar</h2>

        {/* Ranked destacado */}
        <button className="dash-featured" onClick={onGoToRanked}>
          <Bone a={6} b={6} className="dash-featured-tile dash-featured-tile-a" />
          <Bone a={5} b={4} className="dash-featured-tile dash-featured-tile-b" />
          <div className="dash-featured-content">
            <span className="dash-featured-kicker"><RankedIcon /> Competitivo</span>
            <h3>Partida Ranked</h3>
            <p>Cada mano cuenta hacia tu ELO. Sube de rango y demuestra quién manda en la mesa.</p>
          </div>
          <div className="dash-featured-action">
            {rango && (
              <span className="dash-featured-rank">
                {rango.url && <img src={rango.url} alt="" />}
                <span>{elo} ELO</span>
              </span>
            )}
            <span className="dash-featured-cta">Buscar ranked →</span>
          </div>
        </button>

        {/* Casual + Salas */}
        <div className="dash-row">
          <PlayCard
            icon={<CasualIcon />}
            title="Partida Casual"
            desc="Juega sin presión. Practica y diviértete sin afectar tu ranking."
            action="Buscar partida"
            accent="teal"
            onClick={onGoToCasual}
          />
          <PlayCard
            icon={<SalasIcon />}
            title="Salas Abiertas"
            desc="Explora partidas en curso, únete a una sala o crea la tuya con amigos."
            action="Ver salas"
            accent="neutral"
            onClick={onGoToSalas}
          />
        </div>

        {/* Modos disponibles */}
        <div className="dash-modes">
          <span className="dash-modes-label">Modos</span>
          {config.modos_juego.map(m => (
            <span key={m} className="dash-chip">{m}</span>
          ))}
        </div>
      </main>

      {avatarAbierto && (
        <AvatarPicker
          actual={user.avatar}
          onClose={() => setAvatarAbierto(false)}
          onElegir={async (avatar) => {
            await api.setAvatar(avatar);
            onAvatarChange(avatar);
          }}
        />
      )}
    </div>
  );
}
