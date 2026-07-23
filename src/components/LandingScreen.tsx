import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import { Bone } from './DominoStage';
import Footer from './Footer';
import { SunIcon, MoonIcon } from './icons';
import GameIcon from './GameIcons';
import { todosLosRangos } from '../ranks';
import amigosImg  from '../assets/iconos/amigos.webp';
import bandejaImg from '../assets/iconos/bandeja.webp';

const RANGOS_PREVIEW = todosLosRangos();

// ── Ficha horizontal para el mockup de la mesa ─────
// Bone (DominoStage) es vertical (100×200); acá la cadena del tablero se
// lee en horizontal, así que se dibuja con su propio viewBox apaisado en
// vez de rotar la vertical con CSS (rotarla rompe la caja de layout).
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};
const G = [22, 50, 78];

function HHalf({ value }: { value: number }) {
  return (
    <>
      {PIPS[value].map(([c, r], i) => (
        <circle key={i} cx={G[c]} cy={G[r]} r={8.5} className="ld-pip" />
      ))}
    </>
  );
}

function HBone({ a, b, className = '' }: { a: number; b: number; className?: string }) {
  return (
    <svg viewBox="0 0 200 100" className={`ld-hbone ${className}`} aria-hidden="true">
      <rect x="3" y="3" width="194" height="94" rx="14" className="ld-hbone-body" />
      <line x1="100" y1="16" x2="100" y2="84" className="ld-hbone-divider" />
      <HHalf value={a} />
      <g transform="translate(100 0)"><HHalf value={b} /></g>
    </svg>
  );
}

type Props = {
  dark: boolean;
  onToggleTheme: () => void;
};

