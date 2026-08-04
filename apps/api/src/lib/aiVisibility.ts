/**
 * Moteur du vérificateur de visibilité IA.
 *
 * Ce que ça mesure, et pourquoi c'est plus subtil qu'un simple `curl`.
 *
 * Aucun grand robot d'IA (GPTBot, ClaudeBot, PerplexityBot, Bytespider,
 * meta-externalagent…) n'exécute JavaScript : ils téléchargent les fichiers .js sans les
 * évaluer. Une SPA qui construit ses pages dans le navigateur leur est donc invisible.
 *
 * MAIS beaucoup de sites — dont celui-ci, voir routes/seoPrerender.ts — servent un HTML
 * pré-rendu UNIQUEMENT aux user-agents qui matchent une regex de bots. Un vérificateur qui
 * interroge l'URL avec l'UA par défaut de son client HTTP mesure alors ce que voit ce
 * client, pas ce que voit ChatGPT, et conclut faussement « site invisible ».
 *
 * D'où la double requête :
 *   A. avec un UA de robot IA réel      → ce que ChatGPT reçoit vraiment
 *   B. avec un UA de navigateur         → le HTML brut, avant exécution du JS
 *
 * Le rapport entre les deux donne le diagnostic, en quatre états :
 *   ssr      — A ≈ B, tous deux fournis : le texte part avec la page. État idéal.
 *   dynamic  — A >> B : pré-rendu conditionné à l'user-agent. Ça marche, mais seulement
 *              pour les bots présents dans la liste ; tout nouveau robot voit la coquille.
 *   invisible— A ≈ B, tous deux vides : la page a besoin de JavaScript. Le vrai problème.
 *   thin     — les deux fournissent le même peu de texte : la page est réellement maigre.
 *
 * Sécurité : l'URL vient de l'utilisateur et on la récupère côté serveur — c'est un vecteur
 * SSRF. Voir `assertPublicUrl` : schéma restreint, ports restreints, résolution DNS et
 * rejet des plages privées, redirections suivies à la main avec revalidation de chaque saut,
 * corps plafonné et délai borné.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** UA d'un robot IA réel — c'est LUI qui décide de ce que le site nous montre. */
const AI_BOT_UA =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot';
/** UA de navigateur — sert à lire le HTML brut, sans exécuter le JS. */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
/** En dessous, on considère qu'il n'y a pas de contenu exploitable dans la page. */
const CONTENT_FLOOR_WORDS = 120;

export class CheckError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Garde SSRF
// ─────────────────────────────────────────────────────────────────────────────

/** Plages IPv4 interdites (loopback, privé, lien-local, CGNAT, doc, multicast, réservé). */
function isBlockedIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // lien-local (métadonnées cloud)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18/15
  if (a === 198 && b === 51) return true; // doc 198.51.100/24
  if (a === 203 && b === 0) return true; // doc 203.0.113/24
  if (a >= 224) return true; // multicast 224/4 + réservé 240/4 + broadcast
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  // IPv4-mapped (::ffff:10.0.0.1) : on retombe sur le contrôle v4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped?.[1]) return isBlockedIpv4(mapped[1]);
  if (v === '::' || v === '::1') return true;
  if (/^f[cd]/.test(v)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(v)) return true; // fe80::/10 lien-local
  if (/^ff/.test(v)) return true; // ff00::/8 multicast
  return false;
}

function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true;
}

/**
 * Valide qu'une URL pointe vers une ressource publique.
 * Appelée sur l'URL initiale ET sur chaque cible de redirection.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new CheckError('URL invalide.', 'invalid_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new CheckError('Seules les URL http et https sont acceptées.', 'bad_scheme');
  }
  if (u.port && u.port !== '80' && u.port !== '443') {
    throw new CheckError('Seuls les ports 80 et 443 sont acceptés.', 'bad_port');
  }
  if (u.username || u.password) {
    throw new CheckError('Les URL avec identifiants ne sont pas acceptées.', 'bad_userinfo');
  }

  const host = u.hostname.replace(/^\[|\]$/g, '');
  // Hostname déjà littéral IP : contrôle direct, pas de DNS.
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new CheckError('Adresse IP non publique.', 'private_ip');
    return u;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new CheckError('Hôte non public.', 'private_host');
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new CheckError('Nom de domaine introuvable.', 'dns_error');
  }
  if (records.length === 0) throw new CheckError('Nom de domaine introuvable.', 'dns_error');
  // TOUTES les résolutions doivent être publiques : un domaine qui résout à la fois vers
  // une IP publique et vers 127.0.0.1 servirait à contourner le contrôle.
  for (const r of records) {
    if (isBlockedIp(r.address)) {
      throw new CheckError('Ce domaine résout vers une adresse non publique.', 'private_ip');
    }
  }
  return u;
}

// ─────────────────────────────────────────────────────────────────────────────
// Récupération
// ─────────────────────────────────────────────────────────────────────────────

interface FetchResult {
  html: string;
  status: number;
  finalUrl: string;
  truncated: boolean;
  contentType: string;
}

/**
 * Récupère une URL avec un UA donné, en suivant les redirections à la main pour
 * revalider chaque saut (une redirection vers 127.0.0.1 est un contournement classique).
 */
