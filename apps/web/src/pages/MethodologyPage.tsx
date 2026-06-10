/**
 * MethodologyPage — page publique « Méthodologie ».
 *
 * Détaille les 10 critères fondamentaux scorés par Lubin Investment, leurs formules
 * (en clair), leurs seuils et leur justification, expliqués pour un débutant.
 *
 * Objectif éditorial : maximum de transparence. L'utilisateur doit comprendre exactement
 * ce qu'il achète quand il prend l'abonnement Pro.
 *
 * Structure : Hero → Pourquoi (3 paragraphes) → 10 critères (cards) → Limites → CTA → Disclaimer.
 *
 * i18n : 100 % traduit FR/EN/ES via la clé `methodology.*` dans locales/*.json.
 * Les listes (critères, sources, limites, "pourquoi") sont récupérées via returnObjects
 * pour rester gérables côté traducteurs.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext.js';
import SeoHead from '../components/SeoHead.js';
import { Reveal } from '../components/Reveal.js';
import './MethodologyPage.css';

interface Critere {
  num: number;
  nom: string;
  formule: string;
  seuil: string;
  pourquoi: string;
}

export function MethodologyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Listes longues côté i18n via returnObjects (un seul objet JSON, plus simple à traduire).
  const criteres: Critere[] = (t('methodology.criteres', { returnObjects: true }) as Critere[]) ?? [];
  const whyParas: string[] = (t('methodology.why.paragraphs', { returnObjects: true }) as string[]) ?? [];
  const limites: { title: string; text: string }[] =
    (t('methodology.limites.items', { returnObjects: true }) as { title: string; text: string }[]) ?? [];

  return (
    <div className="methodo">
      <SeoHead titleKey="seo.methodology.title" descKey="seo.methodology.desc" />
      <div className="wrap methodo-wrap">

        {/* Hero */}
        <header className="methodo-hero">
          <div className="methodo-hero-chip">{t('methodology.hero.chip')}</div>
          <h1 className="methodo-hero-title">{t('methodology.hero.title')}</h1>
          <p className="methodo-hero-lede">{t('methodology.hero.lede')}</p>
        </header>

        {/* Pourquoi */}
        <Reveal as="section" className="methodo-why">
          <h2 className="methodo-section-title">{t('methodology.why.title')}</h2>
          <div className="methodo-why-stack">
            {whyParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Reveal>

        {/* Les 10 critères — cascade d'apparition (80ms entre chaque carte) */}
        <section className="methodo-criteres">
          <Reveal>
            <h2 className="methodo-section-title">{t('methodology.criteresTitle')}</h2>
          </Reveal>
          <div className="methodo-criteres-grid">
            {criteres.map((c, i) => (
              <Reveal
                as="article"
                key={c.num}
                className="methodo-critere-card"
                /* Cascade : on plafonne le delay à ~480ms pour ne pas trop attendre
                   sur les cartes du bas du grid (sinon utilisateur scrolle déjà ailleurs). */
                delay={Math.min(i * 80, 480)}
              >
                <div className="methodo-critere-head">
                  <span className="methodo-critere-num">{String(c.num).padStart(2, '0')}</span>
                  <h3 className="methodo-critere-nom">{c.nom}</h3>
                </div>
                <dl className="methodo-critere-dl">
                  <div>
                    <dt>{t('methodology.fields.formula')}</dt>
                    <dd className="methodo-critere-formule">{c.formule}</dd>
                  </div>
                  <div>
                    <dt>{t('methodology.fields.threshold')}</dt>
                    <dd className="methodo-critere-seuil">{c.seuil}</dd>
                  </div>
                  <div>
                    <dt>{t('methodology.fields.why')}</dt>
                    <dd className="methodo-critere-pourquoi">{c.pourquoi}</dd>
                  </div>
                </dl>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Limites */}
        <Reveal as="section" className="methodo-limites">
          <h2 className="methodo-section-title">{t('methodology.limites.title')}</h2>
          <div className="methodo-limites-card">
            <ul>
              {limites.map((l, i) => (
                <li key={i}>
                  <strong>{l.title}</strong> {l.text}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* CTA final */}
        <Reveal as="section" className="methodo-cta">
          <h2 className="methodo-cta-title">{t('methodology.cta.title')}</h2>
          <p className="methodo-cta-sub">{t('methodology.cta.sub')}</p>
          <div className="methodo-cta-buttons">
            <Link to={user ? '/analyser' : '/signup'} className="btn btn-brand">
              {user ? t('methodology.cta.buttonLoggedIn') : t('methodology.cta.buttonGuest')}
            </Link>
          </div>
        </Reveal>

        {/* Disclaimer — sans animation (peu visible si scrollé loin, et ne doit pas distraire) */}
        <footer className="methodo-disclaimer">
          <p>{t('methodology.disclaimer')}</p>
        </footer>

      </div>
    </div>
  );
}
