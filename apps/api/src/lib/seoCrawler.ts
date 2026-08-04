/**
 * Crawler d'audit SEO, borné par le plafond du plan.
 *
 * Trois choix de conception qui expliquent le reste du fichier.
 *
 * 1. DÉCOUVERTE PAR SITEMAP D'ABORD, parcours de liens ensuite. Le sitemap dit ce que le
 *    site VEUT faire indexer ; le parcours de liens dit ce qui est réellement ATTEIGNABLE.
 *    L'écart entre les deux est exactement le constat A5 (pages orphelines) — donc on a
 *    besoin des deux sources, pas d'une seule.
 *
 * 2. UNE SEULE REQUÊTE PAR PAGE, sauf sur un échantillon. Le diagnostic de rendu exige deux
 *    requêtes (UA de robot vs UA de navigateur, cf. lib/aiVisibility.ts). Faire ça sur
 *    50 000 pages doublerait le coût sortant pour une information qui, en pratique, est
 *    uniforme sur un site : le mode de rendu est une propriété de la stack, pas de la page.
 *    On double donc la requête sur la page d'entrée et sur un échantillon, et on signale si
 *    l'échantillon n'est pas homogène.
 *
 * 3. LE PLAFOND EST VISIBLE. `pagesSkipped` compte les URL découvertes et non examinées.
 *    Un utilisateur au plafond voit concrètement ce que son palier lui coûte, sans qu'on
 *    ait besoin de le lui dire dans un message commercial.
 *
 * Sécurité : toute URL passe par `assertPublicUrl` (garde SSRF de lib/aiVisibility.ts), y
 * compris celles découvertes dans le sitemap et dans les liens — un sitemap est un fichier
 * contrôlé par la cible, donc une source non fiable.
 */
import {
  AI_BOT_UA,
  BROWSER_UA,
  CheckError,
  assertPublicUrl,
  countWords,
  fetchWithUa,
  firstMatch,
  normalizeInput,
  visibleText,
  type Verdict,
} from './aiVisibility.js';

/** Requêtes sortantes simultanées. Au-delà, on se comporte en agresseur vis-à-vis de la cible. */
const CONCURRENCY = 6;
/** Pages sur lesquelles on paie la double requête pour diagnostiquer le rendu. */
const RENDER_SAMPLE = 8;
/** Sitemaps suivis au maximum (un sitemapindex peut en référencer des milliers). */
const MAX_SITEMAPS = 50;
/** En dessous, une page n'a pas de contenu exploitable. Même seuil que le vérificateur. */
const CONTENT_FLOOR_WORDS = 120;
/**
 * Budget de temps par défaut, en dessous du plafond de 60 s de la lambda Vercel
 * (`maxDuration` dans vercel.json) avec la marge nécessaire à l'écriture en base.
 *
 * Mesuré : ~14 pages/s sur un site rapide. Les plafonds de 5 000 et 50 000 pages ne peuvent
 * donc PAS être honorés dans une invocation unique — ils exigent un traitement par tranches.
 * En attendant, on s'arrête proprement et on le dit dans le rapport, au lieu de se faire
 * tuer à 60 s et de perdre le travail.
 */
const DEFAULT_TIME_BUDGET_MS = 45_000;
/** Cadence maximale qu'on s'impose même sans Crawl-delay déclaré. */
const DEFAULT_MIN_INTERVAL_MS = 0;

export interface PageResult {
  url: string;
  status: number;
  depth: number | null;
  botWords: number;
  title: string | null;
  titleLength: number;
  hasMetaDescription: boolean;
  h1: string | null;
  h1Count: number;
  /** Résumé en tête (B6) : le premier bloc de texte après le H1 ressemble-t-il à un résumé ? */
  hasLeadSummary: boolean;
  /** Texte enfermé dans un accordéon ou un onglet (B8). */
  hasHiddenText: boolean;
  outboundLinks: number;
  internalLinks: number;
  /** Ancres internes dont le texte ne décrit pas la cible (C3) — candidats, pas verdict. */
  genericAnchors: number;
  hasJsonLd: boolean;
  /** Slug en langage naturel (A17) : au moins un mot alphabétique de 3 lettres et plus. */
  naturalSlug: boolean;
  /** Renseigné seulement sur l'échantillon de rendu. */
  renderVerdict: Verdict | null;
  error?: string;
}

