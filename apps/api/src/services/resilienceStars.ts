import { z } from 'zod';
import type { ResilienceStars, ResilienceStarVerdict } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { repairAccents } from '../lib/frenchAccents.js';
import { runClaudeJson, resolveModel } from './resilienceStarsCli.js';
import { buildScoringPrompt } from './resilienceStarsPrompt.js';

/** Les 5 axes du modele Resilience 5 etoiles (spec canonique). */
export const CRITERION_KEYS = ['besoin', 'controle', 'forces', 'adjacent', 'capture'] as const;
export type CriterionKey = (typeof CRITERION_KEYS)[number];

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  besoin: 'Demande payee du role',
  controle: 'Controle propre, rare, dur a contourner',
  forces: 'Tient face aux forces (IA, robotique, Chine)',
  adjacent: 'Pouvoir d\'absorber l\'adjacent',
  capture: 'Capture durable, sans fragilite fatale',
};

/** Une note vaut 0, 0,5 ou 1 etoile ; rien d'autre. */
export type StarValue = 0 | 0.5 | 1;

export interface CompanyBrief {
  name: string;
  /** Faits saillants (le brief fournit les faits, le bareme fournit le jugement). */
  brief: string;
}

export interface CriterionScore {
  star: StarValue;
  justification: string;
}

export interface ResilienceStarScore {
  name: string;
  criteria: Record<CriterionKey, CriterionScore>;
  /** Somme des 5 etoiles, de 0 a 5, resolution a la demi-etoile. */
  total: number;
  model: string;
}

const starSchema = z.union([z.literal(0), z.literal(0.5), z.literal(1)]);
const publicCriterionSchema = z.object({
  star: starSchema,
  justification: z.string().trim().min(1),
});
const publicCriteriaSchema = z.object({
  besoin: publicCriterionSchema,
  controle: publicCriterionSchema,
  forces: publicCriterionSchema,
  adjacent: publicCriterionSchema,
  capture: publicCriterionSchema,
});
const criterionSchema = z.object({ s: starSchema, r: z.string().trim().min(1) });
const companySchema = z.object({
  nom: z.string().trim().min(1),
  besoin: criterionSchema,
  controle: criterionSchema,
  forces: criterionSchema,
  adjacent: criterionSchema,
  capture: criterionSchema,
});
const arraySchema = z.array(companySchema);

/**
 * Formes juridiques supprimees en FIN de nom uniquement : en tete ou au milieu elles peuvent etre
 * un vrai mot (« AG Growth International », « Co-operators »). On les retire en boucle, car elles
 * s'empilent (« ... Holding Co., Ltd. »).
 *
 * `kgaa` est volontairement ABSENT de cette liste ET de la suivante, alors que c'est bien une forme
 * juridique. Chez Merck il est le SEUL discriminant entre deux societes sans rapport : « Merck
 * KGaA » (outils de life science, chimie de specialite) et « Merck & Co., Inc. » (pharma US) se
 * reduisaient tous deux a « merck », et la note de la seconde a fini recopiee mot pour mot sur la
 * premiere — MRK.DE affichait 1,5/5 en citant Keytruda (constate en prod le 11/08/2026).
 *
 * Le choix inverse ne coute rien au regroupement : nos fournisseurs ecrivent le suffixe sur TOUTES
 * les lignes d'une meme KGaA (HEN.DE, SAX.DE, SPG.DE, FRE.DE...), donc les cotations multiples d'une
 * KGaA continuent de se retrouver entre elles. Et une KGaA qui se scinderait quand meme en deux
 * groupes serait notee deux fois : un surcout, pas une note fausse.
 */
const TRAILING_LEGAL_TOKENS = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'plc', 'ltd', 'limited', 'llc',
  'lp', 'sa', 'nv', 'se', 'ag', 'ab', 'asa', 'oyj', 'spa', 'sae', 'adr', 'ads',
]);

