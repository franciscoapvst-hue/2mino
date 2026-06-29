import { useState, FormEvent } from 'react';
import type { View } from '../App';
import { api, tokenStore, type AuthUser, type UserConfig } from '../api';

type Props = {
  onSwitch: (v: View) => void;
  onSuccess: (user: AuthUser, config: UserConfig) => void;
};

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.075 17.64 11.767 17.64 9.2z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export default function LoginForm({ onSwitch, onSuccess }: Props) {
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

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-head">
        <p className="form-title">Iniciar sesión</p>
        <p className="form-subtitle">¡Bienvenido de vuelta, jugador!</p>
      </div>

      {apiError && <div className="api-error">⚠ {apiError}</div>}

      <div className="field">
        <span className="field-label">Correo electrónico</span>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setApiError(null); }}
          onBlur={() => touch('email')}
          className={show('email') && emailErr ? 'has-error' : ''}
          placeholder="tú@correo.com"
          autoComplete="email"
          disabled={loading}
        />
        {show('email') && emailErr && <span className="field-err">⚠ {emailErr}</span>}
      </div>

      <div className="field">
        <span className="field-label">Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setApiError(null); }}
          onBlur={() => touch('password')}
          className={show('password') && passwordErr ? 'has-error' : ''}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />
        {show('password') && passwordErr && <span className="field-err">⚠ {passwordErr}</span>}
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={remember}
          onChange={e => setRemember(e.target.checked)}
          disabled={loading}
        />
        Recordarme en este dispositivo
      </label>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar al juego'}
      </button>

      <div className="divider">o</div>

      <button
        type="button"
        className="btn-google"
        disabled
        title="Próximamente"
      >
        <GoogleIcon /> Continuar con Google
      </button>

      <div className="form-footer">
        <button type="button" className="link-btn" onClick={() => onSwitch('forgot')} disabled={loading}>
          ¿Olvidaste tu contraseña?
        </button>
        <button type="button" className="link-btn" onClick={() => onSwitch('register')} disabled={loading}>
          Crear cuenta
        </button>
      </div>
    </form>
  );
}
