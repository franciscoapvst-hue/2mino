import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ForgotScreen from './components/ForgotScreen';
import RegisterForm from './components/RegisterForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import Dashboard from './components/Dashboard';
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
import { api, tokenStore, type AuthUser, type UserConfig, type Sala } from './api';
import { DominoTile, SunIcon, MoonIcon } from './components/icons';
import { useSocialSocket } from './hooks/useSocialSocket';
import { sounds } from './game/sounds';

export type View = 'login' | 'register' | 'forgot';
type AppView = View | 'dashboard' | 'salas' | 'ranked' | 'casual' | 'piece-demo' | 'game'
  | 'amigos' | 'leaderboard' | 'historial' | 'replay' | 'onboarding' | 'tutorial'
  | 'torneos' | 'torneo-detalle' | 'torneo-inscripcion' | 'torneo-unirse';

// El tutorial se ofrece una sola vez: se marca en `opciones` del usuario
// (mismo bucket genérico que ya usan tema/idioma — ver ms-frontend-landing),
// así no hace falta ninguna tabla/columna nueva en el backend.
function necesitaOnboarding(config: UserConfig): boolean {
  return !config.opciones?.tutorial_estado;
}

type Session = { user: AuthUser; config: UserConfig };

// Sin router todavía (ver docs/REFACTOR.md P4): un link de invitación a
// party tiene forma /party/:codigo. Se parsea una sola vez al cargar y
// se limpia la URL, para no tener que instalar react-router por esto.
//
// Se calcula a nivel de módulo (corre una única vez, al cargar el JS),
// no dentro del inicializador de useState: React 18 StrictMode invoca
// dos veces el inicializador lazy de useState en dev para detectar
// funciones impuras — como esta función limpia la URL como efecto
// secundario, una segunda invocación ya no encuentra el código (la
// primera, descartada por StrictMode, ya la había limpiado), y el link
// de invitación queda roto en dev.
const CODIGO_PARTY_DE_URL: string | null = (() => {
  const m = window.location.pathname.match(/^\/party\/([A-Za-z0-9-]+)/);
  if (!m) return null;
  window.history.replaceState(null, '', '/');
  return m[1];
})();

// Link de confirmación de cuenta: /verificar-email/:token (mismo patrón
// que el de arriba — se lee y se limpia la URL una sola vez al cargar).
const TOKEN_VERIFICACION_DE_URL: string | null = (() => {
  const m = window.location.pathname.match(/^\/verificar-email\/([A-Za-z0-9]+)/);
  if (!m) return null;
  window.history.replaceState(null, '', '/');
  return m[1];
})();

