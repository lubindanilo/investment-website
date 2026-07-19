/**
 * Palmarès — cas notables où le signal « opportunité du moment » (note ≥ 8/10 + P/FCF < 25 +
 * P/FCF ≤ 10ᵉ percentile historique) a repéré un gagnant TRÈS tôt, mesuré en backtest point-in-time.
 *
 * ⚠️ Ces chiffres viennent du backtest maison (projet séparé `apps/backtest`, export
 * `exports/pepites_num.csv` daté du 08/06/2026). Les CSV ne sont PAS déployés avec le site, donc la
 * sélection est FIGÉE ici. Toute mise à jour = re-tirer les chiffres depuis le backtest.
 *
 * CONTEXTE À GARDER EN TÊTE (biais du backtest, même si le bloc « lecture honnête » a été retiré de
 * la page sur décision du propriétaire) :
 *   - biais de survie assumé (l'univers = titres existant aujourd'hui, les faillis/délistés sont
 *     absents), donc l'alpha absolu est SUR-estimé ;
 *   - sur les 310 opportunités du backtest (entrées 2014→2022), SEULES ~34 % ont battu le S&P 500
 *     et l'alpha annualisé médian est NÉGATIF. Ces cartes sont donc les MEILLEURS cas, pas la moyenne.
 *
 * `ret`/`sp` = rendement TOTAL en % sur la période (entrée → 08/06/2026). `mult` = multiple du capital
 * (1 + ret/100), calculé à l'affichage.
 */
export interface PalmaresPick {
  ticker: string;
  name: string;
  /** Secteur court (libellé neutre, pas de traduction : nom propre du secteur). */
  sector: string;
  /** Date d'entrée du signal (fin de mois), ISO. Affichée en mois/année localisé. */
  entry: string;
  /** Durée de détention en années (entrée → as-of de l'export). */
  years: number;
  /** Rendement total de l'action sur la période, en %. */
  ret: number;
  /** Rendement total du S&P 500 sur la MÊME période, en %. */
  sp: number;
}

/**
 * Sélection figée des cas notables (les plus gros excès de rendement, titres reconnaissables).
 * Triés par excès décroissant. Chiffres réels issus de pepites_num.csv.
 */
export const PALMARES_PICKS: PalmaresPick[] = [
  { ticker: 'FIX', name: 'Comfort Systems USA', sector: 'Engineering & Construction', entry: '2020-01-31', years: 6.4, ret: 4014, sp: 158 },
  { ticker: 'LRCX', name: 'Lam Research', sector: 'Semiconductor Equipment', entry: '2018-10-31', years: 7.6, ret: 2265, sp: 215 },
  { ticker: 'MU', name: 'Micron Technology', sector: 'Semiconductors', entry: '2018-07-31', years: 7.9, ret: 1578, sp: 204 },
  { ticker: 'CIEN', name: 'Ciena', sector: 'Communication Equipment', entry: '2020-10-31', years: 5.6, ret: 1139, sp: 151 },
  { ticker: 'AAPL', name: 'Apple', sector: 'Consumer Electronics', entry: '2016-01-31', years: 10.4, ret: 1339, sp: 364 },
  { ticker: 'RMBS', name: 'Rambus', sector: 'Semiconductors', entry: '2015-10-31', years: 10.6, ret: 1308, sp: 335 },
  { ticker: 'MLI', name: 'Mueller Industries', sector: 'Metal Fabrication', entry: '2016-10-31', years: 9.6, ret: 984, sp: 316 },
  { ticker: 'PWR', name: 'Quanta Services', sector: 'Engineering & Construction', entry: '2021-01-31', years: 5.3, ret: 895, sp: 120 },
  { ticker: 'ANET', name: 'Arista Networks', sector: 'Computer Hardware', entry: '2018-10-31', years: 7.6, ret: 972, sp: 215 },
  { ticker: 'FORM', name: 'FormFactor', sector: 'Semiconductor Equipment', entry: '2018-04-30', years: 8.1, ret: 917, sp: 225 },
  { ticker: 'APH', name: 'Amphenol', sector: 'Electronic Components', entry: '2015-07-31', years: 10.9, ret: 990, sp: 332 },
  { ticker: 'PHM', name: 'PulteGroup', sector: 'Residential Construction', entry: '2018-10-31', years: 7.6, ret: 423, sp: 215 },
];
