# Resilience economique 2033

Version canonique candidate : `2.9.1-pilot.14`.

Source executable de verite :
`apps/api/src/services/resilienceFuturePilot.ts`. Ce document decrit exactement cette
version ; la note strategique de Personal Agents en est le miroir produit et le skill
`lubin-resilience-scorer` la procedure operatoire. Une evolution methodologique n'est
terminee que lorsque le code, le schema, les tests, ce document et ces deux miroirs portent
la meme version. Les analyses `2.8.13` deja publiees dans l'UI restent volontairement
distinctes tant que la candidate future-first n'a pas passe l'acceptation stricte.

Ce dossier permet de produire une adjudication avec n'importe quel LLM, puis de calculer
le score de maniere strictement deterministe dans le repo. Le LLM ne choisit jamais les
poids, les gates, la note finale ou le grade.

## Question mesuree

La note repond a une question unique :

> Quelle place economique, quel moat et quel pouvoir de capture cette entreprise
> devrait-elle conserver dans un monde profondement transforme par l'IA en 2033 ?

Resilience ne mesure ni la valorisation, ni la performance boursiere attendue, ni une
seconde fois la qualite fondamentale. Les chiffres passes peuvent prouver une rente, une
dependance ou une capacite de transition, mais ne donnent jamais automatiquement des points.

## Scenario 2033 fige

Toutes les entreprises sont comparees dans le meme scenario central :

- IA generative et agents largement adoptes dans la recherche, l'achat et le travail ;
- automatisation et robotique beaucoup plus avancees, sans automatisation magique ;
- forte progression chinoise en ingenierie, supply chain et rapport qualite-prix ;
- compression des interfaces, logiciels et intermediaires facilement reproductibles ;
- les actifs physiques rares, droits regules, marques recherchees, liquidites de reseau,
  stacks proprietaires et supply chains difficiles a reproduire peuvent garder une rente.

Le present contraint la projection, mais l'adjudication porte sur le scenario central 2033.
L'incertitude normale d'une prevision est stockee dans `confidence`; elle ne devient ni un
bonus ni un echec automatique.

## Architecture de confiance

Le pipeline separe quatre responsabilites :

1. **Dossier source fige** : faits et preuves disponibles, sans note attendue.
2. **Adjudication LLM** : remplissage du contrat JSON documente par
   [`adjudication.schema.json`](./adjudication.schema.json).
3. **Scoring TypeScript** : poids, gates, score et grade dans
   `apps/api/src/services/resilienceFuturePilot.ts`.
4. **Benchmark** : attentes independantes dans les fichiers
   `apps/api/benchmarks/resilience-future-*.json`.

Une modification de poids ou de gate se teste par replay de l'adjudication stockee. Elle ne
justifie jamais un nouvel appel LLM. Une reparation structurelle ne peut completer que les
champs manquants et ne doit pas regenerer les criteres deja resolus.

## Les six criteres

### 1. Controle economique futur - 25%, note 0 a 3

Controle admissible : actif rare, droit regule, marque recherchee, liquidite de reseau,
stack/IP proprietaire, avantage industriel/supply chain, installed base ou capacite
d'execution reglementee specialisee.

- `0` : aucun controle specifique futur, controle hors coeur ou rente explicitement perdue.
- `1` : controle etroit, conteste ou replicable, mais encore paye sur le coeur.
- `2` : controle specifique couvrant la majorite du coeur, encore paye et sans erosion
  dominante.
- `3` : controle 2 plus goulot systemique ou plusieurs controles independants.

Un moat actuel ne cree aucun plancher. A l'inverse, une incertitude de projection ne doit
pas effacer un mecanisme identifie. Une erosion explicite d'un controle majoritaire conserve
au maximum `1/3`.

Une stack numerique reste un controle fort lorsque son plan de controle majoritaire
(calcul, donnees, identite, permissions ou execution) constitue encore un goulot systemique,
meme si l'interface visible devient agentique ou commoditisee. Pour les brevets et droits
temporaires reglementes, `2/3` exige en revanche une visibilite majoritaire explicite jusqu'a
2033 ; la seule promesse de renouveler le pipeline reste plafonnee a `1/3`.

Une capacite d'execution reglementee ne qualifie un controle que si elle couvre le coeur,
produit une rente ou des switching costs payes et combine savoir-faire, reseau operationnel
ou historique de conformite difficile a reproduire. La reglementation sectorielle ou
l'usage d'un logiciel proprietaire ne donnent aucun point a eux seuls.

