# Handoff — Lubin Investment (direction « Moderne fintech »)

> « Analyse fondamentale, sans le bruit. »
> Web-app d'analyse fondamentale d'actions : on tape un ticker, l'app renvoie une **note de qualité sur 10** calculée sur des critères financiers objectifs, une valorisation (prix d'achat conseillé) jugée séparément, et une veille automatique qui note tout l'univers boursier.

---

## 1. À propos des fichiers de ce bundle

Les fichiers du dossier `design/` sont des **références de design réalisées en HTML/React (via Babel inline)** — un prototype cliquable qui montre l'apparence et le comportement voulus. **Ce n'est pas du code de production à copier tel quel.**

La tâche est de **recréer ces écrans dans l'environnement du codebase cible** (React/Next, Vue, etc.), avec ses patterns établis (composants, routing, data-fetching, state). Si aucun environnement n'existe encore, **React + TypeScript + Vite/Next.js** est le choix recommandé pour ce produit (SPA dense, beaucoup d'état UI, tableaux et graphiques).

Les chiffres financiers du prototype (sociétés HLMS / BRND, univers du screener) sont **fictifs et illustratifs** — ils servent à montrer la mise en page. La vraie implémentation branchera une API de données financières.

## 2. Fidélité

**Haute fidélité (hifi).** Couleurs, typographie, espacements, rayons, ombres et interactions sont définitifs. Reproduire l'UI au pixel près en utilisant les libs du codebase. Tous les tokens exacts sont en section 8 et dans `design/styles.css` (source de vérité des variables CSS).

## 3. Stack du prototype (pour lecture seule)

- **React 18** monté dans `app.jsx` (`ReactDOM.createRoot`).
- Pas de bundler : chaque fichier `.jsx` est transpilé par Babel standalone dans le navigateur. **Chaque script a son propre scope** — les composants sont exportés via `Object.assign(window, {...})` en fin de fichier, et les hooks React sont exposés globalement dans le `<head>` de `Lubin Investment.html`. **Tout ça disparaît dans une vraie implémentation** (imports/exports ES modules normaux).
- Routing maison par état (`route` dans `App`), pas de react-router. À remplacer par le router du codebase. Routes logiques : `/` (home), `/analyser`, `/screener`, `/watchlist`, `/login`, `/signup`.
- Polices Google Fonts : **Plus Jakarta Sans** (UI, 400–800) et **JetBrains Mono** (tous les chiffres).
- Graphiques : **SVG fait main** (pas de lib). Libre de remplacer par Recharts/visx/etc. en respectant le rendu décrit en section 6.

### Correspondance fichiers → modules
| Fichier prototype | Contenu | Cible suggérée |
|---|---|---|
| `styles.css` | Tous les design tokens (variables CSS) + classes utilitaires | Tokens → thème (CSS vars / Tailwind config / styled-system) |
| `data.jsx` | Données mock + générateurs de séries | Couche API + types |
| `ui.jsx` | Primitives : `Icon`, `Logo`, `ScoreCircle`, `StatusBadge`, `ScorePill`, `PriceChange`, `IconBtn`, `InfoPop` | Bibliothèque de composants |
| `charts.jsx` | `PriceChart`, `Sparkline`, `CriterionChart`, `CompositionBar` | Composants graphiques |
| `shell.jsx` | `AppNav`, `MarketingNav`, `ChartModal` | Layout + modale |
| `screen-home.jsx` | Accueil marketing + `HeroPreview` | Page `/` |
| `screen-analyser.jsx` | **Cœur** : recherche, états, ScoreCard, grille critères, earnings, qualitatif, valorisation, news | Page `/analyser` |
| `screen-tables.jsx` | `ScreenerScreen`, `WatchlistScreen` | Pages `/screener`, `/watchlist` |
| `screen-auth.jsx` | Login / signup | Pages `/login`, `/signup` |
| `app.jsx` | Routeur + état global (route, watchlist, pendingTicker) | App shell + store |

---

## 4. Écrans / Vues

### 4.1 Accueil `/` — marketing public (`screen-home.jsx`)
- **But** : présenter la proposition de valeur, convertir.
- **Nav marketing** (≠ nav app) : logo Lubin à gauche ; liens « Produit / Méthode / Screener / Tarifs » au centre ; « Se connecter » (ghost) + « Analyser une action » (brand) à droite. Hauteur 66px, sticky, fond blanc translucide `oklch(1 0 0 / 0.8)` + `backdrop-filter: blur(14px)`, bordure basse 1px `--line`.
- **Hero** : grille 2 colonnes `1.05fr 0.95fr`, padding `76px 28px 84px`, `max-width: 1240px` centré. Halo radial décoratif derrière (`radial-gradient(900px 420px at 78% -8%, var(--brand-soft), transparent 62%)`).
  - Colonne gauche : chip « Analyse fondamentale automatisée » (pastille brand) ; H1 54px/1.02, `letter-spacing -0.035em`, « sans le bruit. » en couleur `--brand` ; paragraphe 18px `--ink-2` (max 480px) ; 2 CTA (brand lg + ghost lg) ; 3 stats (`10` critères chiffrés, `6 200+` titres surveillés, `< 3 s` par analyse) — chiffres mono 24px/700, `white-space: nowrap`.
  - Colonne droite : `HeroPreview` (mini-ScoreCard statique, voir 5.3), aligné à droite, ombre `--sh-lg`.
- **Bénéfices** : 4 cartes (grid `auto-fit minmax(240px,1fr)`, gap 16). Chaque carte : icône 42×42 (radius 12, fond `--brand-soft`, couleur `--brand-ink`), titre 16.5px, texte 12px `--ink-3`. Textes exacts :
  - « Des chiffres, pas du bla-bla » — *10 critères financiers objectifs calculés en quelques secondes. La donnée tranche, pas les opinions.* (icône : barres)
  - « Toute la cote, surveillée » — *Une veille automatique note en continu l'univers boursier et fait remonter les meilleures entreprises.* (icône : pulse)
  - « La méthode des grands investisseurs » — *Rentabilité, croissance, qualité du bilan : les critères des compounders de long terme.* (icône : shield)
  - « Qualité et prix, séparés » — *La qualité du business et le prix d'entrée sont jugés indépendamment. Jamais l'un pour l'autre.* (icône : scale)
- **Comment ça marche** : bande fond `--bg-soft` (bordures haute/basse `--line`), padding `72px 28px`. Titre centré (kicker « Comment ça marche » + H2 34px « Une action jugée en un coup d'œil »). 3 étapes (grid 3 col, gap 20) : numéro 40px/700 couleur `--brand` (`01/02/03`), titre 19px, texte 14.5px `--ink-2`.
    - 01 Tapez un ticker — *Entrez le symbole d'une action. La note de qualité s'affiche en quelques secondes.*
    - 02 Lisez la note et sa composition — *Une note sur 10, sa répartition vert/orange/rouge, et le détail des 10 critères.*
    - 03 Décidez du prix d'entrée — *Ajustez vos hypothèses pour obtenir le prix d'achat conseillé, séparé de la qualité.*
- **CTA final** : carte sombre `--ink`, radius `--r-xl` (24px), padding `56px 48px`, halo radial brand en bas. H2 38px blanc « Trouvez les 10/10 sans les chercher », sous-titre `oklch(0.82 0.01 270)`, 2 boutons (brand + bouton translucide blanc).
- **Footer** : bordure haute, logo 26px + ligne légale `--ink-3` (mention « Données illustratives, ne constituent pas un conseil en investissement »).

### 4.2 Analyser `/analyser` — **LE CŒUR** (`screen-analyser.jsx`)
Orchestre 4 états. Conteneur `max-width: 1240px`, padding-top 24px, fond `--bg`.

Toujours en haut : **barre de recherche** (`SearchBar`) — input avec icône loupe à gauche, placeholder `Entrez un ticker — ex. HLMS, BRND…` (police mono, letter-spacing 0.04em), + bouton brand « Analyser → ». À la soumission : `onSubmit(value.toUpperCase())`.

**État `empty`** (`EmptyState`) : kicker « Issu de la veille · les mieux notées » + ligne d'astuce. Grille de cartes cliquables (`auto-fill minmax(232px,1fr)`, gap 14) des titres notés ≥ 9 (6 max). Chaque carte : ticker (mono 700) + nom (tronqué), `ScorePill` à droite, puis ligne secteur + P/FCF séparée par bordure. Hover : `translateY(-2px)` + ombre `--sh-md`. Clic → lance l'analyse du ticker.

**État `loading`** (`LoadingState`) : skeleton animé (shimmer). Cercle 116px + lignes pour la ScoreCard, gros bloc 240px pour le graphe, 6 cartes 128px pour la grille. Animation `shimmer` 1.4s linéaire infinie (voir `.skel` dans styles.css). Le prototype simule **1100 ms** de latence avant `filled`.

**État `error`** (`ErrorState`) : carte centrée, icône 56×56 fond `--bg-soft`, titre + description + bouton « Nouvelle recherche ». 3 variantes :
  - `notfound` — *Ticker « X » introuvable* (ticker inconnu).
  - `uncovered` — *« X » hors couverture* (déclenché dans le proto pour AAPL/MSFT/NVDA/ASML/LVMH — titres hors US/non couverts).
  - `rate` — *Trop de requêtes* (rate limit).

**État `filled`** (`AnalysisView`) — ordre vertical, gap 28, padding-bas 60 :
1. **Mini-barre sticky** (`StickyScoreBar`) : apparaît quand le bas de la ScoreCard passe sous 70px (listener scroll). Sticky à `top: var(--nav-h)`, translateY/opacity transition. Contient ticker + nom + prix + variation + pastille note + bouton watchlist.
2. **ScoreCard** : carte, grid `auto 1fr`, gap 28. À gauche `ScoreCircle` (anneau 116px, voir 5.1). À droite : H1 26px (nom) + badge ticker ; ligne secteur · prix mono · `PriceChange` ; bouton « Ajouter à la watchlist » / « Dans la watchlist » (état togglé) en haut à droite ; phrase de **verdict** 15px/1.5 `--ink-2` ; **composition de la note** = label + compteurs colorés + `CompositionBar` (barre empilée vert/orange/rouge, max 440px).
3. **Cours** : section (titre + sélecteur d'horizon `seg` : 1A / 5A / 10A / Tout). Carte contenant `PriceChart` (courbe lissée brand + aire dégradée, axe Y mono, crosshair au survol). Voir 6.1.
4. **Les chiffres** : grille des **10 critères** (`auto-fill minmax(282px,1fr)`, gap 14). Carte `CriterionCard` — voir 5.2.
5. **Résultats** (`EarningsBlock`) : grille 2 colonnes. Gauche = dernier rapport (BPA réel / attendu / surprise % colorée + ligne CA). Droite = prochain rapport (date, badge « dans N j », BPA attendu en gros, mini-histogramme battu/manqué 4 trimestres).
6. **Analyse qualitative** (optionnelle, à la demande) : tant que non lancée, carte d'invite + bouton « Lancer l'analyse qualitative ». Une fois lancée : 2 sous-grilles `QualGrid` — « Business model · 10 critères » et « Management · 5 critères » (cartes label + `StatusBadge` + note courte).
7. **Valorisation** (`ValuationBlock`) : carte grid 2 col. Gauche = 3 sliders (croissance FCF/an 0–30 %, multiple de sortie 8–40×, rendement visé 6–20 %). Droite (fond `--surface-2`) = **prix d'achat conseillé** calculé en direct (40px mono), cours actuel, badge « Sous/Au-dessus du prix conseillé · ±X % », mention que c'est jugé **séparément** de la qualité. Formule en section 7.
8. **Actualités récentes** : carte liste — source (brand, 84px min) + titre + temps relatif, lignes séparées, hover `--brand-softer`.

**Modale graphique** (`ChartModal`, dans `shell.jsx`) : ouverte au clic « Historique » d'une carte critère. Overlay `oklch(0.25 0.02 274 / 0.42)` + blur, carte centrée max 880px. En-tête : ticker + `StatusBadge` + label critère + cible. Corps : grande valeur + sélecteur de période `seg` (**1A / 5A / 10A / 20A / Tout**) + `CriterionChart` (histogramme trimestriel si `chart:"bar"` pour les flux, courbe si `"line"` pour les ratios — **gère les trous : zones vides, pas de barres collées**). Pied de stats sur fond `--surface-2`, 4 colonnes : **Dernière valeur, Moyenne, CAGR, Points (n/total)**. Fermeture : clic overlay, bouton ×, ou touche `Échap`.

### 4.3 Screener `/screener` (`screen-tables.jsx`)
- `max-width: 1440px`. En-tête : titre + sous-titre, et à droite **barre de progression de la veille** (anime de 0 à 100 %, passe au vert « À jour », libellé « N / 6 200 titres réévalués »).
- **Filtres** (carte) : « Note minimale » via `seg` (4+ / 6+ / 8+ / 9+ / 10) ; « P/FCF max » via slider 8–40× ; compteur de résultats à droite.
- **Tableau** triable (clic sur en-tête bascule asc/desc, indicateur flèche) : colonnes Société (ticker mono + nom), Secteur, **Note** (`ScorePill`, tri par défaut décroissant → 10/10 en tête), P/FCF, Cours, Var. (colorée), sparkline 1 an, chevron. Lignes hover `--brand-softer`, **clic → `/analyser` avec le ticker**.

### 4.4 Watchlist `/watchlist` (`screen-tables.jsx`)
- En-tête : titre + nombre suivi + bouton « Ajouter depuis le screener ».
- **État vide** : carte centrée (icône étoile) + bouton « Explorer le screener ».
- **Tableau** triable : Société, Cours, Var., P/FCF, Note (`ScorePill`), Prochains résultats (date + icône calendrier), bouton **retirer** (icône poubelle, hover rouge `--bad`/`--bad-bg`). Clic ligne → `/analyser`.

### 4.5 Auth `/login` & `/signup` (`screen-auth.jsx`)
- Grille 2 colonnes plein écran. Gauche = formulaire (logo, titre, e-mail avec icône, mot de passe avec toggle œil, validation, bouton brand pleine largeur, séparateur « ou », bouton « Continuer avec Google », lien bascule login↔signup). Droite = panneau sombre `--ink` avec halo brand, kicker, accroche « La donnée tranche, pas les opinions. », `HeroPreview`.
- **Validation** : e-mail doit contenir `@` ; mot de passe ≥ 6 caractères ; sinon badge d'erreur rouge. Succès → `/analyser`.

---

## 5. Composants clés (specs détaillées)

### 5.1 `ScoreCircle` — anneau de note /10
- SVG, taille par défaut 116px, stroke 9px. Cercle de fond `--line`, arc de progression coloré par niveau, `stroke-linecap: round`, départ à -90° (haut), `stroke-dasharray`/`offset` animés sur 1s `cubic-bezier(.3,.7,.3,1)`.
- **Couleur par niveau** (`scoreColor`) : note **≥ 8 → vert** (`--good`, label « Élevée »), **6–7 → orange** (`--warn`, « Moyenne »), **≤ 5 → rouge** (`--bad`, « Faible »).
- Centre : « `N`/10 » (chiffre mono ~34 % de la taille, couleur = `*-ink` du niveau) + label de niveau en capitales.

### 5.2 `CriterionCard` — carte d'un critère chiffré
- Carte, padding 15, colonne gap 9.
- Ligne haut : **label** (13px/600 `--ink-2`, max 72 %) + `StatusBadge` (OUI/PARTIEL/NON).
- Ligne valeur : **valeur** mono 25px/700 `--ink` + « cible X » mono `--ink-3` à droite.
- Note d'une ligne 12px `--ink-3` (min-height 32).
- Pied (bordure haute) : à gauche `InfoPop` (icône « i » → popover expliquant *pourquoi le critère compte* + *comment il est calculé*, fond `--ink`) ; à droite bouton « Historique » (icône barres) → ouvre `ChartModal`. Hover du bouton : fond `--brand-soft`, texte `--brand-ink`.

### 5.3 `HeroPreview`
Mini-ScoreCard statique réutilisée (Accueil + Auth) : `ScoreCircle` 88px (note 9), nom/ticker, prix, `CompositionBar` 8/2/0, 4 mini-tuiles de critères.

### 5.4 `StatusBadge` (sémantique data)
Pastille + libellé en capitales : `good → OUI` (vert), `warn → PARTIEL` (orange), `bad → NON` (rouge). Radius pill, fond `*-bg`, texte `*-ink`.

### 5.5 `ScorePill` / `PriceChange` / `IconBtn` / `Logo`
- `ScorePill` : pastille compacte « N/10 » colorée par niveau (tables).
- `PriceChange` : flèche haut/bas + « ±X % » + valeur absolue optionnelle ; vert si ≥ 0, rouge sinon ; `white-space: nowrap`.
- `IconBtn` : bouton icône 30×30, bordure `--line`, état actif `--brand-soft`.
- `Logo` : tuile arrondie 32px fond `--brand` + glyphe jauge blanc (arc + repère, évoque la note sur 10) + wordmark « Lubin » 800.

---

## 6. Graphiques (`charts.jsx`)

Tous tracés en SVG, **courbes/barres en couleur de marque `--brand`** (jamais vert/orange/rouge, réservés à la donnée). `smoothPath()` = lissage Catmull-Rom → Bézier.

### 6.1 `PriceChart` (cours)
Aire dégradée brand (16 %→0) sous une courbe lissée 2.2px ; axe Y mono (`$` + valeur, 4–5 graduations) ; gridlines `--line-soft` ; crosshair pointillé + point blanc cerclé au survol, label « Point N : $X.XX ». Largeur responsive via `ResizeObserver`.

### 6.2 `Sparkline`
Mini-courbe 86×28 sans axes ; couleur = vert si tendance haussière, rouge sinon (exception au principe « marque only » car c'est une lecture directionnelle de prix). Utilisée dans le screener.

### 6.3 `CriterionChart` (modale)
- `type:"bar"` → histogramme trimestriel, barres brand (active = `--brand-press`), ligne de zéro.
- `type:"line"` → courbe brand segmentée.
- **Gestion des trous** : les valeurs `null` laissent un **espace vide** (barres non collées / courbe coupée en segments). Axe Y mono, gridlines, survol = point + ligne verticale + label « TN : valeur ». Légende « N trimestres · zones vides = données manquantes ».

### 6.4 `CompositionBar`
Barre empilée horizontale (radius pill, hauteur 10) : segments vert/orange/rouge proportionnels au nombre de critères OUI/PARTIEL/NON.

---

## 7. Logique métier & calculs

### Les 10 critères chiffrés (page Analyser)
Rentabilité (marge nette, cible > 15 %) · Croissance du CA 5 ans (> 10 %/an) · Croissance du FCF/action 5 ans (> 10 %/an) · Marge de FCF ajustée (> 12 %) · Operating leverage (> 1,0×) · Cash ROCE (> 15 %) · Dette nette / FCF (< 3,0×) · Cash Conversion Rate (> 90 %) · Current Ratio (> 1,5×) · P/FCF actuel (< 25×).
Chaque critère porte : `value`, `target`, `status` (good/warn/bad), `note` (1 ligne), `why` (pourquoi ça compte), `calc` (formule), `chart` (`bar` pour les flux, `line` pour les ratios), `unit`. Voir `data.jsx`.

### Qualitatif
10 critères business model (moat, asset light, marché en croissance, revenus prévisibles, pricing power, diversification clients, barrières à l'entrée, scalabilité, effets de réseau, résilience aux cycles) + 5 management (allocation du capital, ancienneté du CEO, skin in the game, transparence, track record). Même format de carte.

### Valorisation — prix d'achat conseillé
Sur un horizon de **5 ans** :
```
futureFCF  = fcfPerShare × (1 + croissance)^5
exitPrice  = futureFCF × multipleSortie
buyPrice   = exitPrice / (1 + rendementVisé)^5     ← prix d'achat conseillé
upside     = (buyPrice − coursActuel) / coursActuel
```
`cheap = coursActuel ≤ buyPrice` → badge vert « Sous le prix conseillé », sinon rouge. **À garder visuellement séparé de la note de qualité.**

### État global (`app.jsx`)
- `route` (string) — écran courant.
- `pendingTicker` — ticker passé d'un écran à l'autre (clic ligne/carte → `/analyser` le charge puis le nettoie).
- `watchlist` (string[] de tickers) — `toggleWatch(ticker)` / `removeWatch(ticker)`.
- Raccourci clavier `/` → ouvre Analyser et focus la recherche.

---

## 8. Design tokens (source : `styles.css`)

> Tous en **oklch**. Reprendre les variables CSS telles quelles, ou les convertir vers le système du codebase.

**Surfaces** : `--bg oklch(0.985 0.004 270)` · `--bg-soft 0.965` · `--surface #fff` · `--surface-2 0.984` · `--line oklch(0.922 0.006 270)` · `--line-soft 0.952`.
**Texte** : `--ink 0.245/0.013/274` · `--ink-2 0.475` · `--ink-3 0.62` · `--ink-4 0.74`.
**Marque (indigo/violet — distincte des couleurs data)** : `--brand oklch(0.515 0.193 277)` · `--brand-press 0.455` · `--brand-soft 0.95/0.035/277` · `--brand-softer 0.972/0.02` · `--brand-ink 0.42/0.18/277`. Ring focus `oklch(0.515 0.193 277 / 0.35)`.
**Sémantique DATA (réservée)** : Vert/bon `--good 0.595 0.135 156` (+`-bg`, `-ink`) · Orange/partiel `--warn 0.73 0.14 71` · Rouge/danger `--bad 0.595 0.205 26`. **Règle stricte : ces 3 couleurs ne servent QUE pour la donnée ; la marque ne doit jamais être confondue avec « danger ».**
**Rayons** : 6 / 9 / 13 / 18 / 24 px + pill 999.
**Ombres** : `--sh-xs/sm/md/lg` (douces, faible opacité teintée 274) + `--sh-brand` (boutons brand).
**Type** : `--sans` = "Plus Jakarta Sans" ; `--mono` = "JetBrains Mono". **Tous les chiffres en mono tabulaire** : `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1` (classe `.num`). Letter-spacing global -0.01em ; titres -0.025em.
**Échelles d'espacement** : utilitaires `gap-2 … gap-32` (px). `--nav-h: 60px`.
**Animations** : `shimmer` (skeleton, 1.4s), `fadeUp` (.42s), `fadeIn` (.3s), `ringDraw`.

### Accessibilité (à conserver)
- Focus visible : `outline: 2.5px solid var(--brand-ring)` partout (`:focus-visible`).
- **Le sens ne repose jamais sur la seule couleur** : les badges portent un libellé texte (OUI/PARTIEL/NON), pas qu'une pastille.
- Contrastes des textes `--ink*` validés sur fonds clairs ; cibles tactiles ≥ ~36–44px.

---

## 9. Responsive
Desktop d'abord. Variante mobile incluse (voir `<style>` dans `Lubin Investment.html`) :
- `≤ 980px` : hero passe en 1 colonne (aperçu masqué), ScoreCard en 1 colonne.
- `≤ 880px` : nav app → menu burger ; grilles earnings / valorisation / étapes / auth en 1 colonne ; tableaux **scrollables horizontalement** (`overflow-x: auto`) ; footer empilé.
Les grilles de cartes (critères, vitrine, qualitatif) utilisent `auto-fill/minmax` → s'empilent naturellement.

---

## 10. Assets
- **Aucune image externe.** Logo, icônes (set line maison dans `ui.jsx` : search, plus, check, info, bars, x, arrows, sliders, calendar, etc.) et graphiques sont 100 % SVG inline → réimplémenter avec la lib d'icônes du codebase (Lucide recommandé : la plupart des glyphes y existent) ou porter les `path`.
- Polices : Plus Jakarta Sans + JetBrains Mono (Google Fonts ou self-host).

## 11. Fichiers fournis (`design/`)
`Lubin Investment.html` (entrée + responsive + chargement) · `styles.css` (tokens) · `data.jsx` · `ui.jsx` · `charts.jsx` · `shell.jsx` · `screen-home.jsx` · `screen-analyser.jsx` · `screen-tables.jsx` · `screen-auth.jsx` · `app.jsx`.
Ouvrir `Lubin Investment.html` dans un navigateur pour voir le prototype cliquable (essayer les tickers **HLMS** = 9/10 et **BRND** = 5/10).
