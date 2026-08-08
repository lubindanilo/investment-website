/**
 * /api/screener — veille quantitative automatique.
 *
 *   POST /api/screener/seed?region=US   → ingère l'univers (protégé par secret)
 *   POST /api/screener/tick?n=10        → note un lot de tickers dus (protégé par secret)
 *   GET  /api/screener/top              → meilleures notes (lecture publique)
 *   GET  /api/screener/stats            → progression de la veille (lecture publique)
 *
 * Les endpoints d'écriture (seed/tick) sont appelés par un cron externe (GitHub Actions)
 * et protégés par un header `x-screener-token` = env SCREENER_TOKEN. Fail-closed : si le
 * secret n'est pas configuré, ils sont refusés.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TickerSuggestion } from '@lubin/shared';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwner } from '../middleware/owner.js';
import { seedRegion, tick, getTop, getStats, getSectors, refreshOpportunitiesLive } from '../services/screener.js';
import { getMarketBeat, getForwardCompare } from '../services/marketBeat.js';
import { getPublishedResilienceSummaries } from '../services/resilienceSummary.js';
import { getResilienceStars } from '../services/resilienceStars.js';
import { getProfile2 } from '../services/finnhub.js';
import { getAssetProfileYahoo } from '../services/yahoo.js';
import { getCachedSnapshot } from '../services/quantCache.js';
import { buildQuantitativeCriteria } from '../services/derivedMetrics.js';
import { parseLang, type Lang } from '../i18n/index.js';
import { prisma } from '../db/client.js';

export const screenerRouter: Router = Router();

/** Garde : exige le secret partagé. Refuse si SCREENER_TOKEN absent côté serveur. */
function requireScreenerToken(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.SCREENER_TOKEN;
  if (!expected) { next(new ApiError(503, 'Screener non configuré', 'SCREENER_TOKEN manquant côté serveur')); return; }
  const got = req.header('x-screener-token');
  if (got !== expected) { next(new ApiError(401, 'Non autorisé')); return; }
  next();
}

// ── POST /seed?region=US ────────────────────────────────────────────────────
screenerRouter.post('/seed', requireScreenerToken, asyncHandler(async (req: Request, res: Response) => {
  const region = String(req.query.region ?? 'US').toUpperCase();
  const result = await seedRegion(region);
  res.json(result);
}));

// ── POST /tick?n=10 ─────────────────────────────────────────────────────────
screenerRouter.post('/tick', requireScreenerToken, asyncHandler(async (req: Request, res: Response) => {
  const n = Math.max(1, Math.min(Number(req.query.n ?? 10) || 10, 25));
  // Budget scoring par appel (s) : 15 s par défaut (cadence cron serverless), montable jusqu'à
  // 50 s pour un backfill (lambda maxDuration 60 s) → ~6-8 titres/appel au lieu de ~2-3.
  const deadlineMs = Math.max(1, Math.min(Number(req.query.deadline ?? 15) || 15, 50)) * 1_000;
  // Région optionnelle (US/EU/INTL) : draine une zone précise sans famine par la priorité US.
  const rawRegion = String(req.query.region ?? '').toUpperCase();
  const region = ['US', 'EU', 'INTL'].includes(rawRegion) ? rawRegion : undefined;
  // warm=0 : désactive la phase warm graphiques (économie compute Neon Free sur le cron quotidien).
  const warm = String(req.query.warm ?? '1') !== '0';
  // fast=1 : ne pioche que les tickers tenables dans la deadline lambda (sans point). Le cron
  // planifié l'active — sans lui il passait 40 appels à expirer sur du non-US (6 notés sur 243).
  const onlyFast = String(req.query.fast ?? '0') === '1';
  // Budget PAR TITRE (s), optionnel. Le defaut code (10 s US / 20 s non-US) est calibre pour une
  // deadline d'appel de 15 s, mais un snapshot complet demande ~30 s : mesure du drain du
  // 08/08/2026, 800 titres notes a 3,9/min en concurrence 2. Sous 10 s, TOUS les titres expirent
  // — le run planifie du 08/08 a fait 11 passes, 8 timeouts par passe, 0 note. Plafonne a 50 s
  // pour rester sous le maxDuration de 60 s de la lambda (cf. vercel.json).
  const rawPer = Number(req.query.per);
  const perTickerMs = Number.isFinite(rawPer) && rawPer > 0
    ? Math.min(rawPer, 50) * 1_000
    : undefined;
  // Concurrence, optionnelle. Les limiteurs d'API sont GLOBAUX au process : monter la concurrence
  // n'accelere pas un titre, elle allonge la latence de chacun. A budget par titre serre, il faut
  // donc la BAISSER (le drain tourne a 2), sinon les titres expirent tous ensemble.
  const rawConc = Number(req.query.conc);
  const concurrency = Number.isFinite(rawConc) && rawConc > 0 ? Math.min(rawConc, 8) : undefined;
  const result = await tick(n, deadlineMs, region, { warm, onlyFast, perTickerMs, concurrency });
  res.json(result);
}));

