import type {
  LocalizedText,
  ResilienceAnalysis,
  ResilienceCriterion,
  ResilienceCriterionId,
} from '@lubin/shared';

export const PUBLISHED_RESILIENCE_VERSION = '2.8.13' as const;

// Publication is editorially explicit: generated or provisional snapshots stay hidden.
const APPROVED_TICKERS = new Set([
  'CAT', 'CEG', 'CHGG', 'CRWD', 'DOCU', 'LLY', 'MCO',
  'NEE', 'NVDA', 'NVO', 'PANW', 'SPGI', 'UBER', 'UNP',
]);

const CRITERIA: Array<{ id: ResilienceCriterionId; maxScore: 2 | 3 }> = [
  { id: 'moat', maxScore: 3 },
  { id: 'disruption_resilience', maxScore: 3 },
  { id: 'residual_dependencies', maxScore: 2 },
  { id: 'structural_demand_capture', maxScore: 2 },
  { id: 'economic_persistence', maxScore: 2 },
  { id: 'recurrence_balance', maxScore: 2 },
];

function localized(value: unknown): value is LocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<LocalizedText>;
  return ['fr', 'en', 'es'].every(lang => typeof item[lang as keyof LocalizedText] === 'string');
}

function criterion(value: unknown, expected: (typeof CRITERIA)[number]): value is ResilienceCriterion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<ResilienceCriterion>;
  if (item.id !== expected.id || item.maxScore !== expected.maxScore || item.status !== 'scored') return false;
  if (!Number.isInteger(item.score) || item.score! < 0 || item.score! > expected.maxScore) return false;
  if (!localized(item.summary) || !Array.isArray(item.evidence) || !Array.isArray(item.watchpoints)) return false;
  if (item.watchpoints.length < 1 || !item.watchpoints.every(localized)) return false;
  return !!item.audit && typeof item.audit === 'object' && !Array.isArray(item.audit);
}

export function isApprovedResilienceTicker(ticker: string): boolean {
  return APPROVED_TICKERS.has(ticker);
}

export function isPublishedResilienceAnalysis(value: unknown): value is ResilienceAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<ResilienceAnalysis>;
  if (item.version !== PUBLISHED_RESILIENCE_VERSION || item.status !== 'scored') return false;
  if (!Number.isInteger(item.rawScore) || !Number.isInteger(item.finalScore)) return false;
  if (item.finalScore! < 0 || item.finalScore! > item.rawScore! || item.rawScore! > 100) return false;
  if (!['A', 'B', 'C', 'D', 'E'].includes(item.grade ?? '')) return false;
  if (!localized(item.verdict) || !['high', 'medium', 'low'].includes(item.confidence ?? '')) return false;
  if (!Array.isArray(item.gates) || !Array.isArray(item.criteria) || item.criteria.length !== CRITERIA.length) return false;
  return CRITERIA.every((expected, index) => criterion(item.criteria![index], expected));
}
