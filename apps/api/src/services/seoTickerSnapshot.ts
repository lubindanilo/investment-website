/**
 * seoTickerSnapshot — instantané mémoire de l'univers noté, servi au PRÉ-RENDU BOT.
 *
 * POURQUOI (03/09/2026). Mesure sur 24 h de logs de production : 156 requêtes serveur, presque
 * toutes émises par des crawlers qui parcourent le catalogue par ordre alphabétique (AEO, AERT,
 * AES, AIIO, AIMD…), et presque toutes en `cache=MISS`. Le CDN n'y peut rien : son `s-maxage` de
 * 24 h protège les visites répétées d'une MÊME URL, or un robot qui balaie 9 435 fiches distinctes
 * ne repasse jamais sur la même. Chacune de ces requêtes réveillait donc Postgres, et sur Neon un
 * réveil isolé coûte 5 MINUTES de compute facturé quelle que soit la durée de la requête (la veille
 * se déclenche après 5 min d'inactivité). 156 × 5 min ≈ 13 h d'éveil par jour, sur les ~20 h
 * mesurées en août : le poste principal de la facture, devant les crons.
 *
 * CE QUE FAIT CE MODULE. Les 8 requêtes du pré-rendu bot lisaient TOUTES la même table
 * (`ScreenerTicker`), toutes filtrées sur `status = 'scored'`, sur 15 colonnes, pour 1,2 Mo au
 * total. Elles sont donc remplaçables par un seul instantané tenu en mémoire du process, chargé à
 * la première demande puis réutilisé. Une instance de lambda sert alors une rafale de crawl entière
 * (~50 pages en 6 min dans les logs) avec UNE lecture au lieu de cent.
 *
 * POURQUOI PAS UN ARTEFACT STATIQUE GÉNÉRÉ AU BUILD. Ce serait zéro requête au lieu d'environ une
 * par instance, soit ~0,45 $/mois de mieux. En échange il faudrait que le build dépende de la base
 * (donc un build qui casse quand Neon dort, ce qui est arrivé 12 jours en août) et que la fraîcheur
 * des fiches suive la cadence des DÉPLOIEMENTS au lieu de celle du scoring. Le rapport n'y est pas.
 *
 * EFFET DE BORD RECHERCHÉ : la surface SEO survit à une panne de base. Tant qu'un instantané est en
 * mémoire, un rafraîchissement en échec ne casse rien — on continue de servir le précédent. Pendant
 * la suspension Neon du 21/08 au 01/09, les fiches renvoyaient 503 à tous les crawlers.
 *
 * ⚠️ RÉSERVÉ AU CHEMIN BOT. Les routes humaines (`/api/analyze`, `/api/screener/*`) gardent leurs
 * requêtes : elles servent de l'intraday ou des données par utilisateur, que cet instantané ne
 * porte pas. Ne jamais y brancher une réponse qui dépend de l'utilisateur.
 */
import { prisma } from '../db/client.js';

/** Colonnes réellement lues par le pré-rendu bot : l'union des 8 `select` d'origine, rien de plus. */
export interface SeoTickerRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  currency: string | null;
  price: number | null;
  opportunity: boolean;
  region: string;
  marketCap: number | null;
  scoreRatio: number | null;
  exchange: string | null;
  status: string;
  lastScoredAt: Date | null;
}

export interface SeoSnapshot {
  rows: SeoTickerRow[];
  byTicker: Map<string, SeoTickerRow>;
  /** Secteurs distincts non vides, calculés une fois au chargement. */
  sectors: string[];
  loadedAt: number;
}

/**
 * Durée de validité. 6 h par défaut : les notes ne bougent qu'au scoring de nuit, et le TTL CDN des
 * fiches est déjà de 24 h — un instantané plus frais que le cache qui le sert ne servirait à rien.
 * Plus il est long, moins il y a de réveils ; plus il est court, plus une instance de longue durée
 * suit le scoring. Réglable sans déploiement.
 */
const DEFAULT_TTL_MS = 6 * 3600 * 1000;

