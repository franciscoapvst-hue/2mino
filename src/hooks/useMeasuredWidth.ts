import { useCallback, useRef, useState } from 'react';

/**
 * Mide el ancho de un contenedor con ResizeObserver.
 * Usa callback ref: funciona aunque el nodo se monte tarde
 * (p. ej. tras un guard de carga) o se desmonte.
 */
export function useMeasuredWidth(): [number, (el: HTMLElement | null) => void] {
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const refCb = useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(entries =>
      setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    roRef.current = ro;
  }, []);

  return [width, refCb];
}
