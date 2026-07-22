import { useEffect, useState } from 'react';
import { getSession, logout } from './lib/api';
import type { AdminSession } from './lib/types';
import Shell, { type View } from './components/Shell';
import LoginView from './views/LoginView';
import FeatureFlagsView from './views/FeatureFlagsView';
import UsuariosView from './views/UsuariosView';
import SegmentosView from './views/SegmentosView';
import ReglasJuegoView from './views/ReglasJuegoView';
import TorneosView from './views/TorneosView';
import TiendaView from './views/TiendaView';

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [view, setView] = useState<View>('flags');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSession(getSession());
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!session) {
    return <LoginView onLogin={setSession} />;
  }

  function handleLogout() {
    logout();
    setSession(null);
  }

  return (
    <Shell active={view} onNavigate={setView} adminUsername={session.username} onLogout={handleLogout}>
      {view === 'flags' && <FeatureFlagsView />}
      {view === 'usuarios' && <UsuariosView />}
      {view === 'segmentos' && <SegmentosView />}
      {view === 'reglas' && <ReglasJuegoView />}
      {view === 'torneos' && <TorneosView />}
      {view === 'tienda' && <TiendaView />}
    </Shell>
  );
}
