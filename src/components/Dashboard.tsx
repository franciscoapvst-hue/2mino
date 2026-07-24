import { useEffect, useMemo, useState } from 'react';
import { api, type AuthUser, type UserConfig, type Sala, type PartidaHistorial } from '../api';
import GameIcon, { type GameIconName } from './GameIcons';
import { rangoDeElo, progresoRango } from '../ranks';
import AdSlot from './AdSlot';
import Footer from './Footer';
import TorneoBanner from './TorneoBanner';
import PartidasRecientes from './PartidasRecientes';

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

// Llama de "racha" — señal universal de "en racha", en ámbar cálido (no el
// dorado casino que veta PRODUCT.md). Pequeña, acompaña al número; el héroe
// visual es el número, no el ícono.
function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.2c.6 3.2-1.3 4.9-2.6 6.4C8 10.2 7 11.7 7 13.8a5 5 0 0 0 10 .2c0-1.9-.8-3.4-1.6-4.6-.3.7-.9 1.2-1.7 1.2-1 0-1.8-.8-1.8-1.9 0-1.8 1.2-2.7.9-5-.2-1.2-.9-1.8-.8-1.5Z" />
    </svg>
  );
}

// ── Tarjeta de modo de juego (secundaria: casual / salas) ─────────
function PlayCard({ icono, title, desc, action, accent, onClick }: {
  icono: GameIconName; title: string; desc: string; action: string;
  accent: 'teal' | 'neutral'; onClick: () => void;
}) {
  return (
    <button className={`dh-playcard dh-playcard-${accent}`} onClick={onClick}>
      <span className="dh-playcard-icon"><GameIcon name={icono} size={40} /></span>
      <span className="dh-playcard-body">
        <span className="dh-playcard-title">{title}</span>
        <span className="dh-playcard-desc">{desc}</span>
      </span>
      <span className="dh-playcard-cta">
        <span className="dh-playcard-cta-text">{action}</span>
        <span className="dh-arrow" aria-hidden>→</span>
      </span>
    </button>
  );
}

