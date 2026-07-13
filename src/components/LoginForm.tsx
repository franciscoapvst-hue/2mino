import { useState, FormEvent } from 'react';
import type { View } from '../App';
import { api, tokenStore, ApiError, type AuthUser, type UserConfig } from '../api';
import { GoogleIcon } from './icons';

type Props = {
  onSwitch: (v: View) => void;
  onSuccess: (user: AuthUser, config: UserConfig) => void;
};

export default function LoginForm({ onSwitch, onSuccess }: Props) {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [remember,  setRemember]  = useState(false);
  const [touched,   setTouched]   = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [sinVerificar, setSinVerificar] = useState(false);
  const [reenviando,   setReenviando]   = useState(false);
  const [reenviado,    setReenviado]    = useState(false);

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
    setSinVerificar(false);
    setReenviado(false);
    try {
      const authRes = await api.login({ email, password });
      tokenStore.set(authRes.token, remember);
      const config = await api.getPreferencias();
      onSuccess(authRes.user, config);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'EMAIL_NO_VERIFICADO') {
        setSinVerificar(true);
      } else {
        setApiError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviar() {
    setReenviando(true);
    try {
      await api.reenviarVerificacion(email);
    } finally {
      setReenviado(true);
      setReenviando(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-head">
        <p className="form-title">Iniciar sesión</p>
        <p className="form-subtitle">¡Bienvenido de vuelta, jugador!</p>
      </div>

      {apiError && <div className="api-error">⚠ {apiError}</div>}

      {sinVerificar && (
        <div className="api-error">
          {reenviado ? (
            <>✉ Te reenviamos el link de confirmación a <strong>{email}</strong>.</>
          ) : (
            <>
              ⚠ Confirmá tu cuenta desde el email que te mandamos antes de iniciar sesión.{' '}
              <button
                type="button"
                className="link-btn"
                onClick={handleReenviar}
                disabled={reenviando}
                style={{ display: 'inline', padding: 0 }}
              >
                {reenviando ? 'Reenviando…' : 'Reenviar email'}
              </button>
            </>
          )}
        </div>
      )}

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
