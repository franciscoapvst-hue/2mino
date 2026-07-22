import { createContext, useContext, useState, useEffect } from 'react';
import {
  Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams,
} from 'react-router-dom';
import LandingScreen from './components/LandingScreen';
import PrivacidadView from './components/legal/PrivacidadView';
import TerminosView from './components/legal/TerminosView';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ForgotScreen from './components/ForgotScreen';
import Dashboard from './components/Dashboard';
import AppShell from './components/AppShell';
import SalasView from './components/SalasView';
import MatchmakingView from './components/MatchmakingView';
import PieceDemo from './components/game/PieceDemo';
import GameBoard from './components/game/GameBoard';
import FriendsView from './components/social/FriendsView';
import LeaderboardView from './components/social/LeaderboardView';
import MatchHistoryView from './components/social/MatchHistoryView';
import ReplayViewer from './components/social/ReplayViewer';
import OnboardingLevelScreen, { type NivelDomino } from './components/tutorial/OnboardingLevelScreen';
import TutorialGame from './components/tutorial/TutorialGame';
import TorneosListView from './torneos/TorneosListView';
import TorneoDetalleView from './torneos/TorneoDetalleView';
import TorneoInscripcionForm from './torneos/TorneoInscripcionForm';
import TorneoUnirseView from './torneos/TorneoUnirseView';
import TiendaView from './components/TiendaView';
import { api, tokenStore, type AuthUser, type UserConfig, type Sala } from './api';
import { useSocialSocket } from './hooks/useSocialSocket';
import { sounds } from './game/sounds';
import { skinFichaDe } from './skins';

// El tutorial se ofrece una sola vez: se marca en `opciones` del usuario
// (mismo bucket genérico que ya usan tema/idioma — ver ms-frontend-landing),
// así no hace falta ninguna tabla/columna nueva en el backend.
function necesitaOnboarding(config: UserConfig): boolean {
  return !config.opciones?.tutorial_estado;
}

type Session = { user: AuthUser; config: UserConfig };

// ── Contexto de app ───────────────────────────────────────────────
// El shell a nivel de app (AppShell + sidebar) tiene que persistir entre
// pantallas y DENTRO de la partida (docs/PLAN_ESCRITORIO.md, S1). Para eso
// el shell se monta una sola vez, como layout route con <Outlet/>, y las
// vistas ruteadas cuelgan de él. Como React re-monta un componente cuando
// su *tipo* cambia, las rutas y el layout tienen que ser componentes
// estables a nivel de módulo (no funciones re-creadas en cada render de
// App); por eso todo lo dinámico (sesión, tema, handlers) baja por este
// contexto en vez de por props/closures redefinidos cada render.
type AppCtx = {
  session: Session | null;
  dark: boolean;
  toggleTheme: () => void;
  enVivo: Map<string, boolean>;
  notifVersion: number;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  salaParaReintegrar: Sala | null;
  onReintegrarSala: () => void;
  onDescartarReintegro: () => void;
  handleLogout: () => void;
  handleUnirseSala: (codigo: string) => void;
  handleInvitarCompanero: (usuarioId: string) => void;
  handleAgregarAmigo: (usuarioId: string, username: string) => void;
  handleSuccess: (user: AuthUser, config: UserConfig) => void;
  handleNivelElegido: (nivel: NivelDomino) => void;
  handleTutorialResuelto: () => void;
};

const AppContext = createContext<AppCtx | null>(null);
function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fuera de <AppContext.Provider>');
  return ctx;
}

// ── Layout autenticado: monta el shell una vez y rutea con <Outlet/> ──
function AuthLayout() {
  const {
    session, dark, toggleTheme, handleLogout, handleUnirseSala, notifVersion, setSession,
  } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <AppShell
      user={session.user}
      config={session.config}
      dark={dark}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      onAvatarChange={(avatar) => setSession(s => s && { ...s, user: { ...s.user, avatar } })}
      onUnirseSala={handleUnirseSala}
      notifVersion={notifVersion}
    >
      <Outlet />
    </AppShell>
  );
}

// Guarda para rutas públicas (landing/login/…): si ya hay sesión, al home.
function PublicOnly({ children }: { children: JSX.Element }) {
  const { session } = useApp();
  return !session ? children : <Navigate to="/home" replace />;
}

// ── Rutas autenticadas (dentro del shell) ─────────────────────────

