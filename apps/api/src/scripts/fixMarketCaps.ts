/**
 * fixMarketCaps — recalcule `marketCap` / `marketCapUsd` des titres déjà notés, avec la règle
 * de marketCapResolve, SANS re-scorer et (par défaut) SANS aucun appel réseau.
 *
 * Pourquoi ce script plutôt qu'un re-scoring : la base est sur Neon Free (~100 CU-h/mois),
 * c'est le facteur limitant du projet. Toutes les données nécessaires sont déjà là, dans le
 * snapshot mis en cache (`TickerQuantSnapshot.snapshot`) : on relit, on recalcule, on écrit
 * les deux colonnes. ~7 000 lectures de 3 Ko et autant d'UPDATE ciblés.
 *
 * Deux anomalies corrigées :
 *   1. `prix × actions` du chemin Finnhub, quand le nombre d'actions de /financials-reported est
 *      faux (Seaboard : 9,6e11 actions publiées pour 1,16 M réelles → 5 221 979 Md$).
 *   2. `marketCapUsd` vide sur 6 618 lignes sur 6 818, alors que c'est désormais la colonne qui
 *      porte le filtre Small/Mid/Large (les seuils en dollars n'ont aucun sens en yens).
 *
 * MODE --adr (opt-in, fait du réseau) : recoupe en plus les ADR contre la capi publiée Yahoo
 * (référence de convention, cf. audit ADS du 05/08/2026 et marketCapResolve).
 * C'est le correctif one-shot des capis Finnhub arrivées en devise NATIVE sous le seuil de
 * désaccord ×10 (BEKE : 146,8 Md « USD » qui sont des CNY, réel ~18,6 Md$) et des shares XBRL
 * fausses de la même façon que la capi (SBS). Sans lui, ces lignes ne se répareraient qu'au
 * prochain re-scoring de chaque titre — le drain n'avance pas assez vite.
 * Réseau induit : ~1-2 sondes SEC par ticker US non suffixé (devise de reporting, memoïsé)
 * et 1 quoteSummary Yahoo par ADR étranger détecté (~700, memoïsé 6 h).
 *
 * MODE --yahoo (opt-in, fait du réseau) : recoupe les lignes servies par le CHEMIN YAHOO
 * (fundamentalsSource = 'yahoo', EU/INTL essentiellement) contre la capi publiée Yahoo.
 * Sur ce chemin, derived et reported sont IDENTIQUES par construction (sharesOutstanding du
 * snapshot = marketCap / price), donc le recoupement interne de resolveMarketCap est aveugle :
 * seule une référence indépendante démasque les séries d'actions Yahoo à échelle mélangée
 * (mesuré le 06/08/2026 : ALFPC.PA stocké à 143,67 Md€ pour ~145 M€ réels, facteur 1000 sur
 * annualDilutedAverageShares — la nano-cap volait la tête de la file résilience). La capi
 * publiée arrive en unité MAJEURE quand le prix cote en sous-unité (GBp) → conversion avant
 * comparaison. En SIMULATION, ce mode sert aussi de QUANTIFICATION des lignes touchées.
 * Réseau induit : 1 quoteSummary Yahoo par ligne yahoo notée (memoïsé 6 h).
 * ⚠ À COMBINER avec --adr pour une passe d'écriture : sans référence de convention, les ADR
 * corrigés par un précédent --adr RÉGRESSENT au recalcul interne (mesuré le 06/08/2026 :
 * HDB retombait à null — capi Finnhub en ROUPIES au-dessus du plafond de vraisemblance —
 * et IX au dérivé faux 8,4 Md$ pour ~44,9 Md$ réels).
 *
 * Usage :
 *   pnpm --filter @lubin/api exec tsx src/scripts/fixMarketCaps.ts                    → SIMULATION
 *   pnpm --filter @lubin/api exec tsx src/scripts/fixMarketCaps.ts --apply            → écrit en base
 *   pnpm --filter @lubin/api exec tsx src/scripts/fixMarketCaps.ts --adr [--apply]    → + recoupement Yahoo des ADR
 *   pnpm --filter @lubin/api exec tsx src/scripts/fixMarketCaps.ts --yahoo [--apply]  → + recoupement des lignes chemin Yahoo
 *   … --dump=corrections.csv : écrit CHAQUE correction (l'échantillon console est plafonné à 25)
 */
import { writeFile } from 'node:fs/promises';
import '../env.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { resolveMarketCap } from '../services/marketCapResolve.js';
import { marketCapToUsd, minorUnitsPerMajor } from '../services/marketTiers.js';
import { getSecReportingCurrency } from '../services/secEdgar.js';
import { getYahooMarketCap } from '../services/yahoo.js';

