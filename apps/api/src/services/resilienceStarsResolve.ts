import { scoreCompanies, type CompanyBrief, type ResilienceStarScore } from './resilienceStars.js';
import { scoreCompaniesApi, hasApiKey } from './resilienceStarsApi.js';

/**
 * Systeme a deux paliers : CLI (economique, sans cle) par defaut, escalade vers
 * l'API (temperature 0, deterministe) UNIQUEMENT pour les cas litigieux.
 *
 * Un cas est "litigieux" quand deux passages CLI ne donnent pas le meme total :
 * c'est exactement le signal de la variance qu'on veut eliminer.
 */
export type ScoreSource = 'cli-stable' | 'api-resolved' | 'cli-unresolved';

export interface ResolvedScore extends ResilienceStarScore {
  source: ScoreSource;
  /** Totaux obtenus aux passages CLI (pour tracer la stabilite). */
  cliTotals: number[];
}

export interface StabilityInfo {
  stable: boolean;
  totals: number[];
  first: ResilienceStarScore;
}

/** Regroupe N passages par entreprise et marque stable = tous les totaux egaux. */
export function detectStable(runs: ResilienceStarScore[][]): Map<string, StabilityInfo> {
  const byName = new Map<string, ResilienceStarScore[]>();
  for (const run of runs) {
    for (const score of run) {
      const existing = byName.get(score.name) ?? [];
      existing.push(score);
      byName.set(score.name, existing);
    }
  }
  const result = new Map<string, StabilityInfo>();
  for (const [name, scores] of byName) {
    const totals = scores.map(s => s.total);
    const stable = totals.length > 0 && Math.max(...totals) - Math.min(...totals) === 0;
    result.set(name, { stable, totals, first: scores[0] });
  }
  return result;
}

export interface EscalationOptions {
  /** Nombre de passages CLI pour detecter la variance (defaut 2). */
  cliRuns?: number;
  model?: string;
}

export async function scoreWithEscalation(
  companies: CompanyBrief[],
  options: EscalationOptions = {},
): Promise<ResolvedScore[]> {
  if (companies.length === 0) return [];
  const cliRuns = Math.max(2, options.cliRuns ?? 2);

  const runs: ResilienceStarScore[][] = [];
  for (let i = 0; i < cliRuns; i += 1) {
    runs.push(await scoreCompanies(companies, { model: options.model }));
  }
  const detected = detectStable(runs);

  const litigious = companies.filter(company => !detected.get(company.name)?.stable);

  const apiByName = new Map<string, ResilienceStarScore>();
  if (litigious.length > 0 && hasApiKey()) {
    // Escalade individuelle (attention maximale) a temperature 0.
    for (const company of litigious) {
      const [score] = await scoreCompaniesApi([company], { model: options.model, temperature: 0 });
      apiByName.set(company.name, score);
    }
  }

  return companies.map(company => {
    const info = detected.get(company.name);
    if (!info) throw new Error(`Pas de resultat CLI pour ${company.name}`);
    if (info.stable) {
      return { ...info.first, source: 'cli-stable', cliTotals: info.totals };
    }
    const resolved = apiByName.get(company.name);
    if (resolved) {
      return { ...resolved, source: 'api-resolved', cliTotals: info.totals };
    }
    // Litigieux mais pas de cle API : on renvoie le 1er passage, marque non resolu.
    return { ...info.first, source: 'cli-unresolved', cliTotals: info.totals };
  });
}
