import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Revue manuelle : corrige a la main une poignee de notes de resilience jugees incoherentes,
 * et supprime une ligne qui n'aurait jamais du etre ecrite. Le fichier ACCUMULE les campagnes
 * datees (chaque correction porte sa propre marque, cf. `mark`) : rejouer le script est sans
 * effet sur les lignes deja corrigees, les garde-fous `from`/`to` les ignorent.
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
  /** Campagne d'ou vient la correction. Defaut : la revue d'audit du 2026-08-07. */
  mark?: string;
}

/** Tracabilite sans migration : concatene a `model`, qui n'est pas expose a l'UI (cf. ResilienceStars). */
const MARK = 'revue-manuelle-2026-08-07';
const MARK_2026_08_11 = 'revue-manuelle-2026-08-11';

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
  {
    // La note initiale opposait la concurrence chinoise du contracting international a une societe
    // dont la valeur est dans les concessions, ou la Chine est structurellement exclue (l'Etat
    // concede). Neutraliser cette force ne suffit pourtant pas : « neutre » vaut 0,5 au bareme. Le 1
    // vient des DEUX forces qui la renforcent vraiment, la robotique et l'IA. `adjacent` reste a 0,5
    // : Cobra IS a ete ACHETE a ACS, pas absorbe depuis la base installee, et Vinci Energies gagne
    // ses chantiers en appel d'offres comme n'importe quel contractant — avantage reel mais partiel,
    // au meme niveau que Visa (0,5) dans les exemples de calibrage.
    tickers: ['DG.PA', 'VCISY', 'VCISF', 'DG.F'],
    label: 'Vinci',
    from: 4,
    to: 4.5,
    set: {
      forces: {
        star: 1,
        justification: "Deux forces la renforcent : la robotique baisse le cout des travaux qu'elle execute sur ses propres actifs concedes, et l'electrification tiree par l'IA remplit le carnet de Vinci Energies ; la Chine, elle, n'a pas acces aux concessions francaises.",
      },
    },
    mark: MARK_2026_08_11,
  },
];

/**
 * Suppressions : lignes dont la note en base est FAUSSE par identite, pas par jugement.
 *
 * Deux cas, symetriques. Une note recopiee depuis une societe SANS RAPPORT (le nom canonique les
 * confondait, cf. isSameCompany). Et l'inverse : une meme societe portant DEUX notes divergentes,
 * parce que ses lignes sont tombees dans deux shards paralleles du backfill et qu'aucune n'a vu
 * l'autre (cf. BackfillOptions.offset). Dans les deux cas la reparation est la meme : supprimer les
 * lignes fautives et laisser le backfill les reprendre — il recopie desormais la note de la societe
 * quand c'est bien la meme, et la refuse quand ce n'en est pas une.
 *
 * ATTENTION, une suppression n'est PAS idempotente : contrairement aux corrections, qui se gardent
 * par `from`/`to`, elle repart des que la ligne reexiste. Une campagne consommee doit donc porter
 * `appliedOn`, sinon le prochain lancement du script detruit ce que le backfill a re-note depuis.
 *
 * NE SUPPRIMER QU'APRES avoir merge le correctif d'identite : sans lui le backfill rejoue exactement
 * la meme recopie, sans meme appeler un modele (l'index des notes existantes est interroge avant).
 * C'est ce qui est arrive a MRK.DE le 07/08.
 */
