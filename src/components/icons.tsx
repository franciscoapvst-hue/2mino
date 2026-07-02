// ── Iconos SVG compartidos ──────────────────────────
// Antes cada componente definía sus propios iconos; varios (BackIcon,
// SunIcon, MoonIcon, DominoTile) estaban duplicados en App/Dashboard/
// SalasView/GameBoard. Aquí viven una sola vez.

export function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

export function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      style={spinning ? { animation: 'spin 0.7s linear infinite' } : undefined}>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"   x2="6.34"  y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.075 17.64 11.767 17.64 9.2z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export function CasualIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      {/* Domino 1 — landscape, línea divisoria VERTICAL */}
      <rect x="2" y="6" width="52" height="19" rx="4"
        fill="currentColor" opacity=".12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="28" y1="6" x2="28" y2="25" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="19" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="12"   r="2.2" fill="currentColor" />
      <circle cx="43" cy="15.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="19"   r="2.2" fill="currentColor" />

      {/* Domino 2 — landscape, línea divisoria VERTICAL */}
      <rect x="2" y="31" width="52" height="19" rx="4"
        fill="currentColor" opacity=".20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="28" y1="31" x2="28" y2="50" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="15" cy="40.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="37"   r="2.2" fill="currentColor" />
      <circle cx="43" cy="40.5" r="2.2" fill="currentColor" />
      <circle cx="37" cy="44"   r="2.2" fill="currentColor" />
    </svg>
  );
}

export function RankedIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      {/* Trophy */}
      <path d="M28 6 L34 22 L50 22 L37 31 L42 47 L28 38 L14 47 L19 31 L6 22 L22 22 Z"
        fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="28" cy="26" r="5" fill="currentColor" opacity=".5" />
    </svg>
  );
}

export function SalasIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      {/* Grid of 4 door/room squares */}
      <rect x="6"  y="6"  width="19" height="19" rx="4" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5" />
      <rect x="31" y="6"  width="19" height="19" rx="4" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6"  y="31" width="19" height="19" rx="4" fill="currentColor" opacity=".28" stroke="currentColor" strokeWidth="1.5" />
      <rect x="31" y="31" width="19" height="19" rx="4" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5" />
      {/* Plus sign on bottom-left to indicate "create" */}
      <line x1="15.5" y1="37" x2="15.5" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="11.5" y1="41" x2="19.5" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Logo domino. width/height opcionales (App 52×26, Dashboard 40×20).
export function DominoTile({ width = 52, height = 26 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 52 26" aria-hidden>
      <rect width="52" height="26" rx="5" fill="#0d0520" stroke="#a855f7" strokeWidth="1.5" />
      <line x1="26" y1="4" x2="26" y2="22" stroke="#a855f7" strokeWidth="1" />
      <circle cx="13" cy="9"  r="2.4" fill="#e9d5ff" />
      <circle cx="13" cy="17" r="2.4" fill="#e9d5ff" />
      <circle cx="37" cy="8"  r="2.4" fill="#e9d5ff" />
      <circle cx="42" cy="13" r="2.4" fill="#e9d5ff" />
      <circle cx="37" cy="18" r="2.4" fill="#e9d5ff" />
    </svg>
  );
}
