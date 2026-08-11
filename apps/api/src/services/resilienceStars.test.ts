import { describe, it, expect, vi } from 'vitest';
import { aggregateTotal, parseScores, normalizeCompanyName, isSameCompany, pairByCompanyName, CRITERION_KEYS, type CriterionKey, type CriterionScore } from './resilienceStars.js';

const sample = `[
  {"nom":"Acme","besoin":{"s":1,"r":"demande croit"},"controle":{"s":0.5,"r":"conteste"},"forces":{"s":0,"r":"absorbee"},"adjacent":{"s":0.5,"r":"partiel"},"capture":{"s":1,"r":"durable"}}
]`;

function criteria(values: Record<CriterionKey, number>): Record<CriterionKey, CriterionScore> {
  return Object.fromEntries(
    CRITERION_KEYS.map(k => [k, { star: values[k] as 0 | 0.5 | 1, justification: 'x' }]),
  ) as Record<CriterionKey, CriterionScore>;
}

describe('aggregateTotal', () => {
  it('somme les 5 etoiles', () => {
    expect(aggregateTotal(criteria({ besoin: 1, controle: 0.5, forces: 0, adjacent: 0.5, capture: 1 }))).toBe(3);
  });
  it('rend 0 quand tout est 0', () => {
    expect(aggregateTotal(criteria({ besoin: 0, controle: 0, forces: 0, adjacent: 0, capture: 0 }))).toBe(0);
  });
  it('rend 5 quand tout est 1', () => {
    expect(aggregateTotal(criteria({ besoin: 1, controle: 1, forces: 1, adjacent: 1, capture: 1 }))).toBe(5);
  });
});

describe('parseScores', () => {
  it('parse un tableau JSON valide', () => {
    const row = parseScores(sample)[0]!;
    expect(row.nom).toBe('Acme');
    expect(row.criteria.besoin.star).toBe(1);
    expect(row.criteria.capture.justification).toBe('durable');
    expect(aggregateTotal(row.criteria)).toBe(3);
  });

  it('tolere un fencing markdown ```json', () => {
    const row = parseScores('```json\n' + sample + '\n```')[0]!;
    expect(row.criteria.forces.star).toBe(0);
  });

  it('rejette une note hors de {0, 0.5, 1}', () => {
    const bad = sample.replace('"s":1', '"s":0.75');
    expect(() => parseScores(bad)).toThrow();
  });

  it('rejette une justification vide', () => {
    const bad = sample.replace('"r":"demande croit"', '"r":""');
    expect(() => parseScores(bad)).toThrow();
  });
});

describe('normalizeCompanyName', () => {
  it('aplatit casse, accents et ponctuation', () => {
    expect(normalizeCompanyName('LVMH Moët Hennessy')).toBe(normalizeCompanyName('LVMH Moet Hennessy'));
  });

  it('neutralise les formes juridiques et l article de tete', () => {
    expect(normalizeCompanyName('The Toronto-Dominion Bank')).toBe(normalizeCompanyName('Toronto-Dominion Bank'));
    expect(normalizeCompanyName('Sumitomo Mitsui Financial Group Inc')).toBe(normalizeCompanyName('Sumitomo Mitsui Financial Group, Inc.'));
    expect(normalizeCompanyName('BP p.l.c.')).toBe(normalizeCompanyName('BP plc'));
    expect(normalizeCompanyName('Petróleo Brasileiro S.A. - Petrobras')).toBe(normalizeCompanyName('Petroleo Brasileiro SA Petrobras'));
    expect(normalizeCompanyName('Banco Bilbao Vizcaya Argentaria, S.A.')).toBe(normalizeCompanyName('Banco Bilbao Vizcaya Argentaria SA'));
  });

  it('ne confond pas deux societes distinctes', () => {
    expect(normalizeCompanyName('Boeing Co')).not.toBe(normalizeCompanyName('BAE Systems plc'));
    // « AG » en TETE est un vrai mot (AG Growth International), pas une forme juridique.
    expect(normalizeCompanyName('AG Growth International Inc')).toBe('ag growth international');
  });

  it('ne confond pas Merck KGaA avec Merck & Co', () => {
    // Le suffixe est ici le SEUL discriminant entre deux societes sans rapport. MRK.DE a porte en
    // prod la note de MRK, justifications sur Keytruda comprises (constate le 11/08/2026).
    expect(normalizeCompanyName('Merck KGaA')).not.toBe(normalizeCompanyName('Merck & Co., Inc.'));
  });

  it('garde les initiales de tete, qui font partie du nom', () => {
    // Jeter les lettres isolees reduisait ces noms a « bank », « block » et « technologies ».
    expect(normalizeCompanyName('M&T Bank Corp')).toBe('mt bank');
    expect(normalizeCompanyName('H & R Block Inc')).not.toBe(normalizeCompanyName('Block Inc'));
    expect(normalizeCompanyName('S&T Bancorp Inc')).not.toBe(normalizeCompanyName('Bancorp Inc'));
    expect(normalizeCompanyName('R C M Technologies Inc')).not.toBe(normalizeCompanyName('Q/C Technologies Inc'));
  });

  it('jette encore la lettre SEULE d une classe d action ou d un flux tronque', () => {
    // Sinon GOOG/GOOGL, BRK.A/BRK.B et les lignes suffixees « N. » cessent de se regrouper.
    expect(normalizeCompanyName('Alphabet Inc Class A')).toBe(normalizeCompanyName('Alphabet Inc Class C'));
    expect(normalizeCompanyName('AMRIZE N')).toBe(normalizeCompanyName('Amrize AG'));
  });

  it('ne renvoie jamais une cle vide', () => {
    expect(normalizeCompanyName('S.A.')).not.toBe('');
  });
});

