import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import Dashboard from './components/Dashboard';
import SalasView from './components/SalasView';
import PieceDemo from './components/game/PieceDemo';
import { api, tokenStore, type AuthUser, type UserConfig } from './api';

export type View = 'login' | 'register' | 'forgot';
type AppView = View | 'dashboard' | 'salas' | 'piece-demo';

type Session = { user: AuthUser; config: UserConfig };

function DominoTile() {
  return (
    <svg width="52" height="26" viewBox="0 0 52 26" aria-hidden>
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

export default function App() {
  const [view,    setView]    = useState<AppView>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
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

  if (view === 'salas' && session) {
    return <SalasView user={session.user} onBack={() => setView('dashboard')} />;
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
