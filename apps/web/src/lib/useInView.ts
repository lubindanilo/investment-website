/**
 * useInView — hook minimaliste qui détecte l'entrée d'un élément dans le viewport.
 *
 * Utilise IntersectionObserver natif (zéro dépendance). Le retour est :
 *   - une ref à attacher à l'élément observé
 *   - un booléen `inView` qui passe à true UNE fois quand l'élément devient visible,
 *     puis se freeze (on désobserve pour éviter les re-renders inutiles au scroll).
 *
 * Fallback sans IntersectionObserver (vieux navigateurs) : inView vaut true direct,
 * → l'animation est court-circuitée mais le contenu reste visible (pas de page blanche).
 *
 * Respecte aussi `prefers-reduced-motion` : si l'utilisateur a désactivé les animations
 * dans son OS, on bypass l'observation et on met inView=true direct (accessibilité).
 *
 * Utilisation typique pour révéler à l'arrivée dans le viewport :
 *   const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.15 });
 *   <div ref={ref} className={'card reveal ' + (inView ? 'reveal-in' : '')}>…</div>
 */
import { useEffect, useRef, useState } from 'react';

interface Options {
  /** Pourcentage de l'élément visible avant de déclencher (0..1). Défaut 0.1 = 10 %. */
  threshold?: number;
  /** Marge autour du viewport, format CSS (ex '-50px' pour déclencher plus tard). */
  rootMargin?: string;
}

export function useInView<T extends Element>(opts: Options = {}): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Accessibilité : si l'utilisateur a désactivé les animations dans son OS, on bypass.
    const prefersReducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) { setInView(true); return; }

    // Fallback vieux navigateurs (IE/legacy Safari sans IntersectionObserver).
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            obs.unobserve(entry.target); // freeze : on n'observe plus une fois visible
          }
        }
      },
      { threshold: opts.threshold ?? 0.1, rootMargin: opts.rootMargin ?? '0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [opts.threshold, opts.rootMargin]);

  return { ref, inView };
}