// ── GET /top ────────────────────────────────────────────────────────────────
screenerRouter.get('/top', asyncHandler(async (req: Request, res: Response) => {
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const sectors = typeof req.query.sector === 'string' && req.query.sector.trim()
    ? req.query.sector.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;
  // Tranches de capitalisation (Small/Mid/Large), multi-choix : ?caps=small,mid
  const caps = typeof req.query.caps === 'string' && req.query.caps.trim()
    ? req.query.caps.split(',').map(s => s.trim().toLowerCase()).filter((c): c is 'small' | 'mid' | 'large' => c === 'small' || c === 'mid' || c === 'large')
    : undefined;
  // Zones géographiques / éligibilité PEA, multi-choix : ?zones=pea,us
  const zones = typeof req.query.zones === 'string' && req.query.zones.trim()
    ? req.query.zones.split(',').map(s => s.trim().toLowerCase()).filter((z): z is 'pea' | 'us' | 'intl' => z === 'pea' || z === 'us' || z === 'intl')
    : undefined;
  const onlyOpportunities = req.query.opportunities === 'true';
  // Vue « opportunités » : on ré-évalue le flag AU PRIX DU JOUR avant de filtrer (auto-throttlé
  // ~10 min). La pépite dépend du cours → on ne veut pas servir un flag figé au dernier earnings.
  // Best-effort : si Yahoo flanche, on sert les flags en cache.
  if (onlyOpportunities) {
    await refreshOpportunitiesLive().catch(() => {});
  }
  const rows = await getTop({
    minRatio: num(req.query.minRatio),
    maxPfcf: num(req.query.maxPfcf),
    minMax: num(req.query.minMax),
    limit: num(req.query.limit),
    onlyOpportunities,
    sectors,
    caps,
    zones,
  });
  res.json(rows);
}));

// ── GET /market-beat (panier value+momentum, page PRIVÉE → réservé au propriétaire) ──
screenerRouter.get('/market-beat', requireAuth, requireOwner, asyncHandler(async (req: Request, res: Response) => {
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const u = req.query.universe;
  const rows = await getMarketBeat({
    topPct: num(req.query.topPct) ?? 0.5,
    nPicks: num(req.query.n) ?? 20,
    universe: u === 'ALL' ? 'ALL' : u === 'US' ? 'US' : 'SP500',
  });
  res.json(rows);
}));

// ── GET /forward-compare (suivi forward, page PRIVÉE → réservé au propriétaire) ──
screenerRouter.get('/forward-compare', requireAuth, requireOwner, asyncHandler(async (req: Request, res: Response) => {
  res.json(await getForwardCompare(req.user!.userId));
}));

// ── GET /sectors (industries distinctes pour le filtre) ──────────────────────
screenerRouter.get('/sectors', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getSectors());
}));

