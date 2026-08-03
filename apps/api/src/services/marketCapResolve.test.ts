/**
 * Tests de resolveMarketCap. Tous les cas viennent de la PROD (audit du 03/08/2026), pas
 * d'exemples inventés : c'est ce qui rend la règle vérifiable, et ce qui a fait rejeter la
 * première version du correctif (préférer aveuglément la capi publiée cassait AGBK et AKO.A).
 */
import { describe, it, expect } from 'vitest';
import { resolveMarketCap, absoluteReportedCap, DISAGREEMENT_FACTOR, IMPLIED_SHARE_COUNT_MAX, MARKET_CAP_SANITY_MAX_USD } from './marketCapResolve.js';
import { marketCapToUsd } from './marketTiers.js';

const usd = (currency: string) => (v: number | null) => marketCapToUsd(v, currency);

describe('absoluteReportedCap — l\'unité dépend de la source', () => {
  it('Finnhub publie en millions', () => {
    // AAPL : 4 537 000 millions = 4 537 Md$
    expect(absoluteReportedCap('finnhub', 4_537_000)! / 1e12).toBeCloseTo(4.537, 3);
  });

  it('Yahoo remplit déjà le champ en unités absolues', () => {
    expect(absoluteReportedCap('yahoo', 1.897e11)).toBe(1.897e11);
  });

  it('rejette une valeur absente, nulle ou négative', () => {
    expect(absoluteReportedCap('finnhub', null)).toBeNull();
    expect(absoluteReportedCap('finnhub', 0)).toBeNull();
    expect(absoluteReportedCap('finnhub', -5)).toBeNull();
  });
});

describe('resolveMarketCap — cas normal : on garde le recalcul', () => {
  it('Apple : nombre d\'actions sain → prix × actions', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 4_537_000,
      price: 308.91,
      sharesOutstanding: 1.477e10,
    }, usd('USD'));
    expect(res.source).toBe('derived');
    expect(res.marketCap! / 1e12).toBeCloseTo(4.562, 2);
  });

  it('AGBK : on NE prend PAS les 12,4 Md$ publiés pour une nano-cap', () => {
    // Le recalcul donne 900 M$, la capi publiée 12,41 Md$. Le nombre d'actions étant sain,
    // c'est le recalcul qui gagne : sinon la société montait en « large cap ».
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 1.241e4,      // millions → 12,41 Md$
      price: 6.71,
      sharesOutstanding: 1.342e8,
    }, usd('USD'));
    expect(res.source).toBe('derived');
    expect(res.marketCap! / 1e8).toBeCloseTo(9.005, 2);
  });

  it('AHRT : même logique, 544 M$ recalculés plutôt que 9,9 Md$ publiés', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 9.906e3,
      price: 6.81,
      sharesOutstanding: 7.984e7,
    }, usd('USD'));
    expect(res.source).toBe('derived');
    expect(res.marketCap!).toBeLessThan(1e9);
  });

  it('chemin Yahoo : capi inchangée (actions et capi viennent de la même source)', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'yahoo',
      reportedMarketCap: 1.897e11,
      price: 162.5,
      sharesOutstanding: 1.167e9,
    }, usd('EUR'));
    expect(res.source).toBe('derived');
    expect(res.marketCap! / 1e11).toBeCloseTo(1.896, 2);
  });

  it('grande capi en devise faible : le plafond s\'applique en USD, pas en local', () => {
    // Toyota : 3,7e13 yens ≈ 246 Md$ → plausible malgré ses 14 chiffres.
    const res = resolveMarketCap({
      fundamentalsSource: 'yahoo',
      reportedMarketCap: 3.688e13,
      price: 2_800,
      sharesOutstanding: 1.317e10,
    }, usd('JPY'));
    expect(res.source).toBe('derived');
    expect(res.marketCap! / 1e13).toBeCloseTo(3.688, 2);
  });
});