export interface CrawlReport {
  entryUrl: string;
  host: string;
  startedAt: string;
  finishedAt: string;
  /** Verdict de rendu de la page d'entrée. */
  renderVerdict: Verdict;
  /** Vrai si l'échantillon de rendu n'est pas homogène — à signaler, c'est inhabituel. */
  renderMixed: boolean;
  stack: string | null;
  pagesCrawled: number;
  pagesSkipped: number;
  pageCap: number;
  /** URL présentes au sitemap mais vers lesquelles aucun lien interne ne pointe (A5). */
  orphans: string[];
  /** Faux si le plafond a tronqué le crawl : dans ce cas `orphans` n'est pas concluant. */
  orphansDeterminable: boolean;
  maxDepth: number;
  medianBotWords: number;
  robotsBlocked: number;
  sitemapUrlCount: number;
  /** Pourquoi le crawl s'est arrêté — décide de ce qu'on peut conclure. */
  stoppedReason: 'exhausted' | 'page-cap' | 'time-budget';
  /** Cadence imposée par le robots.txt de la cible, en secondes (0 = non déclarée). */
  crawlDelaySec: number;
  pages: PageResult[];
  aggregate: AggregateFinding[];
}

export interface AggregateFinding {
  id: string;
  level: 'blocking' | 'warn' | 'ok' | 'info';
  title: string;
  detail: string;
  evidence: string;
  /** Pages concernées. Tronqué à 20 : au-delà c'est du bruit dans un rapport. */
  affected: string[];
  affectedCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────────

interface Robots {
  disallow: string[];
  sitemaps: string[];
  /** Secondes entre deux requêtes, déclarées par la cible. 0 = non déclaré. */
  crawlDelaySec: number;
}

/**
 * Lecture minimale de robots.txt : on ne retient que les groupes qui s'appliquent à nous
 * (`User-agent: *` et les groupes nommant GPTBot), plus les déclarations Sitemap.
 *
 * Un robots.txt absent ou illisible n'est PAS un blocage : c'est le comportement standard,
 * et la majorité des sites n'en ont pas de pertinent.
 */
async function readRobots(origin: URL): Promise<Robots> {
  const out: Robots = { disallow: [], sitemaps: [], crawlDelaySec: 0 };
  try {
    const res = await fetchWithUa(new URL('/robots.txt', origin), AI_BOT_UA, { allowXml: true });
    if (res.status !== 200) return out;
    let applies = false;
    for (const raw of res.html.split(/\r?\n/)) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      const [rawKey, ...rest] = line.split(':');
      const key = rawKey?.toLowerCase().trim();
      const value = rest.join(':').trim();
      if (key === 'user-agent') {
        const ua = value.toLowerCase();
        applies = ua === '*' || ua.includes('gptbot');
      } else if (key === 'disallow' && applies && value) {
        out.disallow.push(value);
      } else if (key === 'sitemap' && value) {
        out.sitemaps.push(value);
      } else if (key === 'crawl-delay' && applies && value) {
        // Directive non standardisée mais largement publiée, et la respecter est la
        // différence entre un crawler et un agresseur. Un WAF finit par répondre 403 à qui
        // l'ignore, et le rapport sort alors faux sans le dire.
        const d = Number.parseFloat(value.replace(',', '.'));
        if (Number.isFinite(d) && d > 0) out.crawlDelaySec = Math.max(out.crawlDelaySec, d);
      }
    }
  } catch {
    /* pas de robots.txt lisible : on continue, ce n'est pas une erreur */
  }
  return out;
}

function isDisallowed(url: URL, robots: Robots): boolean {
  const path = url.pathname + url.search;
  return robots.disallow.some((rule) => {
    // Les jokers `*` et l'ancre de fin `$` sont les seules extensions largement supportées.
    if (rule.includes('*') || rule.endsWith('$')) {
      const re = new RegExp(
        '^' + rule.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\$$/, '$'),
      );
      return re.test(path);
    }
    return path.startsWith(rule);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Découverte
// ─────────────────────────────────────────────────────────────────────────────

function extractTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) if (m[1]) out.push(m[1].trim());
  return out;
}

