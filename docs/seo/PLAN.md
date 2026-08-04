---
type: note
subtype: plan
created: 2026-08-04
updated: 2026-08-04
tags: [projet/lubin-investment, seo, geo]
---

# Plan SEO Lubin Investment

Objectif : capter les requêtes de décision d'achat en bourse (« faut-il acheter l'action X »,
« X est-elle sous-évaluée », « meilleures actions de qualité », « X ou Y ») et être cité par les
assistants au moment où quelqu'un choisit une action.

Ce plan applique la `masterclass-seo` (corpus @buildinpublic, 839 vidéos distillées, 8 818 claims
dont 1 551 mesurés). Chaque action porte la mesure qui la justifie et le chapitre où la preuve est
détaillée. Ce qui n'est pas mesuré est signalé comme tel. Les actions absentes de ce plan ont été
retirées volontairement : voir §11.

Établi le 4 août 2026, sur des relevés faits en production le même jour.

---

## 1. Le cadre en cinq phrases

1. **L'indexation décide, pas le classement.** Une page non indexée n'existe ni pour Google ni
   pour les assistants, qui n'ont pas d'index propre : 88 % des citations de ChatGPT viennent de
   l'index de recherche (ch. 3, 7). Le site publie 5 538 URL et environ la moitié seulement est
   indexée. C'est le plafond, pas le contenu.
2. **Les robots des IA n'exécutent pas JavaScript.** Le site est une application Vite rendue dans
   le navigateur, avec un pré-rendu servi **uniquement aux robots figurant dans une liste
   d'autorisation**. Cette liste a des trous, et les trous coûtent exactement le canal qui
   convertit le mieux (ch. 14).
3. **Le bas de tunnel tient, le haut de tunnel s'effondre.** 50 à 95 % de perte sur le contenu de
   découverte depuis 2023, stable ou en hausse sur les requêtes de décision. Les récapitulatifs de
   résultats trimestriels de méga-capitalisations sont du haut de tunnel pur, et 62 des 348 articles
   du blog en sont (ch. 1).
4. **Le marché autorise les mots-clés à volume nul.** Les outils de volume sous-estiment le trafic
   réel d'un facteur 20, et des mots-clés affichés à zéro rapportent plus de 300 clics par mois.
   Une page ciblant un seul mot-clé faible classe sur des dizaines de mots-clés voisins jamais
   ciblés (ch. 1, 11).
5. **Le geste de rétablissement documenté est la réduction, pas l'extension.** Sept raisonnements
   indépendants du livre pointent dans cette direction, dont un test à 5 fois plus de trafic après
   suppression de la moitié des pages faibles. Le site fait l'inverse depuis deux mois : +529 URL
   et +190 articles, pour 15 clics sur 28 jours (ch. 2, 14, annexe B).

C'est exactement le profil « site de contenu à gros catalogue dans un secteur sensible » de
l'annexe B du livre, avec une circonstance aggravante (le rendu client) et une circonstance
atténuante décisive : **le site possède une donnée que personne d'autre n'a**, sa note de qualité
sur 10 critères, son score de résilience en 5 étoiles, son percentile de valorisation historique et
son prix d'achat cible, calculés sur environ 5 000 sociétés. C'est la condition de validité du
programmatique, et elle est remplie (ch. 2, 9).

---

## 2. Diagnostic mesuré, 4 août 2026

Tous les relevés viennent de `curl` sur la production, avec des agents utilisateur réels, et de
`vault/projects/li-seo/state/indexation-tracker.md` pour les chiffres Search Console.

### 2.1 Le tableau technique

| Point | État constaté | Gravité |
|---|---|---|
| Rendu du contenu | SPA Vite. Le HTML servi aux humains fait 3 648 octets et ne contient **aucun texte de page**. Le pré-rendu (14 à 29 Ko de vrai HTML) est servi uniquement aux robots listés dans `vercel.json` | Structurel |
| Liste d'autorisation des robots | **`OAI-SearchBot`, `Claude-SearchBot`, `Claude-User`, `Perplexity-User`, `Amazonbot`, `Bytespider`, `meta-externalagent`, `CCBot`, `MistralAI-User`, `DuckAssistBot`, `Google-CloudVertexBot` reçoivent la coquille vide.** Vérifié : `OAI-SearchBot` sur un article reçoit 3 648 octets, `Googlebot` en reçoit 21 717 | Bloquant |
| Maillage interne depuis `/screener` | **3 208 octets, 8 liens, zéro lien vers `/analyse/*` et zéro vers `/secteur/*`.** Le hub naturel des 5 000 fiches est une page morte pour les robots | Bloquant |
| Maillage interne depuis `/compare` | **2 639 octets, zéro lien vers les 19 pages `/comparer/*`.** Le seul motif validé par un test du livre est orphelin | Bloquant |
| Hubs secteur | 181 pages `/secteur/*`, chacune liant 60 fiches, mais **aucune page du site ne les liste**. Atteignables seulement par le sitemap et par les fiches ticker | Élevée |
| Cannibalisation | `/analyse/SNY` titre « Faut-il acheter l'action Sanofi (SNY) ? » et `/blog/sanofi-sny-faut-il-acheter-2026` titre « Faut-il acheter l'action Sanofi (SNY) en 2026 ? ». **Deux URL du même site sur la même requête** | Élevée |
| Pages orphelines depuis l'accueil | L'accueil sert 17 liens : screener, méthodologie, blog, analyser, 2 classements, 5 articles récents. **Ni `/pricing`, ni `/faq`, ni `/palmares`, ni `/compare`** | Élevée |
| Meta descriptions | Absentes des 5 000 fiches ticker (correct) et des pages de comparaison (correct). **Présentes et générées par gabarit sur les 181 hubs secteur** | Moyenne |
| Titres des fiches | Longs et multi-intention (bon), mais contiennent « note de qualité 8/10 » et « valorisation P/FCF 51.1× », c'est-à-dire du jargon interdit par le garde-fou CI qui ne s'applique qu'aux articles | Moyenne |
| Sitemaps | **Bien faits.** Index + 8 sitemaps thématiques, `lastmod` honnête branché sur un vrai changement de fondamentaux, priorité différenciée par note, hreflang fr/en/es. Les fiches en `noindex` sont bien exclues | Acquis |
| `robots.txt` | Propre, `Sitemap:` déclaré, `/api/` `/login` `/signup` exclus. Aucun blocage de robot d'IA (le site est sur Vercel sans couche Cloudflare) | Acquis |
| Multilingue | Réel : traduction fr/en/es, `<html lang>` correct, canonique auto-référente, grappe hreflang complète. Coût caché : les variantes `?lng=` triplent l'univers crawlable à environ 16 600 URL | À surveiller |
| Résumé en tête de page | **Présent** sur les fiches ticker : le verdict tient dans les 100 premiers mots. Absent des hubs et des classements | Partiel |
| Liens sortants | **Présents** sur les fiches : SEC EDGAR, investor.gov, Damodaran. Absents des hubs, des classements et de la plupart des articles | Partiel |
| Balisage JSON-LD | Présent (WebSite, Organization, ItemList, dateModified). Le corpus le mesure à effet nul, mais il ne nuit pas s'il est correct | Neutre |
| Hébergement | Vercel, cache 1 h sur le pré-rendu (`x-vercel-cache: HIT`). Pas d'IP dédiée disponible : le point du livre n'est pas actionnable ici | Non actionnable |

### 2.2 L'effondrement des impressions, le fait le plus important du diagnostic

Extrait de la table de tendance de `indexation-tracker.md`, dimension page, fenêtre glissante de
28 jours :

| Date | Pages avec impressions | Impressions | Clics |
|---|---|---|---|
| 2026-07-17 | 1 517 | 7 910 | 104 |
| 2026-07-20 | 1 490 | 7 802 | 100 |
| 2026-07-22 | 1 362 | 6 349 | 89 |
| 2026-07-24 | 985 | 2 182 | 70 |
| 2026-07-26 | 665 | 1 481 | 57 |
| 2026-07-28 | 469 | 978 | 41 |
| 2026-07-30 | 321 | 649 | 28 |
| 2026-08-01 | 143 | 351 | 18 |
| 2026-08-03 | **52** | **220** | **15** |

En dix-sept jours : **moins 96,6 % de pages servies, moins 97,2 % d'impressions, moins 85,6 % de
clics.** Les rapports quotidiens qualifient cela quatorze fois de suite de « légère baisse de
fenêtre glissante ». Ce n'est pas une lecture tenable : une fenêtre glissante ne divise pas un
volume par 36.

### 2.2 bis Le diagnostic, fait le 4 août 2026 : ce n'était pas un effondrement

Relevé dans la Search Console, propriété **par préfixe d'URL** `https://lubin-investment.com/`. La
propriété **domaine** était ce jour-là en « traitement des données », donc inutilisable : c'est un
piège à connaître, l'historique lisible est dans la propriété par préfixe.

| Vérification | Résultat |
|---|---|
| Actions manuelles | **Aucun problème détecté.** Hypothèse écartée |
| Positions | Accueil à 3,8 sur 90 jours, certaines fiches à **1,1 et 1,7**. Aucun déclassement |
| 90 jours | 129 clics, 7 850 impressions, CTR 1,6 %, position moyenne 9,3 |
| Page la plus vue | `/blog/micron-mu-avant-resultats-24-juin-2026?lng=en` : **4 207 impressions**, 0 % de CTR, position 8,8 |
| Même article en français | **57 impressions** |
| Accueil | 51 clics pour 79 impressions, CTR 64,6 % |
| 28 derniers jours | 15 clics, dont **14 sur l'accueil** |

**La cause est identifiée, et ce n'est aucune des trois hypothèses.** Une seule page, la version
anglaise d'une preview avant les résultats de Micron, a produit 54 % des impressions du trimestre.
Les requêtes qui l'ont générée sont « micron earnings june 2026 results guidance hbm ai demand june
2026 » et une dizaine de variantes quasi identiques, à 0 % de clic, positions 5 à 10. Personne ne
tape ça : ce sont des **requêtes de grounding de modèles**. Le corpus le décrit exactement ainsi, et
prévient de ne pas traiter les positions hautes sans clic comme un échec. La même signature revient
sur 28 jours : `/analyse/TFC?lng=en` fait 131 impressions en position 1,7 pour zéro clic, sur la
requête `"truist financial" "banks (regional)" damodaran`.

