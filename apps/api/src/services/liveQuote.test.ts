/**
 * Prix en direct : Finnhub aux US, Yahoo pour les cotations suffixées (Finnhub /quote est
 * US-only — sans ça les titres hors US gardaient le prix du dernier scoring).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getQuote = vi.fn();
const probeOne = vi.fn();
vi.mock('./finnhub.js', () => ({ getQuote: (t: string) => getQuote(t) }));
vi.mock('./yahooResolve.js', () => ({ probeOne: (s: string) => probeOne(s) }));
vi.mock('../lib/limiter.js', () => ({ yahooLimiter: { schedule: <T>(fn: () => Promise<T>) => fn() } }));

const { getLiveQuote, _resetLiveQuoteMemo } = await import('./liveQuote.js');

beforeEach(() => {
  getQuote.mockReset();
  probeOne.mockReset();
  _resetLiveQuoteMemo();
});

describe('getLiveQuote', () => {
  it('US : Finnhub, sans appel Yahoo', async () => {
    getQuote.mockResolvedValue({ c: 412.5, dp: 1.2 });
    expect(await getLiveQuote('MSFT')).toEqual({ c: 412.5, dp: 1.2 });
    expect(probeOne).not.toHaveBeenCalled();
  });

  it('hors US : prix Yahoo (Finnhub ne couvre pas 000660.KS)', async () => {
    probeOne.mockResolvedValue({ symbol: '000660.KS', currency: 'KRW', price: 1_113_000, dayChangePct: -2.1 });
    expect(await getLiveQuote('000660.KS')).toEqual({ c: 1_113_000, dp: -2.1 });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('hors US inconnu de Yahoo : repli Finnhub', async () => {
    probeOne.mockResolvedValue(null);
    getQuote.mockResolvedValue({ c: 10, dp: 0 });
    expect(await getLiveQuote('BRK.B')).toEqual({ c: 10, dp: 0 });
  });

  it('Finnhub vide (c = 0) → null, pas un prix nul', async () => {
    getQuote.mockResolvedValue({ c: 0, dp: 0 });
    expect(await getLiveQuote('AAPL')).toBeNull();
  });

  it('mémo court : un seul appel Yahoo pour deux lectures rapprochées', async () => {
    probeOne.mockResolvedValue({ symbol: 'MC.PA', currency: 'EUR', price: 600, dayChangePct: null });
    await getLiveQuote('MC.PA');
    await getLiveQuote('mc.pa');
    expect(probeOne).toHaveBeenCalledTimes(1);
  });
});
