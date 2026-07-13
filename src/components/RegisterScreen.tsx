import { useState, FormEvent } from 'react';
import type { View } from '../App';
import { api, type AuthUser, type UserConfig } from '../api';
import { SunIcon, MoonIcon } from './icons';
import { Bone, DominoStage } from './DominoStage';

type Props = {
  onSwitch: (v: View) => void;
  onSuccess: (user: AuthUser, config: UserConfig) => void;
  dark: boolean;
  onToggleTheme: () => void;
};

function pwStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 6) return 0;
  const checks = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pw)).length;
  if (pw.length >= 10 && checks >= 3) return 3;
  if (pw.length >= 8  && checks >= 2) return 2;
  return 1;
}
const strengthLabel = ['Débil', 'Regular', 'Buena', 'Fuerte'] as const;

export default function RegisterScreen({ onSwitch, onSuccess, dark, onToggleTheme }: Props) {
  const [username,  setUsername]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [touched,   setTouched]   = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [registrado, setRegistrado] = useState(false);

  const usernameErr = !username
    ? 'El nombre de usuario es requerido'
    : username.length < 3
    ? 'Mínimo 3 caracteres'
    : !/^[a-zA-Z0-9_]+$/.test(username)
    ? 'Solo letras, números y guion bajo'
    : undefined;

  const emailErr = !email
    ? 'El correo es requerido'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Correo inválido'
    : undefined;

  const passwordErr = !password
    ? 'La contraseña es requerida'
    : password.length < 8
    ? 'Mínimo 8 caracteres'
    : undefined;

  const confirmErr = !confirm
    ? 'Confirma tu contraseña'
    : confirm !== password
    ? 'Las contraseñas no coinciden'
    : undefined;

  const show  = (f: string) => submitted || touched.has(f);
  const touch = (f: string) => setTouched(p => new Set([...p, f]));
  const strength    = pwStrength(password);
  const hasAnyError = !!(usernameErr || emailErr || passwordErr || confirmErr);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (hasAnyError) return;

    setLoading(true);
    setApiError(null);
    try {
      await api.register({ username, email, password });
      setRegistrado(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login-screen${dark ? '' : ' is-light'}`}>
      <button
        className="lg-theme"
        onClick={onToggleTheme}
        aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      <DominoStage blurb="Crea tu cuenta, elige tu ficha y sube de rango. La mesa te espera." />

      <section className="lg-panel">
        {registrado ? (
          <div className="lg-form lg-sent">
            <span className="lg-sent-icon" aria-hidden="true">✉</span>
            <h2>¡Cuenta creada!</h2>
            <p className="lg-sent-sub">
              Te mandamos un correo a <strong>{email}</strong> para confirmar tu
              cuenta. Revisa también tu carpeta de spam.
            </p>
            <button type="button" className="lg-submit" onClick={() => onSwitch('login')}>
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
        <form className="lg-form" onSubmit={handleSubmit} noValidate>
          <header className="lg-form-head">
            <span className="lg-mini-mark" aria-hidden="true">
              <Bone a={6} b={6} className="lg-mini-bone" />
            </span>
            <h2>Crear cuenta</h2>
            <p>Únete a la mesa de juego.</p>
          </header>

          {apiError && <div className="lg-alert" role="alert">⚠ {apiError}</div>}

          <div className="lg-field">
            <label htmlFor="rg-username">Nombre de usuario</label>
            <input
              id="rg-username"
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setApiError(null); }}
              onBlur={() => touch('username')}
              className={show('username') && usernameErr ? 'has-error' : ''}
              placeholder="jugador123"
              autoComplete="username"
              maxLength={20}
              disabled={loading}
            />
            {show('username') && usernameErr && <span className="lg-field-err">{usernameErr}</span>}
          </div>

          <div className="lg-field">
            <label htmlFor="rg-email">Correo electrónico</label>
            <input
              id="rg-email"
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
            <label htmlFor="rg-password">Contraseña</label>
            <input
              id="rg-password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setApiError(null); }}
              onBlur={() => touch('password')}
              className={show('password') && passwordErr ? 'has-error' : ''}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              disabled={loading}
            />
            {show('password') && passwordErr && <span className="lg-field-err">{passwordErr}</span>}
            {password && (
              <div className="lg-pw">
                <div className="lg-pw-bars">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`lg-pw-bar${i <= strength ? ` s${strength}` : ''}`} />
                  ))}
                </div>
                <span className="lg-pw-label">{strengthLabel[strength]}</span>
              </div>
            )}
          </div>

          <div className="lg-field">
            <label htmlFor="rg-confirm">Confirmar contraseña</label>
            <input
              id="rg-confirm"
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setApiError(null); }}
              onBlur={() => touch('confirm')}
              className={show('confirm') && confirmErr ? 'has-error' : ''}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={loading}
            />
            {show('confirm') && confirmErr && <span className="lg-field-err">{confirmErr}</span>}
          </div>

          <button type="submit" className="lg-submit" disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Registrarme'}
          </button>

          <p className="lg-foot">
            ¿Ya tienes cuenta?{' '}
            <button type="button" className="lg-link lg-link-strong" onClick={() => onSwitch('login')} disabled={loading}>
              Iniciar sesión
            </button>
          </p>
        </form>
        )}
      </section>
    </div>
  );
}
