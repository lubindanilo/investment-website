/**
 * Tests du résolveur de devise de reporting.
 *
 * CE QUE ÇA VERROUILLE. Jusqu'au 06/09/2026 la seule source était la SEC : un titre sans dépôt
 * XBRL américain (tout Londres, Johannesbourg, Tel-Aviv) avait une devise de reporting « inconnue »,
 * traitée comme égale à la cotation, et un P/FCF en pence ÷ livres, cent fois trop haut. L'ordre
 * de confiance — SEC, puis sonde Yahoo, puis devise majeure de l'unité de cotation — garantit
 * qu'aucun des trois repli ne peut reproduire ce facteur 100.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const secProfile = vi.fn();
vi.mock('./secEdgar.js', () => ({ secReportingProfile: secProfile }));
vi.mock('../lib/limiter.js', () => ({ yahooLimiter: { schedule: (fn: () => unknown) => fn() } }));

const { resolveReportingCurrency, probeYahooReportingCurrency, __resetReportingCurrencyCache } = await import('./reportingCurrency.js');

const yahooAnswer = (currencyCode: string | null) => ({
  ok: true,
  json: async () => ({ timeseries: { result: [{ meta: { type: ['annualFreeCashFlow'] }, annualFreeCashFlow: [{ asOfDate: '2025-03-31', currencyCode }] }] } }),
});

beforeEach(() => {
  __resetReportingCurrencyCache();
  secProfile.mockReset();
  vi.restoreAllMocks();
});

describe('resolveReportingCurrency', () => {
  it('la SEC est autoritaire quand elle connaît l émetteur, USD compris', async () => {
    secProfile.mockResolvedValue({ taxonomy: 'us-gaap', currency: 'USD' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await resolveReportingCurrency('AAPL', 'AAPL', 'USD')).toEqual({ currency: 'USD', source: 'sec' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('un ADR déposant en IFRS garde sa devise locale (KB Financial en KRW)', async () => {
    secProfile.mockResolvedValue({ taxonomy: 'ifrs-full', currency: 'KRW' });
    expect(await resolveReportingCurrency('KB', 'KB', 'USD')).toEqual({ currency: 'KRW', source: 'sec' });
  });

  it('sans SEC, la sonde Yahoo donne la devise des comptes (Halma : GBP pour une cotation en GBp)', async () => {
    secProfile.mockResolvedValue(null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(yahooAnswer('GBP') as never);
    expect(await resolveReportingCurrency('HLMA.L', 'HLMA.L', 'GBp')).toEqual({ currency: 'GBP', source: 'yahoo' });
  });

  it('un minier londonien publiant en dollars est bien vu en USD par la sonde, pas supposé en livres', async () => {
    secProfile.mockResolvedValue(null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(yahooAnswer('USD') as never);
    expect(await resolveReportingCurrency('RIO.L', 'RIO.L', 'GBp')).toEqual({ currency: 'USD', source: 'yahoo' });
  });

  it('sans SEC ni Yahoo, on suppose la devise MAJEURE de la cotation : jamais la sous-unité', async () => {
    // Le repli qui rend le facteur 100 impossible même quand Yahoo ne répond pas.
    secProfile.mockResolvedValue(null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as never);
    expect(await resolveReportingCurrency('DRD.JO', 'DRD.JO', 'ZAc')).toEqual({ currency: 'ZAR', source: 'assumed-quote-major' });
    expect(await resolveReportingCurrency('X.PA', 'X.PA', 'EUR')).toEqual({ currency: 'EUR', source: 'assumed-quote-major' });
  });

  it('un profil SEC déjà lu par l appelant est réutilisé sans le relire', async () => {
    await resolveReportingCurrency('KB', 'KB', 'USD', 'KRW');
    expect(secProfile).not.toHaveBeenCalled();
  });
});

describe('probeYahooReportingCurrency — mémoïsation', () => {
  it('une requête par symbole et par jour, réponse négative comprise', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(yahooAnswer(null) as never);
    expect(await probeYahooReportingCurrency('X.L')).toBeNull();
    expect(await probeYahooReportingCurrency('X.L')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
