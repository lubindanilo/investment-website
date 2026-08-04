/**
 * Test de concurrence du décompte de quota.
 *
 * Ce que ça vérifie : dix appels SIMULTANÉS sur un palier à un seul audit n'en laissent
 * passer qu'un. C'est le contrat de facturation ; sans lui, un utilisateur gratuit obtient
 * autant d'audits qu'il ouvre d'onglets.
 *
 * Comment : on remplace Prisma par un faux qui applique la clause `where` d'`updateMany`
 * contre un état en mémoire. Node étant mono-thread, chaque appel est naturellement atomique
 * — c'est exactement la garantie que Postgres apporte par verrou de ligne. Le test valide donc
 * la LOGIQUE (condition portée par l'écriture) et non le moteur.
 *
 * Ce test échoue sur le motif naïf lire-puis-écrire : les dix lectures voient 0 et passent.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row {
  id: string;
  subscriptionStatus: string;
  subscriptionCurrentPeriodEnd: Date | null;
  seoTier: string;
  monthlyAuditCount: number;
  monthlyAuditResetAt: Date;
  dailyAnalysisCount: number;
  dailyAnalysisResetAt: Date;
}

let row: Row;

function freshRow(over: Partial<Row> = {}): Row {
  return {
    id: 'u1',
    subscriptionStatus: 'free',
    subscriptionCurrentPeriodEnd: null,
    seoTier: 'free',
    monthlyAuditCount: 0,
    monthlyAuditResetAt: new Date(),
    dailyAnalysisCount: 0,
    dailyAnalysisResetAt: new Date(),
    ...over,
  };
}

/** Applique les seules formes de `where` que gating.ts utilise. */
function matches(where: Record<string, unknown>): boolean {
  if (where.id && where.id !== row.id) return false;
  for (const [field, cond] of Object.entries(where)) {
    if (field === 'id') continue;
    const cur = (row as unknown as Record<string, unknown>)[field];
    if (cond && typeof cond === 'object' && 'lt' in (cond as object)) {
      const lt = (cond as { lt: number | Date }).lt;
      const a = cur instanceof Date ? cur.getTime() : Number(cur);
      const b = lt instanceof Date ? lt.getTime() : Number(lt);
      if (!(a < b)) return false;
    } else if (cur !== cond) return false;
  }
  return true;
}

vi.mock('../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({ ...row })),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!matches(where)) return { count: 0 };
        for (const [field, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as object)) {
            const inc = (value as { increment: number }).increment;
            (row as unknown as Record<string, number>)[field] =
              Number((row as unknown as Record<string, unknown>)[field]) + inc;
          } else {
            (row as unknown as Record<string, unknown>)[field] = value;
          }
        }
        return { count: 1 };
      }),
    },
  },
}));

const { consumeAuditQuota, consumeAnalysisQuota } = await import('./gating.js');

describe('consumeAuditQuota — concurrence', () => {
  beforeEach(() => { row = freshRow(); });

  it('ne laisse passer qu’un seul audit sur dix appels simultanés en palier gratuit', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeAuditQuota('u1')));
    const passed = results.filter((r) => r.ok).length;
    expect(passed).toBe(1);
    expect(row.monthlyAuditCount).toBe(1);
  });

  it('refuse avec un message exploitable : compteur, limite et délai de libération', async () => {
    row = freshRow({ monthlyAuditCount: 1 });
    const r = await consumeAuditQuota('u1');
    expect(r.ok).toBe(false);
    expect(r.used).toBe(1);
    expect(r.limit).toBe(1);
    expect(r.resetInMinutes).toBeGreaterThan(0);
  });

  it('réarme la fenêtre après 30 jours, et une seule fois même en concurrence', async () => {
    row = freshRow({
      monthlyAuditCount: 1,
      monthlyAuditResetAt: new Date(Date.now() - 31 * 24 * 3600_000),
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => consumeAuditQuota('u1')));
    // Un seul réarmement, et il consomme déjà l'unique audit de la nouvelle fenêtre.
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(row.monthlyAuditCount).toBe(1);
  });

  it('laisse passer sans décompte quand le palier est illimité', async () => {
    row = freshRow({
      seoTier: 'solo',
      subscriptionStatus: 'active',
      subscriptionCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000),
    });
    const results = await Promise.all(Array.from({ length: 6 }, () => consumeAuditQuota('u1')));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(row.monthlyAuditCount).toBe(0); // aucun décompte sur un palier payant
  });
});

describe('consumeAnalysisQuota — même correctif', () => {
  beforeEach(() => { row = freshRow(); });

  it('plafonne à 10 analyses malgré 25 appels simultanés', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => consumeAnalysisQuota('u1')));
    expect(results.filter((r) => r.ok).length).toBe(10);
    expect(row.dailyAnalysisCount).toBe(10);
  });
});
