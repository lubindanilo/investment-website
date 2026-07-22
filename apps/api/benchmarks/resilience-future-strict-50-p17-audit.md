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

Lubin valide explicitement BYD B76. Le benchmark reste `48/50` : `42/42` attentes
approuvees et `6/8` provisoires passent. SAP B76 et Fortinet C69 restent les deux ecarts.
Le cron reste desactive.

## Cloture des attentes

Lubin valide ensuite ASML A86, TSM B79, Broadcom B79, Zoom E22, Fiserv C57 et L'Oreal
B79. Un audit final sur sources primaires tranche les deux derniers cas :

- **SAP B76 est valide.** Dans le scenario 2033, les agents peuvent absorber les interfaces
  et reconstruire une partie des workflows, mais ils doivent encore faire executer les
  ecritures, autorisations et controles dans un systeme d'autorite. Le clean core facilite
  les extensions et les migrations, ce qui limite la capture future a `1/2`, sans demontrer
  un remplacement economique majoritaire du moteur transactionnel. Les chiffres actuels
  servent uniquement a identifier ce mecanisme de depart et ne donnent aucun point.
- **Fortinet C69 est valide comme haut C.** Fortinet declare plus de 50% des unites firewall
  mondiales expediees, plus de 900 000 clients historiques, 4,58 Md USD de services sur
  6,80 Md USD de revenu 2025 et une stack FortiOS plus ASIC proprietaires. Cela justifie la
  persistance et la capture, mais pas un controle rare : le 10-K nomme de nombreux
  concurrents, le bundling cloud peut absorber des couches de securite et les ASIC dependent
  de fondeurs tiers. L'attente A initiale etait trop genereuse pour un filtre agressif.

Sources primaires :

- https://www.sap.com/integrated-reports/2025/en/datahub/financial-data/five-year-summary.html
- https://www.sap.com/uk/products/erp/rise/methodology/clean-core.html
- https://www.sec.gov/Archives/edgar/data/1000184/000110465926020058/sap-20251231x20f.htm
- https://investor.fortinet.com/static-files/7058aea1-a50c-4b7b-905f-ba5aedb92f40
- https://investor.fortinet.com/static-files/38d0dd08-09e6-4426-ae20-6e4c0e1ad992

Les 50 attentes sont desormais approuvees et les 50 analyses sont dans leur bande. La
grille est figee pour le nouveau holdout ; le cron reste desactive jusqu'au test de
generalisation et de stabilite.
