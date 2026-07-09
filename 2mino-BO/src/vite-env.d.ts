/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** api-integracion local. Default (sin configurar): http://localhost:3000 */
  readonly VITE_API_URL_DEV?: string;
  /** api-integracion de QA. Sin default — si no está seteado, el botón QA queda deshabilitado. */
  readonly VITE_API_URL_QA?: string;
  /** api-integracion de producción, vía túnel SSH local (nunca un dominio público — ver docs/CASOS_DE_USO_BACKOFFICE.md §10.1). Default: http://localhost:3001 */
  readonly VITE_API_URL_PROD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
