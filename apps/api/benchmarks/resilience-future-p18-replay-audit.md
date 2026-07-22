# Audit du replay pilot.18

## Objet

`pilot.18` corrige quatre mecanismes universels apres l'echec `8/20` du premier holdout :

- une pression future materielle est auditee sans exiger une disparition majoritaire ; deux
  pressions partielles, une rupture majoritaire ou une pression agentique sur un role sans
  controle penalise le critere ;
- les nouvelles adjudications distinguent les chocs reellement residuels des dependances
  ordinaires et appliquent le seuil agressif seulement apres couverture explicite ;
- une demande maximale exige une expansion nette 2033 apres substitution, reliee a un moteur
  futur explicite, et non une statistique ou une prevision sectorielle presente ;
- la capacite financiere actuelle ne donne aucun point de transition ;
- un concurrent historique ne prouve pas la replication sous cinq ans d'un systeme
  industriel rare et bottleneck.

Aucune regle ne depend d'un ticker, d'une note attendue ou d'un secteur nomme.

## Replay des 70 adjudications figees

Le strict-50 approuve reste `50/50`. SAP reste B76 par son role 2033 de systeme d'autorite,
jamais par ses statistiques actuelles. Fortinet reste C69 : son installed base ne beneficie
pas de l'exception reservee aux bottlenecks industriels. SEB reste D41.

Le premier holdout passe de `8/20` a `9/20`. Airbus est corrige de C57 a B78 parce qu'un
duopole existant ne rend pas son systeme industriel certifie replicable sous cinq ans. Upwork
descend de D43 a D37 car la pression agentique sur un role commoditise sans controle n'est
plus neutre. Les onze autres ecarts restent provisoires.

Ce `9/20` n'est pas un test complet du nouveau contrat : les anciennes adjudications ne
contiennent ni `residualOnlyAssessment`, ni `netExpansionAfterSubstitution`, ni
`futureDriver`, et leurs `technicalAndEconomicPath` avaient ete remplis selon l'ancien seuil
majoritaire. Le prochain test valable doit donc etre un nouveau holdout, dont les attentes
sont figees avant recherche et dont les adjudications sont produites directement sous le
contrat `pilot.18`.

Le cron et la publication UI restent desactives.
