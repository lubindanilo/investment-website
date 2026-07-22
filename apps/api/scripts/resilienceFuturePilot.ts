import '../src/env.js';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { prisma } from '../src/db/client.js';
import { callCodexJson } from '../src/services/codex.js';
import { callClaudeJson } from '../src/services/claude.js';
import { isResilienceProviderCapacityError } from '../src/services/resilienceCron.js';
import {
  buildFutureResiliencePilotPrompt,
  buildFutureMarketplaceRepairPrompt,
  buildFutureP20RepairPrompt,
  FUTURE_RESILIENCE_VERSION,
  FUTURE_SCENARIO_YEAR,
  scoreFutureResilience,
  buildFutureWorkflowRepairPrompt,
  type FutureResilienceAnalysis,
} from '../src/services/resilienceFuturePilot.js';

const args = process.argv.slice(2);
const invocationDirectory = process.env.INIT_CWD ?? process.cwd();

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function userPath(value: string): string {
  return isAbsolute(value) ? value : resolve(invocationDirectory, value);
}

const benchmarkUrl = option('--benchmark')
  ? userPath(option('--benchmark')!)
  : new URL('../benchmarks/resilience-future-pilot.json', import.meta.url);
const resultsUrl = option('--results')
  ? userPath(option('--results')!)
  : new URL('../benchmarks/resilience-future-pilot-results-v2.9.1.json', import.meta.url);

interface PilotCompany {
  ticker: string;
  company: string;
  industry: string;
  expected: { minScore: number; maxScore: number };
  status: 'provisional' | 'approved';
}

interface PilotBenchmark {
  version: string;
  scenarioYear: number;
  companies: PilotCompany[];
}

interface PilotResult {
  ticker: string;
  status: 'scored' | 'error';
  sourceVersion: string | null;
  generatedAt: string;
  provider?: 'codex' | 'claude';
  persistedAt?: string;
  adjudication?: Record<string, unknown>;
  analysis?: FutureResilienceAnalysis;
  error?: string;
}

interface SourceRow {
  ticker: string;
  version: string;
  researchDossier: string | null;
  asOf: Date | null;
}

interface PilotResultsFile {
  version: string;
  scenarioYear: number;
  generatedAt: string | null;
  results: PilotResult[];
}

