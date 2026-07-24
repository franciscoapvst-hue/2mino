import { useCallback, useRef, useState } from 'react';

/**
 * Revela un elemento con una animación cuando entra en el viewport
 * (scroll-reveal). Callback ref, mismo patrón que useMeasuredWidth. Se
 * desconecta tras la primera intersección — la entrada no debe repetirse
 * si el usuario vuelve a scrollear sobre la sección.
 */
export function useReveal(): [boolean, (el: HTMLElement | null) => void] {
  const [visible, setVisible] = useState(false);
  const ioRef = useRef<IntersectionObserver | null>(null);

  const refCb = useCallback((el: HTMLElement | null) => {
    ioRef.current?.disconnect();
    ioRef.current = null;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    ioRef.current = io;
  }, []);

  return [visible, refCb];
}
