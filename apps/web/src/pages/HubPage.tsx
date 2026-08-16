import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ScreenerTopRow } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { Icon, ScorePill } from '../components/ui/primitives.js';
import { ResilienceStarsBadge } from '../components/ResilienceStars.js';
import { sectorSlug, sectorHubSlug } from '../lib/sector.js';
import { formatPrice } from '../lib/format.js';
import SeoHead from '../components/SeoHead.js';
import './ScreenerPage.css';

type Lang = 'fr' | 'en' | 'es';
function pickLang(l: string): Lang {
  const b = (l || 'fr').toLowerCase().split('-')[0];
  return b === 'en' ? 'en' : b === 'es' ? 'es' : 'fr';
}

function ratioOf(r: ScreenerTopRow): number {
  return r.scoreChiffresMax ? (r.scoreChiffres ?? 0) / r.scoreChiffresMax : 0;
}

interface HubCopy {
  rank: string;
  company: string;
  score: string;
  price: string;
  noteExplain: string;
  pfcfExplain: string;
  methodologyCta: string;
  screenerCta: string;
  goFurther: string;
  bySector: string;
  empty: string;
  crumbHome: string;
  crumbScreener: string;
  notFoundTitle: string;
  notFoundDesc: string;
  backHome: string;
  sectorTitle: (s: string) => string;
  sectorDesc: (s: string) => string;
  sectorH1: (s: string) => string;
  sectorIntro: (s: string) => string;
}

const STRINGS: Record<Lang, HubCopy> = {
  fr: {
    rank: 'Rang',
    company: 'Entreprise',
    score: 'Note',
    price: 'Cours',
    noteExplain:
      'Notre note de qualité juge la solidité du business sur dix critères financiers objectifs : rentabilité, croissance des ventes et du cash, rachats d’actions, endettement maîtrisé, rendement du capital. Plus la note est haute, plus l’entreprise est solide, indépendamment du prix de son action.',
    pfcfExplain:
      'Le P/FCF (price to free cash flow) rapporte le prix de l’action au cash qu’elle génère vraiment une fois ses factures payées. Un P/FCF bas veut dire qu’elle se paie bon marché, un P/FCF élevé qu’elle est chère. Une note haute avec un P/FCF bas, c’est de la qualité à prix raisonnable.',
    methodologyCta: 'Comment nous notons une action',
    screenerCta: 'Explorer le screener complet',
    goFurther: 'Aller plus loin',
    bySector: 'Classement par secteur',
    empty: 'Aucune action à afficher pour le moment.',
    crumbHome: 'Accueil',
    crumbScreener: 'Screener',
    notFoundTitle: 'Page introuvable',
    notFoundDesc: 'Ce secteur n’existe pas.',
    backHome: 'Retour à l’accueil',
    sectorTitle: (s) => `${s} : meilleures actions de qualité`,
    sectorDesc: (s) =>
      `Les meilleures actions du secteur ${s} classées par notre note de qualité, avec leur P/FCF. Analyse fondamentale, mise à jour en continu.`,
    sectorH1: (s) => `Meilleures actions du secteur ${s}`,
    sectorIntro: (s) =>
      `Voici les entreprises du secteur ${s} les mieux notées par notre analyse fondamentale, classées par qualité du business. Pour chacune, tu vois notre note sur dix et le P/FCF, le prix rapporté au cash généré. Clique sur une ligne pour l’analyse complète.`,
  },
  en: {
    rank: 'Rank',
    company: 'Company',
    score: 'Score',
    price: 'Price',
    noteExplain:
      'Our quality score judges how solid a business is across ten objective financial criteria: profitability, sales and cash growth, share buybacks, controlled debt, return on capital. The higher the score, the stronger the company, regardless of its share price.',
    pfcfExplain:
      'The P/FCF (price to free cash flow) divides the share price by the cash the company truly generates once its bills are paid. A low P/FCF means the stock is cheap, a high one means it is expensive. A high score with a low P/FCF is quality at a reasonable price.',
    methodologyCta: 'How we score a stock',
    screenerCta: 'Explore the full screener',
    goFurther: 'Go further',
    bySector: 'Ranking by sector',
    empty: 'No stocks to show right now.',
    crumbHome: 'Home',
    crumbScreener: 'Screener',
    notFoundTitle: 'Page not found',
    notFoundDesc: 'This sector does not exist.',
    backHome: 'Back to home',
    sectorTitle: (s) => `${s}: best quality stocks`,
    sectorDesc: (s) =>
      `The best ${s} stocks ranked by our quality score, with their P/FCF. Fundamental analysis, updated continuously.`,
    sectorH1: (s) => `Best ${s} stocks`,
    sectorIntro: (s) =>
      `Here are the ${s} companies with the highest scores from our fundamental analysis, ranked by business quality. For each, you see our score out of ten and the P/FCF, the price relative to the cash generated. Click a row for the full analysis.`,
  },
  es: {
    rank: 'Puesto',
    company: 'Empresa',
    score: 'Nota',
    price: 'Precio',
    noteExplain:
      'Nuestra nota de calidad juzga la solidez del negocio con diez criterios financieros objetivos: rentabilidad, crecimiento de ventas y de caja, recompras de acciones, deuda controlada, rendimiento del capital. Cuanto más alta la nota, más sólida la empresa, sin importar el precio de su acción.',
    pfcfExplain:
      'El P/FCF (price to free cash flow) divide el precio de la acción entre el efectivo que la empresa genera de verdad una vez pagadas sus facturas. Un P/FCF bajo significa que la acción está barata, uno alto que está cara. Una nota alta con un P/FCF bajo es calidad a un precio razonable.',
    methodologyCta: 'Cómo puntuamos una acción',
    screenerCta: 'Explorar el screener completo',
    goFurther: 'Ir más lejos',
    bySector: 'Clasificación por sector',
    empty: 'No hay acciones que mostrar por ahora.',
    crumbHome: 'Inicio',
    crumbScreener: 'Screener',
    notFoundTitle: 'Página no encontrada',
    notFoundDesc: 'Este sector no existe.',
    backHome: 'Volver al inicio',
    sectorTitle: (s) => `${s}: mejores acciones de calidad`,
    sectorDesc: (s) =>
      `Las mejores acciones del sector ${s} ordenadas por nuestra nota de calidad, con su P/FCF. Análisis fundamental, actualizado en continuo.`,
    sectorH1: (s) => `Mejores acciones del sector ${s}`,
    sectorIntro: (s) =>
      `Estas son las empresas del sector ${s} mejor puntuadas por nuestro análisis fundamental, ordenadas por calidad del negocio. De cada una ves nuestra nota sobre diez y el P/FCF, el precio respecto a la caja generada. Haz clic en una fila para el análisis completo.`,
  },
};