const ttlMs = (): number => {
  const raw = Number(process.env.SEO_SNAPSHOT_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
};

let current: SeoSnapshot | null = null;
/**
 * Chargement en cours, partagé. Sans cette déduplication, une rafale de crawl arrivant sur une
 * instance froide lancerait N lectures de tout l'univers en parallèle — précisément le pic qu'on
 * cherche à supprimer.
 */
let inFlight: Promise<SeoSnapshot> | null = null;

async function fetchSnapshot(): Promise<SeoSnapshot> {
  const rows = await prisma.screenerTicker.findMany({
    where: { status: 'scored' },
    select: {
      ticker: true, name: true, sector: true, scoreChiffres: true, scoreChiffresMax: true,
      pfcfTTM: true, currency: true, price: true, opportunity: true, region: true,
      marketCap: true, scoreRatio: true, exchange: true, status: true, lastScoredAt: true,
    },
  });

  const byTicker = new Map<string, SeoTickerRow>();
  const sectors = new Set<string>();
  for (const row of rows) {
    byTicker.set(row.ticker, row);
    if (row.sector) sectors.add(row.sector);
  }
  return { rows, byTicker, sectors: [...sectors], loadedAt: Date.now() };
}

/**
 * Instantané courant, rechargé si périmé.
 *
 * En cas d'échec du rafraîchissement, on RE-SERT le précédent s'il existe : une base injoignable ne
 * doit pas transformer tout le catalogue en 503 pour les crawlers. On ne propage l'erreur que
 * lorsqu'il n'y a rien à servir du tout, cas où l'appelant rend déjà sa page d'erreur.
 */
export async function getSnapshot(): Promise<SeoSnapshot> {
  if (current && Date.now() - current.loadedAt < ttlMs()) return current;
  if (inFlight) return inFlight;

  inFlight = fetchSnapshot()
    .then(snap => { current = snap; return snap; })
    .catch((err: Error) => {
      if (current) {
        console.error(`[seoSnapshot] rafraîchissement en échec, on garde l'instantané précédent : ${err.message}`);
        return current;
      }
      throw err;
    })
    .finally(() => { inFlight = null; });

  return inFlight;
}

/**
 * Tri « meilleures notes d'abord », équivalent de `orderBy: { scoreRatio: 'desc' }`.
 *
 * LE DÉPARTAGE DES EX ÆQUO EST EXPLICITE, ET C'EST INDISPENSABLE. `scoreRatio` avance par pas de
 * 0,1, donc les égalités sont massives : 97 titres à 1,0 et 504 à 0,9 au 03/09/2026. Or les huit
 * requêtes d'origine n'avaient AUCUN critère secondaire — l'ordre à l'intérieur d'une égalité
 * sortait du plan Postgres, donc n'était garanti par rien. Le palmarès du hub d'accueil prend 100
 * lignes : 97 ex æquo à 1,0 plus TROIS des 504 à 0,9, choisies au hasard du plan.
 *
 * `ticker` DÉCROISSANT n'est pas un choix esthétique : c'est l'ordre que Postgres rendait en
 * pratique, vérifié par comparaison sur la base réelle (palmarès global, trois hubs secteur, trois
 * maillages sectoriels). Le reprendre rend la bascule NEUTRE SUR LE CONTENU des pages indexées, ce
 * qui est le seul objectif d'un refactor. Si un jour on veut un meilleur départage — la plus grosse
 * capitalisation d'abord, par exemple — c'est une décision produit à prendre séparément, pas un
 * effet de bord à subir ici.
 *
 * `scoreRatio` n'est jamais nul parmi les lignes notées (vérifié : 0 sur 9 435), mais on place
 * quand même les nulls en fin plutôt que de les laisser gagner un comparateur NaN.
 */
const byScoreDesc = (a: SeoTickerRow, b: SeoTickerRow): number => {
  const d = (b.scoreRatio ?? -Infinity) - (a.scoreRatio ?? -Infinity);
  return d !== 0 ? d : (a.ticker < b.ticker ? 1 : a.ticker > b.ticker ? -1 : 0);
};

/** Une fiche notée, ou undefined (ticker inconnu OU pas encore noté — l'appelant rend un 404). */
export async function getTickerRow(ticker: string): Promise<SeoTickerRow | undefined> {
  return (await getSnapshot()).byTicker.get(ticker);
}

/** Maillage interne : les mieux notées du même secteur, la fiche courante exclue. */
export async function getRelatedBySector(sector: string, excludeTicker: string, limit: number): Promise<SeoTickerRow[]> {
  const { rows } = await getSnapshot();
  return rows
    .filter(r => r.sector === sector && r.ticker !== excludeTicker)
    .sort(byScoreDesc)
    .slice(0, limit);
}

/** Secteurs distincts non vides. L'ordre n'est pas garanti, comme le `distinct` d'origine. */
export async function getSectors(): Promise<string[]> {
  return (await getSnapshot()).sectors;
}

/** Les mieux notées d'un secteur. */
export async function getBySector(sector: string, limit: number): Promise<SeoTickerRow[]> {
  const { rows } = await getSnapshot();
  return rows.filter(r => r.sector === sector).sort(byScoreDesc).slice(0, limit);
}

/** Les mieux notées, tous secteurs confondus. */
export async function getTopByScore(limit: number): Promise<SeoTickerRow[]> {
  return [...(await getSnapshot()).rows].sort(byScoreDesc).slice(0, limit);
}

/** Lignes notées correspondant à ces tickers ; celles absentes sont simplement omises. */
export async function getByTickers(tickers: string[]): Promise<SeoTickerRow[]> {
  const { byTicker } = await getSnapshot();
  return tickers.map(t => byTicker.get(t)).filter((r): r is SeoTickerRow => !!r);
}

/** Purge l'instantané. Réservé aux tests : rien en production ne doit invalider à la main. */
export function __resetSnapshotForTests(): void {
  current = null;
  inFlight = null;
}