const APPLY = process.argv.includes('--apply');
const ADR = process.argv.includes('--adr');
const YAHOO = process.argv.includes('--yahoo');
/** Restreint la correction à quelques tickers, pour traiter une anomalie identifiée sans
 *  réécrire toute la table (le reste des écarts n'est souvent que de la dérive de prix). */
const ONLY = ((process.argv.find(a => a.startsWith('--tickers=')) ?? '').split('=')[1] ?? '')
  .split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
/** Chemin d'un CSV d'audit listant TOUTES les corrections (la console n'en montre que 25). */
const DUMP = (process.argv.find(a => a.startsWith('--dump=')) ?? '').split('=')[1] ?? '';
const PAGE = 500;
/** Écart relatif en dessous duquel on ne touche pas la ligne (bruit de recalcul). */
const REL_TOLERANCE = 0.01;

interface SnapshotShape {
  fundamentalsSource?: string | null;
  sharesOutstanding?: number | null;
  yahooSymbol?: string | null;
  metrics?: { marketCap?: number | null; price?: number | null } | null;
}

/** Tranche de capitalisation en dollars, pour montrer les reclassements. */
function bucket(usd: number | null): string {
  if (usd == null || usd <= 0) return 'aucune';
  if (usd < 2e9) return 'small';
  if (usd < 10e9) return 'mid';
  return 'large';
}

function fmt(v: number | null): string {
  if (v == null) return 'null';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)} Md`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)} M`;
  return v.toFixed(0);
}

interface Update { ticker: string; marketCap: number | null; marketCapUsd: number | null }

/** Pool de concurrence borné — SEC plafonne à 10 req/s, on vise ~6 (même réglage que l'audit). */
async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
      await new Promise(r => setTimeout(r, 350));
    }
  }));
  return out;
}

/**
 * Capi Yahoo (référence de convention) pour une page de lignes. Deux périmètres cumulables :
 *   --adr   : tickers US non suffixés dont la devise de REPORTING (EDGAR, us-gaap puis
 *             ifrs-full) n'est pas l'USD ;
 *   --yahoo : lignes servies par le chemin Yahoo (fundamentalsSource = 'yahoo' du snapshot),
 *             où derived et reported sont identiques par construction — seule cette référence
 *             indépendante peut les contredire. Symbole sondé = yahooSymbol du snapshot,
 *             sinon le ticker (les suffixés de l'univers SONT des symboles Yahoo).
 * Renvoie Map<ticker, capi absolue en devise de cotation, sous-unité du prix comprise> +
 * l'ensemble des tickers dont une SONDE A ÉCHOUÉ (réseau, throttle) — vide hors --adr/--yahoo.
 * Sondes memoïsées par process : un ticker ne coûte jamais deux fois.
 *
 * ⚠ Échec de sonde ≠ absence de donnée. Mesuré le 06/08/2026 : une coupure réseau en plein run
 * a transformé les échecs en « pas de référence de convention » et le recalcul interne aurait
 * écrasé des ADR corrects (HDB → null, IX → dérivé faux). D'où les sondes en failHard et le
 * périmètre `failed` : l'appelant SAUTE ces lignes, un run ultérieur les traitera.
 */
async function fetchIndependentCaps(
  rows: Array<{ ticker: string; currency: string | null }>,
  snapByTicker: Map<string, SnapshotShape>,
): Promise<{ caps: Map<string, number>; failed: Set<string> }> {
  const caps = new Map<string, number>();
  const failed = new Set<string>();
  if (!ADR && !YAHOO) return { caps, failed };

  const keep = (r: { ticker: string; currency: string | null }, cap: { marketCap: number; currency: string | null } | null): void => {
    if (!cap || (cap.currency != null && cap.currency !== r.currency)) return;
    // La capi publiée est en unité MAJEURE même quand le prix cote en sous-unité (AZN.L :
    // 187,46 Md GBP pour un prix en pence) → on la ramène dans l'unité du prix de la ligne.
    caps.set(r.ticker, cap.marketCap * minorUnitsPerMajor(r.currency));
  };

  if (ADR) {
    const candidates = rows.filter(r => !r.ticker.includes('.'));
    await pool(candidates, 3, async (r) => {
      try {
        // getSecReportingCurrency renvoie null pour un déposant USD (rien à convertir) ET pour un
        // ticker sans XBRL : dans les deux cas, pas de risque de convention → pas d'appel Yahoo.
        const reporting = await getSecReportingCurrency(r.ticker, { failHard: true });
        if (!reporting) return;
        keep(r, await getYahooMarketCap(r.ticker, { failHard: true }));
      } catch {
        failed.add(r.ticker);
      }
    });
  }

  if (YAHOO) {
    const candidates = rows.filter(r => !caps.has(r.ticker) && !failed.has(r.ticker)
      && snapByTicker.get(r.ticker)?.fundamentalsSource === 'yahoo');
    await pool(candidates, 3, async (r) => {
      try {
        const symbol = snapByTicker.get(r.ticker)?.yahooSymbol ?? r.ticker;
        keep(r, await getYahooMarketCap(symbol, { failHard: true }));
      } catch {
        failed.add(r.ticker);
      }
    });
  }

  return { caps, failed };
}

