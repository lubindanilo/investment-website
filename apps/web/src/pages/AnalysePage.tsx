import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listArticles, toArticleLang } from '@lubin/shared';
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
import { Icon, ScorePill } from '../components/ui/primitives.js';
import { TickerSearch } from '../components/TickerSearch.js';
import { UpgradeModal } from '../components/UpgradeModal.js';
import { PriceChart } from '../components/ui/charts.js';
import { AnalysisHeader, ResilienceGrid } from '../components/ResilienceAnalysis.js';
import { ResilienceBadge } from '../components/ResilienceBadge.js';
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
/** Date d'article ISO (YYYY-MM-DD) → JJ/MM/AA, même format que le flux d'actus. */
function toNewsDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y?.slice(2)}`;
}
/** Date du flux d'actus (JJ/MM/AA) → clé triable ISO (YYYY-MM-DD). */
function newsDateToIso(d: string): string {
  const [dd, mm, yy] = d.split('/');
  return `20${yy}-${mm}-${dd}`;
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
  const [refreshingManagement, setRefreshingManagement] = useState(false);
  const [generatingManagement, setGeneratingManagement] = useState(false);
  const [inWatchlist, setInWatchlist] = useState<Set<string>>(new Set());
  const [lastTicker, setLastTicker] = useState('');
  // Modale d'upgrade Pro déclenchée par les 403 PRO_REQUIRED (qualitatif IA, etc.)
  // et 429 QUOTA_EXCEEDED (10 analyses/jour atteint). Le contenu varie selon la cause.
  const [upgrade, setUpgrade] = useState<{ feature: string; detail?: string } | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

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
    if (!user) { setShowSignupModal(true); return; }
    try {
      await api.watchlist.add(analysis.ticker);
      setInWatchlist(prev => new Set(prev).add(analysis.ticker));
      toast.push('success', t('analyse.toast.added', { ticker: analysis.ticker }));
    } catch (e) { toast.push('error', (e as Error).message); }
  }

  async function generateManagement() {
    if (!analysis) return;
    if (!user) { setShowSignupModal(true); return; }
    setGeneratingManagement(true);
    try { setAnalysis(await api.generateManagement(analysis.ticker)); toast.push('success', t('analyse.toast.managementGenerated')); }
    catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      if (err.requiresPro) {
        setUpgrade({ feature: t('upgrade.management.feature'), detail: t('upgrade.management.detail') });
      } else {
        toast.push('error', err.userMessage);
      }
    }
    finally { setGeneratingManagement(false); }
  }

  async function refreshManagementOnly() {
    if (!analysis) return;
    if (!user) { setShowSignupModal(true); return; }
    setRefreshingManagement(true);
    try { setAnalysis(await api.refreshManagement(analysis.ticker)); toast.push('success', t('analyse.toast.mgmtUpdated')); }
    catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, (e as Error).message);
      if (err.requiresPro) {
        setUpgrade({ feature: t('upgrade.refreshMgmt.feature'), detail: t('upgrade.refreshMgmt.detail') });
      } else {
        toast.push('error', err.userMessage);
      }
    }
    finally { setRefreshingManagement(false); }
  }

  const chiffres = analysis?.criteres.slice(0, 10) ?? [];
  const management = analysis?.management ?? [];
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
            </div>
          </>
        )}

        {/* Page d'analyse détaillée : la search bar disparaît, on propose plutôt
            d'analyser une autre action ou de découvrir nos opportunités.
            CTAs alignés en colonne à droite, avec flèche pour signaler la navigation. */}
        {analysis && (
          <div className="anl-cta-block">
            <Link to="/analyser" className="btn btn-ghost">
              {t('analyse.analyzeAnother')} <Icon name="arrowRight" size={15} />
            </Link>
            <Link to="/screener" className="btn btn-brand">
              {t('analyse.opportunities')} <Icon name="arrowRight" size={15} />
            </Link>
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
          <>
            <AnalysisView
              analysis={analysis}
              chiffres={chiffres}
              management={management}
              watched={watched}
              onWatch={addToWatchlist}
              onGenerateManagement={generateManagement}
              generatingManagement={generatingManagement}
              refreshingManagement={refreshingManagement}
              onRefreshMgmt={refreshManagementOnly}
            />
            {/* Maillage interne : 5 actions du même secteur les mieux notées, cliquables.
                Améliore le crawl Google + propose au lecteur d'explorer des entreprises comparables. */}
            <RelatedTickers ticker={analysis.ticker} sector={analysis.sectorBenchmark?.sector ?? null} />
          </>
        )}
      </div>
      {upgrade && (
        <UpgradeModal
          feature={upgrade.feature}
          detail={upgrade.detail}
          onClose={() => setUpgrade(null)}
        />
      )}
      {showSignupModal && (
        <SignupModal
          ticker={analysis?.ticker ?? null}
          onClose={() => setShowSignupModal(false)}
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
function AnalysisView({ analysis, chiffres, management, watched, onWatch, onGenerateManagement, generatingManagement, refreshingManagement, onRefreshMgmt }: {
  analysis: AnalyzeResponse;
  chiffres: Criterion[]; management: Criterion[];
  watched: boolean; onWatch: () => void; onGenerateManagement: () => void; generatingManagement: boolean;
  refreshingManagement: boolean; onRefreshMgmt: () => void;
}) {
  const { t, i18n } = useTranslation();
  const s10 = score10(chiffres);
  const currency = analysis.currency || 'USD';
  const annualOnly = analysis.fundamentalsSource === 'yahoo';
  // Fil d'actus unifié, trié du plus récent au plus ancien : les 5 actus externes les plus
  // fraîches (flux d'actus externe, déjà plafonné à 5 par le backend) + les articles du blog liés à
  // ce ticker (article.ticker, liens internes /blog/:slug — miroir SPA du maillage bots de
  // seoPrerender, max 3). Les articles s'INSÈRENT à leur position chronologique sans évincer
  // d'actus ni être évincés. À date égale, le blog passe devant (tri stable, entrées en tête).
  const articleLang = toArticleLang(i18n.language);
  const actuRows = useMemo(() => {
    const blog = listArticles()
      .filter((a) => a.ticker?.toUpperCase() === analysis.ticker.toUpperCase())
      .slice(0, 3)
      .map((a) => ({ kind: 'blog' as const, sortKey: a.date, article: a }));
    const news = analysis.news.map((n) => ({ kind: 'news' as const, sortKey: newsDateToIso(n.date), item: n }));
    return [...blog, ...news].sort((x, y) => (x.sortKey < y.sortKey ? 1 : -1));
  }, [analysis.ticker, analysis.news]);

  // Action non couverte : on n'a NI fundamentals NI cours. Plutôt que d'afficher
  // une note 5/10 par défaut et 10 critères « Non calculable » qui induisent en
  // erreur, on bascule sur un état vide propre — juste l'icône + le ticker + le
  // message. Les CTAs du haut (« Analyser une autre action » / « Nos opportunités
  // du moment ») restent visibles et offrent la sortie.
  const noPrice = analysis.price == null || analysis.price === 0;
  if (!analysis.fundamentalsAvailable && noPrice) {
    return (
      <div className="anl-uncovered fade-in">
        <Icon name="shield" size={40} />
        <h1 className="anl-uncovered-title">{t('analyse.uncovered')}</h1>
      </div>
    );
  }

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

        <AnalysisHeader
          analysis={analysis}
          qualityScore={s10}
          watched={watched}
          onWatch={onWatch}
        />

        {/* Cours */}
        <PriceSection ticker={analysis.ticker} currency={currency} />

        {/* Les dix critères et les deux cartes hors note partagent la même grille. */}
        <Section
          title={t('analyse.sections.chiffres.title')}
          sub={t('analyse.sections.chiffres.sub')}
          right={<span className="anl-section-total">{t('analyse.qualityScore')} <strong className="num">{s10}/10</strong></span>}
        >
          <CriteriaGrid
            items={chiffres}
            ticker={analysis.ticker}
            currency={currency}
            annualOnly={annualOnly}
            className="anl-quality-grid"
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

        <Section title={t('analyse.sections.resilience.title')} sub={t('analyse.sections.resilience.sub')}>
          <ResilienceGrid analysis={analysis.resilience ?? null} />
        </Section>

        {/* Le management reste le seul bloc qualitatif à la demande. */}
        <Section
          title={t('analyse.sections.management.title')}
          sub={t('analyse.sections.management.sub')}
          right={analysis.managementAvailable
            ? <div className="anl-management-actions">
                <span className="anl-section-total">{t('analyse.managementEvaluation')} <strong className="num">{scoreOf(management)}</strong></span>
                <button className="btn btn-ghost btn-sm" onClick={onRefreshMgmt} disabled={refreshingManagement}>
                  {refreshingManagement ? <><span className="spinner" /> {t('analyse.updating')}</> : <><Icon name="refresh" size={14} /> {t('analyse.refreshManagement')}</>}
                </button>
              </div>
            : undefined}
        >
          {analysis.managementAvailable ? (
            <QualGrid items={management} className="anl-management-grid" />
          ) : (
            <div className="card anl-qual-cta">
              <div className="anl-qual-cta-icon"><Icon name="layers" size={22} /></div>
              <p>{t('analyse.managementCtaText')}</p>
              <button className="btn btn-soft" onClick={onGenerateManagement} disabled={generatingManagement}>
                {generatingManagement ? <><span className="spinner" /> {t('analyse.generating')}</> : t('analyse.generateManagement')}
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

        {/* Actualités : fil unifié blog + flux externe, du plus récent au plus ancien */}
        {actuRows.length > 0 && (
          <Section title={t('analyse.sections.actualites.title')} sub={t('analyse.sections.actualites.sub')}>
            <div className="card anl-news">
              {actuRows.map((r, i) => r.kind === 'blog' ? (
                <Link key={`b-${r.article.slug}`} to={`/blog/${r.article.slug}`} className="anl-news-row anl-news-row--blog">
                  <span className="anl-news-src">{t('analyse.sections.actualites.blogSource')}</span>
                  <span className="anl-news-title">{r.article.content[articleLang].title}</span>
                  <span className="num anl-news-time">{toNewsDate(r.article.date)}</span>
                </Link>
              ) : (
                <a key={`n-${i}`} href={r.item.url} target="_blank" rel="noopener noreferrer" className="anl-news-row">
                  <span className="anl-news-src">{r.item.source}</span>
                  <span className="anl-news-title">{r.item.titre}</span>
                  <span className="num anl-news-time">{r.item.date}</span>
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
  const { t, i18n } = useTranslation();
  const [horizon, setHorizon] = useState('5A');
  const [points, setPoints] = useState<{ date: string; value: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { years, interval } = HORIZONS[horizon]!;
    api.priceHistory(ticker, years, interval)
      .then(res => { if (!cancelled) setPoints(res.points); })
      .catch(() => { if (!cancelled) setPoints([]); })
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
          : points && points.length >= 5
            ? <PriceChart data={points.map(p => p.value)} dates={points.map(p => p.date)} locale={i18n.language} currency={currency === 'USD' ? '$' : ''} />
          : points && points.length > 0
            ? <div className="anl-price-empty">{t('chart.insufficientHistory')}</div>
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

// ─── Vitrine (état vide) — les actions les plus populaires du monde ───────────
// On montre à l'anonyme des méga-caps que tout le monde reconnaît (Apple, Microsoft…)
// plutôt que des pépites obscures issues de la veille : point d'entrée plus engageant,
// et cohérent avec le placeholder « Apple, Microsoft, Nvidia… » de la barre de recherche.
const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META'];

function LandingDiscovery({ onPick }: { onPick: (ticker: string) => void }) {
  const { t } = useTranslation();
  const [picks, setPicks] = useState<TickerPreview[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // allSettled : si un ticker n'est pas (encore) scoré, on garde simplement les autres,
    // en conservant l'ordre de POPULAR_TICKERS.
    Promise.allSettled(POPULAR_TICKERS.map(tk => api.screener.tickerPreview(tk)))
      .then(results => {
        if (cancelled) return;
        setPicks(results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : [])));
        setLoaded(true);
      });
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
                    <div className="col gap-2" style={{ minWidth: 0, flex: 1 }}>
                      <span className="anl-landing-name">{p.name ?? p.ticker}</span>
                      <span className="num anl-landing-ticker">{p.ticker}</span>
                    </div>
                    <div className="row gap-6" style={{ alignItems: 'center', flexShrink: 0 }}>
                      <ScorePill score={s} />
                      {p.resilience && <ResilienceBadge summary={p.resilience} showScore size="sm" />}
                    </div>
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

// ─── Maillage interne : autres actions du même secteur ───────────────────────
// Affiche 5 actions du même secteur les mieux notées, en bas de la page d'analyse.
// Sert à 2 choses : (1) suggérer à l'utilisateur d'autres comparables intéressantes,
// (2) construire un graphe de liens internes que Google adore crawler (maillage sectoriel).
function RelatedTickers({ ticker, sector }: { ticker: string; sector: string | null }) {
  const { t } = useTranslation();
  const [related, setRelated] = useState<ScreenerTopRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!sector) { setRelated([]); setLoaded(true); return; }
    let cancelled = false;
    setLoaded(false);
    // Le secteur peut contenir des tirets/duplications (« X - X ») → on garde la valeur brute,
    // le backend matche exactement la colonne sector qu'il a stockée.
    api.screener.top({ sector, limit: 6 })
      .then(rows => {
        if (cancelled) return;
        setRelated(rows.filter(r => r.ticker !== ticker).slice(0, 5));
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [ticker, sector]);
  if (!sector || (loaded && related.length === 0)) return null;
  // Nom de secteur affiché : on retire un éventuel dédoublement (« X - X » → « X »).
  const sectorDisplay = sector.includes(' - ') ? sector.split(' - ')[0] : sector;
  return (
    <section className="anl-related fade-up">
      <h2 className="anl-related-title">{t('analyse.related.title', { sector: sectorDisplay })}</h2>
      <div className="anl-related-grid">
        {!loaded
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="card skel-ui" style={{ height: 88 }} />)
          : related.map(r => {
              const s10 = r.scoreChiffresMax ? Math.round((r.scoreChiffres ?? 0) / r.scoreChiffresMax * 10) : 0;
              return (
                <Link key={r.ticker} to={`/analyse/${r.ticker}`} className="card anl-related-card">
                  <div className="row between">
                    <div className="col gap-2" style={{ minWidth: 0, flex: 1 }}>
                      <span className="anl-related-name">{r.name ?? r.ticker}</span>
                      <span className="num anl-related-ticker">{r.ticker}</span>
                    </div>
                    <ScorePill score={s10} />
                  </div>
                  {r.pfcfTTM != null && r.pfcfTTM > 0 && (
                    <div className="row between anl-related-foot">
                      <span className="tiny muted">P/FCF</span>
                      <span className="num tiny" style={{ color: 'var(--ink-2)' }}>{r.pfcfTTM.toFixed(1)}×</span>
                    </div>
                  )}
                </Link>
              );
            })}
      </div>
    </section>
  );
}

// ─── Modale d'inscription pour les anonymes ───────────────────────────────────
function SignupModal({ ticker, onClose }: { ticker: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const benefits = t('signupModal.benefits', { returnObjects: true }) as string[];
  const signupTarget = ticker ? `/signup?from=/analyse/${ticker}` : '/signup';
  const loginTarget = ticker ? `/login?from=/analyse/${ticker}` : '/login';

  return (
    <div className="upgrade-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="upgrade-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        <div className="upgrade-badge">{t('signupModal.badge')}</div>
        <h2 className="upgrade-title">{t('signupModal.title')}</h2>
        <p className="upgrade-sub">{t('signupModal.sub')}</p>
        <ul className="upgrade-features">
          {benefits.map((b, i) => (
            <li key={i}><Icon name="check" size={14} /><span>{b}</span></li>
          ))}
        </ul>
        <div className="upgrade-cta-row">
          <button
            type="button"
            className="btn btn-brand upgrade-cta"
            onClick={() => { onClose(); navigate(signupTarget); }}
          >
            {t('signupModal.ctaPrimary')} <Icon name="arrowRight" size={14} />
          </button>
          <button type="button" className="upgrade-cta-secondary" onClick={onClose}>
            {t('signupModal.ctaSecondary')}
          </button>
        </div>
        <p className="upgrade-disclaimer">
          {t('signupModal.loginHint')}{' '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
            onClick={() => { onClose(); navigate(loginTarget); }}
          >
            {t('signupModal.loginLink')}
          </button>
        </p>
      </div>
    </div>
  );
}
