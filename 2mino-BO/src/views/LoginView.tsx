import { useState, type FormEvent } from 'react';
import { login } from '../lib/api';
import type { AdminSession } from '../lib/types';
import './login.css';

export default function LoginView({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(username, password);
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
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            className="bo-input"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu-usuario"
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
          Mock local — cualquier usuario/contraseña entra. El login real llamará a{' '}
          <code>POST /auth/login</code> y validará <code>segmento === "admin"</code>.
        </p>
      </form>
    </div>
  );
}
