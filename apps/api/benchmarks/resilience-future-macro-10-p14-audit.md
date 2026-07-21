# Audit macro future-first 10 - pilot.14

Date : 2026-07-21

## Methode

- Attentes figees avant les nouveaux appels dans
  `resilience-future-macro-10-p14.json`.
- Dossiers et adjudications historiques reutilises, sans nouvelle recherche.
- Relecture initiale limitee a `disruption_positioning` et `structural_demand` pour les dix
  entreprises.
- Relecture de `future_control` et `future_value_capture` seulement pour NVIDIA, Novo Nordisk
  et Adobe, dont les adjudications `pilot.10` ne permettaient pas d'expliquer les ecarts.
- Un retour non JSON sur Uber a ete repris une seule fois, avec succes.
- Tous les scores finaux ont ete repersistes en base sous `2.9.1-pilot.14`.

## Resultat

| Entreprise | Score | Vecteur | Attente | Statut |
|---|---:|---|---|---|
| Medpace | C57 | `1/2/1/2/1/1` | C | pass |
| NVIDIA | B79 | `2/2/1/2/2/2` | B79-A | pass |
| Constellation Energy | A86 | `3/2/1/2/2/1` | A | pass |
| Qualys | D42 | `0/1/1/2/1/1` | D | pass |
| Uber | C57 | `1/2/1/2/1/1` | C | pass |
| Booking | B73 | `2/2/1/1/2/2` | B | pass |
| Adobe | C59 | `1/2/1/2/1/2` | C | pass |
| Salesforce | D49 | `1/1/1/2/1/2` | D approuve | pass |
| Novo Nordisk | C51 | `0/2/1/2/1/2` | C approuve | pass |
| Boeing | B76 | `3/2/1/1/2/0` | B | pass |

Apres arbitrage utilisateur de Novo C51 et Salesforce D49, le resultat est `10/10` attentes
approuvees. Le replay des 20 ancres approuvees reste `20/20` apres les corrections du scorer.

## Corrections universelles

1. Un remplacement majoritaire de workflow n'est derive de la seule migration que lorsque
   sa plausibilite est `unknown`; un `false` explicite ne peut plus etre ecrase.
2. Une stack proprietaire n'est plus plafonnee pour une simple pression tarifaire lorsque
   ni commoditisation ni bypass ne couvre la majorite du coeur. L'execution de securite peut
   conserver `2/2` en capture sans devenir automatiquement un moat `3/3`.
3. Une capture durable `2/2` exige un controle futur d'au moins `2/3`, sauf plan proprietaire
   d'enforcement de securite qualifie. Un role paye sans controle rare reste `1/2`.

## Arbitrage Novo Nordisk

Le `2/2` de demande est confirme : obesite et diabete progressent structurellement, et l'IA
peut accelerer diagnostic et decouverte. Le score reste C51 parce que les produits
semaglutide representant environ 74% des ventes 2025 perdent leur protection publiee avant
2033 et qu'aucun portefeuille post-semaglutide, avantage de cout industriel ou rente GMP
couvrant plus de 50% du coeur n'est prouve dans le dossier. Le besoin futur est fort, mais
la capture specifique par Novo reste ouverte.

Lubin approuve Novo C51 : la forte demande future ne compense pas une capture specifique non
prouvee apres l'expiration des brevets actuels. Il approuve aussi Salesforce D49, avec un
watchpoint E si les agents absorbent demain plus de 50% du role paye. Les runs de stabilite
restent necessaires avant le cron.
