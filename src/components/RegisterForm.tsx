import { useState, FormEvent } from 'react';
import type { View } from '../App';
import { api, type AuthUser, type UserConfig } from '../api';

type Props = {
  onSwitch:  (v: View) => void;
  onSuccess: (user: AuthUser, config: UserConfig) => void;
};

function pwStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 6) return 0;
  const checks = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pw)).length;
  if (pw.length >= 10 && checks >= 3) return 3;
  if (pw.length >= 8  && checks >= 2) return 2;
  return 1;
}

const strengthLabel = ['Débil', 'Regular', 'Buena', 'Fuerte'] as const;

export default function RegisterForm({ onSwitch, onSuccess }: Props) {
  const [username,  setUsername]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [touched,   setTouched]   = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  // Ya no loguea directo: el registro manda un email de confirmación y
  // hay que clickearlo antes de poder iniciar sesión.
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

  if (registrado) {
    return (
      <div className="form">
        <div className="success-box">
          <div className="success-icon">✉️</div>
          <p className="success-msg">¡Cuenta creada!</p>
          <p className="success-sub">
            Te mandamos un correo a <strong>{email}</strong> para confirmar tu cuenta.
            <br />Revisá también tu carpeta de spam.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => onSwitch('login')}>
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-head">
        <p className="form-title">Crear cuenta</p>
        <p className="form-subtitle">Únete a la mesa de juego</p>
      </div>

      {apiError && <div className="api-error">⚠ {apiError}</div>}

      <div className="field">
        <span className="field-label">Nombre de usuario</span>
        <input
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
        {show('username') && usernameErr && <span className="field-err">⚠ {usernameErr}</span>}
      </div>

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
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          disabled={loading}
        />
        {show('password') && passwordErr && <span className="field-err">⚠ {passwordErr}</span>}
        {password && (
          <div className="pw-strength">
            <div className="pw-bars">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`pw-bar${i <= strength ? ` s${strength}` : ''}`} />
              ))}
            </div>
            <span className="pw-label">{strengthLabel[strength]}</span>
          </div>
        )}
      </div>

      <div className="field">
        <span className="field-label">Confirmar contraseña</span>
        <input
          type="password"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setApiError(null); }}
          onBlur={() => touch('confirm')}
          className={show('confirm') && confirmErr ? 'has-error' : ''}
          placeholder="••••••••"
          autoComplete="new-password"
          disabled={loading}
        />
        {show('confirm') && confirmErr && <span className="field-err">⚠ {confirmErr}</span>}
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Creando cuenta…' : 'Registrarme'}
      </button>

      <div className="form-footer-center">
        <button type="button" className="link-btn" onClick={() => onSwitch('login')} disabled={loading}>
          Ya tengo cuenta · Iniciar sesión
        </button>
      </div>
    </form>
  );
}