/** Celles-ci ne sont JAMAIS un mot : on peut les retirer n'importe ou (« SA Petrobras »). */
const ANYWHERE_LEGAL_TOKENS = new Set(['plc', 'sa', 'nv', 'oyj', 'asa', 'aktiengesellschaft']);

/**
 * Recolle les SUITES d'au moins deux lettres isolees, et jette les lettres vraiment seules.
 *
 * Un acronyme pointe arrive ici aplati en lettres isolees (« S.A. » -> « s a », « p.l.c. » ->
 * « p l c ») : il faut le recoller pour que la forme juridique redevienne reconnaissable. Une lettre
 * SEULE, elle, est une classe d'action ou un artefact de flux (« Alphabet Inc Class A », « AMRIZE N »,
 * « ... Company N. ») : la jeter est ce qui permet a ces lignes de rejoindre leur societe.
 *
 * L'ancienne regle jetait toutes les lettres isolees sans distinction, et detruisait au passage des
 * raisons sociales entieres : « M&T Bank Corp » se canonisait en « bank », « H & R Block Inc » en
 * « block » (donc en Block Inc), « S&T Bancorp Inc » en « bancorp », « R C M Technologies » et
 * « Q/C Technologies » toutes deux en « technologies ». Autant de collisions entre societes sans
 * rapport, de la meme famille que Merck (audit du 11/08/2026).
 */
function collapseIsolatedLetters(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i]!.length > 1) {
      out.push(tokens[i]!);
      i += 1;
      continue;
    }
    let end = i;
    while (end < tokens.length && tokens[end]!.length === 1) end += 1;
    const run = tokens.slice(i, end);
    if (run.length > 1) out.push(run.join(''));
    i = end;
  }
  return out;
}

/** Casse, accents et ponctuation aplatis. Dernier recours quand tout le reste disparait. */
function flattenName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Forme aplatie, « the » de tete supprime. Base commune a la cle et aux signaux d'identite. */
function rawTokens(value: string): string[] {
  const tokens = flattenName(value).split(' ').filter(Boolean);
  return tokens[0] === 'the' ? tokens.slice(1) : tokens;
}

/**
 * Nom canonique pour apparier la reponse d'un modele avec nos lignes, et regrouper les cotations
 * multiples d'une meme societe.
 *
 * Les modeles reecrivent les raisons sociales (« HSBC » pour « HSBC Holdings plc »), et les
 * fournisseurs de donnees ne s'accordent pas entre eux : « The Toronto-Dominion Bank » vs
 * « Toronto-Dominion Bank », « Petróleo Brasileiro S.A. - Petrobras » vs « Petroleo Brasileiro SA
 * Petrobras ». Une egalite trop litterale a tue un run entier le 05/08/2026 (appariement), puis
 * laisse six societes multi-cotees porter deux notes divergentes (audit du 06/08/2026).
 *
 * Regles, dans l'ordre : casse/accents/ponctuation aplatis, « the » de tete supprime, suites de
 * lettres isolees recollees et lettres seules jetees (cf. collapseIsolatedLetters), formes
 * juridiques supprimees en fin de nom et, pour celles qui ne sont jamais un mot, n'importe ou. Si
 * tout disparait, on garde la forme aplatie d'origine plutot qu'une cle vide.
 *
 * ATTENTION : cette cle ne SUFFIT PAS a decider que deux lignes sont la meme societe — deux
 * societes sans rapport peuvent la partager. C'est `isSameCompany` qui tranche.
 */
export function normalizeCompanyName(value: string): string {
  const tokens = collapseIsolatedLetters(rawTokens(value))
    .filter(token => !ANYWHERE_LEGAL_TOKENS.has(token));
  while (tokens.length > 1 && TRAILING_LEGAL_TOKENS.has(tokens[tokens.length - 1]!)) tokens.pop();

  return tokens.length > 0 ? tokens.join(' ') : flattenName(value);
}