### 2. Position face aux ruptures - 20%, note 0 a 3

Trois forces sont toujours testees : `ai_agents`, `automation_robotics` et
`china_engineering`.

- Une force est negative seulement si une voie technique **et economique** peut faire perdre
  ou absorber plus de 50% du role, sans reponse qui controle l'issue.
- Une force est positive seulement si le benefice est materiel et que l'entreprise controle
  sa capture.
- Une compression de prix ou un avantage devenu standard n'est pas une disparition du role.

Scores : deux menaces ou disparition directe `0`; une menace `1`; aucune menace controlee
`2`; au moins **deux mecanismes de renforcement distincts et controles** `3`. Une seule
force positive ne suffit pas, deux forces decrivant le meme gain ne comptent qu'une fois,
et une efficacite generique accessible aux concurrents ne constitue pas un renforcement.

### 3. Dependances futures - 10%, note 0 a 2

Les dependances sont regroupees par choc economique independant. Une mitigation inconnue
n'est pas assimilee a une absence de mitigation.

- `0` : choc existentiel explicitement non mitige ou au moins trois chocs materiels sans
  mitigation.
- `1` : exposition residuelle ou couverture incomplete.
- `2` : couverture complete et tous les chocs materiels fortement mitiges.

Une mitigation moyenne vaut `1/2` : elle reduit le risque sans prouver son extinction.

### 4. Demande structurelle - 15%, note 0 a 2

Le besoin futur doit etre relie directement au coeur de l'entreprise.

- `0` : demande en declin, lien indirect ou exposition limitee.
- `1` : demande stable/rising directement servie, ou tendance inconnue avec exposition
  directe majoritaire.
- `2` : demande structurellement croissante, lien direct/enabling et exposition majoritaire.

La demande du secteur ne prouve pas la capture par l'entreprise. Chegg peut donc obtenir
`2/2` en demande et rester E si son role est absorbe.

L'analyse recherche aussi les effets macro de premier et de second ordre du scenario 2033.
Elle explicite la chaine `force macro -> variation des besoins ou volumes -> categorie ->
exposition du coeur`. Une recherche plus productive peut ainsi augmenter les volumes de
validation reglementee meme si l'IA automatise simultanement une partie de leur traitement.
Un tel tailwind peut etablir la demande `2/2`, mais jamais a lui seul le moat, la capture ou
le pricing power. Il n'est recompte dans les ruptures que si l'entreprise controle un
mecanisme distinct lui permettant d'en capter materiellement la valeur.

### 5. Capture de valeur future - 25%, note 0 a 2

Le besoin final, le role paye, la couverture du coeur, le controle specifique, le paiement
et la commoditisation sont testes separement.

- `0` : disparition/absorption majoritaire du role ou absence de role paye sur le coeur.
- `1` : role paye encore plausible, mais controle rare ou pouvoir tarifaire non etabli.
- `2` : role majoritaire, controle durable et mecanisme de paiement persistant.

Un controle futur inferieur a `2/3` plafonne la capture a `1/2` : un role paye peut
persister sans pouvoir de capture durable. L'exception est un plan proprietaire
d'enforcement de securite qui controle encore une execution critique majoritaire sans
bypass credible, deja audite separement du moat.

Une voie technique et economique credible de contournement de plus de 50% interdit `2/2`,
y compris pour un fabricant physique. Une marketplace ne peut echapper a cette regle que
si sa checklist detaillee demontre qu'aucune alternative ne peut reproduire sa couverture,
sa liquidite et son execution a l'echelle.

#### Marketplaces et agents

Le sous-test `marketplaceMechanics` evite de confondre multihoming et absence de moat :

1. contreparties fragmentees ;
2. matching et execution operes par l'entreprise ;
3. les agents ont encore besoin d'une couverture/liquidite comparable ;
4. existence ou non d'une alternative capable de contourner plus de 50% du coeur ;
5. coherence avec la rarete et la replicabilite du controle de reseau.

Une possibilite d'appeler plusieurs API ou de reserver en direct ne prouve pas un bypass.
Une flotte autonome integree peut en revanche creer une voie economique de contournement.

#### Interfaces numeriques faibles

Une entreprise est plafonnee a E29 lorsque son controle vaut `0`, que son role est une
`weak_digital_interface`, que son controle specifique est absent et que l'IA commoditise
son prix. Ce gate vise DocuSign-like sans penaliser un fabricant, un actif physique, un
systeme d'autorite ou un rail transactionnel.

