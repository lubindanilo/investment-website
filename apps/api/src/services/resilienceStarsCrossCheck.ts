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
 * - `resolved`: desaccord initial, mais le passage Sonnet retenu apres escalade rejoint V3.
 * - `flagged` : desaccord persistant -> revue humaine de Lubin (cas dur/ambigu).
 *
 * On ne paie les 2 passages Sonnet supplementaires QUE sur les desaccords : la
 * majorite (facile) ne coute qu'un passage Sonnet + un passage V3.
 */
export type CrossCheckVerdict = 'agree' | 'resolved' | 'flagged';

export interface CrossCheckedScore extends ResilienceStarScore {
  /** Totaux Sonnet dans l'ordre des passages : 1 si accord d'emblee, 2 ou 3 si escalade. */
  sonnetTotals: number[];
  v3Total: number | null;
  verdict: CrossCheckVerdict;
}

/**
 * Total Sonnet retenu : TOUJOURS une valeur qu'un passage a reellement produite.
 *
 * Les 5 criteres valent 0 / 0,5 ou 1 (voir CRITERION_KEYS et aggregateTotal), donc un total tombe
 * forcement sur la demi-etoile. Prendre la MOYENNE des deux valeurs centrales d'une liste PAIRE
 * fabriquait deux defauts : un total au quart d'etoile, contredit par le detail des 5 etoiles
 * affiche a cote (UA a porte 0,75/5 en prod le 11/08/2026), et un verdict `resolved` prononce sur
 * une note qu'aucun passage n'avait donnee.
 *
 * Une liste paire n'est pas une curiosite : l'escalade tente 2 passages supplementaires, mais
 * `sonnetChunked` avale l'echec d'un lot, donc il peut n'en revenir qu'un.
 *
 * Le departage se fait par proximite avec l'avis V3, et a egalite stricte de distance par le total
 * le plus bas (prudence : une etoile de resilience surevaluee trompe plus qu'une sous-evaluee).
 * Ce critere-la couple le total retenu au controle croise et penche donc vers `resolved` : choix
 * assume, la liste paire signalant deja un run degrade.
 */
export function pickSonnetTotal(totals: number[], v3: number | null): number {
  if (totals.length === 0) return Number.NaN;
  const sorted = [...totals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid]!;
  const low = sorted[mid - 1]!;
  const high = sorted[mid]!;
  if (v3 == null) return low;
  return Math.abs(high - v3) < Math.abs(low - v3) ? high : low;
}

/**
 * Le passage retenu en ENTIER, criteres compris.
 *
 * Recopier le seul total sur les criteres du passage de BASE laissait le detail contredire le total
 * des que l'escalade retenait un autre passage : `[3, 4, 4]` affichait 4 etoiles au-dessus d'un
 * detail qui en somme 3. L'UI lit les deux champs de la meme ligne (ResilienceStars.tsx), ils
 * doivent donc venir du meme passage — ce qui maintient `aggregateTotal(criteria) === total`.
 *
 * Les totaux etant des multiples exacts de 0,5, la comparaison par egalite est sure. A total egal
 * le premier passage gagne, donc la base est preferee : la note ne bouge pas sans raison.
 */
export function pickSonnetPass(
  passes: ResilienceStarScore[],
  v3: number | null,
): ResilienceStarScore | undefined {
  const total = pickSonnetTotal(
    passes.map(p => p.total),
    v3,
  );
  return passes.find(p => p.total === total);
}

/** Logique pure de verdict (testable sans LLM). */
export function classifyVerdict(
  sonnetBase: number,
  sonnetRetained: number,
  v3: number | null,
  threshold: number,
): CrossCheckVerdict {
  if (v3 == null) return 'flagged';
  if (Math.abs(sonnetBase - v3) <= threshold) return 'agree';
  if (Math.abs(sonnetRetained - v3) <= threshold) return 'resolved';
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

/**
 * Un lot Sonnet qui echoue n'emporte que son lot.
 *
 * Sans ce filet, un seul appel en timeout ou une reponse mal formee fait remonter l'exception
 * jusqu'en haut et jette le scoring de TOUTES les autres entreprises du run. Les entreprises du lot
 * perdu ressortent simplement sans note, donc non ecrites, donc repiochees au run suivant.
 */
async function sonnetChunked(
  companies: CompanyBrief[],
  chunkSize: number,
  timeoutMs: number,
  model?: string,
): Promise<ResilienceStarScore[]> {
  const out: ResilienceStarScore[] = [];
  for (let i = 0; i < companies.length; i += chunkSize) {
    const group = companies.slice(i, i + chunkSize);
    try {
      out.push(...(await scoreCompanies(group, { model, timeoutMs })));
    } catch (error) {
      const first = (error as Error).message.split('\n')[0];
      console.warn(`[resilience] Sonnet : lot de ${group.length} perdu, on continue (${first}).`);
    }
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

  // Escalade uniquement sur les entreprises que Sonnet a notees : sans note de base il n'y a rien
  // a arbitrer, et l'entreprise ressortira sans resultat.
  const disagreeing = companies.filter(c => {
    const s = sonnetBase.get(c.name)?.total;
    if (s == null) return false;
    const v = v3.get(c.name);
    return v == null || Math.abs(s - v) > threshold;
  });

  // On garde les passages ENTIERS, pas leurs seuls totaux : les criteres du passage retenu partent
  // en base avec son total, sans quoi le detail affiche contredirait le total (voir pickSonnetPass).
  const extraSonnet = new Map<string, ResilienceStarScore[]>();
  for (let pass = 0; pass < 2 && disagreeing.length > 0; pass += 1) {
    const run = await sonnetChunked(disagreeing, chunkSize, timeoutMs, options.sonnetModel);
    for (const s of run) {
      const arr = extraSonnet.get(s.name) ?? [];
      arr.push(s);
      extraSonnet.set(s.name, arr);
    }
  }

  // Une entreprise sans note Sonnet est OMISE, jamais une exception : elle serait sinon en train
  // d'annuler le travail deja fait sur les autres. L'appelant la comptera et la repiochera.
  return companies.flatMap(company => {
    const base = sonnetBase.get(company.name);
    if (!base) {
      console.warn(`[resilience] Sonnet : aucune note pour ${company.name}, entreprise reportee.`);
      return [];
    }
    const v = v3.get(company.name) ?? null;
    const passes = [base, ...(extraSonnet.get(company.name) ?? [])];
    const retained = pickSonnetPass(passes, v) ?? base;
    const verdict = classifyVerdict(base.total, retained.total, v, threshold);
    return [{ ...retained, sonnetTotals: passes.map(p => p.total), v3Total: v, verdict }];
  });
}
