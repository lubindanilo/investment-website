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
import { findingCopy, type CheckerLang, type CopyKey, type CopyVars } from './aiVisibilityCopy.js';
import { isIP } from 'node:net';

/** UA d'un robot IA réel — c'est LUI qui décide de ce que le site nous montre. */
export const AI_BOT_UA =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot';
/** UA de navigateur — sert à lire le HTML brut, sans exécuter le JS. */
export const BROWSER_UA =
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

export interface FetchResult {
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
export async function fetchWithUa(
  url: URL,
  ua: string,
  opts: { allowXml?: boolean } = {},
): Promise<FetchResult> {
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
          accept: opts.allowXml
            ? 'application/xml,text/xml,text/plain,text/html'
            : 'text/html,application/xhtml+xml',
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
    const allowed = opts.allowXml
      ? /xml|text\/plain|text\/html/i
      : /text\/html|application\/xhtml|text\/markdown|text\/plain/i;
    if (ct && !allowed.test(ct)) {
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

export function unescapeHtml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, ent: string) => {
    const e = ent.toLowerCase();
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16) || 32);
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10) || 32);
    return ENTITIES[e] ?? m;
  });
}

/** Texte réellement lisible : on retire ce qu'aucun lecteur ne lit. */
export function visibleText(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|template|svg|iframe|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return unescapeHtml(s).replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function firstMatch(html: string, re: RegExp): string | null {
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

function buildFindings(
  r: Omit<VisibilityReport, 'findings'>,
  lang: CheckerLang,
): Finding[] {
  const f: Finding[] = [];
  const vars: CopyVars = {
    botWords: r.botWords,
    rawWords: r.rawWords,
    titleLength: r.title?.length ?? 0,
    contentType: r.contentType.split(';')[0] ?? r.contentType,
  };
  // Les textes vivent dans lib/aiVisibilityCopy.ts, traduits fr/en/es : cette page est
  // publique et partagée, servir des constats en français sur une interface anglaise se voit.
  const put = (id: string, level: Finding['level'], key: CopyKey, evidence: string) => {
    const c = findingCopy(lang, key, vars);
    f.push({ id, level, title: c.title, detail: c.detail, evidence });
  };

  if (r.verdict === 'invisible') put('A1', 'blocking', 'a1.invisible', 'test + data · consensus');
  else if (r.verdict === 'dynamic') put('A1', 'warn', 'a1.dynamic', 'test + data · consensus');
  else if (r.verdict === 'thin') put('A1', 'warn', 'a1.thin', 'test · single-source');
  else put('A1', 'ok', 'a1.ssr', 'test + data · consensus');

  // Les contrôles ci-dessous portent sur des balises HTML. Si le site a servi du markdown au
  // robot — négociation de contenu, cas des sites les mieux préparés — parler de « title
  // manquant » ou de « H1 absent » serait un constat faux.
  if (!r.isHtml) {
    put('H1', 'ok', 'h1.negotiated', 'observation');
    return f;
  }

  if (r.title) {
    put('B2', 'info', r.title.length < 150 ? 'b2.short' : 'b2.ok', 'test · single-source');
  } else {
    put('B1', 'warn', 'b1.noTitle', 'test · 9 corroborations');
  }

  if (r.metaDescription) put('B3', 'info', 'b3.hasDesc', 'data · single-source');
  if (r.hasJsonLd) put('L1', 'info', 'l1.jsonLd', 'test ×4');
  if (r.h1Count === 0) put('B1', 'warn', 'b1.noH1', 'test · 9 corroborations');

  return f;
}

/** Lance la vérification complète sur une URL utilisateur. */
export async function checkAiVisibility(
  rawUrl: string,
  lang: CheckerLang = 'fr',
): Promise<VisibilityReport> {
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

  return { ...base, findings: buildFindings(base, lang) };
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
