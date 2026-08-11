import { missingAccentWords, repairAccents, sameLetters } from '../lib/frenchAccents.js';
import { runClaudeJson } from './resilienceStarsCli.js';
import { CRITERION_KEYS, type CriterionKey, type CriterionScore } from './resilienceStars.js';

/**
 * Rattrapage des accents sur des justifications DEJA ecrites.
 *
 * Deux passes, dans cet ordre :
 *   1. `repairAccents` (table apprise sur le blog) : gratuite, deterministe, testee. Elle
 *      traite la grande majorite du texte.
 *   2. Haiku, sur toutes les phrases : pour le vocabulaire qu'aucune table n'a vu passer
 *      (« electrification », « concedant ») et pour ce que rien de deterministe ne peut trancher
 *      (« developpe » = « développe » ou « développé » ? « a » = verbe ou preposition ?).
 *      Aucune table ne le saura jamais, une lecture de la phrase, si.
 *
 * MODELE. Haiku, le moins gourmand, via le binaire `claude` : on paie l'ABONNEMENT de Lubin,
 * pas de jetons a l'usage (meme raison que resilienceStarsCli.ts, aucune cle API requise).
 *
 * CE QUI REND LA PASSE LLM SANS RISQUE. Une note de resilience est un jugement editorial : hors
 * de question qu'un modele de reformulation la reecrive au passage. Chaque phrase renvoyee est
 * donc comparee a l'originale par `sameLetters` : meme suite de lettres, aux accents pres. Une
 * phrase reformulee, resumee, traduite ou tronquee est REJETEE et l'originale conservee. Le pire
 * cas de cette passe n'est pas un contresens, c'est un accent manquant de plus.
 */
export const REACCENT_MODEL = 'claude-haiku-4-5-20251001';

/** Au-dela, la reponse JSON du modele devient longue et le risque de troncature monte. */
const DEFAULT_BATCH = 20;

/**
 * Densite d'accents en dessous de laquelle une phrase francaise est certainement fautive.
 * Mesure sur les 4 747 phrases longues du blog : le 10e centile est a 0,0104 accent par lettre.
 */
const MIN_ACCENT_RATIO = 0.01;

/**
 * Vrai si la phrase est CERTAINEMENT mal accentuee : un mot que la table sait accentue ne l'est
 * pas, ou la densite d'accents est sous le plancher du francais.
 *
 * CE QUE CETTE FONCTION NE SAIT PAS FAIRE, ET POURQUOI ELLE NE FILTRE PLUS LA PASSE LLM. Elle a
 * d'abord servi a n'envoyer au modele que les phrases suspectes. Mesure faite sur les vraies
 * cartes Vinci : APRES la passe deterministe, elle les declare toutes saines alors qu'il y reste
 * « electrification », « concedant », « concedes » et « a l'echelle ». C'est logique : reconnaitre
 * un mot qu'aucune table ne connait demande un dictionnaire du francais entier, qu'on n'a pas.
 * Elle ne sert donc plus qu'a REPORTER, jamais a decider de sauter une phrase.
 */
export function needsReaccent(text: string): boolean {
  if (missingAccentWords(text).length > 0) return true;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters === 0) return false;
  const accents = countDiacritics(text) + (text.match(/[œŒ]/g) ?? []).length;
  return accents / letters < MIN_ACCENT_RATIO;
}

function countDiacritics(text: string): number {
  return (text.normalize('NFD').match(/\p{Diacritic}/gu) ?? []).length;
}

export function buildReaccentPrompt(texts: string[]): string {
  const list = texts.map((text, index) => `${index + 1}. ${text}`).join('\n');
  return `Tu remets les accents du français sur des phrases écrites sans accents.

RÈGLE ABSOLUE: tu ne changes RIEN d'autre. Pas un mot ajouté, pas un mot retiré, pas un synonyme, pas une reformulation, pas de traduction, pas de correction de style ou de grammaire. Tu ajoutes uniquement les diacritiques (é è ê ë à â ù û ô î ï ç), la ligature œ, les apostrophes manquantes (l'IA, jusqu'à, qu'Apple) et les majuscules accentuées (État). Si une phrase est déjà correcte, tu la renvoies à l'identique.

Attention aux cas qui demandent de LIRE la phrase: "a" (verbe avoir) contre "à" (préposition), "developpe" (il développe) contre "développé" (participe), "ou" contre "où", "des" contre "dès". Le sens de la phrase tranche.

Renvoie UNIQUEMENT un tableau JSON de ${texts.length} chaînes, dans le même ordre, sans commentaire ni balise de code.

PHRASES:
${list}`;
}

