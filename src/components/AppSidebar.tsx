import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AuthUser, UserConfig } from '../api';
import { Bone } from './DominoStage';
import { avatarUrl } from '../avatars';
import GameIcon, { type GameIconName } from './GameIcons';
import { InventarioIcon } from './icons';

// ── Barra lateral global (shell a nivel de app) ───────────────────
// Vive dentro de AppShell y se muestra en TODA la app autenticada,
// incluida la partida (docs/PLAN_ESCRITORIO.md, S1). Antes esta
// navegación estaba repartida en el nav de cada pantalla (Dashboard,
// GameBoard, SalasView…) y "saltaba" al cambiar de sección; ahora es
// una sola pieza persistente.
//
// Estilo (ref. chess.com, punto 8): íconos coloridos dimensionales
// (los raster de src/assets/iconos, ver GameIcons.tsx) en una columna
// de ancho FIJO, para que todas las etiquetas queden alineadas. Los
// destinos sin ícono generado todavía (Tienda, Ver fichas) usan un
// glifo de línea centrado en el mismo hueco — se pueden cambiar por
// iconos coloridos cuando se generen.

type NavDef = {
  to: string;
  label: string;
  /** Ícono colorido generado (preferido). */
  img?: GameIconName;
  /** Fallback de línea mientras no haya ícono generado. */
  svg?: ReactNode;
  /** Coincide también con sub-rutas (ej. /tournaments/:id). */
  match?: (path: string) => boolean;
};

type Props = {
  user: AuthUser;
  config: UserConfig;
  dark: boolean;
  saldo: number | null;
  noLeidas: number;
  /** En móvil el sidebar es un drawer; al navegar se cierra. */
  onNavigate?: () => void;
  onToggleTheme: () => void;
  onOpenInbox: () => void;
  onOpenAvatar: () => void;
  onLogout: () => void;
};

export default function AppSidebar({
  user, config, dark, saldo, noLeidas,
  onNavigate, onToggleTheme, onOpenInbox, onOpenAvatar, onLogout,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const foto = avatarUrl(user.avatar);

  const items: NavDef[] = [
    { to: '/home', label: 'Jugar', img: 'casual',
      match: p => p === '/home' || p === '/rooms' || p === '/ranked' || p === '/casual' || p.startsWith('/game') },
    { to: '/friends', label: 'Amigos', img: 'amigos' },
    { to: '/tournaments', label: 'Torneos', img: 'torneos',
      match: p => p.startsWith('/tournaments') },
    { to: '/leaderboard', label: 'Leaderboard', img: 'leaderboard' },
    { to: '/history', label: 'Historial', img: 'historial',
      match: p => p === '/history' || p.startsWith('/replay') },
    { to: '/tienda', label: 'Tienda', img: 'tienda' },
    { to: '/inventario', label: 'Inventario', svg: <InventarioIcon /> },
    { to: '/piece-demo', label: 'Ver fichas', svg: <Bone a={3} b={5} className="nav-tile" /> },
  ];

  function go(to: string) {
    onNavigate?.();
    if (location.pathname !== to) navigate(to);
  }

  const isActive = (it: NavDef) =>
    it.match ? it.match(location.pathname) : location.pathname === it.to;

  return (
    <aside className="app-sidebar">
      {/* Marca */}
      <button className="asb-brand" onClick={() => go('/landing')} aria-label="Ir al landing">
        <Bone a={6} b={6} className="asb-brand-tile" />
        <span className="asb-wordmark"><span>2</span>mino</span>
      </button>

      {/* Navegación */}
      <nav className="asb-nav">
        {items.map(it => (
          <button
            key={it.to}
            className={`asb-item${isActive(it) ? ' is-active' : ''}`}
            onClick={() => go(it.to)}
          >
            <span className="asb-item-icon">
              {it.img ? <GameIcon name={it.img} size={30} /> : it.svg}
            </span>
            <span className="asb-item-label">{it.label}</span>
          </button>
        ))}
      </nav>

      {/* Saldo de doblones — atajo a la tienda */}
      {saldo !== null && (
        <button className="asb-saldo" onClick={() => go('/tienda')} title="Tienda de cosméticos">
          <span className="asb-saldo-icon">
            <GameIcon name="doblon" size={26} />
            {/* Placeholder del futuro "comprar doblones" (Etapa F,
                docs/PLAN_COSMETICOS_V3.md) — hoy solo lleva a la tienda. */}
            <span className="asb-saldo-plus" aria-hidden="true">+</span>
          </span>
          <span className="asb-saldo-text">
            <span className="asb-saldo-label">Doblones</span>
            <span className="asb-saldo-num">{saldo}</span>
          </span>
        </button>
      )}

      {/* Pie: bandeja, tema, perfil, salir */}
      <div className="asb-foot">
        <button className="asb-foot-btn asb-bell" onClick={onOpenInbox} title="Bandeja de entrada">
          <span className="asb-foot-icon"><GameIcon name="bandeja" size={28} /></span>
          <span>Bandeja</span>
          {noLeidas > 0 && <span className="asb-bell-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
        </button>

        <button className="asb-foot-btn" onClick={onToggleTheme} title={dark ? 'Modo claro' : 'Modo oscuro'}>
          <span className="asb-foot-icon"><GameIcon name={dark ? 'sol' : 'luna'} size={28} /></span>
          <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        <button className="asb-user" onClick={onOpenAvatar} title="Cambiar foto de perfil">
          <span className="asb-avatar">
            {foto ? <img src={foto} alt="" /> : user.username[0].toUpperCase()}
          </span>
          <span className="asb-user-meta">
            <span className="asb-username">@{user.username}</span>
            <span className="asb-segmento">{config.segmento}</span>
          </span>
        </button>

        <button className="asb-logout" onClick={onLogout}>Salir</button>
      </div>
    </aside>
  );
}
