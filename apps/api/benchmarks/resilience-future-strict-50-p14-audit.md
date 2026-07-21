# Audit du benchmark strict 50 - pilot.14

## Protocole

- Scenario fixe : 2033, IA et agents largement adoptes, automatisation avancee,
  progression chinoise en ingenierie et compression des interfaces reproductibles.
- Attentes figees avant generation dans le commit `583a23a`.
- Un seul modele canonique, un dossier `2.8.13` fige par entreprise, sans recherche web
  pendant l'adjudication et sans consensus multi-modeles.
- Vingt resultats approuves ont ete precharges ; trente adjudications nouvelles ont ete
  lancees. Chegg a ete repris une fois apres une reponse non JSON.
- Les 50 sorties sont datees dans le fichier de resultats et persistees dans
  `ResilienceAnalysis` et `ResilienceAnalysisHistory`.

## Resultat brut

- `30/50` dans la bande attendue (`60%`).
- `26/33` attentes approuvees dans la bande (`78,8%`).
- `4/17` attentes provisoires dans la bande.
- Deux ecarts de deux grades : Broadcom `D49` face a B et Costco `C60` face a A.
- Aucun ticker manquant en base : 50 lignes courantes `scored` et 60 snapshots
  historiques sous `2.9.1-pilot.14`.
- Le seuil d'acceptation de `90%`, sans ecart de deux grades, n'est pas atteint. Le cron
  reste desactive.

## Ecarts sur attentes approuvees

| Ticker | Attendu | Obtenu | Vecteur | Diagnostic initial |
| --- | --- | --- | --- | --- |
| NVDA | 79-100 | B78 | 2/2/1/2/2/1 | Instabilite de `transition_capacity` : le run valide avait 2/2 et B79. |
| UBER | C | B78 | 2/2/1/2/2/1 | Moat et capture passent chacun de 1 a 2 selon l'adjudication des memes mecanismes de liquidite. |
| ADBE | C | D49 | 1/1/1/2/1/1 | Le gate workflow et les criteres disruption/transition varient face au C59 valide. |
| NVO | C | D48 | 0/2/1/2/1/1 | Seul le test de transition passe de 2 a 1 face au C51 valide ; la these de demande reste 2/2. |
| TSLA | C | D42 | 0/1/1/2/1/1 | La pression chinoise annule le controle et limite la rupture a 1/3 ; l'attente doit etre rejugee. |
| COST | A | C60 | 2/2/1/1/1/2 | Le moat existe, mais demande stable et capture substituable ne justifient pas A dans ce vecteur. |
| CAT | C | B73 | 3/2/1/2/1/1 | Le parc et le reseau de service obtiennent 3/3 malgre la convergence chinoise ; risque de rente comptee trop largement. |

## Ecarts sur attentes provisoires

| Ticker | Attendu | Obtenu | Vecteur | Point a trancher |
| --- | --- | --- | --- | --- |
| AVGO | B | D49 | 1/1/1/2/1/2 | Contradiction structurelle : le gate VMware plafonne tout le groupe malgre un role physique majoritaire, paye et sans bypass credible. |
| TSM | B | A88 | 3/2/1/2/2/2 | Deux chocs de continuite sont identifies mais ne plafonnent pas A ; auditer le gate de dependance. |
| MSFT | B | A88 | 3/2/1/2/2/2 | Le plan de controle cloud/identite et la transition monetaire peuvent rendre A coherent. |
| AAPL | A | B78 | 3/2/1/1/2/1 | Moat et capture sont forts ; demande seulement stable et transition IA non prouvee maintiennent B. |
| GOOGL | B | A86 | 3/2/1/2/2/1 | L'index, l'enchere et la stack IA recoivent 3/3 ; verifier le risque de cannibalisation de Search. |
| SAP | C | D49 | 1/1/1/2/1/2 | Le gate workflow s'active malgre le systeme d'autorite ; comparer explicitement SAP a Salesforce. |
| V | A | B78 | 2/2/1/2/2/1 | Ecart de frontiere : rail durable mais dependances et transition restent a 1. |
| PYPL | D | C57 | 1/2/1/2/1/1 | Le role transactionnel persiste sans controle rare ; arbitrer si demande 2/2 suffit a C. |
| KNSL | D | C57 | 1/2/1/2/1/1 | Meme vecteur que PayPal/Pfizer ; tester la specificite du savoir-faire d'underwriting. |
| NFLX | C | B78 | 3/2/1/1/2/1 | Le 3/3 de controle parait genereux pour des droits renouveles et une faible friction de sortie. |
| BYDDF | C | D48 | 0/2/1/2/1/1 | Beneficiaire chinois et demande forte, mais aucune rente rare ; ecart de deux points avec C. |
| PFE | D | C57 | 1/2/1/2/1/1 | La demande future sante donne 2/2 ; la nouvelle these sectorielle peut rendre C coherent. |
| FTNT | A | C69 | 1/2/1/2/2/1 | L'enforcement est reconnu dans la capture mais pas comme controle durable ; auditer la coherence cyber. |

## Corrections prioritaires

1. **Scope du gate workflow.** Il ne doit plafonner l'entreprise que si le workflow
   remplacable couvre lui-meme plus de 50% du coeur. Un segment logiciel minoritaire ne
   doit pas effacer un role physique majoritaire independant. Broadcom est le
   contre-exemple ; Adobe et Salesforce restent les controles negatifs.
2. **Stabilite des faits de transition.** Les seuils `material_core_deployment`, effet
   mesure, monetisation materielle et attribution causale doivent etre resolus par une
   checklist factuelle identique, car ils font varier NVIDIA, Adobe et Novo autour des
   frontieres de grade.
3. **Stabilite des marketplaces.** La qualification de la liquidite et du controle futur
   ne doit pas faire passer Uber de 1/1 a 2/2 sur le meme dossier. Les preuves de couverture,
   bypass et replication doivent etre extraites une fois puis derivees deterministiquement.
4. **Dependances qui plafonnent A.** Verifier l'application du cap aux deux chocs
   independants de TSM, sans degrader les entreprises qui n'ont qu'un cluster duplique.
5. **Arbitrage economique avant recalibration.** Revoir avec Lubin les bandes provisoires
   et les trois attentes historiques les moins certaines : Tesla, Costco et Caterpillar.
   Aucun changement de poids ne doit etre fait pour forcer ces sorties.

Le run montre donc un progres reel sur les controles deja stabilises, mais pas encore une
reproductibilite suffisante. La prochaine iteration doit corriger les contradictions et les
sous-tests instables, puis rejouer les 50 adjudications stockees avant tout nouvel appel IA.
