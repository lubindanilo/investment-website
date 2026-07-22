# Audit cible des ecarts majeurs - pilot.21

Date : 2026-07-22

## Perimetre

`pilot.21` part des adjudications p20 et audite quatre decisions demandees : validation de
Palantir B79, sur-note potentielle de Siemens A98, sous-note potentielle de Stryker D39 et
sous-note potentielle de PDD D43.

Les bandes de Siemens, Stryker et PDD ont ete revisees apres lecture des resultats et des
dossiers. Elles deviennent donc des cibles de calibration provisoires et ne constituent plus
un holdout aveugle. Le score historique aveugle p20 reste documente separement. Seule la bande
Palantir B70-79 est marquee `approved`, apres validation explicite de l'utilisateur.

## Corrections universelles

1. Un `controlPortfolio` qualifie vaut exactement `1/3`. Il ne peut plus conserver le `3/3`
   d'un champ large contradictoire. Cette erreur expliquait Siemens A98.
2. Un controle minoritaire specifique, encore necessaire, paye et survivant au scenario garde
   `1/3` meme si des concurrents reproduisent la technologie. Il ne devient pas un moat large.
   Cette erreur expliquait le zero de Stryker et concernait aussi Regeneron.
3. Le bonus structurel `3/3` face aux ruptures exige l'absence de toute force negative,
   pression materielle ou effet mixte. Un benefice robotique ne peut plus effacer une pression
   chinoise, comme chez Siemens.
4. Pour une entreprise qui agrege ou distribue directement l'offre industrielle chinoise,
   l'adjudication doit tester le benefice qualite-prix chinois en plus de la concurrence. Ce
   n'est pas un bonus automatique pour toute entreprise chinoise.

## Conclusions par entreprise

### Palantir : B79 approuve

Le plan de controle Ontology-Apollo maintient un modele d'etat transverse, les permissions,
l'audit et les actions dont les agents ont besoin. Le controle et la capture valent `2/3` et
`2/2`, mais l'adaptation ne constitue pas un avantage inaccessible aux hyperscalers. Le gate
`future_a_eligibility` plafonne donc la note a B79.

### Siemens : C62, ancienne attente B trop haute

Le dossier etablit trois controles independants : TIA/Simatic, installations electriques et
batiments, puis rail homologue et maintenance. Aucun ne couvre seul la majorite du groupe.
Le portefeuille combine depasse probablement 50%, mais la doctrine agressive lui accorde
exactement `1/3`, jamais un moat exceptionnel. La robotisation est favorable, tandis que l'IA
est mixte et la Chine exerce une pression materielle. Vecteur : `1/2/2/2/1/1`.

### Stryker : D48, ancienne attente B trop haute

Mako constitue bien un controle minoritaire paye et specifique, donc `1/3` au lieu de zero.
Il couvre toutefois moins de 20% du groupe et plusieurs plateformes concurrentes existent.
Le besoin chirurgical reste direct, mais le dossier ne permet pas de projeter une expansion
nette sur la majorite du portefeuille apres prevention, substitution et pression hospitaliere.
La Chine et les achats automatises compriment les prix. Vecteur : `1/1/2/1/1/1`.

### PDD : D49, ancienne attente B trop haute

La readjudication reconnait deux effets oublies : les agents peuvent diriger davantage de
commandes vers l'offre a bas prix, et la progression chinoise augmente les volumes accessibles.
La disruption passe donc de `1/3` a `2/3`. PDD reste cependant une liquidite non incontournable
face a Alibaba, JD et aux futurs agents multi-marketplaces ; la publicite est compressible,
la demande economique nette reste stable et le choc souverain chinois demeure existentiel.
Vecteur : `1/2/1/1/1/1`.

## Non-regression et statut

- strict-50 : `50/50`, aucun score modifie ;
- premier holdout : seul Regeneron change, de C51 a C59, sans changer de grade ni de bande ;
- second holdout recalibre : `14/20`, mais ce chiffre n'est plus aveugle ;
- ecarts provisoires restants : EQIX, ABB, TMO, ADSK, SPOT et MCD ;
- le cron reste desactive ;
- la prochaine mesure de generalisation doit etre une nouvelle cohorte aveugle.
