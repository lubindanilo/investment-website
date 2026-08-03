/**
 * Données réelles de la landing — une seule requête publique (`/api/screener/top`)
 * partagée par le hero, le mécanisme, la veille et la section Claude.
 *
 * Règle : la landing n'affiche QUE des champs réellement servis par l'API (note, P/FCF,
 * cours, devise, secteur, flag opportunité). Aucun chiffre inventé. Si l'appel échoue,
 * on retombe sur un repli neutre pour que la page reste lisible (et prérendue) sans data.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ScreenerTopRow } from '@lubin/shared';
import { api, type ShowcaseStock } from '../../lib/api.js';

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

/** Repli affiché tant que l'API n'a pas répondu (et si elle échoue). */
const FALLBACK: LandingStock[] = [
  { ticker: 'ASML.AS', name: 'ASML Holding', sector: 'Semiconductor Equipment', note10: 10, pfcfTTM: 19.2, price: null, currency: 'EUR', opportunity: true, marketCap: null, dayChangePct: null, spark: null },
  { ticker: 'ADBE', name: 'Adobe Inc.', sector: 'Software', note10: 9, pfcfTTM: 17.4, price: null, currency: 'USD', opportunity: true, marketCap: null, dayChangePct: null, spark: null },
  { ticker: 'RMS.PA', name: 'Hermès International', sector: 'Luxury Goods', note10: 10, pfcfTTM: 41.6, price: null, currency: 'EUR', opportunity: false, marketCap: null, dayChangePct: null, spark: null },
];

function toStock(r: ScreenerTopRow): LandingStock {
  const max = r.scoreChiffresMax ?? 0;
  return {
    ticker: r.ticker,
    name: r.name ?? r.ticker,
    sector: r.sector,
    note10: r.scoreChiffres != null && max > 0 ? Math.round((r.scoreChiffres / max) * 10) : null,
    pfcfTTM: r.pfcfTTM,
    price: r.price,
    currency: r.currency,
    opportunity: r.opportunity,
    marketCap: r.marketCap,
    dayChangePct: r.dayChangePct,
    spark: r.spark,
  };
}

/** Repli de la requête PEA illustrée dans la conversation Claude. */
const FALLBACK_PEA: LandingStock[] = [
  { ticker: 'SAP.DE', name: 'SAP SE', sector: 'Software', note10: 9, pfcfTTM: 14.1, price: null, currency: 'EUR', opportunity: false, marketCap: null, dayChangePct: null, spark: null },
  { ticker: 'MC.PA', name: 'LVMH', sector: 'Luxury Goods', note10: 8, pfcfTTM: 12.8, price: null, currency: 'EUR', opportunity: false, marketCap: null, dayChangePct: null, spark: null },
  { ticker: 'KER.PA', name: 'Kering', sector: 'Luxury Goods', note10: 8, pfcfTTM: 11.2, price: null, currency: 'EUR', opportunity: false, marketCap: null, dayChangePct: null, spark: null },
];

/**
 * Filtres de la requête PEA, montrés en chips ET réellement envoyés à l'API : la démo ne doit
 * jamais afficher un filtre qu'elle n'applique pas.
 *
 * `caps` est là pour la même raison que dans MONITOR_QUERY : sans lui, les meilleures notes
 * européennes sont des micro-caps (Philogen, Fiera Milano, Friedrich Vorwerk) qui ne parlent à
 * personne. Avec, la démo montre Publicis, IAG, Bank of Ireland.
 */
export const PEA_QUERY = { zones: 'pea', minMax: 8, maxPfcf: 15, caps: 'large', limit: 4 } as const;

/**
 * Lignes de la veille : les opportunités du moment parmi les GRANDES capitalisations.
 * Le classement par score fait remonter des sociétés que personne ne connaît (Paylocity,
 * Pinnacle Financial…), et une vitrine n'a d'effet que si le visiteur reconnaît les noms.
 * On demande donc large cap, puis on trie par capitalisation et on garde les 5 premières.
 */
const MONITOR_QUERY = { opportunities: true, minMax: 8, caps: 'large', limit: 24 } as const;
const MONITOR_COUNT = 5;

/** Repli si la restriction « grandes capitalisations » ne remonte pas assez de titres. */
const MONITOR_FALLBACK_QUERY = { opportunities: true, minMax: 8, limit: 8 } as const;

/** Critère affiché dans la fiche du hero (même vue que /analyser). */
export interface LandingCriterion { name: string; value: string; status: 'pass' | 'warn' | 'fail' }