// ── GET /earnings?from=YYYY-MM-DD&to=YYYY-MM-DD ─────────────────────────────
// Retourne TOUS les tickers scorés (sans filtre de score) dont nextEarningsDate est
// dans [from, to]. Utilisé par l'agent SEO (vault/projects/li-seo/scripts/signals.py)
// pour détecter les réactions earnings sur l'univers entier, pas seulement le top noté.
// /top filtre par scoreRatio desc + cap 500 → rate FDX/CCL/MU/KMX/JBL/NKE qui ont des
// scores bas mais des earnings impactants (= contenu trafic frais).
// Lecture publique, max 1000 lignes, sans cap = on relit ce qui est déjà servi par /top.
screenerRouter.get('/earnings', asyncHandler(async (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = String(req.query.from ?? today);
  const to = String(req.query.to ?? today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    res.status(400).json({ error: 'Format attendu: from=YYYY-MM-DD&to=YYYY-MM-DD' });
    return;
  }
  const rows = await prisma.screenerTicker.findMany({
    where: { status: 'scored', nextEarningsDate: { gte: from, lte: to } },
    orderBy: [{ nextEarningsDate: 'asc' }, { scoreRatio: 'desc' }],
    take: 1000,
    select: {
      ticker: true, name: true, sector: true,
      scoreChiffres: true, scoreChiffresMax: true,
      pfcfTTM: true, currency: true, price: true,
      nextEarningsDate: true, opportunity: true,
    },
  });
  res.json(rows);
}));

// ── GET /stats ──────────────────────────────────────────────────────────────
screenerRouter.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  // Compteur public (couverture affichée sur le screener) : cache navigateur/CDN 15 min,
  // aligné sur le mémo serveur. Les compteurs bougent de quelques unités par jour.
  res.setHeader('Cache-Control', 'public, max-age=900');
  res.json(await getStats());
}));

// ── GET /search?q=app ─────────────────────────────────────────────────────────
// Autocomplétion (sélecteur de comparaison) : titres scorés dont le ticker ou le nom
// matche. Priorité au ticker exact/préfixe, puis aux mieux notés.
screenerRouter.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 1) { res.json([] as TickerSuggestion[]); return; }
  const rows = await prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      OR: [
        { ticker: { startsWith: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ scoreRatio: 'desc' }],
    take: 8,
    select: { ticker: true, name: true, sector: true, scoreChiffres: true, scoreChiffresMax: true },
  });
  // Remonte les préfixes exacts de ticker en tête (UX recherche).
  const qu = q.toUpperCase();
  rows.sort((a, b) => Number(b.ticker.startsWith(qu)) - Number(a.ticker.startsWith(qu)));
  res.json(rows as TickerSuggestion[]);
}));

// ── GET /showcase ─────────────────────────────────────────────────────────────
// Vitrine de la landing : LE titre mis en avant du moment (meilleure opportunité), avec le
// détail de ses 10 critères et son grade de résilience, pour montrer la vraie fiche produit
// dès le hero. Volontairement limité à UN ticker choisi par le serveur : le détail par
// critère d'un ticker ARBITRAIRE reste derrière l'inscription (cf. /ticker/:ticker).
// Résultat mémoïsé 10 min (une page d'accueil ne doit pas taper la DB à chaque visite).
interface ShowcaseCache { at: number; lang: Lang; payload: unknown }
let showcaseCache: ShowcaseCache | null = null;
const SHOWCASE_TTL_MS = 10 * 60 * 1000;

/**
 * Titres de la vitrine, DANS L'ORDRE des emplacements de la landing : le premier alimente la
 * fiche du hero, le deuxième la maquette du « Mécanisme », le troisième la démo du connecteur.
 *
 * Trois sociétés DIFFÉRENTES : voir le même titre partout donnait l'impression d'un catalogue
 * d'un seul nom. On privilégie donc des noms que le grand public suit en bourse, tout en
 * exigeant des données complètes (cf. isShowcaseEligible) : sans percentile de P/FCF la jauge
 * de valorisation disparaît, et sans résilience publiée il manque un des deux scores.
 */
