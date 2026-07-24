import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, type AuthUser, type UserConfig } from '../api';
import { usePoll } from '../hooks/usePoll';
import AppSidebar from './AppSidebar';
import AvatarPicker from './AvatarPicker';
import InboxPopover from './social/InboxPopover';

// ── Shell a nivel de app (docs/PLAN_ESCRITORIO.md, S1) ────────────
// Envuelve TODAS las pantallas autenticadas — incluida la partida
// (/game) — con un sidebar persistente. Al vivir por encima del
// enrutado (App monta <AppShell> en la misma posición para cada ruta
// autenticada), React lo reconcilia en vez de re-montarlo: el sidebar
// no "salta" ni pierde estado al navegar entre secciones ni al entrar
// o salir de una partida.
//
// El saldo y el contador de no-leídas viven acá (antes en Dashboard):
// son globales, así se piden una vez para toda la sesión en vez de
// re-pedirse en cada pantalla.

type Props = {
  user: AuthUser;
  config: UserConfig;
  dark: boolean;
  /** Feature flag tienda_habilitada (BO): oculta Tienda + saldo si está off. */
  tiendaHabilitada: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onAvatarChange: (avatar: string) => void;
  onUnirseSala: (codigo: string) => void;
  /** Sube cada vez que llega `notificacion_nueva` por el WS de sociales. */
  notifVersion?: number;
  children: ReactNode;
};

export default function AppShell({
  user, config, dark, tiendaHabilitada, onToggleTheme, onLogout, onAvatarChange, onUnirseSala,
  notifVersion, children,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [avatarAbierto, setAvatarAbierto] = useState(false);
  const [inboxAbierto, setInboxAbierto] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  useEffect(() => {
    api.billetera.saldo()
      .then(b => setSaldo(b.saldo))
      .catch(() => setSaldo(null));
  }, []);

  useEffect(() => {
    api.social.noLeidasCount().then(r => setNoLeidas(r.count)).catch(() => {});
  }, [inboxAbierto, notifVersion]); // refetch inmediato al llegar notificacion_nueva por WS

  // Poll de 30s como red de seguridad si el WS se cayó — el WS es la vía
  // rápida (ver useSocialSocket), esto no debería disparar en el camino feliz.
  usePoll(async () => {
    const r = await api.social.noLeidasCount();
    setNoLeidas(r.count);
  }, 30_000);

  // Al cambiar de ruta, cerrar el drawer móvil (si venía abierto).
  useEffect(() => { setDrawerAbierto(false); }, [location.pathname]);

  const sidebar = (
    <AppSidebar
      user={user}
      config={config}
      dark={dark}
      tiendaHabilitada={tiendaHabilitada}
      saldo={saldo}
      noLeidas={noLeidas}
      onNavigate={() => setDrawerAbierto(false)}
      onToggleTheme={onToggleTheme}
      onOpenInbox={() => setInboxAbierto(o => !o)}
      onOpenAvatar={() => setAvatarAbierto(true)}
      onLogout={onLogout}
    />
  );

  return (
    <div className={`app-shell-root${dark ? '' : ' is-light'}`}>
      {/* Barra móvil: hamburguesa para abrir el drawer del sidebar */}
      <header className="app-topbar">
        <button
          className="app-topbar-burger"
          onClick={() => setDrawerAbierto(true)}
          aria-label="Abrir menú"
        >
          <span /><span /><span />
        </button>
        <button className="app-topbar-brand" onClick={() => navigate('/landing')} aria-label="Ir al landing">
          <span>2</span>mino
        </button>
      </header>

      {/* Sidebar fijo en PC */}
      <div className="app-shell-aside">{sidebar}</div>

      {/* Drawer en móvil */}
      {drawerAbierto && (
        <div className="app-drawer" role="dialog" aria-modal="true">
          <div className="app-drawer-scrim" onClick={() => setDrawerAbierto(false)} />
          <div className="app-drawer-panel">{sidebar}</div>
        </div>
      )}

      {/* Contenido ruteado */}
      <main className="app-shell-main">{children}</main>

      {/* Overlays globales — el inbox y el avatar son de toda la sesión */}
      {inboxAbierto && (
        <InboxPopover onClose={() => setInboxAbierto(false)} onUnirseSala={onUnirseSala} />
      )}
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
