/**
 * Page tarifs dédiée de l'offre SEO — `/audit-seo/tarifs`.
 *
 * Séparée de la landing volontairement : le corpus mesure que les requêtes de prix ont un
 * meilleur taux de clic que les termes métier et génèrent un trafic durable. Une section
 * « tarifs » à l'intérieur d'une landing ne capte pas ces requêtes.
 *
 * Reprend aussi l'intention d'abonnement transmise par `?plan=` quand l'utilisateur vient de
 * s'inscrire depuis la table : sans ça, il devrait recliquer et se demander si son clic a
 * été perdu.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SeoHead from '../components/SeoHead.js';
import { SeoPricingTable, type SeoPlanId } from '../components/SeoPricingTable.js';
import './AuditSeoPage.css';

const VALID_PLANS: SeoPlanId[] = ['seo_solo', 'seo_studio', 'seo_agency'];

export function AuditSeoPricingPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [resumed, setResumed] = useState<SeoPlanId | null>(null);
  const canceled = params.get('checkout') === 'cancel';

  useEffect(() => {
    const p = params.get('plan');
    if (p && (VALID_PLANS as string[]).includes(p)) setResumed(p as SeoPlanId);
  }, [params]);

  return (
    <div className="aseo">
      <SeoHead titleKey="seo.auditSeoPricing.title" descKey="seo.auditSeoPricing.desc" />

      <header className="aseo-hero">
        <h1 className="aseo-h1">{t('seoOffer.pricingH1')}</h1>
        <p className="aseo-lede">{t('seoOffer.pricingLede')}</p>
      </header>

      {canceled && (
        <p className="aseo-info" role="status">{t('seoOffer.checkoutCanceled')}</p>
      )}
      {resumed && !canceled && (
        <p className="aseo-info" role="status">
          {t('seoOffer.resumePlan', { plan: t(`seoOffer.tier.${resumed}.name`) })}
        </p>
      )}

      <SeoPricingTable highlight={resumed ?? 'seo_studio'} />

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.detailTitle')}</h2>
        {(['free', 'seo_solo', 'seo_studio', 'seo_agency'] as const).map((k) => (
          <div key={k} className="aseo-detail">
            <h3 className="aseo-h3">
              {t(`seoOffer.tier.${k}.name`)} — {t(`seoOffer.tier.${k}.priceLabel`)}
            </h3>
            <p>{t(`seoOffer.tier.${k}.detail`)}</p>
          </div>
        ))}
      </section>

      <section className="aseo-block">
        <h2 className="aseo-h2">{t('seoOffer.billingFaqTitle')}</h2>
        {(['whyFree', 'whatCounts', 'cancel', 'staleness'] as const).map((k) => (
          <div key={k} className="aseo-faq">
            <h3 className="aseo-h3">{t(`seoOffer.billingFaq.${k}.q`)}</h3>
            <p>{t(`seoOffer.billingFaq.${k}.a`)}</p>
          </div>
        ))}
      </section>

      <p className="aseo-back">
        <Link to="/audit-seo">{t('seoOffer.backToOffer')}</Link>
        {' · '}
        <Link to="/visibilite-ia">{t('seoOffer.ctaTest')}</Link>
      </p>
    </div>
  );
}

export default AuditSeoPricingPage;
