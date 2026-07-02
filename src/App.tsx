import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import Dashboard from './components/Dashboard';
import SalasView from './components/SalasView';
import PieceDemo from './components/game/PieceDemo';
import GameBoard from './components/game/GameBoard';
import { api, tokenStore, type AuthUser, type UserConfig, type Sala } from './api';
import { DominoTile, SunIcon, MoonIcon } from './components/icons';

export type View = 'login' | 'register' | 'forgot';
type AppView = View | 'dashboard' | 'salas' | 'piece-demo' | 'game';

type Session = { user: AuthUser; config: UserConfig };

export default function App() {
  const [view,     setView]     = useState<AppView>('login');
  const [session,  setSession]  = useState<Session | null>(null);
  const [booting,  setBooting]  = useState(true);
  const [gameSala, setGameSala] = useState<Sala | null>(null);
  const [dark,    setDark]    = useState<boolean>(
    () => localStorage.getItem('2mino-theme') !== 'light'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
    localStorage.setItem('2mino-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Restore session from stored token
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) { setBooting(false); return; }

    Promise.all([api.me(), api.getPreferencias()])
      .then(([user, config]) => {
        if (config.tema) setDark(config.tema === 'dark');
        setSession({ user, config });
        setView('dashboard');
      })
      .catch(() => tokenStore.clear())
      .finally(() => setBooting(false));
  }, []);

  function handleSuccess(user: AuthUser, config: UserConfig) {
    if (config.tema) setDark(config.tema === 'dark');
    setSession({ user, config });
    setView('dashboard');
  }

  function handleLogout() {
    tokenStore.clear();
    setSession(null);
    setView('login');
  }

  if (booting) {
    return (
      <div className="app-shell">
        <div className="boot-spinner" aria-label="Cargando…" />
      </div>
    );
  }

  if (view === 'piece-demo') {
    return <PieceDemo onBack={() => setView(session ? 'dashboard' : 'login')} />;
  }

  if (view === 'game' && session && gameSala) {
    return (
      <GameBoard
        sala={gameSala}
        user={session.user}
        onExit={() => { setGameSala(null); setView('salas'); }}
      />
    );
  }

  if (view === 'salas' && session) {
    return (
      <SalasView
        user={session.user}
        onBack={() => setView('dashboard')}
        onGameStart={(sala) => { setGameSala(sala); setView('game'); }}
      />
    );
  }

  if (view === 'dashboard' && session) {
    return (
      <Dashboard
        user={session.user}
        config={session.config}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
        onLogout={handleLogout}
        onGoToSalas={() => setView('salas')}
        onPieceDemo={() => setView('piece-demo')}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="auth-card">
        <header className="card-header">
          <DominoTile />
          <div className="logo-text">
            <h1>2mino</h1>
            <p>Juega. Compite. Domina.</p>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setDark(d => !d)}
            aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <div className="card-body">
          <div key={view} className="view-wrap">
            {view === 'login'    && <LoginForm          onSwitch={setView} onSuccess={handleSuccess} />}
            {view === 'register' && <RegisterForm        onSwitch={setView} onSuccess={handleSuccess} />}
            {view === 'forgot'   && <ForgotPasswordForm  onSwitch={setView} />}
          </div>
        </div>
      </div>
    </div>
  );
}
