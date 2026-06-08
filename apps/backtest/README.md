# @lubin/backtest

Backtest **point-in-time** des critères de Lubin Investment — projet **séparé du site**.
Objectif : mesurer si la stratégie « opportunité du moment » (note ≥ 8/10 + P/FCF < 25 +
P/FCF ≤ 10ᵉ percentile historique) aurait battu le marché sur le long terme, et itérer sur
les seuils (8 vs 9 vs 10) et la valeur ajoutée des critères.

## Principe : « ingérer une fois, rejouer hors-ligne »

1. **Ingestion** (`src/ingest`) — crawl reprenable qui stocke, par ticker, la donnée BRUTE :
   filings Finnhub `/financials-reported` (avec `filedDate`), prix mensuels Yahoo
   (`close` brut + `adjClose`), splits. Stocké en JSON sous `.data/` (gitignoré).
2. **Moteur point-in-time** (`src/engine`, P1) — rejoue le score exact de l'app à une date `T`
   passée, sans look-ahead, en réutilisant les fonctions PURES de `@lubin/api`.
3. **Runner** (`src/backtest`, P3) — cohortes, détention jusqu'à aujourd'hui, alpha vs SPY.
4. **Analytics** (Python, P4) — sweep seuils + ablation des critères depuis le panel exporté.

## Biais assumés (tier gratuit)

- **Survie 🔴** : univers = titres existant aujourd'hui → l'alpha absolu n'est PAS vendable
  sans dataset point-in-time payant (titres délistés). Le gratuit sert à comparer des seuils.
- **Qualitatif non rejouable 🔴** : les 15 critères GPT ont un biais de rétrospective →
  mesurés seulement en forward (logger paper-trade), pas en backtest historique.

## Commandes

```bash
# Ingestion (PoC : 10 tickers + SPY)
tsx src/ingest/run.ts
# Tickers explicites
tsx src/ingest/run.ts AAPL MSFT GOOGL
```

Nécessite `FINNHUB_API_KEY` (lu depuis `process.env` ou le `.env` racine du monorepo).
