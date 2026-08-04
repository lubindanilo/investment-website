/**
 * Landing de l'offre SEO — `/audit-seo`.
 *
 * Cette page applique sur elle-même les règles qu'elle vend, et c'est volontaire : une
 * landing qui prétend détecter les sites illisibles par les robots d'IA et qui serait
 * elle-même invisible dans ChatGPT se contredirait à la première vérification. D'où le
 * pré-rendu bot côté API (routes/seoOfferPrerender.ts) et, ici, le respect des règles
 * on-page : résumé en tête, réponse dans les cent premiers mots, liens sortants, aucun
 * texte enfermé dans un accordéon.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SeoHead from '../components/SeoHead.js';
import { SeoPricingTable } from '../components/SeoPricingTable.js';
import './AuditSeoPage.css';

export function AuditSeoPage() {
  const { t } = useTranslation();
  return (
    <div className="aseo">
      <SeoHead titleKey="seo.auditSeo.title" descKey="seo.auditSeo.desc" />

      <header className="aseo-hero">
        <h1 className="aseo-h1">{t('seoOffer.h1')}</h1>
        {/* Résumé en tête, 2 à 3 phrases : +33 % de conversion mesuré (règle B6). */}
        <p className="aseo-lede">{t('seoOffer.lede')}</p>
        <div className="aseo-cta">
          <Link className="btn btn-brand" to="/visibilite-ia">{t('seoOffer.ctaTest')}</Link>
          <Link className="btn btn-ghost" to="/audit-seo/tarifs">{t('seoOffer.ctaPricing')}</Link>
        </div>
        <p className="aseo-note">{t('seoOffer.heroNote')}</p>
      </header>

      <section className="aseo-block aseo-block--accent">
        <h2 className="aseo-h2">{t('seoOffer.startTitle')}</h2>
        <p>{t('seoOffer.startBody')}</p>
        <Link className="btn btn-brand" to="/visibilite-ia">{t('seoOffer.ctaTest')}</Link>
      </section>

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.checksTitle')}</h2>
        <p>{t('seoOffer.checksIntro')}</p>
        <dl className="aseo-groups">
          {(['index', 'onpage', 'links', 'trust'] as const).map((k) => (
            <div key={k} className="aseo-group">
              <dt>{t(`seoOffer.group.${k}.name`)}</dt>
              <dd>{t(`seoOffer.group.${k}.detail`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.stopTitle')}</h2>
        <p>{t('seoOffer.stopIntro')}</p>
        <ul className="aseo-stop">
          {(['schema', 'llms', 'cwv', 'meta', 'city'] as const).map((k) => (
            <li key={k}>
              <strong>{t(`seoOffer.stop.${k}.what`)}</strong> — {t(`seoOffer.stop.${k}.why`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.fixTitle')}</h2>
        <p>{t('seoOffer.fixBody')}</p>
        <p>{t('seoOffer.fixHuman')}</p>
      </section>

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.vsTitle')}</h2>
        <p>{t('seoOffer.vsBody')}</p>
      </section>

      <section className="aseo-block" id="tarifs">
        <h2 className="aseo-h2">{t('seoOffer.pricingTitle')}</h2>
        <SeoPricingTable />
        <p><Link to="/audit-seo/tarifs">{t('seoOffer.pricingDetail')}</Link></p>
      </section>

      {/* Les limites AVANT la FAQ, pas enterrées en bas : le produit se vend sur le niveau
          de preuve, les cacher détruirait l'argument. */}
      <section className="aseo-block aseo-block--limits">
        <h2 className="aseo-h2">{t('seoOffer.limitsTitle')}</h2>
        <p>{t('seoOffer.limitsBody')}</p>
      </section>

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.faqTitle')}</h2>
        {/* Pas d'accordéon : sortir le texte des accordéons vaut +12 % de sessions (B8). */}
        {(['account', 'autofix', 'delay', 'source'] as const).map((k) => (
          <div key={k} className="aseo-faq">
            <h3 className="aseo-h3">{t(`seoOffer.faq.${k}.q`)}</h3>
            <p>{t(`seoOffer.faq.${k}.a`)}</p>
          </div>
        ))}
      </section>

      {/* Liens sortants vers des sources sérieuses : quatre tests indépendants, effet
          positif, aucun contre-exemple (B4). */}
      <section className="aseo-block aseo-sources">
        <h2 className="aseo-h2">{t('seoOffer.sourcesTitle')}</h2>
        <p>
          {t('seoOffer.sourcesBody')}{' '}
          <a href="https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering" rel="noopener" target="_blank">
            {t('seoOffer.sourceGoogle')}
          </a>
          {' · '}
          <a href="https://platform.openai.com/docs/bots" rel="noopener" target="_blank">
            {t('seoOffer.sourceOpenai')}
          </a>
        </p>
      </section>
    </div>
  );
}

export default AuditSeoPage;