async function fetchWithUa(url: URL, ua: string): Promise<FetchResult> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'user-agent': ua,
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = e instanceof Error && e.name === 'AbortError';
      throw new CheckError(
        aborted ? 'Le site n’a pas répondu dans le délai imparti.' : 'Impossible de joindre ce site.',
        aborted ? 'timeout' : 'unreachable',
      );
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new CheckError('Redirection sans destination.', 'bad_redirect');
      if (hop === MAX_REDIRECTS) throw new CheckError('Trop de redirections.', 'too_many_redirects');
      current = await assertPublicUrl(new URL(loc, current).toString());
      continue;
    }

    // On accepte le markdown et le texte brut, pas seulement le HTML : certains sites
    // (vercel.com/docs par exemple) négocient le contenu et servent du `text/markdown`
    // aux robots d'IA. C'est un cas de très bonne visibilité, pas une erreur — le rejeter
    // ferait échouer le vérificateur précisément sur les sites les mieux préparés.
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !/text\/html|application\/xhtml|text\/markdown|text\/plain/i.test(ct)) {
      throw new CheckError(
        'Cette URL ne renvoie ni page HTML ni texte — vérifie qu’il s’agit bien d’une page.',
        'not_html',
      );
    }

    // Lecture plafonnée : on ne veut pas d'un flux de 500 Mo dans la lambda.
    const reader = res.body?.getReader();
    if (!reader) {
      return { html: '', status: res.status, finalUrl: current.toString(), truncated: false, contentType: ct };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - MAX_BYTES))));
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return {
      html: buf.toString('utf-8'),
      status: res.status,
      finalUrl: current.toString(),
      truncated,
      contentType: ct,
    };
  }
  throw new CheckError('Trop de redirections.', 'too_many_redirects');
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction
// ─────────────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è',
  agrave: 'à', ccedil: 'ç', ocirc: 'ô', ecirc: 'ê', ugrave: 'ù', laquo: '«', raquo: '»',
  hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '"', rdquo: '"', mdash: '—', ndash: '–',
  euro: '€', deg: '°', times: '×',
};

function unescapeHtml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, ent: string) => {
    const e = ent.toLowerCase();
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16) || 32);
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10) || 32);
    return ENTITIES[e] ?? m;
  });
}