/**
 * Écrit une page en UNE requête, via une liste VALUES. `Prisma.sql` paramètre chaque valeur,
 * donc pas de concaténation de chaînes dans le SQL.
 */
async function flush(updates: Update[]): Promise<void> {
  const values = Prisma.join(updates.map(u => Prisma.sql`(${u.ticker}, ${u.marketCap}::double precision, ${u.marketCapUsd}::double precision)`));
  // 3 tentatives espacées : un timeout transitoire du pool Neon a tué le run du 06/08 après
  // 25 minutes de sondes — l'UPDATE est idempotent, le retry est sans risque.
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$executeRaw`
        UPDATE "ScreenerTicker" AS s
           SET "marketCap" = v.cap, "marketCapUsd" = v.cap_usd
          FROM (VALUES ${values}) AS v(ticker, cap, cap_usd)
         WHERE s.ticker = v.ticker`;
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.warn(`\n[flush] échec (tentative ${attempt}/3), nouvel essai dans ${10 * attempt} s : ${(e as Error).message.split('\n')[0]}`);
      await new Promise(r => setTimeout(r, 10_000 * attempt));
    }
  }
}

async function main() {
  console.log(APPLY ? '⚠️  MODE ÉCRITURE (--apply)\n' : 'Mode simulation (ajoute --apply pour écrire)\n');
  if (ADR) console.log('Mode --adr : recoupement des ADR contre la capi publiée Yahoo (sondes SEC + Yahoo)\n');
  if (YAHOO) console.log('Mode --yahoo : recoupement des lignes chemin Yahoo contre la capi publiée Yahoo\n');

  let cursor: string | undefined;
  let seen = 0, changed = 0, cleared = 0, reclassified = 0, noSnapshot = 0, viaIndependent = 0, probeFailed = 0;
  const samples: string[] = [];
  const pending: Update[] = [];
  const dumpLines: string[] = [];

  for (;;) {
    const rows = await prisma.screenerTicker.findMany({
      where: { status: 'scored', ...(ONLY.length ? { ticker: { in: ONLY } } : {}) },
      orderBy: { ticker: 'asc' },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { ticker: cursor } } : {}),
      select: { ticker: true, currency: true, marketCap: true, marketCapUsd: true, price: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1]!.ticker;

    const snaps = await prisma.tickerQuantSnapshot.findMany({
      where: { ticker: { in: rows.map(r => r.ticker) } },
      select: { ticker: true, snapshot: true },
    });
    const byTicker = new Map(snaps.map(s => [s.ticker, s.snapshot as SnapshotShape]));
    // Capi Yahoo des candidats de la page (Map vide hors --adr/--yahoo). Pré-passe réseau
    // groupée pour ne pas sérialiser une sonde SEC + un quoteSummary dans la boucle ligne à ligne.
    const { caps: independentCaps, failed: probeFailures } = await fetchIndependentCaps(rows, byTicker);

    for (const row of rows) {
      seen++;
      const snap = byTicker.get(row.ticker);
      // Sans snapshot on ne peut rien recalculer : on laisse la ligne telle quelle, son
      // prochain scoring la corrigera avec la nouvelle règle.
      if (!snap) { noSnapshot++; continue; }
      // Sonde en échec (réseau, throttle) : recalculer SANS la référence de convention pourrait
      // écraser une valeur juste (HDB → null pendant la coupure du 06/08). On saute la ligne.
      if (probeFailures.has(row.ticker)) { probeFailed++; continue; }

      // Prix : celui du snapshot, sinon celui de la ligne screener (rafraîchi en continu par la
      // ré-évaluation live du flag « opportunité »). 29 snapshots n'ont PAS de prix, dont 26 dont
      // la ligne en a un — et sans prix, `resolveMarketCap` ne peut RIEN recouper et accepte la
      // capi publiée telle quelle. C'est par ce trou qu'EQNR a gardé 907 Md$ : Finnhub publie sa
      // capitalisation en COURONNES (907 528 M NOK, le travers déjà constaté sur AKO.A en pesos)
      // alors que le titre est étiqueté USD. Avec le prix, le recoupement prix × actions ramène
      // 94 Md$ et la règle de désaccord tranche pour la plus petite des deux.
      const price = snap.metrics?.price ?? row.price ?? null;
      const { marketCap, source } = resolveMarketCap({
        fundamentalsSource: snap.fundamentalsSource ?? null,
        reportedMarketCap: snap.metrics?.marketCap ?? null,
        price,
        sharesOutstanding: snap.sharesOutstanding ?? null,
        independentCap: independentCaps.get(row.ticker) ?? null,
      }, value => marketCapToUsd(value, row.currency));
      if (source === 'independent') viaIndependent++;
      const marketCapUsd = marketCapToUsd(marketCap, row.currency);

      // On compare les DEUX colonnes : la capi locale peut être inchangée alors que sa conversion
      // en dollars bouge (correctif des unités secondaires, où `GBp` était traité comme `GBP`).
      const before = row.marketCap;
      const close = (a: number | null, b: number | null): boolean => {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return Math.abs(a - b) / Math.max(1, Math.abs(b)) < REL_TOLERANCE;
      };
      if (close(marketCap, before) && close(marketCapUsd, row.marketCapUsd)) continue;

      const fromBucket = bucket(marketCapToUsd(before, row.currency));
      const toBucket = bucket(marketCapUsd);
      changed++;
      if (marketCap == null && before != null) cleared++;
      if (fromBucket !== toBucket) reclassified++;
      // On montre les changements de TRANCHE et les corrections d'AMPLEUR. Sans ce second cas,
      // la correction la plus grave passait inaperçue : EQNR tombe de 907 Md$ à 94 Md$ (capi
      // publiée en couronnes) mais reste « large » d'un bout à l'autre, donc rien ne s'affichait.
      const bigSwing = before != null && marketCap != null
        && (before / marketCap > 2 || marketCap / before > 2);
      if ((fromBucket !== toBucket || bigSwing) && samples.length < 25) {
        const flag = fromBucket !== toBucket ? `[${fromBucket} → ${toBucket}]` : `[×${(before! / marketCap!).toFixed(1)}, tranche inchangée]`;
        samples.push(`  ${row.ticker.padEnd(12)} ${fmt(before).padStart(12)} → ${fmt(marketCap).padStart(12)} ${String(row.currency).padEnd(4)} ${flag}`);
      }

      if (DUMP) {
        dumpLines.push([row.ticker, before, marketCap, row.currency, source, price, fromBucket, toBucket].join(';'));
      }
      pending.push({ ticker: row.ticker, marketCap, marketCapUsd });
    }

    // Une seule requête par page au lieu d'un UPDATE par ligne : la base est sur Neon Free et
    // c'est le facteur limitant du projet. 6 300 allers-retours deviennent ~14.
    if (APPLY && pending.length) { await flush(pending); pending.length = 0; }
    process.stdout.write(`\r  ${seen} lignes examinées, ${changed} à corriger…`);
  }

  console.log('\n');
  console.log(`lignes notées examinées   : ${seen}`);
  console.log(`sans snapshot en cache    : ${noSnapshot} (corrigées à leur prochain scoring)`);
  console.log(`sondes en échec (sautées) : ${probeFailed} (relancer le script pour les traiter)`);
  console.log(`capitalisations corrigées : ${changed}`);
  console.log(`  dont mises à null       : ${cleared} (aucune valeur crédible)`);
  console.log(`  dont changent de tranche: ${reclassified}`);
  if (ADR || YAHOO) console.log(`  dont via capi Yahoo     : ${viaIndependent} (référence de convention)`);
  if (samples.length) {
    console.log("\nÉchantillon des corrections :");
    console.log(samples.join('\n'));
  }
  if (DUMP) {
    await writeFile(DUMP, `ticker;avant;apres;devise;source;prix;tranche_avant;tranche_apres\n${dumpLines.join('\n')}\n`, 'utf8');
    console.log(`\nAudit complet (${dumpLines.length} corrections) → ${DUMP}`);
  }
  console.log(APPLY ? '\n✅ Écrit en base.' : '\nRien écrit. Relance avec --apply pour appliquer.');
  await prisma.$disconnect();
}

main().catch(async e => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
