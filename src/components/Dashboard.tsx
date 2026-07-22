import { useEffect, useState } from 'react';
import { api, type AuthUser, type UserConfig, type Sala } from '../api';
import GameIcon, { type GameIconName } from './GameIcons';
import { rangoDeElo, progresoRango } from '../ranks';
import AdSlot from './AdSlot';
import Footer from './Footer';
import TorneoBanner from './TorneoBanner';
import PartidasRecientes from './PartidasRecientes';
import StatsFila from './StatsFila';

type Props = {
  user:          AuthUser;
  config:        UserConfig;
  dark:          boolean;
  onGoToSalas:   () => void;
  onGoToRanked:  () => void;
  onGoToCasual:  () => void;
  onGoToTorneos:     () => void;
  /** Partida en_juego detectada al iniciar sesión — null si no hay ninguna. */
  salaParaReintegrar?:   Sala | null;
  onReintegrarSala?:     () => void;
  onDescartarReintegro?: () => void;
};

// ── Tarjeta de modo de juego ────────────────────────
// Las tres (ranked/casual/salas) comparten el mismo tamaño de card en una
// sola fila — antes ranked era un banner enorme aparte, lo que empujaba
// todo lo demás fuera de la pantalla en PC (docs/PLAN_ESCRITORIO.md,
// Etapa 2: "above-the-fold"). El ícono ya trae su propio color, un chip
// detrás pelearía con él.
function PlayCard({ icono, title, desc, action, accent, onClick, disabled }: {
  icono: GameIconName; title: string; desc: string; action: string;
  accent: 'amber' | 'teal' | 'neutral'; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      className={`dash-card dash-card-${accent}${disabled ? ' dash-card-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="dash-card-icon"><GameIcon name={icono} size={44} /></span>
      <span className="dash-card-body">
        <span className="dash-card-title">{title}</span>
        <span className="dash-card-desc">{desc}</span>
      </span>
      <span className="dash-card-cta">{action} →</span>
    </button>
  );
}

// ── Dashboard / Lobby ─────────────────────────────
// El nav superior (tema, fichas, amigos, bandeja, saldo, avatar, salir)
// se mudó al sidebar global (AppShell) — docs/PLAN_ESCRITORIO.md, S1. Acá
// queda sólo el CONTENIDO del lobby, que vive dentro del shell.
//
// Etapa 2 (above-the-fold): se sacó la sección "Comunidad" (leaderboard +
// historial) y los chips de "Modos" — el sidebar ya cubre esa navegación,
// duplicarla como cards grandes no dejaba espacio para lo nuevo (última
// partida, stats, banner de torneos) sin scroll en 1366×768.
export default function Dashboard({
  user, config, dark, onGoToSalas, onGoToRanked, onGoToCasual,
  onGoToTorneos,
  salaParaReintegrar, onReintegrarSala, onDescartarReintegro,
}: Props) {
  const [elo, setElo] = useState<number | null>(null);

  useEffect(() => {
    api.ranked.me()
      .then(r => setElo(r.elo))
      .catch(() => setElo(null)); // sin ranked aún: no romper el lobby
  }, []);

  const rango = elo !== null ? rangoDeElo(elo) : null;
  const prog  = elo !== null ? progresoRango(elo) : null;

  return (
    <div className={`dash${dark ? '' : ' is-light'}`}>

      {salaParaReintegrar && (
        <div className="rejoin-banner">
          <span className="rejoin-banner-text">
            <strong>Tenés una partida en curso.</strong> Sala {salaParaReintegrar.codigo}
          </span>
          <div className="rejoin-banner-actions">
            <button className="rejoin-banner-cta" onClick={onReintegrarSala}>Reintegrarme</button>
            <button
              className="rejoin-banner-dismiss"
              onClick={onDescartarReintegro}
              aria-label="Descartar aviso"
              title="Descartar"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────── */}
      <main className="dash-body">

        {/* Saludo + panel de rango */}
        <section className="dash-hero">
          <div className="dash-greeting">
            <p className="dash-hello">Hola,</p>
            <h1>{user.username}</h1>
            <p className="dash-sub">La mesa está servida. ¿Listo para dominar?</p>
          </div>

          <aside className="dash-rank">
            {rango ? (
              <>
                <div className="dash-rank-badge">
                  {rango.url
                    ? <img src={rango.url} alt={`Rango ${rango.nombre}`} />
                    : <span className="dash-rank-fallback">★</span>}
                </div>
                <div className="dash-rank-info">
                  <span className="dash-rank-name">{rango.nombre}</span>
                  <span className="dash-rank-elo">{elo} <em>ELO</em></span>
                  {prog && prog.siguiente ? (
                    <div className="dash-rank-prog">
                      <div className="dash-rank-track">
                        <div className="dash-rank-fill" style={{ width: `${prog.pct}%` }} />
                      </div>
                      <span className="dash-rank-next">
                        {prog.faltan} para {prog.siguiente}
                      </span>
                    </div>
                  ) : (
                    <span className="dash-rank-next">Rango máximo</span>
                  )}
                </div>
              </>
            ) : (
              <div className="dash-rank-empty">
                <span className="dash-rank-badge dash-rank-badge-empty">★</span>
                <div className="dash-rank-info">
                  <span className="dash-rank-name">Sin rango</span>
                  <span className="dash-rank-next">Juega tu primera ranked para clasificar</span>
                </div>
              </div>
            )}
          </aside>
        </section>

        {/* Elige cómo jugar — ranked/casual/salas en una sola fila */}
        <h2 className="dash-section-title">Elige cómo jugar</h2>
        <div className="dash-row dash-row-3">
          {/* Ranked bloqueado para invitados — la barrera real está en
              api-integracion/src/routes/ranked.ts, esto es solo para no
              mostrar un botón que termina en 403. */}
          <PlayCard
            icono="ranked"
            title="Ranked"
            desc={config.segmento === 'invitado'
              ? 'Creá una cuenta para jugar ranked y subir de ELO.'
              : 'Cada mano cuenta hacia tu ELO. Sube de rango.'}
            action="Buscar ranked"
            accent="amber"
            onClick={onGoToRanked}
            disabled={config.segmento === 'invitado'}
          />
          <PlayCard
            icono="casual"
            title="Casual"
            desc="Juega sin presión, sin afectar tu ranking."
            action="Buscar partida"
            accent="teal"
            onClick={onGoToCasual}
          />
          <PlayCard
            icono="salas"
            title="Salas Abiertas"
            desc="Únete a una sala o crea la tuya con amigos."
            action="Ver salas"
            accent="neutral"
            onClick={onGoToSalas}
          />
        </div>

        {/* Torneo abierto (punto 13) — no renderiza nada si no hay ninguno */}
        <TorneoBanner onClick={onGoToTorneos} />

        {/* Contadores (Etapa 3) */}
        <StatsFila />

        {/* Últimas partidas (Etapa 3, ampliada) — no renderiza nada sin historial */}
        <PartidasRecientes />

        <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_DASHBOARD} />
      </main>

      <Footer />
    </div>
  );
}