#### Workflows appartenant au client

La checklist `workflowReplacement` empeche de transformer automatiquement la complexite
accumulee chez le client en moat du fournisseur. Elle teste separement la propriete de
l'etat et des donnees, la reconstruction des workflows par agents, la plausibilite
economique d'un remplacement majoritaire et l'existence d'une execution reglementee ou
irreversible encore controlee par le fournisseur.

Une execution protectrice doit maintenant nommer son type exact (`ledger` ou mandat
reglemente, mouvement d'argent, enforcement de securite, plan de controle calcul/identite,
execution physique ou transactionnelle) et couvrir plus de 50% du coeur propre de
l'entreprise. Une CMDB, un journal d'audit, des permissions, des integrations ou la seule
complexite de migration ne satisfont pas ce test.

Lorsque le client possede l'etat, que les workflows majoritaires sont reconstruisibles,
que le fournisseur ne controle aucune execution critique et qu'un remplacement majoritaire
est plausible, controle et capture sont plafonnes a `1` et l'IA devient une menace dans le
critere ruptures. Si seule la conclusion majoritaire reste inconnue, elle peut etre derivee
quand la migration est explicitement la barriere principale et que tous les autres
mecanismes convergent. Un `false` explicite interdit cette derivation.

Cette regle degrade Salesforce-like, mais preserve un ERP transactionnel, un plan de
controle cloud/identite, un rail de paiement ou un enforcement de securite lorsque leur
execution reste effectivement controlee par le fournisseur.

Lorsque le client possede l'etat, que le workflow est reconstruisible, qu'aucune execution
qualifiee ne protege le coeur et que la migration est la barriere principale, une conclusion
contraire du modele ne suffit plus : la plausibilite du remplacement est derivee et le score
est plafonne a D49. Une stack proprietaire d'enforcement securite avec controle specifique
et sans bypass majoritaire reste un contre-exemple explicite.

La pression de prix de l'IA est egalement scindee en deux champs : l'existence d'une
compression et sa couverture de plus de 50% du coeur. Une interface minoritaire comprimee
ne suffit plus a annuler la capture majoritaire d'un operateur durable.

### 6. Capacite de transition - 5%, note 0 a 2

Ce critere faiblement pondere mesure la capacite a financer et executer l'adaptation :
financement, adaptation deja deployee et contraintes legacy. Les donnees financieres ne
servent qu'ici et ne dupliquent pas Quality.

`scaledAdaptationEvidence=true` ne compte que si l'adaptation est un deploiement materiel
sur le coeur et qu'un effet operationnel mesure ou une monetisation materielle est observe
et causalement attribue au deploiement. La croissance generale ne suffit pas. Une annonce,
un partenariat, un pilote, une acquisition non integree ou un module marginal ne suffit pas.

## Poids et grades

| Critere | Poids |
|---|---:|
| Controle economique futur | 25% |
| Position face aux ruptures | 20% |
| Dependances futures | 10% |
| Demande structurelle | 15% |
| Capture de valeur future | 25% |
| Capacite de transition | 5% |

Le score brut est la somme ponderee, arrondie a l'entier. Grades : A `>=80`, B `70-79`,
C `50-69`, D `36-49`, E `0-35`.

## Gates

Appliques dans cet ordre :

1. role paye futur perdu : plafond E29 ;
2. interface numerique faible et commoditisee : plafond E29 ;
3. controle futur nul : plafond C69 ;
4. role paye mais commoditise, contournable, sans controle ni benefice futur direct :
   plafond D49 ;
5. A exige controle `3/3`, ruptures `>=2`, dependances `>=1`, demande `>=1`, capture
   `2/2` et transition `>=1`; sinon plafond B79.

Une coherence supplementaire s'applique aux stacks numeriques : une stack commoditisee
que les agents n'ont pas besoin d'utiliser ne peut cumuler controle `3/3` et benefice IA
controle. Une defense materielle/industrielle explicitement controlee preserve en revanche
les stacks integrees comme Apple.

## Contrat LLM

Le format reste portable vers n'importe quel LLM conforme, mais la production doit utiliser
un **modele canonique unique**, avec prompt, schema et parametres figes. La portabilite sert
a eviter une dependance technique au fournisseur ; elle ne justifie pas de melanger les
modeles dans un meme benchmark ou un meme cycle de cron. La stabilite se mesure par trois
runs independants du meme modele sur les memes dossiers figes.

