import { useState, type FormEvent } from 'react';
import { login } from '../lib/api';
import type { AdminSession } from '../lib/types';
import './login.css';

export default function LoginView({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(email, password);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bo-login-shell">
      <form className="bo-login-card" onSubmit={handleSubmit}>
        <div className="bo-login-mark" aria-hidden="true" />
        <h1>2mino — Back Office</h1>
        <p className="bo-login-sub">Acceso restringido — requiere segmento admin.</p>

        <div className="bo-field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            className="bo-input"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu-cuenta@correo.com"
            autoComplete="username"
          />
        </div>
        <div className="bo-field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            className="bo-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="bo-form-error" role="alert">{error}</p>}

        <button type="submit" className="bo-btn bo-btn-primary bo-login-submit" disabled={loading}>
          {loading ? 'Verificando…' : 'Entrar'}
        </button>

        <p className="bo-login-note">
          Misma cuenta y contraseña que usás en el juego — solo entra si tu
          usuario tiene el segmento <code>admin</code>.
        </p>
      </form>
    </div>
  );
}
