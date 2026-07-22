# Holdout de generalisation 20 - pilot.17

## Protocole aveugle

Les 20 entreprises sont absentes du strict-50. Les bandes ci-dessous ont ete ecrites avant
toute nouvelle recherche, toute adjudication `pilot.17` et toute lecture d'un score genere.
Elles sont provisoires : un ecart devra etre classe comme erreur de ponderation, erreur
d'adjudication, trou de recherche ou attente initiale mal calibree. La bande ne sera jamais
deplacee automatiquement vers la sortie du modele.

Distribution volontairement agressive : `1 A`, `7 B`, `6 C`, `4 D`, `2 E`.

## Hypotheses initiales

- **Schneider Electric A** : infrastructure d'electrification, data centers, automatisation
  et controle energetique directement necessaires au scenario 2033.
- **Linde B** : actifs locaux, contrats et savoir-faire industriels durables, mais tailwind IA
  surtout indirect et dependances energetiques materielles.
- **Oracle B** : base de donnees et systeme d'autorite encore necessaires aux agents, avec
  capture cloud, mais concurrence hyperscaler et compression des interfaces.
- **Workday D** : donnees RH et finance persistantes, mais une grande partie de l'interface et
  des workflows configurables peut etre absorbee ou reconstruite par des agents.
- **Atlassian D** : marque et adoption fortes, mais collaboration et suivi de projet restent
  des workflows logiciels exposés a la reproduction et a l'automatisation.
- **Snowflake C** : demande structurelle de donnees et d'IA, compensee par les hyperscalers,
  les formats ouverts et un controle insuffisamment rare.
- **Accenture D** : peut conduire la transition IA de ses clients, mais l'automatisation
  comprime aussi son coeur humain et sa dependance aux talents reste importante.
- **Deere B** : parc, distribution, pieces, precision agricole et autonomie servent un besoin
  alimentaire durable, avec une pression future des constructeurs moins chers.
- **Airbus B** : duopole, certification et base installee durables, mais forte supply chain et
  progression credible de l'ingenierie aeronautique chinoise.
- **Ferrari B** : marque rare, prix et rarete volontaire survivent mieux a la convergence
  qualite-prix chinoise, sans rendre la transition technologique gratuite.
- **Disney C** : IP et parcs physiques resistent, tandis que streaming et production de
  contenu subissent une forte compression par l'IA et la concurrence attentionnelle.
- **Nike C** : marque et distribution mondiales persistent, mais fabrication reproductible,
  marques chinoises et volatilite culturelle limitent le controle futur.
- **Starbucks D** : marque et reseau de points de vente assurent une presence, sans controle
  rare et avec des alternatives, du travail humain et des tensions sociales importantes.
- **MercadoLibre B** : liquidite locale, paiements et logistique renforcent un reseau encore
  utile aux agents, avec des risques pays et reglementaires significatifs.
- **DoorDash C** : densite locale et orchestration peuvent capter l'autonomie, mais le
  multihoming, le travail humain et la faible exclusivite interdisent B par defaut.
- **Upwork E** : les agents absorbent directement une part importante des taches vendues et
  peuvent aussi compresser l'intermediation du marketplace.
- **Vertex B** : franchise therapeutique, IP et pipeline servent des besoins graves, mais la
  concentration produit et l'expiration des protections bornent la note.
- **Regeneron C** : plateforme scientifique et portefeuille solides, mais risques cliniques,
  brevets et concentration ne prouvent pas un controle 2033 aussi durable que Vertex.
- **Arch Capital C** : expertise de souscription et demande de couverture persistent, tandis
  que capital, cycles, catastrophes et reproductibilite analytique limitent le moat.
- **Coursera E** : contenu et tutorat numeriques sont directement commoditisables par les
  agents ; les partenariats et certificats ne prouvent pas un controle majoritaire rare.

Le cron et la publication UI restent desactives pendant ce test.

## Resultats du premier run

Le run canonique unique utilise les dossiers `2.8.13` nouvellement recherches, sans web dans
l'adjudication future, sans attentes dans le prompt et sans consensus multi-modeles. Les 20
sorties sont persistees en base et se rejouent deterministiquement a l'identique.

