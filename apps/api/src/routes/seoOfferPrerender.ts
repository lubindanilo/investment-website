/**
 * Pré-rendu HTML des pages de l'offre SEO, servi aux robots via rewrite conditionnel.
 *
 * Pourquoi ce fichier existe, et pourquoi c'est structurant plutôt que cosmétique :
 *
 * 1. LE PARTAGE. Un résultat de `/visibilite-ia/...` collé sur LinkedIn ou X déclenche une
 *    requête du robot du réseau. Sans pré-rendu, ce robot reçoit la coquille de la SPA et
 *    l'aperçu ne montre AUCUN chiffre — or c'est le chiffre qui fait cliquer. Le pré-rendu
 *    n'est donc pas un détail SEO, c'est le mécanisme de diffusion du produit.
 *
 * 2. LA COHÉRENCE. Le produit vend la détection des sites invisibles aux robots d'IA. Si sa
 *    propre landing n'était lisible qu'après exécution de JavaScript, elle serait invisible
 *    dans ChatGPT — un argumentaire qui se contredit à la première vérification. Ces pages
 *    partent donc en HTML complet, texte inclus.
 *
 * Les plafonds affichés sont importés de `mcp/gating.ts` : la page commerciale et la règle
 * appliquée viennent de la MÊME source, sinon elles divergent au premier changement de prix.
 */
import { Router, type Request, type Response } from 'express';
import { AUDITS_PER_MONTH, CRAWL_PAGE_CAP, SITES_TRACKED } from '../mcp/gating.js';
import { CheckError, checkAiVisibility } from '../lib/aiVisibility.js';

export const seoOfferPrerenderRouter: Router = Router();

const SITE_URL = (process.env.SITE_URL || 'https://lubin-investment.com').replace(/\/$/, '');

/** L'URL vérifiée vient de l'utilisateur et atterrit dans le HTML : échappement obligatoire. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface HeadOpts {
  title: string;
  description: string;
  canonical: string;
  /** `noindex` sur les pages de résultat : des milliers d'URL générées par les visiteurs
   *  n'ont pas à entrer dans l'index, et elles seraient du contenu quasi dupliqué. */
  noindex?: boolean;
  ogTitle?: string;
}