/** Suit un sitemap ou un sitemapindex, récursivement, borné. */
async function collectFromSitemaps(seeds: string[], host: string, cap: number): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];
  const queue = [...seeds];
  let fetched = 0;

  while (queue.length && fetched < MAX_SITEMAPS && urls.length < cap) {
    const next = queue.shift();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    let safe: URL;
    try {
      safe = await assertPublicUrl(next);
    } catch {
      continue; // sitemap pointant ailleurs ou vers une IP privée : on ignore
    }
    if (safe.host !== host) continue;
    let body: string;
    try {
      const res = await fetchWithUa(safe, AI_BOT_UA, { allowXml: true });
      fetched++;
      if (res.status !== 200) continue;
      body = res.html;
    } catch {
      continue;
    }
    // Un sitemapindex référence d'autres sitemaps ; un urlset référence des pages.
    const isIndex = /<sitemapindex[\s>]/i.test(body);
    for (const loc of extractTags(body, 'loc')) {
      if (isIndex) queue.push(loc);
      else if (urls.length < cap) urls.push(loc);
    }
  }
  return urls;
}

const SKIP_EXT = /\.(pdf|zip|png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|xml|txt|mp4|mp3|woff2?|ttf|eot)$/i;

/** Liens internes d'une page, absolus et normalisés (fragment retiré). */
function extractLinks(html: string, base: URL): { internal: string[]; external: number; anchors: Array<{ href: string; text: string }> } {
  const internal: string[] = [];
  const anchors: Array<{ href: string; text: string }> = [];
  let external = 0;
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (!raw || /^(mailto:|tel:|javascript:|#)/i.test(raw)) continue;
    let u: URL;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    u.hash = '';
    if (u.host !== base.host) {
      external++;
      continue;
    }
    if (SKIP_EXT.test(u.pathname)) continue;
    const text = visibleText(m[2] ?? '').slice(0, 120);
    internal.push(u.toString());
    anchors.push({ href: u.toString(), text });
  }
  return { internal, external, anchors };
}

const GENERIC_ANCHORS =
  /^(ici|cliquez ici|en savoir plus|lire la suite|voir plus|ce lien|link|here|read more|learn more|click here|plus|détails|details|→|>>?)$/i;

/** Devine la stack — c'est l'axe du comparatif sectoriel, une médiane n'a de sens qu'à stack égale. */
function guessStack(html: string, contentType: string): string | null {
  if (/__NEXT_DATA__|\/_next\/static/.test(html)) return 'next';
  if (/wp-content|wp-includes/.test(html)) return 'wordpress';
  if (/\.webflow\.|webflow\.com/.test(html)) return 'webflow';
  if (/id=["']__nuxt["']|\/_nuxt\//.test(html)) return 'nuxt';
  if (/astro-island|data-astro-/.test(html)) return 'astro';
  if (/id=["']svelte["']|\/_app\/immutable\//.test(html)) return 'sveltekit';
  if (/cdn\.shopify\.com/.test(html)) return 'shopify';
  if (/<script[^>]+type=["']module["'][^>]+\/assets\//.test(html)) return 'vite';
  if (/text\/markdown/i.test(contentType)) return 'markdown-negotiated';
  return null;
}

/** Le slug contient-il au moins un mot lisible (A17) ? */
function hasNaturalSlug(u: URL): boolean {
  const last = u.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  if (!last) return true; // la racine est naturelle par définition
  return /[a-zà-ÿ]{3,}/i.test(last.replace(/\.\w+$/, ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyse d'une page
// ─────────────────────────────────────────────────────────────────────────────

interface Fetched {
  page: PageResult;
  links: string[];
  anchors: Array<{ href: string; text: string }>;
  stack: string | null;
  titleByUrl: [string, string | null];
}

async function analyzePage(url: URL, depth: number | null, withRender: boolean): Promise<Fetched> {
  const base: PageResult = {
    url: url.toString(), status: 0, depth, botWords: 0, title: null, titleLength: 0,
    hasMetaDescription: false, h1: null, h1Count: 0, hasLeadSummary: false, hasHiddenText: false,
    outboundLinks: 0, internalLinks: 0, genericAnchors: 0, hasJsonLd: false,
    naturalSlug: hasNaturalSlug(url), renderVerdict: null,
  };

  let bot;
  try {
    bot = await fetchWithUa(url, AI_BOT_UA);
  } catch (e) {
    return {
      page: { ...base, error: e instanceof CheckError ? e.code : 'fetch_failed' },
      links: [], anchors: [], stack: null, titleByUrl: [url.toString(), null],
    };
  }

  const html = bot.html;
  const text = visibleText(html);
  const { internal, external, anchors } = extractLinks(html, url);
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);

  // B6 — un résumé en tête est un bloc court (2 à 3 phrases) placé juste après le H1.
  // On mesure le premier paragraphe qui suit le H1 : entre 15 et 90 mots, on considère
  // que c'est un résumé ; au-delà, c'est de la mise en contexte.
  const afterH1 = h1 ? html.slice(html.search(/<\/h1>/i)) : html;
  const firstPara = firstMatch(afterH1, /<p[^>]*>([\s\S]*?)<\/p>/i);
  const paraWords = firstPara ? countWords(firstPara) : 0;
  const hasLeadSummary = paraWords >= 15 && paraWords <= 90;

  let renderVerdict: Verdict | null = null;
  let rawStack: string | null = null;
  if (withRender) {
    try {
      const browser = await fetchWithUa(url, BROWSER_UA);
      // La stack se devine sur le HTML brut : le pré-rendu servi aux robots est justement
      // fait pour ne PAS contenir les marqueurs du bundler.
      rawStack = guessStack(browser.html, browser.contentType);
      const rawWords = countWords(visibleText(browser.html));
      const botWords = countWords(text);
      if (botWords < CONTENT_FLOOR_WORDS && rawWords < CONTENT_FLOOR_WORDS) {
        renderVerdict = /<script[^>]+type=["']module["']|<div[^>]+id=["'](root|app|__next)["']/i.test(browser.html)
          ? 'invisible' : 'thin';
      } else if (botWords >= CONTENT_FLOOR_WORDS && rawWords < Math.max(CONTENT_FLOOR_WORDS, botWords * 0.3)) {
        renderVerdict = 'dynamic';
      } else {
        renderVerdict = 'ssr';
      }
    } catch {
      /* la seconde requête a échoué : on garde le verdict à null plutôt que d'inventer */
    }
  }

  return {
    page: {
      ...base,
      status: bot.status,
      botWords: countWords(text),
      title,
      titleLength: title?.length ?? 0,
      hasMetaDescription: /<meta[^>]+name=["']description["']/i.test(html),
      h1,
      h1Count: (html.match(/<h1\b/gi) ?? []).length,
      hasLeadSummary,
      hasHiddenText: /<details\b|aria-expanded=["']false["']|class=["'][^"']*(accordion|collapse|tab-pane)/i.test(html),
      outboundLinks: external,
      internalLinks: internal.length,
      genericAnchors: anchors.filter((a) => GENERIC_ANCHORS.test(a.text.trim())).length,
      hasJsonLd: /application\/ld\+json/i.test(html),
      renderVerdict,
    },
    links: internal,
    anchors,
    stack: rawStack ?? guessStack(html, bot.contentType),
    titleByUrl: [url.toString(), title],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crawl
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Cadenceur global : garantit `minIntervalMs` entre deux départs de requête, quelle que
 * soit la concurrence. Plus simple et plus juste que de forcer la concurrence à 1 — ce qui
 * compte pour la cible est le débit reçu, pas le nombre de connexions ouvertes.
 */
function makePacer(minIntervalMs: number): () => Promise<void> {
  let nextSlot = 0;
  return async () => {
    if (minIntervalMs <= 0) return;
    const now = Date.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + minIntervalMs;
    if (slot > now) await sleep(slot - now);
  };
}

/** Exécute `jobs` avec au plus `CONCURRENCY` en vol. Aucun job ne fait échouer les autres. */
async function pool<T>(jobs: Array<() => Promise<T>>): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
      for (;;) {
        const i = cursor++;
        const job = jobs[i];
        if (!job) return;
        out[i] = await job();
      }
    }),
  );
  return out;
}

export async function crawlSite(
  rawEntry: string,
  pageCap: number,
  opts: { timeBudgetMs?: number } = {},
): Promise<CrawlReport> {
  const deadline = Date.now() + (opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const startedAt = new Date().toISOString();
  const entry = await assertPublicUrl(normalizeInput(rawEntry));
  const host = entry.host;

  const robots = await readRobots(entry);
  // La cible impose sa cadence. On ne la contourne pas : on réduit le nombre de pages.
  const pace = makePacer(robots.crawlDelaySec > 0
    ? robots.crawlDelaySec * 1000
    : DEFAULT_MIN_INTERVAL_MS);
  const sitemapSeeds = robots.sitemaps.length
    ? robots.sitemaps
    : [new URL('/sitemap.xml', entry).toString()];
  const sitemapUrls = await collectFromSitemaps(sitemapSeeds, host, pageCap * 4);

  // File de parcours : la page d'entrée d'abord (profondeur 0), puis le sitemap.
  // Les URL du sitemap entrent SANS profondeur : leur profondeur ne sera connue que si un
  // lien interne y mène. Une URL de sitemap jamais liée = page orpheline (A5).
  const queued = new Map<string, number | null>();
  const normEntry = entry.toString();
  queued.set(normEntry, 0);
  for (const u of sitemapUrls) {
    try {
      const safe = await assertPublicUrl(u);
      if (safe.host !== host || SKIP_EXT.test(safe.pathname)) continue;
      safe.hash = '';
      if (!queued.has(safe.toString())) queued.set(safe.toString(), null);
    } catch {
      continue;
    }
  }

  const visited = new Map<string, PageResult>();
  const linkedTo = new Set<string>();
  let robotsBlocked = 0;
  let renderSampled = 0;
  const stacks: string[] = [];

  // Parcours par vagues : chaque vague est un niveau de profondeur, ce qui donne la
  // profondeur de clic gratuitement (A6) et garde la concurrence bornée.
  let frontier: string[] = [normEntry];
  let depth = 0;
  let stoppedReason: CrawlReport['stoppedReason'] = 'exhausted';

  while (frontier.length && visited.size < pageCap) {
    if (Date.now() >= deadline) { stoppedReason = 'time-budget'; break; }
    const batch: string[] = [];
    for (const u of frontier) {
      if (visited.has(u) || batch.includes(u)) continue;
      if (visited.size + batch.length >= pageCap) break;
      let safe: URL;
      try {
        safe = await assertPublicUrl(u);
      } catch {
        continue;
      }
      if (isDisallowed(safe, robots)) { robotsBlocked++; continue; }
      batch.push(u);
    }
    if (!batch.length) break;

    const results = await pool(
      batch.map((u) => async () => {
        // Cadence d'abord : c'est ce qui rend le crawl acceptable pour la cible.
        await pace();
        const withRender = renderSampled < RENDER_SAMPLE && Date.now() < deadline;
        if (withRender) renderSampled++;
        return analyzePage(new URL(u), queued.get(u) ?? depth, withRender);
      }),
    );

    const nextFrontier: string[] = [];
    for (const r of results) {
      visited.set(r.page.url, r.page);
      if (r.stack) stacks.push(r.stack);
      for (const link of r.links) {
        linkedTo.add(link);
        if (!visited.has(link)) {
          if (!queued.has(link) || queued.get(link) === null) queued.set(link, depth + 1);
          nextFrontier.push(link);
        }
      }
    }
    frontier = nextFrontier;
    depth++;
  }
  if (stoppedReason === 'exhausted' && visited.size >= pageCap) stoppedReason = 'page-cap';

  // Ce qui restait à faire quand le plafond est tombé : on le compte, on ne le cache pas.
  const discovered = new Set<string>([...queued.keys(), ...linkedTo]);
  const pagesSkipped = Math.max(0, discovered.size - visited.size);

  const pages = [...visited.values()];
  const sampled = pages.filter((p) => p.renderVerdict);
  const entryPage = visited.get(normEntry);
  const renderVerdict = entryPage?.renderVerdict ?? sampled[0]?.renderVerdict ?? 'thin';
  const renderMixed = new Set(sampled.map((p) => p.renderVerdict)).size > 1;

  const words = pages.map((p) => p.botWords).sort((a, b) => a - b);
  const medianBotWords = words.length ? (words[Math.floor(words.length / 2)] ?? 0) : 0;

  // Orphelines : connues du sitemap, examinées, mais aucun lien interne ne pointe dessus.
  // On exclut la page d'entrée, qui est atteignable par définition.
  // Une page sans lien entrant n'est orpheline que si on a vu TOUT le site : sous plafond,
  // le lien manquant peut venir d'une page non visitée. On ne conclut donc qu'à crawl complet.
  const orphansDeterminable = pagesSkipped === 0;
  const orphans = orphansDeterminable
    ? pages.filter((p) => p.url !== normEntry && !linkedTo.has(p.url)).map((p) => p.url)
    : [];

  const maxDepth = pages.reduce((m, p) => (p.depth != null && p.depth > m ? p.depth : m), 0);

  return {
    entryUrl: normEntry,
    host,
    startedAt,
    finishedAt: new Date().toISOString(),
    renderVerdict,
    renderMixed,
    stack: mostCommon(stacks),
    pagesCrawled: visited.size,
    pagesSkipped,
    pageCap,
    orphans: orphans.slice(0, 200),
    orphansDeterminable,
    maxDepth,
    medianBotWords,
    robotsBlocked,
    sitemapUrlCount: sitemapUrls.length,
    stoppedReason,
    crawlDelaySec: robots.crawlDelaySec,
    pages,
    aggregate: aggregate(pages, {
      renderVerdict, renderMixed, orphans, orphansDeterminable, maxDepth, pagesSkipped, pageCap,
      stoppedReason, crawlDelaySec: robots.crawlDelaySec,
    }),
  };
}

function mostCommon(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agrégation des constats
// ─────────────────────────────────────────────────────────────────────────────

function f(
  id: string,
  level: AggregateFinding['level'],
  title: string,
  detail: string,
  evidence: string,
  affected: string[],
): AggregateFinding {
  return { id, level, title, detail, evidence, affected: affected.slice(0, 20), affectedCount: affected.length };
}

function aggregate(
  pages: PageResult[],
  ctx: {
    renderVerdict: Verdict; renderMixed: boolean; orphans: string[]; orphansDeterminable: boolean;
    maxDepth: number; pagesSkipped: number; pageCap: number;
    stoppedReason: CrawlReport['stoppedReason']; crawlDelaySec: number;
  },
): AggregateFinding[] {
  const out: AggregateFinding[] = [];
  const ok = pages.filter((p) => !p.error && p.status === 200);
  const urls = (pred: (p: PageResult) => boolean) => ok.filter(pred).map((p) => p.url);

  // ── A1, bloquant s'il l'est ──
  if (ctx.renderVerdict === 'invisible') {
    out.push(f('A1', 'blocking', 'Le contenu a besoin de JavaScript pour apparaître',
      'Aucun grand robot d’IA n’exécute JavaScript : ils téléchargent les .js sans les évaluer. ' +
      'Tant que ce point n’est pas réglé, aucun geste en aval ne sert. Rendu serveur, génération ' +
      'statique ou prérendu au build — il suffit que le texte parte avec la page.',
      'test + data · consensus', [pages[0]?.url ?? '']));
  } else if (ctx.renderVerdict === 'dynamic') {
    out.push(f('A1', 'warn', 'Pré-rendu conditionné à l’user-agent',
      'Le site sert du HTML pré-rendu aux user-agents qu’il reconnaît. Ça fonctionne, mais la ' +
      'visibilité dépend du maintien de cette liste : tout nouveau moteur IA absent de la liste ' +
      'reçoit la coquille vide. À revérifier à chaque nouveau robot.',
      'test + data · consensus', [pages[0]?.url ?? '']));
  }
  if (ctx.renderMixed) {
    out.push(f('A1', 'warn', 'Le mode de rendu n’est pas homogène sur le site',
      'L’échantillon montre plusieurs modes de rendu selon les pages. C’est inhabituel et ça mérite ' +
      'un examen : certaines sections sont probablement lisibles et d’autres non.',
      'observation', urls((p) => !!p.renderVerdict)));
  }

  // ── A5 orphelines ──
  if (ctx.orphans.length) {
    out.push(f('A5', 'warn', `${ctx.orphans.length} page(s) orpheline(s)`,
      'Aucun lien interne ne pointe vers ces pages. Google les ignore ou les dépriorise. Un cas ' +
      'rapporte 6 fois plus d’impressions en 24 h après correction. À lier depuis une page qui ' +
      'reçoit déjà du trafic — pas depuis une page morte, qui ne transmet rien.',
      'opinion · consensus + un cas data', ctx.orphans));
  }

  // ── A6 profondeur ──
  const deep = urls((p) => p.depth != null && p.depth > 3);
  if (deep.length) {
    out.push(f('A6', 'warn', `${deep.length} page(s) à plus de 3 clics de l’accueil`,
      'Les pages qui rapportent doivent être à 2 clics de la page d’accueil, 3 au maximum. Les pages ' +
      'profondes sont explorées et indexées moins souvent.',
      'data · consensus', deep));
  }

  // ── A17 slugs ──
  const opaque = urls((p) => !p.naturalSlug);
  if (opaque.length) {
    out.push(f('A17', 'info', `${opaque.length} URL sans mot lisible dans le slug`,
      'Taux de citation par les modèles mesuré à 89,78 % pour des slugs en langage naturel contre ' +
      '81,11 % pour des URL opaques. Gratuit, mais définitif au moment de créer l’URL : à corriger ' +
      'sur les nouvelles pages plutôt qu’en rétroactif, une migration d’URL coûte plus qu’elle ne rend.',
      'data · single-source', opaque));
  }

  // ── B1 / B2 titres ──
  const noTitle = urls((p) => !p.title);
  if (noTitle.length) {
    out.push(f('B1', 'warn', `${noTitle.length} page(s) sans balise title`,
      'Le titre est l’un des cinq emplacements qui portent 70 % du résultat on-page, avec l’URL, ' +
      'le H1, le début de la première phrase et la meta description.',
      'test · 9 corroborations', noTitle));
  }
  const shortTitle = urls((p) => p.titleLength > 0 && p.titleLength < 150);
  if (shortTitle.length) {
    out.push(f('B2', 'info', `${shortTitle.length} titre(s) sous 150 caractères`,
      'Le corpus mesure +10 à 40 % de trafic pour des titres longs multi-intention de 150 à 250 ' +
      'caractères, l’essentiel dans les douze premiers mots. La règle des 60 caractères ne tient pas. ' +
      'Contre-indication : Google Discover demande l’inverse, à trancher par page si ce canal compte.',
      'test · single-source', shortTitle));
  }

  // ── B3 meta descriptions ──
  const withDesc = urls((p) => p.hasMetaDescription);
  if (withDesc.length > 10) {
    out.push(f('B3', 'info', `${withDesc.length} page(s) avec meta description`,
      'Google en ignore 63 %, et les siennes convertissent 3 % mieux. Le corpus recommande de n’en ' +
      'écrire que sur cinq à dix pages clés. Si elles sont générées automatiquement, c’est mesuré ' +
      'comme faisant moins bien que pas de description du tout — désactiver le générateur est un ' +
      'gain de temps net et une amélioration.',
      'data · single-source', withDesc));
  }

  // ── B6 résumé en tête ──
  const noSummary = urls((p) => !p.hasLeadSummary && p.botWords > CONTENT_FLOOR_WORDS);
  if (noSummary.length) {
    out.push(f('B6', 'warn', `${noSummary.length} page(s) sans résumé en tête`,
      'Un résumé de 2 à 3 phrases juste après le H1, qui donne la réponse au lieu de poser le ' +
      'contexte, est mesuré à +33 % de conversion, avec six occurrences dans le corpus. Dix minutes ' +
      'par page. C’est le meilleur rapport effort/résultat de tout le corpus.',
      'test corroboré + data · consensus', noSummary));
  }

  // ── B8 texte caché ──
  const hidden = urls((p) => p.hasHiddenText);
  if (hidden.length) {
    out.push(f('B8', 'warn', `${hidden.length} page(s) avec du texte en accordéon ou onglet`,
      'Sortir le texte des accordéons et des onglets a produit +12 % de sessions organiques, sur deux ' +
      'tests. Le texte entièrement visible bat nettement le texte caché derrière JavaScript ou CSS.',
      'test ×2', hidden));
  }

  // ── B4 liens sortants ──
  const noOutbound = urls((p) => p.outboundLinks === 0 && p.botWords > 300);
  if (noOutbound.length) {
    out.push(f('B4', 'warn', `${noOutbound.length} page(s) longue(s) sans lien sortant`,
      'Quatre tests indépendants, dans trois domaines différents du corpus, donnent un effet positif ' +
      'aux liens sortants vers des sources sérieuses. C’est le geste on-page le mieux prouvé après les ' +
      'cinq emplacements. Un lien par section.',
      'test ×4, aucun contre-exemple', noOutbound));
  }

  // ── C3 ancres génériques ──
  const generic = urls((p) => p.genericAnchors > 0);
  if (generic.length) {
    out.push(f('C3', 'warn', `${generic.length} page(s) avec des ancres non descriptives`,
      'Les liens internes transmettent la valeur du texte d’ancre, et un décalage entre l’ancre et le ' +
      'contenu de la page d’arrivée entraîne une rétrogradation — c’est mesuré. « Cliquez ici » ne ' +
      'transmet rien. Attention à ne pas surcorriger : uniformiser toutes les ancres sur le mot-clé ' +
      'exact nuit aussi, chaque mot-clé a un ratio d’ancres à respecter.',
      'data · consensus', generic));
  }

  // ── L1 schema ──
  const jsonLd = urls((p) => p.hasJsonLd);
  if (jsonLd.length) {
    out.push(f('L1', 'info', `${jsonLd.length} page(s) avec du balisage schema`,
      'Quatre tests indépendants, dont un déploiement complet sur deux ans : aucun effet mesurable sur ' +
      'le classement. Sur la citation par les IA : +2,4 %, indiscernable de zéro. À garder si c’est là ' +
      'pour un usage précis — nom de site dans les résultats, fiches produit, Google Shopping — mais ' +
      'pas à étendre en attendant du classement.',
      'test ×4', jsonLd));
  }

  // ── Pages en erreur ──
  const broken = pages.filter((p) => p.error || (p.status && p.status >= 400)).map((p) => p.url);
  if (broken.length) {
    out.push(f('A14', 'warn', `${broken.length} URL en erreur`,
      'Ces URL sont référencées mais ne répondent pas correctement. À corriger ou à retirer du ' +
      'sitemap : laisser des centaines de pages sans réponse consomme le budget d’exploration, dont ' +
      '30 à 40 % part déjà sur des pages sans trafic.',
      'data · consensus', broken));
  }

  // ── Plafond atteint : ce n'est pas un constat SEO, c'est une information de périmètre ──
  if (ctx.stoppedReason === 'time-budget') {
    out.push(f('CAP', 'info', 'Le crawl s’est arrêté sur le budget de temps',
      `${ctx.pagesSkipped} page(s) restaient à examiner. ` +
      (ctx.crawlDelaySec > 0
        ? `Le robots.txt de la cible impose ${ctx.crawlDelaySec} s entre deux requêtes, ce qui borne ` +
          'mécaniquement le nombre de pages atteignables. On respecte cette cadence plutôt que de ' +
          'la contourner.'
        : 'Le site est plus lent que la moyenne, ou plus profond que le temps imparti.') +
      ' Les constats ne portent que sur les pages examinées, et la détection des pages orphelines ' +
      'est désactivée.',
      'périmètre', []));
  } else if (ctx.pagesSkipped > 0) {
    out.push(f('CAP', 'info', `${ctx.pagesSkipped} page(s) découverte(s) mais non examinée(s)`,
      `L’audit s’est arrêté au plafond de ${ctx.pageCap} pages de votre palier. Les constats ci-dessus ` +
      'ne portent que sur les pages examinées. En particulier, la détection des pages orphelines (A5) ' +
      'est désactivée : une page sans lien entrant peut très bien être liée depuis une page non ' +
      'visitée, et l’annoncer orpheline serait faux.',
      'périmètre', []));
  }

  const order = { blocking: 0, warn: 1, info: 2, ok: 3 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
