/**
 * Données de la landing FIGÉES — GÉNÉRÉ, ne pas éditer à la main.
 * Régénérer :  node scripts/gen-landing-showcase.mjs
 *
 * Relevé le 2026-08-12. Ces valeurs sont rendues dès le premier paint pour que la fiche du hero
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
export const SHOWCASE_AS_OF = '2026-08-12';

export const FROZEN_SLOTS: FrozenShowcase[] = [
  {
    "stock": {
      "ticker": "SPGI",
      "name": "S&P Global Inc",
      "sector": "Financial Data & Stock Exchanges",
      "note10": 8,
      "pfcfTTM": 22.82763325825826,
      "price": 408.76,
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
          "fr": "30.5%",
          "en": "30.5%",
          "es": "30.5%"
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
          "fr": "13.4%/an",
          "en": "13.4%/year",
          "es": "13.4%/año"
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
          "fr": "26.3%/an",
          "en": "26.3%/year",
          "es": "26.3%/año"
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
          "fr": "-1.02%/an",
          "en": "-1.02%/year",
          "es": "-1.02%/año"
        }
      },
      {
        "key": "revenuePerEmployeeGrowth5y",
        "status": "warn",
        "name": {
          "fr": "CA par employé en progression",
          "en": "Growing revenue per employee",
          "es": "Ingresos por empleado en crecimiento"
        },
        "value": {
          "fr": "0.8%/an",
          "en": "0.8%/year",
          "es": "0.8%/año"
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
          "fr": "39.2%",
          "en": "39.2%",
          "es": "39.2%"
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
          "fr": "2.07 ans",
          "en": "2.07 years",
          "es": "2.07 años"
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
          "fr": "108%",
          "en": "108%",
          "es": "108%"
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
          "fr": "41 j",
          "en": "41 d",
          "es": "41 d"
        }
      }
    ],
    "resilience": {
      "grade": "A",
      "score": 87
    },
    "pfcfPercentile": 27.68361581920904
  },
  {
    "stock": {
      "ticker": "NFLX",
      "name": "Netflix Inc",
      "sector": "Entertainment",
      "note10": 9,
      "pfcfTTM": 27.25806630390224,
      "price": 73.8,
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
          "fr": "28.2%",
          "en": "28.2%",
          "es": "28.2%"
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
        "key": "revenuePerEmployeeGrowth5y",
        "status": "warn",
        "name": {
          "fr": "CA par employé en progression",
          "en": "Growing revenue per employee",
          "es": "Ingresos por empleado en crecimiento"
        },
        "value": {
          "fr": "2.7%/an",
          "en": "2.7%/year",
          "es": "2.7%/año"
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
          "fr": "0.45 ans",
          "en": "0.45 years",
          "es": "0.45 años"
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
          "fr": "84%",
          "en": "84%",
          "es": "84%"
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
    "pfcfPercentile": 9.722222222222223
  },
  {
    "stock": {
      "ticker": "BKNG",
      "name": "Booking Holdings Inc",
      "sector": "Travel Services",
      "note10": 10,
      "pfcfTTM": 18.90590401520551,
      "price": 210.93,
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
          "fr": "25.5%",
          "en": "25.5%",
          "es": "25.5%"
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
        "key": "revenuePerEmployeeGrowth5y",
        "status": "pass",
        "name": {
          "fr": "CA par employé en progression",
          "en": "Growing revenue per employee",
          "es": "Ingresos por empleado en crecimiento"
        },
        "value": {
          "fr": "17.9%/an",
          "en": "17.9%/year",
          "es": "17.9%/año"
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
          "fr": "0.35 ans",
          "en": "0.35 years",
          "es": "0.35 años"
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
          "fr": "117%",
          "en": "117%",
          "es": "117%"
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
    "pfcfPercentile": 26.31578947368421
  }
];

export const FROZEN_ROWS: LandingStock[] = [
  {
    "ticker": "TSM",
    "name": "Taiwan Semiconductor Manufacturing Company Limited",
    "sector": "Semiconductors",
    "note10": 9,
    "pfcfTTM": 2.169654105669773,
    "price": 415.17,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 2153117869938,
    "dayChangePct": -6.6866,
    "spark": [
      279.29,
      300.43,
      291.51,
      303.89,
      330.56,
      374.58,
      337.95,
      396.06,
      418.45,
      477.57,
      404.25,
      422.06,
      422.06
    ]
  },
  {
    "ticker": "9999.HK",
    "name": "NetEase, Inc.",
    "sector": "Electronic Gaming & Multimedia",
    "note10": 9,
    "pfcfTTM": 12.45301229981062,
    "price": 188.4,
    "currency": "HKD",
    "opportunity": true,
    "marketCap": 606303981600,
    "dayChangePct": -2.332811839744896,
    "spark": [
      204.4,
      212.4,
      236.8,
      217,
      214,
      215,
      205,
      179.2,
      170.5,
      179,
      194.1,
      188.4,
      188.4
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
    "pfcfTTM": 4.696915912301816,
    "price": 25.36,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 90535200000,
    "dayChangePct": 0.7549,
    "spark": [
      29.45,
      26.09,
      25.01,
      28.01,
      29.75,
      30.96,
      28.71,
      27.04,
      24.87,
      24.55,
      23.96,
      25.36,
      25.36
    ]
  },
  {
    "ticker": "ABEV",
    "name": "Ambev S.A.",
    "sector": "Beverages - Brewers",
    "note10": 9,
    "pfcfTTM": 2.463948358249538,
    "price": 3.12,
    "currency": "USD",
    "opportunity": true,
    "marketCap": 48933768000,
    "dayChangePct": 0.3215,
    "spark": [
      2.23,
      2.31,
      2.54,
      2.47,
      2.78,
      3.16,
      2.92,
      2.92,
      3.21,
      3.14,
      3.11,
      2.84,
      2.84
    ]
  }
];

export const FROZEN_PEA_ROWS: LandingStock[] = [
  {
    "ticker": "ETE.AT",
    "name": "National Bank of Greece S.A.",
    "sector": "Banks - Regional",
    "note10": 9,
    "pfcfTTM": 4.641396380094696,
    "price": 16.185,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 14703943732.14,
    "dayChangePct": 0.09276390621694597,
    "spark": [
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
      16.1,
      16.34,
      16.18
    ]
  },
  {
    "ticker": "G.MI",
    "name": "Assicurazioni Generali S.p.A.",
    "sector": "Insurance - Diversified",
    "note10": 9,
    "pfcfTTM": 3.601902884948513,
    "price": 44.81,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 69257388671.79001,
    "dayChangePct": 0.4033137521328977,
    "spark": [
      33.41,
      33.35,
      34.18,
      35.75,
      34.39,
      36.16,
      34.51,
      38.1,
      38.71,
      42.61,
      43.99,
      44.83,
      44.81
    ]
  },
  {
    "ticker": "ALV.DE",
    "name": "Allianz SE",
    "sector": "Insurance - Diversified",
    "note10": 9,
    "pfcfTTM": 5.36493641896652,
    "price": 433.5,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 166012592548.5,
    "dayChangePct": -0.710033454003349,
    "spark": [
      357.4,
      348.2,
      372.3,
      390.5,
      371.8,
      382.2,
      359.3,
      389,
      381.6,
      414.1,
      432.5,
      440.7,
      433.5
    ]
  },
  {
    "ticker": "IAG.MC",
    "name": "International Consolidated Airlines Group S.A.",
    "sector": "Airlines",
    "note10": 9,
    "pfcfTTM": 8.250143941513032,
    "price": 5.158,
    "currency": "EUR",
    "opportunity": false,
    "marketCap": 25954952840,
    "dayChangePct": -0.4247071248587024,
    "spark": [
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
      5.05,
      5.2,
      5.16
    ]
  }
];

/** Référencé pour que le type reste importé même si l'inférence suffit. */
export type { FrozenCriterion };