function HomeRoute() {
  const { session, dark, salaParaReintegrar, onReintegrarSala, onDescartarReintegro } = useApp();
  const navigate = useNavigate();
  if (!session) return null;
  return (
    <Dashboard
      user={session.user}
      config={session.config}
      dark={dark}
      onGoToSalas={() => navigate('/rooms')}
      onGoToRanked={() => navigate('/ranked')}
      onGoToCasual={() => navigate('/casual')}
      onGoToTorneos={() => navigate('/tournaments')}
      salaParaReintegrar={salaParaReintegrar}
      onReintegrarSala={onReintegrarSala}
      onDescartarReintegro={onDescartarReintegro}
    />
  );
}

function GameRoute() {
  const { session, handleInvitarCompanero, handleAgregarAmigo } = useApp();
  const { salaId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [sala, setSala] = useState<Sala | null>(null);

  // Se resuelve fresca contra el backend en cada montaje — a diferencia
  // del viejo estado en memoria, recargar /game/:id (o entrar por link)
  // no rompe la partida en curso.
  useEffect(() => {
    let cancelado = false;
    api.salas.detalle(salaId!)
      .then(s => { if (!cancelado) setSala(s); })
      .catch(() => navigate('/home', { replace: true }));
    return () => { cancelado = true; };
  }, [salaId, navigate]);

  const origin = (location.state as { origin?: string } | null)?.origin === 'rooms' ? '/rooms' : '/home';

  async function handleRevancha() {
    if (!sala) return;
    try {
      const { sala_codigo } = await api.social.revancha(sala.id);
      const nuevaSala = await api.salas.porCodigo(sala_codigo);
      navigate('/rooms', { state: { salaEspera: nuevaSala } });
    } catch { /* noop, botón best-effort */ }
  }

  if (!session) return null;
  if (!sala) {
    return (
      <div className="app-shell">
        <div className="boot-spinner" aria-label="Cargando…" />
      </div>
    );
  }

  return (
    <GameBoard
      sala={sala}
      user={session.user}
      config={session.config}
      onExit={() => navigate(origin)}
      onRevancha={handleRevancha}
      onInvitarCompanero={handleInvitarCompanero}
      onAgregarAmigo={handleAgregarAmigo}
    />
  );
}

function RoomsRoute() {
  const { session, dark } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const salaInicial = (location.state as { salaEspera?: Sala } | null)?.salaEspera ?? null;
  if (!session) return null;
  return (
    <SalasView
      user={session.user}
      dark={dark}
      onBack={() => navigate('/home')}
      onGameStart={(sala) => navigate(`/game/${sala.id}`, { state: { origin: 'rooms' } })}
      salaInicial={salaInicial}
    />
  );
}

function MatchmakingRoute({ tipo }: { tipo: 'ranked' | 'casual' }) {
  const { session, dark } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const partyCodigo = tipo === 'ranked'
    ? ((location.state as { partyCodigo?: string } | null)?.partyCodigo ?? null)
    : null;
  if (!session) return null;
  return (
    <MatchmakingView
      user={session.user}
      tipo={tipo}
      dark={dark}
      onBack={() => navigate('/home')}
      onGameStart={(sala) => navigate(`/game/${sala.id}`, { state: { origin: 'home' } })}
      autoJoinCodigo={partyCodigo}
    />
  );
}

function FriendsRoute() {
  const { dark, enVivo } = useApp();
  const navigate = useNavigate();
  return <FriendsView dark={dark} onBack={() => navigate('/home')} conectadosEnVivo={enVivo} />;
}

function LeaderboardRoute() {
  const { session, dark } = useApp();
  const navigate = useNavigate();
  if (!session) return null;
  return <LeaderboardView dark={dark} onBack={() => navigate('/home')} miUsuarioId={session.user.id} />;
}

function HistoryRoute() {
  const { dark } = useApp();
  const navigate = useNavigate();
  return (
    <MatchHistoryView
      dark={dark}
      onBack={() => navigate('/home')}
      onVerReplay={(salaId) => navigate(`/replay/${salaId}`)}
    />
  );
}

function ReplayRoute() {
  const { dark } = useApp();
  const { salaId } = useParams();
  const navigate = useNavigate();
  return <ReplayViewer dark={dark} salaId={salaId!} onBack={() => navigate('/history')} />;
}

function TorneosRoute() {
  const navigate = useNavigate();
  return <TorneosListView onVolver={() => navigate('/home')} onVerTorneo={(id) => navigate(`/tournaments/${id}`)} />;
}

function TorneoDetalleRoute() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  return (
    <TorneoDetalleView
      torneoId={torneoId!}
      onVolver={() => navigate('/tournaments')}
      onInscribirme={(id) => navigate(`/tournaments/${id}/enroll`)}
      onUnirseConCodigo={(id) => navigate(`/tournaments/${id}/join`)}
    />
  );
}

