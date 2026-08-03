import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { scoreCompanies, type ResilienceStarScore } from './resilienceStars.js';

/**
 * Runner de cron du modele Resilience 5 etoiles.
 *
 * Principes (la Resilience est un score LENT) :
 * - ordre de priorite = capitalisation boursiere DECROISSANTE (les plus grosses d'abord) ;
 * - plafond quotidien configurable (fraction de la limite Claude de l'utilisateur) ;
 * - scores persistes : on ne re-score jamais une entreprise deja notee (sauf staleness) ;
 * - scoring en appels GROUPES via le CLI `claude` (aucune cle API).
 */
export interface UniverseEntry {
  ticker: string;
  name: string;
  marketCapUsd: number;
  /** Faits saillants (le brief fournit les faits, le bareme fournit le jugement). */
  brief: string;
}

export interface StoredScore extends ResilienceStarScore {
  ticker: string;
  marketCapUsd: number;
  scoredAt: string;
}

export type ScoreStore = Record<string, StoredScore>;

export interface CronOptions {
  dailyCap: number;
  storePath: string;
  /** Horodatage injecte (pas de Date.now cote logique, pour la testabilite). */
  now: string;
  model?: string;
  /** Re-score une entree plus vieille que N jours (0 = jamais re-scorer). */
  staleDays?: number;
}

export interface CronReport {
  scored: StoredScore[];
  skippedAlreadyScored: number;
  cappedOut: number;
  remaining: number;
  totalUniverse: number;
}

export async function loadStore(storePath: string): Promise<ScoreStore> {
  try {
    return JSON.parse(await readFile(storePath, 'utf8')) as ScoreStore;
  } catch {
    return {};
  }
}

export async function saveStore(storePath: string, store: ScoreStore): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function isStale(entry: StoredScore, now: string, staleDays: number): boolean {
  if (!staleDays || staleDays <= 0) return false;
  const ageMs = Date.parse(now) - Date.parse(entry.scoredAt);
  return ageMs >= staleDays * 24 * 60 * 60 * 1000;
}

/** Selectionne les entreprises a scorer aujourd'hui : capi desc, non deja scorees, plafonnees. */
export function selectDue(
  universe: UniverseEntry[],
  store: ScoreStore,
  options: Pick<CronOptions, 'dailyCap' | 'now' | 'staleDays'>,
): UniverseEntry[] {
  const ordered = [...universe].sort((a, b) => b.marketCapUsd - a.marketCapUsd);
  const due = ordered.filter(entry => {
    const existing = store[entry.ticker];
    return !existing || isStale(existing, options.now, options.staleDays ?? 0);
  });
  return due.slice(0, Math.max(0, options.dailyCap));
}

export async function runResilienceCron(
  universe: UniverseEntry[],
  options: CronOptions,
): Promise<CronReport> {
  const store = await loadStore(options.storePath);
  const due = selectDue(universe, store, options);

  let scored: StoredScore[] = [];
  if (due.length > 0) {
    const results = await scoreCompanies(
      due.map(entry => ({ name: entry.name, brief: entry.brief })),
      { model: options.model },
    );
    scored = due.map((entry, index) => ({
      ...results[index],
      ticker: entry.ticker,
      marketCapUsd: entry.marketCapUsd,
      scoredAt: options.now,
    }));
    for (const score of scored) store[score.ticker] = score;
    await saveStore(options.storePath, store);
  }

  const remaining = universe.filter(entry => !store[entry.ticker]).length;
  return {
    scored,
    skippedAlreadyScored: universe.length - due.length - remaining,
    cappedOut: Math.max(0, universe.filter(e => !store[e.ticker]).length),
    remaining,
    totalUniverse: universe.length,
  };
}