L'événement Micron du 24 juin est sorti de la fenêtre de 28 jours, et le total est retombé à son
niveau réel. **Il n'y a jamais eu de chute : il y a eu une bosse.**

Ce que le relevé établit en revanche, et qui est beaucoup plus important :

- **Le trafic humain réel est d'environ 78 clics en 90 jours** hors accueil, pour 5 500 URL.
- **L'accueil concentre 40 % des clics**, en recherche de marque, avec un taux de clic sain.
- **Le site est très visible pour les modèles et invisible pour les humains.** Il classe en
  position 1 sur des requêtes que seules des machines formulent.
- **Les variantes anglaises sont ce que les modèles lisent** : 4 207 impressions contre 57 sur la
  même page. Les traductions ne sont pas un bonus, c'est le canal.

La conséquence éditoriale est au §6.5, et elle remplace la lecture précédente : le problème n'est
pas d'avoir trop publié, c'est d'avoir publié sur des requêtes que personne ne formule.

Les trois hypothèses ci-dessous sont conservées pour mémoire, parce que la méthode reste la bonne
même si la réponse était ailleurs.

1. **Purge d'impressions robots.** Le corpus documente que les impressions au-delà de la position
   50 étaient largement générées par des robots, et qu'un changement technique les a supprimées
   (ch. 11). Si c'est ça, la perte est comptable et non réelle : les clics auraient dû rester
   stables. Ils sont passés de 104 à 15, donc cette hypothèse seule ne suffit pas.
2. **Désindexation ou déclassement algorithmique.** Google a commencé en mai 2026 à désindexer en
   masse du contenu identifié comme généré par IA (ch. 3). Un catalogue de 5 000 pages gabarisées
   plus 348 articles publiés à 3 ou 4 par jour dans un secteur financier est exactement le voisinage
   statistique visé. Signature à chercher : bascule massive de « Indexée » vers « Explorée,
   actuellement non indexée » dans le rapport d'indexation.
3. **Action manuelle.** À écarter en trente secondes : Search Console, Sécurité et actions
   manuelles. Si c'est ça, tout le reste du plan attend, parce que le délai de rétablissement
   documenté est de 2 à 3 ans et le taux de rétablissement d'environ 3 % (ch. 8, 12).

~~**Ne rien écrire de neuf avant d'avoir tranché entre ces trois hypothèses.**~~ Fait le 4 août, voir
§2.2 bis. Le blocage est levé.

### 2.3 Ce qui est déjà très bien fait, et qu'il faut protéger

Le travail des semaines précédentes couvre déjà une bonne partie du livre. À ne pas défaire :

- Les cinq emplacements du mot-clé sur les fiches ticker : titre, URL, H1, première phrase. C'est
  70 % du résultat on-page, neuf corroborations.
- Les titres longs multi-intention (celui de MSFT fait 197 caractères) : mesuré à +10 à 40 % de
  trafic, contre la règle des 60 caractères qui n'est pas étayée.
- L'absence de meta description sur les 5 000 fiches : les descriptions de Google battent celles
  écrites à la main de 3 %, Google en ignore 63 %, et celles générées par gabarit font **moins bien
  que pas de description du tout**.
- Le résumé verdict en tête de fiche : +33 % de conversion, six occurrences indépendantes.
- Les liens sortants section par section : quatre tests indépendants, aucun contre-exemple, geste
  on-page le mieux prouvé du livre.
- Les sitemaps découpés avec `lastmod` honnête : plusieurs petits sitemaps s'indexent plus vite
  qu'un gros, et bumper une date sans changement de contenu est mesuré comme contre-productif.
- Les 19 pages de comparaison : c'est le seul motif programmatique validé par un test (première
  page en trois semaines).
- Le garde-fou CI `no-dashes` : le corpus note que les tirets longs et guillemets typographiques
  produits par les modèles sont des marqueurs reconnus par les systèmes de détection (ch. 9).
- La FAQ officielle qui dit ce que le produit ne fait pas : c'est le correctif documenté contre les
  hallucinations des modèles sur une marque (ch. 8).
- Le connecteur MCP et le screener : un site qui offre un outil résiste mieux aux mises à jour
  qu'un éditeur pur (ch. 14).

---

## 3. Les quatre causes racines

Tout le reste du plan découle de ces quatre points.

**Cause 1 : le pré-rendu est une liste d'autorisation, donc il rate ce qui n'est pas listé.**
`OAI-SearchBot` est le robot qui alimente l'index de recherche de ChatGPT. Il reçoit une page vide.
Le canal IA représente moins de 1 % des visites et convertit jusqu'à 21 fois mieux que l'organique,
et 48 % des questions de décision d'achat déclenchent une vraie recherche web par le modèle contre
0 % des questions de découverte (ch. 11, 14). Un site d'analyse d'actions est **exactement** au
point du tunnel où les modèles vont chercher, et il est absent pour la moitié d'entre eux.

**Cause 2 : les 5 000 fiches et les 181 hubs sont des orphelins de fait.** Le sitemap aide à
découvrir, il ne convainc pas Google de garder (ch. 3). Or les seuls liens internes que reçoivent
les fiches viennent d'autres fiches et de deux pages de classement. Les leviers mesurés sont
inverses : une page liée depuis l'accueil est indexée en quelques heures, corriger des pages
orphelines a produit 6 fois plus d'impressions en 24 heures, et 4 à 6 liens internes depuis des
pages comparables valent un backlink externe (ch. 3, 5). Le code porte déjà la preuve de ce
mécanisme : le commentaire de `seoPrerender.ts:1758` note que « la page /blog ne servait AUCUN lien
vers les articles (cause confirmée des 50 % URL unknown to Google dans l'audit 2026-06-23) ». Le
même bug est encore ouvert sur `/screener` et sur `/compare`.

**Cause 3 : le blog cannibalise les fiches.** Les 5 000 fiches ciblent déjà « Faut-il acheter
l'action X ». Chaque nouvel article de thèse sur un ticker vise la même requête avec une autre URL.
Le corpus est net : plusieurs pages du même site sur le même mot-clé se concurrencent, une seule
concourt, et corriger la cannibalisation a rapporté 400 % de trafic à GitHub (ch. 2, 5). Il faut un
propriétaire par intention.

**Cause 4 : le rythme de publication est le motif que Google normalise.** 348 articles, dont environ
190 publiés en huit semaines, avec un plafond dur de 3 par run et une couverture obligatoire des
résultats de méga-capitalisations. Le corpus mesure que Google suit et normalise une vitesse de
publication anormalement élevée, que publier des milliers de pages sans intention stratégique
diminue le trafic organique, et que publier davantage dilue les signaux d'engagement moyens du site
au point de pénaliser même les bons articles (ch. 2). Repère à garder en tête : un site publiant
**un article par semaine** a atteint 130 000 visites organiques mensuelles en moins de deux ans
(ch. 13).

---

## 4. Les quick wins, directement actionnables

Tous gratuits, tous dans le code, aucun ne demande d'écrire du contenu. Classés par rendement
attendu sur effort. Total : environ deux jours de développement.

### Q1. Servir le pré-rendu à tout le monde, ou au minimum inverser la liste

**Fichier :** `vercel.json`, bloc `rewrites`.
**Temps :** 30 minutes pour la version minimale, une demi-journée pour la bonne version.
**État : version minimale FAITE le 4 août 2026.** Les 7 regex portent désormais 55 jetons au lieu
de 27, et `apps/api/src/routes/seoBotRewrites.test.ts` verrouille le résultat : 21 robots doivent
correspondre, 3 navigateurs humains ne doivent pas, et les 7 règles doivent porter le **même**
motif (le vrai risque de régression étant d'en mettre une à jour et d'oublier les six autres). La
bonne version, inverser la logique, reste à faire.

La version minimale, à faire aujourd'hui : ajouter les jetons manquants à la regex des sept règles
de réécriture.

```
oai-searchbot|chatgpt-user|gptbot|claude-searchbot|claude-user|claudebot|anthropic-ai|
perplexitybot|perplexity-user|amazonbot|bytespider|meta-externalagent|meta-externalfetcher|
ccbot|cohere-ai|mistralai-user|duckassistbot|google-cloudvertexbot|youbot|diffbot|
timpibot|ai2bot|qwantify|bravebot|yeti
```

La bonne version, à planifier : **inverser la logique.** Servir le HTML pré-rendu par défaut à
toutes les requêtes de navigation, et ne servir la coquille SPA que sur les routes applicatives
authentifiées (`/watchlist`, `/compte`, `/login`, `/signup`, `/analyser`). Trois raisons mesurées :
ce qui est dans la réponse HTML initiale est indexé même sans exécution de JavaScript, le texte
entièrement visible bat nettement le texte caché derrière JavaScript, et 60 % des clics venus des
IA arrivent sur la page d'accueil (ch. 11, 13, 14). Bénéfice secondaire non SEO : la première
peinture devient instantanée pour les humains aussi.

Tant que la liste d'autorisation existe, elle est une dette qui se réveille à chaque nouveau robot
mis en service par un fournisseur de modèle, sans aucun signal d'alerte.

**Test de non-régression à ajouter :** un test qui vérifie que `curl -A OAI-SearchBot` sur
`/analyse/MSFT`, `/blog/<slug>` et `/` renvoie plus de 8 000 octets contenant le H1. C'est
exactement le type de panne silencieuse que personne ne voit passer.

### Q2. Faire de `/screener` le hub qui alimente les 5 000 fiches

**Fichier :** `apps/api/src/routes/seoPrerender.ts`, entrée `/screener` de `STATIC_SEO` plus un
nouveau bloc de rendu sur le modèle de `renderArticleListBlock`.
**Temps :** 2 heures.
**État : FAIT le 4 août 2026.** `renderScreenerHubBlock` : la page passe de 3 208 à 36 383 octets,
de 8 à 293 liens, dont les **181 hubs secteur** et les **100 meilleures fiches**. Dégrade en bloc
vide si la base ne répond pas, donc la page part toujours en 200. Cache CDN ramené de 24 h à 1 h
sur cette page, puisque son contenu bouge au fil des re-scorings.

Le pré-rendu de `/screener` doit contenir :

- la liste des **181 hubs secteur**, avec pour ancre le nom du secteur en français ;
- les **100 meilleures fiches** par `scoreRatio`, avec pour ancre « Analyse de <Nom> (<TICKER>) » ;
- un lien vers chaque page de classement.

Effet attendu, mesuré : les 181 hubs passent d'orphelins à deux clics de l'accueil, et les 5 000
fiches passent à trois clics avec un vrai lien contextuel au lieu d'une simple ligne de sitemap. Les
pages qui rapportent doivent être à deux ou trois clics de l'accueil, au-delà elles ont besoin
d'être alimentées par des liens (ch. 5). Un cas rapporte 6 fois plus d'impressions en 24 heures
après correction des pages orphelines.

Attention à ne pas surcharger : garder le menu principal court. Lier plus de 500 pages depuis la
navigation divise l'autorité, et réduire un menu aux seules pages qui convertissent a augmenté leur
classement (ch. 5).

**Écart assumé par rapport à la première version de ce plan**, qui prescrivait une centaine de
liens au maximum sur cette page. L'implémentation en porte 293 (181 hubs plus 100 fiches plus la
navigation). Raison : le seuil mesuré du corpus porte sur la navigation à l'échelle du site, à plus
de 500 pages, pas sur une page d'index, et le précédent local est concluant. La page `/blog` porte
355 liens depuis juin, et c'est précisément ce qui a corrigé les 50 % d'URL inconnues de Google
constatés à l'audit du 23 juin. Les 181 hubs sont non négociables, ils étaient orphelins et chacun
relie 60 fiches, ce qui couvre tout le catalogue. Les 100 fiches en tête sont le complément qui
transmet de l'autorité aux meilleures notes depuis une page à deux clics de l'accueil.

