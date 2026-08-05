/**
 * Calibration du ratio ADS entre les shares Yahoo et les shares EDGAR.
 *
 * Un ADS vaut N actions ordinaires (BABA 8, TSM 5). Yahoo compte en ADS — convention correcte
 * ici puisqu'on croise le prix de l'ADS — quand EDGAR publie des ordinaires. Fusionner sans
 * calibrer injecte des exercices profonds N× trop grands, et gonfle le P/FCF historique de ces
 * années (donc fait passer le multiple courant pour anormalement bas).
 */
import { describe, it, expect } from 'vitest';
import { calibrateAdsShares } from './yahooAnnualStore.js';

const pt = (year: string, value: number) => ({ date: `${year}-12-31`, value });

describe('calibrateAdsShares', () => {
  /** Cas BABA mesuré en prod : ratio Yahoo/EDGAR ≈ 1/8. Les exercices profonds EDGAR doivent
   *  être ramenés en ADS, sinon le P/FCF de ces années sort 8× trop cher. */
  it('rescale les shares EDGAR quand un facteur ADS constant les sépare', () => {
    const yahoo = [pt('2023', 2_500), pt('2024', 2_400), pt('2025', 2_300)];
    const edgar = [pt('2019', 21_000), pt('2023', 20_000), pt('2024', 19_200), pt('2025', 18_400)];
    const cal = calibrateAdsShares(yahoo, edgar);
    expect(cal).not.toBeNull();
    expect(cal!.ratio).toBeCloseTo(0.125, 6);
    // L'exercice profond 2019 passe de 21 000 ordinaires à 2 625 ADS.
    expect(cal!.points[0]).toEqual({ date: '2019-12-31', value: 2_625 });
    expect(cal!.points.at(-1)!.value).toBeCloseTo(2_300, 6);
  });

  /** Cas majoritaire : mêmes conventions des deux côtés → série EDGAR passée telle quelle. */
  it('laisse la série intacte quand les conventions coïncident déjà', () => {
    const yahoo = [pt('2024', 1_000), pt('2025', 990)];
    const edgar = [pt('2018', 1_100), pt('2024', 1_002), pt('2025', 988)];
    const cal = calibrateAdsShares(yahoo, edgar);
    expect(cal!.ratio).toBe(1);
    expect(cal!.points).toBe(edgar);
  });

  /** Un écart de convention est un facteur CONSTANT. Des ratios incohérents signalent autre
   *  chose (dates décalées, restatement) : on renonce à la profondeur plutôt que de servir
   *  une série dont l'unité est douteuse. */
  it('renonce quand les ratios annuels ne sont pas cohérents entre eux', () => {
    const yahoo = [pt('2023', 1_000), pt('2024', 1_000), pt('2025', 1_000)];
    const edgar = [pt('2023', 8_000), pt('2024', 4_000), pt('2025', 2_000)];
    expect(calibrateAdsShares(yahoo, edgar)).toBeNull();
  });

  /**
   * Cas PDD réel : EDGAR sort 5,1 M d'actions en 2022 (au lieu de ~5 400 M) — un exercice
   * aberrant isolé. Les trois autres donnent 3,71 / 3,74 / 3,77, soit le ratio officiel de 4.
   * Un contrôle au pire cas condamnait toute la calibration ; la majorité doit la sauver.
   */
  it('survit à un exercice EDGAR aberrant isolé (cas PDD 2022)', () => {
    const yahoo = [pt('2022', 1_440), pt('2023', 1_460), pt('2024', 1_479), pt('2025', 1_482)];
    const edgar = [pt('2022', 5.1), pt('2023', 5_416), pt('2024', 5_536), pt('2025', 5_591)];
    const cal = calibrateAdsShares(yahoo, edgar);
    expect(cal).not.toBeNull();
    expect(1 / cal!.ratio).toBeGreaterThan(3.6);
    expect(1 / cal!.ratio).toBeLessThan(3.9);
  });

  /** Mais une majorité d'exercices discordants reste un refus : deux lectures contradictoires
   *  ne se départagent pas, et rescaler au hasard servirait une série fausse. */
  it('renonce quand les exercices concordants sont minoritaires', () => {
    const yahoo = [pt('2022', 1_000), pt('2023', 1_000), pt('2024', 1_000), pt('2025', 1_000)];
    const edgar = [pt('2022', 8_000), pt('2023', 8_000), pt('2024', 2_000), pt('2025', 500)];
    expect(calibrateAdsShares(yahoo, edgar)).toBeNull();
  });

  /** Un seul exercice commun peut refléter un décalage de date ou une année restatée, pas une
   *  convention : deux points minimum pour trancher. */
  it('renonce avec moins de deux exercices communs', () => {
    expect(calibrateAdsShares([pt('2025', 1_000)], [pt('2019', 8_000), pt('2025', 8_000)])).toBeNull();
    expect(calibrateAdsShares([], [pt('2025', 8_000)])).toBeNull();
  });

  it('ignore les valeurs nulles ou négatives des deux côtés', () => {
    const yahoo = [pt('2023', 0), pt('2024', 1_000), pt('2025', 1_000)];
    const edgar = [pt('2023', 8_000), pt('2024', 8_000), pt('2025', 8_000)];
    // Seuls 2024 et 2025 sont exploitables → ratio 1/8 net.
    expect(calibrateAdsShares(yahoo, edgar)!.ratio).toBeCloseTo(0.125, 6);
  });
});
