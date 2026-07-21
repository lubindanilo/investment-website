# Audit cible future-first 20 - pilot.12

Date : 2026-07-21

## Methode

- Base : les 20 adjudications Codex figees de `pilot.11`.
- Relecture ciblee seulement : `structural_demand` pour Hermes,
  `disruption_positioning` et `future_value_capture` pour ServiceNow,
  `disruption_positioning` et `transition_capacity` pour STEF.
- Toutes les autres cartes sont conservees bit-for-bit puis rejouees par le scorer
  deterministe `2.9.1-pilot.12`.

## Resultat

- `12/20` bandes, contre `10/20` en `pilot.11` et `4/20` en `pilot.10`.
- Hermes : B73 vers A81, vecteur `3/2/1/1/2/2`, attendu A.
- ServiceNow : C63 vers D49, vecteur `1/1/1/2/1/1`, attendu D.
- STEF : B79 vers B70, vecteur `2/2/1/1/2/1`, attendu provisoire C.
- Palo Alto reste B72 : la stack proprietaire d'enforcement securite n'est pas traitee
  comme un simple workflow client. Qualys ne recoit pas cette protection car son audit
  conclut controle non specifique et bypass majoritaire credible.

## Lecture

Les trois defauts universels sont corriges. STEF ne manque sa bande que d'un point et son
vecteur est coherent : controle physique et capture d'execution `2/2`, mais aucun double
tailwind ni bonus de transition. Modifier les poids pour gagner ce point serait de la
sur-calibration.

Les huit ecarts restants sont donc des bandes provisoires a arbitrer : Amazon A95,
Intuitive Surgical A93, Lilly A88, LVMH B78, Medpace D42, Qualys D42, STEF B70 et
TotalEnergies A88. Aucun nouveau run complet ne doit etre lance avant cet arbitrage.
