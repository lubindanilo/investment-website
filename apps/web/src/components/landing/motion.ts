/**
 * Pilotage du mouvement de la landing.
 *
 * Par défaut on respecte `prefers-reduced-motion` (réglage système « Réduire les
 * animations »), mais ce réglage peut être surchargé par la page elle-même :
 *   ?motion=1  → force les animations, quel que soit le système
 *   ?motion=0  → force la version sans mouvement
 * Le choix est mémorisé (localStorage) pour survivre à la navigation interne.
 *
 * Tout le reste du code (CSS compris, via l'attribut `data-motion` posé sur `.lp`)
 * lit CETTE décision, jamais `matchMedia` en direct : sinon un réglage système coupe
 * silencieusement des animations que l'on croit actives.
 */
import { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'lubin:motion';

/** true si le système demande à réduire les animations. */
function systemPrefersReduced(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Décision effective : surcharge explicite si présente, sinon réglage système. */
function resolveMotion(): boolean {
  if (typeof window === 'undefined') return true;
  const param = new URLSearchParams(window.location.search).get('motion');
  if (param === '1' || param === '0') {
    try { localStorage.setItem(KEY, param); } catch { /* mode privé : on garde en mémoire */ }
    return param === '1';
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch { /* localStorage indisponible */ }
  return !systemPrefersReduced();
}

/** Hook racine : à appeler UNE fois (HomePage), puis diffuser via MotionContext. */
export function useMotionPreference(): boolean {
  const [motion, setMotion] = useState<boolean>(() => resolveMotion());
  useEffect(() => {
    setMotion(resolveMotion());
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setMotion(resolveMotion());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return motion;
}

/** Contexte : les sections lisent la décision au lieu d'interroger le système. */
export const MotionContext = createContext<boolean>(true);
export function useMotion(): boolean { return useContext(MotionContext); }
