/**
 * Tests de resolveMarketCap. Tous les cas viennent de la PROD (audit du 03/08/2026), pas
 * d'exemples inventés : c'est ce qui rend la règle vérifiable, et ce qui a fait rejeter la
 * première version du correctif (préférer aveuglément la capi publiée cassait AGBK et AKO.A).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveMarketCap, absoluteReportedCap, reconcileAdsMarketCap,
  DISAGREEMENT_FACTOR, IMPLIED_SHARE_COUNT_MAX, MARKET_CAP_SANITY_MAX_USD, ADS_CONVENTION_FACTOR,
} from './marketCapResolve.js';
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

  /**
   * Cas EQNR mesuré en prod. Finnhub publie la capitalisation d'Equinor en COURONNES
   * (907 528 M NOK) alors que le titre est étiqueté USD — le travers d'AKO.A en pesos. Le nombre
   * d'actions était disponible (2,503e9), seul le prix manquait dans le snapshot.
   */
  describe('capi publiée dans la mauvaise devise (EQNR)', () => {
    const EQNR = { fundamentalsSource: 'finnhub', reportedMarketCap: 907_528.4, sharesOutstanding: 2.503e9 };

    it('sans prix, la valeur en couronnes passe faute de quoi la recouper', () => {
      const res = resolveMarketCap({ ...EQNR, price: null }, usd('USD'));
      expect(res.source).toBe('reported');
      expect(res.marketCap! / 1e9).toBeCloseTo(907.5, 0);
    });

    it('avec le prix de la ligne screener, le recoupement ramène la vraie capitalisation', () => {
      const res = resolveMarketCap({ ...EQNR, price: 37.59 }, usd('USD'));
      expect(res.source).toBe('derived');
      expect(res.marketCap! / 1e9).toBeCloseTo(94.1, 0);
    });

    /** Le garde-fou ne doit pas se retourner contre les capis publiées JUSTES : CME est cité
     *  dans l'en-tête du module comme un cas sain sans nombre d'actions au snapshot. */
    it('laisse intacte une capi publiée cohérente avec le prix (CME)', () => {
      const res = resolveMarketCap(
        { fundamentalsSource: 'finnhub', reportedMarketCap: 91_100, price: 257.42, sharesOutstanding: 3.6e8 },
        usd('USD'),
      );
      expect(res.marketCap! / 1e9).toBeCloseTo(92.7, 0);
    });
  });
});

describe('reconcileAdsMarketCap — prix × actions vs capi publiée du même symbole', () => {
  it('BABA : conventions cohérentes → le dérivé, comportement historique', () => {
    // Audit 05/08 : prix × sharesYahoo / capi = 1,00 sur BABA (Yahoo compte en ADS).
    const rec = reconcileAdsMarketCap(119.875 * 2.404e9, 2.882e11)!;
    expect(rec.corrected).toBe(false);
    expect(rec.marketCap).toBeCloseTo(119.875 * 2.404e9, 0);
  });

  it('SSM : shares hors convention (×5,49) → la capi publiée', () => {
    const derived = 5.49 * 5.59e6;    // ratioCap mesuré 5,49
    const rec = reconcileAdsMarketCap(derived, 5.59e6)!;
    expect(rec.corrected).toBe(true);
    expect(rec.marketCap).toBe(5.59e6);
    expect(rec.factor).toBeCloseTo(5.49, 2);
  });

  it('RCON (×1,43) : le plus petit cas réel mesuré est attrapé', () => {
    const rec = reconcileAdsMarketCap(1.43 * 3.68e6, 3.68e6)!;
    expect(rec.corrected).toBe(true);
  });

  it('un rachat d\'actions de 15 % sur l\'exercice ne déclenche PAS de correction', () => {
    // Les shares annuelles MOYENNES vs la capi du jour divergent naturellement de ce bruit-là.
    const rec = reconcileAdsMarketCap(1.15e10, 1e10)!;
    expect(rec.corrected).toBe(false);
    expect(rec.marketCap).toBe(1.15e10);
  });

  it('ratio < 1 (titre paraissant MOINS cher — direction du faux signal) : corrigé aussi', () => {
    const rec = reconcileAdsMarketCap(0.13 * 1.87e10, 1.87e10)!;
    expect(rec.corrected).toBe(true);
    expect(rec.marketCap).toBe(1.87e10);
  });

  it('capi publiée seule (shares Yahoo absentes) : elle prend le relais', () => {
    const rec = reconcileAdsMarketCap(null, 1.87e10)!;
    expect(rec.corrected).toBe(true);
    expect(rec.marketCap).toBe(1.87e10);
  });

  it('capi publiée absente ou invalide : le dérivé reste, aucune correction', () => {
    expect(reconcileAdsMarketCap(1e10, null)!.marketCap).toBe(1e10);
    expect(reconcileAdsMarketCap(1e10, 0)!.marketCap).toBe(1e10);
    expect(reconcileAdsMarketCap(1e10, Number.NaN)!.marketCap).toBe(1e10);
  });

  it('rien des deux côtés : null', () => {
    expect(reconcileAdsMarketCap(null, null)).toBeNull();
  });

  it('le seuil laisse le bruit légitime sous lui et les cas réels au-dessus', () => {
    expect(ADS_CONVENTION_FACTOR).toBeGreaterThan(1.2);   // rachats/dilution d'un exercice
    expect(ADS_CONVENTION_FACTOR).toBeLessThan(1.43);     // RCON, plus petit cas mesuré
  });
});

