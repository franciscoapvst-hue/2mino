import { useEffect, useRef } from 'react';

/**
 * Poll de red con back-pressure: espera a que la llamada anterior resuelva
 * (o falle) antes de programar la siguiente, en vez de un setInterval de
 * reloj fijo. Con setInterval, si el backend está lento (o tarda hasta el
 * timeout del gateway, ~10s) siguen disparándose llamadas nuevas cada
 * tick encima de una que todavía no volvió — eso apila requests contra
 * un backend que ya está sufriendo en vez de darle un respiro, y desde
 * afuera se ve como que "todo se quedó colgado" aunque cada request
 * individual sí eventualmente responde.
 */
export function usePoll(fn: () => Promise<void>, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        await fnRef.current();
      } catch {
        // el poll no debe morir por un error de red — el próximo tick reintenta
      } finally {
        if (!cancelado) timer = setTimeout(tick, intervalMs);
      }
    };
    tick();

    return () => { cancelado = true; clearTimeout(timer); };
  }, [intervalMs, enabled]);
}
