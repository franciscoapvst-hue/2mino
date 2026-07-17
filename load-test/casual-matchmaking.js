// Load test: cuántos jugadores concurrentes aguanta el flujo real de
// casual 1v1 — invitado → cola → emparejar → poll de la partida.
//
// Corre contra api-integracion (el gateway), igual que el frontend real:
// invitado, /ranked/cola/entrar (tipo:'casual'), poll de /ranked/cola/estado
// hasta emparejar, y poll de /salas/:id/juego un rato (mismo endpoint que
// GameBoard.tsx sondea cada 2-20s en producción).
//
// IMPORTANTE: /auth/* tiene un rate limit propio de 10 req/min/IP y el
// gateway entero tiene un límite global de 300 req/min/IP (ver
// api-integracion/src/index.ts y routes/auth.ts) — corriendo desde una
// sola IP (este contenedor de k6), esos límites se comen el test antes de
// llegar al techo real de Postgres/CPU. Para medir el techo real hay que
// subirlos temporalmente en el stack contra el que se corre esto (ver
// load-test/README.md) — NUNCA correr esto contra producción con esos
// límites deshabilitados.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:3000';

const tiempoHastaMatch = new Trend('tiempo_hasta_match_ms');
const matchmakingTimeouts = new Counter('matchmaking_timeouts');
const juegoPollErrors = new Counter('juego_poll_errors');
const invitadoErrors = new Counter('invitado_errors');

export const options = {
  scenarios: {
    invitados_casual: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: (__ENV.STAGES ? JSON.parse(__ENV.STAGES) : [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '20s', target: 0 },
      ]),
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    // El poll de cola/estado tiene su propio sleep(1) adentro del script,
    // así que esto mide latencia real de cada request, no el ciclo completo.
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  // 1) alta de invitado (mismo endpoint que "Jugar como invitado")
  const authRes = http.post(`${BASE}/auth/invitado`, null, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'auth_invitado' },
  });
  if (!check(authRes, { 'invitado 201': (r) => r.status === 201 })) {
    invitadoErrors.add(1);
    return;
  }
  const token = authRes.json('token');
  const auth = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

  // 2) entra a la cola casual 1v1 (modo 2, tipo casual — el bug que
  // acabamos de arreglar era justo que esto tiraba 403 para invitados)
  const entrarRes = http.post(
    `${BASE}/ranked/cola/entrar`,
    JSON.stringify({ modo: 2, tipo: 'casual' }),
    { ...auth, tags: { name: 'cola_entrar' } },
  );
  if (!check(entrarRes, { 'cola entrar 200': (r) => r.status === 200 })) return;

  // 3) poll hasta emparejar (máx 30s, mismo patrón que MatchmakingView.tsx)
  const t0 = Date.now();
  let salaId = null;
  for (let i = 0; i < 30; i++) {
    sleep(1);
    const estadoRes = http.get(`${BASE}/ranked/cola/estado`, { ...auth, tags: { name: 'cola_estado' } });
    if (estadoRes.status !== 200) continue;
    const st = estadoRes.json();
    if (st.matched) { salaId = st.sala_id; break; }
  }
  if (!salaId) { matchmakingTimeouts.add(1); return; }
  tiempoHastaMatch.add(Date.now() - t0);

  // 4) ya emparejados: poll del estado de la partida. Cada 2s (el peor
  // caso pre-WS-poke) en vez de los 20s actuales de fallback, a propósito:
  // así se ve el techo real de GET /juego bajo carga, no el tráfico normal.
  for (let i = 0; i < 5; i++) {
    const juegoRes = http.get(`${BASE}/salas/${salaId}/juego`, { ...auth, tags: { name: 'juego_estado' } });
    if (juegoRes.status !== 200) juegoPollErrors.add(1);
    sleep(2);
  }
}
