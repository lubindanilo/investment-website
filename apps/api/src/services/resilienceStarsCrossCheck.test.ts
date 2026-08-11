import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pickSonnetTotal,
  pickSonnetPass,
  classifyVerdict,
  scoreWithCrossCheck,
} from './resilienceStarsCrossCheck.js';
import {
  aggregateTotal,
  scoreCompanies,
  CRITERION_KEYS,
  type CriterionKey,
  type CriterionScore,
  type ResilienceStarScore,
} from './resilienceStars.js';
import { scoreCompaniesDeepseek } from './resilienceStarsDeepseek.js';

vi.mock('./resilienceStars.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./resilienceStars.js')>()),
  scoreCompanies: vi.fn(),
}));
vi.mock('./resilienceStarsDeepseek.js', () => ({ scoreCompaniesDeepseek: vi.fn() }));

/** La grille complete d'un total legal : {0, 0,5, 1, ..., 5}. */
const LEGAL_TOTALS = Array.from({ length: 11 }, (_, i) => i / 2);

/** Un jeu de criteres qui somme exactement `total` (0 a 5, par pas de 0,5). */
function criteriaFor(total: number): Record<CriterionKey, CriterionScore> {
  let left = total;
  return Object.fromEntries(
    CRITERION_KEYS.map(key => {
      const star = Math.min(1, Math.max(0, left >= 1 ? 1 : left)) as 0 | 0.5 | 1;
      left -= star;
      return [key, { star, justification: `${key} a ${star}` }];
    }),
  ) as Record<CriterionKey, CriterionScore>;
}

function pass(name: string, total: number): ResilienceStarScore {
  return { name, criteria: criteriaFor(total), total, model: 'sonnet-test' };
}

describe('criteriaFor (garde-fou du helper de test)', () => {
  it('somme bien au total demande sur toute la grille', () => {
    for (const total of LEGAL_TOTALS) {
      expect(aggregateTotal(criteriaFor(total))).toBe(total);
    }
  });
});

describe('pickSonnetTotal', () => {
  it('longueur impaire : la valeur du milieu', () => {
    expect(pickSonnetTotal([4.5, 3, 4], 3)).toBe(4);
    expect(pickSonnetTotal([2.5], 4)).toBe(2.5);
  });

  it('longueur paire : la centrale la plus proche de V3, jamais leur moyenne', () => {
    expect(pickSonnetTotal([3, 4], 4)).toBe(4);
    expect(pickSonnetTotal([3, 4], 3)).toBe(3);
    // Le cas de prod : la moyenne aurait sorti 0,75, hors grille.
    expect(pickSonnetTotal([0.5, 1], 1)).toBe(1);
    expect(pickSonnetTotal([0.5, 1], 0)).toBe(0.5);
  });

  it('longueur paire, V3 pile au milieu : la plus basse (prudence, deterministe)', () => {
    expect(pickSonnetTotal([3, 4], 3.5)).toBe(3);
  });

  it('longueur paire sans avis V3 : la plus basse', () => {
    expect(pickSonnetTotal([3, 4], null)).toBe(3);
  });

  it('ne renvoie jamais autre chose qu un total deja produit par un passage', () => {
    for (const a of LEGAL_TOTALS) {
      for (const b of LEGAL_TOTALS) {
        for (const v of [...LEGAL_TOTALS, null]) {
          expect([a, b]).toContain(pickSonnetTotal([a, b], v));
        }
      }
    }
  });

  it('liste vide : NaN (aucun passage a retenir)', () => {
    expect(pickSonnetTotal([], 3)).toBeNaN();
  });
});

describe('pickSonnetPass', () => {
  it('renvoie le passage retenu avec SES criteres, pas ceux de la base', () => {
    const passes = [pass('Acme', 3), pass('Acme', 4), pass('Acme', 4)];
    const retained = pickSonnetPass(passes, 4)!;
    expect(retained.total).toBe(4);
    expect(aggregateTotal(retained.criteria)).toBe(4);
  });

  it('a total egal, la base gagne : la note ne bouge pas sans raison', () => {
    const base = pass('Acme', 3);
    expect(pickSonnetPass([base, pass('Acme', 3)], 3)).toBe(base);
  });

  it('un seul passage : lui-meme', () => {
    const base = pass('Acme', 2.5);
    expect(pickSonnetPass([base], 1)).toBe(base);
  });
});

describe('classifyVerdict', () => {
  const t = 0.5;
  it('agree quand Sonnet(1) et V3 concordent', () => {
    expect(classifyVerdict(4, 4, 3.5, t)).toBe('agree');
    expect(classifyVerdict(4, 4, 4, t)).toBe('agree');
  });
  it('resolved quand le passage retenu rejoint V3 apres desaccord', () => {
    // base 4.5 s'ecarte de V3 3 (>0,5), mais le passage retenu a 3 rejoint V3
    expect(classifyVerdict(4.5, 3, 3, t)).toBe('resolved');
  });
  it('flagged quand le desaccord persiste', () => {
    expect(classifyVerdict(4.5, 4.5, 3, t)).toBe('flagged');
  });
  it('flagged quand V3 manque', () => {
    expect(classifyVerdict(4, 4, null, t)).toBe('flagged');
  });
});

