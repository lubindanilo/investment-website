# MCP Lubin Investment — Journal de chantier

Trace de construction du serveur MCP. Le plus récent en haut.
Spec : [SPEC.md](./SPEC.md). Branche : `claude/mcp-portfolio-analysis-3c5cd9`.

---

## 2026-07-31 — Page de consentement : allègement du texte (décision produit)

Deux blocs retirés de la page de consentement à la demande de Lubin, jugés trop lourds
visuellement :

1. Le bandeau **« Tes données seront envoyées à &lt;domaine&gt;. Si tu ne reconnais pas ce
   site, refuse. »**
2. La note **« Pour révoquer cet accès, réinitialise le mot de passe… »**

### Ce que ça change côté sécurité (à assumer en connaissance de cause)

Le bandeau (1) était le correctif du point **HIGH n°3** de la passe du 30/07. L'enregistrement
dynamique de clients étant ouvert (exigence du connecteur claude.ai), n'importe qui peut
enregistrer un client nommé « Lubin Investment » pointant vers son propre domaine, puis
envoyer à une victime un lien vers la **vraie** page d'autorisation. Le domaine de destination
était le seul élément non falsifiable affiché ; sans lui, l'utilisateur n'a plus aucun signal.

Ce qui protège encore :
- `redirect_uri` en **allowlist stricte par client** : le code ne part que vers une URI que
  CE client a enregistrée (aucune redirection arbitraire possible).
- Le mot de passe est exigé à chaque autorisation (pas d'approbation en un clic via cookie).
- Révocation toujours effective via le reset de mot de passe, même si la page ne le dit plus.

Le test `affiche la destination du code…` a été retiré (et non transformé en test d'absence,
pour ne pas bloquer un futur retour en arrière). Un commentaire dans `renderConsentPage`
signale que le retrait est un choix produit.

**Piste si on veut le garde-fou sans le bandeau** : afficher le domaine de façon discrète
dans la phrase d'introduction (« Claude (claude.ai) demande à accéder… ») plutôt qu'en
encadré jaune. Non implémenté.

### Gate

`tsc --noEmit` vert, suite complète verte (199 tests). Rendu contrôlé au navigateur
(variante nominale + variante avec erreur) : espacement de la carte toujours équilibré.

---

## 2026-07-30 — Phase 3 : durcissement du connecteur + upsell

### Fait

- **Rate-limit MCP branché** : `mcpLimiter` (120/min/IP) sur `POST /api/mcp` et `/api/mcp/status`.
  Un client MCP est bavard, mais chaque appel peut déclencher un compute lourd
  (`analyze_watchlist`) → plafond intermédiaire, confortable pour un humain, qui casse
  une boucle d'agent emballée.
- **Upsell structuré** : tout refus lié à l'offre (quota d'analyses épuisé, comparaison
  au-delà de 2 titres, watchlist pleine) renvoie désormais `code: PRO_REQUIRED` +
  `upgradeUrl` vers `/pricing`. L'assistant peut proposer l'abonnement au lieu de dire
  juste « non ». Un Pro qui dépasse le plafond absolu (5 titres) reçoit `TOO_MANY`
  **sans** upsell (ce n'est pas un problème d'offre).
- `McpContext` porte la base URL publique (`baseUrl`), passée depuis la requête.
- **Tests** : le paywall + le lien d'upsell sont verrouillés par test (le plafond est
  vérifié avant tout accès aux données → testable sans base).

### Gate

- `tsc --noEmit` : **vert**.
- Suite complète : **verte, 179 tests / 13 fichiers**.

### Reste à faire

