import { useEffect, useRef, useState, FormEvent } from 'react';
import type { View } from '../App';
import { api, tokenStore, type AuthUser, type UserConfig } from '../api';
import { SunIcon, MoonIcon } from './icons';
import { Bone, DominoStage } from './DominoStage';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Tipado mínimo de Google Identity Services (google.accounts.id) — la
// librería se carga como script global en index.html, no vía npm.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type Props = {
  onSwitch: (v: View) => void;
  onSuccess: (user: AuthUser, config: UserConfig) => void;
  dark: boolean;
  onToggleTheme: () => void;
};

export default function LoginScreen({ onSwitch, onSuccess, dark, onToggleTheme }: Props) {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [remember,  setRemember]  = useState(false);
  const [touched,   setTouched]   = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);

  const emailErr = !email
    ? 'El correo es requerido'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Correo inválido'
    : undefined;

  const passwordErr = !password
    ? 'La contraseña es requerida'
    : password.length < 6
    ? 'Mínimo 6 caracteres'
    : undefined;

  const show  = (f: string) => submitted || touched.has(f);
  const touch = (f: string) => setTouched(p => new Set([...p, f]));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (emailErr || passwordErr) return;

    setLoading(true);
    setApiError(null);
    try {
      const authRes = await api.login({ email, password });
      tokenStore.set(authRes.token, remember);
      const config = await api.getPreferencias();
      onSuccess(authRes.user, config);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential: string) {
    setApiError(null);
    setLoading(true);
    try {
      const authRes = await api.loginGoogle(credential);
      tokenStore.set(authRes.token, true);
      const config = await api.getPreferencias();
      onSuccess(authRes.user, config);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  }

  const googleBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelado = false;
    // El script de Google se carga async/defer en index.html — puede no
    // estar listo todavía cuando este componente monta.
    function intentar() {
      if (cancelado) return;
      if (!window.google || !googleBtnRef.current) {
        setTimeout(intentar, 100);
        return;
      }
      window.google!.accounts.id.initialize({
        client_id: clientId!,
        callback: (r) => handleGoogleCredential(r.credential),
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: dark ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 340,
      });
    }
    intentar();
    return () => { cancelado = true; };
  }, [dark]);

  return (
    <div className={`login-screen${dark ? '' : ' is-light'}`}>
      <button
        className="lg-theme"
        onClick={onToggleTheme}
        aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      <DominoStage blurb="Dominó en línea con ranked, ELO y equipo. La mesa te espera." />

      {/* ── Panel de acceso ───────────────────────────── */}
      <section className="lg-panel">
        <form className="lg-form" onSubmit={handleSubmit} noValidate>
          <header className="lg-form-head">
            <span className="lg-mini-mark" aria-hidden="true">
              <Bone a={6} b={6} className="lg-mini-bone" />
            </span>
            <h2>Iniciar sesión</h2>
            <p>Bienvenido de vuelta, jugador.</p>
          </header>

          {apiError && <div className="lg-alert" role="alert">⚠ {apiError}</div>}

          <div className="lg-field">
            <label htmlFor="lg-email">Correo electrónico</label>
            <input
              id="lg-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setApiError(null); }}
              onBlur={() => touch('email')}
              className={show('email') && emailErr ? 'has-error' : ''}
              placeholder="tú@correo.com"
              autoComplete="email"
              disabled={loading}
            />
            {show('email') && emailErr && <span className="lg-field-err">{emailErr}</span>}
          </div>

          <div className="lg-field">
            <label htmlFor="lg-password">Contraseña</label>
            <input
              id="lg-password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setApiError(null); }}
              onBlur={() => touch('password')}
              className={show('password') && passwordErr ? 'has-error' : ''}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
            {show('password') && passwordErr && <span className="lg-field-err">{passwordErr}</span>}
          </div>

          <div className="lg-row">
            <label className="lg-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span className="lg-check-box" aria-hidden="true" />
              Recordarme
            </label>
            <button
              type="button"
              className="lg-link"
              onClick={() => onSwitch('forgot')}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button type="submit" className="lg-submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar al juego'}
          </button>

          <div className="lg-divider"><span>o</span></div>

          {GOOGLE_CLIENT_ID ? (
            <div className="lg-google-btn" ref={googleBtnRef} />
          ) : (
            <button type="button" className="lg-google" disabled title="Próximamente">
              Continuar con Google
            </button>
          )}

          <p className="lg-foot">
            ¿No tienes cuenta?{' '}
            <button type="button" className="lg-link lg-link-strong" onClick={() => onSwitch('register')} disabled={loading}>
              Crear cuenta
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