const SHOWCASE_TICKERS = [
  'V', 'NFLX', 'BKNG', 'SPGI', 'MCO', 'CME', 'CRM', 'MA', 'ADBE', 'INTU', 'UBER', 'ADSK',
  'ASML.AS', 'MSFT', 'GOOGL', 'NVDA', 'SAP', 'MC.PA', 'RMS.PA', 'NVO', 'NKE',
];
/** Combien d'emplacements la landing sait remplir. */
const SHOWCASE_COUNT = 3;
/** Seuils de la vitrine : au moins 8/10 de qualité ET une résilience publiée A ou B. */
const SHOWCASE_MIN_NOTE10 = 8;
const SHOWCASE_GRADES = new Set(['A', 'B']);
/**
 * P/FCF au-delà duquel on n'affiche pas le titre en vitrine : soit la donnée est fausse
 * (TSMC ressort à 2,2x, ce qui impliquerait 980 Md$ de free cash-flow), soit le multiple est si
 * extrême qu'il brouille la démonstration au lieu de l'éclairer.
 */
const SHOWCASE_PFCF_RANGE = { min: 3, max: 60 };

const SHOWCASE_SELECT = {
  ticker: true, name: true, sector: true,
  scoreChiffres: true, scoreChiffresMax: true,
  pfcfTTM: true, price: true, currency: true, opportunity: true, marketCap: true,
  // Capitalisation NORMALISÉE : c'est la seule comparable entre bourses (cf. marketTiers.ts).
  marketCapUsd: true,
  pfcfPercentile: true,
} as const;

/**
 * Forme EXACTE d'une ligne de vitrine, alignée sur SHOWCASE_SELECT. Auparavant ce type était
 * calqué sur le retour de getTop(), qui contient davantage de champs : il fallait alors des
 * conversions forcées, et le compilateur ne vérifiait plus rien.
 */
interface ShowcaseRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  price: number | null;
  currency: string | null;
  opportunity: boolean;
  marketCap: number | null;
  marketCapUsd: number | null;
  pfcfPercentile: number | null;
}

/** Note ramenée sur 10 (le score brut est sur un dénominateur variable). */
function note10Of(row: { scoreChiffres: number | null; scoreChiffresMax: number | null }): number {
  const max = row.scoreChiffresMax ?? 0;
  return row.scoreChiffres != null && max > 0 ? Math.round((row.scoreChiffres / max) * 10) : 0;
}

/**
 * Titre de la vitrine : au moins 8/10, résilience publiée A ou B, et si possible un nom
 * que tout le monde reconnaît. On tente d'abord la liste éditoriale, puis les plus grosses
 * capitalisations bien notées ; à défaut de résilience publiée, la meilleure note l'emporte.
 */
/**
 * Un titre est présentable en vitrine s'il a TOUT ce que la landing affiche : les deux scores,
 * les dix critères et une jauge de valorisation.
 *
 * `strictGrade` distingue les deux usages. La fiche du HERO exige une résilience A ou B : c'est
 * la première chose que voit un visiteur, elle doit montrer le produit à son meilleur. Les autres
 * emplacements se contentent d'une résilience PUBLIÉE, quelle qu'elle soit, ce qui laisse entrer
 * des noms que le public suit vraiment (Netflix, Booking) au lieu de n'afficher que des A.
 */
function isShowcaseEligible(row: ShowcaseRow, grade: string | undefined, strictGrade: boolean): boolean {
  if (note10Of(row) < SHOWCASE_MIN_NOTE10) return false;
  if (strictGrade ? !SHOWCASE_GRADES.has(grade ?? '') : !grade) return false;
  if (row.pfcfPercentile == null) return false;        // sans percentile, pas de jauge
  const pfcf = row.pfcfTTM;
  return pfcf != null && pfcf > SHOWCASE_PFCF_RANGE.min && pfcf < SHOWCASE_PFCF_RANGE.max;
}