### Q3. Faire de `/compare` le hub des 19 pages de comparaison

**Fichier :** même fichier, entrée `/compare` de `STATIC_SEO`.
**Temps :** 30 minutes.
**État : FAIT le 4 août 2026.** `renderComparePairsBlock` : 19 liens, ancres construites avec le
**nom réel des sociétés** lu en base et non le ticker (« Microsoft ou Alphabet : laquelle acheter »),
parce qu'un décalage entre l'ancre et la page d'arrivée entraîne une rétrogradation mesurée. Repli
sur le ticker si la base ne répond pas : dégradé, mais le lien existe, et c'est le lien qui porte
l'indexation.

Lister les 19 paires avec l'ancre « <Société A> ou <Société B> : laquelle acheter ». C'est le seul
motif programmatique validé par un test du livre, 15 à 20 pages de comparaison en première page en
trois semaines, et il est aujourd'hui accessible seulement depuis les fiches des deux sociétés
concernées. Ces pages captent aussi le trafic de marque des concurrents (ch. 2).

### Q4. Compléter le maillage de l'accueil et du pied de page

**Fichiers :** `renderStaticHtml`, `renderHubHtml` et `renderTickerHtml` dans `seoPrerender.ts`.
**Temps :** 1 heure.
**État : FAIT le 4 août 2026.** `renderFooterNav` émet le pied de page sur les trois familles de
pages pré-rendues, dans les trois langues, avec le suffixe `?lng=` propagé.

