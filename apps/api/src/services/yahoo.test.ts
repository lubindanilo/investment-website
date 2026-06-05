/**
 * Tests purs sur computeSharesCagr (la partie réseau de yahoo.ts n'est pas testée
 * ici car elle dépend du réseau externe — c'est un appel best-effort qui peut
 * silencieusement échouer en prod).
 */
import { describe, it, expect } from 'vitest';
import { computeSharesCagr, computeFcfPerShareCagr, type SharesHistoryPoint } from './yahoo.js';

describe('computeSharesCagr', () => {
  it('renvoie null si la série est vide ou null', () => {
    expect(computeSharesCagr(null)).toBeNull();
    expect(computeSharesCagr([])).toBeNull();
  });

  it('renvoie null si la série n\'a qu\'un point', () => {
    expect(computeSharesCagr([{ fiscalYear: 2024, dilutedShares: 30_000_000, fcf: null }])).toBeNull();
  });

  it('renvoie un CAGR négatif si rachats nets (shares décroissent)', () => {
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 36_000_000, fcf: null },
      { fiscalYear: 2021, dilutedShares: 34_000_000, fcf: null },
      { fiscalYear: 2022, dilutedShares: 32_000_000, fcf: null },
      { fiscalYear: 2023, dilutedShares: 30_000_000, fcf: null },
    ];
    const cagr = computeSharesCagr(history);
    expect(cagr).toBeLessThan(0);
    // (30/36)^(1/3) - 1 ≈ -0.0590
    expect(cagr).toBeCloseTo(-0.059, 3);
  });

  it('renvoie un CAGR positif si dilution', () => {
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2019, dilutedShares: 100_000_000, fcf: null },
      { fiscalYear: 2024, dilutedShares: 110_000_000, fcf: null },
    ];
    const cagr = computeSharesCagr(history);
    expect(cagr).toBeCloseTo(0.0193, 3); // ~+1.93%/an
  });

  it('renvoie null si un bond intermédiaire > 3× révèle un événement structurel', () => {
    // Garde DISCONTINUITÉ : un saut ×10 puis ÷12 d'une année à l'autre n'est pas une évolution
    // organique du flottant — c'est une émission massive / reverse split / artefact de données.
    // La CAGR multi-annuelle calculée sur les bornes serait trompeuse (cache l'événement).
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 100, fcf: null },
      { fiscalYear: 2021, dilutedShares: 999, fcf: null },
      { fiscalYear: 2022, dilutedShares: 80, fcf: null },
    ];
    expect(computeSharesCagr(history)).toBeNull();
  });
});

