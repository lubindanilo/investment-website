import { describe, it, expect } from 'vitest';
import { marketCapToUsd, nextAshareDisclosure, isChinaAshare } from './marketTiers.js';

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
