import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AnalyzeResponse, ScreenerTopRow, Criterion } from '@lubin/shared';
import { api, ApiError, type TickerPreview } from '../lib/api.js';
import { AnalysisPreview } from '../components/AnalysisPreview.js';
import { useToast } from '../components/Toast.js';
import { useAuth } from '../contexts/AuthContext.js';
import { CriteriaGrid, QualGrid } from '../components/CriterionCard.js';
import { ValuationBlock } from '../components/ui/ValuationBlock.js';
import { PfcfRatioCard } from '../components/PfcfCards.js';
import { DividendCard } from '../components/DividendCard.js';
import { EarningsPanel } from '../components/EarningsPanel.js';
import { Icon, ScoreCircle, ScorePill, OpportunityBadge, toDataStatus } from '../components/ui/primitives.js';
import { TickerSearch } from '../components/TickerSearch.js';
import { UpgradeModal } from '../components/UpgradeModal.js';
import { CompositionBar, PriceChart } from '../components/ui/charts.js';
import SeoHead from '../components/SeoHead.js';
import './AnalysePage.css';

const HORIZONS: Record<string, { years: number; interval: '1d' | '1wk' | '1mo' }> = {
  '1A': { years: 1, interval: '1wk' },
  '5A': { years: 5, interval: '1mo' },
  '10A': { years: 10, interval: '1mo' },
  'Tout': { years: 30, interval: '1mo' },
};

function scoreOf(items: { statut: 'pass' | 'fail' | 'warn' }[]) {
  const pass = items.filter(c => c.statut === 'pass').length;
  const warn = items.filter(c => c.statut === 'warn').length;
  return `${pass + Math.round(warn * 0.5)}/${items.length}`;
}
/** Note ramenée sur 10 (le path Yahoo peut avoir moins de critères évaluables). */
function score10(items: Criterion[]): number {
  if (items.length === 0) return 0;
  const pass = items.filter(c => c.statut === 'pass').length;
  const warn = items.filter(c => c.statut === 'warn').length;
  return Math.round(((pass + 0.5 * warn) / items.length) * 10);
}
function compositionCounts(items: Criterion[]) {
  return items.reduce((a, c) => { a[toDataStatus(c.statut)]++; return a; }, { good: 0, warn: 0, bad: 0 });
}

