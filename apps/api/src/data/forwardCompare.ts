/**
 * Inception du SUIVI FORWARD comparé (page « Bat le marché »). Prix d'entrée FIGÉS le jour du
 * lancement (capturés en live) → la performance est mesurée à partir de cette date, sans triche.
 * Trois portefeuilles équipondérés suivis vs le S&P 500 :
 *   - « Ma sélection » : les convictions discrétionnaires (qualité achetée dans un creux) ;
 *   - « Value + Momentum » : le panier systématique du jour de lancement (cohorte figée) ;
 *   - benchmark : S&P 500 (SPY).
 *
 * NB : le panier systématique de la PAGE est dynamique (recalculé en live) ; ici on fige la cohorte
 * de lancement pour mesurer sa perf forward. Mettre à jour à chaque rééquilibrage trimestriel.
 */
export interface ForwardPosition { ticker: string; entry: number | null }

export const FORWARD_INCEPTION = '2026-06-08';

export const MINE_POSITIONS: ForwardPosition[] = [
  { ticker: 'ADBE', entry: 246.46 }, { ticker: 'BKNG', entry: 163.23 },
  { ticker: 'CRM', entry: 183.04 }, { ticker: 'KNSL', entry: 301.74 },
];

export const SYSTEM_POSITIONS: ForwardPosition[] = [
  { ticker: 'STT', entry: 161.81 }, { ticker: 'GS', entry: 1044.485 }, { ticker: 'APA', entry: 37.55 },
  { ticker: 'MET', entry: 84.64 }, { ticker: 'CNC', entry: 65.167 }, { ticker: 'ALL', entry: 215.51 },
  { ticker: 'GM', entry: 83.72 }, { ticker: 'TRV', entry: 297.53 }, { ticker: 'PFG', entry: 105.28 },
  { ticker: 'F', entry: 15.055 }, { ticker: 'FANG', entry: 198.07 }, { ticker: 'EXPE', entry: 225.69 },
  { ticker: 'CINF', entry: 162.95 }, { ticker: 'BAC', entry: 53.685 }, { ticker: 'IVZ', entry: 27.555 },
  { ticker: 'COP', entry: 118.81 }, { ticker: 'ADM', entry: 80.49 }, { ticker: 'MGM', entry: 47.1 },
  { ticker: 'CB', entry: 323.26 }, { ticker: 'CI', entry: 290.57 },
];

export const SPY_ENTRY = 739.28;
