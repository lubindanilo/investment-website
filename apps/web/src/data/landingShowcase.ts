/**
 * Données de la landing FIGÉES — GÉNÉRÉ, ne pas éditer à la main.
 * Régénérer :  node scripts/gen-landing-showcase.mjs
 *
 * Relevé le 2026-08-04. Ces valeurs sont rendues dès le premier paint pour que la fiche du hero
 * n'attende NI une fonction serverless NI le réveil de Neon (mesuré à 1,25 s en local, davantage
 * en production) : la landing ne fait AUCUN appel réseau, ce fichier est ce que voit le visiteur.
 *
 * Les valeurs vieillissent donc entre deux exécutions du script : le cours et les multiples
 * surtout, les notes et la résilience beaucoup plus lentement.
 *
 * Chaque critère porte son libellé et sa valeur dans les TROIS langues du site : le nom comme
 * les unités sont du contenu localisé côté API, et le front n'a plus personne à qui les demander.
 */
import type { FrozenCriterion, FrozenShowcase, LandingStock } from '../components/landing/useLandingData.js';

/** Date du relevé, pour savoir d'un coup d'œil si le fichier a vieilli. */
export const SHOWCASE_AS_OF = '2026-08-04';

export const FROZEN_SLOTS: FrozenShowcase[] = [
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
        "key": "netMargin",
        "status": "pass",
        "name": {
          "fr": "Marge nette",
          "en": "Net margin",
          "es": "Margen neto"
        },
        "value": {
          "fr": "51.7%",
          "en": "51.7%",
          "es": "51.7%"
        }
      },
      {
        "key": "revenueGrowth5y",
        "status": "pass",
        "name": {
          "fr": "Ventes en croissance",
          "en": "Growing sales",
          "es": "Ventas en crecimiento"
        },
        "value": {
          "fr": "11.6%/an",
          "en": "11.6%/year",
          "es": "11.6%/año"
        }
      },
      {
        "key": "fcfGrowth5y",
        "status": "pass",
        "name": {
          "fr": "Profits par action en croissance",
          "en": "Growing earnings per share",
          "es": "Beneficios por acción en crecimiento"
        },
        "value": {
          "fr": "13.2%/an",
          "en": "13.2%/year",
          "es": "13.2%/año"
        }
      },
      {
        "key": "shareCount5y",
        "status": "pass",
        "name": {
          "fr": "Nombre d'actions maîtrisé",
          "en": "Share count under control",
          "es": "Número de acciones controlado"
        },
        "value": {
          "fr": "-3.73%/an",
          "en": "-3.73%/year",
          "es": "-3.73%/año"
        }
      },
      {
        "key": "fcfMargin",
        "status": "pass",
        "name": {
          "fr": "Profitabilité cash",
          "en": "Cash profitability",
          "es": "Rentabilidad en efectivo"
        },
        "value": {
          "fr": "47.1%",
          "en": "47.1%",
          "es": "47.1%"
        }
      },
      {
        "key": "operatingLeverage",
        "status": "fail",
        "name": {
          "fr": "Marges en expansion",
          "en": "Expanding margins",
          "es": "Márgenes en expansión"
        },
        "value": {
          "fr": "✗ Compression",
          "en": "✗ Compression",
          "es": "✗ Compresión"
        }
      },
      {
        "key": "cashRoce",
        "status": "pass",
        "name": {
          "fr": "Rendement du capital investi",
          "en": "Return on invested capital",
          "es": "Rendimiento del capital invertido"
        },
        "value": {
          "fr": "60.4%",
          "en": "60.4%",
          "es": "60.4%"
        }
      },
      {
        "key": "netDebtFcf",
        "status": "pass",
        "name": {
          "fr": "Endettement maîtrisé",
          "en": "Debt under control",
          "es": "Endeudamiento controlado"
        },
        "value": {
          "fr": "0.57 ans",
          "en": "0.57 years",
          "es": "0.57 años"
        }
      },
      {
        "key": "cashConversion",
        "status": "warn",
        "name": {
          "fr": "Bénéfices transformés en cash",
          "en": "Earnings converted to cash",
          "es": "Beneficios convertidos en efectivo"
        },
        "value": {
          "fr": "91%",
          "en": "91%",
          "es": "91%"
        }
      },
      {
        "key": "ccc",
        "status": "warn",
        "name": {
          "fr": "Délai d'encaissement net",
          "en": "Cash collection cycle",
          "es": "Ciclo de cobro neto"
        },
        "value": {
          "fr": "17 j",
          "en": "17 d",
          "es": "17 d"
        }
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
        "key": "netMargin",
        "status": "pass",
        "name": {
          "fr": "Marge nette",
          "en": "Net margin",
          "es": "Margen neto"
        },
        "value": {
          "fr": "28.5%",
          "en": "28.5%",
          "es": "28.5%"
        }
      },
      {
        "key": "revenueGrowth5y",
        "status": "pass",
        "name": {
          "fr": "Ventes en croissance",
          "en": "Growing sales",
          "es": "Ventas en crecimiento"
        },
        "value": {
          "fr": "11.3%/an",
          "en": "11.3%/year",
          "es": "11.3%/año"
        }
      },
      {
        "key": "fcfGrowth5y",
        "status": "pass",
        "name": {
          "fr": "Profits par action en croissance",
          "en": "Growing earnings per share",
          "es": "Beneficios por acción en crecimiento"
        },
        "value": {
          "fr": "56.2%/an",
          "en": "56.2%/year",
          "es": "56.2%/año"
        }
      },
      {
        "key": "shareCount5y",
        "status": "pass",
        "name": {
          "fr": "Nombre d'actions maîtrisé",
          "en": "Share count under control",
          "es": "Número de acciones controlado"
        },
        "value": {
          "fr": "-1.19%/an",
          "en": "-1.19%/year",
          "es": "-1.19%/año"
        }
      },
      {
        "key": "fcfMargin",
        "status": "pass",
        "name": {
          "fr": "Profitabilité cash",
          "en": "Cash profitability",
          "es": "Rentabilidad en efectivo"
        },
        "value": {
          "fr": "24.4%",
          "en": "24.4%",
          "es": "24.4%"
        }
      },
      {
        "key": "operatingLeverage",
        "status": "pass",
        "name": {
          "fr": "Marges en expansion",
          "en": "Expanding margins",
          "es": "Márgenes en expansión"
        },
        "value": {
          "fr": "✓ Expansion",
          "en": "✓ Expansion",
          "es": "✓ Expansión"
        }
      },
      {
        "key": "cashRoce",
        "status": "pass",
        "name": {
          "fr": "Rendement du capital investi",
          "en": "Return on invested capital",
          "es": "Rendimiento del capital invertido"
        },
        "value": {
          "fr": "30.5%",
          "en": "30.5%",
          "es": "30.5%"
        }
      },
      {
        "key": "netDebtFcf",
        "status": "pass",
        "name": {
          "fr": "Endettement maîtrisé",
          "en": "Debt under control",
          "es": "Endeudamiento controlado"
        },
        "value": {
          "fr": "0.18 ans",
          "en": "0.18 years",
          "es": "0.18 años"
        }
      },
      {
        "key": "cashConversion",
        "status": "warn",
        "name": {
          "fr": "Bénéfices transformés en cash",
          "en": "Earnings converted to cash",
          "es": "Beneficios convertidos en efectivo"
        },
        "value": {
          "fr": "86%",
          "en": "86%",
          "es": "86%"
        }
      },
      {
        "key": "ccc",
        "status": "warn",
        "name": {
          "fr": "Délai d'encaissement net",
          "en": "Cash collection cycle",
          "es": "Ciclo de cobro neto"
        },
        "value": {
          "fr": "Non calculable",
          "en": "Not available",
          "es": "No disponible"
        }
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
      "pfcfTTM": 17.73898907103825,
      "price": 192.71,
      "currency": "USD",
      "opportunity": false,
      "marketCap": null,
      "dayChangePct": null,
      "spark": null
    },
    "criteria": [
      {
        "key": "netMargin",
        "status": "pass",
        "name": {
          "fr": "Marge nette",
          "en": "Net margin",
          "es": "Margen neto"
        },
        "value": {
          "fr": "22.2%",
          "en": "22.2%",
          "es": "22.2%"
        }
      },
      {
        "key": "revenueGrowth5y",
        "status": "pass",
        "name": {
          "fr": "Ventes en croissance",
          "en": "Growing sales",
          "es": "Ventas en crecimiento"
        },
        "value": {
          "fr": "19.0%/an",
          "en": "19.0%/year",
          "es": "19.0%/año"
        }
      },
      {
        "key": "fcfGrowth5y",
        "status": "pass",
        "name": {
          "fr": "Profits par action en croissance",
          "en": "Growing earnings per share",
          "es": "Beneficios por acción en crecimiento"
        },
        "value": {
          "fr": "28.0%/an",
          "en": "28.0%/year",
          "es": "28.0%/año"
        }
      },
      {
        "key": "shareCount5y",
        "status": "pass",
        "name": {
          "fr": "Nombre d'actions maîtrisé",
          "en": "Share count under control",
          "es": "Número de acciones controlado"
        },
        "value": {
          "fr": "-6.24%/an",
          "en": "-6.24%/year",
          "es": "-6.24%/año"
        }
      },
      {
        "key": "fcfMargin",
        "status": "pass",
        "name": {
          "fr": "Profitabilité cash",
          "en": "Cash profitability",
          "es": "Rentabilidad en efectivo"
        },
        "value": {
          "fr": "30.4%",
          "en": "30.4%",
          "es": "30.4%"
        }
      },
      {
        "key": "operatingLeverage",
        "status": "pass",
        "name": {
          "fr": "Marges en expansion",
          "en": "Expanding margins",
          "es": "Márgenes en expansión"
        },
        "value": {
          "fr": "✓ Expansion",
          "en": "✓ Expansion",
          "es": "✓ Expansión"
        }
      },
      {
        "key": "cashRoce",
        "status": "pass",
        "name": {
          "fr": "Rendement du capital investi",
          "en": "Return on invested capital",
          "es": "Rendimiento del capital invertido"
        },
        "value": {
          "fr": "161.6%",
          "en": "161.6%",
          "es": "161.6%"
        }
      },
      {
        "key": "netDebtFcf",
        "status": "pass",
        "name": {
          "fr": "Endettement maîtrisé",
          "en": "Debt under control",
          "es": "Endeudamiento controlado"
        },
        "value": {
          "fr": "0.28 ans",
          "en": "0.28 years",
          "es": "0.28 años"
        }
      },
      {
        "key": "cashConversion",
        "status": "pass",
        "name": {
          "fr": "Bénéfices transformés en cash",
          "en": "Earnings converted to cash",
          "es": "Beneficios convertidos en efectivo"
        },
        "value": {
          "fr": "137%",
          "en": "137%",
          "es": "137%"
        }
      },
      {
        "key": "ccc",
        "status": "pass",
        "name": {
          "fr": "Délai d'encaissement net",
          "en": "Cash collection cycle",
          "es": "Ciclo de cobro neto"
        },
        "value": {
          "fr": "-8 j (estimé)",
          "en": "-8 d (est.)",
          "es": "-8 d (est.)"
        }
      }
    ],
    "resilience": {
      "grade": "C",
      "score": 64
    },
    "pfcfPercentile": 15.88235294117647
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
    "ticker": "AEM",
    "name": "Agnico Eagle Mines Limited",
    "sector": "Gold",
    "note10": 8,
    "pfcfTTM": 19.33185728420657,
    "price": 163.66,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 72710972620,
    "dayChangePct": -7.4059,
    "spark": [
      124.36,
      144.17,
      168.56,
      160.81,
      174.43,
      169.53,
      190.5,
      251.6,
      202.98,
      188.21,
      183.15,
      163.66,
      163.66
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
  }
];

export const FROZEN_PEA_ROWS: LandingStock[] = [
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
  },
  {
    "ticker": "IAG.MC",
    "name": "International Consolidated Airlines Group S.A.",
    "sector": "Airlines",
    "note10": 9,
    "pfcfTTM": 8.34931201525747,
    "price": 5.22,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 25431626920,
    "dayChangePct": -1.248576953140333,
    "spark": [
      4.41,
      4.43,
      4.76,
      4.53,
      4.75,
      4.82,
      4.83,
      4.02,
      4.31,
      4.96,
      5.54,
      5.22,
      5.22
    ]
  },
  {
    "ticker": "DG.PA",
    "name": "Vinci SA",
    "sector": "Engineering & Construction",
    "note10": 9,
    "pfcfTTM": 8.347031563503057,
    "price": 117.95,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 69606653420.75,
    "dayChangePct": -1.871877708292312,
    "spark": [
      115.9,
      117.95,
      115.9,
      122.25,
      120.05,
      121.15,
      140.75,
      128.35,
      128.5,
      125.05,
      127.8,
      117.95,
      117.95
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
  }
];

/** Référencé pour que le type reste importé même si l'inférence suffit. */
export type { FrozenCriterion };
