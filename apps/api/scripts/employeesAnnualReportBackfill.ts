/**
 * employeesAnnualReportBackfill — backfill ONE-SHOT de l'historique d'effectifs depuis les
 * rapports annuels (documents d'enregistrement universel / documents de référence).
 *
 * POUR QUI : les sociétés EU SANS cotation NYSE/NASDAQ (Hermès, LVMH, L'Oréal…), pour
 * lesquelles stockanalysis plafonne l'effectif à 5 exercices gratuits. Les dual-listed sont
 * déjà servies par la cotation US (cf. employeesStore.fetchDeepViaUsListing) : ce script ne
 * vise que le reliquat. Le FUTUR est couvert par l'accumulation stockanalysis (+1 exercice/an),
 * ce backfill n'a donc besoin de tourner qu'UNE fois par société.
 *
 * SOURCE (France) : le flux AMF du portail OAM info-financiere.gouv.fr (Opendatasoft),
 * dataset `flux-amf-new-prod`, profondeur vérifiée jusqu'à 2007. Chaque dépôt expose une
 * `url_de_recuperation` publique (zip ou pdf). Hors France : passer les URLs à la main via
 * --manifest (JSON [{year, url}]).
 *
 * CHAÎNE : dépôts AMF → download → unzip → pdftotext -layout → fenêtres de texte autour de
 * « effectif » → LLM (extraction JSON stricte de l'effectif GROUPE par exercice) → validation
 * par CHEVAUCHEMENT avec les points stockanalysis déjà en base (médiane des ratios ± 15 %,
 * même philosophie qu'extendWithDeepRevenue : un désaccord de périmètre — société mère vs
 * groupe — écarte tout le lot) → écriture append-only (--apply), uniquement les exercices
 * ANTÉRIEURS à ce que le store connaît.
 *
 * Usage :
 *   pnpm exec tsx scripts/employeesAnnualReportBackfill.ts --ticker=RMS.PA            # dry-run
 *   pnpm exec tsx scripts/employeesAnnualReportBackfill.ts --ticker=RMS.PA --apply    # écrit
 *   pnpm exec tsx scripts/employeesAnnualReportBackfill.ts --ticker=XX.YY --manifest=./urls.json --apply
 *
 * Prérequis locaux : `pdftotext` (poppler), `unzip` et le CLI `claude` dans le PATH,
 * DATABASE_URL dans l'environnement.
 *
 * EXTRACTION : par défaut via `claude -p` (headless) — donc sur l'ABONNEMENT Claude de la
 * machine, AUCUNE clé API (même mécanique que l'automate SEO du second-brain). Modèle :
 * EMPLOYEES_BACKFILL_CLAUDE_MODEL (défaut haiku — l'extraction se fait sur des fenêtres
 * courtes et chiffrées, pas besoin de plus). --llm=openai bascule sur l'API OpenAI
 * (OPENAI_API_KEY + EMPLOYEES_BACKFILL_MODEL) si un jour une clé créditée existe.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSeries, appendMergePersist } from '../src/services/fundamentalsStore.js';
import { resolveYahooTicker } from '../src/services/yahooResolve.js';
import { normalizeCompanyTokens, companyNamesMatch } from '../src/services/usListingResolve.js';
import type { TimeseriesPoint } from '@lubin/shared';

const ODS_BASE = 'https://info-financiere.gouv.fr/api/explore/v2.1/catalog/datasets/flux-amf-new-prod/records';
const OPENAI_MODEL = process.env.EMPLOYEES_BACKFILL_MODEL ?? 'gpt-4o-mini';
const CLAUDE_MODEL = process.env.EMPLOYEES_BACKFILL_CLAUDE_MODEL ?? 'haiku';
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? '';
/** Tolérance sur la médiane des ratios rapport/store sur les exercices communs. */
const OVERLAP_TOLERANCE = 0.15;
/** Sous ce plancher d'effectif, même garde-fou que le calcul du ratio (EMPLOYEE_MIN). */
const EMPLOYEE_FLOOR = 20;

interface ManifestEntry { year: number; url: string; title?: string }
interface ExtractedRow { fiscalYear: number; closingDate?: string; employees: number }

