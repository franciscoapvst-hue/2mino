import { useEffect, useRef } from 'react';

// Google AdSense — si no está configurado (todavía sin cuenta aprobada,
// o en desarrollo local), el slot no renderiza nada: no rompe el layout
// ni deja huecos raros mientras se espera la aprobación del sitio.
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Props = {
  /** Ad slot ID de AdSense (data-ad-slot) — cada ubicación tiene el suyo. */
  slot: string | undefined;
  className?: string;
};

/** Espacio publicitario no invasivo: dashboard, pantallas de espera y entre
 *  manos — nunca durante una partida activa (ver dónde se usa este componente). */
export default function AdSlot({ slot, className = '' }: Props) {
  const insertado = useRef(false);

  useEffect(() => {
    // El script de AdSense ya está siempre en index.html (ver comentario
    // ahí) — acá solo hace falta avisarle que hay un slot nuevo para llenar.
    if (!ADSENSE_CLIENT || !slot || insertado.current) return;
    insertado.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // El script todavía no terminó de cargar — adsbygoogle procesa los
      // <ins> pendientes solo apenas está listo, no hace falta reintentar.
    }
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;

  return (
    <div className={`ad-slot ${className}`}>
      <span className="ad-slot-label">Publicidad</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
