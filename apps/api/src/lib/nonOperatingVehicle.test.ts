import { describe, expect, it } from 'vitest';
import { isNonOperatingVehicle } from './nonOperatingVehicle.js';

describe('isNonOperatingVehicle', () => {
  it('detecte les SPAC et coquilles', () => {
    expect(isNonOperatingVehicle('Churchill Capital Corp XII Acquisition Corp')).toBe(true);
    expect(isNonOperatingVehicle('Keystone Acquisition Corp.')).toBe(true);
    expect(isNonOperatingVehicle('Starlink AI Acquisition Corporation')).toBe(true);
    expect(isNonOperatingVehicle('Spring Valley Acquisition Corp III')).toBe(true);
  });

  it('detecte les produits indiciels et a levier', () => {
    expect(isNonOperatingVehicle('Leverage Shares 2X Long OSCR Daily ETF')).toBe(true);
    expect(isNonOperatingVehicle('Themes US Infrastructure ETF')).toBe(true);
    expect(isNonOperatingVehicle('iShares Core MSCI World')).toBe(true);
  });

  it('ne touche PAS aux societes operantes, y compris les pieges', () => {
    // Les BDC et REIT sont des societes reelles : « capital corp », « trust » et « fund »
    // sont VOLONTAIREMENT hors liste.
    expect(isNonOperatingVehicle('Ares Capital Corporation')).toBe(false);
    expect(isNonOperatingVehicle('Realty Income Trust')).toBe(false);
    expect(isNonOperatingVehicle('The Coca-Cola Company')).toBe(false);
    expect(isNonOperatingVehicle('Space Exploration Technologies Corp.')).toBe(false);
    expect(isNonOperatingVehicle(null)).toBe(false);
  });
});