- [ ] **Test réel du connecteur sur claude.ai** — nécessite un déploiement (voir la
      marche à suivre dans [SPEC.md](./SPEC.md#13-brancher-le-connecteur-sur-claudeai)).
- [ ] Appliquer la migration `*_mcp_oauth` en prod (via le déploiement Vercel).

---

## 2026-07-30 — Passe de sécurité (avant merge)

Revue adversariale de la surface OAuth + MCP. 11 points traités, tous vérifiés par lecture
du code puis verrouillés par des tests de non-régression quand c'était possible.

### Corrigé — sérieux

1. **Brute-force sur `POST /api/oauth/authorize`** (HIGH). Ce handler vérifie un mot de
   passe mais ne recevait que le limiteur global (**1000/min**), alors que le site pose
   `authLimiter` (**10/min**) sur `/api/auth/login` précisément pour casser le brute-force.
   Le serveur OAuth offrait donc un contournement 100× plus permissif du propre plafond du
   site. → `authLimiter` appliqué.
2. **DCR non authentifié et non borné** (HIGH). `redirect_uris` n'avait ni plafond de
   taille ni de cardinalité, et la table n'a pas de purge : ~1 Mo par requête écrit en
   base, à volonté. → bornes `max(5)` / `max(500)` par URI + `oauthRegisterLimiter` (20/min).
3. **Hameçonnage hébergé sur notre domaine** (HIGH). N'importe qui peut enregistrer un
   client nommé « Lubin Investment » pointant vers son domaine ; la page de consentement
   affichait le nom du client mais **jamais où partirait le code**. → la page affichait
   le domaine de destination. **⚠ REVENU EN ARRIÈRE le 31/07** (cf. entrée du 31/07
   ci-dessous) : le bandeau a été retiré sur décision produit. Le risque décrit ici est
   donc de nouveau ouvert, et assumé.
4. **Issuer OAuth dérivé du header `Host`** (MEDIUM). Sans `SITE_URL`, les métadonnées de
   découverte annonçaient les endpoints d'un `Host:` forgé. → repli en dur sur le domaine
   de production dès qu'on est déployé, headers seulement en dev local.
5. **Énumération de comptes par timing** (MEDIUM). Le `bcrypt` était sauté pour un email
   inconnu, alors que `/api/auth/login` compare exprès un hash factice pour l'éviter.
   → même parade.
6. **Pas de détection de rejeu de refresh token** (MEDIUM). Rejouer un refresh révoqué est
   LE signal de vol : on révoque désormais toute la famille (`userId` + `clientId`), donc
   le voleur perd aussi le successeur.
7. **Reset de mot de passe sans effet sur l'accès MCP** (MEDIUM). Un reset sert à couper un
   accès compromis, mais laissait 60 jours d'accès API au voleur. → `reset-password` révoque
   les refresh tokens. La page de consentement décrit maintenant ce mécanisme réel au lieu de
   promettre une révocation inexistante.
8. **`scope` et `resource` acceptés sans validation** (MEDIUM). Un client pouvait
   s'auto-attribuer `scope=admin` ou une audience arbitraire. → `invalid_scope` /
   `invalid_target`, et l'audience est vérifiée côté ressource quand la base URL est fiable.
9. **Code d'autorisation survivant à un échange raté** (LOW). Un échange qui échoue est un
   signe de fuite → le code est maintenant brûlé **avant** validation (l'anti-double-spend
   atomique est conservé).
10. **Page de consentement cacheable et encadrable** (LOW). → `no-store`,
    `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

### Vérifié sain (contrôlé, non modifié)

Open redirect (validation du `redirect_uri` **avant** toute redirection, match exact sans
joker), downgrade PKCE vers `plain` (impossible : `S256` forcé sur tous les chemins),
double-spend de code (compare-and-swap atomique), XSS de la page de consentement (tout est
échappé), CSRF du formulaire (non exploitable : mot de passe exigé dans le corps — ce qui
vaut comme garde-fou : ne PAS « améliorer » l'UX en auto-approuvant via le cookie de session
sans ajouter un jeton anti-CSRF), séparation des clés de signature web/MCP, `alg: none`
(algorithmes épinglés), stockage des refresh (hashés).

### Tests

`apps/api/src/routes/oauth.test.ts` — **30 tests** : parcours complet
(register → authorize → token → appel Bearer), plus les cas d'attaque (PKCE invalide,
rejeu de code, `redirect_uri` hors allowlist, XSS, scope/resource invalides, code brûlé,
rotation + révocation de famille, révocation au reset, cookie web refusé comme token MCP).

⚠ Les rate limiters sont désactivés en test (`SKIP_IN_TESTS`) : leur câblage est vérifié par
lecture, pas par test.

---

## 2026-07-30 — Phase 2 : watchlist + composite `analyze_watchlist`

### Fait

- **Extraction service** `apps/api/src/services/watchlistSnapshot.ts` : `computeAndCache` +
  `FREE_WATCHLIST_LIMIT` sortis de `routes/watchlist.ts` et importés par les DEUX surfaces
  (HTTP + MCP). Motif : ces 50 lignes portent la formule du score et l'extraction
  `adjFcfTtm`/`sharesOutstanding` ; les dupliquer aurait fait diverger la note MCP de celle
  du site. Comportement de la route inchangé.
- **4 tools watchlist** (`mcp/tools.ts` + `mcp/server.ts`) :
  - `get_watchlist` — listing depuis le cache global (2 requêtes, 0 calcul). Champs nommés
    `priceAtLastCompute` / `pfcfAtLastCompute` pour qu'un prix figé ne soit pas présenté
    comme un cours en direct.
  - `analyze_watchlist` — **le composite** : analyse chaque ligne (note /10, résilience,
    tendance, prix vs juste prix) puis synthétise (note moyenne, maillons faibles,
    fondamentaux en dégradation, titres au-dessus du juste prix, opportunités).
  - `add_to_watchlist` — plafond Free réutilisé, upsert, calcule le snapshot s'il manque.
  - `remove_from_watchlist` — retire la ligne user (cache global préservé).
- **Annotations MCP** sur les 10 tools : `readOnlyHint` partout en lecture ;
  `readOnlyHint:false` + `idempotentHint` sur `add_to_watchlist` ; + `destructiveHint:true`
  sur `remove_from_watchlist` → le client MCP sait ce qui mute des données utilisateur.
- **Tests** (`mcp/server.test.ts`) : `tools/list` = les 10 tools, et vérification que les
  tools d'écriture sont bien marqués non read-only.

### Gate

- `tsc --noEmit` : **vert**.
- Suite complète `vitest run` : **verte, 149 tests / 12 fichiers** (lancée avec un
  `DATABASE_URL` factice — `dotenv` sans `override` n'écrase pas une var déjà posée, donc
  le `.env` prod n'est jamais chargé).

### Décisions

- **Pas de décompte de quota** sur les tools watchlist : le site ne décompte rien sur
  `GET /api/watchlist` ni sur `/refresh`. La watchlist Free est déjà plafonnée à 10 titres.
  Cohérence avec le site plutôt qu'un quota inventé pour le MCP.
- **Seuils de la synthèse renvoyés dans la réponse** (`thresholds`) et calqués sur
  l'existant : maillon faible = note < 5/10 ou résilience D/E (`resilienceAllowsOpportunity`) ;
  dilution = > 2,5 %/an (seuil « warn » du critère `shareCount5y`). Le LLM lit les seuils
  au lieu d'en inventer.
- **Plafond `ANALYZE_WATCHLIST_MAX = 25`** + concurrence bornée à 4 : le composite fait un
  compute par ligne (lambda 60 s, rate-limit Finnhub). La troncature est **explicite** dans
  la réponse (`truncated`, `skippedForLimit`), jamais silencieuse.
- Les tickers non couverts remontent dans `summary.notCovered` au lieu d'être avalés.

### Reste à faire

- [ ] E2E `tools/call` sur un déploiement (idem Phase 1 : `analyze_watchlist` écrit dans les
      caches globaux via `computeAndCache`, donc pas de test local contre la prod).
- [ ] Tests d'intégration OAuth (report Phase 0) + passe `/security-review` avant merge.

### Prochaine phase

Phase 3 : CORS/origine claude.ai, rate-limits dédiés au MCP, upsell structuré `PRO_REQUIRED`
(lien de checkout), puis test réel du connecteur sur claude.ai.

---

## 2026-07-30 — Phase 1 : transport MCP + tools lecture

### Fait

- **Dépendance** : ajout de `@modelcontextprotocol/sdk` (v1.30.0) à `apps/api` (package.json + lockfile).
- **Couche MCP** (`apps/api/src/mcp/`) — lecture seule, réutilise les fonctions pures/caches existants, projections COMPACTES pour LLM (pas le gros `AnalyzeResponse` de l'UI) :
  - `tools.ts` : `searchTicker`, `analyzeStock`, `screenStocks`, `getResilience`, `fundamentalsTrend`, `compareStocks` (+ `buildCompactQuant` partagé).
  - `gating.ts` : `loadMcpContext` (statut Pro via `isProActive`), `consumeAnalysisQuota` (miroir du quota 10/24 h), plafonds compare 2/5.
  - `server.ts` : `buildMcpServer(ctx)` enregistre les 6 tools avec schémas zod + gating membre/Pro au call.
- **Transport** : `apps/api/src/routes/mcp.ts` branché sur `StreamableHTTPServerTransport` **stateless** (`sessionIdGenerator` omis, `enableJsonResponse: true`), une instance serveur/ transport par requête, liée à l'utilisateur. GET/DELETE → 405. `/api/mcp/status` conservé.
- **Test** `apps/api/src/mcp/server.test.ts` : monte le serveur via `InMemoryTransport` + `Client`, vérifie `tools/list` = les 6 tools (aucun handler appelé → zéro DB). **Vert.**

### Gate

- `pnpm --filter @lubin/api run lint` (`tsc --noEmit`) : **vert** (compile du 1er coup après vérif des signatures SDK réelles).
- Test isolé `vitest run src/mcp/server.test.ts` : **vert** (DB non touchée).

### Décisions

- Sorties de tools **compactes et lisibles** (JSON projeté), pas les DTO complets de l'UI → contexte LLM maîtrisé + découplage de l'UI.
- `analyze_stock`/`compare_stocks` réutilisent un `buildCompactQuant` commun (chemin rapide `getServableSnapshot` → 0 appel lourd si l'univers est déjà scoré). Le flag `opportunity` vient de la ligne screener (figé au dernier scoring) → lecture bon marché.
- `fundamentals_trend` expose les signaux de tendance DÉJÀ calculés (CAGR, marges, dilution, CCC) plutôt que de reproduire la route `/timeseries` (évite ses cascades EU/ADR) → répond direct à « ça s'améliore ? ».

### Reste à faire

- [ ] Test E2E `tools/call` contre données réelles (lecture) — non lancé en local pour ne pas écrire dans les caches prod via `loadQuantData` ; à faire sur un déploiement/preview. Procédure manuelle ci-dessous.
- [ ] Tests d'intégration OAuth (report Phase 0) + passe `/security-review` avant merge.

### Test E2E manuel (sur un environnement avec DB)

Après OAuth (cf. Phase 0, étapes 1-5) et obtention d'un `access_token` :
1. `POST /api/mcp` (Bearer) body `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"x","version":"0"}}}` → réponse `initialize`.
2. `POST /api/mcp` `method:"tools/list"` → les 6 tools.
3. `POST /api/mcp` `method:"tools/call"`, `params:{"name":"search_ticker","arguments":{"query":"app"}}` → correspondances.
4. `tools/call` `analyze_stock {ticker:"AAPL"}` en membre free ×11 → la 11ᵉ renvoie `QUOTA_EXCEEDED`.

### Prochaine phase

Phase 2 : watchlist (`get/add/remove`) + `analyze_watchlist` composite (nécessite un scope/tool user-scoped, la watchlist étant per-user).

---

## 2026-07-30 — Phase 0 : fondations OAuth (démarrée)

### Fait

- **Modèle de données** (`apps/api/prisma/schema.prisma`) : ajout de `OAuthClient`,
  `OAuthAuthCode`, `OAuthRefreshToken` + back-relations sur `User`.
- **Migration** `apps/api/prisma/migrations/20260730131230_mcp_oauth/migration.sql`
  générée par **diff de schémas hors-ligne** (aucun contact avec la DB Neon prod).
  Contenu : 3 tables + index + FK cascade. **Pas encore appliquée** (voir Sécurité DB).
- **Helpers** `apps/api/src/lib/oauth.ts` : PKCE S256, JWT access token MCP (secret
  dérivé d'`AUTH_SECRET`), refresh opaque + sha256, `getBaseUrl`, `mcpResourceUrl`.
- **Authorization Server** `apps/api/src/routes/oauth.ts` :
  - `POST /api/oauth/register` (DCR, RFC 7591)
  - `GET /api/oauth/authorize` (page login + consentement, HTML échappé)
  - `POST /api/oauth/authorize` (vérifie identifiants via `verifyPassword`, émet le code)
  - `POST /api/oauth/token` (`authorization_code` + `refresh_token` avec rotation)
  - `wellKnownRouter` : `.well-known/oauth-authorization-server` + `oauth-protected-resource`
- **Middleware** `apps/api/src/middleware/mcpAuth.ts` : `requireMcpAuth` (valide le
  Bearer, pose `req.user` + `req.mcpScope`, renvoie `WWW-Authenticate` sinon).
- **Endpoint MCP** `apps/api/src/routes/mcp.ts` : stub protégé (`/api/mcp/status`
  authentifié + `/api/mcp` → 501). Prouve la chaîne OAuth de bout en bout.
- **Câblage** `apps/api/src/server.ts` : montage `wellKnownRouter` (racine),
  `oauthRouter` (`/api/oauth`), `mcpRouter` (`/api/mcp`).
- **`vercel.json`** : rewrites `/.well-known/oauth-*` → `/api/[...all]`.
- **`.env.example`** : section MCP/OAuth (aucun nouveau secret requis ; `PUBLIC_BASE_URL` optionnel).

### Gate

- `prisma generate` : OK (client v6.19.3 régénéré avec les nouveaux modèles).
- `pnpm --filter @lubin/api run lint` (`tsc --noEmit`) : **vert** (après fix d'un
  `noUncheckedIndexedAccess` sur le parse du Bearer).
- Tests vitest + `build:vercel` : **non lancés** ici (build:vercel touche la DB prod ;
  à faire dans le contexte de gate hermétique / CI).

### Sécurité DB (rappel)

Le `.env` local pointe sur **Neon prod**. Donc : aucune commande `migrate` /
`build:vercel` lancée en local. La migration s'appliquera via le chemin Vercel
(`build:vercel` → `scripts/migrate-vercel.mjs`) au déploiement.

### Décisions prises en cours de route

- Access token MCP **stateless** (JWT), secret **dérivé d'AUTH_SECRET** → zéro
  nouveau secret à provisionner, et séparation de domaine avec le cookie web.
- `/authorize` **redemande les identifiants** (pas de SSO via cookie site en v1) →
  plus simple et sûr côté CSRF.
- Un seul scope OAuth `mcp` ; le gating Pro/membre reste **côté serveur**.

### Reste à faire (Phase 0 → clôture)

- [ ] Tests d'intégration du flow OAuth (supertest : register → authorize → token →
      `/api/mcp/status`) + cas d'erreur (PKCE KO, code réutilisé, redirect_uri hors allowlist).
- [ ] Passe `/security-review` avant merge.
- [ ] Appliquer la migration en prod (via déploiement Vercel).

### Prochaine phase

Phase 1 : ajouter `@modelcontextprotocol/sdk`, brancher le StreamableHTTPServerTransport
sur `/api/mcp`, enregistrer les tools lecture + le gating par palier.