/** Texte réellement lisible : on retire ce qu'aucun lecteur ne lit. */
function visibleText(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|template|svg|iframe|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return unescapeHtml(s).replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m?.[1] ? unescapeHtml(m[1]).replace(/\s+/g, ' ').trim() : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic
// ─────────────────────────────────────────────────────────────────────────────

export type Verdict = 'ssr' | 'dynamic' | 'invisible' | 'thin';

export interface VisibilityReport {
  url: string;
  finalUrl: string;
  checkedAt: string;
  verdict: Verdict;
  /** Mots que reçoit réellement un robot IA. C'est LE chiffre à afficher. */
  botWords: number;
  /** Mots présents dans le HTML brut servi à un navigateur, avant exécution du JS. */
  rawWords: number;
  status: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  /** Faux si le site a négocié autre chose que du HTML (markdown pour les robots IA). */
  isHtml: boolean;
  contentType: string;
  hasJsonLd: boolean;
  hasLlmsTxtReference: boolean;
  /** Extrait de ce que le robot lit — rend le constat tangible. */
  excerpt: string;
  findings: Finding[];
}

export interface Finding {
  id: string;
  level: 'blocking' | 'warn' | 'ok' | 'info';
  title: string;
  detail: string;
  /** Étiquette de preuve du corpus, affichée telle quelle. */
  evidence: string;
}

function buildFindings(r: Omit<VisibilityReport, 'findings'>): Finding[] {
  const f: Finding[] = [];

  if (r.verdict === 'invisible') {
    f.push({
      id: 'A1',
      level: 'blocking',
      title: 'Le contenu de cette page a besoin de JavaScript pour apparaître',
      detail:
        `Un robot d'IA ne reçoit que ${r.botWords} mots. Aucun grand robot d'IA n'exécute JavaScript : ` +
        'ils téléchargent les fichiers .js sans les évaluer. Cette page ne peut donc pas être citée. ' +
        'Le correctif est le rendu serveur, la génération statique ou le prérendu au build — ' +
        'il suffit que le texte parte avec la page, sans changer de stack.',
      evidence: 'test + data · consensus',
    });
  } else if (r.verdict === 'dynamic') {
    f.push({
      id: 'A1',
      level: 'warn',
      title: 'Pré-rendu conditionné à l’user-agent — ça marche, mais c’est fragile',
      detail:
        `Un robot d'IA reçoit ${r.botWords} mots, un navigateur n'en reçoit que ${r.rawWords} avant ` +
        "l'exécution du JavaScript. Le site sert donc du HTML pré-rendu aux user-agents qu'il " +
        'reconnaît. La visibilité dépend alors du maintien de cette liste : tout robot absent de la ' +
        'liste reçoit la coquille vide. À surveiller à chaque nouveau moteur IA.',
      evidence: 'test + data · consensus',
    });
  } else if (r.verdict === 'thin') {
    f.push({
      id: 'A1',
      level: 'warn',
      title: 'La page est lisible, mais elle contient peu de texte',
      detail:
        `${r.botWords} mots lisibles. Le rendu n'est pas le problème : la page est servie telle quelle. ` +
        "Le corpus ne demande pas d'écrire long — une page de vente efficace fait 415 mots en moyenne — " +
        'mais en dessous de cent mots, il n’y a pas de quoi répondre à une requête.',
      evidence: 'test · single-source',
    });
  } else {
    f.push({
      id: 'A1',
      level: 'ok',
      title: 'Le texte part avec la page',
      detail:
        `${r.botWords} mots lisibles sans exécuter de JavaScript. C'est l'état idéal : la page existe ` +
        'pour les robots d’IA comme pour les moteurs de recherche, sans dépendre d’une liste ' +
        'de user-agents à maintenir.',
      evidence: 'test + data · consensus',
    });
  }

  // Les contrôles on-page ci-dessous portent sur des balises HTML. Si le site a servi du
  // markdown au robot — négociation de contenu, cas des sites les mieux préparés — parler
  // de « title manquant » ou de « H1 absent » serait un constat faux.
  if (!r.isHtml) {
    f.push({
      id: 'H1',
      level: 'ok',
      title: 'Ce site sert une version texte dédiée aux robots d’IA',
      detail:
        `Le serveur a répondu en « ${r.contentType.split(';')[0]} » à un user-agent de robot IA, au lieu ` +
        'de HTML. C’est de la négociation de contenu volontaire, et c’est le signe d’un site déjà ' +
        'préparé pour les moteurs IA. Les contrôles de balises HTML ne s’appliquent pas ici.',
      evidence: 'observation',
    });
    return f;
  }

  if (r.title) {
    const len = r.title.length;
    if (len < 150) {
      f.push({
        id: 'B2',
        level: 'info',
        title: `Titre de ${len} caractères`,
        detail:
          'Le corpus mesure +10 à 40 % de trafic pour des titres longs multi-intention de 150 à 250 ' +
          'caractères, avec l’essentiel dans les douze premiers mots. La règle des 60 caractères ' +
          'ne tient pas. Attention toutefois : Google Discover demande l’inverse.',
        evidence: 'test · single-source',
      });
    } else {
      f.push({
        id: 'B2',
        level: 'ok',
        title: `Titre de ${len} caractères`,
        detail: 'Dans la fourchette de 150 à 250 caractères que le corpus mesure comme la plus rentable.',
        evidence: 'test · single-source',
      });
    }
  } else {
    f.push({
      id: 'B1',
      level: 'warn',
      title: 'Aucune balise title lisible',
      detail:
        'Le titre est l’un des cinq emplacements qui portent 70 % du résultat on-page — avec l’URL, ' +
        'le H1, le début de la première phrase et la meta description.',
      evidence: 'test · 9 corroborations',
    });
  }

  if (r.metaDescription) {
    f.push({
      id: 'B3',
      level: 'info',
      title: 'Cette page a une meta description',
      detail:
        'Google en ignore 63 %, et celles qu’il rédige lui-même convertissent 3 % mieux. Le corpus ' +
        'recommande de n’en écrire que sur cinq à dix pages clés, et de ne jamais en générer ' +
        'automatiquement — les descriptions générées font mesurablement moins bien que pas de description.',
      evidence: 'data · single-source',
    });
  }

  if (r.hasJsonLd) {
    f.push({
      id: 'L1',
      level: 'info',
      title: 'Balisage schema détecté',
      detail:
        'Quatre tests indépendants, dont un déploiement complet sur deux ans : aucun effet mesurable sur ' +
        'le classement. Effet sur la citation par les IA : +2,4 %, indiscernable de zéro. À garder si ' +
        'c’est là pour un usage précis (nom de site dans les résultats, fiches produit, Google ' +
        'Shopping), mais pas à étendre en attendant du classement.',
      evidence: 'test ×4',
    });
  }

  if (r.h1Count === 0) {
    f.push({
      id: 'B1',
      level: 'warn',
      title: 'Aucun H1',
      detail: 'Le H1 est l’un des cinq emplacements. Son absence est un défaut ; en revanche le corpus ' +
        'ne tranche pas sur leur NOMBRE, et aucune position n’a d’effet démontré.',
      evidence: 'test · 9 corroborations',
    });
  }

  return f;
}

/** Lance la vérification complète sur une URL utilisateur. */
export async function checkAiVisibility(rawUrl: string): Promise<VisibilityReport> {
  const url = await assertPublicUrl(normalizeInput(rawUrl));

  // Les deux requêtes en parallèle : la comparaison est le cœur du diagnostic.
  const [bot, browser] = await Promise.all([fetchWithUa(url, AI_BOT_UA), fetchWithUa(url, BROWSER_UA)]);

  const botText = visibleText(bot.html);
  const botWords = countWords(botText);
  const rawWords = countWords(visibleText(browser.html));

  let verdict: Verdict;
  if (botWords < CONTENT_FLOOR_WORDS && rawWords < CONTENT_FLOOR_WORDS) {
    // Rien des deux côtés. Si la page porte une coquille de SPA, c'est l'invisibilité ;
    // sinon c'est une page réellement maigre. Le marqueur : la présence d'un bundle JS.
    verdict = /<script[^>]+type=["']module["']|<div[^>]+id=["'](root|app|__next)["']/i.test(browser.html)
      ? 'invisible'
      : 'thin';
  } else if (botWords >= CONTENT_FLOOR_WORDS && rawWords < Math.max(CONTENT_FLOOR_WORDS, botWords * 0.3)) {
    verdict = 'dynamic';
  } else {
    verdict = 'ssr';
  }

  const base = {
    url: url.toString(),
    finalUrl: bot.finalUrl,
    checkedAt: new Date().toISOString(),
    verdict,
    botWords,
    rawWords,
    status: bot.status,
    title: firstMatch(bot.html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    metaDescription: firstMatch(
      bot.html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ),
    h1: firstMatch(bot.html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    h1Count: (bot.html.match(/<h1\b/gi) ?? []).length,
    isHtml: /text\/html|application\/xhtml/i.test(bot.contentType) || /<html[\s>]/i.test(bot.html),
    contentType: bot.contentType,
    hasJsonLd: /application\/ld\+json/i.test(bot.html),
    hasLlmsTxtReference: /llms\.txt/i.test(bot.html),
    excerpt: botText.slice(0, 400),
  };

  return { ...base, findings: buildFindings(base) };
}

/**
 * Accepte « exemple.fr », « exemple.fr/page » ou une URL complète.
 *
 * Le schéma est traité explicitement : sans ça, « ftp://exemple.fr » se ferait préfixer en
 * « https://ftp://exemple.fr », dont l'hôte est `ftp` — l'utilisateur recevrait « nom de
 * domaine introuvable » au lieu de la vraie raison.
 */
export function normalizeInput(input: string): string {
  const s = input.trim();
  if (!s) throw new CheckError('Indique une URL.', 'invalid_url');
  if (s.length > 2048) throw new CheckError('URL trop longue.', 'invalid_url');
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(s)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    throw new CheckError(`Le schéma « ${scheme} » n’est pas accepté — utilise http ou https.`, 'bad_scheme');
  }
  return scheme ? s : `https://${s.replace(/^\/+/, '')}`;
}