const args = new Map(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return i < 0 ? [a, 'true'] as const : [a.slice(0, i), a.slice(i + 1)] as const;
}));
const TICKER = args.get('--ticker')?.toUpperCase() ?? '';
const APPLY = args.get('--apply') === 'true';
const MANIFEST_PATH = args.get('--manifest') ?? null;
const FROM_YEAR = Number(args.get('--from') ?? 2005);
/** --dump=dir : écrit les fenêtres de texte sur disque au lieu d'appeler le LLM (extraction hors API). */
const DUMP_DIR = args.get('--dump') ?? null;
/** --rows=file.json : saute manifest+extraction, charge des lignes [{fiscalYear, employees}] déjà extraites. */
const ROWS_PATH = args.get('--rows') ?? null;
/** Backend d'extraction : 'claude' (CLI headless, abonnement — défaut) ou 'openai' (clé API). */
const LLM = args.get('--llm') ?? 'claude';

if (!TICKER) { console.error('usage: --ticker=RMS.PA [--apply] [--manifest=urls.json] [--from=2005] [--llm=claude|openai] [--dump=dir] [--rows=rows.json]'); process.exit(1); }
if (LLM === 'openai' && !OPENAI_KEY && !DUMP_DIR && !ROWS_PATH) { console.error('OPENAI_API_KEY manquant (ou utiliser --llm=claude / --dump / --rows)'); process.exit(1); }

const log = (...a: unknown[]) => console.log(`[backfill ${TICKER}]`, ...a);

// ─── 1. Manifest : liste {year, url} des rapports annuels ────────────────────

/** Titres de dépôts AMF qui portent le rapport annuel complet (pas le communiqué de mise à dispo). */
const isAnnualReportTitle = (t: string): boolean =>
  /(enregistrement universel|document de r[ée]f[ée]rence|rapport annuel)/i.test(t)
  && !/(modalit|mise [àa] disposition|disponibilit|actualisation|rectificatif)/i.test(t);

async function buildManifestFromAmf(companyName: string): Promise<ManifestEntry[]> {
  // Le nom déposé à l'AMF est souvent COURT (« LVMH », « HERMES INTERNATIONAL ») là où Yahoo
  // porte la raison sociale complète : on interroge sur les 2 premiers tokens d'identité
  // (search() d'ODS est un AND — le nom complet ne matcherait jamais « LVMH »), puis on
  // re-vérifie chaque dépôt : correspondance pleine (Jaccard, cf. usListingResolve) OU nom
  // AMF sous-ensemble du nom attendu ANCRÉ sur le premier token (« lvmh » ⊆ « lvmh moet
  // hennessy louis vuitton »). Le filtre de TITRE est appliqué côté serveur pour ne pas
  // noyer les rapports annuels sous les communiqués (Hermès : 1 222 dépôts).
  const expectedTokens = normalizeCompanyTokens(companyName);
  interface AmfRecord { identificationsociete_iso_nom_soc: string; informationdeposee_inf_tit_inf: string; informationdeposee_inf_dat_emt: string; url_de_recuperation: string | null }
  const runQuery = async (q: string): Promise<AmfRecord[]> => {
    const where = `search(identificationsociete_iso_nom_soc,"${q.replace(/"/g, '')}")`
      + ` and (search(informationdeposee_inf_tit_inf,"enregistrement universel")`
      + ` or search(informationdeposee_inf_tit_inf,"document de reference")`
      + ` or search(informationdeposee_inf_tit_inf,"rapport annuel"))`;
    const url = `${ODS_BASE}?where=${encodeURIComponent(where)}&select=identificationsociete_iso_nom_soc,informationdeposee_inf_tit_inf,informationdeposee_inf_dat_emt,url_de_recuperation&order_by=informationdeposee_inf_dat_emt%20asc&limit=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AMF ODS HTTP ${res.status}`);
    return ((await res.json()) as { results: AmfRecord[] }).results;
  };
  // Deux requêtes fusionnées : la PRÉCISE (2 tokens) et la LARGE (1er token) — le search()
  // d'ODS est un AND, or l'AMF enregistre souvent un nom COURT (« LVMH ») que la requête
  // précise ne retournerait jamais. Le bruit de la large est éliminé par l'acceptation.
  const queries = [...new Set([expectedTokens.slice(0, 2).join(' '), expectedTokens[0] ?? ''])].filter(Boolean);
  const merged: AmfRecord[] = [];
  const seenRecordUrls = new Set<string>();
  for (const q of queries) {
    for (const r of await runQuery(q)) {
      const k = r.url_de_recuperation ?? `${r.informationdeposee_inf_dat_emt}|${r.informationdeposee_inf_tit_inf}`;
      if (seenRecordUrls.has(k)) continue;
      seenRecordUrls.add(k);
      merged.push(r);
    }
  }
  merged.sort((a, b) => a.informationdeposee_inf_dat_emt.localeCompare(b.informationdeposee_inf_dat_emt));
  const data = { results: merged };
  const out: ManifestEntry[] = [];
  const perYear = new Map<number, number>();
  const seenUrls = new Set<string>();
  const amfNameAcceptable = (amfName: string): boolean => {
    if (companyNamesMatch(amfName, companyName)) return true;
    const amfTokens = normalizeCompanyTokens(amfName);
    return amfTokens.length > 0
      && amfTokens[0] === expectedTokens[0]
      && amfTokens.every(t => expectedTokens.includes(t));
  };
  for (const r of data.results) {
    const title = r.informationdeposee_inf_tit_inf ?? '';
    if (!amfNameAcceptable(r.identificationsociete_iso_nom_soc ?? '')) continue;
    if (!isAnnualReportTitle(title) || !r.url_de_recuperation) continue;
    if (seenUrls.has(r.url_de_recuperation)) continue;
    seenUrls.add(r.url_de_recuperation);
    // Exercice couvert : l'année dans le titre (« … universel 2024 ») ; sinon année de dépôt − 1.
    const m = title.match(/\b(19|20)\d{2}\b/);
    const filedYear = Number(r.informationdeposee_inf_dat_emt.slice(0, 4));
    const year = m ? Number(m[0]) : filedYear - 1;
    if (year < FROM_YEAR) continue;
    // Jusqu'à 2 documents par exercice (Tome 1 + Tome 2 des anciens documents de référence) —
    // le recoupement inter-rapports en aval absorbe les doublons de valeurs.
    const n = perYear.get(year) ?? 0;
    if (n >= 2) continue;
    perYear.set(year, n + 1);
    out.push({ year, url: r.url_de_recuperation, title });
  }
  return out.sort((a, b) => a.year - b.year);
}