async function persist(file: PilotResultsFile): Promise<void> {
  file.generatedAt = new Date().toISOString();
  await writeFile(resultsUrl, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}

async function persistAnalysisToDatabase(input: {
  company: PilotCompany;
  source: SourceRow;
  approvalStatus: PilotCompany['status'];
  result: PilotResult & {
    status: 'scored';
    adjudication: Record<string, unknown>;
    analysis: FutureResilienceAnalysis;
  };
}): Promise<string> {
  const { company, source, result, approvalStatus } = input;
  if (!source.researchDossier) throw new Error('Dossier source fige introuvable');
  const generatedAt = new Date(result.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) throw new Error('Date de generation IA invalide');
  const persistedAt = new Date();
  const researchHash = createHash('sha256').update(source.researchDossier).digest('hex');
  const approvedAt = approvalStatus === 'approved' ? persistedAt.toISOString() : null;
  const storedAnalysis = {
    ...result.analysis,
    methodology: 'future-first-2033',
    ticker: company.ticker,
    company: company.company,
    industry: company.industry,
    generatedAt: result.generatedAt,
    adjudicationProvider: result.provider ?? 'codex',
    approvalStatus,
    approvedAt,
    approvalSource: approvalStatus === 'approved' ? 'user_validated_cohort' : null,
    source: {
      version: result.sourceVersion ?? source.version,
      asOf: source.asOf?.toISOString() ?? null,
      researchHash,
    },
    adjudication: result.adjudication,
  };
  const historyMetadata = {
    kind: 'future_first_snapshot',
    generatedAt: result.generatedAt,
    persistedAt: persistedAt.toISOString(),
    sourceVersion: result.sourceVersion ?? source.version,
    sourceAsOf: source.asOf?.toISOString() ?? null,
    approvalStatus,
    approvedAt,
    approvalSource: approvalStatus === 'approved' ? 'user_validated_cohort' : null,
  };

  await prisma.$transaction([
    prisma.resilienceAnalysis.upsert({
      where: { ticker_version: { ticker: company.ticker, version: FUTURE_RESILIENCE_VERSION } },
      update: {
        status: 'scored',
        analysis: storedAnalysis as unknown as object,
        researchDossier: source.researchDossier,
        researchHash,
        asOf: generatedAt,
        attempts: { increment: 1 },
        lastError: null,
        lastAttemptAt: persistedAt,
        refreshedAt: persistedAt,
      },
      create: {
        ticker: company.ticker,
        version: FUTURE_RESILIENCE_VERSION,
        status: 'scored',
        analysis: storedAnalysis as unknown as object,
        researchDossier: source.researchDossier,
        researchHash,
        asOf: generatedAt,
        attempts: 1,
        lastAttemptAt: persistedAt,
        refreshedAt: persistedAt,
      },
    }),
    prisma.resilienceAnalysisHistory.upsert({
      where: {
        ticker_version_asOf: {
          ticker: company.ticker,
          version: FUTURE_RESILIENCE_VERSION,
          asOf: generatedAt,
        },
      },
      update: {
        analysis: storedAnalysis as unknown as object,
        researchDossier: source.researchDossier,
        researchHash,
        diff: historyMetadata as object,
      },
      create: {
        ticker: company.ticker,
        version: FUTURE_RESILIENCE_VERSION,
        asOf: generatedAt,
        analysis: storedAnalysis as unknown as object,
        researchDossier: source.researchDossier,
        researchHash,
        diff: historyMetadata as object,
      },
    }),
  ]);
  return persistedAt.toISOString();
}

async function main(): Promise<void> {
  const replay = process.argv.includes('--replay');
  const repairMarketplace = process.argv.includes('--repair-marketplace');
  const repairWorkflow = process.argv.includes('--repair-workflow');
  const repairP20 = process.argv.includes('--repair-p20');
  const criteriaOption = option('--criteria');
  const readjudicateCriteria = Boolean(criteriaOption);
  const persistDatabaseOnly = process.argv.includes('--persist-db');
  const provider = option('--provider') ?? 'codex';
  if (provider !== 'codex' && provider !== 'claude') {
    throw new Error('--provider doit valoir codex ou claude');
  }
  if ([replay, repairMarketplace, repairWorkflow, repairP20, readjudicateCriteria, persistDatabaseOnly]
      .filter(Boolean).length > 1) {
    throw new Error('--replay, --repair-marketplace, --repair-workflow, --repair-p20, --criteria et --persist-db sont mutuellement exclusifs');
  }
  if (!replay && !persistDatabaseOnly && process.env.LUBIN_RESILIENCE_ALLOW_AI !== '1') {
    throw new Error('Pilot IA bloque: definir LUBIN_RESILIENCE_ALLOW_AI=1 apres autorisation explicite');
  }
  const benchmark = JSON.parse(await readFile(benchmarkUrl, 'utf8')) as PilotBenchmark;
  const stored = JSON.parse(await readFile(resultsUrl, 'utf8')) as PilotResultsFile;
  if (benchmark.version !== FUTURE_RESILIENCE_VERSION || stored.version !== FUTURE_RESILIENCE_VERSION ||
      benchmark.scenarioYear !== FUTURE_SCENARIO_YEAR || stored.scenarioYear !== FUTURE_SCENARIO_YEAR) {
    throw new Error('Versions du pilote incoherentes');
  }
  const optionValues = new Set([
    option('--benchmark'), option('--results'), option('--provider'), option('--criteria'),
  ].filter(Boolean));
  const requested = new Set(args
    .filter(value => value !== '--' && value !== '--replay' &&
      value !== '--repair-marketplace' && value !== '--repair-workflow' &&
      value !== '--repair-p20' && value !== '--persist-db')
    .filter(value => value !== '--benchmark' && value !== '--results' && value !== '--provider' &&
      value !== '--criteria')
    .filter(value => !optionValues.has(value))
    .map(value => value.trim().toUpperCase())
    .filter(Boolean));
  const selected = benchmark.companies.filter(company => requested.size === 0 || requested.has(company.ticker));
  if (requested.size > 0 && selected.length !== requested.size) throw new Error('Ticker pilote inconnu');
  const completed = new Set(stored.results.filter(result => result.status === 'scored').map(result => result.ticker));
  const pending = replay
    ? []
    : repairMarketplace || repairWorkflow || repairP20 || readjudicateCriteria || persistDatabaseOnly
      ? selected
      : selected.filter(company => !completed.has(company.ticker));
  const sourceRows = replay ? [] : await prisma.resilienceAnalysis.findMany({
      where: {
        ticker: { in: pending.map(company => company.ticker) },
        NOT: { version: { startsWith: '2.9.1-pilot.' } },
        researchDossier: { not: null },
      },
      orderBy: [{ refreshedAt: 'desc' }, { version: 'desc' }],
      select: { ticker: true, version: true, researchDossier: true, asOf: true },
    });
  const sourceByTicker = new Map<string, typeof sourceRows[number]>();
  for (const row of sourceRows) {
    if (!sourceByTicker.has(row.ticker) && row.researchDossier?.trim()) sourceByTicker.set(row.ticker, row);
  }
  let claudeSchema: Record<string, unknown> | undefined;
  if (provider === 'claude') {
    claudeSchema = JSON.parse(
      await readFile(new URL('../../../docs/resilience/adjudication.schema.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>;
    delete claudeSchema.$schema;
    delete claudeSchema.$id;
  }
  const callAdjudicatorJson = (
    prompt: string,
    label: string,
    options: { repair?: boolean } = {},
  ) => provider === 'claude'
    ? callClaudeJson(prompt, label, {
        model: process.env.CLAUDE_RESILIENCE_MODEL ?? 'sonnet',
        effort: 'low',
        timeoutMs: 180_000,
        schema: options.repair ? undefined : claudeSchema,
      })
    : callCodexJson(prompt, label, {
        webSearch: false,
        model: process.env.CODEX_RESILIENCE_ADJUDICATION_MODEL ?? 'gpt-5.6-sol',
        reasoningEffort: 'low',
        timeoutMs: 180_000,
      });

  const allowedCriterionIds = new Set([
    'future_control', 'disruption_positioning', 'future_dependencies',
    'structural_demand', 'future_value_capture', 'transition_capacity',
  ]);
  const selectedCriterionIds = criteriaOption?.split(',').map(value => value.trim()).filter(Boolean) ?? [];
  if (readjudicateCriteria && (selectedCriterionIds.length === 0 ||
      selectedCriterionIds.some(id => !allowedCriterionIds.has(id)))) {
    throw new Error('--criteria contient un critere inconnu ou vide');
  }

  if (replay) {
    for (const company of selected) {
      const result = stored.results.find(item => item.ticker === company.ticker);
      if (result?.status === 'scored' && result.adjudication) {
        result.analysis = scoreFutureResilience(result.adjudication);
      }
    }
    await persist(stored);
  }

  for (let index = 0; index < pending.length; index += 2) {
    const chunk = pending.slice(index, index + 2);
    const settled = await Promise.allSettled(chunk.map(async company => {
      const source = sourceByTicker.get(company.ticker);
      if (!source?.researchDossier) throw new Error('Dossier source fige introuvable');
      const existing = stored.results.find(item => item.ticker === company.ticker);
      if (persistDatabaseOnly) {
        if (existing?.status !== 'scored' || !existing.adjudication || !existing.analysis) {
          throw new Error('Resultat score requis pour la persistance DB');
        }
        const persistedAt = await persistAnalysisToDatabase({
          company,
          source,
          approvalStatus: company.status,
          result: {
            ...existing,
            status: 'scored',
            adjudication: existing.adjudication,
            analysis: existing.analysis,
          },
        });
        return { ...existing, persistedAt };
      }
      let adjudication: Record<string, unknown>;
      if (readjudicateCriteria) {
        if (existing?.status !== 'scored' || !existing.adjudication) {
          throw new Error('Adjudication existante requise pour la readjudication ciblee');
        }
        const candidate = await callAdjudicatorJson(
          buildFutureResiliencePilotPrompt({
            ticker: company.ticker,
            company: company.company,
            industry: company.industry,
            dossier: source.researchDossier,
          }),
          `future targeted ${company.ticker} ${selectedCriterionIds.join(',')}`,
        );
        const candidateCriteria = candidate.criteria;
        if (!candidateCriteria || typeof candidateCriteria !== 'object' || Array.isArray(candidateCriteria)) {
          throw new Error('Criteria candidats invalides');
        }
        adjudication = structuredClone(existing.adjudication);
        const currentCriteria = adjudication.criteria;
        if (!currentCriteria || typeof currentCriteria !== 'object' || Array.isArray(currentCriteria)) {
          throw new Error('Criteria existants invalides');
        }
        for (const criterionId of selectedCriterionIds) {
          const replacement = (candidateCriteria as Record<string, unknown>)[criterionId];
          if (!replacement || typeof replacement !== 'object' || Array.isArray(replacement)) {
            throw new Error(`Critere cible absent ou invalide: ${criterionId}`);
          }
          (currentCriteria as Record<string, unknown>)[criterionId] = replacement;
        }
      } else if (repairP20) {
        if (existing?.status !== 'scored' || !existing.adjudication) {
          throw new Error('Adjudication existante requise pour la reparation p20');
        }
        const repaired = await callAdjudicatorJson(
          buildFutureP20RepairPrompt({
            ticker: company.ticker,
            company: company.company,
            industry: company.industry,
            dossier: source.researchDossier,
            currentAdjudication: existing.adjudication,
          }),
          `future p20 repair ${company.ticker}`,
          { repair: true },
        );
        adjudication = structuredClone(existing.adjudication);
        const criteria = adjudication.criteria;
        if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
          throw new Error('Criteria existants invalides');
        }
        const criteriaRecord = criteria as Record<string, unknown>;
        const futureControl = criteriaRecord.future_control;
        const dependencies = criteriaRecord.future_dependencies;
        const valueCapture = criteriaRecord.future_value_capture;
        const transition = criteriaRecord.transition_capacity;
        if (!futureControl || typeof futureControl !== 'object' || Array.isArray(futureControl) ||
            !dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies) ||
            !valueCapture || typeof valueCapture !== 'object' || Array.isArray(valueCapture) ||
            !transition || typeof transition !== 'object' || Array.isArray(transition)) {
          throw new Error('Structure des criteres p20 invalide');
        }
        const portfolio = repaired.controlPortfolio;
        const serviceOperator = repaired.serviceOperatorMechanics;
        const controlPlane = repaired.operationalControlPlaneMechanics;
        const transitionDifferentiation = repaired.transitionDifferentiation;
        const shockGroups = repaired.dependencyShockGroups;
        if (!portfolio || typeof portfolio !== 'object' || Array.isArray(portfolio) ||
            !serviceOperator || typeof serviceOperator !== 'object' || Array.isArray(serviceOperator) ||
            !controlPlane || typeof controlPlane !== 'object' || Array.isArray(controlPlane) ||
            !transitionDifferentiation || typeof transitionDifferentiation !== 'object' ||
              Array.isArray(transitionDifferentiation) || !Array.isArray(shockGroups)) {
          throw new Error('Reparation p20 incomplete');
        }
        const dependencyRecord = dependencies as Record<string, unknown>;
        const clusters = dependencyRecord.clusters;
        if (!Array.isArray(clusters)) throw new Error('Clusters de dependance existants invalides');
        const groupByName = new Map<string, string>();
        for (const value of shockGroups) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('Mapping shockGroup invalide');
          }
          const mapping = value as Record<string, unknown>;
          if (typeof mapping.name !== 'string' || typeof mapping.shockGroup !== 'string' ||
              !mapping.name.trim() || !mapping.shockGroup.trim() || groupByName.has(mapping.name)) {
            throw new Error('Mapping shockGroup incomplet ou duplique');
          }
          groupByName.set(mapping.name, mapping.shockGroup);
        }
        const existingNames = clusters.map(value => {
          if (!value || typeof value !== 'object' || Array.isArray(value) ||
              typeof (value as Record<string, unknown>).name !== 'string') {
            throw new Error('Cluster de dependance existant invalide');
          }
          return (value as Record<string, unknown>).name as string;
        });
        if (groupByName.size !== existingNames.length ||
            existingNames.some(name => !groupByName.has(name))) {
          throw new Error('Le mapping shockGroup doit couvrir exactement les clusters existants');
        }
        (futureControl as Record<string, unknown>).controlPortfolio = portfolio;
        dependencyRecord.futureShockGroupContract = true;
        dependencyRecord.clusters = clusters.map((value, clusterIndex) => ({
          ...(value as Record<string, unknown>),
          shockGroup: groupByName.get(existingNames[clusterIndex]!)!,
        }));
        (valueCapture as Record<string, unknown>).serviceOperatorMechanics = serviceOperator;
        (valueCapture as Record<string, unknown>).operationalControlPlaneMechanics = controlPlane;
        Object.assign(transition as Record<string, unknown>, transitionDifferentiation, {
          futureDifferentiatedAdaptationContract: true,
        });
      } else if (repairMarketplace || repairWorkflow) {
        if (existing?.status !== 'scored' || !existing.adjudication) {
          throw new Error('Adjudication existante requise pour la reparation structurelle');
        }
        const repairPrompt = repairWorkflow
          ? buildFutureWorkflowRepairPrompt({
              ticker: company.ticker,
              company: company.company,
              industry: company.industry,
              dossier: source.researchDossier,
              currentAdjudication: existing.adjudication,
            })
          : buildFutureMarketplaceRepairPrompt({
            ticker: company.ticker,
            company: company.company,
            industry: company.industry,
            dossier: source.researchDossier,
            currentAdjudication: existing.adjudication,
          });
        const repairedChecklist = await callAdjudicatorJson(
          repairPrompt,
          `future ${repairWorkflow ? 'workflow' : 'marketplace'} repair ${company.ticker}`,
          { repair: true },
        );
        adjudication = structuredClone(existing.adjudication);
        const criteria = adjudication.criteria;
        if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
          throw new Error('Criteria existants invalides');
        }
        const valueCapture = (criteria as Record<string, unknown>).future_value_capture;
        if (!valueCapture || typeof valueCapture !== 'object' || Array.isArray(valueCapture)) {
          throw new Error('future_value_capture existant invalide');
        }
        (valueCapture as Record<string, unknown>)[repairWorkflow
          ? 'workflowReplacement'
          : 'marketplaceMechanics'] = repairedChecklist;
      } else {
        adjudication = await callAdjudicatorJson(
          buildFutureResiliencePilotPrompt({
            ticker: company.ticker,
            company: company.company,
            industry: company.industry,
            dossier: source.researchDossier,
          }),
          `future pilot ${company.ticker}`,
        );
      }
      const scoredResult = {
        ticker: company.ticker,
        status: 'scored' as const,
        sourceVersion: existing?.sourceVersion ?? source.version,
        generatedAt: new Date().toISOString(),
        provider,
        adjudication,
        analysis: scoreFutureResilience(adjudication),
      };
      const persistedAt = await persistAnalysisToDatabase({
        company,
        source,
        approvalStatus: 'provisional',
        result: scoredResult,
      });
      return { ...scoredResult, persistedAt };
    }));
    const capacityFailure = settled.find(result =>
      result.status === 'rejected' && isResilienceProviderCapacityError(result.reason));
    if (capacityFailure?.status === 'rejected') throw capacityFailure.reason;
    for (let offset = 0; offset < settled.length; offset++) {
      const company = chunk[offset]!;
      const result = settled[offset]!;
      const next: PilotResult = result.status === 'fulfilled'
        ? result.value
        : {
            ticker: company.ticker,
            status: 'error',
            sourceVersion: sourceByTicker.get(company.ticker)?.version ?? null,
            generatedAt: new Date().toISOString(),
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          };
      const existingIndex = stored.results.findIndex(item => item.ticker === company.ticker);
      if (existingIndex >= 0) stored.results[existingIndex] = next;
      else stored.results.push(next);
    }
    await persist(stored);
  }

  const expectationByTicker = new Map(benchmark.companies.map(company => [company.ticker, company.expected]));
  const rows = selected.map(company => {
    const result = stored.results.find(item => item.ticker === company.ticker);
    const expected = expectationByTicker.get(company.ticker)!;
    const score = result?.analysis?.finalScore ?? null;
    return {
      ticker: company.ticker,
      status: result?.status ?? 'missing',
      score,
      grade: result?.analysis?.grade ?? null,
      vector: result?.analysis?.criteria.map(criterion => criterion.score) ?? null,
      gates: result?.analysis?.gates ?? [],
      expected: [expected.minScore, expected.maxScore],
      acceptance: score != null && score >= expected.minScore && score <= expected.maxScore
        ? 'pass'
        : result?.status === 'error' ? 'error' : 'mismatch',
      error: result?.error,
    };
  });
  console.log(JSON.stringify({
    version: FUTURE_RESILIENCE_VERSION,
    scenarioYear: FUTURE_SCENARIO_YEAR,
    newlyScored: persistDatabaseOnly ? 0 : pending.length,
    persisted: rows.filter(row => {
      const result = stored.results.find(item => item.ticker === row.ticker);
      return result?.status === 'scored' && Boolean(result.persistedAt);
    }).length,
    summary: {
      pass: rows.filter(row => row.acceptance === 'pass').length,
      mismatch: rows.filter(row => row.acceptance === 'mismatch').length,
      error: rows.filter(row => row.acceptance === 'error').length,
    },
    rows,
  }, null, 2));
}

void main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