| Ticker | Sortie | Vecteur | Attente | Verdict |
| --- | ---: | --- | ---: | --- |
| SU.PA | D48 | 0/2/1/2/1/1 | A80-100 | mismatch |
| LIN | B71 | 3/2/1/0/2/1 | B70-79 | pass |
| ORCL | C57 | 1/2/1/2/1/1 | B70-79 | mismatch |
| WDAY | C59 | 1/2/1/2/1/2 | D36-49 | mismatch |
| TEAM | D49 | 1/1/1/2/1/1 | D36-49 | pass |
| SNOW | C57 | 1/2/1/2/1/1 | C50-69 | pass |
| ACN | D48 | 0/2/1/2/1/1 | D36-49 | pass |
| DE | C63 | 1/3/1/2/1/1 | B70-79 | mismatch |
| AIR.PA | C57 | 1/2/1/2/1/1 | B70-79 | mismatch |
| RACE | B78 | 2/2/1/2/2/1 | B70-79 | pass |
| DIS | B78 | 3/2/1/1/2/1 | C50-69 | mismatch |
| NKE | B70 | 2/2/1/1/2/1 | C50-69 | mismatch |
| SBUX | B78 | 2/2/1/2/2/1 | D36-49 | mismatch |
| MELI | C57 | 1/2/1/2/1/1 | B70-79 | mismatch |
| DASH | B78 | 2/2/1/2/2/1 | C50-69 | mismatch |
| UPWK | D43 | 0/2/1/1/1/2 | E0-35 | mismatch |
| VRTX | B70 | 2/2/1/1/2/1 | B70-79 | pass |
| REGN | C51 | 0/2/1/2/1/2 | C50-69 | pass |
| ACGL | D48 | 0/2/1/2/1/1 | C50-69 | mismatch |
| COUR | E29 | 0/2/1/2/1/1 | E0-35 | pass |

Resultat : `8/20` dans leur bande, `12/20` mismatches, aucune erreur technique. Ce holdout
echoue donc clairement au test de generalisation. Le succes `50/50` du strict-50 etait un
succes de calibration des ancres, pas encore la preuve d'un systeme stable.

## Audit preliminaire des ecarts

Trois concentrations montrent un probleme universel : `disruption_positioning` vaut `2`
pour 18 entreprises sur 20, `future_dependencies` vaut `1` pour les 20, et
`structural_demand` vaut `2` pour 15 entreprises sur 20. La grille est donc encore trop peu
discriminante sur les forces futures, les dependances et les moteurs macro.

Erreurs systeme ou adjudication fortement probables :

- **Schneider D48** : le jugement declare les actifs electriques critiques et 83% du coeur
  directement expose a une demande croissante, mais met simultanement `controlStillNeeded`
  a false et le controle a zero. Le dossier n'a pas prouve le rent coverage, mais cette
  contradiction transforme un trou de preuve de moat en disparition du controle.
- **Airbus C57** : l'adjudication qualifie un systeme industriel certifie, specifique,
  majoritaire et bottleneck, tout en mettant `replicableWithinFiveYears=true` parce que Boeing
  existe et que COMAC progresse. Un concurrent existant n'est pas la preuve qu'un nouvel
  acteur peut repliquer Airbus sous cinq ans.
- **Workday C59** : `transition_capacity=2` repose sur des volumes d'usage IA et de processus,
  sans effet operationnel causal ni monetisation materielle demontree. Cela viole le test de
  deploiement a l'echelle et illustre aussi une lecture trop optimiste des nouveaux agents.
- **Starbucks B78** : la meme rente de marque ordinaire produit a la fois controle `2` et
  capture `2`, puis une projection de cafe hors domicile suffit a donner demande `2`. Le
  mecanisme double-compte la marque et traite une croissance de categorie comme une rente.
- **DoorDash B78 / MercadoLibre C57** : le test marketplace diverge dans le mauvais ordre.
  DoorDash obtient une liquidite non replicable et sans bypass majoritaire, tandis que
  MercadoLibre, pourtant integre a la logistique, au paiement et au credit, recoit un bypass
  majoritaire sans absorption majoritaire. Les preuves de couverture et de perte de liquidite
  ne sont pas appliquees de facon assez coherente.
- **Upwork D43** : l'IA est decrite comme automatisant les missions et la decouverte, mais
  `disruption_positioning` reste neutre a `2` faute de preuve d'une absorption majoritaire.
  Le seuil majoritaire rend les menaces futures directes trop faciles a neutraliser.

Cas qui demandent d'abord arbitrage plutot qu'une modification certaine du moteur : Oracle
C57 peut etre un C honnete si son controle reste reproductible ; Disney B78 et Nike B70
peuvent refleter des actifs et marques plus durables que l'attente initiale ; Deere C63 et
Arch D48 sont proches de la frontiere superieure ; Upwork D43 n'est qu'un grade au-dessus de
l'attente. Ces bandes restent provisoires.

Le moteur ne doit pas etre corrige ticker par ticker. La prochaine modification devra agir
sur les sous-tests universels identifies ci-dessus, etre rejouee sur les 70 dossiers figes,
puis etre soumise a un nouveau holdout entierement neuf. Le cron reste desactive.
