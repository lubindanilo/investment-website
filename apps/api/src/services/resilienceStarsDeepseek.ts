import { buildScoringPrompt } from './resilienceStarsPrompt.js';
import { parseScores, aggregateTotal, type CompanyBrief, type ResilienceStarScore } from './resilienceStars.js';

/**
 * Adaptateur DeepSeek (API OpenAI-compatible), a temperature 0.
 *
 * Candidat "palier deterministe pas cher" : ~10-15x moins cher que Sonnet.
 * Qualite a VALIDER via le test de controle avant d'en faire le scoreur.
 * Cle `DEEPSEEK_API_KEY` posee par l'utilisateur dans l'env / apps/api/.env.
 *
 * Modeles : `deepseek-chat` (V3) et `deepseek-reasoner` (R1).
 * On scoure par petits lots : la sortie DeepSeek est plafonnee (~8k tokens),
 * un lot de 20 avec justifications la depasserait.
 */
const DEFAULT_BASE_URL = 'https://api.deepseek.com';

interface OpenAiChatResponse {
  choices?: { message?: { content?: string; reasoning_content?: string }; finish_reason?: string }[];
}

export function hasDeepseekKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export interface DeepseekOptions {
  /** 'deepseek-chat' (V3) ou 'deepseek-reasoner' (R1). */
  model?: string;
  /** Taille des lots (sortie plafonnee cote DeepSeek). Defaut 6. */
  chunkSize?: number;
  /**
   * Plafond de tokens de sortie. R1 (reasoner) consomme enormement de tokens
   * de raisonnement AVANT la reponse : il faut un plafond eleve et de petits
   * lots, sinon le raisonnement epuise le budget et le contenu revient vide.
   */
  maxTokens?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

async function callDeepseek(prompt: string, model: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY absent : pose la cle dans apps/api/.env.');
  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as OpenAiChatResponse;
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? '';
  if (!text) {
    const reason = choice?.finish_reason ?? 'inconnue';
    throw new Error(`DeepSeek(${model}): contenu vide (finish_reason=${reason}). Augmente maxTokens ou reduis chunkSize.`);
  }
  return text;
}

export async function scoreCompaniesDeepseek(
  companies: CompanyBrief[],
  options: DeepseekOptions = {},
): Promise<ResilienceStarScore[]> {
  if (companies.length === 0) return [];
  const model = options.model ?? 'deepseek-chat';
  const chunkSize = Math.max(1, options.chunkSize ?? 6);
  const maxTokens = options.maxTokens ?? 8000;

  const results: ResilienceStarScore[] = [];
  for (const group of chunk(companies, chunkSize)) {
    const text = await callDeepseek(buildScoringPrompt(group), model, maxTokens);
    const parsed = parseScores(text);
    for (const company of group) {
      const match = parsed.find(p => p.nom.toLowerCase() === company.name.toLowerCase());
      if (!match) throw new Error(`DeepSeek(${model}): aucun score pour ${company.name}`);
      results.push({
        name: company.name,
        criteria: match.criteria,
        total: aggregateTotal(match.criteria),
        model,
      });
    }
  }
  return results;
}
