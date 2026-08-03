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
import { ScrollProgress } from '../components/landing/bits.js';
import { MotionContext, useMotionPreference } from '../components/landing/motion.js';
import './HomePage.css';

export function HomePage() {
  // Trois sociétés DIFFÉRENTES : le hero, la maquette du mécanisme et la démo du connecteur.
  const { hero, mech, mcp, rows, peaRows, ready } = useLandingData();
  // Une seule décision pour toute la page : le CSS la lit via data-motion, le JS via le contexte.
  const motion = useMotionPreference();

  return (
    <MotionContext.Provider value={motion}>
    <div className="lp" data-motion={motion}>
      <ScrollProgress />
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.home.title" descKey="seo.home.desc" />
      <HeroSection show={hero} ready={ready} />
      <FrictionSection />
      <MechanismSection show={mech} ready={ready} />
      <VeilleSection rows={rows} ready={ready} />
      <ClaudeSection show={mcp} peaRows={peaRows} rows={rows} ready={ready} />
      <ProofSection />
      <ForWhoSection />
      <FinalSection />
    </div>
    </MotionContext.Provider>
  );
}
