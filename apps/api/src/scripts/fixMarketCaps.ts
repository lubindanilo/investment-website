/**
 * fixMarketCaps — recalcule `marketCap` / `marketCapUsd` des titres déjà notés, avec la règle
 * de marketCapResolve, SANS re-scorer et SANS aucun appel réseau.
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
 * Usage :
 *   pnpm --filter @lubin/api exec tsx src/scripts/fixMarketCaps.ts            → SIMULATION
 *   pnpm --filter @lubin/api exec tsx src/scripts/fixMarketCaps.ts --apply    → écrit en base
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { resolveMarketCap } from '../services/marketCapResolve.js';
import { marketCapToUsd } from '../services/marketTiers.js';

const APPLY = process.argv.includes('--apply');
/** Restreint la correction à quelques tickers, pour traiter une anomalie identifiée sans
 *  réécrire toute la table (le reste des écarts n'est souvent que de la dérive de prix). */
const ONLY = ((process.argv.find(a => a.startsWith('--tickers=')) ?? '').split('=')[1] ?? '')
  .split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
const PAGE = 500;
/** Écart relatif en dessous duquel on ne touche pas la ligne (bruit de recalcul). */
const REL_TOLERANCE = 0.01;

interface SnapshotShape {
  fundamentalsSource?: string | null;
  sharesOutstanding?: number | null;
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

/**
 * Écrit une page en UNE requête, via une liste VALUES. `Prisma.sql` paramètre chaque valeur,
 * donc pas de concaténation de chaînes dans le SQL.
 */
async function flush(updates: Update[]): Promise<void> {
  const values = Prisma.join(updates.map(u => Prisma.sql`(${u.ticker}, ${u.marketCap}::double precision, ${u.marketCapUsd}::double precision)`));
  await prisma.$executeRaw`
    UPDATE "ScreenerTicker" AS s
       SET "marketCap" = v.cap, "marketCapUsd" = v.cap_usd
      FROM (VALUES ${values}) AS v(ticker, cap, cap_usd)
     WHERE s.ticker = v.ticker`;
}

async function main() {
  console.log(APPLY ? '⚠️  MODE ÉCRITURE (--apply)\n' : 'Mode simulation (ajoute --apply pour écrire)\n');

  let cursor: string | undefined;
  let seen = 0, changed = 0, cleared = 0, reclassified = 0, noSnapshot = 0;
  const samples: string[] = [];
  const pending: Update[] = [];

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

    for (const row of rows) {
      seen++;
      const snap = byTicker.get(row.ticker);
      // Sans snapshot on ne peut rien recalculer : on laisse la ligne telle quelle, son
      // prochain scoring la corrigera avec la nouvelle règle.
      if (!snap) { noSnapshot++; continue; }

      // Prix : celui du snapshot, sinon celui de la ligne screener (rafraîchi en continu par la
      // ré-évaluation live du flag « opportunité »). 29 snapshots n'ont PAS de prix, dont 26 dont
      // la ligne en a un — et sans prix, `resolveMarketCap` ne peut RIEN recouper et accepte la
      // capi publiée telle quelle. C'est par ce trou qu'EQNR a gardé 907 Md$ : Finnhub publie sa
      // capitalisation en COURONNES (907 528 M NOK, le travers déjà constaté sur AKO.A en pesos)
      // alors que le titre est étiqueté USD. Avec le prix, le recoupement prix × actions ramène
      // 94 Md$ et la règle de désaccord tranche pour la plus petite des deux.
      const price = snap.metrics?.price ?? row.price ?? null;
      const { marketCap } = resolveMarketCap({
        fundamentalsSource: snap.fundamentalsSource ?? null,
        reportedMarketCap: snap.metrics?.marketCap ?? null,
        price,
        sharesOutstanding: snap.sharesOutstanding ?? null,
      }, value => marketCapToUsd(value, row.currency));
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
  console.log(`capitalisations corrigées : ${changed}`);
  console.log(`  dont mises à null       : ${cleared} (aucune valeur crédible)`);
  console.log(`  dont changent de tranche: ${reclassified}`);
  if (samples.length) {
    console.log("\nÉchantillon des corrections :");
    console.log(samples.join('\n'));
  }
  console.log(APPLY ? '\n✅ Écrit en base.' : '\nRien écrit. Relance avec --apply pour appliquer.');
  await prisma.$disconnect();
}

main().catch(async e => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
