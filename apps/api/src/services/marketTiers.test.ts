import { describe, it, expect } from 'vitest';
import { marketCapToUsd, fxPerUsd, minorUnitsPerMajor, nextAshareDisclosure, isChinaAshare } from './marketTiers.js';

describe('marketCapToUsd', () => {
  it('convertit la devise locale en USD', () => {
    expect(marketCapToUsd(1_500_000_000_000, 'JPY')).toBeCloseTo(10_000_000_000, -6); // 1500 Md¥ ÷150
    expect(marketCapToUsd(78_000_000_000, 'HKD')).toBeCloseTo(10_000_000_000, -6);   // 78 Md HK$ ÷7.8
  });
  it('laisse l USD inchangé et gère la casse', () => {
    expect(marketCapToUsd(100, 'USD')).toBe(100);
    expect(marketCapToUsd(100, 'usd')).toBe(100);
  });
  it('devise inconnue → supposée déjà ~USD', () => {
    expect(marketCapToUsd(1_000, 'XYZ')).toBe(1_000);
    expect(marketCapToUsd(1_000, null)).toBe(1_000);
  });
  it('null si market cap absent', () => {
    expect(marketCapToUsd(null, 'JPY')).toBeNull();
    expect(marketCapToUsd(undefined, 'JPY')).toBeNull();
  });
});

describe('unités secondaires de cotation (GBp, ZAc, ILA)', () => {
  it('les pence valent 100 fois moins que la livre', () => {
    expect(fxPerUsd('GBp')).toBeCloseTo(fxPerUsd('GBP')! * 100, 6);
  });

  it('cents sud-africains et agorot israéliens suivent la même règle', () => {
    expect(fxPerUsd('ZAc')).toBeCloseTo(fxPerUsd('ZAR')! * 100, 6);
    expect(fxPerUsd('ILA')).toBeCloseTo(fxPerUsd('ILS')! * 100, 6);
  });

  it('GSK : une capi en pence n\'est plus comptée comme des livres', () => {
    // 7,89e12 pence = 78,9 Md£ ≈ 100 Md$. Avant le correctif, `GBp` était uppercasé en `GBP` et
    // la même valeur ressortait à ~9 988 Md$, ce qui plaçait GSK au-dessus d'Apple au classement.
    const usd = marketCapToUsd(7.89e12, 'GBp')!;
    expect(usd / 1e9).toBeGreaterThan(50);
    expect(usd / 1e9).toBeLessThan(200);
  });

  it('minorUnitsPerMajor : 100 pour les sous-unités, 1 pour les devises majeures et l\'absence', () => {
    // Consommé par le recoupement de convention du chemin Yahoo : la capi publiée arrive en
    // unité MAJEURE (AZN.L : 187,46 Md GBP) alors que prix × actions est en pence — sans ce
    // facteur, tout Londres serait « corrigé » d'un facteur 100.
    expect(minorUnitsPerMajor('GBp')).toBe(100);
    expect(minorUnitsPerMajor('ZAc')).toBe(100);
    expect(minorUnitsPerMajor('ILA')).toBe(100);
    expect(minorUnitsPerMajor('GBP')).toBe(1);
    expect(minorUnitsPerMajor('EUR')).toBe(1);
    expect(minorUnitsPerMajor(null)).toBe(1);
    expect(minorUnitsPerMajor(undefined)).toBe(1);
  });
});

describe('nextAshareDisclosure (calendrier CSRC : ~05-05 / 09-05 / 11-05)', () => {
  it('renvoie la prochaine échéance strictement après la date', () => {
    expect(nextAshareDisclosure('2026-01-15')).toBe('2026-05-05');
    expect(nextAshareDisclosure('2026-06-01')).toBe('2026-09-05');
    expect(nextAshareDisclosure('2026-09-10')).toBe('2026-11-05');
  });
  it('strictement après (une date pile sur une échéance saute à la suivante)', () => {
    expect(nextAshareDisclosure('2026-05-05')).toBe('2026-09-05');
    expect(nextAshareDisclosure('2026-11-05')).toBe('2027-05-05');
  });
  it('passe à l année suivante après la dernière échéance', () => {
    expect(nextAshareDisclosure('2026-12-01')).toBe('2027-05-05');
  });
});

describe('isChinaAshare', () => {
  it('reconnaît Shanghai (.SS) et Shenzhen (.SZ)', () => {
    expect(isChinaAshare('600519.SS')).toBe(true);
    expect(isChinaAshare('300750.sz')).toBe(true);
  });
  it('exclut HK et le reste', () => {
    expect(isChinaAshare('1681.HK')).toBe(false);
    expect(isChinaAshare('AAPL')).toBe(false);
  });
});

describe('FX_PER_USD — couverture de l\'univers', () => {
  it('couvre toutes les devises des bourses réellement présentes en base', () => {
    // Relevé le 03/08/2026 sur les titres notés. Une devise manquante fait compter la
    // capitalisation locale comme des dollars : MOL (Budapest) est ainsi passé à 3 119 Md$.
    const inUniverse = [
      'USD', 'EUR', 'GBP', 'GBp', 'CHF', 'SEK', 'DKK', 'NOK', 'JPY', 'HKD', 'CNY', 'INR',
      'KRW', 'TWD', 'IDR', 'THB', 'SGD', 'VND', 'SAR', 'ZAR', 'TRY', 'CAD', 'AUD', 'BRL',
      'PLN', 'HUF', 'CZK', 'ILS',
    ];
    const missing = inUniverse.filter(c => fxPerUsd(c) == null);
    expect(missing).toEqual([]);
  });

  it('MOL : les forints ne sont plus comptés pour des dollars', () => {
    // ~2 200 Md HUF ≈ 6 Md$.
    const usd = marketCapToUsd(2.2e12, 'HUF')!;
    expect(usd / 1e9).toBeGreaterThan(2);
    expect(usd / 1e9).toBeLessThan(20);
  });
});