/**
 * Valide la reponse du modele phrase par phrase : longueur du tableau, puis invariant des lettres.
 * Toute phrase qui ne passe pas retombe sur l'originale ; on ne jette jamais le lot entier.
 */
export function parseReaccented(resultText: string, originals: string[]): { texts: string[]; rejected: number } {
  const cleaned = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  const raw: unknown = JSON.parse(match ? match[0] : cleaned);
  if (!Array.isArray(raw) || raw.length !== originals.length) {
    throw new Error(`reaccent: attendu ${originals.length} phrases, recu ${Array.isArray(raw) ? raw.length : 'non-tableau'}`);
  }
  let rejected = 0;
  const texts = originals.map((original, index) => {
    const candidate = raw[index];
    if (typeof candidate !== 'string' || !sameLetters(original, candidate)) {
      rejected += 1;
      return original;
    }
    // Second verrou : la passe ne peut qu'AJOUTER des accents. `sameLetters` ignore les
    // diacritiques par construction, donc a lui seul il laisserait passer un modele qui en
    // RETIRE (« Péages » -> « Peages »). Envoyer toutes les phrases, y compris les phrases
    // deja propres, n'a de sens qu'avec cette garantie.
    const repaired = repairAccents(candidate);
    if (countDiacritics(repaired) < countDiacritics(original)) {
      rejected += 1;
      return original;
    }
    return repaired;
  });
  return { texts, rejected };
}

export interface ReaccentOptions {
  batchSize?: number;
  model?: string;
  timeoutMs?: number;
  /** Injectable pour les tests (par defaut : le binaire `claude`). */
  run?: (prompt: string, options: { model: string; timeoutMs?: number }) => Promise<string>;
}

export interface ReaccentReport {
  texts: string[];
  /** Phrases effectivement modifiees par le modele. */
  changed: number;
  /** Phrases renvoyees par le modele mais refusees par l'invariant (originale conservee). */
  rejected: number;
  /** Lots perdus (timeout, JSON illisible) : leurs phrases sortent inchangees. */
  failedBatches: number;
}

/**
 * Passe Haiku sur TOUTES les phrases fournies (cf. `needsReaccent` : on ne sait pas reconnaitre
 * de facon fiable une phrase deja propre, et sauter a tort laisserait la faute en ligne).
 * Une phrase deja correcte revient a l'identique, c'est le cas nominal et il ne coute qu'un lot.
 *
 * Un lot perdu ne fait jamais echouer l'ensemble : ses phrases ressortent telles quelles.
 */
export async function reaccentTexts(texts: string[], options: ReaccentOptions = {}): Promise<ReaccentReport> {
  const model = options.model ?? REACCENT_MODEL;
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH);
  const run = options.run ?? ((prompt, opts) => runClaudeJson(prompt, opts));

  const out = [...texts];
  const todo = texts.map((_, index) => index);
  let changed = 0;
  let rejected = 0;
  let failedBatches = 0;

  for (let start = 0; start < todo.length; start += batchSize) {
    const indexes = todo.slice(start, start + batchSize);
    const originals = indexes.map(index => texts[index]!);
    try {
      const answer = await run(buildReaccentPrompt(originals), { model, timeoutMs: options.timeoutMs });
      const parsed = parseReaccented(answer, originals);
      rejected += parsed.rejected;
      indexes.forEach((index, rank) => {
        const repaired = parsed.texts[rank]!;
        if (repaired !== texts[index]) changed += 1;
        out[index] = repaired;
      });
    } catch (error) {
      failedBatches += 1;
      console.warn(`[reaccent] lot de ${indexes.length} perdu, phrases inchangees (${(error as Error).message.split('\n')[0]}).`);
    }
  }

  return { texts: out, changed, rejected, failedBatches };
}

export type Criteria = Record<CriterionKey, CriterionScore>;

/** Passe deterministe seule, sur les 5 justifications d'un ticker. */
export function polishCriteria(criteria: Criteria): Criteria {
  return Object.fromEntries(
    CRITERION_KEYS.map(key => [key, { ...criteria[key], justification: repairAccents(criteria[key].justification) }]),
  ) as Criteria;
}
