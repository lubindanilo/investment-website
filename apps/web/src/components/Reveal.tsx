/**
 * Reveal — wrapper qui anime ses enfants à l'entrée dans le viewport.
 *
 * Combine useInView avec une classe CSS qui gère la transition. La classe finale
 * est `reveal reveal-in` quand l'élément est visible, `reveal` sinon.
 *
 * Props :
 *   - delay : retard en ms appliqué via CSS `transition-delay` (utile pour cascader
 *     plusieurs éléments dans un parent — ex 10 critères qui apparaissent en cascade).
 *   - as    : element HTML rendu (par défaut <div>).
 *   - className : classes additionnelles fusionnées avec `reveal`.
 *
 * Les transitions visuelles sont définies dans Reveal.css (opacity + translateY).
 * Respect `prefers-reduced-motion` : l'animation est désactivée et le contenu apparaît
 * direct.
 */
import { type CSSProperties, type ElementType, type ReactNode } from 'react';
import { useInView } from '../lib/useInView.js';
import './Reveal.css';

interface Props {
  children: ReactNode;
  className?: string;
  /** Décalage en ms appliqué à la transition (cascade au sein d'un parent). */
  delay?: number;
  /** Element HTML rendu — par défaut div. Utiliser 'article' / 'section' selon contexte. */
  as?: ElementType;
  /** Seuil de visibilité avant déclenchement (0..1). Défaut 0.12. */
  threshold?: number;
}

export function Reveal({ children, className = '', delay = 0, as: As = 'div', threshold = 0.12 }: Props) {
  const { ref, inView } = useInView<HTMLElement>({ threshold });
  const style: CSSProperties = delay ? { transitionDelay: `${delay}ms` } : {};
  return (
    <As ref={ref} className={`reveal ${inView ? 'reveal-in' : ''} ${className}`.trim()} style={style}>
      {children}
    </As>
  );
}