describe('scoreWithCrossCheck', () => {
  const sonnet = vi.mocked(scoreCompanies);
  const deepseek = vi.mocked(scoreCompaniesDeepseek);

  beforeEach(() => {
    // Les lots perdus sont un chemin NORMAL ici : on ne veut pas leur avertissement a l'ecran.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  /**
   * Chaque appel Sonnet du run renvoie le lot de totaux prevu ; `null` = lot perdu.
   *
   * `mockReset` et pas `mockClear` : la file des `...Once` SURVIT a un simple clear, et un passage
   * non consomme d'un cas precedent viendrait repondre au cas suivant.
   */
  function sonnetReturns(...runs: (number[] | null)[]): void {
    sonnet.mockReset();
    for (const totals of runs) {
      if (totals === null) sonnet.mockRejectedValueOnce(new Error('lot Sonnet perdu (timeout)'));
      else sonnet.mockResolvedValueOnce(totals.map(total => pass('Acme', total)));
    }
  }

  const acme = [{ name: 'Acme', brief: 'faits' }];

  it('accord d emblee : un seul passage Sonnet, verdict agree', async () => {
    sonnetReturns([4]);
    deepseek.mockResolvedValue([pass('Acme', 4)]);

    const [score] = await scoreWithCrossCheck(acme);

    expect(score!.total).toBe(4);
    expect(score!.sonnetTotals).toEqual([4]);
    expect(score!.verdict).toBe('agree');
    expect(sonnet).toHaveBeenCalledTimes(1);
  });

  it('escalade complete : le total ET les criteres viennent du passage retenu', async () => {
    // base 1, puis 2 passages a 4 : le detail affiche doit sommer 4, pas 1.
    sonnetReturns([1], [4], [4]);
    deepseek.mockResolvedValue([pass('Acme', 4)]);

    const [score] = await scoreWithCrossCheck(acme);

    expect(score!.sonnetTotals).toEqual([1, 4, 4]);
    expect(score!.total).toBe(4);
    expect(aggregateTotal(score!.criteria)).toBe(4);
    expect(score!.verdict).toBe('resolved');
  });

  it('escalade a un seul passage rendu : pas de quart d etoile, pas de note fantome', async () => {
    // Le 2e passage d'escalade perd son lot -> sonnetTotals de longueur PAIRE.
    // L'ancienne moyenne sortait (0,5 + 1) / 2 = 0,75 : le 0,75/5 porte par UA en prod.
    sonnetReturns([0.5], [1], null);
    deepseek.mockResolvedValue([pass('Acme', 4)]);

    const [score] = await scoreWithCrossCheck(acme);

    expect(score!.sonnetTotals).toEqual([0.5, 1]);
    expect(score!.total).toBe(1);
    expect(LEGAL_TOTALS).toContain(score!.total);
    expect(aggregateTotal(score!.criteria)).toBe(score!.total);
    // Le desaccord avec V3 tient toujours : la revue humaine reste demandee.
    expect(score!.verdict).toBe('flagged');
  });

  it('toute l escalade perdue : on retombe sur la base, flagged pour revue humaine', async () => {
    sonnetReturns([1], null, null);
    deepseek.mockResolvedValue([pass('Acme', 4)]);

    const [score] = await scoreWithCrossCheck(acme);

    expect(score!.sonnetTotals).toEqual([1]);
    expect(score!.total).toBe(1);
    expect(score!.verdict).toBe('flagged');
  });

  it('sans note Sonnet, l entreprise est omise et non notee a l aveugle', async () => {
    sonnetReturns(null);
    deepseek.mockResolvedValue([pass('Acme', 4)]);

    expect(await scoreWithCrossCheck(acme)).toEqual([]);
  });

  /**
   * L'invariant que le bug UA a viole, sur TOUTES les formes de run : escalade complete, escalade
   * partielle (le cas paire), escalade entierement perdue, avec ou sans avis V3.
   *
   * La grille des totaux legaux est balayee exhaustivement par le test de `pickSonnetTotal` plus
   * haut ; ici on verifie le CABLAGE, c'est-a-dire que le total ecrit, ses criteres et la liste des
   * passages racontent tous la meme chose.
   */
  it('aucun total hors de {0, 0,5, ..., 5}, et le detail somme toujours au total', async () => {
    // Ecarts volontairement larges pour que chaque forme passe par l'escalade. `null` = lot perdu.
    const shapes: { base: number; p1: number | null; p2: number | null }[] = [];
    for (const base of [0, 0.5, 2.5, 4.5, 5]) {
      for (const p1 of [0, 1, 2.5, 4, 5, null]) {
        for (const p2 of [0, 1, 2.5, 4, 5, null]) shapes.push({ base, p1, p2 });
      }
    }

    for (const { base, p1, p2 } of shapes) {
      for (const v of [0, 0.5, 2.5, 5, null]) {
        sonnetReturns([base], p1 === null ? null : [p1], p2 === null ? null : [p2]);
        deepseek.mockResolvedValue(v === null ? [] : [pass('Acme', v)]);

        const [score] = await scoreWithCrossCheck(acme);
        const context = `base=${base} p1=${p1} p2=${p2} v3=${v}`;

        expect(LEGAL_TOTALS, context).toContain(score!.total);
        expect(aggregateTotal(score!.criteria), context).toBe(score!.total);
        expect(score!.sonnetTotals, context).toContain(score!.total);
      }
    }
  });
});
