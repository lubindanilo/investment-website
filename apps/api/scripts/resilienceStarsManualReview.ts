import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Revue manuelle du 2026-08-07 : corrige a la main une poignee de notes de resilience jugees
 * incoherentes a l'audit, et supprime une ligne qui n'aurait jamais du etre ecrite.
 *
 * POURQUOI A LA MAIN ET PAS DANS LE BAREME. Chacun de ces cas est un desaccord de jugement sur UNE
 * societe, pas un defaut de population : les moyennes par secteur sont coherentes (chemins de fer
 * 4,38, utilities regulees 4,36, petrole integre 2,22) et 67 % des notes tombent a 0,5 etoile ou
 * moins du controle croise independant. Ajouter une regle au bareme pour deux noms le degraderait.
 * Les outliers se corrigent ici, un par un, en assumant la signature.
 *
 * CE QUI EST CORRIGE, ET COMMENT. Le total n'est jamais pose directement : il est la SOMME des cinq
 * criteres (cf. aggregateTotal), et `criteria` est expose a l'UI. Bouger le seul total afficherait
 * cinq etoiles de detail contredisant le chiffre en tete. On deplace donc les criteres, avec leur
 * justification reecrite.
 *
 * NOTE : `pickDue` du backfill ne repioche QUE les tickers absents de ResilienceStarScore. Ces
 * corrections ne seront donc jamais ecrasees par un run de nuit. Pour faire re-noter une societe,
 * il faut supprimer sa ligne (c'est ce qu'on fait pour MRK.DE).
 *
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsManualReview.ts          # simulation
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsManualReview.ts --apply  # ecrit
 */

type Star = 0 | 0.5 | 1;
type CriterionKey = 'besoin' | 'controle' | 'forces' | 'adjacent' | 'capture';

interface Correction {
  /** Tous les tickers de la MEME societe : la resilience juge une entreprise, pas une cotation. */
  tickers: string[];
  label: string;
  /** Total attendu AVANT correction. Garde-fou : si la base a bouge, on ne touche a rien. */
  from: number;
  to: number;
  /** Seuls les criteres qui changent, avec la justification reecrite. */
  set: Partial<Record<CriterionKey, { star: Star; justification: string }>>;
}

const CORRECTIONS: Correction[] = [
  {
    tickers: ['CCJ'],
    label: 'Cameco',
    from: 4.5,
    to: 3,
    set: {
      controle: {
        star: 0.5,
        justification: "Gisements a haute teneur geologiquement rares, mais l'uranium livre est fongible et cote sur un marche mondial : l'acheteur prend la livre du concurrent sans rien perdre, le role reste contournable.",
      },
      forces: {
        star: 0.5,
        justification: "L'IA et le programme nucleaire chinois gonflent la demande d'uranium, mais ce vent porte tous les producteurs a egalite : la place de Cameco n'en devient pas plus dure a prendre.",
      },
      adjacent: {
        star: 0.5,
        justification: "L'extension via la participation minoritaire dans Westinghouse est reelle mais partielle : Cameco n'opere pas l'outcome nucleaire complet.",
      },
    },
  },
  {
    tickers: ['ABEV', 'ABEV3.SA'],
    label: 'Ambev',
    from: 4.5,
    to: 3,
    set: {
      controle: {
        star: 0.5,
        justification: "Brahma et Skol creent une preference reelle, mais contestee en permanence par le prix au Bresil, et BEES reste une interface de distribution replicable sous cinq ans.",
      },
      forces: {
        star: 0.5,
        justification: "BEES optimise la logistique et le pricing, mais c'est un gain d'efficacite que les concurrents obtiendront aussi : aucune des trois forces ne rend la place d'Ambev plus dure a prendre.",
      },
      capture: {
        star: 0.5,
        justification: "Part de marche dominante, mais la capture s'exerce sous pression tarifaire constante et depend du pouvoir d'achat bresilien.",
      },
    },
  },
  {
    tickers: ['7974.T'],
    label: 'Nintendo',
    from: 4.5,
    to: 3.5,
    set: {
      capture: {
        star: 0.5,
        justification: "Ecosysteme ferme et fidelite tres fortes, mais les resultats dependent des hits et du cycle console : le passage Wii U montre que ce choc-la n'est pas mitige.",
      },
    },
  },
  {
    tickers: ['TSCO.L'],
    label: 'Tesco',
    from: 2.5,
    to: 3.5,
    set: {
      besoin: {
        star: 1,
        justification: "Nourrir un pays est une demande payee qui persiste et croit avec la population, et c'est un des roles les moins absorbables par un agent.",
      },
      controle: {
        star: 1,
        justification: "Densite de magasins quasi irreproductible dans un pays contraint en permis d'urbanisme, convertie en fulfillment et en retail media via Clubcard : reseau physique CONVERTI, pas simplement possede.",
      },
    },
  },
  {
    tickers: ['INFY', 'INFY.NS'],
    label: 'Infosys',
    from: 0.5,
    to: 1.5,
    set: {
      controle: {
        star: 0.5,
        justification: "Contrats pluriannuels et imbrication profonde dans les ERP et mainframes clients : avantage reel mais etroit et conteste par TCS, Accenture et les acteurs IA natifs.",
      },
      capture: {
        star: 0.5,
        justification: "Capture sous forte pression tarifaire, mais les couts de sortie d'un integrateur en place se comptent en annees, pas en trimestres.",
      },
    },
  },
  {
    tickers: ['GWW'],
    label: 'Grainger',
    from: 3,
    to: 3.5,
    set: {
      controle: {
        star: 1,
        justification: "KeepStock place du stock gere par Grainger a l'INTERIEUR de l'usine du client : c'est une installed base, pas une interface d'achat reconstructible par un agent.",
      },
    },
  },
];

