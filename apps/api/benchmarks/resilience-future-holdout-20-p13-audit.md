# Audit cible future-first 20 - pilot.13

Date : 2026-07-21

## Methode

- Base : les 20 adjudications figees de `pilot.12`.
- Relecture ciblee de `disruption_positioning` pour Intuitive Surgical.
- Relecture ciblee de `future_control`, `disruption_positioning`,
  `future_value_capture` et `transition_capacity` pour Medpace.
- Toutes les autres cartes sont conservees puis rejouees par le scorer deterministe
  `2.9.1-pilot.13`.
- Qualys D et Intuitive Surgical A sont approuves par Lubin. La bande C de Medpace reste
  provisoire jusqu'a validation explicite du resultat C57.

## Resultat

- `20/20` bandes, contre `12/20` avant les arbitrages utilisateur de `pilot.12`.
- Intuitive Surgical : A86, vecteur `3/2/1/2/2/1`, attendu A approuve.
- Medpace : C57, vecteur `1/2/1/2/1/1`, attendu C provisoire.
- Qualys : D42, vecteur `0/1/1/2/1/1`, attendu D approuve.
- Aucun des 17 cas deja alignes ne sort de sa bande au replay.

## Lecture de Medpace

Le contrat ne traite plus un service clinique reglemente comme un logiciel de workflow
simplement parce qu'il utilise une plateforme proprietaire. Les transferts de donnees,
responsabilites, sites et validations pendant un essai actif prouvent des switching costs
et un controle reglemente etroit. Ils ne prouvent pas un moat large : d'autres CRO savent
gagner de nouveaux mandats et reproduire cette capacite d'execution.

L'absence de taux de retention ou de prime de prix publiee reste `unknown`, jamais `false`.
Une contre-preuve economique affirmative est desormais requise pour annuler la rente. A
l'inverse, le potentiel d'efficacite de l'IA n'ajoute aucun point automatique : tant que le
gain n'est ni specifique a Medpace, ni mesure, ni monetise, il reste un levier de transition
plausible partage avec les concurrents.

## Conclusion

`pilot.13` ferme le dernier ecart de bande du holdout sans override par ticker et sans
regression. Ce resultat valide la coherence de la cohorte de calibration, pas encore la
generalisation. Apres validation utilisateur de Medpace C57, l'etape suivante est de lancer
trois repetitions avec le meme modele et les memes dossiers, puis d'elargir au benchmark
strict de 50 entreprises. Le cron reste desactive.
