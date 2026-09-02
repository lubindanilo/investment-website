import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { aggregateTotal, publicCriteriaSchema } from '../src/services/resilienceStars.js';

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
 *
 * Par defaut les DEUX moities passent : les corrections ET les campagnes de suppression encore
 * ouvertes (celles sans `appliedOn`). Pour n'en jouer qu'une — appliquer une correction sans
 * declencher une campagne de suppression de plusieurs centaines de lignes, ou l'inverse :
 *
 *   ... resilienceStarsManualReview.ts --apply --corrections-only
 *   ... resilienceStarsManualReview.ts --apply --deletions-only
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
const MARK_2026_08_12 = 'revue-manuelle-2026-08-12';

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
  {
    // LE 1 N'A JAMAIS ETE ARBITRE CONTRE LE 2. XPeng fait partie des 20 societes multi-cotees que la
    // campagne du 11/08 a trouvees avec deux totaux divergents (XPEV 2, 9868.HK 1, cf. la deletion
    // plus bas). La regle appliquee gardait la ligne de plus grosse capi SANS arbitrer le fond : le 1
    // a gagne par ordre de file, et les deux capis se tiennent a 0,1 Md$ pres. La ligne porte en plus
    // le verdict `flagged` — Sonnet et V3 ne se sont jamais rejoints — donc elle attendait
    // explicitement cette revue-ci. On tranche ici, en corrigeant les deux criteres qui ne tiennent
    // pas la lettre du bareme.
    //
    // `controle` 0 -> 0,5. Le 0 est reserve a « aucun contrôle » ou a une interface reconstructible ;
    // le 0,5 couvre le contrôle « reel mais etroit/conteste/replicable sous ~5 ans ». Or « stack/
    // donnee proprietaire » est un contrôle recevable au bareme, et XPeng a sa pile ADAS integree, sa
    // puce Turing et la boucle de donnees de sa flotte. La justification ecrite par le modele
    // (« reproductibles par des dizaines de concurrents chinois ») EST la definition du 0,5.
    //
    // `adjacent` 0 -> 0,5. La regle « jamais une option speculative » condamne a juste titre les
    // robots humanoides et les voitures volantes, et la justification ne parlait que de ceux-la. Elle
    // ignorait l'adjacent DEJA REALISE : la vente d'architecture E/E et de logiciel a Volkswagen,
    // qui produit du revenu aujourd'hui. C'est « avantage adjacent reel mais partiel », soit 0,5.
    //
    // Les trois autres criteres ne bougent pas : `besoin` 0,5 et `capture` 0 collent a un
    // constructeur chinois en guerre des prix, et `forces` 0,5 est deja le mitige du bareme.
    tickers: ['XPEV', '9868.HK'],
    label: 'XPeng',
    from: 1,
    to: 2,
    set: {
      controle: {
        star: 0.5,
        justification: "Pile ADAS développée en interne, puce Turing maison et boucle de données de la flotte : contrôle réel, mais étroit et réplicable sous cinq ans par les autres constructeurs chinois.",
      },
      adjacent: {
        star: 0.5,
        justification: "La vente d'architecture E/E et de logiciel à Volkswagen est une adjacence déjà réalisée et rémunérée : avantage réel mais partiel, les humanoïdes et voitures volantes restant spéculatifs.",
      },
    },
    mark: MARK_2026_08_12,
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
 *
 * `guard` rend la campagne IDEMPOTENTE quand le defaut est lisible sur la ligne elle-meme : la
 * suppression ne part que si le defaut y est encore, comme `from`/`to` protege une correction. Une
 * campagne large en a besoin — entre le moment ou on ecrit la liste et celui ou on la joue, le
 * backfill a pu re-noter, et une liste nue detruirait la note neuve.
 */
interface Deletion {
  tickers: string[];
  why: string;
  appliedOn?: string;
  /** `incoherent` : ne supprimer que si `total` contredit encore la somme des cinq criteres. */
  guard?: 'incoherent';
}

const DELETIONS: Deletion[] = [
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
    // CONSOMMEE le 11/08/2026 : les 9 lignes sont absentes de la base, le backfill ne les a pas
    // encore repiochees. Sans cette marque, la campagne suivante lancee avec --apply detruirait
    // les notes neuves des qu'il l'aura fait.
    appliedOn: '2026-08-11',
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
    // CONSOMMEE le 11/08/2026 : aucune des 24 lignes n'est en base.
    appliedOn: '2026-08-11',
  },
  {
    // LE TOTAL AFFICHE CONTREDISAIT LES CINQ ETOILES AFFICHEES SOUS LUI. Le controle croise
    // composait la note retenue ainsi : `{ ...base, total: median(sonnetTotals) }`. Les CRITERES
    // venaient du passage Sonnet de base, le TOTAL de la mediane des passages : des qu'une escalade
    // retenait une autre valeur, la carte annoncait un chiffre que son propre detail ne sommait pas
    // (ResilienceStars.tsx lit les deux champs de la MEME ligne). La source est refermee
    // (`pickSonnetPass`, PR #277) ; ces lignes-la ont ete ecrites avant.
    //
    // Releve du 11/08/2026 par scripts/resilienceStarsTotalAudit.ts sur 4 581 notes : 321 lignes
    // incoherentes (~314 societes), 3 d'entre elles au quart d'etoile. 118 ecarts valent une etoile
    // ou plus, jusqu'a 2,5 (TROX affichait 1/5 pour un detail qui somme 3,5). Aucune ligne ne sort
    // du motif de l'ancien code, et `criteria` est lisible partout.
    //
    // POURQUOI SUPPRIMER PLUTOT QUE REECRIRE LE TOTAL SUR LA SOMME. Le geste gratuit semblait
    // preferable — il ne coute aucun appel modele — mais il revient a RETENIR LE PASSAGE DE BASE,
    // puisque les criteres stockes sont les siens. Or ces lignes ont escalade precisement PARCE QUE
    // le passage de base s'ecartait de V3 de plus d'une demi-etoile : c'est le declencheur de
    // l'escalade. Recalcule sur ce passage, le verdict des 321 redevient `flagged`, dont les 186
    // aujourd'hui `resolved`. On rendrait la ligne coherente en lui restituant la note que le
    // controle croise avait justement ecartee, et en convertissant 186 arbitrages en revues
    // humaines. Appliquer `pickSonnetPass` retroactivement n'est pas possible non plus : seuls les
    // TOTAUX des autres passages sont en base, pas leurs criteres.
    //
    // La re-notation est donc le seul chemin vers une note a la fois coherente et arbitree. Elle
    // repasse devant les deux modeles, par capi decroissante, sur quelques nuits ; d'ici la ces
    // societes n'affichent plus de note, ce qui vaut mieux qu'un total qui se contredit.
    //
    // La liste se REGENERE, elle ne se maintient pas a la main :
    //   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsTotalAudit.ts --csv
    guard: 'incoherent',
    tickers: [
      '000270.KS',   '010130.KS',   '032830.KS',   '0939.HK',     '1177.HK',     '1AST.VI',
      '2303.TW',     '2784.T',      '2884.TW',     '300842.SZ',   '300871.SZ',   '300872.SZ',
      '300905.SZ',   '300926.SZ',   '3302.T',      '3382.T',      '4188.T',      '6670.TW',
      '6719.TW',     '6752.T',      '6949.TW',     '7459.T',      '7610.TW',     '7740.T',
      '7744.T',      '7747.T',      '7995.T',      'AA',          'ABG',         'ACGL',
      'ACM',         'ADEN.SW',     'AFRM',        'AGL.AX',      'ALGT',        'ALO.PA',
      'ALR.WA',      'AMC',         'AMRZ',        'AMRZ.SW',     'AMRZE.SW',    'AMSC',
      'ANIP',        'APLE',        'ARB.AX',      'ARI',         'ARLO',        'ASC',
      'ASIC',        'ATEN',        'ATHM',        'AXSM',        'AXTI',        'BAP',
      'BBDC',        'BCSS',        'BDX.WA',      'BFC',         'BFG.MI',      'BIM.PA',
      'BIOA',        'BIRK',        'BKV',         'BLFS',        'BLSH',        'BOOT',
      'BW',          'CASH.MC',     'CAT',         'CCB',         'CCO',         'CDNL',
      'CIB',         'CIPLA.NS',    'CLF',         'CLS',         'CMO.MC',      'CNA',
      'CNO',         'COALINDIA.NS','CPAC',        'CRAP.PA',     'CRSP',        'CRWV',
      'CSIQ',        'CSWC',        'CUBE',        'CWK.L',       'CWR.L',       'DEO',
      'DGE.L',       'DGED.L',      'DHC',         'DIE.BR',      'DIVISLAB.NS', 'DNLI',
      'DNLM.L',      'ECPG',        'EDNR.MI',     'EDU',         'EEX',         'EIX',
      'ELE',         'EN.PA',       'ENVX',        'EOSE',        'EPIC.SW',     'EQBK',
      'ERG.MI',      'ES',          'ESTA',        'EWTX',        'EXLS',        'EZJ.L',
      'F34.SI',      'FBK.MI',      'FEIM',        'FIZZ',        'FMC',         'FSG.L',
      'GCBC',        'GEBNE.SW',    'GIC',         'GILT',        'GLIBA',       'GLNG',
      'GNFT.PA',     'GNW',         'GRAB',        'GSL',         'GSM',         'GWRE',
      'GXO',         'HCSG',        'HGTY',        'HIMS',        'HLMA.L',      'HLX',
      'HMC.AX',      'HMSO.L',      'HNI',         'HNRG',        'HOG',         'HTFL',
      'ICHR',        'IDT',         'IESC',        'IFCN.SW',     'IHP.L',       'IMOS',
      'IMPN.SW',     'INF.L',       'INSM',        'ISN.SW',      'ISS.CO',      'ITRI',
      'ITRN',        'IVG.MI',      'IVZ',         'JBSS',        'JGGI.L',      'JKHY',
      'JOYY',        'KEEL',        'KEN',         'KER.PA',      'KLIC',        'KNSA',
      'KNX',         'KRUS',        'LAR',         'LB',          'LIFE',        'LILA',
      'LILAK',       'LMAT',        'LOPE',        'LPX',         'LQDT',        'LSTR',
      'LUN.TO',      'LUXE',        'MANH',        'MBLY',        'MCRI',        'MDGL',
      'MESO',        'MFIC',        'MGAM.L',      'MGM',         'MIAX',        'MNKD',
      'MRLN',        'MRO.L',       'MRTN',        'MTO.L',       'MZTI',        'NA.TO',
      'NAMS',        'NBG6.DE',     'NBS.L',       'NCH2.DE',     'NET',         'NG',
      'NHC.AX',      'NHY.OL',      'NN',          'NN.AS',       'NPKI',        'NRGV',
      'NUE',         'NUVB',        'NXT',         'OCSL',        'OLED',        'ONDS',
      'OPK',         'OR',          'ORA',         'OSB.L',       'OSW',         'OTP.BD',
      'PCRX',        'PCT',         'PDFS',        'PECO',        'PFSI',        'PGNY',
      'PHAT',        'PHR',         'PHVS',        'PLGO',        'PLNT',        'PLS.AX',
      'POST.VI',     'PRAA',        'PRCT',        'PRGO',        'PRSU',        'PTCT',
      'PUB.PA',      'QNT',         'QUEST.AT',    'REY.MI',      'RGEN',        'RIVN',
      'RMD',         'ROOT',        'RPI.L',       'RRR',         'RXRX',        'S63.SI',
      'S92.DE',      'SAB.MC',      'SAFE',        'SAR.AT',      'SARO',        'SBGI',
      'SBILIFE.NS',  'SBLK',        'SDHC',        'SGI',         'SHG',         'SIG.AX',
      'SKE',         'SLR.MC',      'SLRC',        'SN',          'SNAP',        'SOUN',
      'SPA.BR',      'SPG.DE',      'SQM',         'SSPG.L',      'ST',          'STDN',
      'STLD',        'STOK',        'STVN',        'SUBC.OL',     'TBBK',        'TBN',
      'TEL2-B.ST',   'TFIN',        'TGLS',        'TGT',         'TNE.AX',      'TOTS3.SA',
      'TRN.L',       'TROX',        'TSAT.TO',     'TSK.MC',      'TTMI',        'TXRH',
      'UCTT',        'UHAL',        'UHAL.B',      'UMC',         'USAS',        'V03.SI',
      'VALE',        'VALE3.SA',    'VEL',         'VIL.PA',      'VINP',        'VIR',
      'VIRT',        'VLTO',        'VLX.L',       'VPG',         'WAWI.OL',     'WD',
      'WEST',        'WFRD',        'WIE.VI',      'WLY',         'WLYB',        'WOLF',
      'WRT1V.HE',    'WYFI',        'YALA',
    ],
    why: "total ecrit par l'ancien controle croise, contredit par la somme de ses propres criteres ; supprimee pour re-notation sous le code corrige",
  },
];

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  // Les deux moities du script n'ont pas le meme rayon d'action : une correction touche une poignee
  // de lignes et se garde par `from`/`to`, une campagne de suppression en retire des centaines et
  // les rend invisibles jusqu'a ce que le backfill les repioche (250 par nuit). Vouloir appliquer
  // une correction d'une societe ne devrait pas obliger a declencher la campagne de suppression en
  // cours dans le meme fichier : ces deux drapeaux permettent de jouer une moitie a la fois. Sans
  // eux, les deux passent — comportement d'origine, conserve par defaut.
  const only = process.argv.includes('--corrections-only') ? 'corrections'
    : process.argv.includes('--deletions-only') ? 'deletions'
    : null;
  const prisma = new PrismaClient();
  let changed = 0, skipped = 0;
  try {
    for (const c of only === 'deletions' ? [] : CORRECTIONS) {
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

    for (const d of only === 'corrections' ? [] : DELETIONS) {
      if (d.appliedOn) {
        console.log(`  = ${d.tickers.length} ticker(s) : suppression deja consommee le ${d.appliedOn}, ignore.`);
        skipped += d.tickers.length; continue;
      }
      for (const ticker of d.tickers) {
        const row = await prisma.resilienceStarScore.findUnique({
          where: { ticker },
          select: { total: true, criteria: true },
        });
        if (!row) { console.log(`  = ${ticker} deja absent, ignore.`); skipped++; continue; }
        // Garde-fou de campagne large : la ligne a pu etre re-notee depuis que la liste a ete
        // ecrite. Une note redevenue coherente n'est plus celle qu'on visait, on n'y touche pas.
        if (d.guard === 'incoherent') {
          const criteria = publicCriteriaSchema.safeParse(row.criteria);
          if (criteria.success && aggregateTotal(criteria.data) === row.total) {
            console.log(`  = ${ticker.padEnd(12)} re-notee et coherente (${row.total}/5), ignore.`);
            skipped++; continue;
          }
        }
        console.log(`  ✕ ${ticker.padEnd(12)} supprime (note ${row.total}) — ${d.why}`);
        if (apply) await prisma.resilienceStarScore.delete({ where: { ticker } });
        changed++;
      }
    }

    const scope = only ? ` (${only} seulement)` : '';
    console.log(`\n${apply ? 'Applique' : 'Simule'}${scope} : ${changed} ligne(s), ${skipped} ignoree(s).`);
    if (!apply) console.log('Relancer avec --apply pour ecrire.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: Error) => { console.error(e); process.exit(1); });
