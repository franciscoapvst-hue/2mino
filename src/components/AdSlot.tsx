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

/** Espacio publicitario.
 *
 *  ⚠️ SOLO va en páginas con contenido editorial propio (una guía, un
 *  artículo). NUNCA en pantallas de aplicación —dashboard, búsqueda de
 *  rival, la partida—, aunque técnicamente funcione.
 *
 *  Estaba en esas tres pantallas y AdSense marcó el sitio con "Anuncios
 *  servidos por Google en pantallas sin contenido del editor" (2026-07-30),
 *  bloqueando la aprobación. Un spinner de "buscando rival" con un anuncio
 *  al lado es exactamente lo que esa política prohíbe.
 *
 *  Hoy el componente no se usa en ningún lado a propósito: se vuelve a
 *  colocar cuando haya páginas de contenido donde sí corresponda
 *  (docs/SEO.md). */
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
