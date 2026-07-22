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

## Resultat

- `33/50` dans la bande, contre `30/50` en `pilot.14`.
- `27/33` attentes approuvees dans la bande, contre `26/33`.
- `6/17` attentes provisoires dans la bande, contre `4/17`.
- Broadcom passe de D49 a B79, TSM de A88 a B79 et Uber de B78 a C57.
- Aucune attente auparavant correcte ne sort de sa bande.
- Deux ecarts de deux grades subsistent : Costco C60 face a A et Fortinet C69 face a A.
- Le seuil de 90% n'est pas atteint ; le cron reste desactive.

## Ecarts approuves restants

| Ticker | Attendu | Obtenu | Vecteur | Diagnostic |
| --- | --- | --- | --- | --- |
| NVDA | 79-100 | B78 | 2/2/1/2/2/1 | Ecart d'un point : la transition structuree ne prouve pas encore une adaptation causale a l'echelle. |
| ADBE | C | D49 | 1/1/1/2/1/1 | Le workflow majoritaire est juge reconstruisible et active le gate ; le desaccord porte sur la persistance de la stack creative, pas sur les poids. |
| CAT | C | B73 | 3/2/1/2/1/1 | Le parc et le reseau de service obtiennent 3/3 malgre la convergence chinoise ; arbitrage economique requis. |
| COST | A | C60 | 2/2/1/1/1/2 | Moat et execution solides, mais demande seulement stable et capture substituable ; A n'est pas soutenu par le vecteur actuel. |
| TSLA | C | D42 | 0/1/1/2/1/1 | La convergence chinoise annule le controle rare et aucune option autonomie n'est encore controlee dans le scenario central. |
| NVO | C | D48 | 0/2/1/2/1/1 | Demande future 2/2, mais aucun controle post-brevet et aucune transition post-semaglutide materielle ne sont prouves. |

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

Le prochain gain ne doit pas venir d'une nouvelle regle globale appliquee aux 17 cas. Il
faut d'abord trancher les vecteurs economiques, en priorite :

1. attentes approuvees : NVIDIA, Adobe, Caterpillar, Costco, Tesla et Novo Nordisk ;
2. sous-tests potentiellement fautifs : SAP, Netflix et Fortinet ;
3. attentes provisoires probablement trop prudentes : Microsoft, PayPal, Kinsale et Pfizer.

Une fois ces decisions prises, seules les adjudications fautives seront reparees sur leur
dossier fige. Les simples desaccords de bande ne doivent produire aucun changement de code.