Depuis la racine du repo :

```bash
# 1. Generer le prompt canonique depuis un dossier source local
pnpm --filter @lubin/api resilience:future prompt \
  --ticker BKNG \
  --company "Booking Holdings" \
  --industry "Travel Services" \
  --dossier /chemin/dossier-booking.txt \
  --output /tmp/booking-prompt.txt

# 2. Envoyer ce prompt au LLM choisi, sans ajouter la note attendue.
#    Enregistrer uniquement son JSON dans /tmp/booking-adjudication.json.

# 3. Valider le contrat et calculer la note deterministe
pnpm --filter @lubin/api resilience:future score \
  --input /tmp/booking-adjudication.json \
  --output /tmp/booking-score.json

# Afficher le JSON Schema utilisable en structured output
pnpm --filter @lubin/api resilience:future schema

# Afficher la version de grille et l'annee du scenario
pnpm --filter @lubin/api resilience:future version
```

Un autre fournisseur peut executer le contrat pour audit. La seule obligation technique
est de retourner un JSON conforme. `score` refuse les enums invalides, les champs
obligatoires absents, les forces dupliquees et les structures incorrectes.

## Persistance des runs de cohorte

Le runner de cohorte `resilience:future:pilot` persiste chaque resultat valide dans les
tables existantes `ResilienceAnalysis` et `ResilienceAnalysisHistory`, sous la version de
grille `2.9.1-pilot.14`. Cette version distincte ne remplace donc pas les analyses `2.8.13`
encore servies par l'UI.

Le JSON `analysis` conserve le score, le grade, les gates, les six cartes (`reason`,
`adverseCase`, `decisiveTrigger`, `confidence`, `audit`), l'adjudication LLM brute et les
metadonnees du dossier source. `asOf` est la date exacte de generation IA ; `refreshedAt`
est la date d'ecriture du snapshot courant. L'historique utilise la date de generation
comme cle afin qu'un nouveau run n'efface pas le precedent.

```bash
# Nouveau run autorise : generation, scoring et persistance DB atomique par entreprise
LUBIN_RESILIENCE_ALLOW_AI=1 pnpm --filter @lubin/api resilience:future:pilot -- \
  --benchmark /chemin/cohorte.json \
  --results /chemin/resultats.json

# Backfill DB d'un fichier de resultats existant, sans nouvel appel IA
pnpm --filter @lubin/api resilience:future:pilot -- \
  --persist-db \
  --benchmark /chemin/cohorte.json \
  --results /chemin/resultats.json
```

## Benchmark et statut de publication

Les trois cohortes de calibration connues atteignaient `30/30` bandes par replay en
`pilot.10`. Ce resultat prouve la coherence sur les exemples deja discutes, pas la
generalisation.

Le premier holdout frais de 20 entreprises, fige avant generation et adjudique par un seul
modele, n'a obtenu que `4/20` bandes : Lilly, NextEra, Hermes et TotalEnergies. Les 16 ecarts
ont revele des sous-tests ambigus plutot qu'un simple probleme de poids : confusion entre
part de marche et couverture du coeur propre, gate de disparition trop large, dependances
trop genereuses, workflow fournisseur surestime, compression de prix mal delimitee et
preuve de transition trop facile.

`pilot.11` corrige ces contrats universels :

- `majorityCore` signifie toujours plus de 50% du revenu ou de l'activite propre ;
- une couverture partielle du role ne declenche plus le gate de disparition ;
- `2/2` en dependances exige des mitigations fortes ;
- `3/3` face aux ruptures exige deux forces positives controlees ;
- l'execution d'un workflow doit etre qualifiee et majoritaire ;
- la compression IA distingue interface et rente majoritaire ;
- la transition a l'echelle exige deploiement et resultat observe.

Le replay deterministe des anciennes adjudications preserve les quatre controles deja dans
leur bande et retire les faux gates de Constellation et Palo Alto. Il ne peut pas corriger
les champs que le modele avait mal remplis : un nouveau run avec le contrat `pilot.11` est
donc necessaire avant toute conclusion de stabilite.

Ce nouveau run mono-modele est termine : `10/20` bandes, sans erreur technique, contre
`4/20` avec `pilot.10`. Les dix passes sont Airbnb, Constellation, CrowdStrike, Intel,
Moody's, NextEra, Palo Alto, SEB, S&P Global et Toyota. L'audit complet est conserve dans
`apps/api/benchmarks/resilience-future-holdout-20-p11-audit.md`. Les runs de repetition 2
et 3 n'ont pas ete lances : il faut d'abord corriger les sous-tests encore fautifs, puis
mesurer la variance d'un contrat economiquement acceptable.