describe('isSameCompany', () => {
  const line = (ticker: string, name: string) => ({ ticker, name });

  it('regroupe les cotations multiples d une meme societe', () => {
    expect(isSameCompany(line('TD.TO', 'The Toronto-Dominion Bank'), line('TD', 'Toronto-Dominion Bank'))).toBe(true);
    expect(isSameCompany(line('0005.HK', 'HSBC Holdings plc'), line('HSBC', 'HSBC Holdings PLC'))).toBe(true);
    expect(isSameCompany(line('PBR', 'Petróleo Brasileiro S.A. - Petrobras'), line('PBR.A', 'Petroleo Brasileiro SA Petrobras'))).toBe(true);
    expect(isSameCompany(line('IBN', 'ICICI Bank Ltd'), line('ICICIBANK.NS', 'ICICI Bank Limited'))).toBe(true);
    // Une ligne sans forme juridique reste compatible avec tout : les fournisseurs l'omettent souvent.
    expect(isSameCompany(line('AMRZ', 'Amrize AG'), line('AMRZ.SW', 'AMRIZE N'))).toBe(true);
  });

  it('refuse deux societes que seule la forme juridique separe', () => {
    // Toutes relevees par l'audit du 11/08/2026 sur les 8 631 lignes du screener.
    expect(isSameCompany(line('MRK', 'Merck & Co Inc'), line('MRK.DE', 'Merck KGaA'))).toBe(false);
    expect(isSameCompany(line('AGX', 'Argan Inc'), line('ARG.PA', 'Argan SA'))).toBe(false);
    expect(isSameCompany(line('LGO', 'Largo Inc.'), line('ALLGO.PA', 'Largo SA'))).toBe(false);
    expect(isSameCompany(line('IREN', 'IREN Ltd'), line('IRE.MI', 'Iren SpA'))).toBe(false);
    expect(isSameCompany(line('TITAN.NS', 'Titan Company Limited'), line('TITC.AT', 'Titan S.A.'))).toBe(false);
    expect(isSameCompany(line('SIE.DE', 'Siemens Aktiengesellschaft'), line('SIEMENS.NS', 'Siemens Limited'))).toBe(false);
  });

  it('refuse les homonymes inscrits a la main, que le nom ne separe pas', () => {
    // « Toro Co » (tondeuses) contre « Toro Corp. » (transport maritime).
    expect(isSameCompany(line('TTC', 'Toro Co'), line('TORO', 'Toro Corp.'))).toBe(false);
    expect(isSameCompany(line('FBP', 'First BanCorp'), line('FNLC', 'First Bancorp Inc'))).toBe(false);
  });

  it('reconnait une ligne comme elle-meme', () => {
    expect(isSameCompany(line('TORO', 'Toro Corp.'), line('TORO', 'Toro Corp.'))).toBe(true);
  });
});

describe('pairByCompanyName', () => {
  const brief = (name: string) => ({ name, brief: 'x' });

  it('apparie par nom meme quand le modele reordonne sa reponse', () => {
    const paired = pairByCompanyName(
      [brief('Apple Inc.'), brief('Microsoft Corporation')],
      [{ nom: 'Microsoft Corp' }, { nom: 'Apple' }],
    );
    expect(paired.map(p => p?.nom)).toEqual(['Apple', 'Microsoft Corp']);
  });

  it('n apparie plus par nom deux entreprises homonymes du meme lot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Le modele ne renvoie qu'une fois « Merck » : sans garde-fou, la premiere des deux prenait
    // cette note et l'autre restait vide, sans qu'on sache laquelle avait ete servie.
    const paired = pairByCompanyName(
      [brief('Merck'), brief('Merck')],
      [{ nom: 'Merck' }, { nom: 'Merck' }],
    );
    // Restes equilibres : la position tranche, et c'est l'ordre demande au modele.
    expect(paired.map(p => p?.nom)).toEqual(['Merck', 'Merck']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('laisse la case vide plutot que de deviner quand les restes ne s equilibrent pas', () => {
    const paired = pairByCompanyName(
      [brief('Apple Inc.'), brief('Microsoft Corporation'), brief('Nvidia Corporation')],
      [{ nom: 'Apple' }],
    );
    expect(paired.map(p => p?.nom)).toEqual(['Apple', undefined, undefined]);
  });
});