/**
 * Les N titres de la vitrine, distincts, dans l'ordre éditorial. Chacun doit être reconnaissable
 * ET complet : la landing montre deux scores, dix critères et une jauge de valorisation, donc un
 * titre à qui il manque une de ces pièces afficherait un trou.
 *
 * Repli en cascade : d'abord les noms de la liste éditoriale, puis les grosses capitalisations
 * bien notées, puis — si vraiment rien ne passe les seuils — la meilleure opportunité du moment,
 * quitte à ce qu'il lui manque la résilience.
 */
async function pickShowcaseRows(count: number): Promise<ShowcaseRow[]> {
  const preferred = await prisma.screenerTicker.findMany({
    where: { ticker: { in: SHOWCASE_TICKERS }, status: 'scored' },
    select: SHOWCASE_SELECT,
  });
  // Grosses capitalisations bien notées : elles sont connues du grand public.
  const bigCaps = await prisma.screenerTicker.findMany({
    where: { status: 'scored', scoreChiffresMax: { gte: 8 }, marketCapUsd: { gte: 20_000_000_000 } },
    orderBy: [{ marketCapUsd: 'desc' }],
    take: 120,
    select: SHOWCASE_SELECT,
  });

  const seen = new Set<string>();
  const candidates = [...preferred, ...bigCaps].filter(r => {
    if (seen.has(r.ticker)) return false;
    seen.add(r.ticker);
    return true;
  });

  const resiliences = await getPublishedResilienceSummaries(candidates.map(r => r.ticker));
  const rank = (t: string) => {
    const i = SHOWCASE_TICKERS.indexOf(t);
    return i < 0 ? SHOWCASE_TICKERS.length : i;
  };
  const byEditorialOrder = (a: ShowcaseRow, b: ShowcaseRow) =>
    rank(a.ticker) - rank(b.ticker)
    || (resiliences.get(b.ticker)?.score ?? 0) - (resiliences.get(a.ticker)?.score ?? 0)
    || Number(b.marketCapUsd ?? 0) - Number(a.marketCapUsd ?? 0);

  // Une même société cotée deux fois (GOOG/GOOGL, BRK.A/BRK.B) ferait doublon à l'écran.
  const dedupeByCompany = (rows: ShowcaseRow[]) => {
    const byName = new Set<string>();
    return rows.filter(r => {
      const key = (r.name ?? r.ticker).toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
      if (byName.has(key)) return false;
      byName.add(key);
      return true;
    });
  };

  // Emplacement 1 (le hero) : exigence maximale sur la résilience.
  const hero = dedupeByCompany(
    candidates.filter(r => isShowcaseEligible(r, resiliences.get(r.ticker)?.grade, true)).sort(byEditorialOrder),
  )[0];
  // Emplacements suivants : toute résilience publiée, pour laisser entrer les noms suivis.
  const rest = dedupeByCompany(
    candidates
      .filter(r => r.ticker !== hero?.ticker)
      .filter(r => isShowcaseEligible(r, resiliences.get(r.ticker)?.grade, false))
      .sort(byEditorialOrder),
  );
  const distinct = dedupeByCompany([...(hero ? [hero] : []), ...rest]);
  if (distinct.length >= count) return distinct.slice(0, count);

  // Pas assez de titres complets : on complète avec les mieux notés, puis les opportunités.
  const filler = candidates
    .filter(r => !distinct.some(d => d.ticker === r.ticker) && note10Of(r) >= SHOWCASE_MIN_NOTE10)
    .sort((a, b) => note10Of(b) - note10Of(a) || Number(b.marketCapUsd ?? 0) - Number(a.marketCapUsd ?? 0));
  const out = [...distinct, ...filler].slice(0, count);
  if (out.length) return out;

  // Dernier recours : les opportunités du moment, ramenées à la forme de la vitrine.
  await refreshOpportunitiesLive().catch(() => {});
  const top = await getTop({ onlyOpportunities: true, minMax: 8, limit: count + 4 });
  return top.slice(0, count).map(r => ({
    ticker: r.ticker, name: r.name, sector: r.sector,
    scoreChiffres: r.scoreChiffres, scoreChiffresMax: r.scoreChiffresMax,
    pfcfTTM: r.pfcfTTM, price: r.price, currency: r.currency, opportunity: r.opportunity,
    marketCap: r.marketCap, marketCapUsd: null, pfcfPercentile: r.pfcfPercentile,
  }));
}

