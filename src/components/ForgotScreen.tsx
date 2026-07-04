import { useState, FormEvent } from 'react';
import type { View } from '../App';
import { api } from '../api';
import { SunIcon, MoonIcon } from './icons';
import { Bone, DominoStage } from './DominoStage';

type Props = {
  onSwitch: (v: View) => void;
  dark: boolean;
  onToggleTheme: () => void;
};

export default function ForgotScreen({ onSwitch, dark, onToggleTheme }: Props) {
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

  return (
    <div className={`login-screen${dark ? '' : ' is-light'}`}>
      <button
        className="lg-theme"
        onClick={onToggleTheme}
        aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      <DominoStage blurb="¿Se te fue la ficha? Recupera el acceso y vuelve a la mesa." />

      <section className="lg-panel">
        {sent ? (
          <div className="lg-form lg-sent">
            <span className="lg-sent-icon" aria-hidden="true">✉</span>
            <h2>Solicitud enviada</h2>
            <p className="lg-sent-sub">
              Si <strong>{email}</strong> tiene una cuenta, recibirás instrucciones
              en breve. Revisa también tu carpeta de spam.
            </p>
            <button type="button" className="lg-submit" onClick={() => onSwitch('login')}>
              Volver al inicio de sesión
            </button>
            <p className="lg-foot">
              <button
                type="button"
                className="lg-link lg-link-strong"
                onClick={() => { setSent(false); setSubmitted(false); setTouched(false); setEmail(''); setApiError(null); }}
              >
                Intentar con otro correo
              </button>
            </p>
          </div>
        ) : (
          <form className="lg-form" onSubmit={handleSubmit} noValidate>
            <header className="lg-form-head">
              <span className="lg-mini-mark" aria-hidden="true">
                <Bone a={6} b={6} className="lg-mini-bone" />
              </span>
              <h2>Recuperar contraseña</h2>
              <p>Te enviaremos un enlace para restablecerla.</p>
            </header>

            {apiError && <div className="lg-alert" role="alert">⚠ {apiError}</div>}

            <div className="lg-field">
              <label htmlFor="fp-email">Correo electrónico</label>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setApiError(null); }}
                onBlur={() => setTouched(true)}
                className={showErr && emailErr ? 'has-error' : ''}
                placeholder="tú@correo.com"
                autoComplete="email"
                disabled={loading}
              />
              {showErr && emailErr && <span className="lg-field-err">{emailErr}</span>}
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar instrucciones'}
            </button>

            <p className="lg-foot">
              <button type="button" className="lg-link lg-link-strong" onClick={() => onSwitch('login')} disabled={loading}>
                ← Volver al inicio de sesión
              </button>
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