/** Repli des 10 critères : structure réelle, valeurs neutres tant que l'API n'a pas répondu. */
const FALLBACK_CRITERIA: LandingCriterion[] = [
  'Marge nette', 'Ventes en croissance', 'Profits par action en croissance', 'Nombre d\'actions maîtrisé',
  'Profitabilité cash', 'Marges en expansion', 'Rendement du capital investi', 'Endettement maîtrisé',
  'Bénéfices transformés en cash', 'Délai d\'encaissement net',
].map(name => ({ name, value: '—', status: 'pass' as const }));

export interface LandingData {
  /** Le titre mis en avant (hero, mécanisme, conversation Claude). */
  featured: LandingStock;
  /** Ses 10 critères de qualité et son grade de résilience (vue « analyser »). */
  criteria: LandingCriterion[];
  resilience: { grade: string; score: number } | null;
  /** Percentile du P/FCF dans son historique (0 = jamais aussi bon marché). */
  pfcfPercentile: number | null;
  /** Les lignes montrées dans la section veille. */
  rows: LandingStock[];
  /** Résultat réel de la requête PEA illustrée dans la section Claude. */
  peaRows: LandingStock[];
  /** false tant que la vitrine n'est pas arrivée : on affiche un squelette, jamais un
   *  titre de repli, sinon le visiteur voit une action puis une autre (effet de bascule). */
  ready: boolean;
}

/**
 * Charge les meilleures opportunités du moment (note ≥ 8/10) et le résultat de la requête
 * PEA montrée dans la section Claude. Volontairement tolérant : en cas d'échec on garde le
 * repli plutôt que d'afficher un trou dans la landing.
 */
export function useLandingData(): LandingData {
  const [rows, setRows] = useState<LandingStock[]>(FALLBACK);
  const [peaRows, setPeaRows] = useState<LandingStock[]>(FALLBACK_PEA);
  const [showcase, setShowcase] = useState<ShowcaseStock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.screener.showcase(),
      api.screener.top(MONITOR_QUERY),
      api.screener.top(PEA_QUERY),
    ]).then(async ([show, top, pea]) => {
      if (cancelled) return;
      if (show.status === 'fulfilled') setShowcase(show.value);
      if (pea.status === 'fulfilled') {
        const mapped = pea.value.map(toStock).filter(s => s.note10 != null);
        if (mapped.length) setPeaRows(mapped);
      }

      let monitor = top.status === 'fulfilled'
        ? top.value.map(toStock).filter(s => s.note10 != null)
        : [];
      // Trop peu de grandes capitalisations en opportunité : on reprend le classement complet
      // plutôt que d'afficher une seule ligne.
      if (monitor.length < 4) {
        const wide = await api.screener.top(MONITOR_FALLBACK_QUERY).catch(() => []);
        if (cancelled) return;
        if (wide.length) monitor = wide.map(toStock).filter(s => s.note10 != null);
      }
      monitor = monitor
        .slice()
        .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
        .slice(0, MONITOR_COUNT);
      if (monitor.length) setRows(monitor);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // La vitrine pilote le hero ; à défaut, la meilleure opportunité du screener.
  // IDENTITÉ STABLE obligatoire : ce objet sert de dépendance à des effets qui jouent une
  // animation longue (le lecteur MCP). Le recréer à chaque rendu relançait la boucle en
  // continu, et le fil de conversation repartait de zéro sans jamais rien afficher.
  const featured: LandingStock = useMemo(() => {
    const max = showcase?.scoreChiffresMax ?? 0;
    if (!showcase) return rows[0] ?? FALLBACK[0]!;
    return {
      ticker: showcase.ticker,
      name: showcase.name ?? showcase.ticker,
      sector: showcase.sector,
      note10: showcase.scoreChiffres != null && max > 0 ? Math.round((showcase.scoreChiffres / max) * 10) : null,
      pfcfTTM: showcase.pfcfTTM,
      price: showcase.price,
      currency: showcase.currency,
      opportunity: showcase.opportunity,
      // La vitrine ne sert ni la capitalisation ni la courbe : ces champs n'alimentent que
      // les lignes de la veille, pas la fiche du hero.
      marketCap: null,
      dayChangePct: null,
      spark: null,
    };
  }, [showcase, rows]);

  return {
    featured,
    criteria: showcase?.criteria?.length ? showcase.criteria : FALLBACK_CRITERIA,
    resilience: showcase?.resilience ?? null,
    pfcfPercentile: showcase?.pfcfPercentile ?? null,
    rows,
    peaRows,
    ready: !loading,
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