/**
 * Famille juridique par juridiction. Deux raisons sociales qui portent des formes de familles
 * DISJOINTES ne designent pas la meme societe, meme sous un nom canonique identique : « Largo Inc. »
 * (vanadium, Toronto) contre « Largo SA » (distribution electronique, Paris), « Titan Company
 * Limited » (joaillerie indienne) contre « Titan S.A. » (ciment grec), « IREN Ltd » (minage de
 * bitcoin) contre « Iren SpA » (utility italienne). C'est le signal qui rattrape la classe entiere
 * de collisions dont Merck n'etait qu'un cas.
 *
 * ABSENTS VOLONTAIREMENT : `co` et `company`, qui apparaissent dans les raisons sociales allemandes
 * (« Henkel AG & Co. KGaA ») et y feraient croire a une forme americaine ; `se`, qui est europeenne
 * et se porte aussi bien en Allemagne (E.ON SE) qu'en France (Airbus SE) ; `adr` et `ads`, qui
 * designent par construction la MEME societe que la ligne locale.
 */
const LEGAL_FAMILY: Record<string, string> = {
  inc: 'us', incorporated: 'us', corp: 'us', corporation: 'us', llc: 'us', lp: 'us',
  plc: 'uk',
  ltd: 'commonwealth', limited: 'commonwealth',
  ag: 'allemande', aktiengesellschaft: 'allemande', kgaa: 'allemande', gmbh: 'allemande',
  sa: 'latine', spa: 'latine', sae: 'latine', nv: 'latine',
  ab: 'nordique', asa: 'nordique', oyj: 'nordique',
};

function legalFamilies(name: string): Set<string> {
  const families = new Set<string>();
  for (const token of collapseIsolatedLetters(rawTokens(name))) {
    const family = LEGAL_FAMILY[token];
    if (family) families.add(family);
  }
  return families;
}

/**
 * Initiales de TETE (« S&T », « H & R », « R C M », « X-Energy »), avant le premier vrai mot.
 *
 * Elles font partie de l'identite de la societe, contrairement a une lettre de fin qui est une
 * classe d'action. Deux noms canoniques identiques mais des initiales differentes = deux societes.
 */
function leadingInitials(name: string): string {
  const tokens = rawTokens(name);
  const end = tokens.findIndex(token => token.length > 1);
  return tokens.slice(0, end === -1 ? tokens.length : end).join('');
}

/**
 * Tickers dont le nom canonique percute une societe SANS RAPPORT que ni les initiales ni la famille
 * juridique ne separent, releve par l'audit du 11/08/2026
 * (`scripts/resilienceStarsHomonymAudit.ts`) : « Toro Co » (tondeuses) contre « Toro Corp. »
 * (transport maritime), « First BanCorp » (Porto Rico) contre « First Bancorp Inc » (Maine),
 * « Blue Owl Capital Inc » (le gerant) contre « Blue Owl Capital Corp » (sa BDC), et deux vehicules
 * Cantor que seul un chiffre romain distingue.
 *
 * Un ticker liste ici ne se regroupe qu'avec LUI-MEME : il est note pour lui, jamais recopie. Le
 * cout est une note payee deux fois pour une societe multi-cotee qui y figurerait a tort.
 */
const SEPARATE_COMPANIES = new Set(['TORO', 'FNLC', 'OBDC', 'CEPV', 'CEPO']);

/** Une ligne de cotation : le ticker tranche ce que le nom laisse ambigu. */
export interface CompanyLine {
  ticker: string;
  name: string;
}

/**
 * Deux lignes designent-elles la MEME societe ? Seule reponse autorisee a recopier une note d'une
 * ligne sur l'autre.
 *
 * Le nom canonique seul ne suffit pas : sur 8 631 lignes du screener, 42 cles canoniques etaient
 * partagees par des raisons sociales differentes, dont une vingtaine par des societes sans aucun
 * rapport (audit du 11/08/2026). On exige donc, en plus de la cle : les memes initiales de tete, et
 * des familles juridiques non disjointes. Un nom sans forme juridique reste compatible avec tout
 * (les fournisseurs en omettent une ligne sur deux : « Toronto-Dominion Bank » contre « The
 * Toronto-Dominion Bank »), sinon on refuserait de regrouper de vraies doubles cotations.
 *
 * En cas de doute on REFUSE. Refuser coute un appel au modele et, au pire, deux notes voisines pour
 * une meme societe ; accepter a tort affiche sur une societe la note argumentee d'une autre.
 */
