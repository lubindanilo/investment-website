/**
 * Garde-fou du pré-rendu bot (Q1 du plan SEO, docs/seo/PLAN.md).
 *
 * Le pré-rendu n'est PAS servi à tout le monde : `vercel.json` réécrit vers la lambda
 * uniquement les requêtes dont le User-Agent correspond à une LISTE D'AUTORISATION. Tout
 * robot absent de cette liste reçoit la coquille SPA de 3,6 Ko, sans titre, sans H1 et sans
 * texte. Les robots des IA n'exécutant pas JavaScript, ils ne voient alors rien du tout.
 *
 * C'est une panne SILENCIEUSE par construction : aucun rapport, aucune alerte, aucun test
 * fonctionnel ne la révèle. Elle s'est produite : au 4 août 2026, `OAI-SearchBot` (le robot
 * qui alimente l'index de recherche de ChatGPT) recevait 3 648 octets là où Googlebot en
 * recevait 21 717.
 *
 * Ce test verrouille trois choses :
 *   1. tous les robots dont dépend la visibilité du site sont bien dans la liste ;
 *   2. les 7 règles de réécriture partagent EXACTEMENT la même liste (le vrai risque de
 *      régression : quelqu'un en met à jour une et oublie les six autres) ;
 *   3. un navigateur humain n'est PAS réécrit vers le pré-rendu (les humains gardent la SPA).
 *
 * Note d'implémentation : Vercel évalue ces motifs avec le moteur RE2 de Go, qui accepte le
 * drapeau en ligne `(?i)`. JavaScript ne le connaît pas, on le convertit donc en drapeau `i`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

type Rewrite = {
  source: string;
  destination: string;
  has?: Array<{ type: string; key?: string; value?: string }>;
};

const vercelJson = JSON.parse(readFileSync(path.join(REPO_ROOT, 'vercel.json'), 'utf8')) as {
  rewrites: Rewrite[];
};

/** Les règles de réécriture conditionnées au User-Agent (celles qui servent le pré-rendu). */
const uaRules = vercelJson.rewrites
  .map((r) => ({
    source: r.source,
    ua: r.has?.find((h) => h.type === 'header' && h.key?.toLowerCase() === 'user-agent')?.value,
  }))
  .filter((r): r is { source: string; ua: string } => typeof r.ua === 'string');

/** Convertit un motif RE2 avec `(?i)` en RegExp JavaScript équivalente. */
function toRegExp(pattern: string): RegExp {
  const insensitive = pattern.startsWith('(?i)');
  return new RegExp(insensitive ? pattern.slice(4) : pattern, insensitive ? 'i' : '');
}

/**
 * Les robots dont dépend la visibilité, avec leur User-Agent réel.
 * Retirer une ligne d'ici est une décision produit, pas un détail technique : ça rend le
 * site invisible pour ce moteur.
 */
const MUST_MATCH: ReadonlyArray<readonly [string, string]> = [
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['Google-InspectionTool', 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)'],
  ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  // Assistants : c'est le canal qui convertit le mieux (jusqu'à 21 fois l'organique) et
  // 48 % des questions de décision d'achat déclenchent une vraie recherche web.
  ['OAI-SearchBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot'],
  ['ChatGPT-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'],
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'],
  ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
  ['Claude-User', 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)'],
  ['Claude-SearchBot', 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)'],
  ['PerplexityBot', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
  ['Perplexity-User', 'Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)'],
  ['Applebot', 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)'],
  ['Amazonbot', 'Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)'],
  ['meta-externalagent', 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'],
  ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
  ['MistralAI-User', 'Mozilla/5.0 (compatible; MistralAI-User/1.0; +https://mistral.ai)'],
  ['Bytespider', 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['Google-Extended', 'Google-Extended'],
  // Aperçus sociaux : ils décident de ce qui s'affiche quand un lien est partagé.
  ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['LinkedInBot', 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'],
  ['Twitterbot', 'Twitterbot/1.0'],
];

/** Un vrai navigateur ne doit JAMAIS être réécrit : les humains gardent la SPA. */
const MUST_NOT_MATCH: ReadonlyArray<readonly [string, string]> = [
  ['Chrome desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
  ['Safari iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0'],
];

describe('vercel.json : liste d\'autorisation du pré-rendu bot', () => {
  it('expose bien les règles conditionnées au User-Agent', () => {
    // 7 aujourd'hui : /analyse/:ticker, /blog/:slug, /secteur/:slug, /comparer/:pair,
    // /classement/:slug, /, et le groupe des pages statiques.
    expect(uaRules.length).toBeGreaterThanOrEqual(7);
  });

  it('applique la MÊME liste de robots à toutes les règles', () => {
    const distinct = new Set(uaRules.map((r) => r.ua));
    expect(
      distinct.size,
      `Les règles de réécriture ne partagent pas le même motif de User-Agent. ` +
      `Une route servirait le pré-rendu à un robot et pas les autres. Motifs trouvés : ${distinct.size}.`,
    ).toBe(1);
  });

  it.each(MUST_MATCH)('réécrit %s vers le pré-rendu', (name, ua) => {
    for (const rule of uaRules) {
      expect(
        toRegExp(rule.ua).test(ua),
        `${name} ne correspond pas au motif de la règle "${rule.source}" : ce robot recevrait ` +
        `la coquille SPA vide au lieu du HTML pré-rendu.`,
      ).toBe(true);
    }
  });

  it.each(MUST_NOT_MATCH)('laisse %s sur la SPA', (name, ua) => {
    for (const rule of uaRules) {
      expect(
        toRegExp(rule.ua).test(ua),
        `${name} correspond au motif de la règle "${rule.source}" : un humain recevrait le ` +
        `pré-rendu au lieu de l'application.`,
      ).toBe(false);
    }
  });
});
