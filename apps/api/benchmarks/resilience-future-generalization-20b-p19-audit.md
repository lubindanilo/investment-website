# Audit du second holdout aveugle - pilot.19

## Protocole

- Les 20 bandes ont ete figees en `pilot.18` avant recherche et restent provisoires.
- Les memes dossiers sources ont ete readjudiques une seule fois sous le contrat p19.
- Les attentes n'ont pas ete transmises au modele.
- Une reponse non-JSON pour Siemens Energy a ete reprise une fois sans modifier le dossier.
- Les 20 analyses sont datees et persistees dans `ResilienceAnalysis` et
  `ResilienceAnalysisHistory` sous `2.9.1-pilot.19`.

Resultat : `11/20` bandes, `9` ecarts, `0` erreur. Le replay deterministe des anciennes
adjudications conserve exactement les 70 scores p18 (`50/50` strict-50 et `0` changement
sur le premier holdout).

## Resultats

| Ticker | Sortie p19 | Vecteur | Attente provisoire | Statut |
|---|---:|---|---:|---|
| ETN | B79 | 3/1/2/2/2/2 | A80-100 | ecart |
| EQIX | B79 | 2/2/2/2/2/2 | A80-100 | ecart |
| ABB | C64 | 1/2/2/2/1/2 | B70-79 | ecart |
| SIE.DE | B79 | 3/1/2/2/2/2 | B70-79 | passe |
| ENR.DE | C56 | 0/2/2/2/1/2 | C50-69 | passe |
| GE | A81 | 3/2/1/1/2/2 | B70-79 | ecart |
| TMO | D49 | 0/1/2/2/1/2 | B70-79 | ecart |
| SYK | D42 | 0/1/2/1/1/2 | B70-79 | ecart |
| PLTR | D49 | 1/1/2/2/1/2 | C50-69 | ecart |
| ADSK | C50 | 1/1/2/1/1/2 | C50-69 | passe |
| INTU | D49 | 1/1/2/1/1/2 | D36-49 | passe |
| SHOP | C53 | 1/1/1/2/1/2 | C50-69 | passe |
| NET | C59 | 1/2/1/2/1/2 | C50-69 | passe |
| SPOT | C52 | 1/2/1/1/1/2 | C50-69 | passe |
| KO | B78 | 2/2/2/1/2/2 | B70-79 | passe |
| MCD | B78 | 2/2/2/1/2/2 | C50-69 | ecart |
| PDD | D40 | 1/1/0/1/1/2 | B70-79 | ecart |
| JD | C62 | 3/1/1/1/1/2 | C50-69 | passe |
| DUOL | D45 | 1/1/1/1/1/2 | D36-49 | passe |
| FVRR | E23 | 1/1/1/0/0/1 | E0-35 | passe |

Ordre du vecteur : controle, ruptures, dependances, demande, capture, transition.

## Ce que p19 corrige

- La distribution n'est plus ecrasee vers le bas : p18 donnait 0 A, 1 B, 6 C, 8 D et
  5 E ; p19 donne 1 A, 5 B, 7 C, 6 D et 1 E.
- Les dependances passent de douze `0/2` a un seul `0/2`; les risques ordinaires ne sont
  plus additionnes comme des ruptures de continuite.
- Coca-Cola passe de D38 a B78 sans chiffre Quality : le changement vient de la marque et
  de la distribution projetees en 2033.
- Duolingo descend de C53 a D45 malgre la correction generale, ce qui montre que p19 ne
  remonte pas automatiquement toutes les entreprises.

## Audit des neuf ecarts

| Ticker | Diagnostic | Decision avant toute nouvelle version |
|---|---|---|
| ETN | Une meme force IA est a la fois expansion directe et pression d'achat; la regle du verdict unique retient seulement la pression. | Vrai trou universel de compensation des effets mixtes. B79 reste plausible tant que ce sous-test n'est pas structure. |
| EQIX | Tous les piliers valent 2, mais A exige un controle exceptionnel 3/3; la capacite peut etre repliquee par des concurrents. | B79 parait plus honnete que l'attente A provisoire. Aucun assouplissement du gate A. |
| ABB | Le role physique et la demande survivent, mais le controle et la capture restent ordinaires face a la Chine. | C64 est defendable; attente B probablement genereuse. |
| GE | Parc, pieces et maintenance certifies donnent 3/3 et aucune rupture majoritaire n'est retenue. | A81 est defendable; attente B probablement trop basse. |
| TMO | Le modele refuse tout controle car aucun mecanisme unique ne couvre seul un portefeuille diversifie. | Vrai trou de portefeuille de controles independants; D49 semble trop bas, sans prouver B. |
| SYK | Meme probleme de portefeuille, avec Mako minoritaire et plusieurs franchises medtech. | D42 semble trop bas; B reste a confirmer apres un test de portefeuille universel. |
| PLTR | Le gate workflow client reconstruisible plafonne a D49 malgre la demande d'orchestration croissante. | Frontiere economique contestable, pas une erreur evidente; D49/C50 est un arbitrage proche. |
| MCD | Immobilier, contrats de franchise, loyers et redevances donnent controle et capture 2/2. | B78 parait plus honnete que l'attente C provisoire. |
| PDD | Deux manifestations du meme regime chinois sont traitees comme deux chocs existentiels, puis les agents compriment l'intermediation. | Vrai risque de double comptage des dependances; B provisoire parait toutefois trop genereux pour une marketplace contournable. |

## Defauts encore universels

1. Les forces mixtes n'ont pas de test de bilan net : un benefice futur materiel peut etre
   efface par une pression partielle de la meme force.
2. Le controle ne sait pas encore agreger plusieurs controles independants couvrant ensemble
   un portefeuille diversifie sans inventer un moat unique.
3. Les dependances p19 n'ont pas de `shockGroup`; deux libelles du meme evenement peuvent
   encore produire deux chocs de continuite.
4. `transition_capacity=2` pour 19/20 est trop peu discriminant. Le critere doit rester
   futur, mais exiger des leviers de reconfiguration specifiques plutot qu'une simple
   possibilite generale de s'adapter.

Les neuf ecarts restent provisoires. Aucun ticker ne justifie une exception de production,
le cron reste desactive et la p19 n'est pas publiee dans l'UI.
