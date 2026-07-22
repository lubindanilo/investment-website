# Audit strict-50 - `2.9.1-pilot.16`

Date : 22 juillet 2026.

## Objet

`pilot.16` teste une correction universelle issue du cas BYD. Une entreprise peut obtenir
`3/3` face aux ruptures avec une seule force positive lorsque les conditions suivantes
sont toutes prouvees :

- la demande structurelle future couvre la majorite du coeur et vaut `2/2` ;
- la force repose sur un controle, un avantage de cout/capacite ou une expansion de capture
  propre a l'entreprise ;
- aucune force negative n'est retenue ;
- le benefice n'est pas une simple efficacite numerique non controlee.

Une expansion generique du marche ne qualifie jamais cette exception. Les poids, gates et
cinq autres criteres ne changent pas.

## Resultat

Le replay deterministe des 50 dossiers geles atteint `48/50` bandes :

- `41/41` attentes approuvees passent ;
- `7/9` attentes provisoires passent ;
- aucune erreur et aucune regression de bande ;
- SAP et Fortinet sont les deux seuls ecarts restants.

Les arbitrages explicites de Lubin ajoutent Microsoft A88, Apple B78, Alphabet A86, Visa
B78, PayPal C57, Kinsale C57, Netflix B78 et Pfizer C57 aux attentes approuvees. Netflix
reste dans la bande B apres l'unique relecture ciblee de son controle futur.

## Impact de la regle

La nouvelle exception ne modifie que deux entreprises sur les dossiers inchanges :

| Entreprise | `pilot.15` | `pilot.16` | Cause |
| --- | ---: | ---: | --- |
| BYD | D48 | C55 | Avantage chinois de cout et capacite propre a BYD, aligne avec une demande EV/batteries `2/2` |
| Caterpillar | B73 | B79 | Stack autonome et parc physique alignes avec une demande infrastructure/mines `2/2`; le gate A reste actif |

BYD conserve `0/3` en controle futur : son integration batterie-vehicule est une capacite
competitive forte, mais le dossier ne prouve pas encore une rente rare et durable face aux
autres constructeurs chinois. Il conserve aussi `1/2` en capture car acheteurs et agents
peuvent substituer les marques. C55 est donc une hausse nette, sans transformer la these
chinoise en bonus sectoriel automatique. Cette note reste provisoire jusqu'a validation de
Lubin.

## Relectures ciblees uniques

Les trois relectures reutilisent les dossiers existants, sans recherche web ni vote de
plusieurs modeles.

- **SAP : D49 -> B76.** La case de remplacement majoritaire du workflow est corrigee : les
  agents peuvent comprimer les interfaces, mais les ecritures, autorisations et controles
  continuent de passer par le moteur transactionnel SAP. L'attente C reste provisoire.
- **Netflix : B78 -> B78.** Le controle futur reste `3/3` : marque, abonnement et droits
  exclusifs couvrent encore la majorite du coeur. La bande B est approuvee par Lubin.
- **Fortinet : C69 -> C69.** La stack d'enforcement et la demande cyber restent fortes,
  mais le dossier ne prouve pas une difficulte de replication suffisante pour monter le
  controle futur au-dessus de `1/3`. L'attente A reste provisoire et constitue encore un
  ecart de deux grades.

## Conclusion

`pilot.16` corrige BYD de facon ciblee et non regressive. Il ne justifie pas encore la
publication ni le cron : neuf attentes restent provisoires, Fortinet conserve un ecart de
deux grades et les trois runs de stabilite n'ont pas ete executes.
