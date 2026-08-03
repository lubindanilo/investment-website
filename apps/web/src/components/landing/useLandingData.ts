/**
 * Données de la landing — entièrement FIGÉES, aucun appel réseau au chargement.
 *
 * POURQUOI PAS D'API
 * La page tirait ses chiffres de `/api/screener/showcase` et `/api/screener/top`. Mesuré en
 * local, cache RAM vide : 1,25 s pour la vitrine, 0,65 s pour les lignes de veille. En production
 * s'y ajoutent le démarrage à froid de la fonction et le réveil de Neon Free, qui suspend son
 * compute après ~5 min d'inactivité ; et comme le cache serveur est en RAM (donc par instance),
 * la plupart des visiteurs tombaient sur un cache vide. Une page d'accueil ne peut pas attendre
 * une base de données pour afficher sa fiche principale.
 *
 * Trois bénéfices en plus de la vitesse :
 *   - zéro invocation de fonction sur la page la plus visitée du site, donc zéro compute Neon
 *     (c'est le facteur limitant du projet) ;
 *   - plus aucun squelette de chargement, ni bascule d'une société à une autre en cours de route ;
 *   - la landing reste identique si l'API tombe.
 *
 * CE QUE ÇA COÛTE
 * Les valeurs vieillissent entre deux exécutions du générateur : le cours et les multiples
 * surtout, les notes et la résilience beaucoup plus lentement. C'est le seul point à surveiller,
 * et `SHOWCASE_AS_OF` donne la date du relevé.
 *
 * Rafraîchir :  node scripts/gen-landing-showcase.mjs
 *
 * La recherche du champ « nom d'entreprise » reste un appel réel : elle est déclenchée par la
 * frappe, pas par le chargement (cf. TickerForm).
 */
import { FROZEN_PEA_ROWS, FROZEN_ROWS, FROZEN_SLOTS, SHOWCASE_AS_OF } from '../../data/landingShowcase.js';

export interface LandingStock {
  ticker: string;
  name: string;
  sector: string | null;
  /** Note ramenée sur 10 (arrondie), ou null si le titre n'est pas scoré. */
  note10: number | null;
  pfcfTTM: number | null;
  price: number | null;
  currency: string | null;
  opportunity: boolean;
  /** Capitalisation : sert à préférer les noms que le grand public reconnaît. */
  marketCap: number | null;
  dayChangePct: number | null;
  /** Closes mensuels (~1 an) : la courbe miniature de la ligne de veille. */
  spark: number[] | null;
}

/** Critère affiché dans la fiche (même vue que /analyser). */
export interface LandingCriterion { name: string; value: string; status: 'pass' | 'warn' | 'fail' }

/**
 * Un titre de vitrine AVEC tout ce que la landing affiche de lui. Trois emplacements en
 * utilisent un : le hero, la maquette du « Mécanisme » et la démo du connecteur. Ils montrent
 * des sociétés DIFFÉRENTES, sinon la page donne l'impression d'un catalogue d'un seul nom.
 */
export interface LandingShowcase {
  stock: LandingStock;
  /** Les 10 critères de qualité (même vue que /analyser). */
  criteria: LandingCriterion[];
  resilience: { grade: string; score: number } | null;
  /** Percentile du P/FCF dans son historique (0 = jamais aussi bon marché). */
  pfcfPercentile: number | null;
}

export interface LandingData {
  /** Fiche du hero : le titre le mieux noté ET le mieux classé en résilience. */
  hero: LandingShowcase;
  /** Maquette du « Mécanisme » : une AUTRE société. */
  mech: LandingShowcase;
  /** Démo du connecteur MCP : une TROISIÈME société. */
  mcp: LandingShowcase;
  /** Les lignes montrées dans la section veille. */
  rows: LandingStock[];
  /** Résultat de la requête PEA illustrée dans la section Claude. */
  peaRows: LandingStock[];
  /** Date du relevé figé, pour situer la fraîcheur des chiffres. */
  asOf: string;
}

/**
 * Les données de la landing. Purement synchrone : rien à attendre, rien à charger.
 *
 * Le générateur garantit au moins un emplacement rempli (il échoue plutôt que d'écrire un
 * fichier vide), donc on réutilise le premier quand il y en a moins de trois.
 */
export function useLandingData(): LandingData {
  const first = FROZEN_SLOTS[0]!;
  return {
    hero: first,
    mech: FROZEN_SLOTS[1] ?? first,
    mcp: FROZEN_SLOTS[2] ?? first,
    rows: FROZEN_ROWS,
    peaRows: FROZEN_PEA_ROWS,
    asOf: SHOWCASE_AS_OF,
  };
}

/** Formate un cours avec sa devise (symbole court, locale courante). */
export function fmtPrice(value: number | null, currency: string | null, locale: string): string | null {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency ?? 'USD',
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim();
  }
}
