import { z } from 'zod';
import type { ResilienceStars, ResilienceStarVerdict } from '@lubin/shared';
import { prisma } from '../db/client.js';
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
 * Nom canonique pour apparier la reponse d'un modele avec nos lignes.
 *
 * Les modeles reecrivent les raisons sociales : « HSBC » pour « HSBC Holdings plc », « LVMH Moet
 * Hennessy » pour « LVMH Moët Hennessy ». Une egalite stricte fait echouer l'appariement, et le
 * 05/08/2026 cet echec a tue un run entier de 60 entreprises apres 21 min de scoring.
 */
export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
 */
export function pairByCompanyName<T extends { nom: string }>(
  companies: CompanyBrief[],
  parsed: T[],
): (T | undefined)[] {
  const paired: (T | undefined)[] = companies.map(() => undefined);
  const used = new Set<number>();

  companies.forEach((company, index) => {
    const wanted = normalizeCompanyName(company.name);
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

/** Extrait et valide le tableau JSON renvoye par le modele (tolere un fencing markdown). */
export function parseScores(resultText: string): RawScore[] {
  const cleaned = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  const raw: unknown = JSON.parse(match ? match[0] : cleaned);
  const parsed = arraySchema.parse(raw);
  return parsed.map(entry => ({
    nom: entry.nom,
    criteria: Object.fromEntries(
      CRITERION_KEYS.map(key => [key, { star: entry[key].s, justification: entry[key].r }]),
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