// ── Acción primaria: Ranked ────────────────────────────────────────
// "El rango importa" (PRODUCT.md) → ranked es LA jugada. Mismo alto de fila
// que las secundarias (above-the-fold en 1366×768), pero con tratamiento de
// fieltro cálido + CTA sólido para que se lea como la acción dominante.
function RankedCard({ desc, action, onClick, disabled }: {
  desc: string; action: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      className={`dh-playcard dh-playcard-primary${disabled ? ' is-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="dh-playcard-icon"><GameIcon name="ranked" size={44} /></span>
      <span className="dh-playcard-body">
        <span className="dh-playcard-title">Ranked</span>
        <span className="dh-playcard-desc">{desc}</span>
      </span>
      <span className="dh-playcard-cta dh-playcard-cta-solid">
        <span className="dh-playcard-cta-text">{action}</span>
        <span className="dh-arrow" aria-hidden>→</span>
      </span>
    </button>
  );
}

function QuickStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="dh-qstat">
      <span className="dh-qstat-value">{value}</span>
      <span className="dh-qstat-label">{label}</span>
    </div>
  );
}

// ── Dashboard / Lobby ─────────────────────────────
// El nav superior (tema, fichas, amigos, bandeja, saldo, avatar, salir)
// vive en el sidebar global (AppShell) — docs/PLAN_ESCRITORIO.md, S1. Acá
// queda sólo el CONTENIDO del lobby, que vive dentro del shell.
//
// Rediseño "home-reimagined": banda de identidad del jugador (saludo +
// racha destacada + rango) como ancla emocional, ranked como acción
// primaria, y stats secundarias contenidas a la izquierda. La racha de
// victorias se calcula del historial real (no necesita PLAN_RETENCION); es
// el gancho de retención que el jugador ve grande al entrar. Cuando aterrice
// la racha DIARIA (PLAN_RETENCION, S4) entra en el mismo hueco destacado.
export default function Dashboard({
  user, config, dark, onGoToSalas, onGoToRanked, onGoToCasual,
  onGoToTorneos,
  salaParaReintegrar, onReintegrarSala, onDescartarReintegro,
}: Props) {
  const [elo, setElo]             = useState<number | null>(null);
  const [stats, setStats]         = useState<{ partidas: number; ganadas: number; capicuas: number } | null>(null);
  const [historial, setHistorial] = useState<PartidaHistorial[] | null>(null);

  // Un solo lugar carga los datos del lobby (antes ranked.me() se pedía
  // duplicado en Dashboard y StatsFila). ranked.me → elo + partidas/ganadas;
  // perfilJugador → capicúas; misPartidas → racha + preview de "últimas".
  useEffect(() => {
    let cancel = false;
    api.ranked.me()
      .then(async r => {
        if (cancel) return;
        setElo(r.elo);
        const perfil = await api.social
          .perfilJugador({ usuario_id: r.usuario_id, username: '', elo: r.elo, partidas: r.partidas, ganadas: r.ganadas })
          .catch(() => null);
        if (cancel) return;
        setStats({ partidas: r.partidas, ganadas: r.ganadas, capicuas: perfil?.capicuas ?? 0 });
      })
      .catch(() => { if (!cancel) { setElo(null); setStats(null); } }); // invitado / sin ranked
    api.historial.misPartidas()
      .then(p => { if (!cancel) setHistorial(p); })
      .catch(() => { if (!cancel) setHistorial([]); });
    return () => { cancel = true; };
  }, []);

  const rango = elo !== null ? rangoDeElo(elo) : null;
  const prog  = elo !== null ? progresoRango(elo) : null;

  // Racha de victorias = victorias consecutivas desde la más reciente.
  // misPartidas viene de más nueva a más vieja, así que contamos hasta la
  // primera derrota. null mientras carga (para el placeholder).
  const racha = useMemo(() => {
    if (!historial) return null;
    let n = 0;
    for (const p of historial) { if (p.gano) n++; else break; }
    return n;
  }, [historial]);

  const winrate = stats && stats.partidas > 0 ? Math.round((stats.ganadas / stats.partidas) * 100) : null;
  const esInvitado = config.segmento === 'invitado';

  return (
    <div className={`dash${dark ? '' : ' is-light'}`}>

      {salaParaReintegrar && (
        <div className="rejoin-banner">
          <span className="rejoin-banner-text">
            <strong>Tienes una partida en curso.</strong> Sala {salaParaReintegrar.codigo}
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

      <main className="dash-body">

        {/* ── Banda de identidad del jugador ───────────────── */}
        <section className="dh-hero">
          <div className="dh-welcome">
            <p className="dh-hello">Hola,</p>
            <h1 className="dh-name">{user.username}</h1>
            <p className="dh-sub">La mesa está servida. ¿Listo para dominar?</p>

            {/* Stats secundarias — contenidas, sin robar protagonismo */}
            <div className="dh-quickstats">
              <QuickStat value={stats?.partidas ?? '—'} label="Partidas" />
              <QuickStat value={stats?.ganadas ?? '—'} label="Ganadas" />
              <QuickStat value={winrate !== null ? `${winrate}%` : '—'} label="Victorias" />
              <QuickStat value={stats?.capicuas ?? '—'} label="Capicúas" />
            </div>
          </div>

          <aside className="dh-identity">
            {/* Racha — el número grande, gancho de retención */}
            <div className={`dh-streak${racha && racha > 0 ? ' is-hot' : ''}`}>
              <span className="dh-streak-flame"><FlameIcon /></span>
              <span className="dh-streak-num">{racha ?? 0}</span>
              <span className="dh-streak-label">
                {racha === null
                  ? 'racha de victorias'
                  : racha === 0
                    ? 'empieza tu racha'
                    : racha === 1
                      ? 'victoria al hilo'
                      : 'victorias al hilo'}
              </span>
            </div>

            {/* Rango */}
            {rango ? (
              <div className="dh-rank">
                <div className="dh-rank-badge">
                  {rango.url
                    ? <img src={rango.url} alt={`Rango ${rango.nombre}`} />
                    : <span className="dh-rank-fallback">★</span>}
                </div>
                <div className="dh-rank-info">
                  <span className="dh-rank-name">{rango.nombre}</span>
                  <span className="dh-rank-elo">{elo} <em>ELO</em></span>
                  {prog && prog.siguiente ? (
                    <div className="dh-rank-prog">
                      <div className="dh-rank-track">
                        <div className="dh-rank-fill" style={{ width: `${prog.pct}%` }} />
                      </div>
                      <span className="dh-rank-next">{prog.faltan} para {prog.siguiente}</span>
                    </div>
                  ) : (
                    <span className="dh-rank-next">Rango máximo</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="dh-rank dh-rank-empty">
                <div className="dh-rank-badge"><span className="dh-rank-fallback">★</span></div>
                <div className="dh-rank-info">
                  <span className="dh-rank-name">Sin rango</span>
                  <span className="dh-rank-next">Juega tu primera ranked para clasificar</span>
                </div>
              </div>
            )}
          </aside>
        </section>

        {/* ── Elige cómo jugar ─────────────────────────────── */}
        <h2 className="dash-section-title">Elige cómo jugar</h2>
        <div className="dh-play">
          {/* Ranked bloqueado para invitados — la barrera real está en
              api-integracion/src/routes/ranked.ts; esto evita un botón que
              termina en 403. */}
          <RankedCard
            desc={esInvitado
              ? 'Crea una cuenta para jugar ranked y subir de ELO.'
              : 'Cada mano cuenta hacia tu ELO. Sube de rango.'}
            action="Buscar ranked"
            onClick={onGoToRanked}
            disabled={esInvitado}
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

        {/* Torneo abierto — no renderiza nada si no hay ninguno */}
        <TorneoBanner onClick={onGoToTorneos} />

        {/* Últimas partidas — reusa el historial ya cargado (sin refetch) */}
        <PartidasRecientes partidas={historial} />

        <AdSlot slot={import.meta.env.VITE_ADSENSE_SLOT_DASHBOARD} />
      </main>

      <Footer />
    </div>
  );
}
