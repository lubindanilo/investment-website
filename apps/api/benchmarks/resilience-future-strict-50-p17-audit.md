# Audit strict-50 - `2.9.1-pilot.17`

Date : 22 juillet 2026.

## Defaut corrige

`pilot.16` reconnaissait correctement l'avantage chinois de cout et de capacite de BYD
face aux ruptures, mais maintenait la societe a C55. La cause etait une confusion entre
rente de prix et capture de valeur : l'absence de prime tarifaire mettait le controle a
`0/3` et la capture a `1/2`, meme lorsque le dossier prouvait une courbe de cout propre a
l'entreprise susceptible de gagner des volumes dans une categorie en croissance.

## Regle universelle

`pilot.17` ajoute un chemin de capture par leadership de cout. Il ne s'applique que lorsque
toutes les conditions suivantes sont prouvees :

- l'entreprise est un operateur de produit physique ;
- elle controle une chaine de cout ou d'approvisionnement propre couvrant la majorite du
  coeur ;
- une force du scenario 2033 renforce directement cet avantage de cout ou de capacite ;
- la demande structurelle vaut `2/2` ;
- le besoin, le role paye et le mecanisme de paiement persistent sur la majorite du coeur ;
- aucune absorption majoritaire, commoditisation de prix majoritaire ou force negative
  n'est retenue.

Ce chemin fixe seulement un plancher de `1/3` au controle futur : il ne transforme pas un
avantage de cout replicable en moat large. Il permet `2/2` en capture parce que la valeur
peut etre captee par volume, part de marche et marge sur cout, sans prime de prix.

Tesla est le contre-exemple principal : son dossier ne prouve ni avantage chinois positif
controle ni controle specifique du mecanisme de capture. Toyota est egalement exclue car
la force chinoise y est negative. Un tailwind sectoriel, une grande usine ou un prix bas
sans avantage propre ne suffit jamais.

## Resultat

BYD passe de C55 a B76 :

| Critere | `pilot.16` | `pilot.17` |
| --- | ---: | ---: |
| Controle futur | 0/3 | 1/3 |
| Position face aux ruptures | 3/3 | 3/3 |
| Dependances | 1/2 | 1/2 |
| Demande structurelle | 2/2 | 2/2 |
| Capture future | 1/2 | 2/2 |
| Capacite de transition | 1/2 | 1/2 |

Les 49 autres entreprises conservent exactement leur score, leur grade et leurs six
sous-notes. Tesla reste D48, Toyota C68, Caterpillar B79 et Netflix B78.

Le benchmark reste `48/50` : `41/41` attentes approuvees et `7/9` provisoires passent. SAP
B76 et Fortinet C69 restent les deux ecarts. BYD B76 entre dans sa nouvelle bande
provisoire B70-79 et attend la validation explicite de Lubin. Le cron reste desactive.
