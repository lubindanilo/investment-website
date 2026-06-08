/**
 * Renseigne la note QUALITATIVE d'une position du registre forward (capturée live à l'instant t).
 * note_quali = business(/10) + management(/5) → /15 ; note_combinee = quanti(/10) + quali(/15) → /25.
 *
 * Usage : tsx forwardSetQual.mts 2026-06-08 ADBE:10/4 BKNG:10/5 KNSL:10/5 CRM:10/5
 *   (format ticker:BUSINESS/MANAGEMENT — business sur 10, management sur 5)
 */
import { ledgerDir, loadLedger, writeLedger } from './forwardLib.js';

function main(): void {
  const argv = process.argv.slice(2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(argv[0] ?? '')) throw new Error('1er argument = date (YYYY-MM-DD).');
  const entryDate = argv[0]!;
  const specs = argv.slice(1);
  if (!specs.length) throw new Error('Fournir au moins un ticker:business/management.');

  const dir = ledgerDir();
  const ledger = loadLedger(dir);
  for (const s of specs) {
    const [tkRaw, bm] = s.split(':');
    const [b, m] = (bm ?? '').split('/').map(Number);
    if (!tkRaw || !Number.isFinite(b) || !Number.isFinite(m)) { console.log(`⚠ spec invalide : ${s}`); continue; }
    const e = ledger.find((x) => x.ticker === tkRaw.toUpperCase() && x.entryDate === entryDate);
    if (!e) { console.log(`⚠ introuvable : ${tkRaw} @ ${entryDate}`); continue; }
    e.qualBusiness = b!; e.qualManagement = m!; e.qualNote = b! + m!; e.combinedNote = (e.score10 ?? 0) + b! + m!;
  }
  writeLedger(dir, ledger);

  console.log('ticker  quanti/10  business/10  mgmt/5  quali/15  COMBINÉ/25');
  for (const e of ledger.filter((x) => x.entryDate === entryDate)) {
    console.log(`${e.ticker.padEnd(6)} ${String(e.score10 ?? '—').padStart(6)}     ${String(e.qualBusiness ?? '—').padStart(6)}    ${String(e.qualManagement ?? '—').padStart(4)}   ${String(e.qualNote ?? '—').padStart(5)}    ${String(e.combinedNote ?? '—').padStart(6)}`);
  }
}
main();
