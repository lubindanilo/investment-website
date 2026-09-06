/**
 * reportingCurrency — dans quelle devise une société PUBLIE ses comptes.
 *
 * Tout ratio de valorisation croise un prix en devise de COTATION avec un flux en devise de
 * REPORTING, et les deux diffèrent plus souvent qu'on ne croit : un ADR coté en dollars publie en
 * won ou en roupies, et TOUT Londres cote en pence (GBp) pour des comptes en livres. Le module
 * `fx` fait la conversion, mais il faut d'abord savoir QUOI convertir.
 *
 * Jusqu'au 06/09/2026 la seule source était la SEC, qui ne connaît pas les émetteurs sans
 * dépôt XBRL américain : pour HLMA.L la devise de reporting était donc « inconnue », traitée
 * comme égale à la cotation, taux 1, et le P/FCF sortait en pence ÷ livres, cent fois trop haut
 * (400 des 578 titres cotés en pence à un P/FCF > 100, Halma 3 427× pour ~34× réel).
 *
 * Ordre de confiance :
 *   1. profil SEC (XBRL) — autoritaire quand il existe, USD compris ;
 *   2. sonde Yahoo — le `currencyCode` des lignes de FCF annuel, celui que l'historique P/FCF
 *      utilise déjà (`pfcfHistory`) ; mémoïsée 24 h par symbole, sous `yahooLimiter` ;
 *   3. repli : la devise MAJEURE de l'unité de cotation (GBp → GBP). Faux pour la minorité de
 *      cotations dont le reporting diffère (un minier londonien publiant en USD), mais jamais
 *      faux d'un facteur 100 : c'est exactement l'erreur qu'on ne veut plus voir revenir quand
 *      Yahoo ne répond pas.
 *
 * ⚠️ À appeler HORS de `yahooLimiter.schedule` : la sonde s'y planifie elle-même, et une
 * planification imbriquée s'interbloque (maxConcurrent 3). `quantSnapshot` l'appelle donc avant
 * `getYahooFundamentals`, et lui passe le résultat.
 */
import { yahooLimiter } from '../lib/limiter.js';
import { secReportingProfile } from './secEdgar.js';
import { resolveCurrencyUnit } from './marketTiers.js';

const TIMESERIES_BASE = 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';
/** Une société ne change pas de devise de publication dans la journée. */
const PROBE_TTL_MS = 24 * 3600 * 1000;

const probeCache = new Map<string, { currency: string | null; at: number }>();

/**
 * `currencyCode` du FCF annuel Yahoo pour ce symbole, ou null si indisponible. Mémoïsé, y compris
 * en négatif, pour qu'un titre ne coûte jamais plus d'une requête par jour et par process.
 */
export async function probeYahooReportingCurrency(yahooSymbol: string): Promise<string | null> {
  const hit = probeCache.get(yahooSymbol);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit.currency;
  const currency = await yahooLimiter.schedule(async () => {
    const now = Math.floor(Date.now() / 1000);
    const type = 'annualFreeCashFlow';
    const url = `${TIMESERIES_BASE}/${encodeURIComponent(yahooSymbol)}?symbol=${encodeURIComponent(yahooSymbol)}`
      + `&type=${type}&period1=${now - 3 * 365 * 86400}&period2=${now}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json() as { timeseries?: { result?: Array<Record<string, unknown> & { meta?: { type?: string[] } }> } };
      const result = data.timeseries?.result?.find(r => r.meta?.type?.includes(type));
      const rows = (result?.[type] as Array<{ currencyCode?: string }> | undefined) ?? [];
      return rows.find(r => r.currencyCode)?.currencyCode ?? null;
    } catch {
      return null;
    }
  });
  probeCache.set(yahooSymbol, { currency, at: Date.now() });
  return currency;
}

export interface ReportingCurrency {
  currency: string;
  source: 'sec' | 'yahoo' | 'assumed-quote-major';
}

/**
 * Devise de reporting d'un titre, avec sa provenance. `secProfileCurrency` permet de réutiliser
 * un profil SEC déjà lu par l'appelant (undefined = pas encore lu, null = lu et absent).
 */
export async function resolveReportingCurrency(
  ticker: string,
  yahooSymbol: string,
  quoteCurrency: string,
  secProfileCurrency?: string | null,
): Promise<ReportingCurrency> {
  const sec = secProfileCurrency !== undefined
    ? secProfileCurrency
    : (await secReportingProfile(ticker).catch(() => null))?.currency ?? null;
  if (sec) return { currency: sec, source: 'sec' };
  const probed = await probeYahooReportingCurrency(yahooSymbol).catch(() => null);
  if (probed) return { currency: probed, source: 'yahoo' };
  return { currency: resolveCurrencyUnit(quoteCurrency).major, source: 'assumed-quote-major' };
}

/** Vide la mémoïsation — tests uniquement. */
export function __resetReportingCurrencyCache(): void {
  probeCache.clear();
}
