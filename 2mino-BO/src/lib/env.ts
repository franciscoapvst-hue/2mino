/**
 * Selector de ambiente (Dev/QA/Prod) — el panel puede hablar con
 * distintos api-integracion según a cuál te conectes. La URL de cada
 * uno es fija (config de build/deploy), pero CUÁL está activo se
 * guarda en localStorage y se puede cambiar en caliente desde la UI
 * (Shell / LoginView), sin rebuildear nada.
 *
 * Prod SIEMPRE va por el túnel SSH documentado en
 * docs/CASOS_DE_USO_BACKOFFICE.md §10.1 — nunca un dominio público. Se
 * usa un puerto local distinto al de dev (3001 en vez de 3000) para que
 * puedas tener el Docker local Y el túnel a producción activos al
 * mismo tiempo, sin que se pisen.
 */

export type Ambiente = 'dev' | 'qa' | 'prod';

const AMBIENTE_KEY = '2mino-bo-ambiente';

const URLS: Record<Ambiente, string | undefined> = {
  dev:  import.meta.env.VITE_API_URL_DEV  || 'http://localhost:3000',
  qa:   import.meta.env.VITE_API_URL_QA   || undefined,
  prod: import.meta.env.VITE_API_URL_PROD || 'http://localhost:3001',
};

export const AMBIENTES: { id: Ambiente; label: string; disponible: boolean }[] = [
  { id: 'dev',  label: 'Dev',  disponible: Boolean(URLS.dev) },
  { id: 'qa',   label: 'QA',   disponible: Boolean(URLS.qa) },
  { id: 'prod', label: 'Prod', disponible: Boolean(URLS.prod) },
];

export function getAmbiente(): Ambiente {
  const raw = localStorage.getItem(AMBIENTE_KEY) as Ambiente | null;
  if (raw && URLS[raw]) return raw;
  return 'dev';
}

/** Cambia el ambiente activo. El caller es responsable de forzar un
 *  logout/reload después — un JWT de un ambiente no sirve en otro
 *  (usuarios y JWT_SECRET distintos), así que no tiene sentido
 *  mantener la sesión al cambiar. */
export function setAmbiente(ambiente: Ambiente) {
  localStorage.setItem(AMBIENTE_KEY, ambiente);
}

export function apiUrl(): string {
  return URLS[getAmbiente()] ?? URLS.dev!;
}
