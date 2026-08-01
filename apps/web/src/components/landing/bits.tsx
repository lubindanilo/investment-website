/**
 * Petites briques partagées par les sections de la landing : détection d'entrée dans
 * le viewport (qui pose la classe `in` déclenchant les animations CSS), anneau de note,
 * étoiles, et jauge de note en 10 points.
 *
 * Toutes les animations sont portées par le CSS (HomePage.css) et neutralisées par
 * `prefers-reduced-motion`. Le contenu est toujours dans le DOM, jamais monté au scroll :
 * les crawlers qui n'exécutent pas le JS voient la page entière.
 */
import { useEffect, useRef, useState } from 'react';


/**
 * Pose la classe `in` sur l'élément une fois visible (une seule fois). `once` à false
 * pour un cycle qui doit se rejouer (boucle des conversations).
 */
export function useSectionIn<T extends HTMLElement>(threshold = 0.16): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const obs = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); obs.disconnect(); }
    }, { threshold, rootMargin: '0px 0px -8% 0px' });
    obs.observe(el);
    // Filet : si l'observer ne se déclenche jamais, on affiche quand même.
    const t = setTimeout(() => setSeen(true), 2500);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [seen, threshold]);
  return [ref, seen];
}

/** Anneau de progression d'une note sur 10. */
export function ScoreRing({ note10, size = 96, animate = false }: { note10: number | null; size?: number; animate?: boolean }) {
  const r = size / 2 - (size >= 90 ? 6 : 5);
  const circ = 2 * Math.PI * r;
  const filled = note10 != null ? Math.max(0, Math.min(1, note10 / 10)) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={size >= 90 ? 9 : 8} />
        <circle
          className={animate ? 'ring-arc' : ''}
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth={size >= 90 ? 9 : 8}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - filled)}
          style={{ ['--circ' as string]: `${circ}`, ['--off' as string]: `${circ * (1 - filled)}` }}
        />
      </svg>
      <div className="ring-val" style={{ fontSize: size >= 90 ? 24 : 19 }}>
        <span>{note10 ?? '—'}<small>/10</small></span>
      </div>
    </div>
  );
}

/** 5 étoiles pleines (avis clients). */
export function Stars() {
  return (
    <span className="stars" role="img" aria-label="5/5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Jauge de note en 10 points. Représente la NOTE (pass + demi-warn normalisés), pas le
 * verdict critère par critère : le détail par critère n'est pas exposé publiquement.
 */
export function DotScore({ note10, delayBase = 0 }: { note10: number | null; delayBase?: number }) {
  const n = note10 ?? 0;
  return (
    <div className="dotgrid" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          style={{ background: i < n ? 'var(--good)' : 'var(--line)', animationDelay: `${delayBase + i * 0.06}s` }}
        />
      ))}
    </div>
  );
}

/** Chevron d'accordéon. */
export function Chev({ size = 17 }: { size?: number }) {
  return (
    <span className="chev">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

/** Terme de jargon avec sa définition au survol (infobulle CSS, pas de JS). */
export function Def({ children, def }: { children: React.ReactNode; def: string }) {
  return <span className="def" data-def={def} tabIndex={0}>{children}</span>;
}

/**
 * Barre de progression de lecture, en haut de la page. Donne le sentiment que le scroll
 * « pilote » quelque chose, et situe le lecteur dans une page longue.
 */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <div className="lp-progress" aria-hidden="true"><i style={{ transform: `scaleX(${p})` }} /></div>;
}

/**
 * Parallaxe pilotée par le scroll : l'élément se décale de `strength` pixels entre son
 * entrée et sa sortie de l'écran. Neutralisée en mouvement réduit.
 */
export function useParallax<T extends HTMLElement>(strength = 40): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        // -1 (haut de l'écran) → +1 (bas de l'écran)
        const rel = (center - window.innerHeight / 2) / (window.innerHeight / 2 + r.height / 2);
        el.style.setProperty('--py', `${(rel * strength).toFixed(1)}px`);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [strength]);
  return ref;
}

/**
 * Titre révélé mot à mot à l'entrée dans l'écran. Le texte reste un seul nœud lisible
 * pour les robots et les lecteurs d'écran (les mots sont juste enveloppés).
 */
export function SplitTitle({ text, className = '' }: { text: string; className?: string }) {
  const [ref, seen] = useSectionIn<HTMLHeadingElement>(0.2);
  const words = text.split(' ');
  return (
    <h2 ref={ref} className={`split-title ${seen ? 'in' : ''} ${className}`.trim()}>
      {words.map((w, i) => (
        <span key={i} className="w" style={{ ['--i' as string]: i }}>{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </h2>
  );
}
