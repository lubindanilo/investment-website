/**
 * Backfill marketCap sur ScreenerTicker : capitalisation = price (colonne) × sharesOutstanding
 * (top-level du JSON TickerQuantSnapshot.snapshot, même champ que refreshOpportunitiesLive).
 *
 * Pur SQL (aucun appel réseau) → quelques secondes sur tout l'univers. Idempotent/reprenable :
 * recalcule à partir des données déjà en base. À lancer UNE FOIS après la migration
 * 20260705120000_screener_market_cap (le scoring courant remplit ensuite marketCap tout seul).
 *
 *   pnpm --filter @lubin/api exec tsx src/_backfill_market_cap.ts
 */
import { prisma } from './db/client.js';

// Le guard regex évite un cast qui planterait sur une valeur JSON non numérique.
const updated = await prisma.$executeRawUnsafe(`
  UPDATE "ScreenerTicker" s
  SET "marketCap" = s."price" * (q.snapshot->>'sharesOutstanding')::double precision
  FROM "TickerQuantSnapshot" q
  WHERE q.ticker = s.ticker
    AND s."status" = 'scored'
    AND s."price" IS NOT NULL AND s."price" > 0
    AND (q.snapshot->>'sharesOutstanding') ~ '^-?[0-9.]+([eE][+-]?[0-9]+)?$'
    AND (q.snapshot->>'sharesOutstanding')::double precision > 0
`);

const scored = await prisma.screenerTicker.count({ where: { status: 'scored' } });
const filled = await prisma.screenerTicker.count({ where: { status: 'scored', marketCap: { not: null } } });
console.log(`marketCap backfillé sur ${updated} lignes — ${filled}/${scored} titres notés ont désormais une capitalisation (le reste : prix ou nb d'actions indisponible).`);
process.exit(0);
