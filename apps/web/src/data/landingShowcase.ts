/**
 * Données de la landing FIGÉES — GÉNÉRÉ, ne pas éditer à la main.
 * Régénérer :  node scripts/gen-landing-showcase.mjs
 *
 * Relevé le 2026-08-03. Ces valeurs sont rendues dès le premier paint pour que la fiche du hero
 * n'attende NI une fonction serverless NI le réveil de Neon (mesuré à 1,25 s en local, davantage
 * en production). useLandingData rafraîchit ensuite en arrière-plan et corrige les chiffres.
 *
 * Elles vieillissent donc entre deux exécutions du script : le cours et les multiples surtout.
 * C'est assumé, l'affichage se corrige en une seconde côté client.
 */
import type { LandingCriterion, LandingShowcase, LandingStock } from '../components/landing/useLandingData.js';

/** Date du relevé, pour savoir d'un coup d'œil si le fichier a vieilli. */
export const SHOWCASE_AS_OF = '2026-08-03';

export const FROZEN_SLOTS: LandingShowcase[] = [
  {
    "stock": {
      "ticker": "V",
      "name": "Visa Inc",
      "sector": "Credit Services",
      "note10": 8,
      "pfcfTTM": 30.08370342955835,
      "price": 323.57,
      "currency": "USD",
      "opportunity": false,
      "marketCap": null,
      "dayChangePct": null,
      "spark": null
    },
    "criteria": [
      {
        "name": "Marge nette",
        "value": "51.7%",
        "status": "pass"
      },
      {
        "name": "Ventes en croissance",
        "value": "11.6%/an",
        "status": "pass"
      },
      {
        "name": "Profits par action en croissance",
        "value": "13.2%/an",
        "status": "pass"
      },
      {
        "name": "Nombre d'actions maîtrisé",
        "value": "-3.73%/an",
        "status": "pass"
      },
      {
        "name": "Profitabilité cash",
        "value": "47.1%",
        "status": "pass"
      },
      {
        "name": "Marges en expansion",
        "value": "✗ Compression",
        "status": "fail"
      },
      {
        "name": "Rendement du capital investi",
        "value": "60.4%",
        "status": "pass"
      },
      {
        "name": "Endettement maîtrisé",
        "value": "0.57 ans",
        "status": "pass"
      },
      {
        "name": "Bénéfices transformés en cash",
        "value": "91%",
        "status": "warn"
      },
      {
        "name": "Délai d'encaissement net",
        "value": "17 j",
        "status": "warn"
      }
    ],
    "resilience": {
      "grade": "A",
      "score": 87
    },
    "pfcfPercentile": 46.85714285714286
  },
  {
    "stock": {
      "ticker": "NFLX",
      "name": "Netflix Inc",
      "sector": "Entertainment",
      "note10": 9,
      "pfcfTTM": 30.20167036183435,
      "price": 82.2,
      "currency": "USD",
      "opportunity": false,
      "marketCap": null,
      "dayChangePct": null,
      "spark": null
    },
    "criteria": [
      {
        "name": "Marge nette",
        "value": "28.5%",
        "status": "pass"
      },
      {
        "name": "Ventes en croissance",
        "value": "11.3%/an",
        "status": "pass"
      },
      {
        "name": "Profits par action en croissance",
        "value": "56.2%/an",
        "status": "pass"
      },
      {
        "name": "Nombre d'actions maîtrisé",
        "value": "-1.19%/an",
        "status": "pass"
      },
      {
        "name": "Profitabilité cash",
        "value": "24.4%",
        "status": "pass"
      },
      {
        "name": "Marges en expansion",
        "value": "✓ Expansion",
        "status": "pass"
      },
      {
        "name": "Rendement du capital investi",
        "value": "30.5%",
        "status": "pass"
      },
      {
        "name": "Endettement maîtrisé",
        "value": "0.18 ans",
        "status": "pass"
      },
      {
        "name": "Bénéfices transformés en cash",
        "value": "86%",
        "status": "warn"
      },
      {
        "name": "Délai d'encaissement net",
        "value": "Non calculable",
        "status": "warn"
      }
    ],
    "resilience": {
      "grade": "C",
      "score": 68
    },
    "pfcfPercentile": 11.42857142857143
  },
  {
    "stock": {
      "ticker": "BKNG",
      "name": "Booking Holdings Inc",
      "sector": "Travel Services",
      "note10": 10,
      "pfcfTTM": 15.2656022808268,
      "price": 165.86,
      "currency": "USD",
      "opportunity": false,
      "marketCap": null,
      "dayChangePct": null,
      "spark": null
    },
    "criteria": [
      {
        "name": "Marge nette",
        "value": "22.2%",
        "status": "pass"
      },
      {
        "name": "Ventes en croissance",
        "value": "19.0%/an",
        "status": "pass"
      },
      {
        "name": "Profits par action en croissance",
        "value": "28.0%/an",
        "status": "pass"
      },
      {
        "name": "Nombre d'actions maîtrisé",
        "value": "-6.24%/an",
        "status": "pass"
      },
      {
        "name": "Profitabilité cash",
        "value": "30.4%",
        "status": "pass"
      },
      {
        "name": "Marges en expansion",
        "value": "✓ Expansion",
        "status": "pass"
      },
      {
        "name": "Rendement du capital investi",
        "value": "161.6%",
        "status": "pass"
      },
      {
        "name": "Endettement maîtrisé",
        "value": "0.28 ans",
        "status": "pass"
      },
      {
        "name": "Bénéfices transformés en cash",
        "value": "137%",
        "status": "pass"
      },
      {
        "name": "Délai d'encaissement net",
        "value": "-8 j (estimé)",
        "status": "pass"
      }
    ],
    "resilience": {
      "grade": "C",
      "score": 64
    },
    "pfcfPercentile": 6.508875739644971
  }
];

