/**
 * marketTiers — normalisation du market cap en USD + calendrier de publication, pour piloter la
 * CADENCE de re-scoring par tier (cf. pickDueTickers dans screener.ts).
 *
 * Pourquoi : `marketCap` est stocké en DEVISE LOCALE (prix × actions, tous deux locaux). Un seuil
 * unique « 10 Md » classerait mal un titre japonais (¥) vs indien (₹). On normalise en USD avec une
 * table de change statique — précision suffisante pour BUCKETISER (large / mid / small), pas pour
 * de l'affichage. À rafraîchir de temps en temps (ordres de grandeur, ça bouge lentement).
 */

/**
 * Unités de devise locale pour 1 USD (approx, pour le bucketing).
 *
 * Une devise ABSENTE de cette table est traitée comme si elle valait le dollar : MOL (Budapest)
 * ressortait ainsi à 3 119 Md$ au lieu de ~6 Md, ses forints étant comptés pour des dollars. Toute
 * bourse ajoutée à l'univers doit donc apporter sa devise ici (cf. le test de couverture).
 */
export const FX_PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CHF: 0.88, SEK: 10.5, DKK: 6.9, NOK: 10.8,
  JPY: 150, HKD: 7.8, CNY: 7.2, INR: 83, KRW: 1350, TWD: 32, IDR: 16000,
  THB: 36, SGD: 1.35, VND: 25000, SAR: 3.75, ZAR: 18, TRY: 34, CAD: 1.37,
  AUD: 1.5, BRL: 5.4,
  // Europe centrale (Varsovie, Budapest, Prague) : présentes dans l'univers, absentes de la table
  // jusqu'ici, donc leurs capitalisations étaient surévaluées de deux ordres de grandeur.
  PLN: 3.6, HUF: 350, CZK: 21,
  ILS: 3.7,
};

/**
 * UNITÉS SECONDAIRES, à ne surtout pas confondre avec la devise principale : Yahoo cote les
 * titres londoniens en PENCE (`GBp`, cent de livre), les sud-africains en cents (`ZAc`) et les
 * israéliens en agorot (`ILA`). Le code passait par `toUpperCase()`, donc `GBp` devenait `GBP` et
 * une capitalisation en pence était divisée comme si c'étaient des livres : ×100 d'un coup. GSK
 * ressortait à 9 988 Md$ pour ~88 Md$ réels, et tout Londres occupait le haut du classement.
 *
 * La casse est donc SIGNIFIANTE ici, on résout avant de normaliser.
 */
const MINOR_UNIT_PER_MAJOR: Record<string, { major: string; per: number }> = {
  GBp: { major: 'GBP', per: 100 },   // pence par livre
  ZAc: { major: 'ZAR', per: 100 },   // cents par rand
  ILA: { major: 'ILS', per: 100 },   // agorot par shekel
};

/**
 * Sous-unités par unité majeure pour une devise de COTATION (GBp → 100, EUR → 1).
 * Sert à comparer une capitalisation publiée en unité majeure (la convention Yahoo : AZN.L
 * cote 12 087 GBp mais publie 187 Md GBP) avec un recalcul prix × actions fait en sous-unité.
 */
export function minorUnitsPerMajor(currency: string | null | undefined): number {
  return (currency && MINOR_UNIT_PER_MAJOR[currency]?.per) || 1;
}

/** Unités de la devise de cotation pour 1 USD, en tenant compte des unités secondaires. */
export function fxPerUsd(currency: string | null | undefined): number | null {
  if (!currency) return 1;
  const minor = MINOR_UNIT_PER_MAJOR[currency];
  if (minor) {
    const majorFx = FX_PER_USD[minor.major];
    return majorFx && majorFx > 0 ? majorFx * minor.per : null;
  }
  const fx = FX_PER_USD[currency.toUpperCase()];
  return fx && fx > 0 ? fx : null;
}

/** Convertit un market cap local en USD (devise inconnue → supposée déjà ~USD). Null si absent. */
export function marketCapToUsd(marketCap: number | null | undefined, currency: string | null | undefined): number | null {
  if (marketCap == null || !isFinite(marketCap)) return null;
  const fx = fxPerUsd(currency);
  return fx && fx > 0 ? marketCap / fx : marketCap;
}

// ── Seuils de tier (USD) et note ──────────────────────────────────────────────
/** ≥ ce cap → tier « lendemain » (fraîcheur max). */
export const DAYAFTER_CAP_USD = 10_000_000_000;   // 10 Md$
/** ≥ ce cap → tier « mid » ; en dessous → « small ». */
export const MID_CAP_USD = 1_000_000_000;         // 1 Md$
/** Note (scoreChiffres/max) au-delà de laquelle un titre est prioritaire quelle que soit sa capi. */
export const HIGH_SCORE_RATIO = 0.7;              // 7/10

// ── Calendrier de publication des A-shares chinoises (.SS / .SZ) ───────────────
// Exercice clos au 31/12 OBLIGATOIRE (règles CSRC/SSE/SZSE). Dates limites de dépôt :
//   ~30 avril  : rapport annuel + T1     → on vise le 05/05 (buffer dépôt + ingestion stockanalysis)
//   ~31 août   : rapport semestriel (S1) → 05/09
//   ~31 octobre: rapport T3              → 05/11
// Yahoo ne fournit pas de « next earnings » pour ces titres → on synthétise la prochaine échéance,
// ce qui les rend pilotés par le calendrier réglementaire au lieu d'un poll aveugle.
const ASHARE_DEADLINES = ['05-05', '09-05', '11-05'];

/** Prochaine échéance de publication A-share strictement après `fromIso` (YYYY-MM-DD). */
export function nextAshareDisclosure(fromIso: string): string {
  const year = Number(fromIso.slice(0, 4));
  for (const y of [year, year + 1]) {
    for (const md of ASHARE_DEADLINES) {
      const d = `${y}-${md}`;
      if (d > fromIso) return d;
    }
  }
  return `${year + 1}-${ASHARE_DEADLINES[0]}`;
}

/** True si le ticker est une A-share chinoise (bourses continentales). */
export function isChinaAshare(ticker: string): boolean {
  const u = ticker.toUpperCase();
  return u.endsWith('.SS') || u.endsWith('.SZ');
}
