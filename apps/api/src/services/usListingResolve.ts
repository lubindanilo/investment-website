/**
 * usListingResolve — retrouve la cotation NYSE/NASDAQ d'une société étrangère à partir de
 * son NOM, via le référentiel public SEC company_tickers_exchange.json.
 *
 * Pourquoi : chez stockanalysis, l'historique d'effectifs est intégral et GRATUIT sur les
 * pages US /stocks/ (ASML 25 exercices, SAP/NVO 28) mais paywallé à 5 exercices sur les pages
 * exchange (quote/…) et OTC — le paywall suit le TYPE de page. Une société EU/INTL réellement
 * cotée NYSE/NASDAQ a donc tout son historique accessible via son symbole US ; encore faut-il
 * le trouver quand il diffère du symbole domestique (NOVO-B.CO → NVO, SAN.PA → SNY).
 *
 * Garde-fous :
 *   - seuls NYSE et Nasdaq comptent (l'OTC est paywallé comme les pages exchange) ;
 *   - correspondance de nom par Jaccard sur tokens normalisés (accents, formes juridiques et
 *     mots-outils retirés), seuil 0,6 : « Siemens AG » ≠ « Siemens Energy AG » (0,5),
 *     « Orange » ≠ « Orange County Bancorp » ;
 *   - une seule société (CIK) doit matcher — l'ambiguïté vaut absence ;
 *   - le caller RE-VÉRIFIE le nom dans le payload stockanalysis avant d'ingérer quoi que ce
 *     soit (piège réel : /stocks/mc = Moelis & Company, pas LVMH).
 */

const UA = 'lubin-investment (admin@hyperstack.studio)'; // SEC exige un User-Agent identifiable
const LISTINGS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';

interface UsListing { cik: number; name: string; ticker: string; exchange: string }

let listingsPromise: Promise<UsListing[]> | null = null;

/** Référentiel SEC {cik, name, ticker, exchange}, filtré NYSE/Nasdaq, mémoïsé à vie process. */
async function loadUsListings(): Promise<UsListing[]> {
  if (!listingsPromise) {
    listingsPromise = (async () => {
      const res = await fetch(LISTINGS_URL, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`SEC listings HTTP ${res.status}`);
      const raw = await res.json() as { fields: string[]; data: unknown[][] };
      const idx = (f: string) => raw.fields.indexOf(f);
      const [iCik, iName, iTicker, iExch] = [idx('cik'), idx('name'), idx('ticker'), idx('exchange')];
      if ([iCik, iName, iTicker, iExch].some(i => i < 0)) throw new Error('SEC listings : format inattendu');
      const out: UsListing[] = [];
      for (const row of raw.data) {
        const exchange = String(row[iExch] ?? '');
        if (!/^(NYSE|Nasdaq)$/i.test(exchange)) continue; // OTC/CBOE exclus (paywallés côté SA)
        const ticker = String(row[iTicker] ?? '');
        const name = String(row[iName] ?? '');
        const cik = Number(row[iCik]);
        if (ticker && name && Number.isFinite(cik)) out.push({ cik, name, ticker, exchange });
      }
      return out;
    })().catch(err => { listingsPromise = null; throw err; });
  }
  return listingsPromise;
}

/**
 * Formes juridiques et mots-outils retirés AU NIVEAU TOKEN : ils portent zéro information
 * d'identité et divergent systématiquement entre référentiels (« Hermès International Société
 * en commandite par actions » côté stockanalysis vs « Hermes International » côté cours).
 */
const LEGAL_STOPWORDS = new Set([
  'sa', 'se', 'nv', 'ag', 'plc', 'ab', 'as', 'asa', 'oyj', 'oy', 'spa', 'sca', 'kgaa', 'gmbh',
  'a', 's', 'n', 'v', 'p', 'l', 'c', 'inc', 'incorporated', 'corp', 'corporation', 'ltd',
  'limited', 'llc', 'lp', 'co', 'cie', 'company', 'compagnie', 'societe', 'societa', 'sociedad',
  'aktiengesellschaft', 'aktiebolag', 'holding', 'holdings', 'group', 'groupe', 'grupo',
  'europeenne', 'commandite', 'par', 'actions', 'anonyme', 'the', 'and', 'of', 'de', 'des',
  'du', 'et', 'en', 'la', 'le', 'les',
]);

/** Tokens d'identité d'un nom de société : minuscules, sans accents, sans légalese. Exporté pour tests. */
export function normalizeCompanyTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0 && !LEGAL_STOPWORDS.has(t));
}

/**
 * Deux noms désignent-ils la même société ? Jaccard ≥ 0,6 sur les tokens d'identité.
 * Le seuil rejette les cousines (« Siemens » vs « Siemens Energy » = 0,5) tout en absorbant
 * les variantes de graphie d'un même nom. Exporté pour tests.
 */
export function companyNamesMatch(a: string, b: string): boolean {
  const ta = new Set(normalizeCompanyTokens(a));
  const tb = new Set(normalizeCompanyTokens(b));
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter >= 1 && inter / union >= 0.6;
}

/**
 * Symbole NYSE/NASDAQ d'une société identifiée par son nom, ou null si introuvable OU ambigu
 * (plusieurs CIK distincts matchent → on ne devine pas). Plusieurs tickers d'un même CIK =
 * classes d'actions : on prend le plus court (la classe principale : « NVO » avant « NVO-PB »).
 */
export async function findUsListingByName(companyName: string): Promise<string | null> {
  const listings = await loadUsListings().catch(() => null);
  if (!listings) return null;
  const matches = listings.filter(l => companyNamesMatch(l.name, companyName));
  const ciks = new Set(matches.map(m => m.cik));
  if (ciks.size !== 1) return null;
  return matches.map(m => m.ticker).sort((x, y) => x.length - y.length || x.localeCompare(y))[0]!;
}
