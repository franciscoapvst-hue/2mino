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

export function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" />
    </svg>
  );
}

export function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1.1-3.4A8.38 8.38 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5a8.38 8.38 0 0 1 9 8Z" />
    </svg>
  );
}

export function SmileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M6 4l14 8-14 8V4Z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

export function SkipBackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M6 4h2v16H6z" /><path d="M20 4 8 12l12 8V4Z" />
    </svg>
  );
}

export function SkipForwardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M16 4h2v16h-2z" /><path d="M4 4l12 8L4 20V4Z" />
    </svg>
  );
}

export function PersonAddIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
