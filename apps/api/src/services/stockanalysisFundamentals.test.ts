/**
 * Parsing des pages stockanalysis.
 *
 * Le payload est un objet JS embarqué dans le HTML, sans contrat : le site l'a déplacé sur la
 * page « compte de résultat » (`financialData:void 0` + `data:{…}`) et a renommé ses champs
 * (`opinc`, `netinccmn`). Le parser ne trouvait plus rien et le caller lisait ce null comme
 * « source indisponible pour ce ticker » — donc AUCUN chiffre d'affaires EU n'était accumulé,
 * sans une seule erreur en log. Ces tests figent les deux formes observées en prod.
 */
import { describe, it, expect } from 'vitest';
import { parsePage, addSeries, buildUrls, deriveFcf, detectCadence } from './stockanalysisFundamentals.js';
import type { TimeseriesPoint } from '@lubin/shared';

/** Forme HISTORIQUE, toujours servie sur cash-flow / balance-sheet. */
const OLD_SHAPE = `<script>self.__next_f.push([1,"…,financialData:{datekey:["2025-12-31","2024-12-31"],`
  + `fiscalYear:[2025,2024],ncfo:[11886000000,11714000000],capex:[-3873000000,-4052000000],`
  + `fcf:[8013000000,7662000000]},map:[],prior:void 0"])</script>`;

/** Forme ACTUELLE de la page income : financialData vidé, séries déplacées sous `data:{…}`. */
const NEW_SHAPE = `<script>self.__next_f.push([1,"…,financialData:void 0,map:[],prior:void 0,`
  + `sections:[{id:"revenue-income",title:"Revenue",fc:"revenueTotal"},{id:"eps",fc:"eps"}],`
  + `data:{datekey:["2025-12-31","2024-12-31","2023-12-31"],fiscalYear:[2025,2024,2023],`
  + `revenue:[75372000000,72459000000,69619000000],gp:[null,null,null],`
  + `opinc:[7325000000,6941000000,6600000000],netinccmn:[4880000000,4805000000,4703000000],`
  + `epsdil:[8.42,8.16,7.86]},chartData:[]"])</script>`;

/** Page ANNUELLE : la 1re colonne est « TTM », pas un exercice. */
const ANNUAL_WITH_TTM = `<script>…financialData:{datekey:["TTM","2025-12-31","2024-12-31"],`
  + `ncfo:[12147000000,11886000000,11714000000],fcf:[8276000000,8013000000,7662000000]}…</script>`;

describe('parsePage', () => {
  it('parse la forme historique `financialData:{…}`', () => {
    const p = parsePage(OLD_SHAPE, ['ncfo', 'capex', 'fcf']);
    expect(p).not.toBeNull();
    expect(p!.dates).toEqual(['2025-12-31', '2024-12-31']);
    expect(p!.freq).toBe('annual');
    expect(p!.fields.ncfo).toEqual([11_886_000_000, 11_714_000_000]);
  });

  /** Régression : c'est ce cas qui renvoyait null pour TOUS les tickers. */
  it('parse la page income dont le payload a migré sous `data:{…}`', () => {
    const p = parsePage(NEW_SHAPE, ['revenue', 'opinc', 'netinccmn']);
    expect(p).not.toBeNull();
    expect(p!.dates).toEqual(['2025-12-31', '2024-12-31', '2023-12-31']);
    expect(p!.fields.revenue).toEqual([75_372_000_000, 72_459_000_000, 69_619_000_000]);
    expect(p!.fields.opinc).toEqual([7_325_000_000, 6_941_000_000, 6_600_000_000]);
    expect(p!.fields.netinccmn).toEqual([4_880_000_000, 4_805_000_000, 4_703_000_000]);
  });

  it('détecte la cadence semestrielle des émetteurs qui ne publient pas de Q1/Q3', () => {
    const html = `…financialData:{datekey:["2026-06-30","2025-12-31","2025-06-30","2024-12-31"],`
      + `revenue:[36039000000,40172000000,35200000000,38213000000]}…`;
    expect(parsePage(html, ['revenue'])!.freq).toBe('semiannual');
  });

  it('renvoie null si la page ne porte aucune série', () => {
    expect(parsePage('<html><body>404</body></html>', ['revenue'])).toBeNull();
  });
});

describe('addSeries', () => {
  it('mappe les champs du payload vers les clés métriques internes, en ordre chronologique', () => {
    const out = new Map<string, TimeseriesPoint[]>();
    addSeries(out, parsePage(NEW_SHAPE, ['revenue', 'opinc', 'netinccmn']), {
      revenue: 'revenue', opinc: 'operatingIncome', netinccmn: 'netIncome',
    });
    expect([...out.keys()].sort()).toEqual(['netIncome', 'operatingIncome', 'revenue']);
    expect(out.get('revenue')!.map(p => p.date)).toEqual(['2023-12-31', '2024-12-31', '2025-12-31']);
    expect(out.get('revenue')!.at(-1)!.value).toBe(75_372_000_000);
  });

  /** La colonne TTM entrait en base comme un point de date "TTM" : elle triait après toute date
   *  ISO, devenait donc `lastEnd` et repoussait l'expiration de la ligne d'un an. */
  it('écarte la colonne TTM des pages annuelles', () => {
    const out = new Map<string, TimeseriesPoint[]>();
    addSeries(out, parsePage(ANNUAL_WITH_TTM, ['ncfo', 'fcf']), { ncfo: 'cfo', fcf: 'fcf' });
    const cfo = out.get('cfo')!;
    expect(cfo.map(p => p.date)).toEqual(['2024-12-31', '2025-12-31']);
    // La valeur TTM (12 147) ne doit apparaître nulle part.
    expect(cfo.some(p => p.value === 12_147_000_000)).toBe(false);
  });

  it('ignore un champ absent de la page sans casser les autres', () => {
    const out = new Map<string, TimeseriesPoint[]>();
    addSeries(out, parsePage(OLD_SHAPE, ['ncfo', 'sbcomp']), { ncfo: 'cfo', sbcomp: 'sbc' });
    expect(out.has('cfo')).toBe(true);
    expect(out.has('sbc')).toBe(false);
  });
});