// ─── 2. Download + extraction du texte autour de « effectif » ────────────────

function download(url: string, dir: string): string {
  const file = path.join(dir, path.basename(new URL(url).pathname));
  execFileSync('curl', ['-sL', '--fail', '-o', file, '--max-time', '180', url]);
  return file;
}

/**
 * Texte intégral d'un dépôt, quel que soit son emballage :
 *   - PDF (documents de référence historiques) → pdftotext -layout ;
 *   - paquet ESEF (zip contenant le rapport en XHTML, format réglementaire depuis 2021)
 *     → balises retirées, entités décodées ;
 *   - zip de PDF → le plus gros PDF.
 */
function documentText(file: string, dir: string): string | null {
  let doc = file;
  if (/\.zip$/i.test(file)) {
    const outDir = fs.mkdtempSync(path.join(dir, 'zip-'));
    try { execFileSync('unzip', ['-o', '-q', file, '-d', outDir]); } catch { return null; }
    const inner = fs.readdirSync(outDir, { recursive: true })
      .map(String)
      .filter(f => /\.(pdf|xhtml|html|xbri)$/i.test(f))
      .map(f => path.join(outDir, f))
      .filter(f => fs.statSync(f).isFile());
    if (inner.length === 0) return null;
    doc = inner.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0]!;
  }
  if (/\.pdf$/i.test(doc)) {
    return execFileSync('pdftotext', ['-layout', '-q', doc, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
  }
  // .xbri : document XBRL inline servi NU par l'AMF (HTML brut, vérifié sur LVMH 2025).
  if (/\.(xhtml|html|xbri)$/i.test(doc)) {
    return fs.readFileSync(doc, 'utf8')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|tr|td|th|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
      .replace(/[ \t]+/g, ' ');
  }
  return null;
}

/** Fenêtres de texte (±25 lignes) autour des occurrences d'« effectif » — capées à 45 000 caractères. */
function employeeWindows(txt: string): string {
  const lines = txt.split('\n');
  const keep = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (/effectif|collaborateurs/i.test(lines[i]!)) {
      for (let j = Math.max(0, i - 25); j <= Math.min(lines.length - 1, i + 25); j++) keep.add(j);
    }
  }
  const idx = [...keep].sort((a, b) => a - b);
  let out = '';
  let prev = -2;
  for (const i of idx) {
    if (i !== prev + 1) out += '\n[…]\n';
    out += lines[i] + '\n';
    prev = i;
    if (out.length > 45_000) break;
  }
  return out;
}

// ─── 3. Extraction LLM (JSON strict) ─────────────────────────────────────────

/** Filtrage commun des lignes extraites, quel que soit le backend. */
function sanitizeRows(rows: ExtractedRow[] | undefined, year: number): ExtractedRow[] {
  return (rows ?? []).filter(r =>
    Number.isInteger(r.fiscalYear) && r.fiscalYear >= 1990 && r.fiscalYear <= year
    && Number.isFinite(r.employees) && r.employees >= EMPLOYEE_FLOOR);
}

