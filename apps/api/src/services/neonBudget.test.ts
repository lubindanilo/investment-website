import { describe, it, expect } from 'vitest';
import { parseNeonUsage, computeDrainBudget, budgetToMinutes, calendarPeriod, resolveNeonProjectId, NEON_MIN_CU, type NeonGetter } from './neonBudget.js';

const NOW = new Date('2026-08-04T01:00:00Z');

describe('parseNeonUsage', () => {
  it('convertit les CU-secondes en CU-heures et déduit la taille de compute moyenne', () => {
    const u = parseNeonUsage({
      id: 'proj-1',
      compute_time_seconds: 36_000,   // 10 CU-h
      active_time_seconds: 72_000,    // 20 h d'éveil → 0,5 CU moyen
      consumption_period_start: '2026-08-01T00:00:00Z',
      consumption_period_end: '2026-09-01T00:00:00Z',
    }, NOW);
    expect(u.cuHours).toBeCloseTo(10, 6);
    expect(u.activeHours).toBeCloseTo(20, 6);
    expect(u.avgCu).toBeCloseTo(0.5, 6);
    expect(u.periodFromCalendar).toBe(false);
    expect(u.periodEnd.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('retombe sur le mois calendaire quand l API ne peuple pas la période', () => {
    // Neon renvoie `0001-01-01T00:00:00Z` sur certains états de projet.
    const u = parseNeonUsage({ id: 'p', consumption_period_end: '0001-01-01T00:00:00Z' }, NOW);
    expect(u.periodFromCalendar).toBe(true);
    expect(u.periodEnd.toISOString()).toBe(calendarPeriod(NOW).periodEnd.toISOString());
    expect(u.periodEnd.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('plancher 0,25 CU quand l éveil cumulé est trop faible pour être significatif', () => {
    const u = parseNeonUsage({ id: 'p', compute_time_seconds: 10, active_time_seconds: 40 }, NOW);
    expect(u.avgCu).toBe(NEON_MIN_CU);
  });

  it('champs de conso absents → zéro, pas NaN', () => {
    const u = parseNeonUsage({ id: 'p' }, NOW);
    expect(u.cuHours).toBe(0);
    expect(u.activeHours).toBe(0);
  });
});

describe('resolveNeonProjectId', () => {
  /** Faux getter : renvoie la réponse mappée au chemin, ou lève l'erreur associée. */
  const fake = (routes: Record<string, unknown>, calls: string[] = []): NeonGetter =>
    (async <T>(path: string): Promise<T> => {
      calls.push(path);
      const r = routes[path];
      if (r === undefined) throw new Error(`Neon API ${path} → HTTP 404 not mapped`);
      if (r instanceof Error) throw r;
      return r as T;
    }) as NeonGetter;

  it('un projectId explicite court-circuite tout appel réseau', async () => {
    const calls: string[] = [];
    const id = await resolveNeonProjectId({ apiKey: 'k', projectId: 'proj-fixe', get: fake({}, calls) });
    expect(id).toBe('proj-fixe');
    expect(calls).toEqual([]);
  });

  it('compte simple : prend le projet unique de /projects', async () => {
    const id = await resolveNeonProjectId({ apiKey: 'k', get: fake({ '/projects': { projects: [{ id: 'solo' }] } }) });
    expect(id).toBe('solo');
  });

  it('compte organisation : enchaîne sur les orgs quand /projects répond 400 org_id is required', async () => {
    const calls: string[] = [];
    const id = await resolveNeonProjectId({
      apiKey: 'k',
      get: fake({
        '/projects': new Error('Neon API /projects → HTTP 400 {"message":"org_id is required, you can find it on your organization settings page"}'),
        '/users/me/organizations': { organizations: [{ id: 'org-abc' }] },
        '/projects?org_id=org-abc': { projects: [{ id: 'proj-de-l-org' }] },
      }, calls),
    });
    expect(id).toBe('proj-de-l-org');
    expect(calls).toEqual(['/projects', '/users/me/organizations', '/projects?org_id=org-abc']);
  });

  it('orgId fourni : pas de découverte des organisations', async () => {
    const calls: string[] = [];
    const id = await resolveNeonProjectId({
      apiKey: 'k',
      orgId: 'org-xyz',
      get: fake({
        '/projects': { projects: [] },
        '/projects?org_id=org-xyz': { projects: [{ id: 'p1' }] },
      }, calls),
    });
    expect(id).toBe('p1');
    expect(calls).not.toContain('/users/me/organizations');
  });

  it('plusieurs projets : refuse de deviner et liste les identifiants', async () => {
    await expect(resolveNeonProjectId({
      apiKey: 'k',
      get: fake({ '/projects': { projects: [{ id: 'a' }, { id: 'b' }] } }),
    })).rejects.toThrow(/2 projets Neon.*a, b/);
  });

  it('aucune organisation : message qui dit quoi renseigner', async () => {
    await expect(resolveNeonProjectId({
      apiKey: 'k',
      get: fake({ '/projects': { projects: [] }, '/users/me/organizations': { organizations: [] } }),
    })).rejects.toThrow(/NEON_PROJECT_ID/);
  });

  it('une autre erreur HTTP n est pas confondue avec le cas organisation', async () => {
    await expect(resolveNeonProjectId({
      apiKey: 'k',
      get: fake({ '/projects': new Error('Neon API /projects → HTTP 401 credentials do not pass authentication') }),
    })).rejects.toThrow(/401/);
  });
});

describe('computeDrainBudget', () => {
  const base = { periodEnd: new Date('2026-09-01T00:00:00Z'), now: NOW, monthlyCuH: 100, targetShare: 0.8, drainShare: 0.5 };

  it('lisse le solde sur les jours restants puis n en prend que la part du drain', () => {
    // Plafond 80 CU-h, 20 consommées → 60 de solde sur 28 j (01/08 → 01/09) = 2,142/j, moitié au drain.
    const b = computeDrainBudget({ ...base, usedCuH: 20 });
    expect(b.ceilingCuH).toBe(80);
    expect(b.remainingCuH).toBeCloseTo(60, 6);
    expect(b.daysLeft).toBe(28);
    expect(b.dailyCuH).toBeCloseTo(60 / 28, 6);
    expect(b.allowanceCuH).toBeCloseTo(60 / 28 / 2, 6);
    expect(b.exhausted).toBe(false);
  });

  it('plafond atteint → exhausted, allocation nulle (le run doit être sauté)', () => {
    const b = computeDrainBudget({ ...base, usedCuH: 85 });
    expect(b.exhausted).toBe(true);
    expect(b.remainingCuH).toBe(0);
    expect(b.allowanceCuH).toBe(0);
  });

  it('marge de 20 % respectée : on n alloue rien au-delà de 80 des 100 CU-h', () => {
    const b = computeDrainBudget({ ...base, usedCuH: 80 });
    expect(b.exhausted).toBe(true);
  });

  it('période déjà terminée → au moins 1 jour, jamais de division par zéro', () => {
    const b = computeDrainBudget({ ...base, usedCuH: 0, periodEnd: new Date('2026-08-01T00:00:00Z') });
    expect(b.daysLeft).toBe(1);
    expect(b.allowanceCuH).toBeCloseTo(40, 6);
  });
});

describe('budgetToMinutes', () => {
  it('convertit les CU-heures en minutes à la taille de compute mesurée', () => {
    expect(budgetToMinutes(1, 0.25)).toBe(240);   // 1 CU-h au plancher = 4 h d éveil
    expect(budgetToMinutes(1, 0.5)).toBe(120);
    expect(budgetToMinutes(1, 2)).toBe(30);       // autoscale à 2 CU = 8× plus cher à l heure
  });

  it('ne descend jamais sous le plancher de compute (sinon durée surestimée)', () => {
    expect(budgetToMinutes(1, 0.01)).toBe(240);
  });

  it('budget nul ou négatif → aucune minute', () => {
    expect(budgetToMinutes(0, 0.25)).toBe(0);
    expect(budgetToMinutes(-1, 0.25)).toBe(0);
  });
});
