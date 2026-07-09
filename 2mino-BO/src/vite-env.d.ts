/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base de api-integracion. Default (sin configurar): http://localhost:3000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
