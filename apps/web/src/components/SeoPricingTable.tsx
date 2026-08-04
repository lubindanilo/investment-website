/**
 * Table de tarifs de l'offre SEO — partagée par la landing et la page tarifs dédiée.
 *
 * Les plafonds sont dupliqués ici depuis `apps/api/src/mcp/gating.ts`, faute de package
 * partagé entre le web et l'API pour ces constantes. Le pré-rendu bot, lui, les importe
 * directement de `gating.ts`. Si les deux divergent, c'est la page commerciale qui mentira :
 * à consolider dans `@lubin/shared` au premier changement de prix.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.js';

export type SeoPlanId = 'seo_solo' | 'seo_studio' | 'seo_agency';

export interface SeoTierRow {
  id: 'free' | SeoPlanId;
  price: string;
  audits: string;
  pages: string;
  sites: string;
  history: boolean;
  benchmark: boolean;
  whiteLabel: boolean;
}

export const SEO_TIER_ROWS: SeoTierRow[] = [
  { id: 'free', price: '0 €', audits: '1', pages: '25', sites: '—', history: false, benchmark: false, whiteLabel: false },
  { id: 'seo_solo', price: '39 €', audits: '∞', pages: '500', sites: '1', history: true, benchmark: false, whiteLabel: false },
  { id: 'seo_studio', price: '149 €', audits: '∞', pages: '5 000', sites: '10', history: true, benchmark: true, whiteLabel: false },
  { id: 'seo_agency', price: '490 €', audits: '∞', pages: '50 000', sites: '∞', history: true, benchmark: true, whiteLabel: true },
];

export function SeoPricingTable({ highlight = 'seo_studio' }: { highlight?: SeoPlanId }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: SeoPlanId) {
    setError(null);
    // Pas connecté : on ne peut pas créer de Checkout Session sans utilisateur. On envoie
    // vers l'inscription en gardant l'intention dans l'URL pour reprendre après.
    if (!user) {
      navigate(`/signup?next=${encodeURIComponent(`/audit-seo/tarifs?plan=${plan}`)}`);
      return;
    }
    setPending(plan);
    try {
      const { url } = await api.billing.checkout(plan);
      window.location.href = url;
    } catch {
      // 503 = le price ID n'est pas encore configuré côté Stripe. On le dit sans jargon.
      setError(t('seoOffer.notOpenYet'));
      setPending(null);
    }
  }

  return (
    <div className="seo-pricing">
      {error && <p className="seo-pricing-error" role="alert">{error}</p>}
      <div className="seo-pricing-grid">
        {SEO_TIER_ROWS.map((row) => (
          <div
            key={row.id}
            className={`seo-tier${row.id === highlight ? ' seo-tier--highlight' : ''}`}
          >
            <h3 className="seo-tier-name">{t(`seoOffer.tier.${row.id}.name`)}</h3>
            <p className="seo-tier-price">
              <span className="num">{row.price}</span>
              {row.id !== 'free' && <span className="seo-tier-per">{t('seoOffer.perMonth')}</span>}
            </p>
            <p className="seo-tier-for">{t(`seoOffer.tier.${row.id}.for`)}</p>
            <ul className="seo-tier-feats">
              <li>{t('seoOffer.feat.aiTest')}</li>
              <li>
                {row.audits === '\u221e'
                  ? t('seoOffer.feat.auditsUnlimited')
                  : t('seoOffer.feat.audits', { n: row.audits })}
              </li>
              <li>{t('seoOffer.feat.pages', { n: row.pages })}</li>
              {/* Aucun site suivi : c'est une absence de fonctionnalité, pas une valeur. */}
              <li className={row.sites === '\u2014' ? 'seo-feat-off' : ''}>
                {row.sites === '\u2014'
                  ? t('seoOffer.feat.sitesNone')
                  : row.sites === '\u221e'
                    ? t('seoOffer.feat.sitesUnlimited')
                    : t('seoOffer.feat.sites', { n: row.sites })}
              </li>
              <li className={row.history ? '' : 'seo-feat-off'}>{t('seoOffer.feat.history')}</li>
              <li className={row.benchmark ? '' : 'seo-feat-off'}>{t('seoOffer.feat.benchmark')}</li>
              <li className={row.whiteLabel ? '' : 'seo-feat-off'}>{t('seoOffer.feat.whiteLabel')}</li>
            </ul>
            {row.id === 'free' ? (
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/visibilite-ia')}>
                {t('seoOffer.startFree')}
              </button>
            ) : (
              <button
                type="button"
                className={`btn ${row.id === highlight ? 'btn-brand' : 'btn-ghost'}`}
                disabled={pending === row.id}
                onClick={() => subscribe(row.id as SeoPlanId)}
              >
                {pending === row.id ? t('seoOffer.redirecting') : t('seoOffer.choose')}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="seo-pricing-note">{t('seoOffer.tableNote')}</p>
    </div>
  );
}

export default SeoPricingTable;