function head(o: HeadOpts): string {
  const ogTitle = o.ogTitle ?? o.title;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow'}">
<link rel="canonical" href="${esc(o.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(o.canonical)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:image" content="${SITE_URL}/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${SITE_URL}/og-default.png">
</head>
<body>`;
}

const FOOT = `<footer><p><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/audit-seo">Audit SEO et visibilité IA</a> · <a href="${SITE_URL}/audit-seo/tarifs">Tarifs</a> · <a href="${SITE_URL}/visibilite-ia">Test gratuit</a></p></footer>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// /visibilite-ia/* — résultat partagé
// ─────────────────────────────────────────────────────────────────────────────

const VERDICT_COPY: Record<string, { label: string; sub: string }> = {
  ssr: {
    label: 'Lisible',
    sub: 'Le texte part avec la page : les robots d’IA comme les moteurs de recherche la lisent sans rien exécuter.',
  },
  dynamic: {
    label: 'Lisible sous condition',
    sub: 'La page est pré-rendue pour les robots reconnus, mais un navigateur reçoit une coquille vide. La visibilité dépend d’une liste d’user-agents à maintenir.',
  },
  invisible: {
    label: 'Invisible',
    sub: 'Cette page a besoin de JavaScript pour afficher son contenu. Les robots d’IA ne l’exécutent pas : ils ne voient presque rien.',
  },
  thin: {
    label: 'Peu de contenu',
    sub: 'La page est bien servie, mais elle contient très peu de texte. Ce n’est pas un problème de rendu.',
  },
};

seoOfferPrerenderRouter.get('/visibilite-ia', (_req: Request, res: Response) => {
  res.status(200).set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    .send(
      head({
        title: 'Que voit ChatGPT de votre site ? Test gratuit de visibilité dans les moteurs IA',
        description:
          'Comptez en dix secondes les mots que les robots d’IA reçoivent réellement de votre page. Gratuit, sans compte.',
        canonical: `${SITE_URL}/visibilite-ia`,
      }) +
      `<h1>Que voit ChatGPT de votre page ?</h1>
<p>Collez une adresse : nous interrogeons votre page avec le vrai user-agent des robots d’IA et comptons les mots qu’ils reçoivent réellement. Gratuit, sans inscription, rien n’est conservé.</p>
<h2>Pourquoi ce test existe</h2>
<p>Aucun grand robot d’IA n’exécute JavaScript. GPTBot, ClaudeBot, PerplexityBot et les autres téléchargent vos fichiers <code>.js</code> sans les évaluer. Si votre page se construit dans le navigateur, ils ne voient rien.</p>
<p>Nous envoyons deux requêtes, une avec l’user-agent d’un robot d’IA et une avec celui d’un navigateur. L’écart entre les deux donne le diagnostic. Beaucoup de sites servent une version pré-rendue uniquement aux user-agents qu’ils reconnaissent : un vérificateur qui n’enverrait pas le bon user-agent conclurait faussement que le site est invisible.</p>
<p><a href="${SITE_URL}/audit-seo">L’audit complet couvre 90 vérifications</a>.</p>` +
      FOOT,
    );
});

// Express 4 : le joker s'écrit `*` et se lit dans `req.params[0]` (la syntaxe nommée
// `*splat` est du Express 5 et ne capturerait rien ici).
seoOfferPrerenderRouter.get('/visibilite-ia/*', async (req: Request, res: Response) => {
  // Le joker porte l'URL cible sans schéma : /visibilite-ia/exemple.fr/page
  const splat = (req.params as Record<string, string | undefined>)[0];
  const target = String(splat ?? '').slice(0, 2048);
  const canonical = `${SITE_URL}/visibilite-ia/${target}`;

  if (!target) {
    res.redirect(302, `${SITE_URL}/visibilite-ia`);
    return;
  }

  try {
    const r = await checkAiVisibility(target);
    const copy = VERDICT_COPY[r.verdict] ?? VERDICT_COPY.thin!;
    const host = safeHost(r.url);
    // Le chiffre est DANS le titre : c'est lui que l'aperçu de partage affiche, et c'est lui
    // qui fait cliquer. Un titre générique annulerait tout l'intérêt du pré-rendu.
    const title = `ChatGPT voit ${r.botWords} mot${r.botWords === 1 ? '' : 's'} de ${host} — ${copy.label}`;

    res.status(200).set('Content-Type', 'text/html; charset=utf-8')
      // 10 min : un résultat partagé et consulté cent fois ne doit pas déclencher cent
      // paires de requêtes sortantes vers le site de quelqu'un d'autre.
      .set('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=60')
      .send(
        head({
          title: `${title} · Lubin Investment`,
          ogTitle: title,
          description: copy.sub,
          canonical,
          // Des milliers d'URL générées par les visiteurs, quasi dupliquées : hors index.
          noindex: true,
        }) +
        `<h1>${esc(title)}</h1>
<p><strong>${esc(copy.label)}.</strong> ${esc(copy.sub)}</p>
<ul>
<li>Mots reçus par un robot d’IA : <strong>${r.botWords}</strong></li>
<li>Mots présents dans le HTML brut, avant exécution du JavaScript : <strong>${r.rawWords}</strong></li>
<li>Page testée : <a href="${esc(r.url)}" rel="nofollow noopener">${esc(r.url)}</a></li>
</ul>
<h2>Constats</h2>
${r.findings.map((f) => `<h3>${esc(f.id)} — ${esc(f.title)}</h3><p>${esc(f.detail)}</p><p><em>Niveau de preuve : ${esc(f.evidence)}</em></p>`).join('\n')}
<h2>Tester une autre page</h2>
<p><a href="${SITE_URL}/visibilite-ia">Le test est gratuit et illimité</a>. Pour les 89 autres vérifications, <a href="${SITE_URL}/audit-seo">voir l’audit complet</a>.</p>` +
        FOOT,
      );
  } catch (e) {
    const msg = e instanceof CheckError ? e.message : 'La vérification a échoué.';
    res.status(200).set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .send(
        head({
          title: 'Vérification impossible · Lubin Investment',
          description: msg,
          canonical,
          noindex: true,
        }) +
        `<h1>Vérification impossible</h1><p>${esc(msg)}</p>
<p><a href="${SITE_URL}/visibilite-ia">Réessayer avec une autre adresse</a></p>` +
        FOOT,
      );
  }
});

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /audit-seo — landing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Titre long multi-intention, 150 à 250 caractères, l'essentiel dans les douze premiers mots.
 * C'est la règle B2 du corpus (+10 à 40 % de trafic mesuré) — appliquée à notre propre page,
 * parce qu'une landing qui vend ces règles et ne les suit pas est un mauvais argument.
 */
const LANDING_TITLE =
  'Audit SEO et visibilité IA : voir ce que ChatGPT lit de votre site, corriger en Pull Request — 90 vérifications à niveau de preuve, avis, tarifs et alternative aux outils SEO classiques';

const LANDING_DESC =
  'Audit SEO adossé à 9 011 claims dont 1 592 mesurés. Chaque constat porte son niveau de preuve, et la liste de ce qu’il faut arrêter de faire. Test de visibilité IA gratuit et illimité.';

function tierRow(name: string, price: string, tier: 'free' | 'solo' | 'studio' | 'agency'): string {
  const audits = AUDITS_PER_MONTH[tier] ?? 'illimités';
  const sites = SITES_TRACKED[tier] ?? 'illimités';
  return `<tr><td>${esc(name)}</td><td>${esc(price)}</td><td>${audits}</td><td>${CRAWL_PAGE_CAP[tier].toLocaleString('fr-FR')}</td><td>${sites}</td></tr>`;
}

const PRICING_TABLE = `<table>
<caption>Paliers de l’offre. Le test de visibilité IA est gratuit et illimité sur tous.</caption>
<thead><tr><th>Palier</th><th>Prix</th><th>Audits / mois</th><th>Pages par audit</th><th>Sites suivis</th></tr></thead>
<tbody>
${tierRow('Gratuit', '0 €', 'free')}
${tierRow('Solo', '39 €/mois', 'solo')}
${tierRow('Studio', '149 €/mois', 'studio')}
${tierRow('Agence', '490 €/mois', 'agency')}
</tbody>
</table>`;

seoOfferPrerenderRouter.get('/audit-seo', (_req: Request, res: Response) => {
  res.status(200).set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    .send(
      head({
        title: `${LANDING_TITLE} · Lubin Investment`,
        ogTitle: 'Audit SEO et visibilité IA — 90 vérifications, chacune avec son niveau de preuve',
        description: LANDING_DESC,
        canonical: `${SITE_URL}/audit-seo`,
      }) +
      `<h1>Audit SEO et visibilité IA, avec le niveau de preuve de chaque conseil</h1>

<p><strong>Un audit qui refuse les fausses bonnes idées.</strong> Les recommandations viennent d’un corpus de 839 vidéos distillées en 9 011 affirmations, dont 1 592 mesurées. Chaque constat porte son niveau de preuve, et le produit vous dit aussi ce qu’il faut <em>arrêter</em> de faire.</p>

<h2>Commencez par le test qui décide de tout</h2>
<p>Aucun grand robot d’IA n’exécute JavaScript. Si votre site se construit dans le navigateur, ChatGPT, Claude et Perplexity ne voient rien de vos pages, et aucun autre travail SEO ne sert avant d’avoir réglé ça. <a href="${SITE_URL}/visibilite-ia">Le test est gratuit, illimité et sans compte</a>.</p>

<h2>Ce que l’audit vérifie</h2>
<p>Quatre-vingt-dix vérifications, triées par rendement : le gratuit et mesuré d’abord, le cher et supposé en dernier.</p>
<ul>
<li><strong>Existence et indexation</strong> — rendu sans JavaScript, taux d’indexation réel, pages orphelines, profondeur de clic, sitemap, forme des URL.</li>
<li><strong>On-page</strong> — les cinq emplacements du mot-clé, longueur des titres, résumé en tête de page, texte enfermé dans les accordéons, liens sortants.</li>
<li><strong>Maillage interne</strong> — ancres non descriptives, cannibalisation, pages stratégiques trop profondes.</li>
<li><strong>Confiance</strong> — parité éditoriale des comparatifs, signature d’auteur, page FAQ officielle.</li>
</ul>

<h2>Ce qu’il faut arrêter de faire</h2>
<p>C’est la partie la plus rentable, parce qu’elle ne demande aucun travail : elle en supprime. Quarante et une tactiques que la mesure dit inutiles ou nuisibles, et qu’un assistant généraliste applique spontanément.</p>
<ul>
<li><strong>Balisage schema pour le classement</strong> — quatre tests indépendants, aucun effet mesurable.</li>
<li><strong>Fichier <code>llms.txt</code></strong> — dix requêtes de robots d’IA sur mille domaines observés.</li>
<li><strong>Core Web Vitals pour le référencement</strong> — un site passé de 40 s à 1,68 s de chargement : aucun changement de trafic.</li>
<li><strong>Meta descriptions générées</strong> — mesurées comme faisant moins bien que pas de description du tout.</li>
<li><strong>Pages par ville</strong> — 80 % des classements perdus en trente jours dans le cas mesuré.</li>
</ul>

<h2>Corriger, pas seulement constater</h2>
<p>L’audit tourne dans l’assistant que vous utilisez déjà, qui a donc accès à ce qui y est connecté : votre dépôt, votre hébergeur, votre Search Console. Vingt-trois des quatre-vingt-dix vérifications sortent en Pull Request appliquable — jamais un envoi direct en production, un lot par Pull Request, avec l’avant/après dans la description.</p>
<p>Le reste demande une exécution humaine : publier un outil gratuit, répondre aux demandes de journalistes, demander des avis clients. Le produit les priorise et rédige les livrables, il ne prétend pas les faire à votre place.</p>

<h2>Alternative aux outils SEO classiques</h2>
<p>Un outil comme Ahrefs ou Semrush rend un rapport. Il ne touche pas à votre code, il ne sait pas ce que ChatGPT lit de vos pages, et il ne vous dira pas d’arrêter le travail qu’il vous vend. La différence n’est pas le volume de données, c’est le niveau de preuve et la capacité à corriger.</p>

<h2>Tarifs</h2>
${PRICING_TABLE}
<p><a href="${SITE_URL}/audit-seo/tarifs">Détail des paliers et de ce qu’ils incluent</a>.</p>

<h2>Ce que ce produit ne sait pas faire</h2>
<p>Autant le dire avant l’achat. Aucune mesure du corpus n’a été faite en français : les taux de résumés IA, de zéro clic et de citation viennent de l’anglais, ils cadrent mais ne prédisent pas. Aucune mesure ne porte sur de très petits sites — les cas chiffrés concernent des sites qui avaient déjà du trafic à perdre. Rien sur <code>hreflang</code>. Et quatre contradictions du corpus restent non tranchées : le produit présente les deux positions plutôt que d’en choisir une.</p>

<h2>Questions fréquentes</h2>
<h3>Faut-il un compte pour tester ?</h3>
<p>Non. Le test de visibilité IA est gratuit, illimité et sans compte, sur tous les paliers.</p>
<h3>Est-ce que ça modifie mon site tout seul ?</h3>
<p>Non. Les correctifs sortent en Pull Request que vous validez. Aucun envoi direct en production.</p>
<h3>Combien de temps avant de voir un effet ?</h3>
<p>Des semaines. C’est pourquoi les paliers payants conservent l’historique : sans avant/après, on ne peut pas rattacher une correction à son effet.</p>
<h3>Pourquoi le corpus vient-il d’une seule source ?</h3>
<p>Parce que c’est ce qui permet de garder la traçabilité : chaque affirmation porte son niveau de preuve et un lien horodaté vers son origine. C’est aussi une limite, et elle est écrite plus haut.</p>

<p>Sources externes utiles pour vérifier le point central : la documentation de Google sur le <a href="https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering" rel="noopener">rendu dynamique</a> et celle d’OpenAI sur <a href="https://platform.openai.com/docs/bots" rel="noopener">ses robots</a>.</p>` +
      FOOT,
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// /audit-seo/tarifs — page de prix dédiée
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Page tarifs séparée de la landing, volontairement : le corpus mesure que les requêtes de
 * prix ont un meilleur taux de clic que les termes métier et génèrent un trafic durable.
 * Une section « tarifs » dans une landing ne capte pas ces requêtes.
 */
seoOfferPrerenderRouter.get('/audit-seo/tarifs', (_req: Request, res: Response) => {
  const title =
    'Tarifs de l’audit SEO et visibilité IA : gratuit, 39 €, 149 € ou 490 € par mois — pages incluses, audits, historique et comparatif sectoriel détaillés';
  res.status(200).set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    .send(
      head({
        title: `${title} · Lubin Investment`,
        ogTitle: 'Tarifs — audit SEO et visibilité IA',
        description:
          'Quatre paliers, de gratuit à 490 €/mois. Le test de visibilité IA reste gratuit et illimité sur tous. Prix, plafonds de pages et contenu de chaque palier.',
        canonical: `${SITE_URL}/audit-seo/tarifs`,
      }) +
      `<h1>Tarifs de l’audit SEO et visibilité IA</h1>

<p><strong>Le test de visibilité IA est gratuit et illimité sur tous les paliers</strong>, y compris sans compte. Ce qui se facture, c’est l’audit complet du site, la conservation de l’historique et le comparatif sectoriel.</p>

${PRICING_TABLE}

<h2>Gratuit — 0 €</h2>
<p>Test de visibilité IA illimité. Un audit complet par mois, plafonné à ${CRAWL_PAGE_CAP.free} pages. Pas d’historique : l’audit n’est pas conservé, il n’y a donc pas d’avant/après.</p>

<h2>Solo — 39 € par mois</h2>
<p>Audits illimités, jusqu’à ${CRAWL_PAGE_CAP.solo.toLocaleString('fr-FR')} pages par audit, un site suivi. L’historique est conservé : c’est ce qui permet de rattacher une correction à son effet, sur un canal où les effets prennent des semaines.</p>

<h2>Studio — 149 € par mois</h2>
<p>Jusqu’à ${CRAWL_PAGE_CAP.studio.toLocaleString('fr-FR')} pages par audit, ${SITES_TRACKED.studio} sites suivis, et le comparatif sectoriel : votre site situé face à la médiane des sites de même stack déjà audités. Le comparatif ne s’affiche qu’au-delà de cinq sites dans la cohorte — en dessous, ce serait un chiffre inventé.</p>

<h2>Agence — 490 € par mois</h2>
<p>Jusqu’à ${CRAWL_PAGE_CAP.agency.toLocaleString('fr-FR')} pages par audit, sites suivis illimités, rapport en marque blanche.</p>

<h2>Questions sur la facturation</h2>
<h3>Pourquoi le test de visibilité IA reste-t-il gratuit ?</h3>
<p>Parce qu’il coûte une requête et qu’il répond à la question qui décide de tout le reste. Le rationner reviendrait à rationner sa propre diffusion.</p>
<h3>Que compte exactement le plafond de pages ?</h3>
<p>Les pages réellement examinées pendant un audit. Chaque page coûte des requêtes sortantes : le plafond correspond à un coût réel, pas à une restriction inventée. Quand il tombe, le rapport indique combien de pages ont été découvertes sans être examinées.</p>
<h3>Peut-on annuler ?</h3>
<p>Oui, depuis votre compte, et l’accès reste ouvert jusqu’à la fin de la période payée.</p>
<h3>Et si le corpus se périme ?</h3>
<p>C’est précisément ce que l’abonnement finance. Le conseil SEO se périme en douze mois ; les règles sont ré-ingérées à mesure que de nouvelles mesures paraissent.</p>

<p><a href="${SITE_URL}/audit-seo">Revenir à la présentation de l’offre</a> · <a href="${SITE_URL}/visibilite-ia">Faire le test gratuit</a></p>` +
      FOOT,
    );
});
