# Audit holdout future-first 20 - pilot.11

Date : 2026-07-21

## Resultat

- Modele : Codex `gpt-5.6-sol`, effort low, sans recherche web.
- Dossiers : memes dossiers figes que le holdout `pilot.10`.
- Resultat : `10/20` bandes, `0` erreur technique.
- Ancien contrat `pilot.10` : `4/20` bandes.
- Les 20 adjudications et cartes sont persistees et datees sous `2.9.1-pilot.11`.
- Les snapshots UI approuves `2.8.13` ne sont pas remplaces.

## Passes

| Ticker | Resultat | Vecteur |
|---|---:|---|
| ABNB | B79 | 2/2/1/2/2/2 |
| CEG | A93 | 3/3/1/2/2/1 |
| CRWD | B79 | 2/2/1/2/2/2 |
| INTC | D48 | 0/2/1/2/1/1 |
| MCO | A95 | 3/3/1/2/2/2 |
| NEE | A95 | 3/3/1/2/2/2 |
| PANW | B72 | 1/2/1/2/2/2 |
| SEB.PA | D41 | 0/2/1/1/1/1 |
| SPGI | A86 | 3/2/1/2/2/1 |
| TM | C68 | 3/2/1/1/1/2 |

## Defauts d'adjudication a corriger universellement

1. **Demande stable mais directe** : Hermes obtient `0/2` parce que le modele transforme
   l'absence de probleme futur croissant en `causalDirectness=none`. La tendance et le lien
   direct doivent rester deux tests separes : un besoin stable directement servi vaut `1/2`.
2. **Workflow client** : ServiceNow obtient `3/3` face aux ruptures alors que le client
   possede l'etat, que le workflow est reconstruisible, que le fournisseur ne controle pas
   d'execution qualifiee et que la migration est sa barriere principale. Dans ce cas, la
   migration seule ne peut refuter la plausibilite economique du remplacement en 2033.
3. **Benefices generiques et doubles** : ServiceNow et STEF obtiennent `3/3` en comptant IA
   et automatisation comme deux renforcements alors qu'ils decrivent la meme efficacite
   operationnelle. Un gain accessible aux concurrents ne suffit pas et un mecanisme ne se
   compte qu'une fois.
4. **Attribution de transition** : une croissance generale ou une amelioration operationnelle
   concomitante ne prouve pas un effet mesure de l'adaptation. L'effet ou la monetisation doit
   etre causalement attribue au deploiement cite.

## Bandes provisoires a faire valider

Ces sorties sont causalement coherentes avec la grille et ne justifient pas a elles seules
une nouvelle regle : Amazon A95, Intuitive Surgical A93, Lilly A88, LVMH B78, Medpace D42,
Qualys D42 et TotalEnergies A88. Leurs attentes actuelles sont provisoires. Il faut soit
valider la sortie, soit nommer le mecanisme economique universel manquant avant de modifier
le scorer.

## Decision

Ne pas lancer les runs 2 et 3 : mesurer la variance d'un contrat encore a `10/20` gaspille
des appels sans etablir sa validite. Corriger d'abord les quatre contrats ci-dessus, rejouer
les adjudications pour les effets deterministes, puis ne regenerer que les criteres affectes.
Le cron reste desactive.