Un raffinement s'est imposé à l'écriture : **la règle du premier lien**. Google ne compte que le
premier lien d'une page vers une URL donnée, donc répéter dans le pied de page une cible déjà
présente dans le header ou le corps ne transmet rien et ne fait que gonfler le nombre de liens. Le
code du site portait déjà cette précaution dans son bloc « Ressources » des fiches ticker. Chaque
appelant passe donc la liste de ce qu'il relie déjà et seul le complément est émis : 4 liens sur une
fiche ticker, 7 sur un hub secteur, 6 sur un classement (qui s'exclut lui-même), 4 sur l'accueil.

Ajouter au pied de page pré-rendu, sur **toutes** les pages : `/screener`, `/compare`,
`/classement/*`, `/palmares`, `/pricing`, `/faq`, `/methodologie`, `/blog`.

Deux justifications distinctes. Le maillage, déjà cité. Et un signal d'alerte officiel de Google :
des pages volontairement absentes de la navigation sont un des marqueurs de pages satellites
(ch. 12). `/pricing` et `/faq` sont aujourd'hui invisibles depuis l'accueil, alors que la page
tarifs est le 11e geste du livre par rendement (les requêtes de prix ont un meilleur taux de clic
que les termes métier) et que la FAQ est le correctif anti-hallucination.

### Q5. Trancher la cannibalisation entre `/analyse/*` et `/blog/*`

**Fichiers :** `HUB_COPY` et `renderTickerHtml` pour les titres de fiche, plus la règle éditoriale
du playbook de l'agent.
**Temps :** 2 heures de décision, puis appliqué à la génération.
**État : FAIT le 4 août 2026.** La règle n'est pas seulement documentée, elle est **exécutoire** :
`scripts/check-article-titles.mjs` (check requis `title-jargon`) refuse désormais tout titre
d'article qui reprend le gabarit des fiches, dans les trois langues, avec un message qui donne
l'angle de remplacement. Le check reste en diff-only, donc les 348 articles existants ne sont pas
re-jugés et la CI ne casse pas rétroactivement.

Règle proposée, à graver :

| Intention | Propriétaire | Interdit ailleurs |
|---|---|---|
| « faut-il acheter l'action X », « X sous-évaluée », « avis action X » | `/analyse/TICKER` | Aucun article ne doit porter ce gabarit de titre ni de slug |
| « X ou Y », « X vs Y » | `/comparer/x-vs-y` | Aucun article comparant deux titres |
| « meilleures actions <critère> » | `/classement/<slug>` | Aucun article de palmarès sur un critère déjà couvert par un classement |
| Résultats trimestriels, thèse narrative, pédagogie, étude de données | `/blog/*` | Les articles ne reprennent pas le titre de la fiche |

Concrètement, un article sur Sanofi doit s'appeler « Sanofi face à sa falaise de brevets : ce que
Dupixent compense vraiment » et non « Faut-il acheter l'action Sanofi (SNY) en 2026 ? ». La règle
de décision du corpus pour savoir s'il faut une page ou deux est mécanique : ouvrir les deux
requêtes, comparer les dix résultats, **50 % de recouvrement veut dire deux contenus distincts,
80 % ou plus veut dire une seule page** (ch. 1).

À vérifier ensuite dans la Search Console : les mots-clés servis par plusieurs URL du site. Le
rapport se lit en dix minutes et c'est le geste qui a rapporté 400 % à GitHub.

### Q6. Retirer les meta descriptions générées par gabarit des 181 hubs secteur

**Fichier :** `renderHubHtml` dans `seoPrerender.ts`.
**Temps :** 15 minutes.
**État : FAIT le 4 août 2026.** Les 183 hubs n'émettent plus de `<meta name="description">`. Le
texte reste servi à Open Graph, où les réseaux sociaux le reprennent réellement tel quel : c'est
un autre usage, et c'est la même distinction que les fiches ticker appliquent déjà.

Les descriptions générées automatiquement par un gabarit sont mesurées comme **moins bonnes que pas
de description du tout** (ch. 4, claim `test`). Les fiches ticker n'en émettent déjà pas, c'est
cohérent, il reste les hubs. Garder les descriptions écrites à la main sur les pages clés : accueil,
tarifs, FAQ, méthodologie, screener, palmarès, et les deux classements existants.

### Q7. Sortir le jargon des titres de fiche

**Fichier :** `renderTickerHtml`.
**Temps :** 1 heure, plus une repasse du garde-fou CI.
**État : FAIT le 4 août 2026.** Le titre long des 5 000 fiches passe de « note de qualité 8/10,
valorisation P/FCF 51.1× » à « qualité élevée sur 10 critères, valorisation face à son
historique ». Le label de qualité reste calculé par fiche, donc le titre garde sa différenciation
sans le chiffre brut. Le mot « gratuite » est ajouté. Longueur obtenue : 220 à 224 caractères,
dans la fourchette mesurée, l'essentiel dans les 12 premiers mots.

⚠️ **Conséquence sur l'A/B en cours.** Le code sert le titre long à la moitié des tickers
(`useLongTitle`, bucket déterministe) pour comparer en Search Console. Le bras « long » a changé
le 4 août : les données d'avant et d'après ne forment pas une seule série. Le test était de toute
façon illisible, 220 impressions sur 28 jours et 5 requêtes.

Le titre actuel de MSFT contient « note de qualité 8/10 » et « valorisation P/FCF 51.1× ». Le
garde-fou `title-lint.yml` interdit déjà ce jargon sur les articles ; il faut l'étendre au
pré-rendu, sinon la règle protège 348 pages et laisse passer 5 000. Le titre doit garder ses trois
ou quatre intentions et sa longueur, en remplaçant le jargon par du langage humain : « qualité du
business notée sur 10 critères », « valorisation face à son historique », « prix d'achat conseillé ».

Le levier associé est mesuré et presque trop simple : ajouter le mot « gratuit » dans un titre a
fait passer un site de la position 7 à la position 2,5 sur un mot-clé à plusieurs millions de
recherches (ch. 4). L'analyse est gratuite, le titre ne le dit pas.

### Q8. Résumé en tête et liens sortants sur les hubs et les classements

**Fichier :** `renderHubHtml`.
**Temps :** 1 heure.
**État : FAIT le 4 août 2026.** Chaque hub porte un résumé en gras avant le tableau, calculé
depuis ses propres lignes sans requête supplémentaire, et un lien sortant pertinent (données
sectorielles de Damodaran pour les hubs secteur, ressources de la SEC pour les classements).

Exemple obtenu sur `/secteur/software-infrastructure` : « Sur les 60 actions listées ici, 4
obtiennent la note de qualité maximale. La valorisation médiane du groupe ressort à 20,1 fois son
free cash flow. Parmi celles qui ont la note maximale, la moins chère est GoDaddy (GDDY), à 8,4
fois son free cash flow. »

Deux détails qui ont demandé une décision. Le séparateur décimal suit la langue, un point dans une
phrase française est une faute qui se voit. Et un **plancher de plausibilité à 3** écarte du résumé
les multiples aberrants : PayPay ressortait à 0,1 et Afya à 1,1, tous deux cotés hors zone dollar,
soit le motif de SPEC-004. On ne promeut pas un chiffre invraisemblable en tête de page sur un site
qui parle d'argent. La ligne reste dans le tableau, et le vrai correctif est dans le pipeline de
devises.

Les fiches ont déjà les deux. Les 183 hubs n'ont ni l'un ni l'autre. Ajouter :

- **deux ou trois phrases de résumé** avant le tableau, construites depuis les données du hub
  lui-même : nombre de sociétés notées au maximum dans ce secteur, valorisation médiane du secteur,
  meilleur rapport qualité-prix du moment. +33 % de conversion mesuré, six occurrences ;
- **un lien sortant pertinent** par hub : la fiche sectorielle de Damodaran, le classement SIC/GICS
  de référence, ou la page investisseurs du leader du secteur. Quatre tests, aucun contre-exemple.

Bénéfice de bord : ce résumé chiffré est du contenu **propre à chaque hub**, calculé depuis la base.
Il fait passer les pages de gabarit du mauvais au bon côté de la ligne des 50 % de contenu unique
(ch. 2), et il est la seule réponse documentée aux désindexations de contenu généré : ajouter de la
recherche substantielle et des données uniques à du contenu désindexé permet sa réindexation
(ch. 9).

### Q9. Traduire les slugs des hubs secteur en français

**Fichier :** `slugifySector` plus une table de correspondance, plus des redirections 301.
**Temps :** 3 heures.
**État : FAIT PARTIELLEMENT le 4 août 2026, et la migration d'URL est délibérément écartée.**

Ce qui est fait : les noms de secteurs **affichés** (titre, H1, intro, ancres de liens, fil
d'Ariane) sont traduits en français pour les **30 secteurs les plus peuplés**, soit environ 54 %
des fiches. `/secteur/software-infrastructure` s'intitule maintenant « Meilleures actions de
qualité du secteur Logiciels d'infrastructure ». La version `?lng=en` garde l'anglais, qui est sa
langue d'origine. L'espagnol retombe sur l'anglais, comme avant, et reste à traiter.

Ce qui n'est pas fait, et pourquoi : **les slugs restent en anglais, donc aucune URL ne change et
aucune redirection n'est nécessaire.** Le coût réel de la traduction des 181 slugs n'est pas le
code, ce sont 181 décisions de mots-clés. Le corpus est explicite là-dessus, « ne payez pas cher la
traduction, payez l'étude des requêtes locales » : inventer 181 termes français sans vérifier ce
que les investisseurs tapent réellement produirait 181 mauvais mots-clés maquillés en optimisation.
Et le même effort rend beaucoup plus dans les collections d'intention du §6.1, qui sont nativement
françaises et visent des requêtes réelles plutôt qu'une taxonomie sectorielle importée.

Les 151 secteurs restants gardent leur libellé anglais. Une entrée absente de la table n'est pas un
bug, c'est l'état d'avancement.

`/secteur/software-infrastructure` et `/secteur/drug-manufacturers-general` sont du vocabulaire
interne anglophone sur un site francophone. Passer du vocabulaire interne au vocabulaire client a
produit **+567 % d'événements clés et +64 % de chiffre d'affaires** dans le cas mesuré, et remplacer
des catégories produit par des catégories d'intention a produit **841 % de hausse des ventes**
(ch. 1). Les slugs en langage naturel obtiennent 89,78 % de taux de citation contre 81,11 % pour les
URL opaques (ch. 14).

Impératif : redirections **301** et non 302, les 301 préservent les backlinks, les 302 non (ch. 14,
`test` `consensus`).

### Q10. Réduire le nombre de fiches déclarées indexables

**Fichiers :** la règle `noindex` posée en juillet, plus `MAX_TICKERS` dans `sitemap.ts`.
**Temps :** 2 heures d'analyse, 30 minutes de code.
**État : PALIER 1 FAIT le 4 août 2026. Palier 2 en attente du diagnostic.**

Le catalogue mesuré ce jour, ce qui corrige au passage un chiffre du §2 : il y a **6 818 fiches
scorées**, pas 5 000. Le sitemap en plafonnait 5 000, donc 1 818 fiches n'étaient même pas
advertisées.

| Mesure | Valeur |
|---|---|
| Fiches scorées | 6 818 |
| Sans aucun multiple de valorisation | 2 004 |
| Note sous 5 sur 10 | 1 932 |
| Capitalisation sous 100 M$ | 1 369 |
| Exclues par la règle de juillet | 1 228 |

**Palier 1 appliqué : une fiche sans aucun multiple de valorisation passe en `noindex, follow`**,
sauf si c'est une opportunité du moment ou si un article la traite. Le critère est de contenu, pas
de trafic : sans multiple, la fiche ne peut répondre ni « sous-évaluée ou pas », ni « à quel prix
acheter », c'est-à-dire ni à son propre titre ni à la moitié de la proposition de valeur du site.
Ce sont massivement des biotechs sans free cash flow (596 fiches dans ce secteur) et des sociétés
coquilles (238 fiches). Effet : 1 253 fiches en plus passent en `noindex`, l'index descend de 5 590
à **4 337**, et le sitemap advertise maintenant 4 337 URL au lieu de 5 000.

Un effet de bord utile : la règle existait en **deux exemplaires**, une expression TypeScript dans
`seoPrerender.ts` et une clause Prisma dans `sitemap.ts`, avec un commentaire demandant de les
garder synchrones à la main. C'était le prochain bug silencieux, celui qui advertise dans le
sitemap des URL servies en `noindex`. Il y a maintenant un prédicat unique exporté,
`shouldIndexTicker`, un test d'équivalence sur matrice exhaustive
(`sitemap.indexRule.test.ts`), et l'équivalence a été vérifiée empiriquement contre la base de
production : les deux expressions sélectionnent exactement les mêmes 4 337 tickers sur 6 818, zéro
divergence.

**Palier 2, non appliqué :** le seuil de capitalisation, qui retirerait environ 700 fiches de plus.
Il attend le diagnostic de l'effondrement des impressions (§5.1). La raison est méthodologique : le
maillage de `/screener` déployé le même jour va déclencher une vague d'exploration, et empiler une
seconde variable rendrait les deux illisibles. Le seul claim du livre qui promette de battre ses
concurrents quoi qu'on teste, c'est de tester une chose à la fois.

5 000 fiches déclarées, environ la moitié indexée. Google consacre 30 à 40 % de son budget
d'exploration à des pages sans aucun trafic organique, et certains sites atteignent 65 % (ch. 3).
Supprimer 50 % des pages à faible autorité a multiplié par 5 le trafic global d'un domaine (ch. 14).
La voie de rétablissement documentée d'un gros catalogue est une purge agressive (ch. 2).

Proposition mesurable, à appliquer par paliers et à vérifier entre chaque : ne garder en `index`
que les fiches qui remplissent au moins une condition.

1. Note de qualité disponible **et** historique de valorisation disponible (donc la fiche dit
   quelque chose que le lecteur ne trouve pas ailleurs).
2. Capitalisation supérieure à 300 M$, pour éviter les micro-capitalisations sans demande.
3. Ou bien : la fiche a reçu au moins une impression dans la Search Console sur 90 jours.

Ordre de grandeur attendu : de 5 000 à environ 1 500 fiches indexables. Les autres restent
accessibles aux humains, en `noindex, follow`, et sortent du sitemap comme le fait déjà la règle
actuelle. **Préférer la consolidation à la suppression** partout où c'est possible (ch. 14), donc ne
supprimer aucune URL : `noindex` suffit.

---

## 5. Ce que tu fais toi-même, cette semaine

Par ordre de rendement. Total : environ quatre heures.

### 5.1 Trancher l'effondrement des impressions, 30 minutes, bloquant

Dans la Search Console, propriété **domaine** (elle révèle des incidents que les propriétés par
préfixe ne voient pas, ch. 14), dans cet ordre :

1. **Sécurité et actions manuelles.** Vide ou pas. Trente secondes, et cela change tout le plan.
2. **Indexation, Pages.** Noter les effectifs de « Indexée », « Explorée, actuellement non
   indexée », « Détectée, actuellement non indexée », « Page en double sans URL canonique
   sélectionnée par l'utilisateur ». Comparer à la même vue il y a un mois si l'historique le
   permet.
3. **Performances, comparaison de périodes.** Comparer les 28 derniers jours aux 28 précédents,
   filtre par type de page (`/analyse/`, `/blog/`, `/secteur/`). La perte est-elle uniforme, ou
   concentrée sur un dossier ? Le corpus laisse ouverte la question de savoir si le filtre qualité
   opère au niveau du domaine ou de la section, mais la réponse décide de l'architecture (ch. 8).
4. **Performances, positions moyennes.** Si les impressions perdues étaient toutes au-delà de la
   position 50, c'est l'hypothèse comptable. Si elles étaient en positions 10 à 30, c'est un
   déclassement réel.

Écris la réponse dans `indexation-tracker.md` et corrige la formule « légère baisse de fenêtre
glissante » dans le playbook de l'agent : un agent qui se raconte que tout va bien ne diagnostique
rien.

### 5.2 Mesurer le taux d'indexation réel, 10 minutes

`site:lubin-investment.com` dans Google, comparer au 5 538 du sitemap. Ne pas supposer 100 % :
Amazon et eBay plafonnent à 42 % (ch. 11). Ce chiffre est le premier des quatre indicateurs du §9,
et il faut le relever à la main une fois, parce que l'API URL Inspection de l'agent a échoué
plusieurs runs de suite.

### 5.3 Vérifier ce que les modèles racontent du site, 30 minutes

Poser les six questions suivantes à ChatGPT, Claude, Perplexity et Le Chat, avec l'onglet réseau du
navigateur ouvert :

- « quel site pour trouver des actions de qualité sous-évaluées »
- « comment savoir si une action est chère par rapport à son historique »
- « meilleur screener d'actions gratuit en français »
- « Lubin Investment, c'est quoi »
- « faut-il acheter l'action Microsoft »
- « alternative à Zonebourse / Morningstar pour l'analyse fondamentale »

Deux choses à noter. Les **requêtes réellement exécutées** par le modèle, visibles seulement dans
l'onglet réseau (celles qu'il affiche ne sont pas celles qu'il exécute, ch. 7). Ce sont elles qui
pilotent la sélection, et c'est ce vocabulaire-là qui doit figurer dans les titres et les slugs.
Et **ce que le modèle dit de la marque** : s'il invente, la réponse documentée est d'enrichir la FAQ
officielle avec des démentis explicites (ch. 8, `test`).

Rien du corpus n'est mesuré en français, ce relevé est donc la seule donnée fiable disponible sur ce
marché.

### 5.4 Demander dix avis publics, 1 heure

Les avis publics pèsent plus lourd que dix articles invités positifs dans les recommandations faites
par les IA (ch. 8, `test`). Un message personnel obtient **40 à 45 % de réponse contre 5 %** pour un
envoi automatisé (ch. 11). Et une note de 4,7 à 4,9 convertit mieux qu'un 5,0 parfait.

Cibles pour ce produit : Product Hunt, Trustpilot, les fils r/vosfinances et r/EuropeFIRE déjà
suivis par l'agent, et surtout les utilisateurs du connecteur MCP, qui sont les plus engagés.
Écris-les un par un.

### 5.5 Construire l'entité, 1 heure par semaine pendant un trimestre

Une marque a besoin de **30 à 40 profils et citations indexés** pour que Google valide l'entité
(ch. 8). L'empilement de profils produit des pics de trafic mesurables **avant même toute
publication de contenu**, et les mentions de marque modifient les attributs d'entité plus vite que
les liens (ch. 7).

Liste de départ, avec **exactement la même description partout** : LinkedIn personnel et page,
Crunchbase, Product Hunt, annuaires d'outils financiers francophones, répertoire des serveurs MCP,
GitHub, X, YouTube. La cohérence de la description provoque des changements de classement du jour au
lendemain pour les petites marques (ch. 7).

Point de vigilance propre au secteur : le site touche à l'argent, donc au régime renforcé. La
réputation d'auteur est stockée et utilisée par Google, et les faux profils d'expert sont le motif
le plus surveillé (ch. 8). Une page auteur réelle, avec un vrai parcours et des liens vers les
profils ci-dessus, est un actif. Elle n'existe pas encore.

### 5.6 Répondre aux demandes de journalistes, 20 minutes par jour

70 à 76 % d'acceptation, majoritairement en dofollow, avec une fenêtre de réponse de 2 à 3 heures
(ch. 6). Sur Featured ou l'équivalent. Un fondateur qui note 5 000 sociétés sur des critères
publics a un avis chiffré à donner sur presque toute actualité boursière, et c'est la source de
backlinks au meilleur rapport temps sur résultat du livre après l'outil gratuit.

---

## 6. Les chantiers de fond

Quatre projets, dans cet ordre. Chacun s'appuie sur la donnée propriétaire, qui est le seul actif
défendable du site.

### 6.1 Les collections d'intention, le chantier numéro un

**Ce que c'est :** de nouvelles pages `/classement/<slug>`, sur le même moteur que les deux
existantes. Ajouter une collection coûte une entrée dans `HUB_COPY` et une clause Prisma, donc
quelques heures pour la première et une heure pour les suivantes.

**État : PREMIÈRE VAGUE DE 15 LIVRÉE le 4 août 2026.** Le routeur `/classement/:slug` n'est plus
une chaîne de `if` sur deux slugs mais un **registre** `CLASSEMENTS` : une entrée porte son filtre
Prisma, son nombre de lignes et sa copie trilingue. Ajouter une collection est désormais une entrée,
et la route, le sitemap, le maillage depuis `/screener` et le fil d'Ariane se branchent tout seuls.
Le sitemap des hubs passe de 202 à **217 URL**.

Les 17 collections en ligne (les 2 anciennes plus les 15 nouvelles), avec leur nombre de lignes
réel : PEA 100, françaises 60, européennes sous-évaluées 100, à acheter maintenant 100, qualité pas
chères 100, small caps 100, grandes capitalisations 100, technologiques 100, technologiques
sous-évaluées 100, santé 100, financières 100, industrielles 100, consommation 91, britanniques 100,
japonaises 57, notées 10 sur 10 (85) et sous-évaluées (73).

**Trois choses mesurées avant d'écrire une ligne de copie**, et elles ont changé le plan.

1. **Deux collections du plan initial étaient impossibles.** « Grandes valeurs sous-évaluées »
   retourne **0 ligne** (aucune méga-capitalisation n'est marquée opportunité), et « résistantes à
   l'IA » **4 lignes**, la table `ResilienceStarScore` n'étant remplie que sur 4 tickers. Elles sont
   retirées, pas livrées vides.
2. **`pfcfPercentile` n'est renseigné que sur 567 fiches sur 4 814**, soit 12 %, parce qu'il demande
   un historique de valorisation. Toute collection bâtie sur le percentile est donc structurellement
   maigre : « européennes sous-évaluées » sur le percentile ne sortait **qu'une seule ligne**. Les
   collections de valorisation utilisent donc un **seuil absolu de multiple**. C'est le piège de
   donnée le plus utile trouvé aujourd'hui.
3. **Aucune paire de collections ne partage plus de 70 % de ses tickers.** Vérifié
   programmatiquement sur les 25 candidates avant de choisir les 15. C'est la garantie qui manque
   aux gabarits sanctionnés, et elle se re-teste en une commande à chaque ajout.

**Révision d'une consigne que j'avais écrite.** Le plan disait « publier deux collections par
semaine au maximum, jamais un lot ». J'en livre 15 d'un coup, et c'est délibéré : le seul motif
programmatique validé par une expérience contrôlée du corpus est précisément un lot de **15 à 20
pages**, classé en première page en trois semaines. Le seuil de détection porte sur plus de 100
pages en dix secondes. Ma consigne initiale était une lecture trop prudente, et elle contredisait le
test que je citais par ailleurs.

**Pourquoi :** remplacer des catégories produit par des catégories d'intention a produit **841 % de
hausse des ventes**, et découper un mot-clé concurrentiel en collections de longue traîne classe
plus vite et rapporte plus tôt que viser le terme principal (ch. 1, `test` `consensus`). Les 181
hubs secteur sont des catégories produit, c'est-à-dire une taxonomie sectorielle anglophone
importée. Les collections d'intention sont la façon dont un investisseur francophone formule son
besoin.

**Les vingt premières, par ordre de valeur estimée.** Toutes constructibles avec les champs
existants (`exchange`, `region`, `marketCapUsd`, `sector`, `pfcfPercentile`, `opportunity`,
`scoreRatio`) et la table `ResilienceStarScore`.

| Slug | Requête visée | Filtre |
|---|---|---|
| `actions-pea-eligibles-de-qualite` | actions PEA de qualité | region UE, note haute |
| `actions-europeennes-sous-evaluees` | actions européennes sous-évaluées | region UE, `opportunity` |
| `actions-francaises-qualite` | meilleures actions françaises | exchange Paris |
| `meilleures-actions-a-acheter-maintenant` | quelles actions acheter maintenant | note maximale + `opportunity` |
| `actions-resistantes-a-l-ia` | entreprises que l'IA ne peut pas remplacer | résilience 4,5 étoiles et plus |
| `actions-qualite-moins-de-20-fois-son-cash` | actions pas chères de qualité | note haute, valorisation basse |
| `small-caps-de-qualite` | meilleures small caps | capitalisation sous 2 Md$ |
| `mega-caps-sous-evaluees` | grandes valeurs sous-évaluées | capitalisation au-dessus de 200 Md$, `opportunity` |
| `actions-a-fort-rendement-du-capital` | entreprises très rentables | ROCE élevé |
| `actions-peu-endettees` | actions sans dette | dette sur EBITDA basse |
| `actions-qui-rachetent-leurs-actions` | entreprises qui font des rachats | critère rachats |
| `actions-defensives-de-qualite` | actions défensives | secteurs défensifs, note haute |
| `actions-technologiques-sous-evaluees` | tech pas chère | secteur tech, `opportunity` |
| `actions-sante-de-qualite` | meilleures actions santé | secteur santé |
| `actions-bancaires-de-qualite` | meilleures actions bancaires | secteur finance |
| `actions-industrielles-sous-evaluees` | industrielles décotées | secteur industrie, `opportunity` |
| `actions-de-luxe-de-qualite` | actions du luxe | secteur consommation discrétionnaire européenne |
| `actions-a-moat-large` | entreprises avec un avantage durable | résilience haute et note haute |
| `actions-japonaises-de-qualite` | actions japonaises | exchange Tokyo |
| `actions-americaines-sous-evaluees` | actions américaines décotées | region US, `opportunity` |

Chaque collection doit porter : un titre long multi-intention, un résumé de trois phrases avant le
tableau, un lien sortant pertinent, le tableau des 60 à 100 sociétés avec ancres descriptives, et un
paragraphe **propre à la collection** expliquant le critère et ses limites. Sans ce paragraphe
spécifique, vingt collections issues du même gabarit retombent dans le motif de cluster que Google
supprime en bloc (ch. 9).

**Deux garde-fous.** Publier **deux collections par semaine au maximum**, jamais un lot : plus de
100 pages en dix secondes déclenche l'heuristique de détection, et tester une ou deux pages avant de
passer à l'échelle est le protocole explicitement recommandé (ch. 2). Et ne créer une collection que
si elle change vraiment la liste : deux collections dont le tableau est identique à 80 % sont une
cannibalisation, pas une couverture.

### 6.2 L'actif de liens : la page de chiffres du marché

**Ce que c'est :** une page unique, maintenue, du type « Les chiffres de la qualité en bourse,
édition 2026 », construite sur les 5 000 notations du site. Combien de sociétés obtiennent la note
maximale, dans quels secteurs, quelle valorisation médiane par secteur, quelle proportion de
sociétés rentables, comment la note se répartit par taille de capitalisation, quelle part du marché
est actuellement sous sa valorisation médiane historique.

**Pourquoi :** les pages de statistiques et de faits accumulent des liens sans promotion, 9 à 10
domaines référents en 2 à 3 mois, et continuent au-delà d'un an ; une compilation sectorielle a
atteint **726 domaines référents** sur un seul article ; un reportage original a fait passer un site
de 800 à **6 000 domaines référents** (ch. 13). Les contenus contenant des données originales
génèrent plus de backlinks que les campagnes de démarchage classiques (ch. 9).

L'agent produit déjà deux études de données par semaine, sous forme d'articles de blog. La
différence est structurelle : un article est un flux, une page de chiffres maintenue est un actif.
Le premier vieillit, la seconde accumule. Une observation du corpus le confirme : l'âge médian des
pages citées par les IA est de **500 jours**, et à l'intérieur d'un même jeu de résultats, les pages
anciennes et établies sont citées plus souvent que les nouvelles (ch. 11).

**Règle de fraîcheur :** mettre à jour cette page **sélectivement** et vraiment, avec un vrai
changement de contenu. Les sites qui mettent à jour la date de publication de tous leurs articles
subissent des baisses de classement par rapport à ceux qui le font sélectivement (ch. 15).

### 6.3 Le calculateur public, l'outil gratuit

**Ce que c'est :** une page publique, sans compte, qui répond à une question précise et
transactionnelle. Le meilleur candidat pour ce site : **« À quel prix acheter cette action ? »**
Saisir un ticker, obtenir le prix d'achat cible calculé par le modèle, la valorisation actuelle
comparée à son historique, et le verdict. C'est déjà ce que fait `/analyser`, mais ce n'est ni
présenté comme un outil, ni indexable, ni citable.

**Pourquoi :** c'est la tactique au meilleur rendement documenté du livre. Un minuteur de deux
minutes a produit **384 000 liens de 7 100 domaines**, un calculateur de sommeil 35 000 liens de
4 500 domaines, un générateur de palette 8 100 liens de 2 200 domaines (ch. 6). Et un site qui
offre une valeur transactionnelle résiste mieux aux mises à jour qu'un éditeur pur (ch. 14). Enfin,
retirer l'obligation de créer un compte pour tester un produit a augmenté l'engagement et les
classements sans changer ni contenu ni liens (ch. 14, `test`).

À vérifier avant tout : que rien d'utile ne soit derrière une inscription.

### 6.4 Le rééquilibrage éditorial du blog

**Ce que c'est :** faire passer le blog de 3 ou 4 articles par jour à 2 par semaine, et réaffecter
la capacité libérée à trois choses : les collections d'intention, la page de chiffres, et la reprise
sélective des articles existants.

**Pourquoi, en trois mesures.** Google normalise une vitesse de publication anormalement élevée ;
publier davantage dilue les signaux d'engagement moyens du site, ce qui pénalise même les bons
articles ; et un site publiant un article par semaine a atteint 130 000 visites mensuelles en moins
de deux ans (ch. 2, 13). À mettre en regard du résultat obtenu : 348 articles, 15 clics sur 28
jours. Le rendement marginal d'un article supplémentaire est actuellement indiscernable de zéro, et
son coût de risque n'est pas nul.

**Ce qu'on arrête en premier :** le filet obligatoire de couverture des résultats trimestriels de
méga-capitalisations, 62 articles sur 348. C'est du haut de tunnel en concurrence frontale avec
Reuters, Bloomberg et Zonebourse, dont les signaux de fraîcheur ne bénéficient qu'aux requêtes
contenant une année (ch. 11), et dont la durée de vie utile se compte en semaines. La règle de
remplacement : ne couvrir des résultats trimestriels **que** quand ils changent la note ou le
verdict du site sur la société. Là, l'article dit quelque chose que personne d'autre ne peut dire.

**Ce qu'on garde et qu'on augmente :** les études de données, les articles de méthode, et les
thèses sur des sociétés que personne ne couvre. Le contenu réel et spécifique sur des expériences
vécues dépasse les conseils génériques, et Google dit préférer l'analyse approfondie aux listes de
commodité (ch. 13).

**Consolidation :** repasser sur les 348 articles et fusionner ceux qui se recouvrent. Consolider
des pages quasi dupliquées en une seule page complète améliore les classements (ch. 14), et c'est la
version prudente du geste de purge. Cible réaliste : de 348 à environ 250 articles, dont 30
substantiellement enrichis.

### 6.5 La ligne éditoriale, arbitrée le 4 août 2026

Elle découle directement du §2.2 bis et elle remplace le §6.4.

**Cadence : 4 à 5 articles par semaine, plus 3 par jour.** 338 articles publiés en deux mois ont
produit 15 clics sur 28 jours. Le rendement marginal d'un article de plus est indiscernable de
zéro. Le repère du corpus : un site publiant un article par semaine a atteint 130 000 visites
mensuelles en moins de deux ans.

**Six archétypes, par ordre de priorité.**

| # | Archétype | Ce que c'est | Pourquoi |
|---|---|---|---|
| 1 | `classement-intention` | « Meilleures actions PEA sous-évaluées », « actions résilientes à l'IA » | 841 % de hausse des ventes mesurés en passant de catégories produit à catégories d'intention |
| 2 | `palmares-secteur` | Analyse approfondie d'un secteur ou d'un pays | L'actif de backlinks, et l'autorité est le vrai goulot |
| 3 | `pedago-methode` | Une notion expliquée avec nos données | Evergreen, et personne d'autre n'a nos chiffres |
| 4 | `comparatif-duo` | « X ou Y » | Seul motif programmatique validé par un test du corpus |
| 5 | `actu-earnings` | Filet de complétude mega-cap | Capte le grounding des modèles, pas le trafic. Plafonné |
| 6 | `these-action` | Mono-ticker | **Quasi gelé** : la fiche répond déjà à la même requête |

Répartition cible sur cinq articles : deux classements ou secteurs dont au moins une étude de
données, un pédago, un comparatif, un libre.

**La règle qui évite de se tromper de support.** Un classement qui n'est qu'un tableau doit devenir
une page `/classement/<slug>`, evergreen et auto-mise à jour depuis la base, pas un article daté.
Un ARTICLE de classement n'existe que s'il porte ce que le tableau ne peut pas porter : pourquoi
ces sociétés, ce qui les sépare, ce qui casserait la thèse. Les deux couches se complètent, la page
produit capte la requête, l'article construit l'autorité et les liens.

**Ce que le cas Micron ne dit pas.** Les recaps d'earnings ne sont pas inutiles, ils captent
massivement le grounding des modèles. Ils sont inutiles **en trafic**. On les garde comme filet de
complétude sur les mega-caps, on ne les compte pas comme croissance, et on ne fait jamais de
preview avant résultats.

**Câblé le 4 août** dans `vault/projects/li-seo/config.yaml` (`max_publish_per_week: 5`,
`max_publish_per_run: 1`, `weekly_mix`, `these_action.max_per_week: 1`,
`require_angle_absent_from_fiche`) et en tête de la section blog de `operator-playbook.md`.

### 6.6 Le nettoyage du blog, fait le 4 août 2026

**10 vrais doublons consolidés.** Sur les 24 tickers portant deux articles, seuls 10 étaient de
vrais doublons : une **preview avant résultats** plus le **recap post-résultats** du même
trimestre. Les 12 autres sont un recap plus une thèse, donc deux intentions distinctes, et les 2
derniers sont deux trimestres différents. La preview est redirigée en 301 vers le recap et retirée
du tableau `ARTICLES`. Le blog passe de 348 à **338 articles**. La première de la liste est
`micron-mu-avant-resultats-24-juin-2026`, celle des 4 207 impressions sans clic.

**Correction de ma propre formulation :** j'avais écrit « consolider les 24 doublons ». C'était
faux, et exécuter tel quel aurait fusionné des articles qui ne se recouvrent pas. Le chiffre juste
est 10.

**Les titres qui dupliquaient la fiche : FAIT le 4 août 2026.** 83 articles au total, dans les trois
langues, ne portent plus le gabarit de la fiche. Vérifié après coup sur les 338 articles : **zéro
titre** reprenant « Faut-il acheter l'action X », « Should you buy X », « X est-elle sous-évaluée »
ou leurs équivalents espagnols, et zéro jargon.

**La méthode, et c'est ce qui compte.** Aucun titre n'a été généré au gabarit. Chaque nouveau titre
vient de l'**angle déjà présent dans l'article**, le plus souvent de son premier ou deuxième H2, qui
était déjà écrit pour accrocher : « Un marché que tout le monde a fui, sauf eux » devient
« Universal (UVE) : le marché que tous ont fui, sauf eux », « Le modèle que presque personne ne
comprend vraiment » devient « Roper (ROP) : le modèle que presque personne ne comprend ». C'est la
seule façon de retitrer 83 articles sans recréer le motif de gabarit répété que Google sanctionne.

Format imposé respecté partout : `Nom (TICKER) : angle`, deux-points comme séparateur, jamais de
tiret, 60 caractères au plus, apostrophe droite.

**Deux surprises pendant le travail.**

- Mon extraction initiale filtrait sur le titre **français** et annonçait 78 articles. Il en restait
  **9 de plus** qui ne portaient le gabarit qu'en anglais ou en espagnol, dont un comparatif
  légitime (« T-Mobile or Verizon: Which Stock Should You Buy? ») que le check CI aurait bloqué à
  tort. Total réel : 83.
- 29 des 83 n'ont pas été modifiés au premier passage : le fichier mélange trois styles de clés
  (`fr:`, `"fr":`, `'fr':`), exactement l'angle mort que le playbook de l'agent documente comme
  cause racine des doublons. Le second passage tolère les trois.

Les deux copies du fichier d'articles restent synchronisées : 1 044 titres identiques de part et
d'autre, vérifié.

---

## 7. Le plan à 90 jours

Rythme prévu : deux à quatre heures par semaine de ton temps, plus les runs de l'agent.

### Semaine 1, diagnostiquer et déboucher

- §5.1 : trancher l'effondrement des impressions. Bloquant.
- §5.2 : taux d'indexation réel à la main.
- Q1 version minimale : ajouter les robots manquants à `vercel.json`, plus le test de
  non-régression.
- **Gel de la publication d'articles pendant sept jours.** Non pas comme une punition, comme une
  variable isolée : changer une chose à la fois et regarder ce qui se passe est le seul claim du
  livre qui dise « faites ceci et vous ferez mieux que vos concurrents, quels que soient les tests
  réalisés » (ch. 11).

### Semaines 2 et 3, réparer le maillage

- Q2, Q3, Q4 : hubs `/screener` et `/compare`, pied de page complet.
- Q6 : retrait des descriptions de gabarit.
- Q8 : résumé et lien sortant sur les 183 hubs.
- Relevé attendu à J+7 après déploiement : les hubs secteur et les pages de comparaison doivent
  apparaître dans les impressions. Le délai mesuré est de **6 à 7 jours** après ajout de liens
  internes (ch. 5).

### Semaines 4 à 6, trancher les intentions

- Q5 : règle du propriétaire par intention, appliquée aux titres de fiche et au playbook.
- Q7 : jargon hors des titres, garde-fou CI étendu au pré-rendu.
- Premières **quatre collections d'intention**, à deux par semaine : PEA, européennes
  sous-évaluées, à acheter maintenant, résistantes à l'IA.
- Reprise du blog à **deux articles par semaine**, dont une étude de données.

### Semaines 7 à 10, construire l'autorité et l'entité

- §5.4 à §5.6 : avis, 30 à 40 profils, demandes de journalistes.
- La page de chiffres du marché (§6.2), publiée et annoncée.
- Deux ou trois podcasts francophones sur l'investissement. Environ **30 backlinks en 3 mois**,
  `test` avec trois corroborations (ch. 6).
- Quatre collections d'intention de plus.
- Un communiqué de presse à l'amorçage, en sachant qu'il tiendra **6 à 8 mois** et pas plus : c'est
  un flux, pas un actif (ch. 7, 15).

### Semaines 11 à 13, itérer sur les données

- Trois filtres Search Console, dans cet ordre : positions 3 à 20 sur 28 jours, pages à fortes
  impressions et faible taux de clic, mots-clés servis par plusieurs URL. Ces trois listes sont le
  plan du trimestre suivant, et elles se régénèrent seules (ch. 11).
- Q10 : réduction du nombre de fiches indexables, par paliers, avec relevé entre chaque.
- Consolidation du blog (§6.4).
- Q1 version complète : pré-rendu par défaut pour tout le monde.

---

## 8. Ce qu'on change dans l'agent SEO

L'agent de `vault/projects/li-seo/` fait déjà bien la mesure, la QA et la production. Ce qu'il fait
mal, c'est **l'arbitrage** : il a un plafond de production et pas de garde-fou de rendement, donc il
publie parce qu'il peut, et il qualifie une division par 36 de « légère baisse ».

Modifications à porter dans `config.yaml` et `operator-playbook.md` :

| Réglage | Aujourd'hui | Proposé | Raison |
|---|---|---|---|
| `blog.max_publish_per_run` | 3 | **1**, et 0 par défaut hors étude de données | Rendement marginal nul mesuré, dilution des signaux d'engagement (ch. 2) |
| `blog.proposals_per_day` | 3 | 2 | Aligné sur le plafond |
| Filet méga-cap earnings obligatoire | Règle dure | **Supprimé**, remplacé par « seulement si la note ou le verdict change » | Haut de tunnel, durée de vie en semaines (ch. 1, 11) |
| `data_studies_per_week` | 2 | 2, maintenu | Seul format qui construit l'autorité (ch. 13) |
| Nouvelle règle | absente | **1 collection d'intention par semaine, 2 au maximum** | 841 % mesuré, et plafond anti-motif (ch. 1, 2) |
| Nouvelle règle | absente | **Interdiction du gabarit de titre « Faut-il acheter l'action X »** pour les articles | Cannibalisation avec les fiches (ch. 5) |
| Nouvelle alerte | absente | **Alerte si les impressions 28 jours baissent de plus de 25 % sur 7 jours** | Le run a manqué un moins 97 % pendant quatorze jours |
| Nouvelle alerte | absente | **Vérification quotidienne du pré-rendu sur 3 URL avec `OAI-SearchBot`** | Panne silencieuse par construction |
| Nouveau relevé | absent | **Volume de recherche sur « lubin investment »** dans la Search Console | Troisième indicateur du §9, et voie de rétablissement documentée (ch. 11) |
| `qa.max_pages` | 30 | 30, maintenu | Suffisant |

Une phrase à graver dans le playbook, prise du livre : **une page doit exister parce qu'on a quelque
chose à dire, pas parce qu'on veut classer un mot-clé** (ch. 2). L'agent doit pouvoir rendre un run
avec zéro publication et considérer que c'est un bon run.

---

## 9. Les quatre indicateurs, et ceux à ignorer

### À suivre

1. **Taux d'indexation réel.** Pages indexées divisées par pages déclarées. Aujourd'hui autour de
   50 % sur des échantillons de 100 URL, à confirmer à la main. Si Amazon plafonne à 42 %,
   l'hypothèse de 100 % est fausse par construction (ch. 11).
2. **Nombre de mots-clés en positions 3 à 20.** C'est le réservoir de progression à effort quasi
   nul, et le seul travail d'optimisation que le corpus décrit comme rentable. Aujourd'hui : zéro
   candidat, ce qui est le symptôme le plus clair du problème d'indexation.
3. **Volume de recherches sur la marque.** Le corpus en fait un signal de qualité du site, note
   qu'une croissance des liens sans croissance de la marque est un symptôme de problème, et
   documente un site remonté de 1 000 à 300 000 clics mensuels par un investissement sur la
   recherche de marque (ch. 11).
4. **Conversions, pas trafic.** Le canal IA fait moins de 1 % des visites et convertit jusqu'à 21
   fois mieux. Un tableau de bord centré sur les visites ferait prendre la mauvaise décision
   (ch. 11).

### À ignorer

- Le score d'autorité de domaine des outils tiers. Il ne corrèle avec aucune mesure de qualité chez
  Google, qui corrèle en revanche avec le volume de recherches de marque (ch. 6).
- Les impressions au-delà de la position 50, en partie générées par des robots (ch. 11).
- Le rapport Liens de la Search Console, cassé pendant une mise à jour de mai 2026, plusieurs sites
  ayant perdu des centaines de milliers de liens déclarés sans conséquence (ch. 6, 11).
- Les positions hautes sans clic. Ce sont probablement des modèles en train de lire le site, pas un
  échec de titre, et « corriger » ces pages casserait ce qui marche (ch. 11).
- Les Core Web Vitals. Un site passé de 40 secondes à 1,68 seconde n'a eu **aucun changement** de
  trafic (ch. 14).

---

## 10. Les éléments à surveiller

Ce sont les risques propres à ce site, pas une liste générique. Chacun avec son signal de détection.

| Risque | Pourquoi il concerne ce site | Signal à surveiller | Fréquence |
|---|---|---|---|
| **Panne silencieuse du pré-rendu** | Liste d'autorisation par agent utilisateur : un nouveau robot, une regex modifiée, et une famille entière de moteurs voit une page vide. Ce n'est visible dans aucun rapport | `curl -A OAI-SearchBot` sur 3 URL, taille et présence du H1 | Quotidien, automatisé |
| **Action manuelle pour contenu à l'échelle** | 5 000 pages de gabarit plus 348 articles publiés à 3 ou 4 par jour, dans la finance. Google interdit explicitement la génération massive pour des volumes de 100 à plus de 1 000 pages, et le délai de rétablissement est de 2 à 3 ans (ch. 12) | Search Console, Sécurité et actions manuelles | Hebdomadaire |
| **Désindexation algorithmique** | Google désindexe en masse depuis mai 2026 du contenu identifié comme généré par IA (ch. 3) | Rapport Indexation, bascule vers « Explorée, actuellement non indexée » | Hebdomadaire |
| **Motif de pages satellites sur la forme des URL** | Un dossier unique avec des milliers de slugs qui ne diffèrent que par un jeton ressemble à un réseau de pages satellites, **indépendamment de la qualité du contenu** (ch. 12). `/analyse/<5000>` et `/blog/<ticker>-faut-il-acheter-2026` sont tous deux dans ce cas | Part de contenu réellement unique par page du gabarit, seuil de 50 % (ch. 2) | À chaque évolution du gabarit |
| **Cannibalisation** | Deux familles de pages sur la même requête, par construction | Search Console, mots-clés servis par plusieurs URL | Mensuel |
| **Régime YMYL** | Le site parle d'argent. Les sites de finance subissent une volatilité nettement plus forte à chaque mise à jour, `data` `consensus` (ch. 8). La catégorisation s'applique **par requête et par formulation**, pas par secteur, donc elle est concentrable | Volatilité des positions autour des dates de core update | À chaque mise à jour annoncée |
| **Déséquilibre éditorial** | La variable qui sépare moins 53 % de moins 97,6 % dans le cas ClickUp contre Zapier. Un site qui note des sociétés et vend un abonnement doit rester capable de dire « ne l'achetez pas » et de mal noter ce qu'il met en avant | Les articles et fiches disent-ils du mal quand c'est justifié ? Relire cinq pages au hasard | Trimestriel |
| **Fausses réclamations de droit d'auteur** | Multipliées par 100 en 12 mois, de 2 à 200 par jour, traitées par Google **sans vérifier** l'identité du plaignant, retrait de plusieurs semaines à plusieurs mois (ch. 12). Un site d'analyse financière qui cite des chiffres publics est une cible facile | Chute brutale et isolée d'une URL. Connaître la procédure de contre-notification **avant** d'en avoir besoin : les pages reviennent en quelques heures à quelques semaines après dépôt | À la demande |
| **Empoisonnement des réponses des modèles** | Les requêtes de niche à faible volume sont plus faciles à manipuler que les requêtes à fort enjeu, et une fausse liste d'experts classée dans Google a conduit des modèles à recommander des gens qui niaient toute expertise (ch. 12) | Les six questions du §5.3, relevées tous les mois. Défense documentée : la FAQ officielle avec démentis explicites | Mensuel |
| **Les variantes `?lng=`** | Environ 11 000 URL supplémentaires créées par un paramètre de requête. Le corpus mesure qu'ajouter des paramètres créant des milliers d'URL a fait chuter des classements du jour au lendemain **même avec canonique correcte** (ch. 14, `test`). Ici la canonique est auto-référente et hreflang est complet, donc la configuration est légitime, mais le volume mérite un œil. Le corpus ne dit **rien** sur le choix sous-dossier contre paramètre pour le multilingue, c'est son plus gros trou opérationnel | Part des URL `?lng=` dans le rapport d'exploration | Trimestriel |
| **Sous-domaines et redirections oubliées** | Les sous-domaines sont traités comme des sites séparés avec des scores de qualité distincts, et une redirection abandonnée peut être détournée pour injecter du spam qui affecte le site d'origine (ch. 12, 14) | Inventaire des sous-domaines et des redirections actives | Trimestriel |
| **Fraîcheur simulée** | `lastScoredAt` a déjà été corrigé pour ne bouger qu'en cas de vrai changement de fondamentaux. C'est exactement la bonne décision et il faut la défendre : mettre à jour les dates en masse est mesuré comme contre-productif (ch. 15) | Toute PR qui touche `lastScoredAt` ou `lastmod` | À chaque PR |

---

## 11. Ce qu'on ne fait pas, et ce que ça économise

Chaque ligne est du temps ou du budget rendu, adossée à des mesures.

| À ne pas faire | Pourquoi | Ch. |
|---|---|---|
| Ajouter du balisage schema en attendant du classement | Quatre tests indépendants, effet nul. Aucun effet non plus sur la citation par les IA (+2,4 % et +2,2 %, indiscernables de zéro). Ce qui est en place ne nuit pas et n'a pas besoin d'être retiré, mais un balisage **cassé** nuit : c'est la seule chose à vérifier | 7, 14 |
| Créer un fichier `llms.txt` | Aucun robot d'IA ne le demande. 10 requêtes sur 1 000 domaines observés, et Google confirme ne pas s'en servir | 7, 14 |
| Optimiser les Core Web Vitals pour le référencement | 40 secondes ramenées à 1,68 seconde : aucun changement de trafic. Ce qui compte est la mise en page, pas la vitesse | 14 |
| Payer un outil « GEO » ou de suivi de position | La visibilité dans les modèles s'obtient par du SEO classique, le corpus le dit deux fois. Épuiser la Search Console d'abord | 7, 11, 15 |
| Acheter des liens ou faire du guest posting de masse | Plus de 400 publications en 2 ans entraînent des sanctions. Le prix de marché d'un backlink de qualité, 58,95 dollars, sert à reconnaître une offre commerciale, pas à passer commande | 6 |
| Utiliser l'outil de désaveu | Inutile hors action manuelle avérée, parfois nuisible. 39 % des praticiens seulement l'utilisent encore | 6, 12 |
| Acheter des services d'indexation | Aucun outil ne peut forcer Google à indexer, seulement à explorer. Certains violent les consignes et nuisent au site | 3, 12 |
| Acheter des domaines expirés | N'héritent plus et ne transmettent plus d'autorité, même contenu recréé | 12 |
| Chercher une IP dédiée | Trois mesures lui donnent l'avantage, mais ce n'est pas disponible sur Vercel. Point noté et classé non actionnable, plutôt que laissé en suspens | 14 |
| Viser Google Discover | Les titres optimisés pour les mots-clés rendent les articles **invisibles** sur Discover, et les titres émotionnels qui y marchent cassent le référencement. Le corpus ne propose aucune solution intermédiaire. On assume la recherche et on ignore Discover | 4, 15 |
| Produire de la vidéo dans le seul but d'être cité par une IA | Deux mesures sérieuses divergent d'un facteur 30 sur la part de YouTube dans les citations. La vidéo garde sa valeur propre, l'argument « pour être cité » n'est pas solide | 7 |
| Publier un classement où le site se met premier | Suppression de la liste des citations IA dans environ 80 % des cas, déprioritisation explicite par Claude, et Google affiche désormais un avertissement. Un comparatif honnête est légitime, un palmarès auto-promotionnel non | 7, 12 |
| Écrire des articles longs par principe | Une page de vente efficace fait 415 mots en moyenne. La variable est la concurrence de la page de résultats, pas la longueur. Et le moteur sémantique de Chrome plafonne à 30 passages de 200 mots, soit environ 6 000 mots traités | 13, 14 |
| Mettre du texte en accordéon | Le texte entièrement visible reçoit 12 % de sessions organiques en plus. Vaut pour les FAQ des fiches | 13 |
| Mettre à jour toutes les dates | Mesuré comme contre-productif quand c'est fait en masse. Rafraîchir sélectivement, autour de deux ans d'ancienneté | 15 |
| Créer des pages par ville ou par pays de résidence | 80 % des classements perdus en 30 jours dans le cas mesuré, et Google désindexe en masse ce motif depuis mai 2026 | 10, 12 |
| Faire confiance aux volumes de recherche | Ils sous-estiment le trafic réel d'un facteur 20, et des mots-clés affichés à zéro rapportent plus de 300 clics par mois. Ni pour renoncer à un mot-clé, ni pour en choisir un | 11 |

---

## 12. Les trois erreurs qui tueraient le site

**1. Continuer de publier au rythme actuel en espérant que le volume finisse par payer.** Le corpus
documente le motif : montée rapide puis effondrement. Un site passé de 700 à 62 000 pages d'un coup,
un autre de 4 900 à 130 000 clics mensuels avant une sanction manuelle. Ici, 5 538 URL pour 220
impressions : la moitié du motif est déjà là, il manque la sanction.

**2. Rendre les pages plus commerciales après la baisse.** C'est l'erreur exacte de ClickUp :
après la première chute, l'entreprise a rendu ses pages **plus** promotionnelles, et le trafic est
passé de 492 000 à 29 000. La variable qui sépare moins 53 % de moins 97,6 % est le déséquilibre
éditorial en faveur de son propre produit, pas le fait de vendre.

**3. Sortir du sujet pour aller chercher du volume.** HubSpot est passé de 24 à 3,6 millions de
clics mensuels après avoir ciblé des mots-clés sans rapport avec son métier, et ajouter 3 millions
de pages d'offres d'emploi à un site spécialisé sur les CV a fait baisser les classements du domaine
d'origine **sans qu'aucune page d'origine ne soit modifiée**. Pour ce site, la tentation s'appelle
crypto, fiscalité, immobilier, actualité macro. Le sujet est l'analyse fondamentale d'actions.

---

## 13. Ce que le corpus ne dit pas, et où on avance à l'aveugle

À savoir avant de prendre les chiffres de ce plan pour des certitudes.

- **Rien n'est mesuré en français.** Tous les pourcentages de résumés IA, de zéro clic et de
  citation viennent de l'anglais. C'est la limite la plus structurante ici, et le relevé du §5.3 est
  la seule façon d'y voir clair sur ce marché.
- **Rien sur le choix sous-dossier, sous-domaine ou paramètre pour le multilingue**, ni sur
  `hreflang`. C'est le plus gros trou opérationnel du livre, et le site a fait un choix (`?lng=`)
  sur lequel le corpus est muet.
- **Aucune mesure sur les petits sites.** Tous les cas chiffrés portent sur des sites qui avaient
  déjà du trafic à perdre. Les seuils de détection cités au chapitre 2 sont des jugements de
  praticiens, pas des expériences.
- **Rien ne dit si les 2 % de requêtes transactionnelles d'un secteur sensible comme la finance se
  comportent comme celles du logiciel**, où sont mesurés presque tous les cas.
- **Aucun claim ne dit à quel point deux pages d'un même gabarit doivent différer** pour sortir du
  motif de cluster. Le seuil de 50 % est un ordre de grandeur, pas une mesure. C'est la question
  d'ingénierie ouverte, et c'est précisément celle qui décide du sort des 5 000 fiches.
- **Quatre contradictions non résolues** : le nofollow transmet-il quelque chose, la part réelle de
  YouTube dans les citations, le filtre qualité opère-t-il au niveau du domaine ou de la section, et
  les clics sont-ils un facteur de classement.

En cas de doute sur un point non couvert, la meilleure réponse du corpus est son claim de méthode :
**les éditeurs qui mettent en place une méthodologie de test surpassent systématiquement ceux qui
n'en font pas, quels que soient les tests réalisés** (ch. 11). Une chose à la fois, et on note le
résultat.

---

## Références

- `masterclass-seo` : `/Users/lubin.danilo/seo-corpus/buildinpublic/book/masterclass-seo.md`,
  et l'annexe B cas 2 qui décrit exactement ce profil de site.
- Analyses détaillées par chapitre :
  `/Users/lubin.danilo/seo-corpus/buildinpublic/book/par-chapitre/`.
- Agent SEO quotidien : `vault/projects/li-seo/` (playbook, `config.yaml`, rapports, état).
- Suivi d'indexation et série d'impressions : `vault/projects/li-seo/state/indexation-tracker.md`.
- Plan équivalent pour l'autre projet, pour comparaison de méthode :
  `vault/projects/mibba-seo/PLAN.md`.
- Code concerné : `vercel.json` (liste d'autorisation des robots),
  `apps/api/src/routes/seoPrerender.ts` (pré-rendu, hubs, pages statiques),
  `apps/api/src/routes/sitemap.ts` (sitemaps), `apps/web/public/robots.txt`,
  `.github/workflows/title-lint.yml` et `content-lint.yml` (garde-fous éditoriaux).