/** La route timeseries s'en sert pour décider si une série du store est trimestrielle ou
 *  semestrielle — donc si une barre s'étiquette « Q3 2025 » ou « S2 2025 ». */
describe('detectCadence', () => {
  it('reconnaît un vrai trimestriel', () => {
    expect(detectCadence(['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'])).toBe('quarterly');
  });

  it('reconnaît le semestriel des émetteurs sans Q1/Q3', () => {
    expect(detectCadence(['2024-06-30', '2024-12-31', '2025-06-30', '2025-12-31'])).toBe('semiannual');
  });

  it('reconnaît l’annuel', () => {
    expect(detectCadence(['2023-12-31', '2024-12-31', '2025-12-31'])).toBe('annual');
  });

  it('est insensible à l’ordre (les pages listent du plus récent au plus ancien)', () => {
    expect(detectCadence(['2025-12-31', '2025-06-30', '2024-12-31', '2024-06-30'])).toBe('semiannual');
  });

  it('ignore les entrées non datées plutôt que de les compter comme un écart', () => {
    expect(detectCadence(['TTM', '2025-12-31', '2024-12-31', '2023-12-31'])).toBe('annual');
  });

  /** Un trou isolé ne doit pas requalifier la série : on prend la MÉDIANE des écarts. */
  it('résiste à un trou isolé', () => {
    expect(detectCadence(['2024-03-31', '2024-06-30', '2025-06-30', '2025-09-30', '2025-12-31'])).toBe('quarterly');
  });
});

describe('deriveFcf', () => {
  /** Semestres réels de Vinci (page trimestrielle, qui n'expose pas de ligne fcf) : la somme
   *  cfo + capex de 2025 redonne 8 013 M€, le FCF publié sur sa page annuelle. */
  it('reconstitue le FCF depuis cfo + capex quand la page ne le publie pas', () => {
    const series = new Map<string, TimeseriesPoint[]>([
      ['cfo',   [{ date: '2025-06-30', value: 2_408_000_000 }, { date: '2025-12-31', value: 9_478_000_000 }]],
      ['capex', [{ date: '2025-06-30', value: -1_827_000_000 }, { date: '2025-12-31', value: -2_046_000_000 }]],
    ]);
    deriveFcf(series);
    const fcf = series.get('fcf')!;
    expect(fcf.map(p => p.value)).toEqual([581_000_000, 7_432_000_000]);
    expect(fcf[0]!.value + fcf[1]!.value).toBe(8_013_000_000);
  });

  it('ne touche pas au FCF publié par la source', () => {
    const series = new Map<string, TimeseriesPoint[]>([
      ['cfo',   [{ date: '2025-12-31', value: 100 }]],
      ['capex', [{ date: '2025-12-31', value: -40 }]],
      ['fcf',   [{ date: '2025-12-31', value: 55 }]],
    ]);
    deriveFcf(series);
    expect(series.get('fcf')).toEqual([{ date: '2025-12-31', value: 55 }]);
  });

  it('n’apparie que les périodes présentes dans les deux séries', () => {
    const series = new Map<string, TimeseriesPoint[]>([
      ['cfo',   [{ date: '2024-12-31', value: 90 }, { date: '2025-12-31', value: 100 }]],
      ['capex', [{ date: '2025-12-31', value: -40 }]],
    ]);
    deriveFcf(series);
    expect(series.get('fcf')).toEqual([{ date: '2025-12-31', value: 60 }]);
  });

  it('reste muet si une des deux jambes manque', () => {
    const series = new Map<string, TimeseriesPoint[]>([['cfo', [{ date: '2025-12-31', value: 100 }]]]);
    deriveFcf(series);
    expect(series.has('fcf')).toBe(false);
  });
});

describe('buildUrls', () => {
  it('cible la page annuelle quand la période demandée est annuelle', () => {
    const urls = buildUrls('DG.PA', 'income', 'annual');
    expect(urls).toContain('https://stockanalysis.com/quote/epa/DG/financials/?p=annual');
    expect(urls.every(u => u.endsWith('?p=annual'))).toBe(true);
  });

  it('reste sur la page trimestrielle par défaut', () => {
    expect(buildUrls('DG.PA', 'cash-flow')).toContain(
      'https://stockanalysis.com/quote/epa/DG/financials/cash-flow-statement/?p=quarterly',
    );
  });
});