function extractionPrompt(companyName: string, year: number, windows: string): string {
  return `Voici des extraits du rapport annuel ${year} de ${companyName} (document d'enregistrement universel ou document de référence).
Extrais l'EFFECTIF TOTAL DU GROUPE (consolidé, toutes sociétés du groupe, monde entier) par exercice.
Règles strictes :
- uniquement les exercices dont l'effectif TOTAL GROUPE est explicitement chiffré dans les extraits ;
- JAMAIS l'effectif de la seule société mère, d'un segment, d'un pays, ni un effectif moyen partiel ;
- si un tableau donne plusieurs exercices (N et N-1), rends-les tous ;
- nombre entier de personnes (pas de milliers arrondis en "k").
Réponds UNIQUEMENT ce JSON : {"rows":[{"fiscalYear":${year},"closingDate":"${year}-12-31","employees":12345}]}
(closingDate = date de clôture de l'exercice si mentionnée, sinon 31/12 de l'exercice). Si rien d'exploitable : {"rows":[]}.

EXTRAITS :
${windows}`;
}

/**
 * Extraction via le CLI `claude -p` (headless) : tourne sur l'ABONNEMENT Claude connecté sur
 * la machine, aucune clé API. L'enveloppe --output-format json porte la réponse dans
 * `result` ; on tolère des clôtures markdown autour du JSON.
 */
function extractWithClaudeCli(companyName: string, year: number, windows: string): ExtractedRow[] {
  const raw = execFileSync('claude', ['-p', '--output-format', 'json', '--model', CLAUDE_MODEL], {
    input: extractionPrompt(companyName, year, windows),
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240_000,
  }).toString('utf8');
  const envelope = JSON.parse(raw) as { is_error?: boolean; result?: string };
  if (envelope.is_error || typeof envelope.result !== 'string') throw new Error('claude -p : réponse en erreur');
  const jsonText = envelope.result.replace(/^[\s\S]*?\{/, '{').replace(/\}[^}]*$/, '}');
  const parsed = JSON.parse(jsonText) as { rows?: ExtractedRow[] };
  return sanitizeRows(parsed.rows, year);
}

/** Extraction via l'API OpenAI (nécessite une clé créditée) — conservée en option --llm=openai. */
async function extractWithOpenAi(companyName: string, year: number, windows: string): Promise<ExtractedRow[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: extractionPrompt(companyName, year, windows) }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0]!.message.content) as { rows?: ExtractedRow[] };
  return sanitizeRows(parsed.rows, year);
}

async function extractWithLlm(companyName: string, year: number, windows: string): Promise<ExtractedRow[]> {
  return LLM === 'openai'
    ? extractWithOpenAi(companyName, year, windows)
    : extractWithClaudeCli(companyName, year, windows);
}

// ─── 4. Consolidation + validation + écriture ────────────────────────────────