export const FROZEN_ROWS: LandingStock[] = [
  {
    "ticker": "SAP.DE",
    "name": "SAP SE",
    "sector": "Software - Application",
    "note10": 9,
    "pfcfTTM": 22.5423547582274,
    "price": 161.48,
    "currency": "EUR",
    "opportunity": true,
    "marketCap": 164735000000,
    "dayChangePct": -1.835866261398182,
    "spark": [
      250.8,
      231.7,
      227.9,
      224.45,
      208.55,
      208.35,
      170.56,
      170.96,
      146.9,
      145.5,
      155.26,
      161.48,
      161.48
    ]
  },
  {
    "ticker": "CRM",
    "name": "Salesforce Inc",
    "sector": "Software - Application",
    "note10": 10,
    "pfcfTTM": 13.19468500520652,
    "price": 185.68,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 161709860000,
    "dayChangePct": -1.6265,
    "spark": [
      258.33,
      256.25,
      237,
      260.41,
      230.54,
      264.91,
      212.29,
      194.79,
      186.67,
      176.53,
      191.1,
      185.66,
      185.66
    ]
  },
  {
    "ticker": "CMCSA",
    "name": "Comcast Corp",
    "sector": "Telecom Services",
    "note10": 8,
    "pfcfTTM": 4.464817084688844,
    "price": 23.82,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 86156940000,
    "dayChangePct": 2.1003,
    "spark": [
      31.14,
      31.84,
      29.45,
      26.09,
      25.01,
      28.01,
      29.75,
      30.96,
      28.71,
      27.04,
      24.87,
      23.82,
      23.82
    ]
  },
  {
    "ticker": "ZTS",
    "name": "Zoetis Inc",
    "sector": "Drug Manufacturers - Specialty & Generic",
    "note10": 8,
    "pfcfTTM": 16.28532029339853,
    "price": 79.44,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 33555456000,
    "dayChangePct": -0.1006,
    "spark": [
      145.79,
      156.4,
      146.32,
      144.09,
      128.18,
      125.82,
      124.82,
      131.1,
      118.21,
      114.97,
      77.69,
      79.44,
      79.44
    ]
  },
  {
    "ticker": "ALC",
    "name": "Alcon Inc.",
    "sector": "Medical Instruments & Supplies",
    "note10": 8,
    "pfcfTTM": 20.61636940298508,
    "price": 66.81,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 33151122000,
    "dayChangePct": 0.3454,
    "spark": [
      87.55,
      79.81,
      74.51,
      73.89,
      79.31,
      78.81,
      80.98,
      87.18,
      75.35,
      74.87,
      66.29,
      66.81,
      66.81
    ]
  }
];

export const FROZEN_PEA_ROWS: LandingStock[] = [
  {
    "ticker": "BIRG.IR",
    "name": "Bank of Ireland Group plc",
    "sector": "Banks - Regional",
    "note10": 9,
    "pfcfTTM": 4.765424354243542,
    "price": 17.29,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 17565390000,
    "dayChangePct": -2.343970208948675,
    "spark": [
      12.64,
      14.02,
      14.19,
      15.96,
      16.38,
      17.15,
      16.53,
      15.44,
      16.74,
      17.43,
      17.42,
      17.29,
      17.29
    ]
  },
  {
    "ticker": "PUB.PA",
    "name": "Publicis Groupe S.A.",
    "sector": "Advertising Agencies",
    "note10": 9,
    "pfcfTTM": 8.250351675232084,
    "price": 87.7,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 22218197061.4,
    "dayChangePct": -4.027136533187321,
    "spark": [
      78.84,
      81.68,
      86.8,
      83.98,
      88.62,
      84.2,
      75.42,
      70.84,
      79.38,
      83.74,
      86.46,
      87.7,
      87.7
    ]
  },
  {
    "ticker": "AGS.BR",
    "name": "ageas SA/NV",
    "sector": "Insurance - Diversified",
    "note10": 9,
    "pfcfTTM": 5.287026805124223,
    "price": 72.35,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 13619381050,
    "dayChangePct": 1.829693022384774,
    "spark": [
      60.2,
      58.9,
      57.4,
      58.9,
      59.8,
      59.95,
      62.9,
      63.05,
      66.7,
      66.6,
      70,
      72.35,
      72.35
    ]
  },
  {
    "ticker": "ETE.AT",
    "name": "National Bank of Greece S.A.",
    "sector": "Banks - Regional",
    "note10": 9,
    "pfcfTTM": 4.179694299652778,
    "price": 14.575,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 14626721908.4,
    "dayChangePct": -0.9850561440110437,
    "spark": [
      11.83,
      12.36,
      12.74,
      13.5,
      13,
      14.91,
      13.78,
      13.23,
      13.43,
      14.82,
      15.09,
      14.57,
      14.57
    ]
  }
];

/** Référencé pour que le type reste importé même si l'inférence suffit. */
export type { LandingCriterion };