describe('resolveMarketCap — independentCap (capi Yahoo, référence de convention des ADR)', () => {
  it('BEKE : capi Finnhub en CNY (×7,3, sous le seuil ×10) et pas d\'actions → la capi Yahoo', () => {
    // Prod du 05/08 : stocké 146,8 Md$ (146 790 M « USD » qui sont des CNY), réel ~18,7 Md$.
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 146_790.34,
      price: 16.16,
      sharesOutstanding: null,
      independentCap: 1.87e10,
    }, usd('USD'));
    expect(res.source).toBe('independent');
    expect(res.marketCap! / 1e9).toBeCloseTo(18.7, 1);
  });

  it('SBS : shares XBRL et capi publiée fausses DE LA MÊME FAÇON (base BRL) → la capi Yahoo', () => {
    // derived = 5,35 × 17,6e9 = 94,3 Md ≈ reported 96 Md : le recoupement interne ne voit rien.
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 95_973.055,
      price: 5.35,
      sharesOutstanding: 1.7619e10,
      independentCap: 1.1e10,
    }, usd('USD'));
    expect(res.source).toBe('independent');
    expect(res.marketCap! / 1e9).toBeCloseTo(11, 0);
  });

  it('cas sain : les estimations internes s\'accordent avec la capi Yahoo → rien ne bouge', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: 4_537_000,
      price: 308.91,
      sharesOutstanding: 1.477e10,
      independentCap: 4.55e12,
    }, usd('USD'));
    expect(res.source).toBe('derived');
    expect(res.marketCap! / 1e12).toBeCloseTo(4.562, 2);
  });

  it('rien de vérifiable en interne mais une capi Yahoo plausible → elle classe le titre', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: null,
      price: 22.8,
      sharesOutstanding: null,
      independentCap: 2.1e9,
    }, usd('USD'));
    expect(res.source).toBe('independent');
    expect(res.marketCap).toBe(2.1e9);
  });

  it('capi Yahoo au nombre d\'actions implicite invraisemblable : ignorée', () => {
    const res = resolveMarketCap({
      fundamentalsSource: 'finnhub',
      reportedMarketCap: null,
      price: 0.02,
      sharesOutstanding: null,
      independentCap: 5e10,       // 2 500 milliards d'actions implicites à 2 cents
    }, usd('USD'));
    expect(res.source).toBe('none');
    expect(res.marketCap).toBeNull();
  });

  it('capi Yahoo invalide (0, NaN, négative) : ignorée', () => {
    for (const junk of [0, Number.NaN, -5]) {
      const res = resolveMarketCap({
        fundamentalsSource: 'finnhub',
        reportedMarketCap: 4_537_000,
        price: 308.91,
        sharesOutstanding: 1.477e10,
        independentCap: junk,
      }, usd('USD'));
      expect(res.source).toBe('derived');
    }
  });
});