export function AnalysePage() {
  const { ticker: routeTicker } = useParams<{ ticker?: string }>();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [ticker, setTicker] = useState(routeTicker?.toUpperCase() ?? '');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  // Aperçu public montré à l'anonyme (au lieu d'une redirection vers /signup).
  const [preview, setPreview] = useState<TickerPreview | null>(null);
  // On démarre en "chargement" s'il y a déjà un ticker dans l'URL : on attend la résolution
  // de la session avant de lancer la requête (cf. useEffect), pour ne pas flasher l'écran de saisie.
  const [loading, setLoading] = useState(!!routeTicker);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshingQual, setRefreshingQual] = useState(false);
  const [generatingQual, setGeneratingQual] = useState(false);
  const [inWatchlist, setInWatchlist] = useState<Set<string>>(new Set());
  const [lastTicker, setLastTicker] = useState('');
  // Modale d'upgrade Pro déclenchée par les 403 PRO_REQUIRED (qualitatif IA, etc.)
  // et 429 QUOTA_EXCEEDED (10 analyses/jour atteint). Le contenu varie selon la cause.
  const [upgrade, setUpgrade] = useState<{ feature: string; detail?: string } | null>(null);

  useEffect(() => { setInWatchlist(new Set()); }, [user]);

  // `tk` (ticker) plutôt que `t` pour éviter le shadowing de la fonction d'i18n
  // utilisée dans le corps de la fonction (setUpgrade avec t('upgrade.quota.feature')).
  const run = useCallback(async (tk: string) => {
    if (!tk.trim()) return;
    const cleaned = tk.trim().toUpperCase();
    setLoading(true); setError(null); setAnalysis(null); setPreview(null); setLastTicker(cleaned);
    window.scrollTo({ top: 0 });
    try {
      // L'analyse quantitative complète est servie à TOUS (connecté ou non). Le backend
      // (optionalAuth) renvoie la fiche complète ; le Pro reste gated sur le qualitatif et
      // les graphes détaillés (côté composant via isPro). Plus de mur d'inscription ici.
      setAnalysis(await api.analyze(cleaned));
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      // Anonyme : au lieu d'une redirection sèche vers /signup (qui crée un cloaking, le bot
      // voit l'analyse pré-rendue mais pas l'humain), on affiche l'APERÇU PUBLIC du ticker
      // (note /10, P/FCF, secteur : déjà servi aux bots) + un panneau d'inscription inline.
      // Le détail des critères, la valorisation, le suivi et le qualitatif restent gated.
      if (err.requiresAuth) {
        try {
          setPreview(await api.screener.tickerPreview(cleaned));
        } catch {
          // Ticker non couvert / non scoré : pas d'aperçu possible → on bascule sur /signup.
          toast.push('warn', t('analyse.toast.signupRequired', { ticker: cleaned }));
          navigate('/signup', { state: { from: `/analyse/${cleaned}` } });
        }
        return;
      }
      // Quota gratuit dépassé (10/jour) → modal upgrade. Pas une erreur "bloquante" à
      // afficher dans ErrorState, c'est juste un appel à passer Pro.
      if (err.quotaExceeded) {
        const details = (err.details as { used?: number; limit?: number } | undefined);
        setUpgrade({
          feature: t('upgrade.quota.feature'),
          detail: details
            ? t('upgrade.quota.detail', { used: details.used ?? '?', limit: details.limit ?? 10 })
            : undefined,
        });
        return;
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [navigate, toast, user, t]);

  // Soumet un ticker : on NAVIGUE vers /analyse/:ticker plutôt que de faire l'analyse en
  // local. L'URL devient l'unique source de vérité — partageable, bookmarkable, indexable
  // (SEO), boutons précédent/suivant du navigateur fonctionnels. Le useEffect [routeTicker]
  // détecte le changement et relance `run`. Cas particulier : si on soumet le ticker
  // courant (déjà dans l'URL), on rejoue `run` manuellement car useEffect ne se
  // redéclencherait pas (même valeur).
  const submit = useCallback((t: string) => {
    const cleaned = t.trim().toUpperCase();
    if (!cleaned) return;
    if (cleaned === (routeTicker ?? '').toUpperCase()) {
      void run(cleaned);
    } else {
      navigate(`/analyse/${encodeURIComponent(cleaned)}`);
    }
  }, [navigate, routeTicker, run]);

  useEffect(() => {
    if (routeTicker) {
      setTicker(routeTicker.toUpperCase());
      // On attend que la session soit résolue avant de lancer : `run` choisit l'aperçu public
      // (anonyme) ou l'analyse complète (connecté) selon `user`. Lancer trop tôt = mauvais
      // branchement + flash. `loading` est déjà à true (init) tant qu'on attend.
      if (authLoading) return;
      run(routeTicker.toUpperCase());
    } else {
      // Retour sur /analyser (clic sur l'onglet « Analyser » depuis /analyse/XXX) :
      // on remet la page à zéro — sinon l'analyse précédente reste affichée à la place
      // de l'écran de saisie.
      setTicker(''); setAnalysis(null); setError(null); setLastTicker(''); setPreview(null);
    }
  }, [routeTicker, run, authLoading]);

  async function addToWatchlist() {
    if (!analysis) return;
    if (!user) {
      navigate('/login', { state: { from: `/analyse/${analysis.ticker}` } });
      toast.push('warn', t('analyse.toast.loginWatchlist'));
      return;
    }
    try {
      await api.watchlist.add(analysis.ticker);
      setInWatchlist(prev => new Set(prev).add(analysis.ticker));
      toast.push('success', t('analyse.toast.added', { ticker: analysis.ticker }));
    } catch (e) { toast.push('error', (e as Error).message); }
  }

  async function generateQualitative() {
    if (!analysis) return;
    setGeneratingQual(true);
    try { setAnalysis(await api.generateQualitative(analysis.ticker)); toast.push('success', t('analyse.toast.qualGenerated')); }
    catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      if (err.requiresPro) {
        setUpgrade({ feature: t('upgrade.qualitative.feature'), detail: t('upgrade.qualitative.detail') });
      } else {
        toast.push('error', err.userMessage);
      }
    }
    finally { setGeneratingQual(false); }
  }

  async function refreshManagementOnly() {
    if (!analysis) return;
    setRefreshingQual(true);
    try { setAnalysis(await api.refreshManagement(analysis.ticker)); toast.push('success', t('analyse.toast.mgmtUpdated')); }
    catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      if (err.requiresPro) {
        setUpgrade({ feature: t('upgrade.refreshMgmt.feature'), detail: t('upgrade.refreshMgmt.detail') });
      } else {
        toast.push('error', err.userMessage);
      }
    }
    finally { setRefreshingQual(false); }
  }

  const chiffres = analysis?.criteres.slice(0, 10) ?? [];
  const business = analysis?.qualitativeAvailable ? analysis.criteres.slice(10, 20) : [];
  const management = analysis?.qualitativeAvailable ? analysis.criteres.slice(20, 25) : [];
  const watched = !!analysis && (analysis.inWatchlist === true || inWatchlist.has(analysis.ticker));

  return (
    <div className="anl">
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.analyse.title" descKey="seo.analyse.desc" />
      <div className="wrap anl-wrap">
        {/* Titre de page (H1) : présent dès l'état initial pour la sémantique SEO/a11y.
            Masqué quand une analyse est affichée — c'est alors le nom de société qui
            porte le H1, pour ne jamais avoir deux H1 sur la page. */}
        {!analysis && (
          <>
            <header className="anl-page-head">
              <h1 className="anl-page-title">{t('analyse.h1')}</h1>
              <p className="anl-page-sub">{t('analyse.h1Sub')}</p>
            </header>
            <div className="anl-search-block">
              <SearchBar value={ticker} onChange={setTicker} onSubmit={submit} loading={loading} />
              {!loading && !error && !preview && (
                <span className="tiny muted anl-hint">{t('analyse.hintPrefix')} <b>AAPL</b>, <b>MSFT</b> {t('analyse.hintOr')} <b>ASML</b>.</span>
              )}
            </div>
          </>
        )}

        {/* Page d'analyse détaillée : la search bar disparaît, on propose plutôt
            d'analyser une autre action ou de découvrir nos opportunités. */}
        {analysis && (
          <div className="anl-cta-block">
            <Link to="/analyser" className="btn btn-ghost">{t('analyse.analyzeAnother')}</Link>
            <Link to="/screener" className="btn btn-brand">{t('analyse.opportunities')}</Link>
          </div>
        )}

        {error && <ErrorState error={error} ticker={lastTicker} onRetry={() => { setError(null); setAnalysis(null); }} />}
        {loading && !analysis && <LoadingState />}
        {!loading && !analysis && preview && (
          <>
            <AnalysisPreview data={preview} />
            {/* Comble le vide sous l'aperçu anonyme avec du contenu RÉEL et utile : les actions
                les mieux notées par la veille, cliquables (montre le produit + invite à explorer). */}
            <LandingDiscovery onPick={(t) => { setTicker(t); submit(t); }} />
          </>
        )}
        {!loading && !analysis && !error && !preview && <LandingDiscovery onPick={(t) => { setTicker(t); submit(t); }} />}

        {analysis && (
          <AnalysisView
            analysis={analysis}
            chiffres={chiffres}
            business={business}
            management={management}
            watched={watched}
            onWatch={addToWatchlist}
            onGenerateQual={generateQualitative}
            generatingQual={generatingQual}
            refreshingQual={refreshingQual}
            onRefreshMgmt={refreshManagementOnly}
          />
        )}
      </div>
      {upgrade && (
        <UpgradeModal
          feature={upgrade.feature}
          detail={upgrade.detail}
          onClose={() => setUpgrade(null)}
        />
      )}
    </div>
  );
}