screenerRouter.get('/showcase', asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.header('accept-language'));
  if (showcaseCache && showcaseCache.lang === lang && Date.now() - showcaseCache.at < SHOWCASE_TTL_MS) {
    res.json(showcaseCache.payload); return;
  }

  // Choix ÉDITORIAL : des sociétés que tout le monde reconnaît, sinon la vitrine perd son effet
  // (un inconnu bien noté ne parle à personne). Une par emplacement de la landing.
  const rows = await pickShowcaseRows(SHOWCASE_COUNT);
  if (!rows.length) { res.status(404).json({ error: 'Aucune opportunité disponible', code: 'NOT_FOUND' }); return; }

  const [resiliences, resilienceStars] = await Promise.all([
    getPublishedResilienceSummaries(rows.map(r => r.ticker)),
    getResilienceStars(rows.map(r => r.ticker)),
  ]);
  const payload = await Promise.all(rows.map(async row => {
    const snapshot = await getCachedSnapshot(row.ticker).catch(() => null);
    const criteria = snapshot
      ? buildQuantitativeCriteria(snapshot.metrics, lang).map(c => ({
          key: c.key ?? null, name: c.nom, value: c.valeur, status: c.statut,
        }))
      : [];
    return {
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      scoreChiffres: row.scoreChiffres,
      scoreChiffresMax: row.scoreChiffresMax,
      pfcfTTM: row.pfcfTTM,
      // Position du P/FCF dans son propre historique (0 = jamais aussi bon marché).
      pfcfPercentile: row.pfcfPercentile,
      price: row.price,
      currency: row.currency,
      opportunity: row.opportunity,
      resilience: resiliences.get(row.ticker) ?? null,
      resilienceStars: resilienceStars.get(row.ticker) ?? null,
      criteria,
    };
  }));
  showcaseCache = { at: Date.now(), lang, payload };
  res.json(payload);
}));

// ── GET /logo/:ticker ─────────────────────────────────────────────────────────
// Logo officiel d'une société, servi par REDIRECTION (302) vers l'image d'origine.
//
// Deux sources, parce qu'aucune ne couvre l'univers entier :
//   1. US            → Finnhub /stock/profile2 expose un champ `logo` (notre clé existante).
//                      L'API répond 403 sur les symboles suffixés (.AS, .PA, .T) : inutilisable
//                      hors US, d'où la seconde source.
//   2. reste du monde → le DOMAINE officiel vient de Yahoo `assetProfile.website` (déjà
//                      récupéré pour le secteur, donc aucune requête de plus), puis on
//                      demande l'icône du domaine.
//
// La résolution est mémoïsée 24 h en RAM, y compris les échecs : un titre sans logo ne doit
// pas retaper les deux fournisseurs à chaque visite. Le front dégrade tout seul sur les
// initiales du ticker quand on répond 404 (cf. <CompanyLogo>).
interface LogoCacheEntry { at: number; url: string | null }
const logoCache = new Map<string, LogoCacheEntry>();
const LOGO_TTL_MS = 24 * 60 * 60 * 1000;

/** Icône officielle d'un domaine. Service public, sans clé, taille suffisante pour une pastille. */
function iconOfWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
    return host.includes('.') ? `https://icons.duckduckgo.com/ip3/${host}.ico` : null;
  } catch { return null; }
}

