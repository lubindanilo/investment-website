/**
 * Test du cooldown de la file « résultats tombés » du drain.
 *
 * CE QUE ÇA VERROUILLE. Le cooldown de 3 jours doit porter sur `lastAttemptAt` (quand le scoreur
 * est passé) et JAMAIS sur `lastScoredAt` (quand les fondamentaux ont réellement changé). Le second
 * n'est écrit que si l'empreinte des comptes bouge — c'est la garde de fraîcheur du `lastmod` du
 * sitemap — donc un titre re-noté dont le trimestre n'est pas encore publié en ressort INCHANGÉ.
 * Fonder l'éligibilité dessus rendait le cooldown inopérant : mesuré sur les logs des nuits du 08,
 * 09 et 10/08/2026, 264 des 762 titres notés le 10/08 l'avaient déjà été 24 h plus tôt, et 111
 * trois nuits d'affilée, pendant que la file `pending` restait figée à 19 840 titres.
 *
 * COMMENT. Prisma est remplacé par un faux qui APPLIQUE la clause `where` et le `orderBy` contre un
 * état en mémoire — même approche que mcp/quotaRace.test.ts. Le test valide donc la clause de
 * sélection, pas le moteur SQL. Sur le motif fautif (`lastScoredAt` dans le `where`), le premier cas
 * échoue : le titre passé la veille est repioché.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row {
  ticker: string;
  region: string;
  status: string;
  priority: number;
  nextEarningsDate: string | null;
  lastAttemptAt: Date | null;
  lastScoredAt: Date | null;
  marketCapUsd: number | null;
  attempts: number;
}

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse('2026-08-10T03:00:00Z');
let rows: Row[] = [];

function row(over: Partial<Row> & { ticker: string }): Row {
  return {
    region: 'US',
    status: 'scored',
    priority: 0,
    nextEarningsDate: '2026-07-25',
    lastAttemptAt: null,
    lastScoredAt: null,
    marketCapUsd: 1_000,
    attempts: 0,
    ...over,
  };
}

// ── Faux Prisma : applique where + orderBy + take sur `rows` ──────────────────────────────────
type Cmp = { lt?: Date | number; lte?: string; notIn?: string[] };

function matchField(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (typeof cond === 'object' && cond !== null) {
    const c = cond as Cmp;
    if (c.lt instanceof Date) return value instanceof Date && value.getTime() < c.lt.getTime();
    if (typeof c.lt === 'number') return typeof value === 'number' && value < c.lt;
    // `lte` porte ici sur nextEarningsDate, une date ISO stockée en texte. null n'est pas comparable :
    // c'est ce qui fait sortir de la file un titre dont la date du trimestre suivant est inconnue.
    if (c.lte !== undefined) return typeof value === 'string' && value <= c.lte;
    if (c.notIn !== undefined) return typeof value === 'string' && !c.notIn.includes(value);
    throw new Error(`condition non gérée par le faux : ${JSON.stringify(cond)}`);
  }
  return value === cond;
}

function matchWhere(r: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Record<string, unknown>[]).some(sub => matchWhere(r, sub));
    return matchField(r[key as keyof Row], cond);
  });
}

type SortSpec = 'asc' | 'desc' | { sort: 'asc' | 'desc'; nulls: 'first' | 'last' };

function compare(a: Row, b: Row, orderBy: Record<string, SortSpec>[]): number {
  for (const clause of orderBy) {
    const [key, spec] = Object.entries(clause)[0]!;
    const dir = typeof spec === 'string' ? spec : spec.sort;
    const nulls = typeof spec === 'string' ? 'last' : spec.nulls;
    const av = r2n(a[key as keyof Row]);
    const bv = r2n(b[key as keyof Row]);
    if (av === null && bv === null) continue;
    if (av === null) return nulls === 'first' ? -1 : 1;
    if (bv === null) return nulls === 'first' ? 1 : -1;
    if (av !== bv) return dir === 'asc' ? av - bv : bv - av;
  }
  return 0;
}

function r2n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return null;
}

interface FindArgs {
  where: Record<string, unknown>;
  orderBy: Record<string, SortSpec>[];
  take: number;
}

vi.mock('../db/client.js', () => ({
  prisma: {
    screenerTicker: {
      findMany: vi.fn(async ({ where, orderBy, take }: FindArgs) =>
        rows
          .filter(r => matchWhere(r, where))
          .sort((a, b) => compare(a, b, orderBy))
          .slice(0, take)
          .map(r => ({ ticker: r.ticker })),
      ),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter(r => matchWhere(r, where)).length,
      ),
    },
  },
}));

const { pickDue } = await import('./screenerDrain.js');

beforeEach(() => {
  vi.setSystemTime(NOW);
  rows = [];
});

describe('pickDue — file des résultats tombés', () => {
  it('ne repioche PAS un titre passé la veille dont les fondamentaux n ont pas bougé', async () => {
    // Le cas exact des 264 titres du 10/08/2026 : le scoreur est passé il y a 24 h (lastAttemptAt
    // récent) mais l'empreinte des comptes était identique, donc lastScoredAt est resté vieux.
    rows = [
      row({ ticker: 'SONY-BUG', lastAttemptAt: new Date(NOW - 1 * DAY), lastScoredAt: new Date(NOW - 40 * DAY) }),
    ];

    expect(await pickDue(10, undefined, [])).toEqual([]);
  });

  it('repioche le même titre une fois les 3 jours écoulés', async () => {
    rows = [
      row({ ticker: 'SONY-DUE', lastAttemptAt: new Date(NOW - 4 * DAY), lastScoredAt: new Date(NOW - 40 * DAY) }),
    ];

    expect(await pickDue(10, undefined, [])).toEqual(['SONY-DUE']);
  });

  it('garde éligible une ligne notée dont aucune tentative n est enregistrée', async () => {
    rows = [row({ ticker: 'LEGACY', lastAttemptAt: null, lastScoredAt: new Date(NOW - 90 * DAY) })];

    expect(await pickDue(10, undefined, [])).toEqual(['LEGACY']);
  });

  it('sort de la file le titre dont la date du trimestre suivant est publiée ou inconnue', async () => {
    rows = [
      row({ ticker: 'FUTURE', nextEarningsDate: '2026-11-02', lastAttemptAt: new Date(NOW - 40 * DAY) }),
      row({ ticker: 'UNKNOWN', nextEarningsDate: null, lastAttemptAt: new Date(NOW - 40 * DAY) }),
    ];

    expect(await pickDue(10, undefined, [])).toEqual([]);
  });

  it('trie sur la péremption de la NOTE, pas sur le dernier passage', async () => {
    // Même capitalisation → le tri secondaire départage. LATE a échoué récemment (lastAttemptAt
    // récent mais hors cooldown) et sa note est la plus vieille : elle doit passer devant.
    rows = [
      row({ ticker: 'FRESH', lastAttemptAt: new Date(NOW - 30 * DAY), lastScoredAt: new Date(NOW - 10 * DAY) }),
      row({ ticker: 'STALE', lastAttemptAt: new Date(NOW - 4 * DAY), lastScoredAt: new Date(NOW - 200 * DAY) }),
    ];

    expect(await pickDue(10, undefined, [])).toEqual(['STALE', 'FRESH']);
  });

  it('complète le lot avec des `pending` dès que la file earnings ne le remplit plus', async () => {
    // La raison d'être du correctif : ce qui n'est plus brûlé en re-scorings de 24 h revient au
    // backfill de couverture, resté figé à 19 840 titres deux nuits de suite.
    rows = [
      row({ ticker: 'DUE', lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'HOT', lastAttemptAt: new Date(NOW - 1 * DAY) }),
      row({ ticker: 'NEW1', status: 'pending', lastAttemptAt: null }),
      row({ ticker: 'NEW2', status: 'pending', lastAttemptAt: null }),
    ];

    expect(await pickDue(3, undefined, [])).toEqual(['DUE', 'NEW1', 'NEW2']);
  });

  it('reprend les erreurs non-US retentables avant les nouveaux titres', async () => {
    rows = [
      row({ ticker: 'GTT.PA', region: 'EU', status: 'error', attempts: 2, nextEarningsDate: null, lastAttemptAt: new Date(NOW - 20 * DAY) }),
      row({ ticker: 'NEW.PA', region: 'EU', status: 'pending', nextEarningsDate: null, lastAttemptAt: null }),
    ];

    expect(await pickDue(2, 'EU', [])).toEqual(['GTT.PA', 'NEW.PA']);
  });

  it('laisse de côté une erreur arrivée au plafond de tentatives', async () => {
    rows = [
      row({ ticker: 'ABANDON.PA', region: 'EU', status: 'error', attempts: 5, nextEarningsDate: null }),
    ];

    expect(await pickDue(10, 'EU', [])).toEqual([]);
  });

  it('réserve la moitié du lot aux `pending` même quand la file earnings déborde', async () => {
    // Le run du 02/09/2026 : 998 titres notés en 240 min, tous en rafraîchissement, zéro `pending`
    // pioché, la couverture figée à 19 840 depuis le 10/08. La réserve garantit que la nuit fait
    // avancer les deux files.
    rows = [
      row({ ticker: 'E1', marketCapUsd: 900, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E2', marketCapUsd: 800, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E3', marketCapUsd: 700, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E4', marketCapUsd: 600, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'P1', status: 'pending', nextEarningsDate: null, lastAttemptAt: null }),
      row({ ticker: 'P2', status: 'pending', nextEarningsDate: null, lastAttemptAt: null }),
      row({ ticker: 'P3', status: 'pending', nextEarningsDate: null, lastAttemptAt: null }),
    ];

    expect(await pickDue(4, undefined, [])).toEqual(['E1', 'E2', 'P1', 'P2']);
  });

  it('rend au rafraîchissement la réserve que les `pending` ne consomment pas', async () => {
    // Fin de backfill : un seul `pending` reste, la place libre revient aux résultats échus plutôt
    // que de sortir un lot incomplet.
    rows = [
      row({ ticker: 'E1', marketCapUsd: 900, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E2', marketCapUsd: 800, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E3', marketCapUsd: 700, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E4', marketCapUsd: 600, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'P1', status: 'pending', nextEarningsDate: null, lastAttemptAt: null }),
    ];

    expect(await pickDue(4, undefined, [])).toEqual(['E1', 'E2', 'P1', 'E3']);
  });

  it('à réserve nulle, retrouve l ordre strict « rafraîchissement d abord »', async () => {
    rows = [
      row({ ticker: 'E1', marketCapUsd: 900, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'E2', marketCapUsd: 800, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'P1', status: 'pending', nextEarningsDate: null, lastAttemptAt: null }),
    ];

    expect(await pickDue(2, undefined, [], 0)).toEqual(['E1', 'E2']);
  });

  it('écarte les tickers déjà tentés dans ce run', async () => {
    rows = [
      row({ ticker: 'A', marketCapUsd: 900, lastAttemptAt: new Date(NOW - 4 * DAY) }),
      row({ ticker: 'B', marketCapUsd: 800, lastAttemptAt: new Date(NOW - 4 * DAY) }),
    ];

    expect(await pickDue(10, undefined, ['A'])).toEqual(['B']);
  });
});
