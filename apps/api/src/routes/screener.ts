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
  const result = await tick(n, deadlineMs, region, { warm });
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

/** Noms grand public éligibles à la vitrine, par ordre de préférence. */
const SHOWCASE_TICKERS = ['ASML.AS', 'ADBE', 'MC.PA', 'GOOGL', 'MSFT', 'RMS.PA'];

type ShowcaseRow = Awaited<ReturnType<typeof getTop>>[number];

/** Première société reconnaissable réellement scorée, sinon la meilleure opportunité du jour. */
async function pickShowcaseRow(): Promise<ShowcaseRow | undefined> {
  const rows = await prisma.screenerTicker.findMany({
    where: { ticker: { in: SHOWCASE_TICKERS }, status: 'scored' },
    select: {
      ticker: true, name: true, sector: true,
      scoreChiffres: true, scoreChiffresMax: true,
      pfcfTTM: true, price: true, currency: true, opportunity: true,
    },
  });
  for (const wanted of SHOWCASE_TICKERS) {
    const row = rows.find(r => r.ticker === wanted);
    if (row) return row as ShowcaseRow;
  }
  // Repli : `getTop` post-filtre son lot, donc on demande plusieurs lignes pour en garder une.
  await refreshOpportunitiesLive().catch(() => {});
  const [fallback] = await getTop({ onlyOpportunities: true, minMax: 8, limit: 5 });
  return fallback;
}

screenerRouter.get('/showcase', asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.header('accept-language'));
  if (showcaseCache && showcaseCache.lang === lang && Date.now() - showcaseCache.at < SHOWCASE_TTL_MS) {
    res.json(showcaseCache.payload); return;
  }

  // Choix ÉDITORIAL du titre mis en avant : une société que tout le monde reconnaît, sinon
  // la vitrine perd son effet (un inconnu bien noté ne parle à personne). On prend le premier
  // nom de la liste réellement scoré, et à défaut la meilleure opportunité du moment.
  const top = await pickShowcaseRow();
  if (!top) { res.status(404).json({ error: 'Aucune opportunité disponible', code: 'NOT_FOUND' }); return; }

  const snapshot = await getCachedSnapshot(top.ticker).catch(() => null);
  const resiliences = await getPublishedResilienceSummaries([top.ticker]);
  const criteria = snapshot
    ? buildQuantitativeCriteria(snapshot.metrics, lang).map(c => ({
        key: c.key ?? null, name: c.nom, value: c.valeur, status: c.statut,
      }))
    : [];

  const payload = {
    ticker: top.ticker,
    name: top.name,
    sector: top.sector,
    scoreChiffres: top.scoreChiffres,
    scoreChiffresMax: top.scoreChiffresMax,
    pfcfTTM: top.pfcfTTM,
    price: top.price,
    currency: top.currency,
    opportunity: top.opportunity,
    resilience: resiliences.get(top.ticker) ?? null,
    criteria,
  };
  showcaseCache = { at: Date.now(), lang, payload };
  res.json(payload);
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
  const resiliences = await getPublishedResilienceSummaries([ticker]);
  res.json({ ...row, resilience: resiliences.get(ticker) ?? null });
}));
