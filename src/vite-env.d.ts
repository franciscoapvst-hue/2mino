/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_SLOT_DASHBOARD?: string;
  readonly VITE_ADSENSE_SLOT_MATCHMAKING?: string;
  readonly VITE_ADSENSE_SLOT_MANO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