function TorneoEnrollRoute() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  return (
    <TorneoInscripcionForm
      torneoId={torneoId!}
      onVolver={() => navigate(`/tournaments/${torneoId}`)}
      onListo={(id) => navigate(`/tournaments/${id}`)}
    />
  );
}

function TorneoJoinRoute() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  return (
    <TorneoUnirseView
      torneoId={torneoId!}
      onVolver={() => navigate(`/tournaments/${torneoId}`)}
      onListo={(id) => navigate(`/tournaments/${id}`)}
    />
  );
}

function TiendaRoute() {
  const { session, dark, setSession } = useApp();
  const navigate = useNavigate();
  if (!session) return null;
  return (
    <TiendaView
      dark={dark}
      config={session.config}
      onConfigChange={(config) => setSession(sess => sess && { ...sess, config })}
      onBack={() => navigate('/home')}
    />
  );
}

// ── Rutas autenticadas de pantalla completa (sin shell) ───────────
function OnboardingRoute() {
  const { session, dark, handleNivelElegido } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  return <OnboardingLevelScreen dark={dark} onElegir={handleNivelElegido} />;
}

function TutorialRoute() {
  const { session, handleTutorialResuelto } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  return <TutorialGame onSkip={handleTutorialResuelto} onFinish={handleTutorialResuelto} />;
}

function PieceDemoRoute() {
  const { session } = useApp();
  const navigate = useNavigate();
  return (
    <PieceDemo
      onBack={() => navigate(session ? '/home' : '/login')}
      skin={session ? skinFichaDe(session.config.opciones) : undefined}
    />
  );
}

// Link de invitación a party (/party/:codigo): sin sesión manda a login,
// con sesión manda directo a ranked — en ambos casos el código viaja en
// location.state para que ranked lo use como autoJoinCodigo.
function PartyRedirect() {
  const { session } = useApp();
  const { codigo } = useParams();
  return session
    ? <Navigate to="/ranked" replace state={{ partyCodigo: codigo }} />
    : <Navigate to="/login" replace state={{ partyCodigo: codigo }} />;
}

