import { useEffect, useRef, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenStore, ApiError, type AuthUser, type UserConfig } from '../api';
import { GoogleIcon, SunIcon, MoonIcon } from './icons';
import { Bone, DominoStage } from './DominoStage';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Tipado mínimo de Google Identity Services (google.accounts.oauth2) — la
// librería se carga como script global en index.html, no vía npm.
//
// Se usa el "code client" (Authorization Code, popup propio) en vez del
// botón prearmado (google.accounts.id.renderButton): ese widget fuerza su
// propio diseño (incluida una placa blanca fija detrás del logo) porque es
// el componente de marca registrada de Google. Con el code client, el botón
// es 100% nuestro — solo dispara el popup de Google al clickear — y el
// backend intercambia el código por un id_token verificable igual que antes.
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            callback: (r: { code: string } | { error: string }) => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}

type Props = {
  onSuccess: (user: AuthUser, config: UserConfig) => void;
  dark: boolean;
  onToggleTheme: () => void;
};

export default function LoginScreen({ onSuccess, dark, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [remember,  setRemember]  = useState(false);
  const [touched,   setTouched]   = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  // Cuenta sin confirmar: en vez del error genérico, ofrecer reenviar el
  // link — es el único caso en que el usuario tiene una acción real que
  // tomar acá mismo, sin ir a otra pantalla.
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
      setReenviado(true);
    } catch {
      // best-effort — el endpoint no distingue "no existe" de "ya falló el envío"
      setReenviado(true);
    } finally {
      setReenviando(false);
    }
  }

  async function handleGoogleCode(code: string) {
    setApiError(null);
    setLoading(true);
    try {
      const authRes = await api.loginGoogle(code);
      tokenStore.set(authRes.token, true);
      const config = await api.getPreferencias();
      onSuccess(authRes.user, config);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  }

  // Cuenta efímera, sin datos que pedir — por eso sessionStorage (persist
  // false): no hay email/contraseña que recordar si se pierde el token.
  async function handleGuestClick() {
    setApiError(null);
    setLoading(true);
    try {
      const authRes = await api.jugarInvitado();
      tokenStore.set(authRes.token, false);
      const config = await api.getPreferencias();
      onSuccess(authRes.user, config);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'No se pudo iniciar como invitado');
    } finally {
      setLoading(false);
    }
  }

  // El code client se crea una sola vez (no hace falta re-crearlo por
  // cambios de tema, a diferencia del widget prearmado de antes).
  const codeClientRef = useRef<{ requestCode: () => void } | null>(null);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelado = false;
    function intentar() {
      if (cancelado) return;
      if (!window.google) { setTimeout(intentar, 100); return; }
      codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID!,
        scope: 'openid email profile',
        ux_mode: 'popup',
        callback: (r) => { if ('code' in r) handleGoogleCode(r.code); },
      });
    }
    intentar();
    return () => { cancelado = true; };
  }, []);

  function handleGoogleClick() {
    codeClientRef.current?.requestCode();
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

          {sinVerificar && (
            <div className="lg-alert" role="alert">
              {reenviado ? (
                <>✉ Te reenviamos el link de confirmación a <strong>{email}</strong>.</>
              ) : (
                <>
                  ⚠ Confirmá tu cuenta desde el email que te mandamos antes de iniciar sesión.{' '}
                  <button
                    type="button"
                    className="lg-link"
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
              onClick={() => navigate('/forgot')}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button type="submit" className="lg-submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar al juego'}
          </button>

          <div className="lg-divider"><span>o</span></div>

          <button
            type="button"
            className="lg-google"
            onClick={handleGoogleClick}
            disabled={loading || !GOOGLE_CLIENT_ID}
            title={GOOGLE_CLIENT_ID ? undefined : 'Próximamente'}
          >
            <GoogleIcon /> Continuar con Google
          </button>

          <button
            type="button"
            className="lg-guest"
            onClick={handleGuestClick}
            disabled={loading}
          >
            Jugar como invitado
          </button>

          <p className="lg-foot">
            ¿No tienes cuenta?{' '}
            <button type="button" className="lg-link lg-link-strong" onClick={() => navigate('/register')} disabled={loading}>
              Crear cuenta
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