/**
 * Le point d'un ticker ne signale pas toujours une bourse étrangère : `BRK.B` et `BF.B` sont des
 * CLASSES D'ACTIONS américaines, que Finnhub sert très bien. Les suffixes de place font en général
 * deux lettres (.AS, .PA, .TW, .KS…), mais DEUX tiennent en une : Tokyo (.T) et Londres (.L), qui
 * pèsent à elles seules 3 120 titres de l'univers. Relevé en base le 03/08/2026 : toutes les autres
 * terminaisons d'une lettre (.A, .B, .C, .U, .V, .X, .Y, .Z) sont des classes d'actions US.
 *
 * Se tromper ne coûte qu'un appel inutile : le repli Yahoo suit derrière.
 */
const SINGLE_LETTER_EXCHANGES = new Set(['T', 'L']);

function looksForeign(ticker: string): boolean {
  const i = ticker.lastIndexOf('.');
  if (i < 0) return false;
  const suffix = ticker.slice(i + 1).toUpperCase();
  return suffix.length > 1 || SINGLE_LETTER_EXCHANGES.has(suffix);
}

async function resolveLogo(ticker: string): Promise<string | null> {
  // Titre US (y compris les classes d'actions type BRK.B) : Finnhub donne le logo directement.
  if (!looksForeign(ticker)) {
    const p = await getProfile2(ticker).catch(() => null);
    if (p?.logo) return p.logo;
    const fromWeb = iconOfWebsite(p?.weburl ?? null);
    if (fromWeb) return fromWeb;
  }
  // Reste du monde (et repli des titres US sans logo Finnhub) : le domaine officiel via Yahoo.
  const profile = await getAssetProfileYahoo(ticker).catch(() => null);
  return iconOfWebsite(profile?.website ?? null);
}

screenerRouter.get('/logo/:ticker', asyncHandler(async (req: Request, res: Response) => {
  const ticker = String(req.params.ticker ?? '').trim().toUpperCase().slice(0, 16);
  if (!/^[A-Z0-9.\-]+$/.test(ticker)) { res.status(400).json({ error: 'Ticker invalide' }); return; }

  const cached = logoCache.get(ticker);
  const url = cached && Date.now() - cached.at < LOGO_TTL_MS
    ? cached.url
    : await resolveLogo(ticker).catch(() => null);
  if (!cached || Date.now() - cached.at >= LOGO_TTL_MS) logoCache.set(ticker, { at: Date.now(), url });

  if (!url) {
    // Le front affiche les initiales : on le laisse mettre en cache le « pas de logo ».
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(404).json({ error: 'Aucun logo connu', code: 'NOT_FOUND' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.redirect(302, url);
}));

// ── GET /ticker/:ticker ───────────────────────────────────────────────────────
// Aperçu PUBLIC d'un ticker scoré (sans auth) : exactement les données déjà servies aux
// bots par le pré-rendu (note /10, P/FCF, secteur, prix, opportunité). Sert à montrer le
// socle de valeur à un visiteur ANONYME sur /analyse/:ticker sans le rediriger vers /signup
// (évite le cloaking : bot et humain voient le même socle déjà public). Le détail des 10
// critères, la valorisation et le qualitatif restent derrière l'inscription/Pro.
screenerRouter.get('/ticker/:ticker', asyncHandler(async (req: Request, res: Response) => {
  const ticker = String(req.params.ticker ?? '').trim().toUpperCase().slice(0, 16);
  if (!ticker) { res.status(400).json({ error: 'Ticker manquant' }); return; }
  const row = await prisma.screenerTicker.findFirst({
    where: { ticker, status: 'scored' },
    select: {
      ticker: true, name: true, sector: true,
      scoreChiffres: true, scoreChiffresMax: true,
      pfcfTTM: true, price: true, currency: true, opportunity: true,
    },
  });
  if (!row) { res.status(404).json({ error: 'Ticker non couvert ou non scoré', code: 'NOT_FOUND' }); return; }
  const [resiliences, resilienceStars] = await Promise.all([
    getPublishedResilienceSummaries([ticker]),
    getResilienceStars([ticker]),
  ]);
  res.json({ ...row, resilience: resiliences.get(ticker) ?? null, resilienceStars: resilienceStars.get(ticker) ?? null });
}));