const DELETIONS: { tickers: string[]; why: string; appliedOn?: string }[] = [
  {
    tickers: ['MRK.DE'],
    why: "Merck KGaA porte la note de Merck & Co, recopiee mot pour mot : la canonisation des raisons sociales reduit les deux a « merck ». Deux societes sans rapport (outils de life science contre pharma US). On supprime pour que le backfill la note pour elle-meme.",
    // CONSOMMEE, ET LA REPARATION A ECHOUE. La ligne a bien ete supprimee le 07/08, mais le backfill
    // ne l'a pas re-notee : il a retrouve « merck » dans l'index des notes existantes et recopie
    // Merck & Co une seconde fois, sans appel au modele (meme empreinte de justifications, Keytruda
    // compris, ecrite le 09/08). La reprise est plus bas, apres le correctif d'identite.
    appliedOn: '2026-08-07',
  },
  {
    // Les 9 lignes que l'audit du 11/08/2026 (scripts/resilienceStarsHomonymAudit.ts) trouve en base
    // avec l'empreinte de justifications EXACTE d'une autre societe. La note affichee n'est pas la
    // leur : elle argumente l'activite d'une entreprise sans rapport.
    //
    // Le correctif d'identite (`isSameCompany` : initiales de tete + famille juridique, `kgaa` rendu
    // discriminant) refuse desormais chacune de ces fusions, donc le backfill les repioche et les
    // note pour elles-memes. Elles reviennent par capi decroissante, sur plusieurs nuits pour les
    // plus petites ; d'ici la elles n'affichent plus de note, ce qui vaut mieux que celle d'une autre.
    tickers: [
      'MRK.DE',      // Merck KGaA (life science)            <- Merck & Co Inc (pharma US)
      'SIEMENS.NS',  // Siemens Limited (Inde)               <- Siemens Aktiengesellschaft
      'HRB',         // H & R Block Inc (fiscalite)          <- Block Inc (paiements)
      'TITC.BR',     // Titan S.A. (ciment)                  <- Titan Company Limited (joaillerie IN)
      'TITC.AT',     // idem, seconde cotation
      'IRE.MI',      // Iren SpA (utility italienne)         <- IREN Ltd (minage de bitcoin)
      '051900.KS',   // LG H&H (soins, cosmetique)           <- LG Corp (holding)
      'ARG.PA',      // Argan SA (REIT logistique)           <- Argan Inc (BTP US)
      'STBA',        // S&T Bancorp Inc                      <- Bancorp Inc (TBBK)
    ],
    why: "note recopiee a l'identique depuis une societe homonyme sans rapport ; supprimee pour que le backfill la note pour elle-meme",
  },
  {
    // MUTUALISATION DES NOTES DIVERGENTES. Une meme entreprise affichait DEUX notes selon la place de
    // cotation consultee. Les lignes portent le meme nom canonique, donc la recopie aurait du jouer :
    // elle n'a pas pu, les lignes etant tombees dans deux shards paralleles du backfill, chacun ayant
    // charge l'index des notes AVANT que l'autre n'ecrive (effet de bord assume, cf.
    // BackfillOptions.offset). Balayage du 11/08/2026 sur les societes multi-cotees de l'univers :
    // 20 affichaient deux TOTAUX differents, et l'ecart n'etait pas cosmetique (KT 2,5 contre 4,
    // XPeng 1 contre 2, Tenaris 2,5 contre 1,5, Inventiva 0,5 contre 1,5).
    //
    // QUELLE LIGNE ON GARDE. Celle de plus grosse capi, sans arbitrer le fond : c'est deja la regle du
    // backfill (groupRowsByCompany prend le brief de la premiere ligne, la file etant triee par capi
    // decroissante), et les deux notes sortent du meme bareme et du meme controle croise. Les autres
    // lignes ne repassent PAS devant les modeles : elles retrouvent la ligne gardee dans l'index et
    // `isSameCompany` confirme la meme societe, donc la note est recopiee, gratuitement.
    //
    // Les 13 societes ou seules les JUSTIFICATIONS divergent, a total identique, sont laissees en
    // place : rien de contradictoire ne s'affiche, et les toucher couterait des lignes pour rien.
    tickers: [
      'AMCR',        // Amcor                        <- AMC.AX (1 contre 2)
      'AMS.SW',      // ams-OSRAM                    <- AMS2.VI (0,5 contre 2)
      'BELFA',       // Bel Fuse                     <- BELFB (1 contre 3)
      'BIO.B',       // Bio-Rad Laboratories         <- BIO (3 contre 4)
      'LISP.SW',     // Lindt & Sprungli             <- LISN.SW (4 contre 3,5)
      'DGICA',       // Donegal Group                <- DGICB (3 contre 2,5)
      // Seule paire de la liste dont l'identite n'est pas certaine : « EchoStar Corp » (SATS) et
      // « EchoStar Corporation » (ECHO), meme secteur, capis voisines. Vraisemblablement deux lignes
      // du meme emetteur chez le fournisseur. Si ce sont deux societes, l'audit des homonymes le
      // dira au prochain passage (empreinte de justifications identique sur deux societes).
      'ECHO',        // EchoStar                     <- SATS (2 contre 2,5)
      'HAFN',        // Hafnia                       <- HAFNI.OL (0,5 contre 1)
      '6592.TW',     // Hotai Finance                <- 6592A.TW (2 contre 2,5)
      '6592B.TW',    // idem, justifications reecrites a total egal
      'KT',          // KT Corporation               <- 030200.KS (4 contre 2,5)
      'LOGNE.SW',    // Logitech International       <- LOGI (2 contre 2,5)
      'LOGN.SW',     // idem
      'PHARM.AS',    // Pharming Group               <- PHAR (1,5 contre 2,5)
      'RTO',         // Rentokil Initial             <- RTO.L (4 contre 3,5)
      'RUSHB',       // Rush Enterprises             <- RUSHA (3 contre 3,5)
      'TEN.MI',      // Tenaris                      <- TS (1,5 contre 2,5)
      'WF',          // Woori Financial Group        <- 316140.KS (3 contre 2,5)
      'XPEV',        // XPeng                        <- 9868.HK (2 contre 1)
      // Ces deux societes sont sorties du premier releve, fait sur les endpoints publics : ils ne
      // servent que les lignes au statut `scored`, quand le backfill note tout l'univers. L'audit
      // lance sur la base (4 614 notes) les a trouvees.
      'IVA.PA',      // Inventiva                    <- IVA (1,5 contre 0,5)
      'LBTYA',       // Liberty Global               <- LBTYB (3 contre 3,5)
      'LBTYK',       // idem
      // Under Armour est le seul cas ou on supprime LES DEUX lignes plutot que d'en recopier une :
      // UA porte 0,75/5, un QUART d'etoile, que le bareme n'autorise pas (les 5 criteres valent 0,
      // 0,5 ou 1, donc un total tombe forcement sur la demi-etoile). C'est la mediane de DEUX
      // passages Sonnet — `median` fait la moyenne sur un nombre pair — donc une note a re-notter
      // entierement, pas a propager sur UAA.
      'UA',
      'UAA',
    ],
    why: "meme societe notee deux fois avec des totaux divergents : supprimee pour que le backfill recopie la note de la ligne de reference (la plus grosse capi)",
  },
];

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
          const mark = c.mark ?? MARK;
          await prisma.resilienceStarScore.update({
            where: { ticker },
            data: {
              total,
              criteria,
              model: row.model.includes(mark) ? row.model : `${row.model}+${mark}`,
              scoredAt: new Date(),
            },
          });
        }
        changed++;
      }
    }

    for (const d of DELETIONS) {
      if (d.appliedOn) {
        console.log(`  = ${d.tickers.join(', ')} suppression deja consommee le ${d.appliedOn}, ignore.`);
        skipped += d.tickers.length; continue;
      }
      for (const ticker of d.tickers) {
        const row = await prisma.resilienceStarScore.findUnique({ where: { ticker }, select: { total: true } });
        if (!row) { console.log(`  = ${ticker} deja absent, ignore.`); skipped++; continue; }
        console.log(`  ✕ ${ticker.padEnd(12)} supprime (note ${row.total}) — ${d.why}`);
        if (apply) await prisma.resilienceStarScore.delete({ where: { ticker } });
        changed++;
      }
    }

    console.log(`\n${apply ? 'Applique' : 'Simule'} : ${changed} ligne(s), ${skipped} ignoree(s).`);
    if (!apply) console.log('Relancer avec --apply pour ecrire.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: Error) => { console.error(e); process.exit(1); });
