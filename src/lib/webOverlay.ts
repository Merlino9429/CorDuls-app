import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Alcuni hosting gratuiti (es. Netlify) aggiungono in basso a destra un badge obbligatorio
// ("Powered by Netlify") in un iframe fisso. Restituisce l'altezza da lasciare libera in basso
// perché non copra la barra di navigazione. 0 quando il badge non c'è.
const BADGE_SELECTOR = '#nl-badge-frame';

export function useHostBadgeInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let resize: ResizeObserver | null = null;

    const measure = () => {
      const el = document.querySelector<HTMLElement>(BADGE_SELECTOR);
      if (!el) { setInset(0); return; }
      const r = el.getBoundingClientRect();
      const docked = r.height > 0 && r.bottom >= window.innerHeight - 4;
      // solo la parte del badge (chiuso) conta: se l'utente lo apre è un pannello temporaneo
      setInset(docked ? Math.min(Math.ceil(window.innerHeight - r.top), 72) : 0);
    };

    const watch = () => {
      const el = document.querySelector<HTMLElement>(BADGE_SELECTOR);
      if (el && !resize && 'ResizeObserver' in window) {
        resize = new ResizeObserver(measure);
        resize.observe(el);
      }
      measure();
    };

    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true });
    window.addEventListener('resize', measure);
    watch();
    return () => { mo.disconnect(); resize?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  return inset;
}