/** Ligne ecrite par recopie d'homonyme depuis une societe SANS RAPPORT (cf. normalizeCompanyName). */
const DELETIONS = [
  {
    ticker: 'MRK.DE',
    why: "Merck KGaA porte la note de Merck & Co, recopiee mot pour mot : la canonisation des raisons sociales reduit les deux a « merck ». Deux societes sans rapport (outils de life science contre pharma US). On supprime pour que le backfill la note pour elle-meme.",
  },
];

const MARK = 'revue-manuelle-2026-08-07';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  let changed = 0, skipped = 0;
  try {
    for (const c of CORRECTIONS) {
      for (const ticker of c.tickers) {
        const row = await prisma.resilienceStarScore.findUnique({
          where: { ticker },
          select: { total: true, criteria: true, model: true },
        });
        if (!row) { console.log(`  ⨯ ${ticker} absent de la table, ignore.`); skipped++; continue; }
        if (row.total === c.to) { console.log(`  = ${ticker} deja a ${c.to}, ignore.`); skipped++; continue; }
        if (row.total !== c.from) {
          console.log(`  ⨯ ${ticker} attendu a ${c.from} mais vaut ${row.total} : la base a bouge, on ne touche a rien.`);
          skipped++; continue;
        }

        const criteria = { ...(row.criteria as Record<CriterionKey, { star: number; justification: string }>) };
        for (const [key, val] of Object.entries(c.set)) criteria[key as CriterionKey] = val!;
        const total = (['besoin', 'controle', 'forces', 'adjacent', 'capture'] as const)
          .reduce((s, k) => s + criteria[k].star, 0);
        if (total !== c.to) {
          console.log(`  ⨯ ${ticker} : la somme des criteres donne ${total}, pas ${c.to}. Correction incoherente, abandon.`);
          skipped++; continue;
        }

        console.log(`  → ${ticker.padEnd(10)} ${c.label.padEnd(10)} ${c.from} → ${c.to}  (${Object.keys(c.set).join(', ')})`);
        if (apply) {
          await prisma.resilienceStarScore.update({
            where: { ticker },
            data: {
              total,
              criteria,
              // Tracabilite sans migration : `model` n'est pas expose a l'UI (cf. ResilienceStars).
              model: row.model.includes(MARK) ? row.model : `${row.model}+${MARK}`,
              scoredAt: new Date(),
            },
          });
        }
        changed++;
      }
    }

    for (const d of DELETIONS) {
      const row = await prisma.resilienceStarScore.findUnique({ where: { ticker: d.ticker }, select: { total: true } });
      if (!row) { console.log(`  = ${d.ticker} deja absent, ignore.`); skipped++; continue; }
      console.log(`  ✕ ${d.ticker} supprime (note ${row.total}) — ${d.why}`);
      if (apply) await prisma.resilienceStarScore.delete({ where: { ticker: d.ticker } });
      changed++;
    }

    console.log(`\n${apply ? 'Applique' : 'Simule'} : ${changed} ligne(s), ${skipped} ignoree(s).`);
    if (!apply) console.log('Relancer avec --apply pour ecrire.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: Error) => { console.error(e); process.exit(1); });