export function HubPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const S = STRINGS[pickLang(i18n.language)];

  const [rows, setRows] = useState<ScreenerTopRow[]>([]);
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setSectorName(null);
    (async () => {
      try {
        const sectors = await api.screener.sectors();
        const match = sectors.find((s) => sectorHubSlug(s.sector) === slug);
        if (!match) {
          if (!cancelled) setStatus('notfound');
          return;
        }
        const top = await api.screener.top({ sector: match.sector, limit: 60 });
        if (cancelled) return;
        setSectorName(match.sector);
        setRows(top.rows);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setErrMsg(e instanceof ApiError ? e.userMessage : (e as Error).message);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const path = `/secteur/${slug}`;

  const meta = useMemo(() => {
    const label = sectorName ? t(`industries.${sectorSlug(sectorName)}`, { defaultValue: sectorName }) : '';
    return { title: S.sectorTitle(label), desc: S.sectorDesc(label), h1: S.sectorH1(label), intro: S.sectorIntro(label) };
  }, [sectorName, S, t]);

  if (status === 'notfound') {
    return (
      <div className="scr">
        <SeoHead title={S.notFoundTitle} description={S.notFoundDesc} pathname={path} />
        <div className="wrap-wide scr-wrap">
          <div className="card scr-empty">
            <h1>{S.notFoundTitle}</h1>
            <p className="muted">{S.notFoundDesc}</p>
            <Link to="/" className="btn btn-brand btn-sm" style={{ marginTop: 12 }}>
              {S.backHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scr">
      <SeoHead title={meta.title} description={meta.desc} pathname={path} />
      <div className="wrap-wide scr-wrap">
        <nav aria-label={t('common.breadcrumb')} className="tiny muted" style={{ marginBottom: 6 }}>
          <Link to="/">{S.crumbHome}</Link> {'›'} <Link to="/screener">{S.crumbScreener}</Link> {'›'} {meta.h1}
        </nav>

        <div className="scr-head">
          <div className="col gap-4">
            <h1 className="scr-title">{meta.h1}</h1>
            <p className="muted" style={{ fontSize: 14 }}>{meta.intro}</p>
          </div>
        </div>

        {/* Explication pédagogique : note de qualité + P/FCF en langage parlant. */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>{S.noteExplain}</p>
          <p style={{ margin: 0 }}>{S.pfcfExplain}</p>
        </div>

        {status === 'error' && <div className="card scr-msg">{errMsg}</div>}

        {status === 'loading' ? (
          <div className="card skel-ui" style={{ height: 320 }} />
        ) : rows.length === 0 ? (
          <div className="card scr-empty">
            <p className="muted">{S.empty}</p>
          </div>
        ) : (
          <div className="card scroll-x" style={{ padding: 0 }}>
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th className="col-hide-sm" style={{ width: 56 }}>{S.rank}</th>
                  <th>{S.company}</th>
                  <th>{S.score}</th>
                  <th>{t('analyse.resilience')}</th>
                  <th>P/FCF</th>
                  <th className="col-hide-sm">{S.price}</th>
                  <th className="col-hide-sm" style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.ticker} className={r.opportunity ? 'is-opp' : undefined} onClick={() => navigate(`/analyse/${r.ticker}`)}>
                    <td className="num muted col-hide-sm">{i + 1}</td>
                    <td>
                      <div className="scr-soc">
                        <span className="num scr-soc-ticker">{r.ticker}</span>
                        <span className="scr-soc-name">{r.name ?? r.ticker}</span>
                      </div>
                    </td>
                    <td><ScorePill score={Math.round(ratioOf(r) * 10)} /></td>
                    <td><ResilienceStarsBadge score={r.resilienceStars ?? null} /></td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.pfcfTTM != null && r.pfcfTTM > 0 ? r.pfcfTTM.toFixed(1) + '×' : '—'}</td>
                    <td className="num col-hide-sm">{formatPrice(r.price, r.currency)}</td>
                    <td className="col-hide-sm" style={{ width: 40, textAlign: 'right' }}>
                      <span style={{ color: 'var(--ink-4)' }}><Icon name="chevronR" size={16} /></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Maillage interne : méthode + screener. */}
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', fontSize: 13.5 }}>
          <strong style={{ marginRight: 4 }}>{S.goFurther} :</strong>
          <Link to="/screener">{S.screenerCta}</Link>
          <Link to="/methodologie">{S.methodologyCta}</Link>
        </div>

        <div style={{ height: 50 }} />
      </div>
    </div>
  );
}
