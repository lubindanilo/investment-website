/**
 * Tests du garde-fou de matérialité du dénominateur des ratios en × (dette nette / FCF).
 *
 * Pas de test bout-en-bout : getRatioTimeseries tape Finnhub + Yahoo. On teste le helper
 * pur, qui porte toute la décision « ce point est du bruit → on ne le trace pas ».
 */
import { describe, it, expect } from 'vitest';
import { dropImmaterialDenominator, MIN_DENOMINATOR_PCT_OF_REVENUE } from './derivedTimeseries.js';

const byDate = (d: string) => d;
const byYear = (d: string) => d.slice(0, 4);

describe('dropImmaterialDenominator', () => {
  it('écarte un FCF qui frôle 0 face au CA', () => {
    const fcf = [{ date: '2025-03-31', value: 0.07e9 }];
    const rev = [{ date: '2025-03-31', value: 650e9 }]; // 0,01 % du CA → bruit d'arrondi
    expect(dropImmaterialDenominator(fcf, rev, byDate)).toEqual([]);
  });

  it('garde un FCF matériel', () => {
    const fcf = [{ date: '2024-03-31', value: 45e9 }];
    const rev = [{ date: '2024-03-31', value: 590e9 }]; // 7,6 % du CA
    expect(dropImmaterialDenominator(fcf, rev, byDate)).toEqual(fcf);
  });

  /**
   * Anti-régression du calibrage : une mauvaise année de cash chez un distributeur reste un
   * signal VRAI, pas du bruit. WMT Q1-2022 (FCF ajusté 3,2 Md$ pour 590 Md$ de CA → 0,54 %,
   * dette nette/FCF ≈ 18×) doit rester tracé. Un seuil à 1 % du CA le supprimait.
   */
  it('garde un FCF faible mais réel (mauvaise année de cash, pas du bruit)', () => {
    const fcf = [{ date: '2022-04-30', value: 3.2e9 }];
    const rev = [{ date: '2022-04-30', value: 590e9 }];
    expect(dropImmaterialDenominator(fcf, rev, byDate)).toEqual(fcf);
  });

  /**
   * Cas réel qui a motivé le garde-fou : le graphe dette/FCF d'AMZN sur 5 ans ne sortait
   * que 3 points, dont un à −580× (dette nette −41 Md$ ÷ FCF ajusté SBC 0,07 Md$) qui
   * écrasait l'échelle. Après filtre, il ne reste que les deux points sensés.
   */
  it('ne laisse passer que les trimestres sensés sur la série AMZN', () => {
    const fcfAdjTtm = [
      { date: '2024-03-31', value: 21.5e9 },
      { date: '2024-06-30', value: 24.5e9 },
      { date: '2025-03-31', value: 0.07e9 }, // CFO ≈ CapEx + SBC → bruit d'arrondi
    ];
    const revenueTtm = [
      { date: '2024-03-31', value: 590e9 },
      { date: '2024-06-30', value: 604e9 },
      { date: '2025-03-31', value: 650e9 },
    ];
    expect(dropImmaterialDenominator(fcfAdjTtm, revenueTtm, byDate).map(p => p.date))
      .toEqual(['2024-03-31', '2024-06-30']);
  });

  it('juge un FCF négatif sur sa valeur absolue (le signe est traité par divideByDate)', () => {
    const rev = [{ date: '2026-03-31', value: 700e9 }];
    expect(dropImmaterialDenominator([{ date: '2026-03-31', value: -22e9 }], rev, byDate)).toHaveLength(1);
    expect(dropImmaterialDenominator([{ date: '2026-03-31', value: -0.05e9 }], rev, byDate)).toHaveLength(0);
  });

  /**
   * Même helper côté conversion cash, où le dénominateur est le résultat net. LUV Q3-2021
   * avait un bénéfice TTM à 0,008 % du CA → la conversion sortait à +1064×, et INTC Q4-2025
   * à 0,049 % → −283×. Deux ratios non définis, pas deux signaux.
   */
  it('écarte un résultat net qui frôle 0 (conversion cash)', () => {
    const rev = [{ date: '2021-09-30', value: 13.6e9 }, { date: '2025-12-27', value: 53e9 }];
    const ni = [{ date: '2021-09-30', value: 0.001e9 }, { date: '2025-12-27', value: 0.026e9 }];
    expect(dropImmaterialDenominator(ni, rev, byDate)).toEqual([]);
  });

  it('garde un résultat net faible mais réel (année de profit écrasé)', () => {
    // CVS Q3-2025 : bénéfice TTM à 0,11 % du CA → conversion 13×, moche mais vrai.
    const ni = [{ date: '2025-09-30', value: 0.42e9 }];
    const rev = [{ date: '2025-09-30', value: 385e9 }];
    expect(dropImmaterialDenominator(ni, rev, byDate)).toEqual(ni);
  });

  it('indexe par exercice sur le chemin annuel Yahoo (dates de clôture non alignées)', () => {
    const fcf = [{ date: '2025-06-30', value: 0.01e9 }, { date: '2024-06-30', value: 3e9 }];
    const rev = [{ date: '2025-06-28', value: 40e9 }, { date: '2024-06-29', value: 38e9 }];
    expect(dropImmaterialDenominator(fcf, rev, byYear).map(p => p.date)).toEqual(['2024-06-30']);
  });

  it('conserve le point si le CA de référence manque ou est absurde', () => {
    const fcf = [{ date: '2025-03-31', value: 0.07e9 }];
    expect(dropImmaterialDenominator(fcf, [], byDate)).toEqual(fcf);
    expect(dropImmaterialDenominator(fcf, [{ date: '2025-03-31', value: 0 }], byDate)).toEqual(fcf);
  });

  it('accepte pile au seuil', () => {
    const rev = [{ date: '2025-03-31', value: 100e9 }];
    const atThreshold = [{ date: '2025-03-31', value: 100e9 * MIN_DENOMINATOR_PCT_OF_REVENUE }];
    expect(dropImmaterialDenominator(atThreshold, rev, byDate)).toEqual(atThreshold);
  });
});