// Link de confirmación de cuenta por email. El backend ya devuelve
// token+user al verificar — no hace falta un login aparte.
function VerifyEmailRoute() {
  const { handleSuccess } = useApp();
  const { token } = useParams();
  const navigate = useNavigate();
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    api.verificarEmail(token!)
      .then(async (authRes) => {
        tokenStore.set(authRes.token, true);
        const config = await api.getPreferencias();
        handleSuccess(authRes.user, config);
      })
      .catch(() => setFallo(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (fallo) {
    return (
      <div className="login-screen">
        <section className="lg-panel">
          <div className="lg-form lg-sent">
            <span className="lg-sent-icon" aria-hidden="true">⚠</span>
            <h2>El link no es válido o venció</h2>
            <p className="lg-sent-sub">
              Los links de confirmación duran 24 horas. Iniciá sesión con tu
              correo y contraseña — si tu cuenta todavía no está confirmada,
              ahí vas a poder pedir que te reenviemos el link.
            </p>
            <button type="button" className="lg-submit" onClick={() => navigate('/login')}>
              Ir a iniciar sesión
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="boot-spinner" aria-label="Cargando…" />
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [session,  setSession]  = useState<Session | null>(null);
  const [booting,  setBooting]  = useState(true);
  // Partida en_juego que el usuario ya tenía abierta al iniciar sesión —
  // se ofrece reintegrarse desde un banner en el dashboard, en vez de
  // forzar la navegación (por eso vive aparte de la ruta /game/:id).
  const [salaParaReintegrar, setSalaParaReintegrar] = useState<Sala | null>(null);
  const [dark,    setDark]    = useState<boolean>(
    () => localStorage.getItem('2mino-theme') !== 'light'
  );
  // WS de presencia/notificaciones (docs/CASOS_DE_USO_SOCIAL.md §2.3):
  // un solo socket para toda la sesión, su estado baja por el contexto a
  // quien lo necesite (AppShell para el badge de la campana, FriendsView
  // para los puntitos de "en línea").
  const { enVivo, notifVersion } = useSocialSocket(session ? tokenStore.get() : null);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
    localStorage.setItem('2mino-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Click genérico en cualquier botón de la app (delegación: un solo
  // listener para toda la vida de la app, en vez de tocar cada botón).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const boton = target.closest('button, [role="button"]') as HTMLButtonElement | null;
      if (boton && !boton.disabled) sounds.click();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Restore session from stored token. Si la ruta actual es la de
  // verificación de email, esa ruta (VerifyEmailRoute) ya se encarga de
  // loguear con la cuenta recién confirmada — no pisarla con una sesión
  // vieja que pudiera haber en este navegador.
  useEffect(() => {
    if (location.pathname.startsWith('/verify-email/')) { setBooting(false); return; }

    const token = tokenStore.get();
    if (!token) { setBooting(false); return; }

    Promise.all([api.me(), api.getPreferencias()])
      .then(([user, config]) => {
        if (config.tema) setDark(config.tema === 'dark');
        setSession({ user, config });
      })
      .catch(() => tokenStore.clear())
      .finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al iniciar sesión (login fresco o sesión restaurada), avisar si ya
  // había una partida en curso — para que se pueda reintegrar en vez de
  // quedar "perdida" (desconexión, cierre de pestaña, etc.). Keyed a
  // user.id, no a `session` entero: no debe repetirse cada vez que algo
  // más (ej. cambiar de avatar) actualiza el objeto de sesión.
  //
  // Detrás de un feature flag (reintegro_partida_activa_habilitado, BO →
  // Feature flags): si diera problemas, se apaga sin redeploy — ni
  // siquiera se llega a pedir /salas/activa.
  useEffect(() => {
    if (!session) return;
    api.featureFlags()
      .then(flags => {
        if (!flags.reintegro_partida_activa_habilitado) return;
        return api.salas.activa().then(r => setSalaParaReintegrar(r.sala));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  function handleReintegrarSala() {
    if (!salaParaReintegrar) return;
    navigate(`/game/${salaParaReintegrar.id}`, { state: { origin: 'home' } });
    setSalaParaReintegrar(null);
  }

  function handleSuccess(user: AuthUser, config: UserConfig) {
    if (config.tema) setDark(config.tema === 'dark');
    setSession({ user, config });
    const partyCodigo = (location.state as { partyCodigo?: string } | null)?.partyCodigo;
    navigate(
      partyCodigo ? '/ranked' : necesitaOnboarding(config) ? '/onboarding' : '/home',
      { replace: true, state: partyCodigo ? { partyCodigo } : undefined },
    );
  }

  // Guarda dentro de `opciones` sin pisar otras claves que ya hubiera
  // (el PUT de preferencias reemplaza `opciones` entero, no hace merge).
  async function guardarOpcionesTutorial(partial: Record<string, unknown>) {
    if (!session) return;
    try {
      const opciones = { ...(session.config.opciones ?? {}), ...partial };
      const nuevo = await api.putPreferencias({ opciones });
      setSession(s => s && { ...s, config: nuevo });
    } catch { /* si falla, no bloquea la navegación */ }
  }

  async function handleNivelElegido(nivel: NivelDomino) {
    if (nivel === 'suficiente') {
      await guardarOpcionesTutorial({ tutorial_estado: 'completado', tutorial_nivel: nivel });
      navigate('/home');
    } else {
      await guardarOpcionesTutorial({ tutorial_nivel: nivel });
      navigate('/tutorial');
    }
  }

  async function handleTutorialResuelto() {
    await guardarOpcionesTutorial({ tutorial_estado: 'completado' });
    navigate('/home');
  }

  async function handleLogout() {
    // Si es invitado, el gateway borra la cuenta acá (efímera a propósito)
    // — por eso hay que esperarlo ANTES de limpiar el token, que es lo que
    // manda el header Authorization. Best-effort: si falla (red caída),
    // igual hay que dejar salir al usuario.
    try { await api.logout(); } catch { /* noop */ }
    tokenStore.clear();
    setSession(null);
    navigate('/login');
  }

  // Unirse a una sala desde una invitación de la bandeja de entrada
  // (InboxPopover). Usa los endpoints reales de salas — ya existen,
  // a diferencia del resto de "social" que todavía es mock.
  async function handleUnirseSala(codigo: string) {
    if (!session) return;
    try {
      const detalle = await api.salas.porCodigo(codigo);
      const yaEstoy = detalle.jugadores?.some(j => j.usuario_id === session.user.id);
      const final = yaEstoy ? detalle : await api.salas.unirse(detalle.id);
      if (final.estado === 'en_juego') {
        navigate(`/game/${final.id}`, { state: { origin: 'home' } });
      } else {
        // Aterrizar DENTRO de la sala de espera, no en la lista de salas —
        // ya estamos sentados en el backend; sin esto el jugador quedaba
        // "afuera" mirando el listado.
        navigate('/rooms', { state: { salaEspera: final } });
      }
    } catch {
      // TODO: mostrar aviso de error (código no encontrado / sala llena)
      navigate('/rooms');
    }
  }

  function handleInvitarCompanero(usuarioId: string) {
    api.social.invitarCompanero(usuarioId).catch(() => {});
  }
  function handleAgregarAmigo(usuarioId: string) {
    api.social.enviarSolicitud(usuarioId).catch(() => {});
  }

  if (booting) {
    return (
      <div className="app-shell">
        <div className="boot-spinner" aria-label="Cargando…" />
      </div>
    );
  }

  const ctx: AppCtx = {
    session,
    dark,
    toggleTheme: () => setDark(d => !d),
    enVivo,
    notifVersion,
    setSession,
    salaParaReintegrar,
    onReintegrarSala: handleReintegrarSala,
    onDescartarReintegro: () => setSalaParaReintegrar(null),
    handleLogout,
    handleUnirseSala,
    handleInvitarCompanero,
    handleAgregarAmigo,
    handleSuccess,
    handleNivelElegido,
    handleTutorialResuelto,
  };

  return (
    <AppContext.Provider value={ctx}>
      <Routes>
        <Route path="/" element={<Navigate to={session ? '/home' : '/landing'} replace />} />

        {/* Landing: pública, pero SIN el guard de PublicOnly — el logo del
            sidebar manda acá aunque haya sesión (ver AppSidebar), así que
            esta ruta no puede rebotar a /home cuando el usuario ya está
            logueado. Las demás públicas (login/registro/olvidé) sí lo
            mantienen, porque no tiene sentido mostrarlas con sesión activa. */}
        <Route path="/landing" element={
          <LandingScreen dark={dark} onToggleTheme={() => setDark(d => !d)} />
        } />
        <Route path="/login" element={
          <PublicOnly><LoginScreen onSuccess={handleSuccess} dark={dark} onToggleTheme={() => setDark(d => !d)} /></PublicOnly>
        } />
        <Route path="/register" element={
          <PublicOnly><RegisterScreen onSuccess={handleSuccess} dark={dark} onToggleTheme={() => setDark(d => !d)} /></PublicOnly>
        } />
        <Route path="/forgot" element={
          <PublicOnly><ForgotScreen dark={dark} onToggleTheme={() => setDark(d => !d)} /></PublicOnly>
        } />

        {/* Autenticadas con shell persistente (sidebar en todas, incluida /game) */}
        <Route element={<AuthLayout />}>
          <Route path="/home" element={<HomeRoute />} />
          <Route path="/rooms" element={<RoomsRoute />} />
          <Route path="/ranked" element={<MatchmakingRoute tipo="ranked" />} />
          <Route path="/casual" element={<MatchmakingRoute tipo="casual" />} />
          <Route path="/game/:salaId" element={<GameRoute />} />
          <Route path="/friends" element={<FriendsRoute />} />
          <Route path="/leaderboard" element={<LeaderboardRoute />} />
          <Route path="/history" element={<HistoryRoute />} />
          <Route path="/replay/:salaId" element={<ReplayRoute />} />
          <Route path="/tournaments" element={<TorneosRoute />} />
          <Route path="/tournaments/:torneoId" element={<TorneoDetalleRoute />} />
          <Route path="/tournaments/:torneoId/enroll" element={<TorneoEnrollRoute />} />
          <Route path="/tournaments/:torneoId/join" element={<TorneoJoinRoute />} />
          <Route path="/tienda" element={<TiendaRoute />} />
          {/* Con sesión, "Ver fichas" cuelga del shell como cualquier otra
              sección (mismo Outlet persistente) — si viviera afuera, entrar
              acá remontaría el shell y el sidebar desaparecería un instante. */}
          {session && <Route path="/piece-demo" element={<PieceDemoRoute />} />}
        </Route>

        {/* Autenticadas de pantalla completa (sin shell) */}
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/tutorial" element={<TutorialRoute />} />

        {/* Demo de fichas sin sesión (ej. desde landing) — pantalla completa,
            no hay shell que mantener porque todavía no hay sidebar. */}
        {!session && <Route path="/piece-demo" element={<PieceDemoRoute />} />}

        <Route path="/party/:codigo" element={<PartyRedirect />} />
        <Route path="/verify-email/:token" element={<VerifyEmailRoute />} />

        {/* Legales — públicas, con o sin sesión (requisito de AdSense:
            deben navegarse sin login). */}
        <Route path="/privacidad" element={<PrivacidadView />} />
        <Route path="/terminos" element={<TerminosView />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppContext.Provider>
  );
}
