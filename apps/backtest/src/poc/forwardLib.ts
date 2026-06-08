/** Registre forward partagé : type + I/O (JSON immuable versionné git + CSV lisible). */
import fs from 'node:fs';
import path from 'node:path';

export interface ForwardEntry {
  entryDate: string; ticker: string; priceDate: string | null; entryClose: number | null; entryAdjClose: number | null;
  score10: number | null; pfcfTTM: number | null; pfcfCurrent: number | null; pfcfPercentile: number | null; opportunity: boolean | null;
  marketCapM: number | null; bucket: string;
  /** Qualitatif (capturé live à l'instant t) : business model /10, management /5. */
  qualBusiness: number | null; qualManagement: number | null;
  qualNote: number | null;       // business + management → /15
  combinedNote: number | null;   // quanti /10 + quali /15 → /25
  thesis: string | null;
}

export function bucketOf(mcM: number | null): string {
  if (mcM == null) return '?';
  if (mcM < 300) return 'micro';
  if (mcM < 2000) return 'small';
  if (mcM < 10000) return 'mid';
  return 'large';
}

export function ledgerDir(): string { return path.join(process.cwd(), 'forward'); }

export function loadLedger(dir: string): ForwardEntry[] {
  const p = path.join(dir, 'ledger.json');
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as ForwardEntry[]) : [];
}

export function writeLedger(dir: string, ledger: ForwardEntry[]): void {
  fs.mkdirSync(dir, { recursive: true });
  ledger.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.ticker.localeCompare(b.ticker));
  fs.writeFileSync(path.join(dir, 'ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
  const cols = ['date_entree', 'ticker', 'date_prix', 'prix_entree', 'note_quanti', 'pfcf_ttm', 'pfcf_courant', 'percentile', 'opportunite', 'cap_M', 'bucket', 'quali_business_10', 'quali_management_5', 'quali_total_15', 'note_combinee_25'];
  const rows = [cols.join(',')];
  for (const e of ledger) rows.push([e.entryDate, e.ticker, e.priceDate ?? '', e.entryClose?.toFixed(2) ?? '', e.score10 ?? '', e.pfcfTTM?.toFixed(1) ?? '', e.pfcfCurrent?.toFixed(1) ?? '', e.pfcfPercentile?.toFixed(0) ?? '', e.opportunity ? 'oui' : 'non', e.marketCapM?.toFixed(0) ?? '', e.bucket, e.qualBusiness ?? '', e.qualManagement ?? '', e.qualNote ?? '', e.combinedNote ?? ''].join(','));
  fs.writeFileSync(path.join(dir, 'ledger.csv'), rows.join('\n') + '\n');
}
