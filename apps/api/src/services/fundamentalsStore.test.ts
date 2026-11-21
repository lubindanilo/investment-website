/**
 * Fusion du store : append-only par défaut, révision bornée aux dernières périodes quand la
 * source corrige un trimestre fraîchement publié (cas SK Hynix T2 2026).
 */
import { describe, it, expect } from 'vitest';
import { appendOnlyMerge, mergeWithRecentRevisions } from './fundamentalsStore.js';
import type { TimeseriesPoint } from '@lubin/shared';

const p = (date: string, value: number): TimeseriesPoint => ({ date, value });

// FCF SK Hynix (T₩) : la ligne 2026-06-30 stockée est la première version, fausse.
const STORED = [p('2025-12-31', 8.62), p('2026-03-31', 18.46), p('2026-06-30', -30.86), p('2026-09-30', 42.11)];
const LIVE = [p('2025-12-31', 8.99), p('2026-03-31', 18.67), p('2026-06-30', 54.74), p('2026-09-30', 40.82)];

describe('mergeWithRecentRevisions', () => {
  it('sans fenêtre de révision, se comporte comme appendOnlyMerge', () => {
    expect(mergeWithRecentRevisions(STORED, LIVE, 0)).toEqual(appendOnlyMerge(STORED, LIVE));
  });

  it('remplace les 2 dernières périodes révisées, garde les plus anciennes', () => {
    const merged = mergeWithRecentRevisions(STORED, LIVE, 2);
    expect(merged).toEqual([p('2025-12-31', 8.62), p('2026-03-31', 18.46), p('2026-06-30', 54.74), p('2026-09-30', 40.82)]);
  });

  it('ignore les écarts sous la tolérance (arrondis entre sources)', () => {
    const stored = [p('2026-06-30', 100), p('2026-09-30', 200)];
    const merged = mergeWithRecentRevisions(stored, [p('2026-06-30', 100.2), p('2026-09-30', 200.5)], 2);
    expect(merged).toEqual(stored);
  });

  it('apparie une date décalée de quelques jours sans créer de doublon', () => {
    const stored = [p('2026-06-28', -20), p('2026-09-30', 50)];
    const merged = mergeWithRecentRevisions(stored, [p('2026-06-30', 65), p('2026-09-30', 50)], 2);
    expect(merged).toEqual([p('2026-06-30', 65), p('2026-09-30', 50)]);
  });

  it('ajoute toujours une période nouvelle', () => {
    const merged = mergeWithRecentRevisions(STORED, [...LIVE, p('2026-12-31', 60)], 2);
    expect(merged.at(-1)).toEqual(p('2026-12-31', 60));
    expect(merged).toHaveLength(5);
    // 2026-06-30 sort de la fenêtre des 2 dernières : il n'est plus révisé.
    expect(merged.find(x => x.date === '2026-06-30')?.value).toBe(-30.86);
  });

  it('ne modifie pas le tableau stocké passé en entrée', () => {
    const stored = STORED.map(x => ({ ...x }));
    mergeWithRecentRevisions(stored, LIVE, 2);
    expect(stored).toEqual(STORED);
  });
});
