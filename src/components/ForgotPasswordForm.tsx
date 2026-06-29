import { useState, FormEvent } from 'react';
import type { View } from '../App';
import { api } from '../api';

type Props = { onSwitch: (v: View) => void };

export default function ForgotPasswordForm({ onSwitch }: Props) {
  const [email,     setEmail]     = useState('');
  const [touched,   setTouched]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);

  const emailErr = !email
    ? 'El correo es requerido'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Correo inválido'
    : undefined;

  const showErr = submitted || touched;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (emailErr) return;

    setLoading(true);
    setApiError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="form">
        <div className="success-box">
          <div className="success-icon">✉️</div>
          <p className="success-msg">¡Solicitud enviada!</p>
          <p className="success-sub">
            Si <strong>{email}</strong> tiene una cuenta, recibirás instrucciones pronto.
            <br />Revisa también tu carpeta de spam.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => onSwitch('login')}>
          Volver al inicio de sesión
        </button>
        <div className="form-footer-center">
          <button
            type="button"
            className="link-btn"
            onClick={() => { setSent(false); setSubmitted(false); setEmail(''); setApiError(null); }}
          >
            Intentar con otro correo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-head">
        <p className="form-title">Recuperar contraseña</p>
        <p className="form-subtitle">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      {apiError && <div className="api-error">⚠ {apiError}</div>}

      <div className="field">
        <span className="field-label">Correo electrónico</span>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setApiError(null); }}
          onBlur={() => setTouched(true)}
          className={showErr && emailErr ? 'has-error' : ''}
          placeholder="tú@correo.com"
          autoComplete="email"
          disabled={loading}
        />
        {showErr && emailErr && <span className="field-err">⚠ {emailErr}</span>}
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar instrucciones'}
      </button>

      <div className="form-footer-center">
        <button type="button" className="link-btn" onClick={() => onSwitch('login')} disabled={loading}>
          ← Volver al inicio de sesión
        </button>
      </div>
    </form>
  );
}
