import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, type AuthUser, type UserConfig, type Sala } from '../api';
import { SunIcon, MoonIcon, BellIcon, PeopleIcon } from './icons';
import GameIcon, { type GameIconName } from './GameIcons';
import { Bone } from './DominoStage';
import { avatarUrl } from '../avatars';
import { rangoDeElo, progresoRango } from '../ranks';
import AvatarPicker from './AvatarPicker';
import InboxPopover from './social/InboxPopover';
import AdSlot from './AdSlot';
import { usePoll } from '../hooks/usePoll';

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
  onGoToAmigos:      () => void;
  onGoToLeaderboard: () => void;
  onGoToHistorial:   () => void;
  onGoToTorneos:     () => void;
  onUnirseSala:      (codigo: string) => void;
  /** Sube cada vez que llega `notificacion_nueva` por el WS de sociales. */
  notifVersion?: number;
  /** Partida en_juego detectada al iniciar sesión — null si no hay ninguna. */
  salaParaReintegrar?:   Sala | null;
  onReintegrarSala?:     () => void;
  onDescartarReintegro?: () => void;
};

// ── Tarjeta de modo secundario (casual / salas) ────
// El ícono va grande y sin chip de color detrás: estos íconos ya traen su
// propio color, un chip teal/gris pelearía con ellos.
function PlayCard({ icono, title, desc, action, accent, onClick }: {
  icono: GameIconName; title: string; desc: string; action: string;
  accent: 'teal' | 'neutral'; onClick: () => void;
}) {
  return (
    <button className={`dash-card dash-card-${accent}`} onClick={onClick}>
      <span className="dash-card-icon"><GameIcon name={icono} size={48} /></span>
      <span className="dash-card-body">
        <span className="dash-card-title">{title}</span>
        <span className="dash-card-desc">{desc}</span>
      </span>
      <span className="dash-card-cta">{action} →</span>
    </button>
  );
}