describe('resolveMarketCap — contradiction franche : on prend la plus petite', () => {
  it('Seaboard : 9,6e11 actions écartées, la capi publiée prend le relais', () => {
    // Sans ça : 5 452 × 9,578e11 = 5 221 979 Md$, et la société classée « large cap ».
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 5_263,        // millions → 5,26 Md$
      price: 5_452.09,
      sharesOutstanding: 9.578e11,
    }, usd('USD'));
    expect(res.source).toBe('reported');
    expect(res.marketCap! / 1e9).toBeCloseTo(5.263, 2);
  });

  it('ACCS : micro-cap rendue à sa vraie tranche', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 2.294e1,      // millions → 22,94 M$
      price: 6.03,
      sharesOutstanding: 3.86e12,
    }, usd('USD'));
    expect(res.source).toBe('reported');
    expect(res.marketCap!).toBeLessThan(1e8);
  });

  it('AIRT : idem', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 6.084e1,
      price: 22.51,
      sharesOutstanding: 2.703e12,
    }, usd('USD'));
    expect(res.source).toBe('reported');
    expect(res.marketCap!).toBeLessThan(1e8);
  });

  it('les deux invraisemblables : null plutôt qu\'un chiffre faux', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 9e12,         // millions → 9e18
      price: 5_452,
      sharesOutstanding: 9.578e11,
    }, usd('USD'));
    expect(res.source).toBe('none');
    expect(res.marketCap).toBeNull();
  });
});

describe('resolveMarketCap — rien à recouper : on ne tranche pas', () => {
  it('AKO.A : capi publiée en pesos étiquetée USD → on refuse de classer', () => {
    // 3,781e6 millions = 3 781 Md$ pour une société de ~2 Md$ : la devise du champ ne
    // correspond pas à celle du titre. Sans nombre d'actions pour recouper, on renvoie null,
    // ce qui laisse le titre hors du filtre de capitalisation au lieu de le mettre en « large ».
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 3.781e6,
      price: 22.8,
      sharesOutstanding: null,
    }, usd('USD'));
    expect(res.source).toBe('none');
    expect(res.marketCap).toBeNull();
  });

  it('ni prix ni actions ni capi publiée : null', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'yahoo',
      reportedMarketCap: null,
      price: null,
      sharesOutstanding: null,
    }, usd('USD'));
    expect(res.source).toBe('none');
    expect(res.marketCap).toBeNull();
  });

  it('CME : sans nombre d\'actions, la capi publiée est gardée si elle est cohérente au prix', () => {
    // ~91 Md$ pour un titre à ~250 $ → 365 M d'actions implicites, parfaitement crédible.
    // La refuser aurait sorti du filtre 27 sociétés réelles (CME, Equinor, Allegion, Ameriprise…).
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 91_150,       // millions → 91,15 Md$
      price: 250,
      sharesOutstanding: null,
    }, usd('USD'));
    expect(res.source).toBe('reported');
    expect(res.marketCap! / 1e9).toBeCloseTo(91.15, 1);
  });

  it('prix ET actions manquants : la capi publiée passe si elle est plausible', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 5_000,
      price: null,
      sharesOutstanding: null,
    }, usd('USD'));
    expect(res.source).toBe('reported');
    expect(res.marketCap! / 1e9).toBeCloseTo(5, 3);
  });
});

describe('resolveMarketCap — bornes', () => {
  it('une base d\'actions énorme mais RÉELLE passe (banques chinoises, ~3,5e11)', () => {
    // Les deux sources s'accordent → aucune règle de contradiction ne se déclenche.
    const res = resolveMarketCap({
      fundamentalsSource: 'yahoo',
      reportedMarketCap: 1.61e12,
      price: 4.6,
      sharesOutstanding: 3.5e11,
    }, usd('CNY'));
    expect(res.source).toBe('derived');
    expect(res.marketCap! / 1e12).toBeCloseTo(1.61, 1);
  });

  it('le plafond d\'actions implicites laisse passer le plus gros flottant américain', () => {
    expect(IMPLIED_SHARE_COUNT_MAX).toBeGreaterThan(1.5e10);
  });

  it('le seuil de contradiction est au-dessus de tout mouvement d\'actions réel', () => {
    // Le plus gros split réaliste est de l'ordre de 50:1.
    expect(DISAGREEMENT_FACTOR).toBeGreaterThan(5);
  });

  it('le plafond de capi se situe au-dessus de la plus grosse capitalisation réelle', () => {
    expect(MARKET_CAP_SANITY_MAX_USD).toBeGreaterThan(5e12);
  });
});
