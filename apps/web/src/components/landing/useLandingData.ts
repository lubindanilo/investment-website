/**
 * Données réelles de la landing — une seule requête publique (`/api/screener/top`)
 * partagée par le hero, le mécanisme, la veille et la section Claude.
 *
 * Règle : la landing n'affiche QUE des champs réellement servis par l'API (note, P/FCF,
 * cours, devise, secteur, flag opportunité). Aucun chiffre inventé. Si l'appel échoue,
 * on retombe sur un repli neutre pour que la page reste lisible (et prérendue) sans data.
 */
import { useEffect, useState } from 'react';
import type { ScreenerTopRow } from '@lubin/shared';
import { api } from '../../lib/api.js';

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
}

/** Repli affiché tant que l'API n'a pas répondu (et si elle échoue). */
const FALLBACK: LandingStock[] = [
  { ticker: 'ASML.AS', name: 'ASML Holding', sector: 'Semiconductor Equipment', note10: 10, pfcfTTM: 19.2, price: null, currency: 'EUR', opportunity: true },
  { ticker: 'ADBE', name: 'Adobe Inc.', sector: 'Software', note10: 9, pfcfTTM: 17.4, price: null, currency: 'USD', opportunity: true },
  { ticker: 'RMS.PA', name: 'Hermès International', sector: 'Luxury Goods', note10: 10, pfcfTTM: 41.6, price: null, currency: 'EUR', opportunity: false },
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
  };
}

/** Repli de la requête PEA illustrée dans la conversation Claude. */
const FALLBACK_PEA: LandingStock[] = [
  { ticker: 'SAP.DE', name: 'SAP SE', sector: 'Software', note10: 9, pfcfTTM: 14.1, price: null, currency: 'EUR', opportunity: false },
  { ticker: 'MC.PA', name: 'LVMH', sector: 'Luxury Goods', note10: 8, pfcfTTM: 12.8, price: null, currency: 'EUR', opportunity: false },
  { ticker: 'KER.PA', name: 'Kering', sector: 'Luxury Goods', note10: 8, pfcfTTM: 11.2, price: null, currency: 'EUR', opportunity: false },
];

/** Filtres de la requête PEA, montrés en chips ET réellement envoyés à l'API. */
export const PEA_QUERY = { zones: 'pea', minMax: 8, maxPfcf: 15, limit: 4 } as const;

export interface LandingData {
  /** Le titre mis en avant (hero, mécanisme, conversation Claude). */
  featured: LandingStock;
  /** Les lignes montrées dans la section veille. */
  rows: LandingStock[];
  /** Résultat réel de la requête PEA illustrée dans la section Claude. */
  peaRows: LandingStock[];
  /** true tant que les vraies valeurs ne sont pas arrivées (le repli est affiché). */
  loading: boolean;
}

/**
 * Charge les meilleures opportunités du moment (note ≥ 8/10) et le résultat de la requête
 * PEA montrée dans la section Claude. Volontairement tolérant : en cas d'échec on garde le
 * repli plutôt que d'afficher un trou dans la landing.
 */
export function useLandingData(): LandingData {
  const [rows, setRows] = useState<LandingStock[]>(FALLBACK);
  const [peaRows, setPeaRows] = useState<LandingStock[]>(FALLBACK_PEA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api.screener.top({ opportunities: true, minMax: 8, limit: 3 }),
      api.screener.top(PEA_QUERY),
    ]).then(([top, pea]) => {
      if (cancelled) return;
      if (top.status === 'fulfilled') {
        const mapped = top.value.map(toStock).filter(s => s.note10 != null);
        if (mapped.length) setRows(mapped);
      }
      if (pea.status === 'fulfilled') {
        const mapped = pea.value.map(toStock).filter(s => s.note10 != null);
        if (mapped.length) setPeaRows(mapped);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { featured: rows[0] ?? FALLBACK[0]!, rows, peaRows, loading };
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
