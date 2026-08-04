import { buildScoringPrompt } from './resilienceStarsPrompt.js';
import { parseScores, aggregateTotal, type CompanyBrief, type ResilienceStarScore } from './resilienceStars.js';

/**
 * Palier DETERMINISTE : appelle l'API Anthropic (Messages) a temperature 0.
 *
 * Reserve aux cas litigieux (voir resilienceStarsResolve.ts). Necessite une cle
 * `ANTHROPIC_API_KEY` posee par l'utilisateur dans l'environnement ; le code la
 * lit mais ne la stocke ni ne l'affiche jamais.
 */
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse { content?: AnthropicTextBlock[] }

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ApiScoreOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function scoreCompaniesApi(
  companies: CompanyBrief[],
  options: ApiScoreOptions = {},
): Promise<ResilienceStarScore[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY absent : le palier API (temperature 0) exige une cle posee par l\'utilisateur.');
  }
  if (companies.length === 0) return [];

  const model = options.model ?? process.env.RESILIENCE_STARS_API_MODEL ?? 'claude-sonnet-5';
  const prompt = buildScoringPrompt(companies);

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API Anthropic ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = (data.content ?? [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('');

  const parsed = parseScores(text);
  return companies.map((company, index) => {
    const match =
      parsed.find(p => p.nom.toLowerCase() === company.name.toLowerCase()) ?? parsed[index];
    if (!match) throw new Error(`API: aucun score pour ${company.name}`);
    return {
      name: company.name,
      criteria: match.criteria,
      total: aggregateTotal(match.criteria),
      model: `${model}@t0`,
    };
  });
}