// ─── Barre de recherche ──────────────────────────────────────────────────────
function SearchBar({ value, onChange, onSubmit, loading }: {
  value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <form className="anl-search" onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
      <div className="anl-search-field">
        <TickerSearch
          value={value}
          onChange={onChange}
          onSelect={onSubmit}
          placeholder={t('analyse.searchPlaceholder')}
          variant="field"
          noResultLabel={t('compare.noResult')}
        />
      </div>
      <button type="submit" className="btn btn-brand" style={{ height: 48 }} disabled={loading || !value.trim()}>
        {loading ? t('analyse.analyzing') : <>{t('analyse.analyze')} <Icon name="arrowRight" size={17} /></>}
      </button>
    </form>
  );
}

// ─── Section (titre + sous-titre + slot droit) ───────────────────────────────
function Section({ title, sub, right, children }: {
  title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="anl-section">
      <div className="anl-section-head">
        <div className="col gap-2">
          <h2 className="anl-section-title">{title}</h2>
          {sub && <span className="tiny muted">{sub}</span>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ─── Vue remplie ─────────────────────────────────────────────────────────────
function AnalysisView({ analysis, chiffres, business, management, watched, onWatch, onGenerateQual, generatingQual, refreshingQual, onRefreshMgmt }: {
  analysis: AnalyzeResponse;
  chiffres: Criterion[]; business: Criterion[]; management: Criterion[];
  watched: boolean; onWatch: () => void; onGenerateQual: () => void; generatingQual: boolean;
  refreshingQual: boolean; onRefreshMgmt: () => void;
}) {
  const { t } = useTranslation();
  const s10 = score10(chiffres);
  const counts = compositionCounts(chiffres);
  const currency = analysis.currency || 'USD';
  const annualOnly = analysis.fundamentalsSource === 'yahoo';

  return (
    <>
      <div className="col gap-28 fade-in anl-filled">
        {!analysis.fundamentalsAvailable && (
          <div className="anl-banner">
            <Icon name="shield" size={16} />
            <span>{t('analyse.banner.noFundamentalsPre')} <b>{analysis.ticker}</b>. {t('analyse.banner.noFundamentalsPost')}</span>
          </div>
        )}

        {/* « Opportunité du moment » : P/FCF dans son décile bas historique ET < 25 */}
        {analysis.opportunity && (
          <div className="anl-banner" style={{
            background: 'var(--good-bg)', color: 'var(--good-ink)',
            border: '1px solid color-mix(in oklch, var(--good) 30%, transparent)',
          }}>
            <Icon name="gem" size={16} stroke={2} />
            <span>
              <b>{t('opportunity.banner')}</b>
              {analysis.pfcfPercentile != null && <> — {t('opportunity.bannerDetail', { pct: Math.round(analysis.pfcfPercentile) })}</>}
            </span>
          </div>
        )}

        {/* ScoreCard */}
        <div className="card anl-scorecard">
          <ScoreCircle score={s10} />
          <div className="col gap-12 grow">
            <div className="anl-scorecard-head">
              <div className="col gap-4">
                <div className="row gap-10">
                  <h1 className="anl-company">{analysis.company}</h1>
                  <span className="num anl-ticker-badge">{analysis.ticker}</span>
                  {annualOnly && <span className="num anl-ticker-badge" title={t('analyse.viaYahooTitle')}>{t('analyse.viaYahoo')}</span>}
                </div>
                {analysis.price != null && (
                  <div className="num anl-price">{currency} {analysis.price.toFixed(2)}</div>
                )}
              </div>
              <button className={'btn ' + (watched ? 'btn-soft' : 'btn-brand')} onClick={onWatch}>
                {watched ? <><Icon name="check" size={16} /> {t('analyse.inWatchlist')}</> : <><Icon name="plus" size={16} /> {t('analyse.addToWatchlist')}</>}
              </button>
            </div>
            {analysis.verdict_direct?.trim() && <p className="anl-verdict">{analysis.verdict_direct}</p>}
            <div className="col gap-6 anl-composition">
              <div className="row between">
                <span className="tiny muted">{t('analyse.scoreComposition')}</span>
                <span className="num tiny anl-comp-counts">
                  <span style={{ color: 'var(--good)' }}>{t('analyse.compYes', { count: counts.good })}</span> · <span style={{ color: 'var(--warn)' }}>{t('analyse.compPartial', { count: counts.warn })}</span> · <span style={{ color: 'var(--bad)' }}>{t('analyse.compNo', { count: counts.bad })}</span>
                </span>
              </div>
              <CompositionBar counts={counts} />
            </div>
          </div>
        </div>

        {/* Cours */}
        <PriceSection ticker={analysis.ticker} currency={currency} />

        {/* 10 critères + carte « Ratio P/FCF » (hors notation, sur 2 colonnes, complète la rangée) */}
        <Section title={t('analyse.sections.chiffres.title')} sub={t('analyse.sections.chiffres.sub')}>
          <CriteriaGrid
            items={chiffres}
            ticker={analysis.ticker}
            currency={currency}
            annualOnly={annualOnly}
            trailing={<>
              <PfcfRatioCard
                pfcfTTM={analysis.metrics.pfcfTTM}
                pfcfPercentile={analysis.pfcfPercentile}
                sectorBenchmark={analysis.sectorBenchmark ?? null}
                ticker={analysis.ticker}
                annualOnly={annualOnly}
              />
              {analysis.dividend && <DividendCard dividend={analysis.dividend} currency={currency} company={analysis.company} ticker={analysis.ticker} />}
            </>}
          />
        </Section>

        {/* Qualitatif (à la demande) */}
        <Section
          title={t('analyse.sections.qualitative.title')}
          sub={t('analyse.sections.qualitative.sub')}
          right={analysis.qualitativeAvailable
            ? <button className="btn btn-ghost btn-sm" onClick={onRefreshMgmt} disabled={refreshingQual}>
                {refreshingQual ? <><span className="spinner" /> {t('analyse.updating')}</> : <><Icon name="refresh" size={14} /> {t('analyse.management')}</>}
              </button>
            : undefined}
        >
          {analysis.qualitativeAvailable ? (
            <div className="col gap-20">
              <div className="col gap-10">
                <span className="kicker anl-qual-kicker">{t('analyse.businessModel')} · {scoreOf(business)}</span>
                {/* La dernière carte business (« Gagne des parts de marché ») porte la part de marché + le graphe. */}
                <QualGrid items={business} marketShare={analysis.marketShare ?? null} onGenerateMarketShare={onGenerateQual} generatingMarketShare={generatingQual} />
              </div>
              <div className="col gap-10">
                <span className="kicker anl-qual-kicker">{t('analyse.management')} · {scoreOf(management)}</span>
                <QualGrid items={management} />
              </div>
            </div>
          ) : (
            <div className="card anl-qual-cta">
              <div className="anl-qual-cta-icon"><Icon name="layers" size={22} /></div>
              <p>{t('analyse.qualCtaText')}</p>
              <button className="btn btn-soft" onClick={onGenerateQual} disabled={generatingQual}>
                {generatingQual ? <><span className="spinner" /> {t('analyse.generating')}</> : t('analyse.generateQual')}
              </button>
            </div>
          )}
        </Section>

        {/* Résultats (sous le qualitatif) */}
        {(analysis.earnings?.next || analysis.earnings?.last) && (
          <Section title={t('analyse.sections.resultats.title')} sub={t('analyse.sections.resultats.sub')}>
            <EarningsPanel ticker={analysis.ticker} earnings={analysis.earnings} currency={currency} />
          </Section>
        )}

        {/* Valorisation */}
        <Section title={t('analyse.sections.valorisation.title')} sub={t('analyse.sections.valorisation.sub')}>
          <ValuationBlock price={analysis.price} pfcfTTM={analysis.metrics.pfcfTTM} currency={currency} valoParams={analysis.valoParams} />
        </Section>

        {/* Actualités */}
        {analysis.news.length > 0 && (
          <Section title={t('analyse.sections.actualites.title')} sub={t('analyse.sections.actualites.sub')}>
            <div className="card anl-news">
              {analysis.news.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="anl-news-row">
                  <span className="anl-news-src">{n.source}</span>
                  <span className="anl-news-title">{n.titre}</span>
                  <span className="num anl-news-time">{n.date}</span>
                </a>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

// ─── Section cours (SVG via priceHistory) ────────────────────────────────────
function PriceSection({ ticker, currency }: { ticker: string; currency: string }) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState('5A');
  const [data, setData] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { years, interval } = HORIZONS[horizon]!;
    api.priceHistory(ticker, years, interval)
      .then(res => { if (!cancelled) setData(res.points.map(p => p.value)); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, horizon]);

  return (
    <Section title={t('analyse.sections.cours.title')} sub={t('analyse.sections.cours.sub')}
      right={<div className="seg">{Object.keys(HORIZONS).map(h => (
        <button key={h} type="button" data-active={h === horizon} onClick={() => setHorizon(h)}>{h === 'Tout' ? t('analyse.horizonAll') : h}</button>
      ))}</div>}>
      <div className="card anl-price-card">
        {loading ? <div className="skel-ui" style={{ height: 240 }} />
          : data && data.length >= 2 ? <PriceChart data={data} currency={currency === 'USD' ? '$' : ''} />
          : <div className="anl-price-empty">{t('analyse.priceUnavailable')}</div>}
      </div>
    </Section>
  );
}

// ─── Skeleton chargement ─────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="fade-in col gap-20 anl-filled">
      <div className="card anl-scorecard">
        <div className="skel-ui" style={{ width: 116, height: 116, borderRadius: '50%' }} />
        <div className="col gap-10 grow">
          <div className="skel-ui" style={{ width: 220, height: 26 }} />
          <div className="skel-ui" style={{ width: 320, height: 16 }} />
          <div className="skel-ui" style={{ width: '70%', height: 14 }} />
          <div className="skel-ui" style={{ width: 170, height: 40, marginTop: 8, borderRadius: 9 }} />
        </div>
      </div>
      <div className="card skel-ui" style={{ height: 240 }} />
      <div className="criteria-grid">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skel-ui" style={{ height: 128 }} />)}
      </div>
    </div>
  );
}

// ─── Erreur ──────────────────────────────────────────────────────────────────
function ErrorState({ error, ticker, onRetry }: { error: ApiError; ticker: string; onRetry: () => void }) {
  const { t } = useTranslation();
  let title: string, desc: string, icon: 'search' | 'shield' | 'refresh' = 'search';
  if (error.status === 404) { title = t('analyse.error.notFound', { ticker }); desc = typeof error.details === 'string' ? error.details : error.userMessage; icon = 'search'; }
  else if (error.status === 429) { title = t('analyse.error.tooManyTitle'); desc = t('analyse.error.tooManyDesc'); icon = 'refresh'; }
  else if (error.status === 0) { title = t('analyse.error.offlineTitle'); desc = t('analyse.error.offlineDesc'); icon = 'refresh'; }
  else if (error.status === 400) { title = t('analyse.error.invalidTitle'); desc = t('analyse.error.invalidDesc'); icon = 'search'; }
  else { title = t('analyse.error.genericTitle'); desc = error.userMessage; icon = 'shield'; }
  return (
    <div className="card anl-error fade-up">
      <div className="anl-error-icon"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      <p className="muted">{desc}</p>
      <button className="btn btn-ghost" onClick={onRetry} style={{ marginTop: 6 }}>{t('analyse.error.newSearch')}</button>
    </div>
  );
}

// ─── Vitrine (état vide) — les mieux notées ──────────────────────────────────
function LandingDiscovery({ onPick }: { onPick: (ticker: string) => void }) {
  const { t } = useTranslation();
  const [picks, setPicks] = useState<ScreenerTopRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.screener.top({ minRatio: 0.9, minMax: 8, limit: 6 })
      .then(p => { if (!cancelled) { setPicks(p); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);
  if (loaded && picks.length === 0) return null;
  return (
    <div className="fade-up anl-landing">
      <div className="row gap-8 anl-landing-head">
        <Icon name="star" size={16} style={{ color: 'var(--brand)' }} />
        <span className="kicker">{t('analyse.landingKicker')}</span>
      </div>
      <div className="anl-landing-grid">
        {!loaded
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skel-ui" style={{ height: 96 }} />)
          : picks.map(p => {
              const s = p.scoreChiffresMax ? Math.round((p.scoreChiffres ?? 0) / p.scoreChiffresMax * 10) : 0;
              return (
                <button key={p.ticker} className="card anl-landing-card" onClick={() => onPick(p.ticker)}>
                  <div className="row between">
                    <div className="col gap-2" style={{ minWidth: 0 }}>
                      <span className="num anl-landing-ticker">{p.ticker}</span>
                      <span className="tiny muted anl-landing-name">{p.name ?? p.ticker}</span>
                    </div>
                    <ScorePill score={s} />
                  </div>
                  {p.pfcfTTM != null && p.pfcfTTM > 0 && (
                    <div className="row between anl-landing-foot">
                      <span className="tiny muted">P/FCF</span>
                      <span className="num tiny" style={{ color: 'var(--ink-2)' }}>{p.pfcfTTM.toFixed(1)}×</span>
                    </div>
                  )}
                </button>
              );
            })}
      </div>
    </div>
  );
}
