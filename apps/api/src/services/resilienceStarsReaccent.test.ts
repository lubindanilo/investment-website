import { describe, it, expect, vi } from 'vitest';
import { needsReaccent, parseReaccented, reaccentTexts } from './resilienceStarsReaccent.js';

describe('needsReaccent', () => {
  it('flagge une phrase desaccentuee, laisse passer du francais correct', () => {
    expect(needsReaccent('Concessions regulees de tres longue duree sur des reseaux physiques')).toBe(true);
    expect(needsReaccent("Peages indexes contractuellement pour l'Etat concedant")).toBe(true);
    expect(needsReaccent("Péages indexés contractuellement, coûts de sortie élevés pour l'État concédant.")).toBe(false);
  });
});

describe('parseReaccented', () => {
  const original = 'Concessions regulees de tres longue duree.';

  it('accepte une reponse qui n ajoute que des accents', () => {
    const answer = JSON.stringify(['Concessions régulées de très longue durée.']);
    expect(parseReaccented(answer, [original])).toEqual({
      texts: ['Concessions régulées de très longue durée.'],
      rejected: 0,
    });
  });

  it('REJETTE une reformulation et conserve l original', () => {
    // Le risque reel de cette passe : un modele de reecriture qui « ameliore » un jugement
    // editorial au passage. L invariant lettre a lettre le rend impossible.
    const answer = JSON.stringify(['Concessions régulées de longue durée, très solides.']);
    expect(parseReaccented(answer, [original])).toEqual({ texts: [original], rejected: 1 });
  });

  it('tolere un fencing markdown et refuse un lot de mauvaise taille', () => {
    expect(parseReaccented('```json\n["Durée"]\n```', ['Duree']).texts).toEqual(['Durée']);
    expect(() => parseReaccented(JSON.stringify(['a', 'b']), ['Duree'])).toThrow(/attendu 1/);
  });
});

describe('reaccentTexts', () => {
  it('envoie TOUTES les phrases, y compris celles qui paraissent propres', async () => {
    // Une phrase peut paraitre saine et porter encore « electrification » ou « concedant » :
    // aucun detecteur ne le voit sans dictionnaire complet, donc on ne saute rien.
    const clean = "Péages indexés contractuellement, coûts de sortie élevés pour l'État concédant.";
    const run = vi.fn(async (_prompt: string) => JSON.stringify([clean, 'Concessions régulées de très longue durée.']));
    const report = await reaccentTexts([clean, 'Concessions regulees de tres longue duree.'], { run });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toContain('Péages indexés');
    expect(report.texts[0]).toBe(clean);
    expect(report.texts[1]).toBe('Concessions régulées de très longue durée.');
    expect(report.changed).toBe(1);
  });

  it('REJETTE une reponse qui retire des accents', async () => {
    const original = "Péages indexés pour l'État concédant.";
    const run = vi.fn(async () => JSON.stringify(["Peages indexes pour l'Etat concedant."]));
    const report = await reaccentTexts([original], { run });

    expect(report.texts[0]).toBe(original);
    expect(report.rejected).toBe(1);
  });

  it('un lot perdu laisse ses phrases intactes sans faire echouer le reste', async () => {
    const run = vi.fn(async () => {
      throw new Error('claude: timeout apres 300s');
    });
    const report = await reaccentTexts(['Concessions regulees de tres longue duree.'], { run });

    expect(report.texts).toEqual(['Concessions regulees de tres longue duree.']);
    expect(report.failedBatches).toBe(1);
  });
});