export function isSameCompany(a: CompanyLine, b: CompanyLine): boolean {
  if (a.ticker === b.ticker) return true;
  if (SEPARATE_COMPANIES.has(a.ticker) || SEPARATE_COMPANIES.has(b.ticker)) return false;
  if (normalizeCompanyName(a.name) !== normalizeCompanyName(b.name)) return false;
  if (leadingInitials(a.name) !== leadingInitials(b.name)) return false;

  const familiesA = legalFamilies(a.name);
  const familiesB = legalFamilies(b.name);
  if (familiesA.size === 0 || familiesB.size === 0) return true;
  return [...familiesA].some(family => familiesB.has(family));
}

/** Agregation deterministe : le total n'est jamais decide par le LLM. */
export function aggregateTotal(criteria: Record<CriterionKey, CriterionScore>): number {
  return CRITERION_KEYS.reduce((sum, key) => sum + criteria[key].star, 0);
}

/**
 * Apparie le lot demande avec la reponse du modele : nom canonique d'abord, puis les RESTES par
 * position, et uniquement s'il en reste autant des deux cotes.
 *
 * L'ordre des deux passes n'est pas un detail. Attribuer par position avant d'avoir epuise les noms
 * permute deux entreprises des que le modele reordonne sa reponse, et une note attribuee a la
 * mauvaise societe est bien plus grave qu'une note manquante. Quand les restes ne s'equilibrent pas,
 * on ne devine pas : la case sort `undefined` et l'appelant decide (Sonnet echoue, V3 omet).
 *
 * Deux entreprises du MEME lot qui partagent un nom canonique sortent de la passe par nom : le
 * premier match gagnerait la case de l'autre, donc au moins une des deux porterait la note d'une
 * societe differente. Elles ne se resolvent plus que par la position, qui est justement l'ordre
 * demande au modele, et seulement si les restes s'equilibrent.
 */
export function pairByCompanyName<T extends { nom: string }>(
  companies: CompanyBrief[],
  parsed: T[],
): (T | undefined)[] {
  const paired: (T | undefined)[] = companies.map(() => undefined);
  const used = new Set<number>();

  const wantedKeys = companies.map(company => normalizeCompanyName(company.name));
  const ambiguous = new Set(wantedKeys.filter((key, index) => wantedKeys.indexOf(key) !== index));
  for (const key of ambiguous) {
    console.warn(`[resilience] lot ambigu : « ${key} » designe plusieurs entreprises demandees, appariement par nom desactive pour elles.`);
  }

  companies.forEach((company, index) => {
    const wanted = wantedKeys[index]!;
    if (ambiguous.has(wanted)) return;
    const found = parsed.findIndex((p, i) => !used.has(i) && normalizeCompanyName(p.nom) === wanted);
    if (found === -1) return;
    paired[index] = parsed[found];
    used.add(found);
  });

  const orphanCompanies = paired.flatMap((match, index) => (match ? [] : [index]));
  const orphanParsed = parsed.flatMap((_, index) => (used.has(index) ? [] : [index]));
  if (orphanCompanies.length === orphanParsed.length) {
    orphanCompanies.forEach((companyIndex, rank) => {
      paired[companyIndex] = parsed[orphanParsed[rank]!];
    });
  }
  return paired;
}

interface RawScore {
  nom: string;
  criteria: Record<CriterionKey, CriterionScore>;
}

