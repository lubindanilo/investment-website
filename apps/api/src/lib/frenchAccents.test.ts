import { describe, it, expect } from 'vitest';
import { deaccent, missingAccentWords, polishFrenchText, repairAccents, sameLetters } from './frenchAccents.js';

/**
 * Les cas de reference viennent de la fiche Vinci telle qu'elle etait affichee le 11/08/2026
 * (capture d'ecran de Lubin) : c'est la panne reelle, pas un exemple invente.
 */
describe('repairAccents', () => {
  it('repare les justifications de la fiche Vinci', () => {
    expect(repairAccents("Concessions d'infrastructures essentielles (autoroutes, aeroports) avec trafic et besoins de renouvellement structurellement croissants jusqu'en 2033."))
      .toContain('aéroports');
    expect(repairAccents('Concessions regulees de tres longue duree sur des reseaux physiques rares.'))
      .toBe('Concessions régulées de très longue durée sur des réseaux physiques rares.');
    expect(repairAccents("la Chine n'a pas acces aux concessions francaises"))
      .toBe("la Chine n'a pas accès aux concessions françaises");
  });

  it('laisse au modele ce qu aucune table ne peut trancher', () => {
    // « concedant » n'existe nulle part dans le corpus et « indexes » peut etre « indexés » ou
    // « index ». La passe deterministe repare le reste et n'invente rien : c'est le contrat.
    expect(repairAccents("Peages indexes contractuellement, couts de sortie eleves pour l'Etat concedant."))
      .toBe("Péages indexes contractuellement, coûts de sortie élevés pour l'État concedant.");
  });

  it('preserve la casse du mot d origine', () => {
    expect(repairAccents('Reseau dense')).toBe('Réseau dense');
    expect(repairAccents('RESEAU dense')).toBe('RÉSEAU dense');
  });

  it('ne touche pas aux noms propres, meme quand le mot commun est accentue', () => {
    // « Vinci Energies » est une marque : « énergies » (minuscule) se corrige, « Energies » non.
    expect(repairAccents('Vinci Energies electrifie')).toContain('Vinci Energies');
    expect(repairAccents('les energies renouvelables')).toContain('énergies');
  });

  it('ne retouche pas un texte deja correct (idempotence)', () => {
    const clean = "Péages indexés contractuellement, coûts de sortie élevés pour l'État concédant.";
    expect(repairAccents(clean)).toBe(clean);
    expect(polishFrenchText(polishFrenchText(clean))).toBe(polishFrenchText(clean));
  });

  it('laisse « a » tranquille quand il est le verbe avoir', () => {
    // Le piege : une regle « a devant un infinitif » casserait tous les passes composes.
    expect(repairAccents('Vinci a genere un flux')).toBe('Vinci a genere un flux');
    expect(repairAccents('impossibles a dupliquer')).toBe('impossibles à dupliquer');
  });

  it('remet les apostrophes elidees', () => {
    expect(repairAccents('l IA remplit le carnet')).toBe("l'IA remplit le carnet");
    expect(repairAccents('jusqu a 2033')).toBe("jusqu'à 2033");
  });

  it('n invente jamais d accent sur un mot francais correct', () => {
    // Garde-fou de la couche « accord » : ces mots ont ete pris en flagrant delit par les
    // versions plus permissives (budgéts, systéms, achèter, financièrs, rêvers).
    for (const word of ['budgets', 'systems', 'acheter', 'financiers', 'revers', 'concurrents', 'interne', 'premiers']) {
      expect(repairAccents(word)).toBe(word);
    }
  });
});

describe('missingAccentWords', () => {
  it('repere la panne systemique et se tait sur du francais correct', () => {
    expect(missingAccentWords('Concessions regulees de tres longue duree')).toContain('tres');
    expect(missingAccentWords('Concessions régulées de très longue durée')).toEqual([]);
    // Non-regression : apres reparation, plus aucun mot CONNU ne manque d accent.
    expect(missingAccentWords(repairAccents('Peages indexes, couts eleves, acces regule'))).toEqual([]);
  });
});

describe('sameLetters', () => {
  it('accepte les seules differences d accent, de casse et de ponctuation', () => {
    expect(sameLetters('Concessions regulees de tres longue duree', 'Concessions régulées de très longue durée')).toBe(true);
    expect(sameLetters('jusqu a 2033', "jusqu'à 2033")).toBe(true);
  });

  it('rejette toute reecriture, meme plausible', () => {
    expect(sameLetters('Concessions regulees de tres longue duree', 'Concessions régulées de longue durée')).toBe(false);
    expect(sameLetters('reseau physique rare', 'réseau physique très rare')).toBe(false);
    expect(sameLetters('reseau physique rare', 'rare physical network')).toBe(false);
  });
});

describe('deaccent', () => {
  it('aplatit diacritiques et ligature', () => {
    expect(deaccent('cœur régulé')).toBe('coeur regule');
  });
});