describe('computeFcfPerShareCagr', () => {
  it('renvoie null si aucun point avec FCF + shares > 0', () => {
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 100, fcf: null },
      { fiscalYear: 2021, dilutedShares: 100, fcf: null },
    ];
    expect(computeFcfPerShareCagr(history).value).toBeNull();
  });

  it('renvoie null si moins de 2 points exploitables', () => {
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 100, fcf: 1000 },
      { fiscalYear: 2021, dilutedShares: 100, fcf: null }, // pas de FCF cette année
    ];
    expect(computeFcfPerShareCagr(history).value).toBeNull();
  });

  it("renvoie null si FCF négatif sur les bornes (CAGR pas pertinent)", () => {
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 100, fcf: -50 },
      { fiscalYear: 2024, dilutedShares: 100, fcf: 200 },
    ];
    expect(computeFcfPerShareCagr(history).value).toBeNull();
  });

  it('calcule un CAGR positif quand FCF/action augmente', () => {
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 100, fcf: 1000 },   // 10 $/action
      { fiscalYear: 2024, dilutedShares: 100, fcf: 1600 },   // 16 $/action
    ];
    const cagr = computeFcfPerShareCagr(history).value!;
    // (16/10)^(1/4) - 1 ≈ 0.1247
    expect(cagr).toBeCloseTo(0.1247, 3);
  });

  it('combine bonus rachats nets + croissance FCF (cas BKNG-like split-adjusté)', () => {
    // FCF augmente modestement, mais les rachats nets compensent → FCF/action grimpe plus
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 41_000_000, fcf: 2_400_000_000 },  // 58.5 $/action
      { fiscalYear: 2025, dilutedShares: 33_000_000, fcf: 8_000_000_000 },  // 242.4 $/action
    ];
    const cagr = computeFcfPerShareCagr(history).value!;
    // (242.4/58.5)^(1/5) - 1 ≈ 0.327 → +32.7%/an
    expect(cagr).toBeGreaterThan(0.30);
    expect(cagr).toBeLessThan(0.35);
  });

  it('détecte une anomalie de donnée Yahoo (dernier FCF anormalement bas)', () => {
    // Cas AMZN 2025 : 3 ans à ~$32B puis Yahoo renvoie $7.70B la dernière année.
    // C'est ~24% de la médiane → anomalie probable (partial year), bloque le calcul.
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2022, dilutedShares: 10_190_000_000, fcf: 30_000_000_000 },
      { fiscalYear: 2023, dilutedShares: 10_490_000_000, fcf: 32_220_000_000 },
      { fiscalYear: 2024, dilutedShares: 10_720_000_000, fcf: 32_880_000_000 },
      { fiscalYear: 2025, dilutedShares: 10_830_000_000, fcf: 7_700_000_000 },  // ← anomalie
    ];
    const r = computeFcfPerShareCagr(history);
    expect(r.value).toBeNull();
    expect(r.reason).toMatch(/2025/);
    expect(r.reason).toMatch(/suspect/i);
  });

  it("régression log-linéaire ≥ 3 points : plus robuste qu'endpoint-based (cas AAPL FY25 atypique)", () => {
    // Cas AAPL réel : FCF Yahoo a une FY25 sous-évaluée (98.77B au lieu de ~108B).
    // Endpoint-based donnerait -1.2 %/an (trompeur), la régression donne ~0 % (plus honnête).
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2022, dilutedShares: 16_330_000_000, fcf: 111_440_000_000 },  // 6.82$
      { fiscalYear: 2023, dilutedShares: 15_810_000_000, fcf:  99_580_000_000 },  // 6.30$
      { fiscalYear: 2024, dilutedShares: 15_410_000_000, fcf: 108_810_000_000 },  // 7.06$
      { fiscalYear: 2025, dilutedShares: 15_000_000_000, fcf:  98_770_000_000 },  // 6.58$ (Yahoo sous-évalué)
    ];
    const r = computeFcfPerShareCagr(history);
    expect(r.value).not.toBeNull();
    // Régression : ~0 % (entre -2 % et +2 %). Endpoint aurait donné -1.2 % strict.
    // La régression est moins biaisée par les bornes — verdict plus juste = "à peu près flat".
    expect(Math.abs(r.value!)).toBeLessThan(0.02);
  });

  it("régression : croissance positive bien détectée quand la trajectoire est claire", () => {
    // FCF/share qui croît régulièrement sur 5 ans → régression doit donner ~+15 %/an
    const history: SharesHistoryPoint[] = [
      { fiscalYear: 2020, dilutedShares: 100, fcf: 1000 }, // 10
      { fiscalYear: 2021, dilutedShares: 100, fcf: 1150 }, // 11.5
      { fiscalYear: 2022, dilutedShares: 100, fcf: 1320 }, // 13.2
      { fiscalYear: 2023, dilutedShares: 100, fcf: 1520 }, // 15.2
      { fiscalYear: 2024, dilutedShares: 100, fcf: 1750 }, // 17.5
    ];
    const r = computeFcfPerShareCagr(history);
    expect(r.value).not.toBeNull();
    expect(r.value!).toBeGreaterThan(0.13);
    expect(r.value!).toBeLessThan(0.17);
  });
});
