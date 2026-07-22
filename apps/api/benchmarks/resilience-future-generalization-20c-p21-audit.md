# Audit du holdout aveugle 20c - pilot.21

Date du run : 22 juillet 2026.

Cette cohorte contient 20 entreprises absentes des 90 observations precedentes. Les bandes
ont ete ecrites avant la recherche et avant toute sortie du modele, puis conservees sans
modification. Elles sont provisoires et ne sont jamais injectees dans le prompt.

## Resultat brut

- `7/20` bandes atteintes, `13/20` ecarts, aucune erreur technique.
- Passes : CME A81, Mastercard B70, Marriott B70, Arm B79, PepsiCo C68, eBay D46 et HubSpot D49.
- Digest des analyses avant et apres replay :
  `69a5ce06ba8590e9414b2542e4b7d57921f592d2fea49647315afe994f854eef`.
- Le replay est donc deterministe. Le cron reste desactive et `pilot.21` ne remplace pas la
  version `2.8.13` lue par l'UI.

| Ticker | Attendu | Obtenu | Vecteur | Lecture provisoire |
| --- | --- | --- | --- | --- |
| META | B | C52 | 1/2/1/1/1/2 | Controle et capture limites a 1 ; verifier si le B attendu surestime la defensabilite de l'inventaire social face aux agents. |
| WMT | B | C63 | 2/1/1/1/2/1 | Role physique et capture reconnus ; l'ecart vient surtout de disruption et demande. Tester le benefice net automatisation/supply chinoise. |
| LMT | B | C50 | 1/1/1/2/1/1 | Ecart majeur. Le portefeuille de programmes qualifies est limite a 1 et la capture a 1 malgre un role industriel reglemente ; audit prioritaire. |
| DHR | B | C54 | 1/2/2/1/1/1 | Le moteur macro recherche/diagnostic ne passe pas a 2 et le portefeuille installe reste a 1 ; audit prioritaire. |
| RELX | B | C64 | 1/2/2/2/1/2 | La demande et la transition passent, mais corpus et capture restent etroits. Le C peut etre honnete si les agents rendent les corpus substituables. |
| ADP | B | D49 | 1/2/1/1/1/1 | Ecart majeur, mais l'adjudication reconnait un rail paye non rare. Revoir d'abord l'attente B avant toute nouvelle regle. |
| ABBV | C | D48 | 1/1/2/1/1/1 | Deux points sous C ; portefeuille 2033 et moteur de demande non prouves. Cas de seuil, pas preuve suffisante d'un bug. |
| JPM | C | D49 | 1/2/1/1/1/1 | Un point sous C ; role reglemente paye mais non rare. Cas de seuil a comparer aux autres banques avant correction. |
| UNH | C | D49 | 1/2/1/1/1/1 | Un point sous C ; verifier surtout le refus du moteur vieillissement/soins plutot que modifier le seuil global. |
| RBLX | C | B75 | 2/2/2/1/2/1 | Risque de generosite : controle et capture marketplace a 2 malgre multihoming et substituts. Audit du test de liquidite. |
| ETSY | D | C63 | 2/1/1/1/2/1 | Risque de generosite : liquidite et execution a 2 alors que l'agregation agentique et l'offre industrielle menacent le coeur. |
| TWLO | E | D43 | 1/0/1/2/1/1 | Le role reste paye mais reproductible. D peut etre plus coherent que l'attente E si les volumes agentiques persistent. |
| DBX | E | D49 | 1/1/1/2/1/1 | Le gate workflow fonctionne ; D plutot que E vient du role de stockage encore paye et de la demande de contenu. Revoir l'attente avant le moteur. |

## Conclusion

Le holdout rejette la generalisation de `pilot.21`. Il ne montre pas un simple biais de
generosite : plusieurs operateurs physiques ou reglementes sont sous-notes, tandis que Roblox
et Etsy semblent potentiellement sur-notes. Les prochains arbitrages doivent commencer par
LMT, DHR, RBLX et ETSY, puis comparer ADP/JPM/UNH a des pairs. Aucune bande de cette cohorte ne
doit etre approuvee ni aucune regle modifiee avant validation economique explicite.

## Persistance

Apres ce run, la base contient `110/110` snapshots `2.9.1-pilot.21` complets et `110/110`
historiques : 90 notes approuvees sur les trois cohortes terminees et 20 notes provisoires dans
cette cohorte en cours de revue.
Chaque snapshot contient l'analyse, l'adjudication detaillee, le dossier source, son hash et la
date. L'approbation officielle est portee a la fois par `status=approved` dans le benchmark et
par `approvalStatus`, `approvedAt` et `approvalSource` dans le snapshot et son historique.
