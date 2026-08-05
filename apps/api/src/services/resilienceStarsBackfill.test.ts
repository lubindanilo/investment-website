import { describe, expect, it } from 'vitest';
import { groupRowsByCompany } from './resilienceStarsBackfill.js';

const row = (ticker: string, name: string | null, marketCapUsd = 1) => ({
  ticker,
  name,
  sector: null,
  marketCapUsd,
});

describe('groupRowsByCompany', () => {
  it('regroupe les doubles cotations d une meme societe', () => {
    const groups = groupRowsByCompany([
      row('BRK.B', 'Berkshire Hathaway Inc', 3),
      row('AAPL', 'Apple Inc.', 2),
      row('BRK.A', 'Berkshire Hathaway Inc', 1),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.rows.map(r => r.ticker)).toEqual(['BRK.B', 'BRK.A']);
    expect(groups[1]!.rows.map(r => r.ticker)).toEqual(['AAPL']);
  });

  it('regroupe les trois lignes HSBC malgre les accents et la ponctuation', () => {
    const groups = groupRowsByCompany([
      row('0005.HK', 'HSBC Holdings plc'),
      row('HSBA.L', 'HSBC  Holdings, plc'),
      row('HSBC', 'HSBC Holdings PLC'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.rows.map(r => r.ticker)).toEqual(['0005.HK', 'HSBA.L', 'HSBC']);
  });

  it('note la societe sous le nom de sa plus grosse ligne, et n en perd aucune', () => {
    const rows = [row('9988.HK', 'Alibaba Group Holding Limited', 2), row('BABA', 'Alibaba Group Holding Limited', 1)];
    const groups = groupRowsByCompany(rows);

    expect(groups[0]!.brief.name).toBe('Alibaba Group Holding Limited');
    expect(groups.flatMap(g => g.rows)).toHaveLength(rows.length);
  });

  it('retombe sur le ticker quand le nom manque, sans fusionner les anonymes', () => {
    const groups = groupRowsByCompany([row('AAA', null), row('BBB', null)]);

    expect(groups).toHaveLength(2);
  });
});
