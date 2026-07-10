// ── Efectos de sonido del juego ──────────────────────────────────────
// Sintetizados en el navegador (Web Audio API) — sin archivos externos,
// sin dependencias nuevas. El AudioContext se crea recién al pedir el
// primer sonido: los navegadores bloquean el audio hasta el primer
// gesto del usuario, y tocar/soltar una ficha ya cuenta como tal, así
// que no hace falta un botón de "activar sonido" aparte.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Tono simple con ataque rápido y decaimiento exponencial. */
function tono(freq: number, duracionMs: number, tipo: OscillatorType = 'sine', volumen = 0.15, delayMs = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volumen, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracionMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duracionMs / 1000 + 0.02);
}

/** Ráfaga de ruido filtrado — la base percusiva del "clack" de la ficha. */
function ruido(duracionMs: number, volumen = 0.2, delayMs = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const tam = Math.max(1, Math.floor(c.sampleRate * (duracionMs / 1000)));
  const buffer = c.createBuffer(1, tam, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < tam; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / tam);

  const source = c.createBufferSource();
  source.buffer = buffer;
  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 1400;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volumen, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracionMs / 1000);

  source.connect(filtro).connect(gain).connect(c.destination);
  source.start(t0);
}

export const sounds = {
  /** Ficha colocada en el tablero (propia o del rival/bot). */
  ficha() {
    ruido(70, 0.28);
    tono(130, 55, 'square', 0.09, 4);
  },
  /** Pase de turno. */
  pasar() {
    tono(220, 90, 'sine', 0.05);
  },
  /** Suma puntos al cerrar una mano — arpegio ascendente, más notas cuantos más puntos. */
  puntos(cantidad: number) {
    const notas = [523.25, 659.25, 783.99, 1046.5]; // Do-Mi-Sol-Do (mayor)
    const n = Math.max(1, Math.min(notas.length, Math.round(cantidad / 15) + 1));
    for (let i = 0; i < n; i++) tono(notas[i], 150, 'triangle', 0.12, i * 70);
  },
  /** Mano cerrada sin puntos para nadie (tranca "no caben" o empate). */
  sinPuntos() {
    tono(300, 130, 'sine', 0.08);
  },
  /** Capicúa — el cierre más vistoso, arpegio más largo y agudo. */
  capicua() {
    [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tono(f, 170, 'triangle', 0.14, i * 85));
  },
  /** Se acabó el tiempo del turno (propio o ajeno). */
  tiempoAgotado() {
    tono(440, 110, 'sawtooth', 0.09);
    tono(440, 110, 'sawtooth', 0.09, 160);
  },
  /** Partida ganada. */
  ganaste() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tono(f, 220, 'triangle', 0.15, i * 110));
  },
  /** Partida perdida. */
  perdiste() {
    [392, 349.23, 293.66].forEach((f, i) => tono(f, 260, 'sine', 0.1, i * 140));
  },
};
