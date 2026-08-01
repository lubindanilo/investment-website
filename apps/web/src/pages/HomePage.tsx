/**
 * Landing v2 — parcours en 8 temps : résultat (hero) → friction → mécanisme (qualité,
 * puis prix) → veille → connecteur Claude → preuve → pour qui → CTA + FAQ.
 *
 * Principe de la page : le texte porte le résultat, l'animation porte le mécanisme.
 * Un seul objectif, analyser une action, donc un seul CTA répété (hero et fin).
 *
 * Les sections partagent une seule requête publique (`useLandingData`) pour n'afficher
 * que des chiffres réels. Tout le texte est dans le DOM au chargement : les animations
 * ne font que révéler du contenu déjà présent (crawlers GEO, `prefers-reduced-motion`).
 */
import SeoHead from '../components/SeoHead.js';
import { HeroSection, FrictionSection } from '../components/landing/HeroSection.js';
import { MechanismSection, VeilleSection } from '../components/landing/MechanismSection.js';
import { ClaudeSection } from '../components/landing/ClaudeSection.js';
import { ProofSection, ForWhoSection, FinalSection } from '../components/landing/ProofSection.js';
import { useLandingData } from '../components/landing/useLandingData.js';
import './HomePage.css';

export function HomePage() {
  const { featured, rows, peaRows } = useLandingData();

  return (
    <div className="lp">
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.home.title" descKey="seo.home.desc" />
      <HeroSection featured={featured} />
      <FrictionSection />
      <MechanismSection featured={featured} />
      <VeilleSection rows={rows} />
      <ClaudeSection featured={featured} peaRows={peaRows} rows={rows} />
      <ProofSection />
      <ForWhoSection />
      <FinalSection />
    </div>
  );
}
