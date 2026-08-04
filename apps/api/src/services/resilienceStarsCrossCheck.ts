import { scoreCompanies, type CompanyBrief, type ResilienceStarScore } from './resilienceStars.js';
import { scoreCompaniesDeepseek } from './resilienceStarsDeepseek.js';

/**
 * Notation a deux modeles, meilleur rapport efficacite/cout :
 *
 * - Cheval de trait : Sonnet via le CLI `claude` (abonnement, ~0 $ marginal),
 *   le modele le plus valide. Un passage de base ; on n'en refait que sur desaccord.
 * - Controle croise : DeepSeek-V3 (architecture differente, ~1,5 $/1000) pour
 *   attraper le BIAIS que Sonnet ne voit pas sur lui-meme.
 *
 * Verdict :
 * - `agree`   : Sonnet(1 passage) et V3 concordent (<= seuil). Accepte.
 * - `resolved`: desaccord initial, mais la mediane de 3 passages Sonnet rejoint V3.
 * - `flagged` : desaccord persistant -> revue humaine de Lubin (cas dur/ambigu).
 *
 * On ne paie les 2 passages Sonnet supplementaires QUE sur les desaccords : la
 * majorite (facile) ne coute qu'un passage Sonnet + un passage V3.
 */
export type CrossCheckVerdict = 'agree' | 'resolved' | 'flagged';

export interface CrossCheckedScore extends ResilienceStarScore {
  /** Totaux Sonnet (1 si accord d'emblee, 3 si escalade). */
  sonnetTotals: number[];
  v3Total: number | null;
  verdict: CrossCheckVerdict;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return Number.NaN;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Logique pure de verdict (testable sans LLM). */
export function classifyVerdict(
  sonnetBase: number,
  sonnetMedian: number,
  v3: number | null,
  threshold: number,
): CrossCheckVerdict {
  if (v3 == null) return 'flagged';
  if (Math.abs(sonnetBase - v3) <= threshold) return 'agree';
  if (Math.abs(sonnetMedian - v3) <= threshold) return 'resolved';
  return 'flagged';
}

export interface CrossCheckOptions {
  /** Taille des lots pour le CLI Sonnet (evite les timeouts). Defaut 6. */
  chunkSize?: number;
  /** Timeout par lot Sonnet (ms). Defaut 180000. */
  timeoutMs?: number;
  /** Ecart <= seuil = concordance. Defaut 0,5 etoile. */
  threshold?: number;
  sonnetModel?: string;
  v3Model?: string;
}

async function sonnetChunked(
  companies: CompanyBrief[],
  chunkSize: number,
  timeoutMs: number,
  model?: string,
): Promise<ResilienceStarScore[]> {
  const out: ResilienceStarScore[] = [];
  for (let i = 0; i < companies.length; i += chunkSize) {
    const group = companies.slice(i, i + chunkSize);
    out.push(...(await scoreCompanies(group, { model, timeoutMs })));
  }
  return out;
}

export async function scoreWithCrossCheck(
  companies: CompanyBrief[],
  options: CrossCheckOptions = {},
): Promise<CrossCheckedScore[]> {
  if (companies.length === 0) return [];
  const chunkSize = options.chunkSize ?? 6;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const threshold = options.threshold ?? 0.5;

  const sonnetBase = new Map(
    (await sonnetChunked(companies, chunkSize, timeoutMs, options.sonnetModel)).map(s => [s.name, s]),
  );
  const v3 = new Map(
    (await scoreCompaniesDeepseek(companies, { model: options.v3Model })).map(s => [s.name, s.total]),
  );

  const disagreeing = companies.filter(c => {
    const s = sonnetBase.get(c.name)?.total;
    const v = v3.get(c.name);
    return s == null || v == null || Math.abs(s - v) > threshold;
  });

  const extraSonnet = new Map<string, number[]>();
  for (let pass = 0; pass < 2 && disagreeing.length > 0; pass += 1) {
    const run = await sonnetChunked(disagreeing, chunkSize, timeoutMs, options.sonnetModel);
    for (const s of run) {
      const arr = extraSonnet.get(s.name) ?? [];
      arr.push(s.total);
      extraSonnet.set(s.name, arr);
    }
  }

  return companies.map(company => {
    const base = sonnetBase.get(company.name);
    if (!base) throw new Error(`Sonnet: aucun score pour ${company.name}`);
    const v = v3.get(company.name) ?? null;
    const sonnetTotals = [base.total, ...(extraSonnet.get(company.name) ?? [])];
    const med = median(sonnetTotals);
    const verdict = classifyVerdict(base.total, med, v, threshold);
    return { ...base, total: med, sonnetTotals, v3Total: v, verdict };
  });
}
