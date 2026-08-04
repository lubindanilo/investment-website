# Handoff UI : intégrer le score Résilience 5 étoiles

Brief autoportant pour une conversation dédiée aux modifs front. Objectif : afficher le **nouveau
score Résilience 5 étoiles + les justifications par critère** dans le site, à la place de l'ancien
grade A–E / 0–100.

## 1. Ce qu'est le nouveau modèle (à afficher)

- **Score sur 5 étoiles**, 5 axes, chaque axe vaut `0 / 0,5 / 1` (demi-étoiles), total `0 à 5`.
- Les 5 axes (clés techniques + libellé) :
  - `besoin` — La demande payée du rôle survit et grandit (2033)
  - `controle` — Un contrôle propre, rare, dur à contourner
  - `forces` — Tient face aux 3 forces (IA, robotique, Chine)
  - `adjacent` — Le pouvoir d'aspirer l'adjacent (via l'installé)
  - `capture` — Se faire payer durablement, sans fragilité fatale
- **Chaque axe porte une phrase de justification** (texte, ~25 mots). C'est central : l'utilisateur
  doit voir la note ET le pourquoi, par critère.
- Résilience est un **score autonome, séparé de la note Quality sur 10** (elles coexistent).

**Forme des données (un enregistrement, tel qu'il sera servi) :**
```json
{
  "ticker": "AAPL",
  "name": "Apple",
  "total": 4,
  "criteria": {
    "besoin":   { "star": 1,   "justification": "…" },
    "controle": { "star": 1,   "justification": "…" },
    "forces":   { "star": 0.5, "justification": "…" },
    "adjacent": { "star": 0.5, "justification": "…" },
    "capture":  { "star": 1,   "justification": "…" }
  },
  "verdict": "agree",          // agree | resolved | flagged (qualité du scoring, cf. §6)
  "scoredAt": "2026-…"
}
```
Type source (server-only aujourd'hui) : `apps/api/src/services/resilienceStars.ts:5-37`
(`CRITERION_KEYS`, `StarValue`, `CriterionScore`, `ResilienceStarScore`).

## 2. État actuel du site (important : DEUX systèmes parallèles)

| | Ancien (live dans l'UI) | Nouveau 5 étoiles |
| --- | --- | --- |
| Forme | grade **A–E** + **finalScore 0–100** (ex. « B 73 ») | **0–5 étoiles**, 5 axes × {0, 0,5, 1} |
| Critères | 6 (moat, disruption, dépendances…) 0..2/0..3 | 5 (besoin/controle/forces/adjacent/capture) |
| Persistance | Prisma `ResilienceAnalysis` (versionné 2.8.13) | fichier JSON `apps/api/.data/resilience-stars-store.json` (backfill) |
| Câblé au web ? | **Oui** (5 pages) | **Non** (aucune route, aucun import web) |

Le moteur 5 étoiles existe et produit les données, mais **rien ne l'affiche et aucune route HTTP
ne le sert**. Le travail = combler ce trou.

## 3. Où ça s'affiche aujourd'hui (composants + lignes)

Conventions : **CSS global, un fichier par composant** (pas de CSS modules / Tailwind /
styled-components). Tokens couleur en variables : `--good`, `--warn`, `--bad`, `--brand` (+ `-bg`/`-ink`),
`--ink`, `--ink-2/3/4`, `--bg-soft`.

- **`apps/web/src/components/ResilienceAnalysis.tsx`** (1205 l.) — le rendu de la page détail :
  - `AnalysisHeader` (l. 54-139) : le bloc « score », avec **l'anneau Quality (/10)** et **l'anneau
    Résilience** côte à côte. Le grade + score Résilience est en **l. 114-135** (`resilience?.grade`,
    `resilienceScore = resilience?.finalScore`).
  - `ResilienceGrid` (l. 1165-1204) : la grille de cartes par critère (une `<article
    className="anl-resilience-card tone-…">` par critère : label, `{score}/{maxScore}`, un mot de
    niveau, un résumé, un popover `CriterionDetails`).
  - `CriterionDetails` (l. 1010-1163) : le panneau détaillé (lecture du score, raison, watchpoints,
    preuves). **Modèle à imiter** pour afficher la justification d'un axe.
- **`apps/web/src/components/ResilienceBadge.tsx`** (52 l.) — la **pastille compacte** « grade +
  score » réutilisée sur les listes (l. 31-40) ; `ResilienceNotScored` (l. 48) pour « Non noté ».
- ⚠️ **`apps/web/src/components/CriterionCard.tsx`** n'est PAS la résilience (ce sont les 10 critères
  financiers/Quality). Les cartes résilience vivent dans `ResilienceAnalysis.tsx`.

## 4. Types + routes à toucher

- **Types partagés** : `packages/shared/src/index.ts` (section « Resilience v2.5 » l. 31+ :
  `ResilienceGrade` l.43, `ResilienceCriterion` l.61, `ResilienceAnalysis` l.73, `ResilienceSummary`
  l.90). **À faire** : ajouter un type `ResilienceStars` / `ResilienceStarSummary` ici (à côté de
  `ResilienceSummary`) pour que le web puisse l'importer (aujourd'hui le type 5 étoiles est
  server-only dans `apps/api`).
- **Serving** : `apps/api/src/services/resilienceSummary.ts` (`getPublishedResilienceSummaries`,
  `getPublishedResilienceBreakdowns`) + `resiliencePublished.ts` (gate version 2.8.13). Il faudra un
  lecteur équivalent pour les étoiles.
- **Routes qui attachent la résilience** (mêmes points d'accroche pour le nouveau payload) :
  - `apps/api/src/routes/analyze.ts` (réponse assemblée l.173-189, champ `resilience` l.183 ;
    `GET /api/analyze?ticker=`)
  - `apps/api/src/routes/screener.ts` (l.386/491 ; `GET /api/screener/top|showcase|ticker/:t`)
  - `apps/api/src/routes/watchlist.ts` (`attachResilience` l.176-182)
  - `apps/api/src/routes/compare.ts` (l.159-163, avec breakdown par critère)

## 5. Où placer les étoiles dans la page

Page détail : **`apps/web/src/pages/AnalysePage.tsx`**.
- **Header** (l. 393, `AnalysisHeader`) : remplacer l'anneau Résilience A–E/100 par un **compteur 5
  étoiles** à côté de l'anneau Quality (/10). Garder les deux scores distincts.
- **Section Résilience** (l. 428-430) : remplacer `<ResilienceGrid>` par une grille de **5 cartes
  d'axe**, chacune : titre de l'axe + **X/1 étoile (demi possible)** + **la phrase de justification**.
- Pastille compacte sur les listes (Watchlist l.264, Screener, Compare l.303, Analyse-landing l.640) :
  un composant `ResilienceStars` sœur de `ResilienceBadge` (afficher « ★★★★☆ 4/5 » compact).

Reco composant : **`ResilienceStars.tsx` + `ResilienceStars.css`** (CSS global comme le reste),
tons via `--good` (4-5), `--warn` (2,5-3,5), `--bad` (0-2), taille calée sur le gabarit `res-badge` /
`ScorePill` pour s'aligner dans les lignes de liste et le header.

## 6. Détails d'UX à prévoir

- **Demi-étoiles** : le compteur doit rendre 0 / 0,5 / 1 par axe et un total à la demi (ex. 3,5/5).
- **Justification par axe** : toujours visible (ou en popover façon `CriterionDetails`).
- **`verdict`** (agree/resolved/flagged) : optionnel côté public. `flagged` = « en revue » (score
  provisoire, à valider par Lubin). Prévoir au moins un état visuel discret « en revue » pour flagged.
- **États** : `pending` (pas encore scoré) → « En attente » ; réutiliser le pattern self-hide actuel.
- **i18n** : nouveaux libellés d'axes sous `analyse.resilienceCriteria.*` dans
  `apps/web/src/i18n/locales/{fr,en,es}.json` (les 6 clés actuelles sont vers `fr.json:1115`).

## 7. Décisions à acter (poser au démarrage)

1. **Remplacer** l'ancien A–E ou **coexister** un temps ? Reco : **remplacer** (l'ancien 6-critères
   est archivé, cf. décision produit). Coexistence possible derrière un flag le temps du backfill.
2. **Persistance** : le backfill écrit aujourd'hui dans un **fichier JSON**. Pour le web, promouvoir
   ces scores dans **Prisma** (nouvelle table `ResilienceStarScore`) et servir depuis la DB, comme
   l'ancien. (Cette brique backend peut être faite côté API avant la partie purement UI.)
3. **Mapping tons** (couleur) : total 4-5 = `--good`, 2,5-3,5 = `--warn`, 0-2 = `--bad`.

## 8. Ordre de travail suggéré

1. Ajouter le type `ResilienceStars` dans `packages/shared`.
2. (Backend) promouvoir le store JSON → table Prisma + une route qui sert `{ticker → stars}`.
3. Attacher le payload dans les 4 routes (analyze/screener/watchlist/compare).
4. `ResilienceStars.tsx` + `.css` (compteur étoiles + demi, tons via variables).
5. Header : compteur étoiles à côté de Quality (remplace l'anneau A–E).
6. Section détail : 5 cartes d'axe avec justification.
7. Pastille compacte sur les listes.
8. i18n FR/EN/ES des 5 axes.

## Références
- Doctrine + barème 5 étoiles : vault `connaissances/strategie/lubin-investment-resilience-modele-5-etoiles.md`.
- Backend 5 étoiles : branche `claude/resilience-5-etoiles`, services `apps/api/src/services/resilienceStars*.ts`.
