# Audit du benchmark strict 50 - pilot.15

## Changement teste

`pilot.15` rejoue exactement les 50 adjudications et attentes de `pilot.14`, sans appel
LLM et sans modification de ponderation. Quatre coherences universelles sont ajoutees :

1. le gate workflow exige que le workflow remplacable couvre lui-meme la majorite du coeur ;
2. un refus explicite d'acces controle ou un bypass explicite ne peut plus etre ecrase par
   une checklist marketplace favorable ;
3. un booleen de transition nu ne prouve plus une adaptation a l'echelle, tandis qu'un
   ancien resultat deja structure n'est pas penalise pour le seul champ causal ajoute apres
   sa generation ;
4. deux chocs de continuite totalement non mitiges, ou deux chocs existentiels d'une stack
   industrielle concentree, plafonnent A a B79.

## Resultat apres arbitrage cible

- `39/50` dans la bande, contre `30/50` en `pilot.14`, `33/50` au premier replay
  `pilot.15` et `34/50` apres la relecture ciblee.
- `33/33` attentes approuvees dans la bande, contre `26/33` en `pilot.14`, `27/33`
  avant arbitrage cible et `28/33` apres cette relecture.
- `6/17` attentes provisoires dans la bande, contre `4/17`.
- Broadcom passe de D49 a B79, TSM de A88 a B79 et Uber de B78 a C57.
- Une unique relecture ciblee des six ecarts approuves corrige Adobe de D49 a C57. Tesla
  progresse de D42 a D48, tandis que Costco baisse de C60 a C52. NVIDIA, Caterpillar et
  Novo Nordisk gardent leur note.
- Les 44 entreprises non ciblees restent strictement inchangees et aucune attente
  auparavant correcte ne sort de sa bande.
- Lubin valide ensuite les sorties NVIDIA B78, Caterpillar B73, Costco C52, Tesla D48 et
  Novo Nordisk D48. Leurs bandes historiques sont alignees sur ces arbitrages sans modifier
  les scores, les poids ni les adjudications.
- Le seul ecart de deux grades restant est provisoire : Fortinet C69 face a A.
- Le seuil de 90% n'est pas atteint ; le cron reste desactive.

## Arbitrages approuves

| Ticker | Bande validee | Obtenu | Vecteur | Diagnostic |
| --- | --- | --- | --- | --- |
| NVDA | B | B78 | 2/2/1/2/2/1 | La relecture ciblee confirme 1/2 en transition. Le meme vecteur produit legitimement la meme note que LVMH et Union Pacific. |
| CAT | B | B73 | 3/2/1/2/1/1 | Le parc, les pieces et le reseau de service physique soutiennent un controle futur large malgre la concurrence chinoise sur les nouvelles machines. |
| COST | C | C52 | 1/2/1/1/1/2 | Le membership et l'execution restent utiles, mais les substituts a l'echelle et le multihoming interdisent A dans une grille future-first agressive. |
| TSLA | D | D48 | 0/2/1/2/1/1 | Le risque central est la convergence chinoise qualite-prix, qui annule la rarete sur le coeur automobile. La deterioration de marque liee a Elon Musk est un watchpoint utilisateur a sourcer au prochain refresh ; Robotaxi serait un contrepoids positif, pas la cause premiere de D. |
| NVO | D | D48 | 0/2/1/2/1/1 | La demande future vaut 2/2, mais aucun controle post-brevet ni adaptation post-semaglutide materielle ne sont prouves jusqu'en 2033. |

Adobe sort des ecarts approuves : la reparation structurelle etablit que le workflow
reconstruisible ne couvre pas la majorite du coeur et retire le gate. Adobe passe de D49 a
C57 avec le vecteur `1/2/1/2/1/1`.

## Ecarts provisoires restants

| Ticker | Attendu | Obtenu | Vecteur | Diagnostic |
| --- | --- | --- | --- | --- |
| MSFT | B | A88 | 3/2/1/2/2/2 | Le plan de controle cloud/identite et la transition monetaire rendent A plausible. |
| AAPL | A | B78 | 3/2/1/1/2/1 | Moat et capture forts, mais demande seulement stable et transition IA non demontree. |
| GOOGL | B | A86 | 3/2/1/2/2/1 | Le 3/3 de controle doit etre confronte a la cannibalisation future de Search. |
| SAP | C | D49 | 1/1/1/2/1/2 | Le gate workflow traite SAP comme reconstruisible ; verifier si son moteur transactionnel est une execution independante majoritaire. |
| V | A | B78 | 2/2/1/2/2/1 | Ecart de deux points : rail durable, mais controle non exceptionnel et transition non mesuree. |
| PYPL | D | C57 | 1/2/1/2/1/1 | Role transactionnel et demande persistent sans controle rare ; arbitrer si ce vecteur merite C. |
| KNSL | D | C57 | 1/2/1/2/1/1 | Le portage reglemente du risque et la demande E&S maintiennent C sans moat large. |
| NFLX | C | B78 | 3/2/1/1/2/1 | Le 3/3 de controle parait potentiellement genereux pour des droits renouveles et une faible friction de sortie. |
| BYDDF | C | D48 | 0/2/1/2/1/1 | Demande et position chinoise fortes, mais aucun controle rare ; deux points separent D de C. |
| PFE | D | C57 | 1/2/1/2/1/1 | La demande future sante et le role pharmaceutique persistent ; C peut refleter la these macro souhaitee. |
| FTNT | A | C69 | 1/2/1/2/2/1 | L'enforcement est reconnu dans la capture mais pas comme controle large ; l'attente A ou le sous-test cyber doit etre revu. |

## Prochaine decision

Les `33/33` attentes approuvees sont desormais coherentes. Le prochain gain ne doit pas
venir d'une nouvelle regle globale appliquee aux onze cas provisoires. Il faut les
arbitrer par familles economiques, en priorite :

1. sous-tests potentiellement fautifs : SAP, Netflix et Fortinet ;
2. attentes probablement trop prudentes : Microsoft, PayPal, Kinsale et Pfizer ;
3. arbitrages de plateforme et de marque : Apple, Alphabet, Visa et BYD.

La readjudication ciblee des cas approuves est consommee. Les onze cas provisoires doivent
d'abord etre audites sur leurs dossiers existants. Une nouvelle modification exige soit un
arbitrage explicite de la bande, soit une contradiction universelle accompagnee de
contre-exemples et de tests.