`pilot.12` encode ces corrections : les renforcements nomment un mecanisme strategique et
les mecanismes identiques sont dedupliques, une efficacite generique ne suffit plus, la
demande stable reste directe lorsqu'elle est directement servie, la migration seule ne
protege plus un workflow client reconstruisible, et un resultat de transition doit etre
causalement attribue au deploiement. Cette version est en validation ciblee sur Hermes,
ServiceNow et STEF ; elle n'est pas encore acceptee.

La validation ciblee est terminee. Le holdout atteint `12/20` : Hermes A81 et ServiceNow
D49 rejoignent leur bande ; STEF descend de B79 a B70 mais reste un point au-dessus de sa
bande C provisoire. Palo Alto reste B72, ce qui confirme l'absence de regression sur
l'enforcement de securite. Les huit ecarts restants sont maintenant des arbitrages de
bandes provisoires, listes dans
`apps/api/benchmarks/resilience-future-holdout-20-p12-audit.md`.

Apres revue utilisateur, Amazon A, Lilly A, LVMH B, STEF B et TotalEnergies A sont valides.
L'accord courant passe a `17/20`; seuls Intuitive Surgical, Medpace et Qualys restent a
trancher.

Lubin valide ensuite Qualys D et Intuitive Surgical A. `pilot.13` ajoute le contre-exemple
des services reglementes : une plateforme qui assiste une execution clinique, physique ou
reglementaire ne transforme pas cette activite en workflow vibe-codable. La regle est en
validation ciblee sur Medpace, dernier cas ouvert.

La validation ciblee place Intuitive Surgical a A86, Qualys a D42 et Medpace a C57. Lubin
valide ensuite explicitement Medpace C57 : le holdout atteint ainsi `20/20` bandes toutes
approuvees. Pour Medpace, les switching costs
de transfert et de revalidation d'un essai actif etablissent un controle reglemente etroit,
pas un moat large : les CRO concurrentes peuvent gagner de nouveaux mandats et aucun
paiement de rente durable n'est encore demontre. L'efficacite IA reste un potentiel de
transition, sans bonus tant que son effet n'est ni specifique ni mesure.

`pilot.14` rend ensuite obligatoire l'analyse des effets macro de premier et de second ordre
de l'IA. Sa validation fraiche sur dix entreprises atteint `9/10`, sans erreur apres reprise
ciblee d'une reponse non JSON. Medpace C57, NVIDIA B79, Constellation A86, Qualys D42, Uber
C57, Booking B73, Adobe C59, Salesforce D49 et Boeing B76 rejoignent leur bande. Novo Nordisk
C51 reste le seul ecart face a l'attente B.

L'audit a corrige trois incoherences universelles du scorer : un `false` explicite interdit
desormais de deriver un remplacement de workflow majoritaire ; une pression tarifaire
minoritaire ne detruit plus le controle d'une stack comme NVIDIA ; et une capture `2/2`
exige un controle futur d'au moins `2/3`, sauf plan proprietaire d'enforcement de securite.
Le replay des 20 ancres reste `20/20`, notamment Palo Alto B72. Novo n'est pas force dans sa
bande : son dossier montre que 74% des ventes 2025 reposent sur des produits dont les brevets
publies expirent avant 2033, sans rente post-semaglutide couvrant le coeur deja prouvee.

La candidate n'est publiable que si un benchmark strict de 50 entreprises approuvees et au
moins huit cohortes variees atteint au moins 90% des bandes, sans ecart de deux grades, puis
si trois runs du meme modele sur les memes dossiers produisent moins de 5% de sous-tests
instables. Le cron reste desactive jusque-la.

## Regles anti-calibration abusive

- Aucun override par ticker.
- Le benchmark n'entre jamais dans le prompt.
- Une correction doit devenir un test economique universel avec contre-exemple.
- Une donnee manquante ne devient jamais un echec.
- Une force thematique ne donne pas un point si l'entreprise ne controle pas sa capture.
- Le meme risque ne peut pas etre compte deux fois comme perte de role et compression de rente.
- Une adjudication stockee n'est pas regeneree pour obtenir une meilleure note.
- Le cron reste desactive tant que le benchmark strict elargi n'est pas vert.