// Landing pública — lo primero que ve alguien sin sesión. Login/Register/
// Forgot siguen siendo pantallas propias (LoginScreen, etc); esta solo
// vende el juego y navega ahí directo.
export default function LandingScreen({ dark, onToggleTheme }: Props) {
  const navigate = useNavigate();

  // Scroll-reveal de las secciones bajo el hero (una llamada por sección,
  // orden fijo — ver src/hooks/useReveal.ts).
  const [demoVisible, demoRef] = useReveal();
  const [modesVisible, modesRef] = useReveal();
  const [rulesVisible, rulesRef] = useReveal();
  const [ranksVisible, ranksRef] = useReveal();
  const [torneosVisible, torneosRef] = useReveal();
  const [socialVisible, socialRef] = useReveal();
  const [finalCtaVisible, finalCtaRef] = useReveal();

  // Mismo parallax de fichas con el mouse que ya usa DominoStage (login) —
  // reimplementado acá porque el hero tiene su propia escena/tiles.
  // El rect se cachea en mouseenter (no en cada mousemove: leerlo ahí forzaría
  // un layout síncrono por evento) y el write de --px/--py se limita a una
  // vez por frame con rAF — "último valor gana", sin encolar frames.
  const sceneRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const posRef = useRef({ x: 0, y: 0 });

  const applyParallax = useCallback(() => {
    rafRef.current = null;
    const el = sceneRef.current;
    const rect = rectRef.current;
    if (!el || !rect) return;
    const { x, y } = posRef.current;
    el.style.setProperty('--px', ((x - rect.left) / rect.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((y - rect.top) / rect.height - 0.5).toFixed(3));
  }, []);

  const onEnter = useCallback(() => {
    rectRef.current = sceneRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(applyParallax);
    }
  }, [applyParallax]);

  const onLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = sceneRef.current;
    if (!el) return;
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
  }, []);

  return (
    <div className={`landing${dark ? '' : ' is-light'}`}>
      <header className="ld-nav">
        <div className="ld-nav-brand">
          <Bone a={6} b={6} className="ld-nav-bone" />
          <span className="ld-nav-word">2<span>mino</span></span>
        </div>
        <div className="ld-nav-actions">
          <button
            className="ld-theme"
            onClick={onToggleTheme}
            aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="ld-nav-login" onClick={() => navigate('/login')}>Iniciar sesión</button>
          <button className="ld-nav-cta" onClick={() => navigate('/register')}>Crear cuenta</button>
        </div>
      </header>

      {/* ── 1 · Hero ─────────────────────────────────── */}
      <section className="ld-hero" ref={sceneRef} onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={onLeave}>
        <div className="ld-hero-tiles" aria-hidden="true">
          <Bone a={6} b={6} className="ld-htile ld-htile-1" />
          <Bone a={6} b={3} className="ld-htile ld-htile-2" />
          <Bone a={5} b={2} className="ld-htile ld-htile-3" />
          <Bone a={4} b={4} className="ld-htile ld-htile-4" />
        </div>

        <div className="ld-hero-content">
          <p className="ld-eyebrow">Juega. Compite. Domina.</p>
          <h1 className="ld-h1">
            Dominó en línea con sabor a mesa<br />y orgullo de rango.
          </h1>
          <p className="ld-sub">
            1v1 o en parejas, ranked con ELO real o casual sin presión.
            Encuentra partida en segundos y deja que tu rango hable por ti.
          </p>
          <div className="ld-hero-actions">
            {/* Un solo botón grande: adentro (LoginScreen) ya se puede crear
                cuenta, seguir con Google o entrar como invitado — no hace
                falta triplicar esas rutas acá en el hero. */}
            <button className="ld-btn-primary ld-btn-hero" onClick={() => navigate('/login')}>
              Jugar gratis ahora
            </button>
          </div>
          <p className="ld-hero-note">
            Sin descargas: juegas desde el navegador, en el celular o en la computadora.
          </p>
        </div>
      </section>

      {/* ── 2 · Demo: la mesa en acción ──────────────── */}
      <section className={`ld-demo ld-reveal${demoVisible ? ' is-visible' : ''}`} ref={demoRef}>
        <h2 className="ld-h2">Así se siente la mesa</h2>
        <p className="ld-section-sub">
          Arrastra tu ficha, colócala en la punta y celebra en el chat.
          Rápido, fluido y con el sonido de la mesa de verdad.
        </p>

        <div className="ld-table" aria-hidden="true">
          <div className="ld-table-felt">
            <span className="ld-turn-pill">Tu turno</span>

            {/* Puntas de la cadena: 6 (izq) y 5 (der). La ficha jugada es el
                5|6 — entra por el 5 y también cerraba por el 6: capicúa real,
                para que la burbuja del chat no mienta. */}
            <div className="ld-chain">
              <HBone a={6} b={6} className="ld-chain-tile" />
              <HBone a={6} b={4} className="ld-chain-tile" />
              <HBone a={4} b={2} className="ld-chain-tile" />
              <HBone a={2} b={5} className="ld-chain-tile" />
              <HBone a={5} b={6} className="ld-chain-tile ld-chain-play" />
            </div>

            <div className="ld-chat-bubble">¡Capicúa! 🔥</div>

            {/* La mano se sostiene con las fichas paradas, como en la mesa */}
            <div className="ld-hand">
              <Bone a={3} b={3} className="ld-hand-tile" />
              <span className="ld-hand-slot" />
              <Bone a={1} b={0} className="ld-hand-tile" />
            </div>
          </div>
        </div>

        <ul className="ld-demo-feats">
          <li>Arrastra y suelta las fichas, también en pantalla táctil</li>
          <li>Chat en vivo con emojis en cada partida</li>
          <li>Repeticiones jugada por jugada al terminar</li>
        </ul>
      </section>

      {/* ── 3 · Modos de juego ───────────────────────── */}
      <section className={`ld-modes ld-reveal${modesVisible ? ' is-visible' : ''}`} ref={modesRef}>
        <h2 className="ld-h2">Elige cómo jugar</h2>

        <div className="ld-modes-layout">
          <a href="#ld-ranks" className="ld-featured">
            <Bone a={6} b={6} className="ld-featured-tile ld-featured-tile-a" />
            <Bone a={5} b={4} className="ld-featured-tile ld-featured-tile-b" />
            <div className="ld-featured-content">
              <span className="ld-featured-kicker">
                <GameIcon name="ranked" size={56} /> Ranked
              </span>
              <p>Sube de bronce a diamante con ELO real. Cada partida cuenta.</p>
              <span className="ld-featured-cta">Ver los rangos ↓</span>
            </div>
          </a>

          <div className="ld-mode-row">
            <div className="ld-mode-card">
              <GameIcon name="casual" size={48} />
              <h3>Casual</h3>
              <p>Las mismas reglas, cero presión. Juega por diversión sin que tu ELO se mueva.</p>
            </div>
            <div className="ld-mode-card">
              <GameIcon name="salas" size={48} />
              <h3>Salas</h3>
              <p>Crea una sala privada e invita a tu equipo con un enlace. Tú pones las reglas.</p>
            </div>
            <div className="ld-mode-card">
              <GameIcon name="torneos" size={48} />
              <h3>Torneos</h3>
              <p>Compite en torneos con bracket por el título de la temporada — y por premios reales.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 · Reglas personalizables ───────────────── */}
      <section className={`ld-rules ld-reveal${rulesVisible ? ' is-visible' : ''}`} ref={rulesRef}>
        <div className="ld-rules-copy">
          <h2 className="ld-h2">Las reglas las pones tú</h2>
          <p className="ld-section-sub">
            Cada mesa se arma como en el patio de tu casa: elige el modo,
            cuántos juegan y hasta cuántos puntos se va.
          </p>
        </div>

        <div className="ld-rules-panel" aria-hidden="true">
          <div className="ld-rules-group">
            <span className="ld-rules-label">Modo</span>
            <div className="ld-rules-chips">
              <span className="ld-chip is-active">Clásico</span>
              <span className="ld-chip">Rápido</span>
              <span className="ld-chip">Torneo</span>
            </div>
          </div>
          <div className="ld-rules-group">
            <span className="ld-rules-label">Jugadores</span>
            <div className="ld-rules-chips">
              <span className="ld-chip">2</span>
              <span className="ld-chip is-active">4</span>
            </div>
          </div>
          <div className="ld-rules-group">
            <span className="ld-rules-label">Tipo</span>
            <div className="ld-rules-chips">
              <span className="ld-chip is-active">Casual</span>
              <span className="ld-chip">Ranked</span>
            </div>
          </div>
          <div className="ld-rules-group">
            <span className="ld-rules-label">Partida a</span>
            <div className="ld-rules-chips">
              <span className="ld-chip is-active">100</span>
              <span className="ld-chip">150</span>
              <span className="ld-chip">200</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 · Rangos / ELO ─────────────────────────── */}
      <section id="ld-ranks" className={`ld-ranks ld-reveal${ranksVisible ? ' is-visible' : ''}`} ref={ranksRef}>
        <h2 className="ld-h2">Tu rango, tu orgullo</h2>
        <p className="ld-section-sub">
          Cinco escalones, un solo objetivo: que el equipo de enfrente sepa
          con quién está jugando.
        </p>

        <div className="ld-ranks-strip">
          {RANGOS_PREVIEW.map((r, i) => (
            <div className="ld-rank" key={r.nombre}>
              {r.url && <img src={r.url} alt={`Insignia de rango ${r.nombre}`} className="ld-rank-badge" loading="lazy" />}
              <span className="ld-rank-name">{r.nombre}</span>
              <span className="ld-rank-elo">{r.min === 0 ? 'Desde 0 ELO' : `${r.min}+ ELO`}</span>
              {i < RANGOS_PREVIEW.length - 1 && (
                <span className="ld-rank-arrow" aria-hidden="true">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 6 · Torneos con premios reales ───────────── */}
      <section className={`ld-torneos ld-reveal${torneosVisible ? ' is-visible' : ''}`} ref={torneosRef}>
        <div className="ld-torneos-inner">
          <GameIcon name="torneos" size={72} />
          <div className="ld-torneos-copy">
            <h2 className="ld-h2">Torneos con premios reales</h2>
            <p className="ld-section-sub">
              Cada temporada habrá torneos con bracket y premios reales.
              Inscríbete solo o con tu pareja, avanza ronda por ronda y
              llévate algo más que el orgullo.
            </p>
          </div>
          <button className="ld-btn-primary" onClick={() => navigate('/register')}>
            Quiero competir
          </button>
        </div>
      </section>

      {/* ── 7 · Social ───────────────────────────────── */}
      <section className={`ld-social ld-reveal${socialVisible ? ' is-visible' : ''}`} ref={socialRef}>
        <div className="ld-social-copy">
          <h2 className="ld-h2">Nunca juegues solo</h2>
          <ul className="ld-social-list">
            <li>
              <GameIcon name="leaderboard" size={40} />
              <div>
                <h4>Leaderboard</h4>
                <p>Mira quién manda en tu región y a quién le falta poco para alcanzarte.</p>
              </div>
            </li>
            <li>
              <img src={amigosImg} width={40} height={40} alt="" aria-hidden="true" loading="lazy" />
              <div>
                <h4>Amigos</h4>
                <p>Agrega jugadores y arma tu equipo fijo para las partidas en parejas.</p>
              </div>
            </li>
            <li>
              <GameIcon name="historial" size={40} />
              <div>
                <h4>Historial y repeticiones</h4>
                <p>Repasa cada jugada de tus partidas pasadas, ficha por ficha.</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="ld-social-art" aria-hidden="true">
          <img src={amigosImg} className="ld-art-tile ld-art-amigos" alt="" loading="lazy" />
          <span className="ld-art-tile ld-art-leaderboard">
            <GameIcon name="leaderboard" size={96} />
          </span>
          <img src={bandejaImg} className="ld-art-tile ld-art-bandeja" alt="" loading="lazy" />
        </div>
      </section>

      {/* ── 8 · CTA final ────────────────────────────── */}
      <section className={`ld-final-cta ld-reveal${finalCtaVisible ? ' is-visible' : ''}`} ref={finalCtaRef}>
        <h2 className="ld-h2">¿Listo para sentarte a la mesa?</h2>
        {/* Mismo criterio que el hero: un solo botón a /login (ahí ya se
            crea cuenta, se sigue con Google o se entra de invitado) — la
            nota de "¿ya tienes cuenta?" quedaba redundante apuntando al
            mismo lugar. */}
        <button className="ld-btn-primary ld-btn-lg" onClick={() => navigate('/login')}>
          Jugar gratis ahora
        </button>
      </section>

      <Footer />
    </div>
  );
}
