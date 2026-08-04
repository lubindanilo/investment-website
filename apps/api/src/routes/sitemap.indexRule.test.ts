/**
 * Verrou d'équivalence entre les DEUX expressions de la règle d'indexation des fiches.
 *
 * `renderTickerHtml` décide de la balise robots avec `shouldIndexTicker` (TypeScript), et
 * `sitemap.ts` décide du contenu des sitemaps avec une clause Prisma. Les deux doivent
 * sélectionner exactement le même ensemble de fiches. Quand elles divergent, on advertise dans
 * le sitemap des URL servies en `noindex` : signal contradictoire envoyé à Google sur des
 * milliers de pages, et un rapport de couverture illisible.
 *
 * On ne peut pas exécuter la clause Prisma sans base, donc ce test compare `shouldIndexTicker`
 * à un MIROIR JavaScript de la clause, sur une matrice exhaustive des combinaisons qui
 * comptent. Le miroir est écrit à partir de la clause, ligne par ligne.
 *
 * ⚠️ Si vous modifiez `tickerWhere()` dans sitemap.ts, modifiez `whereMirror` ici. C'est ce que
 * ce test protège : la divergence silencieuse. L'équivalence a par ailleurs été vérifiée
 * empiriquement sur la base de production le 4 août 2026 (6 818 fiches scorées, ensembles
 * identiques).
 */
import { describe, it, expect } from 'vitest';
import { shouldIndexTicker, type TickerIndexInput } from './seoPrerender.js';

/**
 * Miroir de `tickerWhere()` de sitemap.ts :
 *
 *   status: 'scored',
 *   OR: [
 *     { opportunity: true },
 *     { ticker: { in: articleTickers } },
 *     { AND: [
 *         { pfcfTTM: { not: null } },
 *         { OR: [
 *             { scoreRatio: { gte: 0.5 } },
 *             { scoreRatio: null },
 *             { AND: [
 *                 { OR: [{ price: null }, { price: { gte: 1 } }] },
 *                 { NOT: { region: 'US', marketCap: { lt: 500_000_000 } } },
 *             ] },
 *         ] },
 *     ] },
 *   ]
 */
function whereMirror(t: TickerIndexInput): boolean {
  if (t.opportunity) return true;
  if (t.hasArticle) return true;
  if (t.pfcfTTM == null) return false;
  if (t.scoreRatio != null && t.scoreRatio >= 0.5) return true;
  if (t.scoreRatio == null) return true;
  const priceOk = t.price == null || t.price >= 1;
  // NOT { region: 'US', marketCap: { lt: 500M } } : le NOT porte sur la CONJONCTION des deux.
  const notVerySmallCapUS = !(t.region === 'US' && t.marketCap != null && t.marketCap < 500_000_000);
  return priceOk && notVerySmallCapUS;
}

const SCORE_RATIOS = [null, 0, 0.3, 0.49, 0.5, 0.8, 1];
const PFCF = [null, 8.4, 51.1];
const PRICES = [null, 0.4, 1, 42];
const REGIONS = [null, 'US', 'EU', 'JP'];
const CAPS = [null, 1e6, 499_999_999, 500_000_000, 3e11];
const BOOLS = [false, true];

function matrix(): TickerIndexInput[] {
  const rows: TickerIndexInput[] = [];
  for (const scoreRatio of SCORE_RATIOS)
    for (const pfcfTTM of PFCF)
      for (const price of PRICES)
        for (const region of REGIONS)
          for (const marketCap of CAPS)
            for (const opportunity of BOOLS)
              for (const hasArticle of BOOLS)
                rows.push({ scoreRatio, pfcfTTM, price, region, marketCap, opportunity, hasArticle });
  return rows;
}

describe('règle d\'indexation des fiches : prédicat contre clause de sitemap', () => {
  const rows = matrix();

  it('couvre une matrice non triviale', () => {
    expect(rows.length).toBe(
      SCORE_RATIOS.length * PFCF.length * PRICES.length * REGIONS.length * CAPS.length * 4,
    );
  });

  it('donne le MÊME verdict sur toute la matrice', () => {
    const divergences = rows
      .filter((r) => shouldIndexTicker(r) !== whereMirror(r))
      .slice(0, 5);
    expect(
      divergences,
      `Le prédicat de seoPrerender et la clause de sitemap ne sont plus d'accord. ` +
      `Le sitemap advertiserait des URL en noindex (ou masquerait des URL indexables). ` +
      `Cas divergents : ${JSON.stringify(divergences)}`,
    ).toEqual([]);
  });

  // Cas nommés : ils documentent l'intention, indépendamment de la matrice.
  it('exclut une fiche sans multiple de valorisation (palier 1 du 2026-08-04)', () => {
    expect(shouldIndexTicker({
      scoreRatio: 1, pfcfTTM: null, price: 120, region: 'US',
      marketCap: 5e9, opportunity: false, hasArticle: false,
    })).toBe(false);
  });

  it('garde une fiche sans multiple si elle est une opportunité du moment', () => {
    expect(shouldIndexTicker({
      scoreRatio: 0.9, pfcfTTM: null, price: 120, region: 'US',
      marketCap: 5e9, opportunity: true, hasArticle: false,
    })).toBe(true);
  });

  it('garde une fiche sans multiple si un article la traite', () => {
    expect(shouldIndexTicker({
      scoreRatio: 0.2, pfcfTTM: null, price: 0.5, region: 'US',
      marketCap: 1e6, opportunity: false, hasArticle: true,
    })).toBe(true);
  });

  it('exclut un penny stock mal noté, garde le même titre au-dessus de 1 $', () => {
    const base = {
      scoreRatio: 0.3, pfcfTTM: 12, region: 'EU',
      marketCap: 2e9, opportunity: false, hasArticle: false,
    };
    expect(shouldIndexTicker({ ...base, price: 0.4 })).toBe(false);
    expect(shouldIndexTicker({ ...base, price: 4 })).toBe(true);
  });

  it('exclut une micro cap US mal notée, mais pas une micro cap non US', () => {
    const base = {
      scoreRatio: 0.3, pfcfTTM: 12, price: 20,
      marketCap: 100e6, opportunity: false, hasArticle: false,
    };
    expect(shouldIndexTicker({ ...base, region: 'US' })).toBe(false);
    expect(shouldIndexTicker({ ...base, region: 'EU' })).toBe(true);
  });

  it('garde une fiche bien notée avec multiple, même petite et non US', () => {
    expect(shouldIndexTicker({
      scoreRatio: 1, pfcfTTM: 8.4, price: 15, region: 'JP',
      marketCap: 80e6, opportunity: false, hasArticle: false,
    })).toBe(true);
  });
});
