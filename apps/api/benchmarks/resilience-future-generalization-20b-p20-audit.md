# Audit du second holdout - pilot.20

Date : 2026-07-22

## Protocole

- Les attentes p19 ont ete conservees avant le replay p20.
- Les quatre nouveaux sous-tests ont ete ajoutes sans readjudication des six criteres existants.
- Le mode `--repair-p20` ne peut modifier que le portefeuille de controles, les groupes de
  chocs, les deux checklists service/control plane et la differentiation de transition.
- Le benchmark n'entre jamais dans le prompt et aucune regle par ticker n'existe.
- Les 50 references p19 sont strictement inchangees sous p20 : `50/50`, aucun score modifie.
- Deux replays successifs des 20 analyses donnent le meme digest des analyses :
  `4a468eb02fad93ae1a7f1ef22581796ca309984471c9cb732cbfae0fbbfb58ed`.

## Resultats

| Ticker | p19 | p20 | Vecteur p20 | Bande provisoire | Lecture |
| --- | ---: | ---: | --- | --- | --- |
| ETN | B79 | A91 | 3/2/2/2/2/1 | A | passe |
| EQIX | B79 | B79 | 2/2/2/2/2/1 | A | seuil A a auditer |
| ABB | C64 | C62 | 1/2/2/2/1/1 | B | controle/capture a auditer |
| SIE.DE | A100 | A98 | 3/3/2/2/2/1 | B | probable generosite |
| ENR.DE | C56 | C53 | 0/2/2/2/1/1 | C | passe |
| GE | A81 | B78 | 3/2/1/1/2/1 | B | passe |
| TMO | D49 | C55 | 1/1/2/2/1/1 | B | portefeuille corrige, reste bas |
| SYK | D42 | D39 | 0/1/2/1/1/1 | B | ecart majeur non resolu |
| PLTR | D49 | B79 | 2/2/2/2/2/1 | C | correction voulue, ancienne bande trop basse a revoir |
| ADSK | C50 | D48 | 1/1/2/1/1/1 | C | ecart de seuil |
| INTU | D49 | D48 | 1/1/2/1/1/1 | D | passe |
| SHOP | C53 | C50 | 1/1/1/2/1/1 | C | passe |
| NET | C59 | C57 | 1/2/1/2/1/1 | C | passe |
| SPOT | C52 | D49 | 1/2/1/1/1/1 | C | ecart de seuil |
| KO | B78 | B75 | 2/2/2/1/2/1 | B | passe |
| MCD | B78 | B75 | 2/2/2/1/2/1 | C | bande ou controle a revoir |
| PDD | D40 | D43 | 1/1/1/1/1/1 | B | dependance corrigee, ecart majeur restant |
| JD | C62 | C59 | 3/1/1/1/1/1 | C | passe |
| DUOL | D45 | D43 | 1/1/1/1/1/1 | D | passe |
| FVRR | E23 | E23 | 1/1/1/0/0/1 | E | passe |

La comparaison aveugle avec les bandes provisoires donne `10/20`. Palantir est desormais
un mismatch vers le haut, conforme au retour humain selon lequel D49 etait beaucoup trop
bas ; sa bande ne doit toutefois etre modifiee qu'apres validation explicite de B79.

## Ce que p20 corrige

1. **Effet mixte** : une meme force peut apporter une demande materielle et une pression
   materielle. Eaton passe de B79 a A91 sans effacer l'un des deux effets.
2. **Portefeuille diversifie** : deux controles independants sur des activites distinctes
   peuvent etablir seulement `1/3`. Thermo Fisher passe de D49 a C55, jamais a un moat large.
3. **Choc causal unique** : les droits d'exploitation chinois et l'acces numerique de PDD
   sont regroupes sous le meme choc souverain. Les dependances passent de `0/2` a `1/2`.
4. **Transition differenciee** : une flexibilite accessible aux concurrents vaut au plus
   `1/2`. Le maximum exige un levier futur specifique, majoritaire et inaccessible aux pairs.
5. **Plan de controle operationnel** : un modele d'etat transverse qui impose permissions
   et actions ne doit pas etre confondu avec un CRM reconstruisible. Palantir atteint B79 ;
   Salesforce reste le contre-exemple negatif dans les tests.
6. **Logiciel interne d'un service** : un operateur qui vend le resultat, possede sa stack
   et ses donnees et garde la responsabilite d'execution peut conserver sa capture. Une
   agence ou un module de support utilisant une IA generique ne passe pas la checklist.

## Conclusion

Les quatre anomalies p19 sont maintenant representees par des tests universels et des
contre-exemples. Elles ne justifient plus une nouvelle modification de poids. Le niveau de
generalisation reste toutefois insuffisant : Siemens, Stryker et PDD demandent un audit des
adjudications principales, tandis que EQIX, ADSK, Spotify et McDonald's peuvent etre des
bandes provisoires mal placees ou des ecarts de seuil. Le cron reste desactive.