export default function App() {
  const [view,     setView]     = useState<AppView>('login');
  const [session,  setSession]  = useState<Session | null>(null);
  const [booting,  setBooting]  = useState(true);
  const [gameSala, setGameSala]   = useState<Sala | null>(null);
  // A dónde volver al salir de una partida terminada.
  const [gameOrigin, setGameOrigin] = useState<'salas' | 'dashboard'>('salas');
  // Sala seleccionada para ver su repetición (MatchHistoryView → ReplayViewer).
  const [replaySalaId, setReplaySalaId] = useState<string | null>(null);
  // Torneo seleccionado al navegar de listado → detalle/inscripción/unirse.
  const [torneoIdActual, setTorneoIdActual] = useState<string | null>(null);
  // Sala 'esperando' a abrir directamente al entrar a SalasView (revancha /
  // invitación aceptada) — de un solo uso: SalasView avisa al consumirla.
  const [salaEsperaInicial, setSalaEsperaInicial] = useState<Sala | null>(null);
  // Partida en_juego que el usuario ya tenía abierta al iniciar sesión —
  // se ofrece reintegrarse desde un banner en el dashboard, en vez de
  // forzar la navegación (por eso vive aparte de `gameSala`).
  const [salaParaReintegrar, setSalaParaReintegrar] = useState<Sala | null>(null);
  // Link de confirmación de cuenta inválido/vencido — se muestra un aviso
  // en vez de dejar caer silenciosamente a login sin explicar por qué.
  const [verificacionFallo, setVerificacionFallo] = useState(false);
  // Invitación a party vía link (/party/ABCD). El inicializador de useState
  // corre síncrono en el primer render, ANTES que cualquier efecto —
  // evita que el .then() del restore de sesión capture un valor null por
  // clausura si en vez usáramos un efecto separado para parsear la URL.
  const [partyCodigo] = useState<string | null>(() => CODIGO_PARTY_DE_URL);
  const [dark,    setDark]    = useState<boolean>(
    () => localStorage.getItem('2mino-theme') !== 'light'
  );
  // WS de presencia/notificaciones (docs/CASOS_DE_USO_SOCIAL.md §2.3):
  // un solo socket para toda la sesión, su estado baja como props a quien
  // lo necesite (Dashboard para el badge de la campana, FriendsView para
  // los puntitos de "en línea").
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

  // Confirmar cuenta desde el link del email: gana sobre restaurar sesión
  // (si ya había una sesión vieja en este navegador, el link igual debe
  // loguear con la cuenta recién confirmada). Al confirmar, el backend ya
  // devuelve token+user — no hace falta un login aparte.
  useEffect(() => {
    if (!TOKEN_VERIFICACION_DE_URL) return;
    api.verificarEmail(TOKEN_VERIFICACION_DE_URL)
      .then(async (authRes) => {
        tokenStore.set(authRes.token, true);
        const config = await api.getPreferencias();
        handleSuccess(authRes.user, config);
      })
      .catch(() => setVerificacionFallo(true))
      .finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore session from stored token
  useEffect(() => {
    if (TOKEN_VERIFICACION_DE_URL) return; // el efecto de arriba ya se encarga

    const token = tokenStore.get();
    if (!token) { setBooting(false); return; }

    Promise.all([api.me(), api.getPreferencias()])
      .then(([user, config]) => {
        if (config.tema) setDark(config.tema === 'dark');
        setSession({ user, config });
        // Un link de invitación a party siempre gana sobre el onboarding
        // (no interrumpir a alguien que ya viene con destino claro).
        setView(partyCodigo ? 'ranked' : necesitaOnboarding(config) ? 'onboarding' : 'dashboard');
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
    setGameSala(salaParaReintegrar);
    setGameOrigin('dashboard');
    setView('game');
    setSalaParaReintegrar(null);
  }

  function handleSuccess(user: AuthUser, config: UserConfig) {
    if (config.tema) setDark(config.tema === 'dark');
    setSession({ user, config });
    setView(partyCodigo ? 'ranked' : necesitaOnboarding(config) ? 'onboarding' : 'dashboard');
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
      setView('dashboard');
    } else {
      await guardarOpcionesTutorial({ tutorial_nivel: nivel });
      setView('tutorial');
    }
  }

  async function handleTutorialResuelto() {
    await guardarOpcionesTutorial({ tutorial_estado: 'completado' });
    setView('dashboard');
  }

  function handleLogout() {
    tokenStore.clear();
    setSession(null);
    setView('login');
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
      setGameSala(final);
      setGameOrigin('dashboard');
      if (final.estado === 'en_juego') {
        setView('game');
      } else {
        // Aterrizar DENTRO de la sala de espera, no en la lista de salas —
        // ya estamos sentados en el backend; sin esto el jugador quedaba
        // "afuera" mirando el listado.
        setSalaEsperaInicial(final);
        setView('salas');
      }
    } catch {
      // TODO: mostrar aviso de error (código no encontrado / sala llena)
      setView('salas');
    }
  }

  // Acciones sociales post-partida (§6/§7 del doc de casos de uso).
  async function handleRevancha() {
    if (!gameSala) return;
    try {
      const { sala_codigo } = await api.social.revancha(gameSala.id);
      const nuevaSala = await api.salas.porCodigo(sala_codigo);
      setGameSala(nuevaSala);
      setGameOrigin('dashboard');
      // La sala de revancha nace 'esperando' (con el solicitante ya
      // sentado): entrar directo a su sala de espera. Antes esto hacía
      // setView('salas') a secas → lista de salas → el jugador percibía
      // que "jugar de nuevo" lo echaba de la partida.
      setSalaEsperaInicial(nuevaSala);
      setView('salas');
    } catch { /* noop, botón best-effort */ }
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

  if (verificacionFallo && !session) {
    return (
      <div className={`login-screen${dark ? '' : ' is-light'}`}>
        <section className="lg-panel">
          <div className="lg-form lg-sent">
            <span className="lg-sent-icon" aria-hidden="true">⚠</span>
            <h2>El link no es válido o venció</h2>
            <p className="lg-sent-sub">
              Los links de confirmación duran 24 horas. Iniciá sesión con tu
              correo y contraseña — si tu cuenta todavía no está confirmada,
              ahí vas a poder pedir que te reenviemos el link.
            </p>
            <button
              type="button"
              className="lg-submit"
              onClick={() => { setVerificacionFallo(false); setView('login'); }}
            >
              Ir a iniciar sesión
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (view === 'piece-demo') {
    return <PieceDemo onBack={() => setView(session ? 'dashboard' : 'login')} />;
  }

  if (view === 'onboarding' && session) {
    return <OnboardingLevelScreen dark={dark} onElegir={handleNivelElegido} />;
  }

  if (view === 'tutorial' && session) {
    return (
      <TutorialGame
        onSkip={handleTutorialResuelto}
        onFinish={handleTutorialResuelto}
      />
    );
  }

  // Login / registro: pantallas completas dedicadas (forgot sigue en la card)
  if (view === 'login' && !session) {
    return (
      <LoginScreen
        onSwitch={setView}
        onSuccess={handleSuccess}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
      />
    );
  }

  if (view === 'register' && !session) {
    return (
      <RegisterScreen
        onSwitch={setView}
        onSuccess={handleSuccess}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
      />
    );
  }

  if (view === 'forgot' && !session) {
    return (
      <ForgotScreen
        onSwitch={setView}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
      />
    );
  }

  if (view === 'game' && session && gameSala) {
    return (
      <GameBoard
        sala={gameSala}
        user={session.user}
        onExit={() => { setGameSala(null); setView(gameOrigin); }}
        onRevancha={handleRevancha}
        onInvitarCompanero={handleInvitarCompanero}
        onAgregarAmigo={handleAgregarAmigo}
      />
    );
  }

  if (view === 'amigos' && session) {
    return <FriendsView dark={dark} onBack={() => setView('dashboard')} conectadosEnVivo={enVivo} />;
  }

  if (view === 'leaderboard' && session) {
    return <LeaderboardView dark={dark} onBack={() => setView('dashboard')} miUsuarioId={session.user.id} />;
  }

  if (view === 'historial' && session) {
    return (
      <MatchHistoryView
        dark={dark}
        onBack={() => setView('dashboard')}
        onVerReplay={(salaId) => { setReplaySalaId(salaId); setView('replay'); }}
      />
    );
  }

  if (view === 'replay' && session && replaySalaId) {
    return <ReplayViewer dark={dark} salaId={replaySalaId} onBack={() => setView('historial')} />;
  }

  if (view === 'salas' && session) {
    return (
      <SalasView
        user={session.user}
        dark={dark}
        onBack={() => setView('dashboard')}
        onGameStart={(sala) => { setGameSala(sala); setGameOrigin('salas'); setView('game'); }}
        salaInicial={salaEsperaInicial}
        onSalaInicialUsada={() => setSalaEsperaInicial(null)}
      />
    );
  }

  if ((view === 'ranked' || view === 'casual') && session) {
    return (
      <MatchmakingView
        user={session.user}
        tipo={view}
        dark={dark}
        onBack={() => setView('dashboard')}
        onGameStart={(sala) => { setGameSala(sala); setGameOrigin('dashboard'); setView('game'); }}
        autoJoinCodigo={view === 'ranked' ? partyCodigo : null}
      />
    );
  }

  if (view === 'torneos' && session) {
    return (
      <TorneosListView
        onVolver={() => setView('dashboard')}
        onVerTorneo={(id) => { setTorneoIdActual(id); setView('torneo-detalle'); }}
      />
    );
  }

  if (view === 'torneo-detalle' && session && torneoIdActual) {
    return (
      <TorneoDetalleView
        torneoId={torneoIdActual}
        onVolver={() => setView('torneos')}
        onInscribirme={(id) => { setTorneoIdActual(id); setView('torneo-inscripcion'); }}
        onUnirseConCodigo={(id) => { setTorneoIdActual(id); setView('torneo-unirse'); }}
      />
    );
  }

  if (view === 'torneo-inscripcion' && session && torneoIdActual) {
    return (
      <TorneoInscripcionForm
        torneoId={torneoIdActual}
        onVolver={() => setView('torneo-detalle')}
        onListo={(id) => { setTorneoIdActual(id); setView('torneo-detalle'); }}
      />
    );
  }

  if (view === 'torneo-unirse' && session && torneoIdActual) {
    return (
      <TorneoUnirseView
        torneoId={torneoIdActual}
        onVolver={() => setView('torneo-detalle')}
        onListo={(id) => { setTorneoIdActual(id); setView('torneo-detalle'); }}
      />
    );
  }

  if (view === 'dashboard' && session) {
    return (
      <Dashboard
        user={session.user}
        config={session.config}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
        onLogout={handleLogout}
        onGoToSalas={() => setView('salas')}
        onGoToRanked={() => setView('ranked')}
        onGoToCasual={() => setView('casual')}
        onPieceDemo={() => setView('piece-demo')}
        onAvatarChange={(avatar) =>
          setSession(s => s && { ...s, user: { ...s.user, avatar } })
        }
        onGoToAmigos={() => setView('amigos')}
        onGoToLeaderboard={() => setView('leaderboard')}
        onGoToHistorial={() => setView('historial')}
        onGoToTorneos={() => setView('torneos')}
        onUnirseSala={handleUnirseSala}
        notifVersion={notifVersion}
        salaParaReintegrar={salaParaReintegrar}
        onReintegrarSala={handleReintegrarSala}
        onDescartarReintegro={() => setSalaParaReintegrar(null)}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="auth-card">
        <header className="card-header">
          <DominoTile />
          <div className="logo-text">
            <h1>2mino</h1>
            <p>Juega. Compite. Domina.</p>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setDark(d => !d)}
            aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <div className="card-body">
          <div key={view} className="view-wrap">
            {view === 'login'    && <LoginForm          onSwitch={setView} onSuccess={handleSuccess} />}
            {view === 'register' && <RegisterForm        onSwitch={setView} onSuccess={handleSuccess} />}
            {view === 'forgot'   && <ForgotPasswordForm  onSwitch={setView} />}
          </div>
        </div>
      </div>
    </div>
  );
}