(async () => {
  const resolved = await resolveYahooTicker(TICKER).catch(() => null);
  const companyName = resolved?.longName ?? null;
  if (!companyName) { console.error('Nom de société irrésoluble (Yahoo) — vérifier le ticker'); process.exit(1); }
  log('société :', companyName);

  let manifest: ManifestEntry[];
  if (MANIFEST_PATH) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[];
  } else {
    manifest = await buildManifestFromAmf(companyName);
  }
  log(`${manifest.length} rapports annuels (${manifest[0]?.year ?? '—'} → ${manifest[manifest.length - 1]?.year ?? '—'})`);
  if (manifest.length === 0) process.exit(0);

  const stored = await readSeries(TICKER, 'employees');
  const storeByYear = new Map((stored?.points ?? []).map(p => [Number(p.date.slice(0, 4)), p.value]));
  log(`store : ${stored?.points.length ?? 0} points (source ${stored?.source ?? '—'})`);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `employees-${TICKER.replace(/\W/g, '_')}-`));
  // Un même exercice apparaît dans 2 rapports consécutifs (N et N-1) → recoupement interne.
  const byYear = new Map<number, number[]>();
  if (ROWS_PATH) {
    // Lignes déjà extraites (par un opérateur ou un LLM hors API) — mêmes garde-fous en aval.
    const rows = JSON.parse(fs.readFileSync(ROWS_PATH, 'utf8')) as ExtractedRow[];
    for (const r of rows) {
      if (!Number.isInteger(r.fiscalYear) || !Number.isFinite(r.employees) || r.employees < EMPLOYEE_FLOOR) continue;
      byYear.set(r.fiscalYear, [...(byYear.get(r.fiscalYear) ?? []), r.employees]);
    }
    log(`${byYear.size} exercices lus depuis ${ROWS_PATH}`);
  } else {
    let dumpIdx = 0;
    for (const entry of manifest) {
      try {
        const file = download(entry.url, workDir);
        const txt = documentText(file, workDir);
        if (!txt) { log(`  ${entry.year} : pas de document exploitable (${path.basename(entry.url)})`); continue; }
        const windows = employeeWindows(txt);
        if (windows.length < 100) { log(`  ${entry.year} : aucune fenêtre « effectif »`); continue; }
        if (DUMP_DIR) {
          fs.mkdirSync(DUMP_DIR, { recursive: true });
          const f = path.join(DUMP_DIR, `${TICKER.replace(/\W/g, '_')}-${entry.year}-${dumpIdx++}.txt`);
          fs.writeFileSync(f, windows);
          log(`  ${entry.year} : fenêtres → ${f}`);
          continue;
        }
        const rows = await extractWithLlm(companyName, entry.year, windows);
        for (const r of rows) byYear.set(r.fiscalYear, [...(byYear.get(r.fiscalYear) ?? []), r.employees]);
        log(`  ${entry.year} : ${rows.map(r => `${r.fiscalYear}=${r.employees}`).join(', ') || 'rien'}`);
      } catch (e) {
        log(`  ${entry.year} : échec — ${(e as Error).message}`);
      }
    }
    if (DUMP_DIR) { log('dump terminé — extraire puis relancer avec --rows'); process.exit(0); }
  }

  // Consolidation : un exercice vu 2 fois avec des valeurs incompatibles (> 2 %) est écarté
  // (recoupement interne N/N-1) ; sinon on garde la valeur du rapport le plus récent.
  const candidates: TimeseriesPoint[] = [];
  for (const [year, vals] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const [a, b] = [Math.min(...vals), Math.max(...vals)];
    if (vals.length > 1 && (b - a) / b > 0.02) { log(`  exercice ${year} écarté : valeurs incohérentes entre rapports (${vals.join(' vs ')})`); continue; }
    candidates.push({ date: `${year}-12-31`, value: vals[vals.length - 1]! });
  }

  // Validation de PÉRIMÈTRE contre stockanalysis (S&P GMI) sur les exercices communs.
  const overlap = candidates.filter(c => storeByYear.has(Number(c.date.slice(0, 4))));
  if (storeByYear.size > 0 && overlap.length === 0) {
    log('⚠ aucun exercice commun avec le store — périmètre invérifiable, on n\'écrit rien');
    process.exit(1);
  }
  if (overlap.length > 0) {
    const ratios = overlap.map(c => c.value / storeByYear.get(Number(c.date.slice(0, 4)))!).sort((x, y) => x - y);
    const median = ratios[Math.floor(ratios.length / 2)]!;
    log(`chevauchement : ${overlap.length} exercices, médiane rapport/store = ${median.toFixed(3)}`);
    if (Math.abs(median - 1) > OVERLAP_TOLERANCE) {
      log('⚠ désaccord de périmètre (société mère vs groupe ?) — on n\'écrit rien');
      process.exit(1);
    }
  }

  // Extension vers le passé uniquement : jamais d'écrasement d'un point stockanalysis.
  const toWrite = candidates.filter(c => !storeByYear.has(Number(c.date.slice(0, 4))));
  console.log('\n─── Résultat ───');
  for (const p of toWrite) console.log(`  + ${p.date}  ${p.value.toLocaleString('fr-FR')}`);
  console.log(`${toWrite.length} exercices à ajouter (${candidates.length - toWrite.length} déjà en base, validés)`);

  if (!APPLY) { console.log('\nDry-run — relancer avec --apply pour écrire.'); process.exit(0); }
  if (toWrite.length === 0) process.exit(0);
  // Suffixe de source : conserve le marqueur « cotation US déjà cherchée » d'employeesStore.
  const source = stored?.source?.startsWith('stockanalysis-deep')
    ? 'stockanalysis-deep+annual-report'
    : 'annual-report';
  const merged = await appendMergePersist(TICKER, 'employees', stored, toWrite, source, Date.now(), {
    freq: 'annual',
    cadence: { cadenceDays: 400, floorDays: 30 },
    persistEmpty: false,
  });
  console.log(`✅ écrit — la série fait maintenant ${merged.length} points (${merged[0]?.date} → ${merged[merged.length - 1]?.date})`);
  process.exit(0);
})();
