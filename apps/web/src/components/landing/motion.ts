/**
 * Pilotage du mouvement de la landing.
 *
 * Trois modes, exposés au CSS par l'attribut `data-motion` sur `.lp` et au JS par
 * `MotionContext` :
 *
 *   full  — tout bouge (défaut).
 *   soft  — la page reste vivante (apparitions, cascade des critères, démo MCP) mais on
 *           coupe ce qui gêne vraiment : parallaxe, halo qui dérive, inclinaison au
 *           curseur, boucles infinies. C'est le mode servi quand le système demande de
 *           réduire les animations : réduire, pas éteindre.
 *   off   — plus aucun mouvement, tout le contenu est affiché d'un bloc.
 *
 * Surcharge manuelle, mémorisée : ?motion=1 (full), ?motion=soft, ?motion=0 (off).
 * Aucun composant ne doit interroger `matchMedia` en direct : sinon un réglage système
 * coupe silencieusement des animations que l'on croit actives.
 */
import { createContext, useContext, useEffect, useState } from 'react';

export type MotionMode = 'full' | 'soft' | 'off';

const KEY = 'lubin:motion';

/** Décision effective : surcharge explicite si présente, sinon réglage système. */
function resolveMotion(): MotionMode {
  if (typeof window === 'undefined') return 'full';
  const parse = (v: string | null): MotionMode | null =>
    v === '1' || v === 'full' ? 'full' : v === 'soft' ? 'soft' : v === '0' || v === 'off' ? 'off' : null;

  const param = parse(new URLSearchParams(window.location.search).get('motion'));
  if (param) {
    try { localStorage.setItem(KEY, param); } catch { /* mode privé : on garde en mémoire */ }
    return param;
  }
  try {
    const saved = parse(localStorage.getItem(KEY));
    if (saved) return saved;
  } catch { /* localStorage indisponible */ }

  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? 'soft' : 'full';
}

/** Hook racine : à appeler UNE fois (HomePage), puis diffuser via MotionContext. */
export function useMotionPreference(): MotionMode {
  const [mode, setMode] = useState<MotionMode>(() => resolveMotion());
  useEffect(() => {
    setMode(resolveMotion());
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setMode(resolveMotion());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mode;
}

export const MotionContext = createContext<MotionMode>('full');

/** Mode courant. */
export function useMotionMode(): MotionMode { return useContext(MotionContext); }
/** true si la page anime quoi que ce soit (full ou soft). */
export function useMotion(): boolean { return useMotionMode() !== 'off'; }
/** true seulement en mode complet : parallaxe, inclinaison, boucles décoratives. */
export function useRichMotion(): boolean { return useMotionMode() === 'full'; }