// ── Dashboard / Lobby ─────────────────────────────
export default function Dashboard({
  user, config, dark, onToggleTheme, onLogout, onGoToSalas, onGoToRanked, onGoToCasual, onPieceDemo, onAvatarChange,
  onGoToAmigos, onGoToLeaderboard, onGoToHistorial, onGoToTorneos, onUnirseSala, notifVersion,
  salaParaReintegrar, onReintegrarSala, onDescartarReintegro,
}: Props) {
  const [elo, setElo] = useState<number | null>(null);
  const [avatarAbierto, setAvatarAbierto] = useState(false);
  const [inboxAbierto, setInboxAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const foto = avatarUrl(user.avatar);

  useEffect(() => {
    api.ranked.me()
      .then(r => setElo(r.elo))
      .catch(() => setElo(null)); // sin ranked aún: no romper el lobby
  }, []);

  useEffect(() => {
    api.social.noLeidasCount().then(r => setNoLeidas(r.count)).catch(() => {});
  }, [inboxAbierto, notifVersion]); // notifVersion: refetch inmediato al llegar notificacion_nueva por WS

  // Poll de 30s como red de seguridad si el WS se cayó — el WS es la vía
  // rápida (ver useSocialSocket), esto no debería disparar en el camino feliz.
  usePoll(async () => {
    const r = await api.social.noLeidasCount();
    setNoLeidas(r.count);
  }, 30_000);

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

          <button className="dash-icon-btn" onClick={onGoToAmigos} aria-label="Amigos" title="Amigos">
            <PeopleIcon />
          </button>

          <button
            className="dash-icon-btn dash-bell-btn"
            onClick={() => setInboxAbierto(o => !o)}
            aria-label="Bandeja de entrada"
            title="Bandeja de entrada"
          >
            <BellIcon />
            {noLeidas > 0 && <span className="dash-bell-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
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

        {inboxAbierto && (
          <InboxPopover onClose={() => setInboxAbierto(false)} onUnirseSala={onUnirseSala} />
        )}
      </nav>

      {salaParaReintegrar && (
        <div className="rejoin-banner">
          <span className="rejoin-banner-text">
            <strong>Tenés una partida en curso.</strong> Sala {salaParaReintegrar.codigo}
          </span>
          <div className="rejoin-banner-actions">
            <button className="rejoin-banner-cta" onClick={onReintegrarSala}>Reintegrarme</button>
            <button
              className="rejoin-banner-dismiss"
              onClick={onDescartarReintegro}
              aria-label="Descartar aviso"
              title="Descartar"
            >
              ×
            </button>
          </div>
        </div>
      )}

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

        {/* Ranked destacado — bloqueado para invitados (la barrera real
            está en api-integracion/src/routes/ranked.ts, esto es solo
            para no mostrar un botón que termina en 403). */}
        {config.segmento === 'invitado' ? (
          <div className="dash-featured dash-featured-disabled">
            <Bone a={6} b={6} className="dash-featured-tile dash-featured-tile-a" />
            <Bone a={5} b={4} className="dash-featured-tile dash-featured-tile-b" />
            <div className="dash-featured-content">
              <span className="dash-featured-kicker">
                <GameIcon name="ranked" size={40} /> Competitivo
              </span>
              <h3>Partida Ranked</h3>
              <p>Creá una cuenta para jugar ranked y subir de ELO.</p>
            </div>
          </div>
        ) : (
          <button className="dash-featured" onClick={onGoToRanked}>
            <Bone a={6} b={6} className="dash-featured-tile dash-featured-tile-a" />
            <Bone a={5} b={4} className="dash-featured-tile dash-featured-tile-b" />
            <div className="dash-featured-content">
              <span className="dash-featured-kicker">
                <GameIcon name="ranked" size={40} /> Competitivo
              </span>
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
        )}

        {/* Casual + Salas */}
        <div className="dash-row">
          <PlayCard
            icono="casual"
            title="Partida Casual"
            desc="Juega sin presión. Practica y diviértete sin afectar tu ranking."
            action="Buscar partida"
            accent="teal"
            onClick={onGoToCasual}
          />
          <PlayCard
            icono="salas"
            title="Salas Abiertas"
            desc="Explora partidas en curso, únete a una sala o crea la tuya con amigos."
            action="Ver salas"
            accent="neutral"
            onClick={onGoToSalas}
          />
        </div>

        {/* Torneos — detrás del flag torneos_habilitado (§7.4 de
            docs/CASOS_DE_USO_BACKOFFICE.md). El backend real de flags
            todavía no existe (ver docs/PLAN_TORNEOS.md §0 prerrequisitos),
            así que por ahora se muestra siempre: reemplazar este `true`
            por `config.opciones?.torneos_habilitado` cuando el Back
            Office pueda apagarlo de verdad. */}
        {true && (
          <div className="dash-row dash-row-solo">
            <PlayCard
              icono="torneos"
              title="Torneos"
              desc="Inscribite en pareja, compite por fases y sube en el ranking del torneo."
              action="Ver torneos"
              accent="teal"
              onClick={onGoToTorneos}
            />
          </div>
        )}

        {/* Comunidad: leaderboard + historial */}
        <h2 className="dash-section-title">Comunidad</h2>
        <div className="dash-row">
          <PlayCard
            icono="leaderboard"
            title="Leaderboard"
            desc="Top 100 jugadores por ELO. Mira su historial, capicúas y tranques."
            action="Ver leaderboard"
            accent="teal"
            onClick={onGoToLeaderboard}
          />
          <PlayCard
            icono="historial"
            title="Historial de partidas"
            desc="Repasa tus últimas partidas y reproduce cómo fue cada mano."
            action="Ver historial"
            accent="neutral"
            onClick={onGoToHistorial}
          />
        </div>

        {/* Modos disponibles */}
        <div className="dash-modes">
          <span className="dash-modes-label">Modos</span>
          {config.modos_juego.map(m => (
            <span key={m} className="dash-chip">{m}</span>
          ))}
        </div>

        <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_DASHBOARD} />
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