/**
 * Extrait et valide le tableau JSON renvoye par le modele (tolere un fencing markdown).
 *
 * Les justifications passent par `repairAccents` ICI, c'est-a-dire au point de passage unique
 * des trois adaptateurs (CLI, API, DeepSeek) : ce qui part en base est deja accentue, quel que
 * soit le scoreur. Le prompt demande deja du francais accentue ; ceci est le filet.
 *
 * On repare l'ORTHOGRAPHE, pas la typographie : la casse et les espaces restent ceux du modele,
 * et la mise en forme d'affichage (`polishFrenchText`) reste au front. Ce qu'on stocke est ce que
 * le modele a ecrit, moins la faute d'accent.
 */
export function parseScores(resultText: string): RawScore[] {
  const cleaned = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  const raw: unknown = JSON.parse(match ? match[0] : cleaned);
  const parsed = arraySchema.parse(raw);
  return parsed.map(entry => ({
    nom: entry.nom,
    criteria: Object.fromEntries(
      CRITERION_KEYS.map(key => [key, { star: entry[key].s, justification: repairAccents(entry[key].r) }]),
    ) as Record<CriterionKey, CriterionScore>,
  }));
}

export interface ScoreOptions {
  model?: string;
  timeoutMs?: number;
}

/**
 * Note un lot d'entreprises en UN seul appel (efficace + cache-friendly).
 * La Resilience etant un score lent, le cron n'appelle ceci que sur les
 * nouvelles entreprises ou sur evenement structurel, pas chaque jour.
 */
export async function scoreCompanies(
  companies: CompanyBrief[],
  options: ScoreOptions = {},
): Promise<ResilienceStarScore[]> {
  if (companies.length === 0) return [];
  const model = resolveModel(options.model);
  const prompt = buildScoringPrompt(companies);
  const resultText = await runClaudeJson(prompt, { model, timeoutMs: options.timeoutMs });
  const parsed = parseScores(resultText);

  const paired = pairByCompanyName(companies, parsed);

  return companies.map((company, index) => {
    const match = paired[index];
    if (!match) throw new Error(`Aucun score renvoye pour ${company.name}`);
    return {
      name: company.name,
      criteria: match.criteria,
      total: aggregateTotal(match.criteria),
      model,
    };
  });
}

/** Commodite pour scorer une seule entreprise. */
export async function scoreCompany(
  company: CompanyBrief,
  options: ScoreOptions = {},
): Promise<ResilienceStarScore> {
  const [score] = await scoreCompanies([company], options);
  if (!score) throw new Error(`Aucun score pour ${company.name}`);
  return score;
}

function isVerdict(value: string): value is ResilienceStarVerdict {
  return value === 'agree' || value === 'resolved' || value === 'flagged';
}

function toPublicStars(row: {
  ticker: string;
  name: string | null;
  total: number;
  criteria: unknown;
  verdict: string;
  marketCapUsd: number | null;
  scoredAt: Date;
}): ResilienceStars | null {
  if (!isVerdict(row.verdict)) return null;
  const criteria = publicCriteriaSchema.safeParse(row.criteria);
  if (!criteria.success) return null;
  return {
    ticker: row.ticker,
    name: row.name ?? row.ticker,
    total: row.total,
    criteria: criteria.data,
    verdict: row.verdict,
    marketCapUsd: row.marketCapUsd,
    scoredAt: row.scoredAt.toISOString(),
  };
}

/** Lecture batch du nouveau score Resilience 5 etoiles. Absence = backfill en cours. */
export async function getResilienceStars(tickers: string[]): Promise<Map<string, ResilienceStars>> {
  const out = new Map<string, ResilienceStars>();
  const unique = [...new Set(tickers.map(t => t.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return out;

  const rows = await prisma.resilienceStarScore.findMany({
    where: { ticker: { in: unique } },
    select: {
      ticker: true,
      name: true,
      total: true,
      criteria: true,
      verdict: true,
      marketCapUsd: true,
      scoredAt: true,
    },
  });
  for (const row of rows) {
    const stars = toPublicStars(row);
    if (stars) out.set(row.ticker, stars);
  }
  return out;
}

export async function getResilienceStarsForTicker(ticker: string): Promise<ResilienceStars | null> {
  return (await getResilienceStars([ticker])).get(ticker.toUpperCase()) ?? null;
}
