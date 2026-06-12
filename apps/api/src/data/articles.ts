/**
 * Contenu éditorial du blog, SOURCE UNIQUE, partagée par :
 *   - apps/web  (SPA : BlogPage + BlogArticlePage, langue active)
 *   - apps/api  (prérendu bots seoPrerender + sitemap)
 *
 * RÈGLE : tout article existe dans les 3 langues (fr/en/es). Style SEO/GEO :
 * titre ≤60 sans marque, réponse auto-portée en tête (answer-first), FAQ, pas
 * d'em dash. Cadre « analyse / éducation », jamais de conseil en investissement.
 */

export type ArticleLang = 'fr' | 'en' | 'es';

export type ArticleBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export interface ArticleContent {
  /** <title> + <h1> (≤ 60 caractères, mot-clé en tête, pas de marque). */
  title: string;
  /** Résumé pour la carte d'index. */
  excerpt: string;
  /** Meta description (≤ 160 caractères). */
  metaDescription: string;
  /** Réponse auto-portée de 40-60 mots, placée en tête (levier GEO). */
  answer: string;
  body: ArticleBlock[];
  faq: { q: string; a: string }[];
  tags: string[];
  /** Mention légale affichée en fin d'article. */
  disclaimer: string;
}

export interface Article {
  slug: string;
  /** YYYY-MM-DD */
  date: string;
  updated: string;
  readingTime: number;
  ticker?: string;
  content: Record<ArticleLang, ArticleContent>;
}

const adobe: Article = {
  slug: 'acheter-action-adobe-avant-resultats',
  date: '2026-06-09',
  updated: '2026-06-10',
  readingTime: 8,
  ticker: 'ADBE',
  content: {
    fr: {
      title: "Faut-il acheter l'action Adobe (ADBE) avant ses résultats ?",
      excerpt:
        "Une entreprise d'élite, au cash le moins cher depuis cinq ans. Mais bonne entreprise et bon prix sont deux choses différentes. Voici comment je tranche, sans émotion.",
      metaDescription:
        "Adobe se paie son cash le moins cher en cinq ans, mais reste au-dessus de mon prix d'achat. Qualité et prix sont deux choses différentes : ma façon de trancher.",
      answer:
        "Adobe est une entreprise d'élite qui se paie aujourd'hui moins cher qu'à n'importe quel moment des cinq dernières années. Mais une bonne entreprise et un bon prix sont deux choses différentes. Le marché a peur que l'IA la détruise, et même après la chute, l'action reste au-dessus de mon prix d'achat raisonnable. Voici comment je tranche, sans pari ni émotion.",
      body: [
        { type: 'ul', items: [
          "Adobe est une entreprise d'élite : marge de free cash flow de 34 %, un moat profond, un bilan quasiment sans dette.",
          "Son action a perdu près de la moitié de sa valeur en deux ans, par peur de l'intelligence artificielle.",
          "Résultat : son cash ne s'est jamais payé aussi peu cher en cinq ans, environ 12 fois, contre une moyenne de 33.",
          "Bon marché ne veut pas dire bonne affaire : à mes hypothèses, l'action reste environ 35 % au-dessus de mon prix d'achat raisonnable.",
          "Ma règle, et le fil de tout l'article : juger la qualité de l'entreprise et le prix de l'action séparément.",
        ] },
        { type: 'h2', text: 'Le piège que presque tout le monde fait' },
        { type: 'p', text: "Adobe a perdu près de la moitié de sa valeur en deux ans. Partout la même phrase : l'intelligence artificielle va la tuer. Midjourney génère des images, OpenAI fait de la vidéo, Canva grignote le design. Le créateur de Photoshop serait le prochain Kodak." },
        { type: 'p', text: "Quand je regarde une action, je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Mélanger les deux, c'est la source d'erreur numéro un." },
        { type: 'h2', text: 'Est-ce une bonne entreprise ? (la qualité)' },
        { type: 'p', text: "Je ne me fie pas à mon intuition. Je passe l'entreprise au crible de critères financiers concrets : est-elle rentable, ses ventes et son cash augmentent-ils, rachète-t-elle ses propres actions plutôt que de gaspiller, sa dette est-elle maîtrisable ? Un chiffre suffit à sentir Adobe : sa marge de free cash flow atteint 34 %. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, machines, impôts). Une marge de 34 %, ça veut dire que sur 100 euros de ventes, 34 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10." },
        { type: 'h2', text: "Le vrai trésor d'Adobe : son moat" },
        { type: 'p', text: "Mais un bon bilan ne raconte pas tout. Ce qui me convainc, c'est le moat d'Adobe : son fossé concurrentiel, ce qui empêche un rival de prendre sa place. Demande à un monteur vidéo ou à un service marketing d'abandonner Premiere ou Photoshop : il ne peut pas. Des années de fichiers, de réflexes, de formation. Résultat, 94 % des revenus d'Adobe sont des abonnements qui retombent chaque année, et l'entreprise pèse près de 58 % du marché mondial du logiciel créatif. Côté gestion, le signe qui ne trompe pas : elle rachète ses propres actions et n'a quasiment pas de dette. Ce n'est pas une entreprise fragile, c'est une infrastructure." },
        { type: 'h2', text: "Alors pourquoi l'action s'est-elle effondrée ? (le prix)" },
        { type: 'p', text: "Parce que le marché ne paie pas une entreprise, il paie une histoire. Et l'histoire d'Adobe fait peur : sa croissance ralentit (autour de 11 % par an, contre plus de 20 % avant), et l'IA pourrait éroder sa capacité à imposer ses prix." },
        { type: 'p', text: "Pour mesurer ce que le marché accepte de payer, je regarde un ratio simple : le P/FCF (price to free cash flow). C'est le prix de l'action divisé par le free cash flow qu'elle génère chaque année. Un P/FCF de 12, ça veut dire que tu paies aujourd'hui douze années de ce cash. Plus c'est bas, moins c'est cher. Adobe se paie environ 12 fois son free cash flow. Sa moyenne des cinq dernières années était de 33. Son secteur tourne autour de 60. Le marché traite donc l'une des plus belles machines à cash de la tech comme une affaire finie." },
        { type: 'h2', text: 'Le vrai débat (et le piège)' },
        { type: 'p', text: "Toute la thèse tient en une question : crois-tu que l'IA va réellement casser Adobe, ou que la peur est exagérée ? Si tu penses qu'Adobe défend son territoire, l'action est anormalement bon marché. Si tu crois à la disruption, ce bas prix est un piège, pas une aubaine. Un P/FCF faible n'est jamais une bonne affaire en soi : il l'est seulement si la qualité tient. C'est précisément pour ça que je juge la qualité avant le prix." },
        { type: 'h2', text: 'Comment je tranche, sans émotion' },
        { type: 'p', text: "À des hypothèses prudentes, mon prix d'achat raisonnable pour Adobe se situe autour de 163 dollars. L'action en vaut environ 251. Je suis donc encore à peu près 35 % au-dessus du point d'entrée que je m'autorise. Je ne fonce pas : je note un prix cible, et j'attends qu'il vienne à moi. Avant les résultats, les attentes sont basses. Deux scénarios : une déception rapproche le cours de mon point d'entrée, une bonne surprise sur l'IA peut faire remonter le multiple depuis son plus bas. Dans les deux cas, je sais quoi faire, parce que j'ai un prix, pas une émotion." },
        { type: 'h2', text: 'En résumé' },
        { type: 'p', text: "Adobe est une entreprise d'élite, au cash le moins cher de son histoire, que je surveille de très près sans la payer n'importe quel prix. Savoir si une entreprise est bonne, et à quel prix l'acheter, séparément : c'est tout ce que j'ai voulu pouvoir faire en quelques secondes pour n'importe quelle action. C'est pour ça que j'ai construit mon site d'investissement." },
      ],
      faq: [
        { q: "C'est quoi, le free cash flow ?", a: "L'argent qui reste réellement à l'entreprise après avoir payé tout ce qu'il faut pour tourner et investir. C'est plus difficile à maquiller que le bénéfice comptable, donc je m'y fie davantage." },
        { q: 'Comment je juge la qualité d\'une entreprise ?', a: "Sur des critères financiers objectifs : rentabilité, croissance des ventes et du cash, rachats d'actions, marges, endettement, rendement du capital. La qualité, c'est la solidité du business, indépendamment du prix de l'action." },
        { q: 'Un P/FCF bas, est-ce toujours une bonne affaire ?', a: "Non. Un prix bas peut cacher une entreprise en déclin. Il n'est intéressant que si la qualité, elle, est au rendez-vous. D'où ma règle : la qualité d'abord, le prix ensuite." },
        { q: 'Faut-il acheter Adobe avant ses résultats ?', a: "Ça dépend de ta conviction sur l'IA et de ta discipline de prix. Les attentes sont basses : une déception te rapproche d'un bon point d'entrée, une bonne surprise peut relancer l'action. Ceci n'est pas un conseil en investissement, fais tes propres recherches." },
      ],
      tags: ['Analyse', 'Adobe', 'Valorisation'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres à la date de publication, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: 'Should you buy Adobe (ADBE) stock before earnings?',
      excerpt:
        "An elite company, with its cash cheaper than at any point in five years. But a good company and a good price are two different things. Here is how I decide, without emotion.",
      metaDescription:
        "Adobe's cash is cheaper than in five years, but the stock still trades above my buy price. Quality is not price: how I decide before earnings.",
      answer:
        "Adobe is an elite company trading cheaper today than at any point in the last five years. But a good company and a good price are two different things. The market fears AI will destroy it, and even after the fall, the stock still trades above my reasonable buy price. Here is how I decide, with no bet and no emotion.",
      body: [
        { type: 'ul', items: [
          'Adobe is an elite company: a 34% free cash flow margin, a deep moat, a balance sheet with almost no debt.',
          'Its stock has lost nearly half its value in two years, out of fear of artificial intelligence.',
          'As a result, its cash has never been this cheap in five years: about 12 times, versus an average of 33.',
          'Cheap does not mean a bargain: on my assumptions, the stock still trades about 35% above my reasonable buy price.',
          'My rule, and the thread of this whole piece: judge the quality of the company and the price of the stock separately.',
        ] },
        { type: 'h2', text: 'The trap almost everyone falls into' },
        { type: 'p', text: "Adobe has lost nearly half its value in two years. Everywhere the same sentence: artificial intelligence is going to kill it. Midjourney generates images, OpenAI does video, Canva nibbles at design. The maker of Photoshop is supposedly the next Kodak." },
        { type: 'p', text: "When I look at a stock, I always separate two questions most people confuse. One: is this a good company? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. Mixing the two is the number one source of error." },
        { type: 'h2', text: 'Is it a good company? (quality)' },
        { type: 'p', text: "I do not trust my gut. I run the company through concrete financial criteria: is it profitable, are its sales and cash growing, does it buy back its own shares rather than waste money, is its debt manageable? One number is enough to feel Adobe: its free cash flow margin reaches 34%. Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, machines, taxes). A 34% margin means that on 100 dollars of sales, 34 end up as genuinely available cash. Most companies top out around 10." },
        { type: 'h2', text: "Adobe's real treasure: its moat" },
        { type: 'p', text: "But a good balance sheet does not tell the whole story. What convinces me is Adobe's moat: its competitive ditch, what stops a rival from taking its place. Ask a video editor or a marketing team to drop Premiere or Photoshop: they cannot. Years of files, of habits, of training. As a result, 94% of Adobe's revenue is subscriptions that recur every year, and the company holds nearly 58% of the global creative software market. On management, the sign that does not lie: it buys back its own shares and carries almost no debt. This is not a fragile company, it is infrastructure." },
        { type: 'h2', text: 'So why did the stock collapse? (price)' },
        { type: 'p', text: "Because the market does not pay for a company, it pays for a story. And Adobe's story is scary: its growth is slowing (around 11% a year, versus more than 20% before), and AI could erode its ability to set its prices." },
        { type: 'p', text: "To measure what the market is willing to pay, I look at one simple ratio: the P/FCF (price to free cash flow). It is the share price divided by the free cash flow it generates each year. A P/FCF of 12 means you are paying twelve years of that cash today. The lower it is, the cheaper it is. Adobe trades at about 12 times its free cash flow. Its five-year average was 33. Its sector runs near 60. So the market treats one of the finest cash machines in tech as a finished story." },
        { type: 'h2', text: 'The real debate (and the trap)' },
        { type: 'p', text: "The whole thesis comes down to one question: do you believe AI will truly break Adobe, or that the fear is overblown? If you think Adobe defends its turf, the stock is abnormally cheap. If you believe in disruption, this low price is a trap, not a windfall. A low P/FCF is never a bargain in itself: it only is if the quality holds. That is exactly why I judge quality before price." },
        { type: 'h2', text: 'How I decide, without emotion' },
        { type: 'p', text: "On prudent assumptions, my reasonable buy price for Adobe sits around 163 dollars. The stock is worth about 251. So I am still roughly 35% above the entry point I allow myself. I do not rush in: I note a target price, and I wait for it to come to me. Before earnings, expectations are low. Two scenarios: a disappointment brings the price closer to my entry point, a positive AI surprise can lift the multiple from its low. In both cases, I know what to do, because I have a price, not an emotion." },
        { type: 'h2', text: 'In short' },
        { type: 'p', text: "Adobe is an elite company, with the cheapest cash in its history, that I watch very closely without paying any price for it. Knowing whether a company is good, and at what price to buy it, separately: that is all I ever wanted to be able to do in a few seconds for any stock. That is why I built my investment site." },
      ],
      faq: [
        { q: 'What is free cash flow?', a: "The money a company actually keeps after paying everything it needs to operate and invest. It is harder to dress up than accounting profit, so I trust it more." },
        { q: 'How do I judge the quality of a company?', a: "On objective financial criteria: profitability, growth in sales and cash, share buybacks, margins, debt, return on capital. Quality is the soundness of the business, independent of the stock price." },
        { q: 'Is a low P/FCF always a bargain?', a: "No. A low price can hide a company in decline. It is only attractive if the quality is there too. Hence my rule: quality first, price second." },
        { q: 'Should you buy Adobe before earnings?', a: "It depends on your conviction about AI and your price discipline. Expectations are low: a disappointment brings you closer to a good entry point, a positive surprise can revive the stock. This is not investment advice, do your own research." },
      ],
      tags: ['Analysis', 'Adobe', 'Valuation'],
      disclaimer:
        'Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date, subject to change. Do your own research.',
    },
    es: {
      title: '¿Comprar acciones de Adobe (ADBE) antes de resultados?',
      excerpt:
        "Una empresa de élite, con su caja más barata que en cinco años. Pero buena empresa y buen precio son dos cosas distintas. Así es como decido, sin emoción.",
      metaDescription:
        "La caja de Adobe está más barata que en cinco años, pero la acción sigue por encima de mi precio de compra. Calidad y precio son cosas distintas: cómo decido.",
      answer:
        "Adobe es una empresa de élite que cotiza hoy más barata que en cualquier momento de los últimos cinco años. Pero una buena empresa y un buen precio son dos cosas distintas. El mercado teme que la IA la destruya, y aun tras la caída, la acción sigue por encima de mi precio de compra razonable. Así es como decido, sin apuesta ni emoción.",
      body: [
        { type: 'ul', items: [
          'Adobe es una empresa de élite: margen de flujo de caja libre del 34 %, un foso profundo, un balance casi sin deuda.',
          'Su acción ha perdido cerca de la mitad de su valor en dos años, por miedo a la inteligencia artificial.',
          'Como resultado, su caja nunca se había pagado tan barata en cinco años: unas 12 veces, frente a una media de 33.',
          'Barato no significa ganga: con mis hipótesis, la acción sigue un 35 % por encima de mi precio de compra razonable.',
          'Mi regla, y el hilo de todo el artículo: juzgar la calidad de la empresa y el precio de la acción por separado.',
        ] },
        { type: 'h2', text: 'La trampa en la que cae casi todo el mundo' },
        { type: 'p', text: "Adobe ha perdido cerca de la mitad de su valor en dos años. En todas partes la misma frase: la inteligencia artificial va a matarla. Midjourney genera imágenes, OpenAI hace vídeo, Canva le come terreno al diseño. El creador de Photoshop sería el próximo Kodak." },
        { type: 'p', text: "Cuando miro una acción, siempre separo dos preguntas que la mayoría confunde. Una: ¿es una buena empresa? Dos, completamente aparte: ¿es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Mezclar las dos es la fuente de error número uno." },
        { type: 'h2', text: '¿Es una buena empresa? (la calidad)' },
        { type: 'p', text: "No me fío de mi intuición. Paso la empresa por un tamiz de criterios financieros concretos: ¿es rentable, crecen sus ventas y su caja, recompra sus propias acciones en lugar de derrochar, es manejable su deuda? Un dato basta para intuir a Adobe: su margen de flujo de caja libre llega al 34 %. El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, máquinas, impuestos). Un margen del 34 % significa que de cada 100 euros de ventas, 34 acaban en caja realmente disponible. La mayoría de las empresas no pasan del 10." },
        { type: 'h2', text: 'El verdadero tesoro de Adobe: su foso' },
        { type: 'p', text: "Pero un buen balance no lo cuenta todo. Lo que me convence es el foso de Adobe: su trinchera competitiva, lo que impide a un rival ocupar su lugar. Pídele a un montador de vídeo o a un equipo de marketing que abandone Premiere o Photoshop: no puede. Años de archivos, de reflejos, de formación. Como resultado, el 94 % de los ingresos de Adobe son suscripciones que se repiten cada año, y la empresa representa cerca del 58 % del mercado mundial del software creativo. En cuanto a la gestión, la señal que no engaña: recompra sus propias acciones y casi no tiene deuda. No es una empresa frágil, es una infraestructura." },
        { type: 'h2', text: '¿Y por qué se hundió la acción? (el precio)' },
        { type: 'p', text: "Porque el mercado no paga por una empresa, paga por una historia. Y la historia de Adobe da miedo: su crecimiento se ralentiza (en torno al 11 % anual, frente a más del 20 % antes), y la IA podría erosionar su capacidad de imponer sus precios." },
        { type: 'p', text: "Para medir lo que el mercado acepta pagar, miro un ratio sencillo: el P/FCF (price to free cash flow). Es el precio de la acción dividido entre el flujo de caja libre que genera cada año. Un P/FCF de 12 significa que pagas hoy doce años de esa caja. Cuanto más bajo, más barato. Adobe cotiza a unas 12 veces su flujo de caja libre. Su media de los últimos cinco años era de 33. Su sector ronda el 60. El mercado trata, pues, a una de las mejores máquinas de generar caja de la tecnología como un caso terminado." },
        { type: 'h2', text: 'El verdadero debate (y la trampa)' },
        { type: 'p', text: "Toda la tesis se reduce a una pregunta: ¿crees que la IA va a romper de verdad a Adobe, o que el miedo está exagerado? Si piensas que Adobe defiende su territorio, la acción está anormalmente barata. Si crees en la disrupción, ese precio bajo es una trampa, no un chollo. Un P/FCF bajo nunca es una ganga en sí mismo: solo lo es si la calidad aguanta. Por eso justamente juzgo la calidad antes que el precio." },
        { type: 'h2', text: 'Cómo decido, sin emoción' },
        { type: 'p', text: "Con hipótesis prudentes, mi precio de compra razonable para Adobe se sitúa en torno a 163 dólares. La acción vale unos 251. Así que sigo más o menos un 35 % por encima del punto de entrada que me permito. No me lanzo: anoto un precio objetivo y espero a que venga a mí. Antes de resultados, las expectativas son bajas. Dos escenarios: una decepción acerca la cotización a mi punto de entrada, una sorpresa positiva en IA puede levantar el múltiplo desde su mínimo. En ambos casos sé qué hacer, porque tengo un precio, no una emoción." },
        { type: 'h2', text: 'En resumen' },
        { type: 'p', text: "Adobe es una empresa de élite, con la caja más barata de su historia, que vigilo muy de cerca sin pagarla a cualquier precio. Saber si una empresa es buena, y a qué precio comprarla, por separado: es todo lo que siempre quise poder hacer en unos segundos para cualquier acción. Por eso construí mi sitio de inversión." },
      ],
      faq: [
        { q: '¿Qué es el flujo de caja libre?', a: "El dinero que de verdad le queda a la empresa tras pagar todo lo necesario para operar e invertir. Es más difícil de maquillar que el beneficio contable, así que me fío más de él." },
        { q: '¿Cómo juzgo la calidad de una empresa?', a: "Con criterios financieros objetivos: rentabilidad, crecimiento de ventas y caja, recompras de acciones, márgenes, deuda, rentabilidad del capital. La calidad es la solidez del negocio, al margen del precio de la acción." },
        { q: '¿Un P/FCF bajo es siempre una ganga?', a: "No. Un precio bajo puede ocultar una empresa en declive. Solo es interesante si la calidad también está presente. De ahí mi regla: primero la calidad, después el precio." },
        { q: '¿Hay que comprar Adobe antes de resultados?', a: "Depende de tu convicción sobre la IA y de tu disciplina de precio. Las expectativas son bajas: una decepción te acerca a un buen punto de entrada, una sorpresa positiva puede reactivar la acción. Esto no es asesoramiento de inversión, haz tu propia investigación." },
      ],
      tags: ['Análisis', 'Adobe', 'Valoración'],
      disclaimer:
        'Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a la fecha de publicación, sujetas a cambios. Haz tu propia investigación.',
    },
  },
};

const kinsale: Article = {
  slug: 'kinsale-capital-assureur-10-10',
  date: '2026-06-10',
  updated: '2026-06-10',
  readingTime: 11,
  ticker: 'KNSL',
  content: {
    fr: {
      title: 'Kinsale Capital (KNSL) : assureur noté 10/10, analyse',
      excerpt:
        "Un assureur qui gagne de l'argent rien qu'en assurant, qui grandit de 33 % par an et qui se paie bon marché. Voici pourquoi Kinsale coche mes 10 critères de qualité, et où se cache le piège.",
      metaDescription:
        "Kinsale Capital (KNSL) expliqué simplement : ce que fait cet assureur E and S, son avantage durable, ses risques, et pourquoi il obtient ma note 10/10.",
      answer:
        "Kinsale Capital est un assureur américain d'élite : il couvre les risques bizarres dont personne ne veut, avec une discipline de coûts que ses rivaux ne savent pas copier. Il valide 10 de mes 10 critères de qualité, grandit de 33 % par an, et se paie pourtant bon marché. La qualité est rare, le prix aussi.",
      body: [
        { type: 'h2', text: "L'assureur qui dit oui quand les autres disent non" },
        { type: 'p', text: "La première fois que j'ai regardé Kinsale Capital de près, j'ai cru à une erreur dans mes données. Un assureur avec les marges d'un éditeur de logiciels, ça n'existe pas censément. Et pourtant." },
        { type: 'p', text: "Pour comprendre Kinsale, il faut d'abord comprendre ce qu'il fait. La plupart des assureurs couvrent des choses banales : ta voiture, ta maison, ton entreprise classique. Kinsale, lui, travaille sur le marché de l'assurance E and S (excess and surplus, en français excédents et lignes spéciales). Traduction : les risques atypiques que les assureurs classiques refusent de toucher. Un food truck, un parc d'attractions, un chantier de démolition, une petite société de drones. Des dossiers trop rares, trop biscornus, pour rentrer dans les cases d'un assureur de masse." },
        { type: 'p', text: "Ce coin de marché a une particularité : les prix n'y sont pas réglementés comme dans l'assurance grand public. Celui qui sait bien évaluer un risque inhabituel peut le facturer à son juste prix, et gagner de l'argent. Celui qui se trompe se fait laminer. Kinsale a bâti toute sa maison autour de ce pari : être le meilleur pour dire oui, intelligemment, là où les autres disent non." },
        { type: 'ul', items: [
          "Ce que fait Kinsale : il assure les risques atypiques (E and S) que les assureurs classiques refusent, un marché où l'on peut fixer librement ses prix.",
          "Pourquoi c'est rare : il valide 10 de mes 10 critères de qualité (24 sous-critères sur 25), un score que très peu d'entreprises atteignent.",
          "Le moteur : une discipline de souscription stricte et une structure de coûts très basse, que ses rivaux peinent à copier.",
          "La rentabilité : plus de la moitié de son chiffre d'affaires finit en cash réellement disponible, et il grandit de 33 % par an.",
          "Le revers : la qualité est là, mais l'action a déjà bien monté et l'assurance reste un métier cyclique. Le prix se mérite.",
        ]},
        { type: 'h2', text: "Comment un assureur gagne de l'argent (et pourquoi celui-ci est doué)" },
        { type: 'p', text: "Avant d'aller plus loin, un détour utile, parce que l'assurance se juge avec un thermomètre bien à elle. Un assureur encaisse des primes aujourd'hui et paie des sinistres plus tard. Entre les deux, deux questions décident de tout." },
        { type: 'p', text: "Première question : gagne-t-il de l'argent sur l'acte d'assurer lui-même ? On mesure ça avec le combined ratio (ratio combiné) : la somme des sinistres payés et des frais de fonctionnement, rapportée aux primes encaissées. Sous 100 %, l'assureur est bénéficiaire rien qu'en assurant, avant même de toucher un centime sur ses placements. Au-dessus de 100 %, il perd de l'argent sur son métier et doit se rattraper ailleurs. Beaucoup d'assureurs vivotent autour de 100 %. Kinsale, lui, opère structurellement bien en dessous, et c'est là que tout se joue." },
        { type: 'p', text: "Deuxième question : que fait-il de l'argent en attendant ? Quand tu paies ta prime en janvier, l'assureur ne te rembourse un éventuel sinistre que des mois, parfois des années plus tard. Entre les deux, il garde ce magot et l'investit. C'est ce qu'on appelle le float : l'argent des autres, encaissé avant d'être dépensé, qui travaille gratuitement pour l'assureur. Plus le float grossit, plus la machine tourne." },
        { type: 'p', text: "Kinsale est bon sur les deux tableaux. Et le résultat se voit dans un chiffre qui m'a fait tiquer : sa marge de free cash flow atteint 52 %. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées. Une marge de 52 %, ça veut dire que sur 100 dollars de chiffre d'affaires, 52 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10. C'est un niveau qu'on voit dans le logiciel, pas dans l'assurance. Sa marge nette, elle, ressort à 28 %." },
        { type: 'h2', text: "Le vrai trésor : un moat que l'argent seul n'achète pas" },
        { type: 'p', text: "Un bon bilan ne suffit jamais à me convaincre. Ce que je cherche, c'est le moat : le fossé concurrentiel, ce qui empêche un rival mieux financé de venir prendre la place. Chez Kinsale, le moat ne vient pas d'une marque ou d'un brevet. Il vient de deux choses moins spectaculaires, mais plus solides." },
        { type: 'p', text: "D'abord, la discipline de souscription. Souscrire, c'est l'acte de décider quel risque on accepte et à quel prix. Kinsale dit non beaucoup plus souvent qu'il ne dit oui, et ne court pas après le volume quand les prix deviennent trop bas. Cette retenue, dans un secteur où la tentation de grossir vite est permanente, est plus rare qu'il n'y paraît. Elle explique pourquoi l'entreprise reste profitable sur l'acte d'assurer là où d'autres se brûlent." },
        { type: 'p', text: "Ensuite, la structure de coûts. Kinsale gère presque tout en interne, sur sa propre plateforme technologique, au lieu de déléguer à une nuée d'intermédiaires comme le font les assureurs traditionnels. Moins d'intermédiaires, moins de frais, donc une marge supérieure à risque égal. Cet écart de coûts est difficile à rattraper : il faudrait qu'un concurrent reconstruise des années d'outils et de données. C'est un avantage qui se creuse avec le temps plutôt que de s'éroder." },
        { type: 'p', text: "Côté chiffres, ce moat se traduit par deux mesures que je regarde toujours. La croissance, d'abord : le chiffre d'affaires progresse de 33 % par an depuis cinq ans, et le free cash flow par action de 28 % par an sur la même période, le tout organiquement, sans rachats d'entreprises pour gonfler les statistiques. Le rendement du capital, ensuite : le Cash ROCE atteint 45 %. Cette mesure répond à une question simple : pour chaque dollar mis dans le business, combien de cash il recrache chaque année ? Ici, 45 cents par dollar et par an. C'est environ trois fois le seuil que je considère comme excellent." },
        { type: 'h2', text: "Qu'est-ce que ma note 10/10, au juste ?" },
        { type: 'p', text: "Je ne note pas une entreprise à l'intuition. Je la passe au crible de 10 critères de qualité fondamentale, déclinés en sous-critères concrets : est-elle vraiment rentable, ses ventes et son cash augmentent-ils, transforme-t-elle son bénéfice comptable en cash réel, sa dette est-elle maîtrisée, rend-elle de l'argent à ses actionnaires sans gaspiller ? Une entreprise qui valide tout obtient 10 sur 10. C'est rare, par construction." },
        { type: 'p', text: "Kinsale valide 24 de ces sous-critères sur 25. La note maximale, sur les quatre piliers que je juge les plus importants : rentabilité, croissance, rendement du capital, et solidité du bilan. Sur ce dernier point, l'entreprise n'a pas de dette nette : sa trésorerie couvre l'intégralité de ses emprunts. En clair, elle pourrait tout rembourser demain matin. C'est exactement le genre de coussin qui permet de traverser un mauvais cycle sans paniquer." },
        { type: 'p', text: "Deux détails qui en disent long sur la qualité de la gestion. Le premier : le taux de conversion du bénéfice en cash ressort à 1,89, ce qui signifie que le cash généré dépasse le bénéfice comptable. Une entreprise qui transforme ses profits en argent bien réel, et même davantage, ne triche pas avec ses comptes. Le second : un management qui rend du capital sans gaspiller, avec un nouveau programme de rachat d'actions de 250 millions de dollars annoncé en décembre 2025. Racheter ses propres actions, c'est concentrer la propriété entre les actionnaires restants, à condition de le faire à un prix raisonnable." },
        { type: 'h2', text: "La qualité d'abord, le prix ensuite (et séparément)" },
        { type: 'p', text: "Voici la règle que je n'enfreins jamais : je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement. Sur Kinsale, la première question est tranchée. Reste la seconde." },
        { type: 'p', text: "Pour mesurer le prix, je regarde le P/FCF (price to free cash flow) : le cours de l'action rapporté au cash que l'entreprise génère vraiment chaque année. Un P/FCF de 7, ça veut dire qu'au rythme actuel, tu paies l'équivalent de sept années de ce cash. Plus c'est bas, moins c'est cher. Kinsale se paie 7,0 fois son free cash flow." },
        { type: 'p', text: "Mets ce chiffre en perspective. Des assureurs solides mais bien moins rapides se paient plus cher : Progressive autour de 7,4 fois, Chubb 8,3 fois, RLI 8,8 fois. La médiane du secteur tourne à 7,4 fois. Autrement dit, le marché fait payer Kinsale moins cher que des concurrents qui grandissent deux à trois fois moins vite. C'est inhabituel : d'ordinaire, on paie une prime pour la croissance, pas une décote." },
        { type: 'p', text: "En passant ce profil dans mon modèle de valorisation, avec des hypothèses volontairement prudentes (une croissance du free cash flow ramenée à 20 % par an, bien sous son rythme actuel, et un multiple de sortie modeste de 10 fois), j'obtiens un prix d'achat raisonnable autour de 533 dollars. L'action en vaut environ 303. Le cours est donc à peu près 76 % sous le prix que mon modèle juge justifié. Ce genre d'écart, sur une entreprise de cette qualité, ne se produit que quand une action est temporairement mal aimée." },
        { type: 'h2', text: "Pourquoi le marché boude une si belle machine ?" },
        { type: 'p', text: "Parce que le marché ne paie pas une entreprise, il paie une histoire, et l'histoire récente a fait peur. Au premier trimestre 2026, Kinsale a publié un chiffre d'affaires en dessous des attentes, et l'action a corrigé de 30 % depuis ses sommets. Vu de loin, ça ressemble à un dérapage." },
        { type: 'p', text: "Vu de près, c'est plus nuancé. Le bénéfice par action est en réalité ressorti à 5,11 dollars, contre 4,79 attendus : 6,7 % au-dessus du consensus. Ce n'est pas que Kinsale a déçu sur ses profits, c'est que le marché espérait une croissance du chiffre d'affaires encore plus forte. Quand une action de qualité chute pour cette raison, ce n'est pas une alarme, c'est souvent une fenêtre." },
        { type: 'h2', text: "Les risques que je n'oublie pas" },
        { type: 'p', text: "Je serais malhonnête de ne te montrer que la lumière. Kinsale a de vrais trade-offs, et il faut les regarder en face." },
        { type: 'p', text: "Premier risque : l'assurance est un métier cyclique. Aujourd'hui, sur le marché E and S, les prix sont élevés parce que les risques affluent et que les capacités manquent. C'est un marché dit dur, favorable aux assureurs. Mais ces cycles s'inversent. Le jour où les prix se ramolliront, la croissance fulgurante de Kinsale ralentira, et c'est précisément ce que le marché redoute déjà. Sa croissance de 33 % par an n'est pas une rente garantie : c'est en partie une fenêtre de marché." },
        { type: 'p', text: "Deuxième risque : la discipline doit tenir. Tout le moat repose sur une souscription rigoureuse. Le jour où l'entreprise se mettrait à courir après le volume pour entretenir sa croissance, accepter des risques mal tarifés, ce moteur se gripperait. C'est arrivé à de nombreux assureurs avant elle. Rien ne garantit que Kinsale y échappera éternellement." },
        { type: 'p', text: "Troisième risque, le plus simple : la qualité ne protège pas du prix. Si tu achètes même la meilleure entreprise du monde trop cher, tu fais un mauvais placement. Aujourd'hui Kinsale paraît bon marché, mais un P/FCF bas n'est jamais une bonne affaire en soi : il ne l'est que si la qualité tient et que le cycle ne se retourne pas trop tôt. C'est exactement pour ça que je juge la qualité avant le prix, et le prix séparément." },
        { type: 'h2', text: "Comment je lis Kinsale, sans m'emballer" },
        { type: 'p', text: "Au fond, Kinsale a cette double nature que j'aime : c'est à la fois une action de croissance (33 % par an) et une action bon marché (7,0 fois son cash). On voit rarement les deux dans la même ligne, et c'est ce qui rend le dossier intéressant. Le prochain rendez-vous concret tombe le 22 juillet 2026, avec les résultats du deuxième trimestre. Si l'entreprise confirme son rythme, le marché pourrait finir par lui rendre un multiple plus généreux." },
        { type: 'p', text: "Mais je ne fonce pas pour autant. Je note un prix d'achat raisonnable, autour de 533 dollars, et je laisse le marché venir à moi plutôt que de courir après lui. Si tu veux creuser, tu trouveras le détail des critères et des comparables sur la page d'analyse de Kinsale, dans le hub des assureurs, et dans mon classement des entreprises notées 10 sur 10." },
        { type: 'p', text: "Juger si une entreprise est bonne, puis à quel prix l'acheter, séparément, en quelques secondes et pour n'importe quelle action : c'est exactement ce que je voulais pouvoir faire. Alors je l'ai construit." },
      ],
      faq: [
        { q: "C'est quoi, l'assurance E and S ?", a: "L'assurance E and S (excess and surplus, excédents et lignes spéciales) couvre les risques atypiques que les assureurs classiques refusent : activités rares, dangereuses ou difficiles à évaluer. C'est un marché où les prix ne sont pas réglementés, donc où un assureur compétent peut bien tarifer le risque et gagner de l'argent." },
        { q: "C'est quoi, le combined ratio ?", a: "C'est la somme des sinistres payés et des frais d'un assureur, rapportée aux primes encaissées. Sous 100 %, l'assureur gagne de l'argent rien qu'en assurant, avant même de placer sa trésorerie. Au-dessus de 100 %, il perd de l'argent sur son métier. Kinsale opère structurellement bien sous 100 %." },
        { q: "Que veut dire un P/FCF de 7,0 ?", a: "Le P/FCF (price to free cash flow) rapporte le cours de l'action au cash réellement généré chaque année. Un P/FCF de 7,0 signifie que tu paies l'équivalent de sept années de ce cash. Plus c'est bas, moins c'est cher. C'est inhabituel pour une entreprise qui grandit de 33 % par an." },
        { q: "Pourquoi Kinsale obtient-il 10/10 ?", a: "Il valide 24 de mes 25 sous-critères de qualité, avec la note maximale sur la rentabilité, la croissance, le rendement du capital et la solidité du bilan (il n'a pas de dette nette). Ma note 10/10 mesure la qualité du business seule, indépendamment du prix de l'action." },
        { q: "Quels sont les risques de Kinsale ?", a: "Trois principalement : l'assurance est cyclique, donc sa croissance peut ralentir quand les prix du marché baisseront ; tout repose sur une discipline de souscription qui doit tenir dans le temps ; et la qualité ne protège jamais de payer trop cher. Ceci n'est pas un conseil en investissement, fais tes propres recherches." },
      ],
      tags: ['Analyse', 'Kinsale Capital', 'Assurance'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 10 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: 'Kinsale Capital (KNSL) : a 10/10 insurer, analysis',
      excerpt:
        'An insurer that makes money just by insuring, grows 33% a year, and trades cheap. Here is why Kinsale meets my 10 quality criteria, and where the catch hides.',
      metaDescription:
        'Kinsale Capital (KNSL) explained simply: what this E and S insurer does, its durable edge, its risks, and why it earns my 10/10 quality score.',
      answer:
        "Kinsale Capital is an elite American insurer that covers the odd risks nobody else wants, with a cost discipline its rivals cannot copy. It meets 10 of my 10 quality criteria, grows 33% a year, and still trades cheap. Quality this rare is unusual. So is the price. Here is how I read it, without getting carried away.",
      body: [
        { type: 'h2', text: 'The insurer that says yes when others say no' },
        { type: 'p', text: 'The first time I looked closely at Kinsale Capital, I assumed my data had a bug. An insurer with the margins of a software company is not supposed to exist. And yet.' },
        { type: 'p', text: "To understand Kinsale, you first have to understand what it does. Most insurers cover ordinary things: your car, your home, your standard business. Kinsale works in the E and S market (excess and surplus). Translation: the unusual risks traditional insurers refuse to touch. A food truck, an amusement park, a demolition site, a small drone company. Files too rare or too odd to fit the boxes of a mass-market insurer." },
        { type: 'p', text: "This corner of the market has one peculiarity: prices are not regulated the way they are in mainstream insurance. Whoever can correctly assess an unusual risk can charge a fair price for it and make money. Whoever gets it wrong gets crushed. Kinsale built its whole house around that bet: being the best at saying yes, intelligently, where everyone else says no." },
        { type: 'ul', items: [
          'What Kinsale does: it insures the atypical risks (E and S) that traditional insurers refuse, a market where it can set its own prices.',
          "Why it is rare: it meets 10 of my 10 quality criteria (24 sub-criteria out of 25), a score very few companies reach.",
          'The engine: strict underwriting discipline and a very low cost structure that rivals struggle to copy.',
          'The profitability: more than half of its revenue ends up as truly available cash, and it grows 33% a year.',
          "The flip side: the quality is real, but the stock has already run and insurance stays a cyclical business. The price has to be earned.",
        ]},
        { type: 'h2', text: 'How an insurer makes money (and why this one is good at it)' },
        { type: 'p', text: "Before going further, a useful detour, because insurance is judged with its own thermometer. An insurer collects premiums today and pays claims later. In between, two questions decide everything." },
        { type: 'p', text: "First question: does it make money on the act of insuring itself? You measure that with the combined ratio: claims paid plus running costs, divided by premiums collected. Below 100%, the insurer is profitable just by insuring, before earning a cent on its investments. Above 100%, it loses money on its core trade and has to make it up elsewhere. Many insurers scrape by around 100%. Kinsale operates structurally well below, and that is where everything is decided." },
        { type: 'p', text: "Second question: what does it do with the money in the meantime? When you pay your premium in January, the insurer only reimburses a possible claim months, sometimes years later. In between, it keeps that pile and invests it. This is the float: other people's money, collected before it is spent, working for free for the insurer. The bigger the float, the harder the machine works." },
        { type: 'p', text: "Kinsale is good on both counts. And the result shows in a number that made me pause: its free cash flow margin reaches 52%. Free cash flow is the money that truly stays in the bank once every bill is paid. A 52% margin means that out of every 100 dollars of revenue, 52 end up as genuinely available cash. Most companies top out near 10. That is a software-company level, not an insurer level. Its net margin comes in at 28%." },
        { type: 'h2', text: 'The real treasure: a moat money alone cannot buy' },
        { type: 'p', text: "A clean balance sheet is never enough to convince me. What I look for is the moat: the competitive trench, what stops a better-funded rival from taking the spot. At Kinsale, the moat comes neither from a brand nor a patent. It comes from two less glamorous, but sturdier things." },
        { type: 'p', text: "First, underwriting discipline. Underwriting is the act of deciding which risk you accept and at what price. Kinsale says no far more often than yes, and does not chase volume when prices get too low. That restraint, in a sector where the temptation to grow fast is constant, is rarer than it looks. It explains why the company stays profitable on the act of insuring where others get burned." },
        { type: 'p', text: "Second, the cost structure. Kinsale handles almost everything in-house, on its own technology platform, instead of delegating to a swarm of intermediaries the way traditional insurers do. Fewer intermediaries, fewer costs, so a higher margin at equal risk. That cost gap is hard to close: a competitor would have to rebuild years of tools and data. It is an advantage that widens over time rather than eroding." },
        { type: 'p', text: "In numbers, this moat shows up in two measures I always check. Growth first: revenue has risen 33% a year for five years, and free cash flow per share 28% a year over the same period, all organic, with no acquisitions inflating the stats. Return on capital next: Cash ROCE reaches 45%. This measure answers a simple question: for every dollar put into the business, how much cash does it spit back each year? Here, 45 cents per dollar per year. That is roughly three times the threshold I consider excellent." },
        { type: 'h2', text: 'What exactly is my 10/10 score?' },
        { type: 'p', text: "I do not score a company on a hunch. I run it through 10 fundamental quality criteria, broken into concrete sub-criteria: is it genuinely profitable, are sales and cash growing, does it turn accounting profit into real cash, is its debt under control, does it return money to shareholders without wasting it? A company that passes everything gets 10 out of 10. That is rare by design." },
        { type: 'p', text: "Kinsale passes 24 of these sub-criteria out of 25. Top marks on the four pillars I weigh most: profitability, growth, return on capital, and balance sheet strength. On that last point, the company has no net debt: its cash covers all of its borrowings. In plain terms, it could pay everything off tomorrow morning. That is exactly the cushion that lets a business ride out a bad cycle without panic." },
        { type: 'p', text: "Two details say a lot about management quality. First: the cash conversion ratio comes in at 1.89, meaning the cash generated exceeds the accounting profit. A company that turns its profits into real money, and then some, is not playing games with its books. Second: management returns capital without wasting it, with a new 250 million dollar share buyback program announced in December 2025. Buying back its own shares concentrates ownership among the remaining holders, as long as it is done at a reasonable price." },
        { type: 'h2', text: 'Quality first, price second (and separately)' },
        { type: 'p', text: "Here is the rule I never break: I always separate two questions most people merge. One: is this a good business? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment. On Kinsale, the first question is settled. The second remains." },
        { type: 'p', text: "To measure the price, I look at the P/FCF (price to free cash flow): the share price divided by the cash the company truly generates each year. A P/FCF of 7 means that at the current pace, you are paying the equivalent of seven years of that cash. The lower it is, the cheaper it is. Kinsale trades at 7.0 times its free cash flow." },
        { type: 'p', text: "Put that number in perspective. Solid but far slower insurers trade richer: Progressive around 7.4 times, Chubb 8.3 times, RLI 8.8 times. The sector median sits near 7.4 times. In other words, the market prices Kinsale below competitors that grow two to three times more slowly. That is unusual: normally you pay a premium for growth, not a discount." },
        { type: 'p', text: "Running this profile through my valuation model, with deliberately prudent assumptions (free cash flow growth cut to 20% a year, well below its current pace, and a modest 10 times exit multiple), I get a reasonable buy price around 533 dollars. The stock trades near 303. So the price is roughly 76% below what my model judges justified. A gap that wide, on a business of this quality, only happens when a stock is temporarily out of favor." },
        { type: 'h2', text: 'Why does the market shun such a fine machine?' },
        { type: 'p', text: "Because the market does not pay for a company, it pays for a story, and the recent story spooked it. In the first quarter of 2026, Kinsale reported revenue below expectations, and the stock corrected 30% from its highs. From a distance, it looks like a stumble." },
        { type: 'p', text: "Up close, it is more nuanced. Earnings per share actually came in at 5.11 dollars, versus 4.79 expected: 6.7% above consensus. It is not that Kinsale disappointed on profit, it is that the market hoped for even stronger revenue growth. When a quality stock falls for that reason, it is not an alarm, it is often a window." },
        { type: 'h2', text: 'The risks I do not forget' },
        { type: 'p', text: "I would be dishonest to show you only the bright side. Kinsale has real trade-offs, and they deserve a straight look." },
        { type: 'p', text: "First risk: insurance is a cyclical business. Right now, in the E and S market, prices are high because risks are flooding in and capacity is short. That is a so-called hard market, favorable to insurers. But these cycles reverse. The day prices soften, Kinsale's blistering growth will slow, and that is precisely what the market already fears. Its 33% annual growth is not a guaranteed annuity: it is partly a market window." },
        { type: 'p', text: "Second risk: the discipline has to hold. The entire moat rests on rigorous underwriting. The day the company starts chasing volume to feed its growth, accepting mispriced risks, that engine would seize. It has happened to many insurers before it. Nothing guarantees Kinsale escapes it forever." },
        { type: 'p', text: "Third risk, the simplest: quality does not protect you from price. If you buy even the best company in the world too expensive, you make a bad investment. Today Kinsale looks cheap, but a low P/FCF is never a bargain in itself: it only is if the quality holds and the cycle does not turn too soon. That is exactly why I judge quality before price, and price separately." },
        { type: 'h2', text: 'How I read Kinsale, without getting carried away' },
        { type: 'p', text: "At its core, Kinsale has that dual nature I like: it is both a growth stock (33% a year) and a cheap stock (7.0 times its cash). You rarely see both in the same line, and that is what makes the case interesting. The next concrete date is July 22, 2026, with second-quarter results. If the company confirms its pace, the market may end up granting it a more generous multiple." },
        { type: 'p', text: "But I am not rushing in. I note a reasonable buy price, around 533 dollars, and let the market come to me rather than chase it. If you want to dig in, you will find the criteria detail and the comparables on Kinsale's analysis page, in the insurers hub, and in my ranking of companies scored 10 out of 10." },
        { type: 'p', text: "Judging whether a business is good, then at what price to buy it, separately, in a few seconds and for any stock: that is exactly what I wanted to be able to do. So I built it." },
      ],
      faq: [
        { q: 'What is E and S insurance?', a: "E and S (excess and surplus) insurance covers the atypical risks traditional insurers refuse: rare, hazardous or hard-to-assess activities. It is a market where prices are not regulated, so a competent insurer can price the risk well and make money." },
        { q: 'What is the combined ratio?', a: "It is an insurer's claims paid plus expenses, divided by the premiums it collects. Below 100%, the insurer makes money just by insuring, before it even invests its cash. Above 100%, it loses money on its core trade. Kinsale operates structurally well below 100%." },
        { q: 'What does a P/FCF of 7.0 mean?', a: "The P/FCF (price to free cash flow) divides the share price by the cash actually generated each year. A P/FCF of 7.0 means you pay the equivalent of seven years of that cash. The lower it is, the cheaper it is. That is unusual for a company growing 33% a year." },
        { q: 'Why does Kinsale score 10/10?', a: "It passes 24 of my 25 quality sub-criteria, with top marks on profitability, growth, return on capital and balance sheet strength (it has no net debt). My 10/10 score measures the quality of the business alone, independent of the share price." },
        { q: 'What are the risks with Kinsale?', a: "Three mainly: insurance is cyclical, so its growth can slow when market prices fall; everything rests on an underwriting discipline that has to hold over time; and quality never protects you from overpaying. This is not investment advice, do your own research." },
      ],
      tags: ['Analysis', 'Kinsale Capital', 'Insurance'],
      disclaimer:
        'This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 10, 2026, subject to change. Do your own research.',
    },
    es: {
      title: 'Kinsale Capital (KNSL) : una aseguradora 10/10, análisis',
      excerpt:
        'Una aseguradora que gana dinero solo con asegurar, que crece un 33 % al año y que cotiza barata. Aquí está por qué Kinsale cumple mis 10 criterios de calidad, y dónde se esconde la trampa.',
      metaDescription:
        'Kinsale Capital (KNSL) explicada de forma sencilla: qué hace esta aseguradora E and S, su ventaja, sus riesgos y por qué obtiene mi nota 10/10 sin ser cara.',
      answer:
        'Kinsale Capital es una aseguradora estadounidense de élite: cubre los riesgos raros que nadie más quiere, con una disciplina de costes que sus rivales no logran copiar. Cumple 10 de mis 10 criterios de calidad, crece un 33 % al año y aún así cotiza barata. Una calidad así es rara. El precio también. Así lo leo, sin dejarme llevar.',
      body: [
        { type: 'h2', text: 'La aseguradora que dice sí cuando los demás dicen no' },
        { type: 'p', text: 'La primera vez que miré de cerca a Kinsale Capital, pensé que mis datos tenían un error. Una aseguradora con los márgenes de una empresa de software no debería existir. Y sin embargo.' },
        { type: 'p', text: 'Para entender a Kinsale, primero hay que entender qué hace. La mayoría de las aseguradoras cubren cosas corrientes: tu coche, tu casa, tu empresa estándar. Kinsale trabaja en el mercado E and S (excess and surplus, excedentes y líneas especiales). Traducción: los riesgos atípicos que las aseguradoras tradicionales se niegan a tocar. Un food truck, un parque de atracciones, una obra de demolición, una pequeña empresa de drones. Expedientes demasiado raros o extraños para encajar en las casillas de una aseguradora de masas.' },
        { type: 'p', text: 'Este rincón del mercado tiene una particularidad: los precios no están regulados como en el seguro general. Quien sabe evaluar bien un riesgo inusual puede cobrarlo a su precio justo y ganar dinero. Quien se equivoca queda arrasado. Kinsale construyó toda su casa en torno a esa apuesta: ser el mejor diciendo sí, de forma inteligente, allí donde los demás dicen no.' },
        { type: 'ul', items: [
          'Qué hace Kinsale: asegura los riesgos atípicos (E and S) que las aseguradoras tradicionales rechazan, un mercado donde puede fijar sus propios precios.',
          'Por qué es raro: cumple 10 de mis 10 criterios de calidad (24 subcriterios de 25), una nota que muy pocas empresas alcanzan.',
          'El motor: una disciplina estricta de suscripción y una estructura de costes muy baja que los rivales no logran copiar.',
          'La rentabilidad: más de la mitad de sus ingresos termina como caja realmente disponible, y crece un 33 % al año.',
          'El reverso: la calidad es real, pero la acción ya ha subido y el seguro sigue siendo un negocio cíclico. El precio hay que merecerlo.',
        ]},
        { type: 'h2', text: 'Cómo gana dinero una aseguradora (y por qué esta lo hace bien)' },
        { type: 'p', text: 'Antes de seguir, un rodeo útil, porque el seguro se juzga con su propio termómetro. Una aseguradora cobra primas hoy y paga siniestros más tarde. Entre medias, dos preguntas lo deciden todo.' },
        { type: 'p', text: 'Primera pregunta: ¿gana dinero con el acto de asegurar en sí mismo? Eso se mide con el combined ratio (ratio combinado): los siniestros pagados más los gastos de funcionamiento, divididos entre las primas cobradas. Por debajo del 100 %, la aseguradora es rentable solo con asegurar, antes incluso de ganar un céntimo con sus inversiones. Por encima del 100 %, pierde dinero en su oficio. Muchas aseguradoras sobreviven cerca del 100 %. Kinsale opera estructuralmente muy por debajo, y ahí se juega todo.' },
        { type: 'p', text: 'Segunda pregunta: ¿qué hace con el dinero mientras tanto? Cuando pagas tu prima en enero, la aseguradora solo reembolsa un posible siniestro meses, a veces años después. Entre medias, guarda ese capital y lo invierte. Es lo que se llama el float: el dinero de los demás, cobrado antes de gastarse, que trabaja gratis para la aseguradora. Cuanto mayor es el float, más rinde la máquina.' },
        { type: 'p', text: 'Kinsale es bueno en ambos frentes. Y el resultado se ve en una cifra que me hizo detenerme: su margen de flujo de caja libre alcanza el 52 %. El flujo de caja libre es el dinero que de verdad queda en caja una vez pagadas todas las facturas. Un margen del 52 % significa que de cada 100 dólares de ingresos, 52 terminan como caja realmente disponible. La mayoría de las empresas se quedan cerca del 10. Es un nivel de empresa de software, no de aseguradora. Su margen neto, por su parte, es del 28 %.' },
        { type: 'h2', text: 'El verdadero tesoro: un moat que el dinero solo no compra' },
        { type: 'p', text: 'Un buen balance nunca me basta para convencerme. Lo que busco es el moat: el foso competitivo, lo que impide que un rival mejor financiado venga a quitar el sitio. En Kinsale, el moat no viene de una marca ni de una patente. Viene de dos cosas menos vistosas, pero más sólidas.' },
        { type: 'p', text: 'Primero, la disciplina de suscripción. Suscribir es el acto de decidir qué riesgo se acepta y a qué precio. Kinsale dice no mucho más a menudo de lo que dice sí, y no persigue volumen cuando los precios bajan demasiado. Esa contención, en un sector donde la tentación de crecer rápido es permanente, es más rara de lo que parece. Explica por qué la empresa sigue siendo rentable en el acto de asegurar allí donde otras se queman.' },
        { type: 'p', text: 'Segundo, la estructura de costes. Kinsale gestiona casi todo internamente, en su propia plataforma tecnológica, en lugar de delegar en una multitud de intermediarios como hacen las aseguradoras tradicionales. Menos intermediarios, menos gastos, por tanto un margen superior a igual riesgo. Esa brecha de costes es difícil de cerrar: un competidor tendría que reconstruir años de herramientas y datos. Es una ventaja que se ensancha con el tiempo en lugar de erosionarse.' },
        { type: 'p', text: 'En cifras, ese moat se traduce en dos medidas que siempre miro. El crecimiento, primero: los ingresos han subido un 33 % al año durante cinco años, y el flujo de caja libre por acción un 28 % al año en el mismo periodo, todo orgánico, sin compras de empresas que inflen las estadísticas. La rentabilidad del capital, después: el Cash ROCE alcanza el 45 %. Esta medida responde a una pregunta simple: por cada dólar puesto en el negocio, ¿cuánta caja devuelve cada año? Aquí, 45 centavos por dólar y por año. Es unas tres veces el umbral que considero excelente.' },
        { type: 'h2', text: '¿Qué es exactamente mi nota 10/10?' },
        { type: 'p', text: 'No califico una empresa por intuición. La paso por el filtro de 10 criterios de calidad fundamental, divididos en subcriterios concretos: ¿es de verdad rentable, crecen sus ventas y su caja, convierte el beneficio contable en caja real, tiene la deuda controlada, devuelve dinero a sus accionistas sin malgastar? Una empresa que cumple todo obtiene un 10 sobre 10. Es raro, por construcción.' },
        { type: 'p', text: 'Kinsale cumple 24 de estos subcriterios de 25. La nota máxima en los cuatro pilares que considero más importantes: rentabilidad, crecimiento, rentabilidad del capital y solidez del balance. En este último punto, la empresa no tiene deuda neta: su caja cubre la totalidad de sus préstamos. En claro, podría devolverlo todo mañana por la mañana. Es justo el tipo de colchón que permite atravesar un mal ciclo sin pánico.' },
        { type: 'p', text: 'Dos detalles dicen mucho sobre la calidad de la gestión. El primero: la ratio de conversión del beneficio en caja es de 1,89, lo que significa que la caja generada supera el beneficio contable. Una empresa que convierte sus beneficios en dinero bien real, e incluso más, no hace trampas con sus cuentas. El segundo: una dirección que devuelve capital sin malgastar, con un nuevo programa de recompra de acciones de 250 millones de dólares anunciado en diciembre de 2025. Recomprar sus propias acciones concentra la propiedad entre los accionistas restantes, siempre que se haga a un precio razonable.' },
        { type: 'h2', text: 'La calidad primero, el precio después (y por separado)' },
        { type: 'p', text: 'Esta es la regla que nunca rompo: separo siempre dos preguntas que la mayoría confunde. Una: ¿es un buen negocio? Dos, completamente aparte: ¿es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión. En Kinsale, la primera pregunta está resuelta. Queda la segunda.' },
        { type: 'p', text: 'Para medir el precio, miro el P/FCF (price to free cash flow): la cotización de la acción dividida entre la caja que la empresa genera de verdad cada año. Un P/FCF de 7 significa que, al ritmo actual, pagas el equivalente a siete años de esa caja. Cuanto más bajo, más barato. Kinsale cotiza a 7,0 veces su flujo de caja libre.' },
        { type: 'p', text: 'Pon esa cifra en perspectiva. Aseguradoras sólidas pero mucho más lentas cotizan más caras: Progressive en torno a 7,4 veces, Chubb 8,3 veces, RLI 8,8 veces. La mediana del sector ronda las 7,4 veces. Dicho de otro modo, el mercado tasa a Kinsale por debajo de competidores que crecen dos o tres veces más despacio. Es inusual: normalmente se paga una prima por el crecimiento, no un descuento.' },
        { type: 'p', text: 'Al pasar este perfil por mi modelo de valoración, con hipótesis deliberadamente prudentes (un crecimiento del flujo de caja libre reducido al 20 % anual, muy por debajo de su ritmo actual, y un múltiplo de salida modesto de 10 veces), obtengo un precio de compra razonable en torno a 533 dólares. La acción vale unos 303. El precio está, por tanto, alrededor de un 76 % por debajo de lo que mi modelo juzga justificado. Una brecha así de amplia, en un negocio de esta calidad, solo ocurre cuando una acción está temporalmente fuera de favor.' },
        { type: 'h2', text: '¿Por qué el mercado desdeña una máquina tan buena?' },
        { type: 'p', text: 'Porque el mercado no paga por una empresa, paga por una historia, y la historia reciente lo asustó. En el primer trimestre de 2026, Kinsale publicó ingresos por debajo de lo esperado, y la acción corrigió un 30 % desde sus máximos. De lejos, parece un tropiezo.' },
        { type: 'p', text: 'De cerca, es más matizado. El beneficio por acción fue en realidad de 5,11 dólares, frente a los 4,79 esperados: un 6,7 % por encima del consenso. No es que Kinsale decepcionara en beneficios, es que el mercado esperaba un crecimiento de ingresos aún mayor. Cuando una acción de calidad cae por ese motivo, no es una alarma, a menudo es una ventana.' },
        { type: 'h2', text: 'Los riesgos que no olvido' },
        { type: 'p', text: 'Sería deshonesto mostrarte solo la luz. Kinsale tiene verdaderos trade-offs, y merecen una mirada franca.' },
        { type: 'p', text: 'Primer riesgo: el seguro es un negocio cíclico. Hoy, en el mercado E and S, los precios son altos porque los riesgos afluyen y falta capacidad. Es lo que se llama un mercado duro, favorable a las aseguradoras. Pero estos ciclos se invierten. El día en que los precios se ablanden, el crecimiento fulgurante de Kinsale se frenará, y es justo lo que el mercado ya teme. Su crecimiento del 33 % anual no es una renta garantizada: es en parte una ventana de mercado.' },
        { type: 'p', text: 'Segundo riesgo: la disciplina tiene que aguantar. Todo el moat se apoya en una suscripción rigurosa. El día en que la empresa empezara a perseguir volumen para alimentar su crecimiento, aceptando riesgos mal tarifados, ese motor se griparía. Le ha pasado a muchas aseguradoras antes. Nada garantiza que Kinsale lo evite eternamente.' },
        { type: 'p', text: 'Tercer riesgo, el más simple: la calidad no te protege del precio. Si compras incluso la mejor empresa del mundo demasiado cara, haces una mala inversión. Hoy Kinsale parece barata, pero un P/FCF bajo nunca es una ganga en sí mismo: solo lo es si la calidad aguanta y el ciclo no se da la vuelta demasiado pronto. Es justo por eso que juzgo la calidad antes que el precio, y el precio por separado.' },
        { type: 'h2', text: 'Cómo leo a Kinsale, sin dejarme llevar' },
        { type: 'p', text: 'En el fondo, Kinsale tiene esa doble naturaleza que me gusta: es a la vez un valor de crecimiento (33 % al año) y un valor barato (7,0 veces su caja). Rara vez se ven ambos en la misma línea, y eso es lo que hace interesante el caso. La próxima cita concreta llega el 22 de julio de 2026, con los resultados del segundo trimestre. Si la empresa confirma su ritmo, el mercado podría acabar concediéndole un múltiplo más generoso.' },
        { type: 'p', text: 'Pero no me lanzo por ello. Anoto un precio de compra razonable, en torno a 533 dólares, y dejo que el mercado venga a mí en lugar de perseguirlo. Si quieres profundizar, encontrarás el detalle de los criterios y de los comparables en la página de análisis de Kinsale, en el hub de las aseguradoras, y en mi clasificación de empresas con nota 10 sobre 10.' },
        { type: 'p', text: 'Juzgar si una empresa es buena, y luego a qué precio comprarla, por separado, en unos segundos y para cualquier acción: es exactamente lo que quería poder hacer. Así que lo construí.' },
      ],
      faq: [
        { q: '¿Qué es el seguro E and S?', a: 'El seguro E and S (excess and surplus, excedentes y líneas especiales) cubre los riesgos atípicos que las aseguradoras tradicionales rechazan: actividades raras, peligrosas o difíciles de evaluar. Es un mercado donde los precios no están regulados, así que una aseguradora competente puede tarifar bien el riesgo y ganar dinero.' },
        { q: '¿Qué es el combined ratio?', a: 'Es la suma de los siniestros pagados y los gastos de una aseguradora, dividida entre las primas que cobra. Por debajo del 100 %, la aseguradora gana dinero solo con asegurar, antes incluso de invertir su caja. Por encima del 100 %, pierde dinero en su oficio. Kinsale opera estructuralmente muy por debajo del 100 %.' },
        { q: '¿Qué significa un P/FCF de 7,0?', a: 'El P/FCF (price to free cash flow) divide la cotización de la acción entre la caja realmente generada cada año. Un P/FCF de 7,0 significa que pagas el equivalente a siete años de esa caja. Cuanto más bajo, más barato. Es inusual para una empresa que crece un 33 % al año.' },
        { q: '¿Por qué Kinsale obtiene un 10/10?', a: 'Cumple 24 de mis 25 subcriterios de calidad, con la nota máxima en rentabilidad, crecimiento, rentabilidad del capital y solidez del balance (no tiene deuda neta). Mi nota 10/10 mide la calidad del negocio en sí, con independencia del precio de la acción.' },
        { q: '¿Cuáles son los riesgos de Kinsale?', a: 'Tres principalmente: el seguro es cíclico, así que su crecimiento puede frenarse cuando bajen los precios del mercado; todo se apoya en una disciplina de suscripción que tiene que aguantar en el tiempo; y la calidad nunca te protege de pagar de más. Esto no es asesoramiento de inversión, haz tu propia investigación.' },
      ],
      tags: ['Análisis', 'Kinsale Capital', 'Seguros'],
      disclaimer:
        'Este artículo es un análisis con fines informativos y educativos y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 10 de junio de 2026, sujetas a cambios. Haz tu propia investigación.',
    },
  },
};

const rotation: Article = {
  slug: 'rotation-value-actions-lubin-juin-2026',
  date: '2026-06-10',
  updated: '2026-06-10',
  readingTime: 11,
  content: {
    fr: {
      title: 'Rotation value 2026 : trouver la qualité pas chère',
      excerpt:
        "En 2026, l'argent quitte la tech pour les actions \"value\". Je t'explique ce que ça veut dire, pourquoi le pas cher est souvent un piège, et comment je cherche la qualité décotée plutôt que le bon marché.",
      metaDescription:
        "Rotation value 2026 : le Value bat le Growth de 10 points. Ce que ça veut dire, le piège du value trap, et comment chercher la qualité pas chère.",
      answer:
        "Une rotation value, c'est quand les capitaux quittent les actions \"chères et en forte croissance\" pour les actions \"bon marché par rapport à leurs fondamentaux\". En 2026 elle est bien réelle : l'indice Value gagne 18,6 % contre 8,3 % pour le Growth. Mais bon marché ne veut pas dire bonne affaire. Voici comment je trie.",
      body: [
        { type: 'h2', text: "D'abord, value et growth, ça veut dire quoi ?" },
        { type: 'p', text: "Avant de parler de rotation, posons les mots. Une action est dite \"value\" (valeur) quand elle se paie bon marché par rapport à ce que l'entreprise vaut vraiment : ses bénéfices, son cash, ses actifs. Tu paies peu pour beaucoup de fondamentaux. À l'inverse, une action \"growth\" (croissance) est chère : tu acceptes de payer un prix élevé aujourd'hui parce que tu paries sur une forte croissance future. La tech et l'IA sont l'exemple type." },
        { type: 'p', text: "Une \"rotation\", c'est simplement le moment où les capitaux se déplacent en masse d'un style vers l'autre. Quand l'argent fuit la croissance pour la valeur, on parle de rotation value. C'est exactement ce qui se passe en 2026, et l'ampleur est rare." },
        { type: 'ul', items: [
          "Value et growth : value = bon marché par rapport aux fondamentaux ; growth = cher car on paie la croissance future",
          "Rotation value : l'argent quitte la croissance (tech, IA) pour la valeur (assurance, énergie, banques)",
          "En 2026 l'indice Value gagne 18,6 % contre 8,3 % pour le Growth, soit 10 points d'écart",
          "Le piège à éviter : le value trap, une action pas chère qui le reste parce que l'entreprise décline",
          "Mon angle : ne pas chercher le pas cher, mais la qualité pas chère (la qualité d'abord, le prix ensuite)",
        ]},
        { type: 'h2', text: "Pourquoi je te parle de ça maintenant" },
        { type: 'p', text: "Parlons chiffres, parce que c'est ce qui compte. Depuis le début 2026, l'indice Morningstar US Value a gagné 18,6 %. L'indice Growth : 8,3 %. Dix points d'écart. C'est la plus grande divergence entre valeur et croissance depuis le début de la décennie." },
        { type: 'p', text: "Le signe le plus visible : le Dow Jones a touché un record à 51 562 points début juin, porté par UnitedHealth (+5 %), JPMorgan (+3 %) et Walmart. Au même moment, le Nasdaq reculait de 0,1 %. Traduction simple : des investisseurs sortent de la tech et de l'IA pour se replacer sur des secteurs plus terre à terre, classés value." },
        { type: 'p', text: "Et le mouvement est lourd. Depuis 2023, 4 600 milliards de dollars de capitalisation ont glissé de l'indice Russell 1000 Growth vers le Russell 1000 Value. Ce ne sont pas trois gérants nerveux un mardi matin, c'est un déplacement de plaques tectoniques." },
        { type: 'h2', text: "Pourquoi la value pourrait vraiment revenir" },
        { type: 'p', text: "Une rotation peut n'être qu'une humeur passagère. Là, deux raisons de fond la soutiennent, et il faut les comprendre pour juger." },
        { type: 'p', text: "La première, c'est les taux d'intérêt et l'inflation. Quand l'argent coûte cher et que les prix montent, les promesses lointaines valent moins. Or une action growth, justement, c'est une promesse lointaine : tu paies aujourd'hui pour des profits attendus dans dix ans. Une action value, elle, génère du cash maintenant. On dit qu'elle a une \"duration plus courte\" : sa valeur dépend moins du futur lointain, donc elle souffre moins quand les taux montent." },
        { type: 'p', text: "La seconde vient d'un gérant, Neuberger Berman, qui estime que les actions value sont prêtes à accélérer. Son argument tient dans un mot que je t'explique : le bêta des bénéfices. C'est la sensibilité des profits d'une entreprise à la santé de l'économie. Les valeurs value ont un bêta de 1,2 contre 0,8 pour la croissance : quand l'économie repart, leurs bénéfices montent plus vite. Si la reprise se confirme, elles en profitent davantage." },
        { type: 'p', text: "Honnêteté obligatoire : une prévision macro n'est pas une certitude. La preuve, WisdomTree, un autre acteur, vient de réaugmenter son exposition à la croissance en juin 2026, en jugeant qu'après deux ans de surperformance value, la croissance était redevenue plus abordable. Deux maisons sérieuses, deux paris opposés. C'est exactement pourquoi je ne fonde jamais une décision sur une prévision macro." },
        { type: 'h2', text: "Le piège central : le value trap" },
        { type: 'p', text: "Voici l'erreur que je veux t'éviter. Quand un style de marché revient à la mode, le réflexe est d'acheter tout ce qui est étiqueté pas cher. Mauvaise idée. Une action peut être bon marché pour une excellente raison : l'entreprise décline pour de bon." },
        { type: 'p', text: "On appelle ça un value trap, un piège de la valeur. L'action semble une aubaine, son prix bas attire, alors tu achètes. Sauf que le prix reste bas, ou baisse encore, parce que le business se détériore vraiment. Tu n'as pas acheté une décote, tu as acheté un déclin. Le pas cher, seul, n'est jamais un signal d'achat : c'est juste un prix bas, et un prix bas peut être parfaitement justifié." },
        { type: 'p', text: "D'où ma règle, la même depuis le début : je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce un bon prix ? Une entreprise médiocre, même bradée, reste médiocre. Je ne cherche donc pas le pas cher. Je cherche la qualité pas chère. La qualité d'abord, le prix ensuite." },
        { type: 'h2', text: "Comment je juge la qualité, avant même de regarder le prix" },
        { type: 'p', text: "Pour trancher la première question, je ne me fie pas à mon intuition. Je passe l'entreprise au crible de critères financiers concrets, puis je résume tout dans une note de qualité sur 10. Une note de 10/10 ne dit rien du prix de l'action : elle dit que le business coche tous mes critères de solidité." },
        { type: 'p', text: "Concrètement, je regarde si l'entreprise est durablement rentable, si ses ventes et son cash augmentent, si elle rachète ses propres actions plutôt que de gaspiller, si sa dette reste maîtrisable, et si elle dégage beaucoup de free cash flow. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées : salaires, machines, impôts. C'est plus difficile à maquiller que le bénéfice comptable, donc je m'y fie davantage." },
        { type: 'p', text: "Cette note qualité est mon filtre anti value trap. Si une action est pas chère mais note mal, je passe : c'est probablement un piège. Si elle est pas chère ET note 10/10, là ça devient intéressant, parce que j'ai à la fois un bon business et, peut-être, un bon prix." },
        { type: 'h2', text: "À quoi ressemble une qualité pas chère, en 2026" },
        { type: 'p', text: "Pour mesurer si le prix est raisonnable, j'utilise un ratio simple : le P/FCF (price to free cash flow), le prix de l'action rapporté au free cash flow qu'elle génère chaque année. Un P/FCF de 10, ça veut dire que tu paies aujourd'hui dix années de ce cash. Plus c'est bas, moins c'est cher. Le sens d'abord : un P/FCF bas, l'action se paie bon marché." },
        { type: 'p', text: "En croisant ma note de qualité maximale avec un P/FCF sous 10×, un profil ressort très nettement : l'assurance. Ce n'est pas un hasard. Une bonne compagnie d'assurance encaisse les primes d'avance, place cet argent, et dégage du cash avec peu de besoins d'investissement. C'est exactement le genre de business solide que la rotation value récompense, sans être un value trap." },
        { type: 'p', text: "Quelques exemples concrets, sans rien inventer sur les chiffres. SkyWest, une compagnie aérienne régionale notée 10/10, se paie autour de 3,9 fois son free cash flow, soit comme si elle frôlait la faillite, ce que ses fondamentaux ne disent pas. Kinsale Capital, un assureur spécialisé qui croît à 33 % par an, se paie 7,1 fois, sous la médiane de son secteur. Progressive, l'assureur auto le plus efficace d'Amérique qui gagne 5,7 % de parts de marché par an, est à 7,4 fois. Arch Capital, assureur diversifié en croissance de 17 % par an, tourne à 5,6 fois." },
        { type: 'p', text: "On peut continuer : W.R. Berkley, l'assureur valeur par excellence avec 58 ans d'existence, se paie 7,0 fois ; Mercury General affiche un P/FCF de 4,0 fois, un P/B (prix rapporté à la valeur comptable) de 1,1 fois et un rendement de 3,7 %, une value pure ; Cincinnati Financial, 74 ans de dividendes en hausse, est à 7,4 fois. Le point commun de toute cette liste : une note qualité parfaite ET un multiple de cash inférieur à la moyenne du marché. Bon business et bon prix, les deux à la fois." },
        { type: 'h2', text: "Ce que ça implique pour toi, sans illusion" },
        { type: 'p', text: "Si la rotation value se poursuit, ce sont précisément ces profils, solides et décotés, qui devraient le mieux se comporter. Mais je ne te vendrai pas une certitude. Personne ne sait timer un retournement de marché : ni moi, ni Neuberger Berman, ni WisdomTree, qui parient d'ailleurs dans des directions opposées." },
        { type: 'p', text: "Ce que je sais, en revanche, c'est qu'acheter de la qualité à bon prix a historiquement bien vieilli, que la rotation se confirme demain ou dans deux ans. Tu n'as pas besoin de deviner le calendrier du marché. Tu as besoin de ne pas payer trop cher un bon business, et de ne jamais confondre une décote avec un déclin." },
        { type: 'p', text: "C'est exactement ce que je voulais pouvoir faire en quelques secondes pour n'importe quelle action : juger la qualité d'un business d'un côté, son prix de l'autre, et repérer les rares cas où les deux s'alignent. Comme je ne trouvais pas l'outil, je l'ai construit. Tu peux y taper un ticker pour voir où une action se situe dans la matrice qualité-prix, parcourir mon classement des actions sous-évaluées, ou filtrer celles que je note 10/10 sur la qualité. Le pas cher, on en trouve partout. La qualité pas chère, beaucoup plus rarement." },
      ],
      faq: [
        { q: "C'est quoi une action value, par rapport à une action growth ?", a: "Une action value se paie bon marché par rapport aux fondamentaux de l'entreprise (bénéfices, cash, actifs) : tu paies peu pour beaucoup. Une action growth est chère car tu paries sur une forte croissance future, comme dans la tech ou l'IA. La rotation value, c'est quand l'argent quitte la seconde pour la première." },
        { q: "C'est quoi un value trap, et comment l'éviter ?", a: "Un value trap est une action qui semble pas chère mais le reste, ou baisse encore, parce que l'entreprise décline réellement. Le prix bas n'est pas une décote, c'est un déclin justifié. Pour l'éviter, je juge d'abord la qualité du business (rentabilité, croissance du cash, dette maîtrisée) et je n'achète bon marché que ce qui est aussi solide." },
        { q: "C'est quoi le P/FCF, en clair ?", a: "Le P/FCF (price to free cash flow) rapporte le prix de l'action au free cash flow qu'elle génère chaque année, c'est-à-dire l'argent qui reste vraiment après avoir tout payé. Un P/FCF de 7 veut dire que tu paies sept années de ce cash. Plus il est bas, moins l'action est chère. Le sens compte avant le chiffre." },
        { q: "La rotation value de 2026 est-elle durable ?", a: "Personne ne le sait avec certitude. Neuberger Berman la juge durable : les valeurs value ont un bêta des bénéfices de 1,2 contre 0,8 pour la croissance, donc profitent plus d'une reprise, et les taux élevés les favorisent. Mais WisdomTree a réduit son pari value en juin 2026, jugeant la croissance redevenue plus abordable. Deux avis opposés, d'où ma prudence sur le timing." },
        { q: "Faut-il acheter ces actions value maintenant ?", a: "Ça dépend de ta discipline de prix, pas d'une prévision. Une note de qualité élevée combinée à un P/FCF bas signale un bon business à un prix raisonnable, mais ne dit pas si demain sera vert ou rouge. Ceci n'est pas un conseil en investissement personnalisé : fais tes propres recherches." },
      ],
      tags: ['Rotation', 'Value', 'Stratégie', 'Analyse'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 10 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: 'Value rotation 2026 : finding quality on the cheap',
      excerpt:
        "In 2026, money is leaving tech for \"value\" stocks. Here is what that actually means, why cheap is often a trap, and how I look for quality at a discount rather than just cheap.",
      metaDescription:
        "2026 value rotation: Value beats Growth by 10 points. What it means, the value trap pitfall, and how to look for quality on the cheap instead of just cheap.",
      answer:
        "A value rotation is when capital leaves \"expensive, fast-growing\" stocks for \"cheap relative to fundamentals\" ones. In 2026 it is real: the Value index is up 18.6% versus 8.3% for Growth. But cheap does not mean a bargain. Here is how I sort the two.",
      body: [
        { type: 'h2', text: "First, what do value and growth even mean?" },
        { type: 'p', text: "Before talking rotation, let us define the words. A stock is called \"value\" when it trades cheaply relative to what the company is really worth: its earnings, its cash, its assets. You pay little for a lot of fundamentals. A \"growth\" stock is the opposite, it is expensive: you accept a high price today because you are betting on strong future growth. Tech and AI are the classic example." },
        { type: 'p', text: "A \"rotation\" is simply the moment when capital moves en masse from one style to the other. When money flees growth for value, we call it a value rotation. That is exactly what is happening in 2026, and the scale is rare." },
        { type: 'ul', items: [
          "Value vs growth: value = cheap relative to fundamentals; growth = expensive because you pay for future growth",
          "Value rotation: money leaves growth (tech, AI) for value (insurance, energy, banks)",
          "In 2026 the Value index is up 18.6% versus 8.3% for Growth, a 10-point gap",
          "The pitfall: the value trap, a cheap stock that stays cheap because the business is declining",
          "My angle: do not chase cheap, chase quality on the cheap (quality first, price second)",
        ]},
        { type: 'h2', text: "Why I am bringing this up now" },
        { type: 'p', text: "Let us talk numbers, because that is what counts. Since the start of 2026, the Morningstar US Value Index has gained 18.6%. The Growth Index: 8.3%. A 10-point gap. It is the largest divergence between value and growth since the start of the decade." },
        { type: 'p', text: "The most visible sign: the Dow Jones hit a record 51,562 in early June, driven by UnitedHealth (+5%), JPMorgan (+3%) and Walmart. At the same moment the Nasdaq edged down 0.1%. Plain translation: investors are stepping out of tech and AI to reposition into more down-to-earth sectors, the ones labeled value." },
        { type: 'p', text: "And the move is heavy. Since 2023, $4.6 trillion in market cap has shifted from the Russell 1000 Growth Index to the Russell 1000 Value Index. This is not three nervous managers on a Tuesday morning, it is a tectonic shift." },
        { type: 'h2', text: "Why value might genuinely come back" },
        { type: 'p', text: "A rotation can be just a passing mood. This one rests on two structural reasons, and you need to understand them to judge it." },
        { type: 'p', text: "The first is interest rates and inflation. When money is expensive and prices rise, distant promises are worth less. And a growth stock is precisely a distant promise: you pay today for profits expected ten years out. A value stock, by contrast, generates cash now. It is said to have \"shorter duration\": its value depends less on the far future, so it suffers less when rates climb." },
        { type: 'p', text: "The second comes from a manager, Neuberger Berman, which believes value stocks are poised to accelerate. Its argument hinges on one term I will explain: earnings beta. It is how sensitive a company's profits are to the health of the economy. Value names have an earnings beta of 1.2 versus 0.8 for growth: when the economy rebounds, their profits rise faster. If the recovery holds, they benefit more." },
        { type: 'p', text: "Honesty required: a macro forecast is not a certainty. Case in point, WisdomTree, another player, just raised its growth exposure again in June 2026, judging that after two years of value outperformance, growth had become more affordable. Two serious houses, two opposite bets. That is exactly why I never base a decision on a macro forecast." },
        { type: 'h2', text: "The central pitfall: the value trap" },
        { type: 'p', text: "Here is the mistake I want to spare you. When a market style comes back into fashion, the reflex is to buy anything labeled cheap. Bad idea. A stock can be cheap for an excellent reason: the company is genuinely in decline." },
        { type: 'p', text: "We call this a value trap. The stock looks like a bargain, its low price is tempting, so you buy. Except the price stays low, or falls further, because the business is truly deteriorating. You did not buy a discount, you bought a decline. Cheap, on its own, is never a buy signal: it is just a low price, and a low price can be perfectly justified." },
        { type: 'p', text: "Hence my rule, the same from day one: I always separate two questions most people blur together. One: is this a good business? Two, entirely separate: is this a good price? A mediocre company, even dirt cheap, stays mediocre. So I do not chase cheap. I chase quality on the cheap. Quality first, price second." },
        { type: 'h2', text: "How I judge quality, before even looking at price" },
        { type: 'p', text: "To settle the first question, I do not rely on gut feel. I run the company through concrete financial criteria, then sum it all up in a quality score out of 10. A 10/10 score says nothing about the stock's price: it says the business checks every one of my soundness criteria." },
        { type: 'p', text: "Concretely, I look at whether the company is durably profitable, whether its sales and cash are growing, whether it buys back its own shares rather than wasting capital, whether its debt stays manageable, and whether it throws off plenty of free cash flow. Free cash flow is the money that actually stays in the till once every bill is paid: salaries, machines, taxes. It is harder to dress up than accounting profit, so I trust it more." },
        { type: 'p', text: "This quality score is my anti value trap filter. If a stock is cheap but scores poorly, I pass: it is probably a trap. If it is cheap AND scores 10/10, now it gets interesting, because I have both a good business and, possibly, a good price." },
        { type: 'h2', text: "What quality on the cheap looks like in 2026" },
        { type: 'p', text: "To gauge whether the price is reasonable, I use a simple ratio: P/FCF (price to free cash flow), the stock's price relative to the free cash flow it generates each year. A P/FCF of 10 means you are paying ten years of that cash today. The lower it is, the cheaper the stock. Meaning first: a low P/FCF, the stock trades cheap." },
        { type: 'p', text: "Crossing my top quality score with a P/FCF under 10x, one profile stands out sharply: insurance. No coincidence. A good insurer collects premiums up front, invests that money, and throws off cash with little need for investment. It is exactly the kind of solid business the value rotation rewards, without being a value trap." },
        { type: 'p', text: "A few concrete examples, inventing nothing on the figures. SkyWest, a regional airline rated 10/10, trades around 3.9 times its free cash flow, as if it were near bankruptcy, which its fundamentals do not say. Kinsale Capital, a specialty insurer growing at 33% a year, trades at 7.1 times, below its sector median. Progressive, America's most efficient auto insurer, gaining 5.7% of market share a year, sits at 7.4 times. Arch Capital, a diversified insurer growing 17% a year, runs at 5.6 times." },
        { type: 'p', text: "We can keep going: W.R. Berkley, a value insurer par excellence with 58 years behind it, trades at 7.0 times; Mercury General shows a P/FCF of 4.0 times, a P/B (price to book value) of 1.1 times and a 3.7% yield, pure value; Cincinnati Financial, 74 years of rising dividends, sits at 7.4 times. What this whole list shares: a perfect quality score AND a cash multiple below the market average. Good business and good price, both at once." },
        { type: 'h2', text: "What this means for you, no illusions" },
        { type: 'p', text: "If the value rotation continues, these exact profiles, sound and discounted, should behave best. But I will not sell you a certainty. Nobody can time a market turn: not me, not Neuberger Berman, not WisdomTree, which are betting in opposite directions anyway." },
        { type: 'p', text: "What I do know is that buying quality at a fair price has historically aged well, whether the rotation confirms tomorrow or in two years. You do not need to guess the market's calendar. You need to avoid overpaying for a good business, and to never mistake a discount for a decline." },
        { type: 'p', text: "That is exactly what I wanted to be able to do in seconds for any stock: judge a business's quality on one side, its price on the other, and spot the rare cases where the two line up. Since I could not find the tool, I built it. You can type a ticker to see where a stock sits on the quality-price matrix, browse my ranking of undervalued stocks, or filter the ones I rate 10/10 on quality. Cheap is everywhere. Quality on the cheap, far rarer." },
      ],
      faq: [
        { q: "What is a value stock versus a growth stock?", a: "A value stock trades cheaply relative to a company's fundamentals (earnings, cash, assets): you pay little for a lot. A growth stock is expensive because you are betting on strong future growth, as in tech or AI. A value rotation is when money leaves the second for the first." },
        { q: "What is a value trap, and how do I avoid it?", a: "A value trap is a stock that looks cheap but stays cheap, or falls further, because the company is genuinely declining. The low price is not a discount, it is a justified decline. To avoid it, I judge the business's quality first (profitability, cash growth, manageable debt) and only buy cheap what is also sound." },
        { q: "What is P/FCF in plain terms?", a: "P/FCF (price to free cash flow) compares the stock's price to the free cash flow it generates each year, meaning the money truly left over after paying everything. A P/FCF of 7 means you pay seven years of that cash. The lower it is, the cheaper the stock. Meaning matters before the number." },
        { q: "Is the 2026 value rotation sustainable?", a: "Nobody knows for sure. Neuberger Berman thinks it is durable: value names have an earnings beta of 1.2 versus 0.8 for growth, so they benefit more from a recovery, and high rates favor them. But WisdomTree cut its value bet in June 2026, judging growth had become more affordable again. Two opposite views, hence my caution on timing." },
        { q: "Should I buy these value stocks now?", a: "That depends on your price discipline, not on a forecast. A high quality score combined with a low P/FCF signals a good business at a reasonable price, but says nothing about whether tomorrow will be green or red. This is not personalized investment advice: do your own research." },
      ],
      tags: ['Rotation', 'Value', 'Strategy', 'Analysis'],
      disclaimer:
        'This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 10, 2026, subject to change. Do your own research.',
    },
    es: {
      title: 'Rotación value 2026 : encontrar calidad barata',
      excerpt:
        'En 2026, el dinero abandona la tecnología por las acciones \"value\". Te explico qué significa, por qué lo barato suele ser una trampa, y cómo busco calidad con descuento en lugar de solo barato.',
      metaDescription:
        'Rotación value 2026: el Value supera al Growth en 10 puntos. Qué significa, la trampa del value trap, y cómo buscar calidad barata en vez de solo barato.',
      answer:
        'Una rotación value es cuando el capital abandona las acciones \"caras y de fuerte crecimiento\" por las \"baratas respecto a sus fundamentales\". En 2026 es real: el índice Value sube un 18,6 % frente al 8,3 % del Growth. Pero barato no significa ganga. Así separo lo uno de lo otro.',
      body: [
        { type: 'h2', text: "Primero, ¿qué significan value y growth?" },
        { type: 'p', text: "Antes de hablar de rotación, definamos las palabras. Una acción se llama \"value\" (valor) cuando cotiza barata respecto a lo que la empresa vale de verdad: sus beneficios, su caja, sus activos. Pagas poco por muchos fundamentales. Una acción \"growth\" (crecimiento) es lo contrario, es cara: aceptas un precio alto hoy porque apuestas por un fuerte crecimiento futuro. La tecnología y la IA son el ejemplo típico." },
        { type: 'p', text: "Una \"rotación\" es simplemente el momento en que los capitales se desplazan en masa de un estilo al otro. Cuando el dinero huye del crecimiento hacia el valor, hablamos de rotación value. Es exactamente lo que ocurre en 2026, y su magnitud es poco común." },
        { type: 'ul', items: [
          "Value y growth: value = barato respecto a los fundamentales; growth = caro porque pagas el crecimiento futuro",
          "Rotación value: el dinero abandona el crecimiento (tecnología, IA) por el valor (seguros, energía, bancos)",
          "En 2026 el índice Value sube un 18,6 % frente al 8,3 % del Growth, 10 puntos de diferencia",
          "La trampa: el value trap, una acción barata que sigue barata porque la empresa está en declive",
          "Mi enfoque: no buscar lo barato, sino la calidad barata (la calidad primero, el precio después)",
        ]},
        { type: 'h2', text: "Por qué te hablo de esto ahora" },
        { type: 'p', text: "Hablemos de cifras, porque es lo que cuenta. Desde principios de 2026, el índice Morningstar US Value ha ganado un 18,6 %. El índice Growth: un 8,3 %. Diez puntos de diferencia. Es la mayor divergencia entre valor y crecimiento desde el inicio de la década." },
        { type: 'p', text: "La señal más visible: el Dow Jones alcanzó un récord de 51 562 puntos a principios de junio, impulsado por UnitedHealth (+5 %), JPMorgan (+3 %) y Walmart. En el mismo momento, el Nasdaq cedía un 0,1 %. Traducción sencilla: los inversores salen de la tecnología y la IA para reposicionarse en sectores más terrenales, los etiquetados value." },
        { type: 'p', text: "Y el movimiento es pesado. Desde 2023, 4,6 billones de dólares en capitalización han pasado del índice Russell 1000 Growth al Russell 1000 Value. No son tres gestores nerviosos un martes por la mañana, es un desplazamiento de placas tectónicas." },
        { type: 'h2', text: "Por qué la value podría volver de verdad" },
        { type: 'p', text: "Una rotación puede ser solo un humor pasajero. Esta se apoya en dos razones de fondo, y hay que entenderlas para juzgarla." },
        { type: 'p', text: "La primera son los tipos de interés y la inflación. Cuando el dinero cuesta caro y los precios suben, las promesas lejanas valen menos. Y una acción growth es precisamente una promesa lejana: pagas hoy por beneficios esperados dentro de diez años. Una acción value, en cambio, genera caja ahora. Se dice que tiene \"duración más corta\": su valor depende menos del futuro lejano, así que sufre menos cuando los tipos suben." },
        { type: 'p', text: "La segunda viene de una gestora, Neuberger Berman, que considera que las acciones value están listas para acelerar. Su argumento se basa en un término que te explico: el beta de beneficios. Es la sensibilidad de los beneficios de una empresa a la salud de la economía. Los valores value tienen un beta de 1,2 frente al 0,8 del crecimiento: cuando la economía repunta, sus beneficios suben más rápido. Si la recuperación se confirma, se benefician más." },
        { type: 'p', text: "Honestidad obligatoria: una previsión macro no es una certeza. La prueba, WisdomTree, otro actor, acaba de reaumentar su exposición al crecimiento en junio 2026, juzgando que tras dos años de mejor comportamiento de la value, el crecimiento había vuelto a ser más asequible. Dos casas serias, dos apuestas opuestas. Por eso nunca fundamento una decisión en una previsión macro." },
        { type: 'h2', text: "La trampa central: el value trap" },
        { type: 'p', text: "Este es el error que quiero ahorrarte. Cuando un estilo de mercado vuelve a estar de moda, el reflejo es comprar todo lo que esté etiquetado como barato. Mala idea. Una acción puede estar barata por una excelente razón: la empresa está realmente en declive." },
        { type: 'p', text: "A esto lo llamamos value trap, una trampa de valor. La acción parece una ganga, su precio bajo atrae, así que compras. Salvo que el precio sigue bajo, o baja más, porque el negocio se deteriora de verdad. No compraste un descuento, compraste un declive. Lo barato, por sí solo, nunca es una señal de compra: es solo un precio bajo, y un precio bajo puede estar perfectamente justificado." },
        { type: 'p', text: "De ahí mi regla, la misma desde el principio: siempre separo dos preguntas que la mayoría confunde. Una: ¿es un buen negocio? Dos, totalmente aparte: ¿es un buen precio? Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Así que no busco lo barato. Busco la calidad barata. La calidad primero, el precio después." },
        { type: 'h2', text: "Cómo juzgo la calidad, antes incluso de mirar el precio" },
        { type: 'p', text: "Para resolver la primera pregunta, no me fío de mi intuición. Paso la empresa por un filtro de criterios financieros concretos, y luego lo resumo todo en una puntuación de calidad sobre 10. Un 10/10 no dice nada sobre el precio de la acción: dice que el negocio cumple todos mis criterios de solidez." },
        { type: 'p', text: "En concreto, miro si la empresa es rentable de forma duradera, si sus ventas y su caja crecen, si recompra sus propias acciones en lugar de malgastar, si su deuda es manejable, y si genera mucho free cash flow. El free cash flow es el dinero que queda de verdad en caja una vez pagadas todas las facturas: salarios, máquinas, impuestos. Es más difícil de maquillar que el beneficio contable, así que me fío más de él." },
        { type: 'p', text: "Esta puntuación de calidad es mi filtro anti value trap. Si una acción está barata pero puntúa mal, paso: probablemente es una trampa. Si está barata Y puntúa 10/10, ahí se pone interesante, porque tengo a la vez un buen negocio y, quizá, un buen precio." },
        { type: 'h2', text: "Cómo es una calidad barata en 2026" },
        { type: 'p', text: "Para medir si el precio es razonable, uso un ratio sencillo: el P/FCF (price to free cash flow), el precio de la acción respecto al free cash flow que genera cada año. Un P/FCF de 10 significa que pagas hoy diez años de esa caja. Cuanto más bajo, más barata la acción. El sentido primero: un P/FCF bajo, la acción cotiza barata." },
        { type: 'p', text: "Cruzando mi puntuación de calidad máxima con un P/FCF inferior a 10x, un perfil destaca con claridad: los seguros. No es casualidad. Una buena aseguradora cobra las primas por adelantado, invierte ese dinero y genera caja con pocas necesidades de inversión. Es justo el tipo de negocio sólido que la rotación value recompensa, sin ser un value trap." },
        { type: 'p', text: "Algunos ejemplos concretos, sin inventar nada sobre las cifras. SkyWest, una aerolínea regional puntuada 10/10, cotiza a unas 3,9 veces su free cash flow, como si estuviera al borde de la quiebra, lo que sus fundamentales no dicen. Kinsale Capital, una aseguradora especializada que crece al 33 % anual, cotiza a 7,1 veces, por debajo de la mediana de su sector. Progressive, la aseguradora de autos más eficiente de América, que gana un 5,7 % de cuota de mercado al año, está a 7,4 veces. Arch Capital, aseguradora diversificada con un crecimiento del 17 % anual, ronda las 5,6 veces." },
        { type: 'p', text: "Podemos seguir: W.R. Berkley, la aseguradora value por excelencia con 58 años de existencia, cotiza a 7,0 veces; Mercury General muestra un P/FCF de 4,0 veces, un P/B (precio respecto al valor contable) de 1,1 veces y una rentabilidad del 3,7 %, value pura; Cincinnati Financial, 74 años de dividendos crecientes, está a 7,4 veces. El punto común de toda esta lista: una puntuación de calidad perfecta Y un múltiplo de caja inferior a la media del mercado. Buen negocio y buen precio, ambos a la vez." },
        { type: 'h2', text: "Qué implica esto para ti, sin ilusiones" },
        { type: 'p', text: "Si la rotación value continúa, son precisamente estos perfiles, sólidos y con descuento, los que deberían comportarse mejor. Pero no te venderé una certeza. Nadie puede cronometrar un giro de mercado: ni yo, ni Neuberger Berman, ni WisdomTree, que además apuestan en direcciones opuestas." },
        { type: 'p', text: "Lo que sí sé es que comprar calidad a un precio justo ha envejecido bien históricamente, se confirme la rotación mañana o dentro de dos años. No necesitas adivinar el calendario del mercado. Necesitas no pagar de más por un buen negocio, y no confundir nunca un descuento con un declive." },
        { type: 'p', text: "Es justo lo que quería poder hacer en segundos para cualquier acción: juzgar la calidad de un negocio por un lado, su precio por el otro, y detectar los raros casos en que ambos se alinean. Como no encontraba la herramienta, la construí. Puedes escribir un ticker para ver dónde se sitúa una acción en la matriz calidad-precio, recorrer mi clasificación de acciones infravaloradas, o filtrar las que puntúo 10/10 en calidad. Lo barato está en todas partes. La calidad barata, mucho más rara." },
      ],
      faq: [
        { q: "¿Qué es una acción value frente a una acción growth?", a: "Una acción value cotiza barata respecto a los fundamentales de la empresa (beneficios, caja, activos): pagas poco por mucho. Una acción growth es cara porque apuestas por un fuerte crecimiento futuro, como en la tecnología o la IA. Una rotación value es cuando el dinero abandona la segunda por la primera." },
        { q: "¿Qué es un value trap y cómo lo evito?", a: "Un value trap es una acción que parece barata pero sigue barata, o baja más, porque la empresa está realmente en declive. El precio bajo no es un descuento, es un declive justificado. Para evitarlo, juzgo primero la calidad del negocio (rentabilidad, crecimiento de la caja, deuda manejable) y solo compro barato lo que además es sólido." },
        { q: "¿Qué es el P/FCF en términos claros?", a: "El P/FCF (price to free cash flow) compara el precio de la acción con el free cash flow que genera cada año, es decir el dinero que queda de verdad tras pagarlo todo. Un P/FCF de 7 significa que pagas siete años de esa caja. Cuanto más bajo, más barata la acción. El sentido importa antes que el número." },
        { q: "¿Es sostenible la rotación value de 2026?", a: "Nadie lo sabe con certeza. Neuberger Berman la juzga duradera: los valores value tienen un beta de beneficios de 1,2 frente al 0,8 del crecimiento, así que se benefician más de una recuperación, y los tipos altos los favorecen. Pero WisdomTree redujo su apuesta value en junio 2026, juzgando que el crecimiento había vuelto a ser asequible. Dos opiniones opuestas, de ahí mi prudencia sobre el timing." },
        { q: "¿Debo comprar estas acciones value ahora?", a: "Depende de tu disciplina de precio, no de una previsión. Una puntuación de calidad alta combinada con un P/FCF bajo señala un buen negocio a un precio razonable, pero no dice si mañana será verde o rojo. Esto no es asesoramiento de inversión personalizado: haz tu propia investigación." },
      ],
      tags: ['Rotación', 'Valor', 'Estrategia', 'Análisis'],
      disclaimer:
        'Este artículo es un análisis con fines informativos y educativos y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 10 de junio de 2026, sujetas a cambios. Haz tu propia investigación.',
    },
  },
};

const techPfcf: Article = {
  slug: 'tech-paie-trop-cher-cash-flows-msft-googl-adbe',
  date: '2026-06-10',
  updated: '2026-06-10',
  readingTime: 9,
  ticker: 'MSFT',
  content: {
    fr: {
      title: "Microsoft, Alphabet, Adobe : la tech paie-t-elle trop cher ?",
      excerpt:
        "Microsoft se paie 49,7 fois son cash, Alphabet 116,6 fois, Adobe 11,7 fois. Trois géants, trois prix qui n'ont rien à voir. Voici comment je lis ces écarts.",
      metaDescription:
        "P/FCF de MSFT (49,7x), GOOGL (116,6x) et ADBE (11,7x) expliqué simplement. Apprends à lire un multiple et à séparer la qualité d'une entreprise de son prix.",
      answer:
        "Non, pas partout : tout dépend de l'entreprise. Microsoft (49,7 fois son cash) et Alphabet (116,6 fois) se paient comme si la perfection était acquise, alors que leur cash par action stagne ou recule. Adobe (11,7 fois), bien plus solide, est au plus bas de son histoire. Le multiple seul ne dit rien : la croissance derrière décide.",
      body: [
        { type: 'h2', text: "Pourquoi « la tech est trop chère » ne veut rien dire" },
        { type: 'p', text: "Tu l'as forcément entendu : « la tech est trop chère ». C'est une phrase qui mélange tout. Microsoft, Alphabet et Adobe sont rangés dans la même case « big tech », mais le marché les valorise de façons radicalement différentes. L'une se paie dix fois plus cher que l'autre pour des qualités comparables. Comprendre pourquoi, c'est apprendre à lire un chiffre tout simple : le prix d'une action rapporté au cash qu'elle génère." },
        { type: 'p', text: "Ce chiffre s'appelle le P/FCF, pour price to free cash flow. Le free cash flow, c'est l'argent qui reste réellement dans les caisses une fois toutes les factures payées : salaires, machines, impôts, investissements. Pas le bénéfice comptable, qui se maquille facilement, mais le cash. Le P/FCF, c'est le prix de l'action divisé par ce cash annuel. Un P/FCF de 12 veut dire que tu paies aujourd'hui douze années de ce cash. Plus c'est bas, moins c'est cher. Plus c'est haut, plus le marché te demande de croire à une forte croissance future." },
        { type: 'p', text: "Ce nombre s'appelle aussi un « multiple » : combien de fois le cash annuel tu acceptes de payer. Et voici tout l'enjeu de cet article : un multiple élevé n'est pas « cher » dans l'absolu. Il l'est seulement si la croissance ne suit pas. Payer 50 fois le cash d'une entreprise qui double tous les trois ans peut être une affaire. Payer 12 fois le cash d'une entreprise en déclin peut être un piège. Le chiffre ne se juge jamais seul." },
        { type: 'ul', items: [
          "P/FCF : le prix de l'action divisé par le cash qu'elle génère vraiment. 12 = tu paies douze années de ce cash. Bas = bon marché, élevé = cher.",
          "Microsoft se paie 49,7 fois son cash (qualité 8/10), Alphabet 116,6 fois (6/10), Adobe 11,7 fois (9/10).",
          "Un multiple élevé n'est cher que si la croissance déçoit. Un multiple bas n'est une affaire que si la qualité tient.",
          "Le vrai juge n'est pas le revenu, mais le cash par action : il dit ce que l'actionnaire touche réellement.",
          "Je juge toujours la qualité d'un business et son prix séparément. Mélanger les deux, c'est l'erreur numéro un.",
        ]},
        { type: 'h2', text: "Comment je note la qualité d'une entreprise, avant de regarder le prix" },
        { type: 'p', text: "Avant de me demander si une action est chère, je me demande si c'est une bonne entreprise. Ce sont deux questions distinctes. Pour la première, je n'écoute pas mon intuition : je passe l'entreprise au crible de critères financiers concrets et je lui donne une note sur 10. Est-elle vraiment rentable ? Son cash augmente-t-il par action ? Convertit-elle ses bénéfices en cash réel ? Sa dette est-elle maîtrisée ? Rachète-t-elle ses actions plutôt que de gaspiller ? Cette note ne dit rien du prix : elle mesure seulement la solidité du business." },
        { type: 'p', text: "Deux indicateurs reviennent souvent dans ce qui suit. La marge de free cash flow : sur 100 euros de ventes, combien finissent en cash réellement disponible. Le Cash ROCE : le cash généré rapporté à tout le capital employé pour le générer ; en clair, le rendement de chaque euro investi dans le business. Plus ces deux nombres sont hauts, plus la machine à cash est efficace. Gardons-les en tête, ils vont tout expliquer." },
        { type: 'h2', text: "Microsoft (MSFT) : une excellente entreprise payée comme si elle allait accélérer" },
        { type: 'p', text: "Microsoft valide 8 critères sur 10. C'est une vraie entreprise d'élite : 39 centimes de marge nette par euro de revenu, un chiffre d'affaires qui croît de 13,5 % par an, et un cycle de trésorerie négatif de 62 jours. Ce dernier point est rare et précieux : ses clients la paient avant qu'elle ne paie ses fournisseurs, exactement comme Costco. L'argent travaille pour elle, pas l'inverse. Elle rachète aussi ses actions régulièrement, ce qui concentre la valeur sur ceux qui restent." },
        { type: 'p', text: "Mais deux voyants clignotent en rouge. Son cash par action ne progresse que de 4,8 % par an, sous mon seuil de 10 %. Et son ratio de conversion du bénéfice en cash n'est que de 0,48 : moins de la moitié des bénéfices deviennent du cash libre. Le coupable a un nom : l'investissement massif dans l'intelligence artificielle. Microsoft brûle du cash en centres de données aujourd'hui, en pariant qu'il reviendra plus tard. C'est peut-être un bon pari, mais en attendant, le cash que touche l'actionnaire stagne." },
        { type: 'p', text: "Voilà le cœur du problème de prix. À 49,7 fois son cash, le marché paie Microsoft comme si la croissance allait s'accélérer franchement. Mon modèle de valorisation, lui, vise un rendement de 15 % par an et ressort un prix d'achat raisonnable autour de 144 dollars. L'action en vaut 403. Je suis donc à 64 % au-dessus du point d'entrée que je m'autorise : la marge de sécurité est négative. Microsoft reste superbe. Mais à ce prix, tu paies déjà l'accélération avant qu'elle n'arrive." },
        { type: 'h2', text: "Alphabet (GOOGL) : le cas extrême, 116,6 fois un cash qui recule" },
        { type: 'p', text: "Alphabet est le plus déroutant des trois. Sa note de qualité n'est que de 6 sur 10. Deux critères échouent franchement : son cash par action recule de 3 % par an, et son Cash ROCE n'est que de 9,2 %, sous mon seuil de 15 %. Deux autres sont en avertissement, dont une marge de free cash flow de 9,1 %, juste sous la barre des 10 %." },
        { type: 'p', text: "Le paradoxe est saisissant. Alphabet est une machine à transformer ton attention en revenus publicitaires : personne ne fait mieux. Mais transformer ces revenus en cash qui revient à l'actionnaire, c'est une autre histoire. Sa marge de cash n'est que de 9,1 %, et son cash par action baisse depuis cinq ans. Deux raisons : un stock-based compensation énorme, et de lourds investissements. Le stock-based compensation, c'est la rémunération des salariés en actions plutôt qu'en cash. Ça paraît gratuit, mais ça crée de nouvelles actions, donc ça dilue les actionnaires existants : ta part du gâteau rétrécit. Chez Alphabet, ça absorbe 40 % du free cash flow. Énorme." },
        { type: 'p', text: "Et pourtant, le marché valorise Alphabet à 116,6 fois son cash, soit 7 fois la médiane de son secteur. C'est un multiple qui ne suppose pas une croissance solide : il suppose une accélération spectaculaire d'un cash qui, aujourd'hui, recule. Mon prix d'achat raisonnable ressort à 54 dollars, contre un cours de 364. Une surcote de 85 %. C'est l'illustration parfaite du piège du multiple élevé : tu paies très cher une croissance future que les chiffres actuels ne montrent pas encore." },
        { type: 'h2', text: "Adobe (ADBE) : la qualité la plus haute, au prix le plus bas" },
        { type: 'p', text: "Adobe est le contre-exemple presque parfait. Note de qualité 9 sur 10, soit 23 critères validés sur 25. Une marge de free cash flow de 34 % : sur 100 euros de ventes, 34 finissent en cash disponible, là où la plupart des entreprises plafonnent autour de 10. Un Cash ROCE de 153 %, ce qui est exceptionnel. Un cycle de trésorerie négatif de 28 jours. Et surtout, son cash par action croît de 10,9 % par an : le seul des trois à passer mon seuil. Tout ce qui manque à Microsoft et Alphabet, Adobe l'a." },
        { type: 'p', text: "Et son multiple ? 11,7 fois le cash. Le plus bas de toute son histoire. Le marché a massacré Adobe par peur de l'IA générative, Midjourney et Canva en tête, et parce que sa croissance a ralenti, autour de 11 % par an contre plus de 20 % avant. Mais le free cash flow, lui, continue de monter. Résultat : un écart béant entre la qualité réelle, 9 sur 10, et la peur que le marché projette dessus." },
        { type: 'p', text: "Attention quand même : moins cher ne veut pas dire donné. Même à 11,7 fois son cash, Adobe n'est pas une affaire évidente à mes yeux. Mon prix d'achat raisonnable ressort à 149 dollars, contre un cours de 238 : encore 37 % au-dessus. La différence, c'est que cette surcote de 37 % est bien plus tolérable que les 64 % de Microsoft ou les 85 % d'Alphabet. Relativement aux deux autres, Adobe est de loin le plus abordable. Tu peux le vérifier sur la page d'analyse d'Adobe." },
        { type: 'h2', text: "Ce que ces trois cas t'apprennent à lire" },
        { type: 'p', text: "Trois entreprises de la même famille, trois prix qui n'ont rien à voir. Si tu ne devais retenir que trois réflexes :" },
        { type: 'ul', items: [
          "Le multiple ne se lit jamais seul. Adobe est dix fois moins cher qu'Alphabet sur le cash, alors que sa qualité est nettement supérieure. Un chiffre haut ou bas ne veut rien dire sans la croissance derrière.",
          "Le cash par action est le vrai juge de paix. Microsoft (+4,8 %) et Alphabet (-3,0 %) calent là où Adobe (+10,9 %) avance. C'est ce que l'actionnaire touche vraiment, revenu mis à part.",
          "Méfie-toi du stock-based compensation. Chez Alphabet il absorbe 40 % du cash, chez Microsoft 17 %. Voilà pourquoi le cash par action stagne malgré des revenus en hausse de 13 % : la dilution mange la croissance.",
        ]},
        { type: 'p', text: "Le piège dans les deux sens est le même. Un multiple élevé n'est cher que si la croissance déçoit, et un multiple bas n'est une aubaine que si la qualité tient. C'est précisément pour ça que je juge toujours la qualité d'un business avant son prix, jamais l'inverse. Tu peux retrouver toute la grille sur ma page de méthodologie, et comparer toi-même Microsoft, Alphabet et Adobe sur leurs pages d'analyse respectives." },
        { type: 'p', text: "Au fond, ce que je voulais, c'était pouvoir poser ces deux questions, la qualité d'un côté, le juste prix de l'autre, en quelques secondes et pour n'importe quelle action. Comme aucun outil ne le faisait à ma façon, je l'ai construit. Tape un ticker, et tu vois immédiatement où se situe le prix raisonnable par rapport au cours." },
      ],
      faq: [
        { q: "C'est quoi le P/FCF, en une phrase ?", a: "Le prix de l'action divisé par le free cash flow qu'elle génère chaque année, c'est-à-dire le cash qui reste une fois toutes les factures payées. Un P/FCF de 12 veut dire que tu paies douze années de ce cash : bas = bon marché, élevé = cher." },
        { q: "Un multiple élevé veut-il toujours dire « trop cher » ?", a: "Non. Un multiple élevé signifie que le marché price une forte croissance future. Il n'est trop cher que si cette croissance déçoit. Microsoft à 49,7 fois et Alphabet à 116,6 fois sont chers parce que leur cash par action stagne ou recule, pas parce que le chiffre est haut en soi." },
        { q: "Pourquoi Alphabet se paie-t-il 116,6 fois son cash ?", a: "Parce que le marché parie sur une accélération spectaculaire de son cash. Mais aujourd'hui ce cash recule de 3 % par an, sa marge de cash n'est que de 9,1 %, et le stock-based compensation, la rémunération en actions qui dilue les actionnaires, absorbe 40 % du free cash flow." },
        { q: "Adobe à 11,7 fois son cash, c'est une affaire ?", a: "C'est le moins cher des trois et de loin le plus solide (qualité 9/10), mais pas une affaire évidente. Mon prix d'achat raisonnable est de 149 dollars, contre un cours de 238 : encore 37 % au-dessus. Moins cher ne veut pas dire donné." },
        { q: "Pourquoi regarder le cash par action plutôt que le chiffre d'affaires ?", a: "Parce que le chiffre d'affaires peut grimper sans que tu en profites : si l'entreprise crée sans cesse de nouvelles actions pour payer ses salariés, ta part rétrécit. Le cash par action mesure ce que l'actionnaire touche réellement, dilution comprise." },
      ],
      tags: ['Analyse', 'Microsoft', 'Alphabet', 'Adobe', 'Valorisation'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 10 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: "Microsoft, Alphabet, Adobe : does big tech pay too much ?",
      excerpt:
        "Microsoft trades at 49.7 times its cash, Alphabet at 116.6, Adobe at 11.7. Three giants, three prices with nothing in common. Here is how I read the gaps.",
      metaDescription:
        "P/FCF of MSFT (49.7x), GOOGL (116.6x) and ADBE (11.7x) explained simply. Learn to read a multiple and to separate a company's quality from its price.",
      answer:
        "No, not everywhere : it depends on the company. Microsoft (49.7 times its cash) and Alphabet (116.6 times) are priced as if perfection were guaranteed, while their cash per share stalls or falls. Adobe (11.7 times), far more solid, sits at its historic low. A multiple alone says nothing : the growth behind it decides.",
      body: [
        { type: 'h2', text: "Why 'tech is too expensive' means nothing" },
        { type: 'p', text: "You have surely heard it : 'tech is too expensive'. That sentence mixes everything up. Microsoft, Alphabet and Adobe all sit in the same 'big tech' box, yet the market values them in radically different ways. One trades ten times richer than another for comparable quality. Understanding why means learning to read one simple number : the price of a share divided by the cash it generates." },
        { type: 'p', text: "That number is the P/FCF, for price to free cash flow. Free cash flow is the money that actually stays in the bank once every bill is paid : salaries, machines, taxes, investments. Not accounting profit, which is easy to dress up, but cash. The P/FCF is the share price divided by that yearly cash. A P/FCF of 12 means you are paying twelve years of that cash today. The lower it is, the cheaper. The higher it is, the more the market is asking you to believe in strong future growth." },
        { type: 'p', text: "This number is also called a 'multiple' : how many times the yearly cash you agree to pay. And here is the whole point of this article : a high multiple is not 'expensive' in absolute terms. It is only expensive if growth fails to follow. Paying 50 times the cash of a company that doubles every three years can be a bargain. Paying 12 times the cash of a declining company can be a trap. The number is never judged on its own." },
        { type: 'ul', items: [
          "P/FCF : the share price divided by the cash it truly generates. 12 = you pay twelve years of that cash. Low = cheap, high = expensive.",
          "Microsoft trades at 49.7 times its cash (quality 8/10), Alphabet at 116.6 (6/10), Adobe at 11.7 (9/10).",
          "A high multiple is only expensive if growth disappoints. A low multiple is only a bargain if the quality holds.",
          "The real judge is not revenue, but cash per share : it shows what the shareholder actually receives.",
          "I always judge a business's quality and its price separately. Mixing the two is mistake number one.",
        ]},
        { type: 'h2', text: "How I score quality, before I ever look at the price" },
        { type: 'p', text: "Before asking whether a stock is expensive, I ask whether it is a good business. Those are two separate questions. For the first, I do not trust my gut : I run the company through concrete financial criteria and give it a score out of 10. Is it truly profitable ? Is its cash per share rising ? Does it convert earnings into real cash ? Is its debt under control ? Does it buy back shares instead of wasting money ? This score says nothing about price : it only measures how solid the business is." },
        { type: 'p', text: "Two indicators come up often below. The free cash flow margin : out of every 100 dollars of sales, how many end up as truly available cash. The Cash ROCE : the cash generated against all the capital used to generate it ; in plain terms, the return on every dollar invested in the business. The higher these two numbers, the more efficient the cash machine. Keep them in mind, they explain everything." },
        { type: 'h2', text: "Microsoft (MSFT) : a great business priced as if it will accelerate" },
        { type: 'p', text: "Microsoft passes 8 of my 10 criteria. It is genuinely elite : 39 cents of net margin per dollar of revenue, revenue growing 13.5 % a year, and a negative cash cycle of 62 days. That last point is rare and precious : its clients pay it before it pays its suppliers, exactly like Costco. The money works for it, not the other way around. It also buys back shares regularly, which concentrates value on those who stay." },
        { type: 'p', text: "But two warning lights flash red. Its cash per share grows only 4.8 % a year, below my 10 % threshold. And its earnings-to-cash conversion ratio is just 0.48 : less than half of profits turn into free cash. The culprit has a name : massive investment in artificial intelligence. Microsoft is burning cash on data centers today, betting it will come back later. It may be a good bet, but in the meantime the cash the shareholder receives stalls." },
        { type: 'p', text: "That is the heart of the price problem. At 49.7 times its cash, the market prices Microsoft as if growth will sharply accelerate. My valuation model, aiming for a 15 % annual return, lands a reasonable buy price near 144 dollars. The stock trades at 403. So I am 64 % above the entry point I allow myself : the margin of safety is negative. Microsoft is still superb. But at this price, you are already paying for the acceleration before it arrives." },
        { type: 'h2', text: "Alphabet (GOOGL) : the extreme case, 116.6 times a shrinking cash" },
        { type: 'p', text: "Alphabet is the most puzzling of the three. Its quality score is only 6 out of 10. Two criteria clearly fail : its cash per share is falling 3 % a year, and its Cash ROCE is just 9.2 %, below my 15 % threshold. Two more are warnings, including a free cash flow margin of 9.1 %, just under the 10 % line." },
        { type: 'p', text: "The paradox is striking. Alphabet is a machine for turning your attention into ad revenue : nobody does it better. But turning that revenue into cash that returns to the shareholder is another story. Its cash margin is only 9.1 %, and its cash per share has been falling for five years. Two reasons : huge stock-based compensation, and heavy investment. Stock-based compensation is paying employees in shares instead of cash. It looks free, but it creates new shares, so it dilutes existing shareholders : your slice of the pie shrinks. At Alphabet it absorbs 40 % of free cash flow. Enormous." },
        { type: 'p', text: "And yet the market values Alphabet at 116.6 times its cash, 7 times its sector median. That multiple does not assume solid growth : it assumes a spectacular acceleration of a cash flow that, today, is shrinking. My reasonable buy price comes out at 54 dollars, against a 364 price. An 85 % premium. This is the perfect illustration of the high-multiple trap : you pay dearly for future growth that current numbers do not yet show." },
        { type: 'h2', text: "Adobe (ADBE) : the highest quality, at the lowest price" },
        { type: 'p', text: "Adobe is the near-perfect counter-example. Quality score of 9 out of 10, meaning 23 of 25 criteria passed. A free cash flow margin of 34 % : out of every 100 dollars of sales, 34 end up as available cash, where most companies cap around 10. A Cash ROCE of 153 %, which is exceptional. A negative cash cycle of 28 days. And above all, its cash per share grows 10.9 % a year : the only one of the three to clear my threshold. Everything Microsoft and Alphabet lack, Adobe has." },
        { type: 'p', text: "And its multiple ? 11.7 times its cash. The lowest in its entire history. The market crushed Adobe out of fear of generative AI, Midjourney and Canva chief among them, and because its growth slowed, to about 11 % a year versus over 20 % before. But the free cash flow itself keeps rising. The result : a gaping gap between the real quality, 9 out of 10, and the fear the market projects onto it." },
        { type: 'p', text: "A word of caution though : cheaper does not mean given away. Even at 11.7 times its cash, Adobe is not an obvious bargain in my eyes. My reasonable buy price comes out at 149 dollars, against a 238 price : still 37 % above. The difference is that this 37 % premium is far more tolerable than Microsoft's 64 % or Alphabet's 85 %. Relative to the other two, Adobe is by far the most affordable. You can check it on Adobe's analysis page." },
        { type: 'h2', text: "What these three cases teach you to read" },
        { type: 'p', text: "Three companies from the same family, three prices with nothing in common. If you keep only three reflexes :" },
        { type: 'ul', items: [
          "A multiple is never read alone. Adobe is ten times cheaper than Alphabet on cash, yet its quality is clearly higher. A high or low number means nothing without the growth behind it.",
          "Cash per share is the real arbiter. Microsoft (+4.8 %) and Alphabet (-3.0 %) stall where Adobe (+10.9 %) advances. It is what the shareholder truly receives, revenue aside.",
          "Beware of stock-based compensation. At Alphabet it absorbs 40 % of cash, at Microsoft 17 %. That is why cash per share barely grows despite revenue up 13 % : dilution eats the growth.",
        ]},
        { type: 'p', text: "The trap runs both ways and it is the same. A high multiple is only expensive if growth disappoints, and a low multiple is only a bargain if the quality holds. That is precisely why I always judge a business's quality before its price, never the reverse. You can find the full grid on my methodology page, and compare Microsoft, Alphabet and Adobe yourself on their respective analysis pages." },
        { type: 'p', text: "At bottom, what I wanted was to be able to ask these two questions, quality on one side, fair price on the other, in seconds and for any stock. Since no tool did it my way, I built it. Type a ticker, and you instantly see where the reasonable price sits against the current quote." },
      ],
      faq: [
        { q: "What is P/FCF, in one sentence ?", a: "The share price divided by the free cash flow it generates each year, that is the cash left once every bill is paid. A P/FCF of 12 means you pay twelve years of that cash : low = cheap, high = expensive." },
        { q: "Does a high multiple always mean 'too expensive' ?", a: "No. A high multiple means the market is pricing strong future growth. It is only too expensive if that growth disappoints. Microsoft at 49.7 times and Alphabet at 116.6 are expensive because their cash per share stalls or falls, not because the number is high on its own." },
        { q: "Why does Alphabet trade at 116.6 times its cash ?", a: "Because the market bets on a spectacular acceleration of its cash. But today that cash is falling 3 % a year, its cash margin is only 9.1 %, and stock-based compensation, the share-based pay that dilutes shareholders, absorbs 40 % of free cash flow." },
        { q: "Is Adobe at 11.7 times its cash a bargain ?", a: "It is the cheapest of the three and by far the most solid (quality 9/10), but not an obvious bargain. My reasonable buy price is 149 dollars, against a 238 quote : still 37 % above. Cheaper does not mean given away." },
        { q: "Why look at cash per share rather than revenue ?", a: "Because revenue can climb without benefiting you : if the company constantly creates new shares to pay employees, your slice shrinks. Cash per share measures what the shareholder actually receives, dilution included." },
      ],
      tags: ['Analysis', 'Microsoft', 'Alphabet', 'Adobe', 'Valuation'],
      disclaimer:
        "This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 10, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "Microsoft, Alphabet, Adobe : ¿paga demasiado la tecnología ?",
      excerpt:
        "Microsoft cotiza a 49,7 veces su caja, Alphabet a 116,6, Adobe a 11,7. Tres gigantes, tres precios que no tienen nada que ver. Así leo yo las diferencias.",
      metaDescription:
        "El P/FCF de MSFT (49,7x), GOOGL (116,6x) y ADBE (11,7x) explicado simple. Aprende a leer un múltiplo y a separar la calidad de una empresa de su precio.",
      answer:
        "No, no en todas partes : depende de la empresa. Microsoft (49,7 veces su caja) y Alphabet (116,6 veces) cotizan como si la perfección estuviera garantizada, mientras su caja por acción se estanca o cae. Adobe (11,7 veces), mucho más sólida, está en su mínimo histórico. Un múltiplo solo no dice nada : el crecimiento detrás decide.",
      body: [
        { type: 'h2', text: "Por qué «la tecnología es demasiado cara» no significa nada" },
        { type: 'p', text: "Seguro lo has oído : «la tecnología es demasiado cara». Esa frase lo mezcla todo. Microsoft, Alphabet y Adobe están en la misma caja de «big tech», pero el mercado los valora de formas radicalmente distintas. Uno cotiza diez veces más caro que otro con una calidad comparable. Entender por qué es aprender a leer un número muy simple : el precio de una acción dividido por la caja que genera." },
        { type: 'p', text: "Ese número es el P/FCF, de price to free cash flow. El free cash flow es el dinero que de verdad queda en caja una vez pagadas todas las facturas : salarios, máquinas, impuestos, inversiones. No el beneficio contable, que se maquilla fácil, sino la caja. El P/FCF es el precio de la acción dividido por esa caja anual. Un P/FCF de 12 significa que hoy pagas doce años de esa caja. Cuanto más bajo, más barato. Cuanto más alto, más te pide el mercado que creas en un fuerte crecimiento futuro." },
        { type: 'p', text: "Este número también se llama «múltiplo» : cuántas veces la caja anual aceptas pagar. Y aquí está toda la clave de este artículo : un múltiplo alto no es «caro» en términos absolutos. Solo lo es si el crecimiento no acompaña. Pagar 50 veces la caja de una empresa que se duplica cada tres años puede ser una ganga. Pagar 12 veces la caja de una empresa en declive puede ser una trampa. El número nunca se juzga solo." },
        { type: 'ul', items: [
          "P/FCF : el precio de la acción dividido por la caja que de verdad genera. 12 = pagas doce años de esa caja. Bajo = barato, alto = caro.",
          "Microsoft cotiza a 49,7 veces su caja (calidad 8/10), Alphabet a 116,6 (6/10), Adobe a 11,7 (9/10).",
          "Un múltiplo alto solo es caro si el crecimiento decepciona. Un múltiplo bajo solo es ganga si la calidad aguanta.",
          "El verdadero juez no es el ingreso, sino la caja por acción : muestra lo que el accionista recibe de verdad.",
          "Siempre juzgo la calidad de un negocio y su precio por separado. Mezclar las dos cosas es el error número uno.",
        ]},
        { type: 'h2', text: "Cómo puntúo la calidad, antes de mirar el precio" },
        { type: 'p', text: "Antes de preguntarme si una acción es cara, me pregunto si es un buen negocio. Son dos preguntas distintas. Para la primera no me fío de mi intuición : paso la empresa por criterios financieros concretos y le doy una nota sobre 10. ¿Es de verdad rentable ? ¿Sube su caja por acción ? ¿Convierte beneficios en caja real ? ¿Tiene la deuda controlada ? ¿Recompra acciones en vez de derrochar ? Esta nota no dice nada del precio : solo mide lo sólido que es el negocio." },
        { type: 'p', text: "Dos indicadores aparecen mucho más abajo. El margen de free cash flow : de cada 100 dólares de ventas, cuántos acaban como caja realmente disponible. El Cash ROCE : la caja generada frente a todo el capital empleado para generarla ; en claro, el rendimiento de cada dólar invertido en el negocio. Cuanto más altos sean estos dos números, más eficiente es la máquina de caja. Tenlos presentes, lo explican todo." },
        { type: 'h2', text: "Microsoft (MSFT) : un negocio excelente con precio de aceleración" },
        { type: 'p', text: "Microsoft valida 8 de mis 10 criterios. Es de verdad de élite : 39 centavos de margen neto por dólar de ingreso, ingresos creciendo al 13,5 % anual, y un ciclo de caja negativo de 62 días. Este último punto es raro y valioso : sus clientes le pagan antes de que ella pague a sus proveedores, igual que Costco. El dinero trabaja para ella, no al revés. Además recompra acciones con regularidad, lo que concentra el valor en quienes se quedan." },
        { type: 'p', text: "Pero dos luces parpadean en rojo. Su caja por acción solo crece un 4,8 % anual, por debajo de mi umbral del 10 %. Y su ratio de conversión de beneficio en caja es de solo 0,48 : menos de la mitad de los beneficios se vuelven caja libre. El culpable tiene nombre : la inversión masiva en inteligencia artificial. Microsoft quema caja hoy en centros de datos, apostando a que volverá más tarde. Quizá sea una buena apuesta, pero mientras tanto la caja que recibe el accionista se estanca." },
        { type: 'p', text: "Ese es el núcleo del problema de precio. A 49,7 veces su caja, el mercado paga Microsoft como si el crecimiento fuera a acelerarse con fuerza. Mi modelo de valoración, que busca un 15 % de rentabilidad anual, da un precio de compra razonable cercano a 144 dólares. La acción cotiza a 403. Así que estoy un 64 % por encima del punto de entrada que me permito : el margen de seguridad es negativo. Microsoft sigue siendo magnífica. Pero a este precio ya pagas la aceleración antes de que llegue." },
        { type: 'h2', text: "Alphabet (GOOGL) : el caso extremo, 116,6 veces una caja que cae" },
        { type: 'p', text: "Alphabet es el más desconcertante de los tres. Su nota de calidad es de solo 6 sobre 10. Dos criterios fallan claramente : su caja por acción cae un 3 % anual, y su Cash ROCE es de solo 9,2 %, por debajo de mi umbral del 15 %. Otros dos están en advertencia, entre ellos un margen de free cash flow del 9,1 %, justo bajo la línea del 10 %." },
        { type: 'p', text: "La paradoja es asombrosa. Alphabet es una máquina de convertir tu atención en ingresos publicitarios : nadie lo hace mejor. Pero convertir esos ingresos en caja que vuelve al accionista es otra historia. Su margen de caja es de solo el 9,1 %, y su caja por acción lleva cinco años cayendo. Dos razones : un enorme stock-based compensation, e inversiones pesadas. El stock-based compensation es pagar a los empleados con acciones en vez de con caja. Parece gratis, pero crea acciones nuevas, así que diluye a los accionistas actuales : tu porción del pastel se encoge. En Alphabet absorbe el 40 % del free cash flow. Enorme." },
        { type: 'p', text: "Y aun así, el mercado valora Alphabet a 116,6 veces su caja, 7 veces la mediana de su sector. Ese múltiplo no supone un crecimiento sólido : supone una aceleración espectacular de una caja que, hoy, cae. Mi precio de compra razonable sale a 54 dólares, frente a una cotización de 364. Una sobrevaloración del 85 %. Es la ilustración perfecta de la trampa del múltiplo alto : pagas carísimo un crecimiento futuro que los números actuales aún no muestran." },
        { type: 'h2', text: "Adobe (ADBE) : la calidad más alta, al precio más bajo" },
        { type: 'p', text: "Adobe es el contraejemplo casi perfecto. Nota de calidad de 9 sobre 10, es decir 23 de 25 criterios validados. Un margen de free cash flow del 34 % : de cada 100 dólares de ventas, 34 acaban como caja disponible, donde la mayoría de empresas se topan en torno al 10. Un Cash ROCE del 153 %, algo excepcional. Un ciclo de caja negativo de 28 días. Y sobre todo, su caja por acción crece un 10,9 % anual : la única de las tres que supera mi umbral. Todo lo que les falta a Microsoft y Alphabet, Adobe lo tiene." },
        { type: 'p', text: "¿Y su múltiplo ? 11,7 veces su caja. El más bajo de toda su historia. El mercado masacró Adobe por miedo a la IA generativa, Midjourney y Canva a la cabeza, y porque su crecimiento se ralentizó, a cerca del 11 % anual frente a más del 20 % antes. Pero el free cash flow sigue subiendo. El resultado : una brecha enorme entre la calidad real, 9 sobre 10, y el miedo que el mercado le proyecta encima." },
        { type: 'p', text: "Una advertencia, eso sí : más barato no significa regalado. Incluso a 11,7 veces su caja, Adobe no es una ganga evidente a mis ojos. Mi precio de compra razonable sale a 149 dólares, frente a una cotización de 238 : todavía un 37 % por encima. La diferencia es que ese 37 % es mucho más tolerable que el 64 % de Microsoft o el 85 % de Alphabet. Respecto a los otros dos, Adobe es con diferencia el más asequible. Puedes comprobarlo en la página de análisis de Adobe." },
        { type: 'h2', text: "Lo que estos tres casos te enseñan a leer" },
        { type: 'p', text: "Tres empresas de la misma familia, tres precios que no tienen nada que ver. Si solo te quedas con tres reflejos :" },
        { type: 'ul', items: [
          "Un múltiplo nunca se lee solo. Adobe es diez veces más barato que Alphabet en caja, y su calidad es claramente superior. Un número alto o bajo no significa nada sin el crecimiento detrás.",
          "La caja por acción es el verdadero juez. Microsoft (+4,8 %) y Alphabet (-3,0 %) se atascan donde Adobe (+10,9 %) avanza. Es lo que el accionista recibe de verdad, al margen del ingreso.",
          "Desconfía del stock-based compensation. En Alphabet absorbe el 40 % de la caja, en Microsoft el 17 %. Por eso la caja por acción apenas crece pese a ingresos al alza del 13 % : la dilución se come el crecimiento.",
        ]},
        { type: 'p', text: "La trampa va en los dos sentidos y es la misma. Un múltiplo alto solo es caro si el crecimiento decepciona, y un múltiplo bajo solo es ganga si la calidad aguanta. Por eso juzgo siempre la calidad de un negocio antes que su precio, nunca al revés. Puedes encontrar toda la grilla en mi página de metodología, y comparar tú mismo Microsoft, Alphabet y Adobe en sus respectivas páginas de análisis." },
        { type: 'p', text: "En el fondo, lo que quería era poder hacer estas dos preguntas, la calidad por un lado, el precio justo por otro, en segundos y para cualquier acción. Como ninguna herramienta lo hacía a mi manera, la construí. Escribe un ticker, y ves al instante dónde está el precio razonable frente a la cotización actual." },
      ],
      faq: [
        { q: "¿Qué es el P/FCF, en una frase ?", a: "El precio de la acción dividido por el free cash flow que genera cada año, es decir la caja que queda tras pagar todas las facturas. Un P/FCF de 12 significa que pagas doce años de esa caja : bajo = barato, alto = caro." },
        { q: "¿Un múltiplo alto significa siempre «demasiado caro» ?", a: "No. Un múltiplo alto significa que el mercado descuenta un fuerte crecimiento futuro. Solo es demasiado caro si ese crecimiento decepciona. Microsoft a 49,7 veces y Alphabet a 116,6 son caros porque su caja por acción se estanca o cae, no porque el número sea alto en sí." },
        { q: "¿Por qué cotiza Alphabet a 116,6 veces su caja ?", a: "Porque el mercado apuesta por una aceleración espectacular de su caja. Pero hoy esa caja cae un 3 % anual, su margen de caja es de solo el 9,1 %, y el stock-based compensation, la paga en acciones que diluye a los accionistas, absorbe el 40 % del free cash flow." },
        { q: "¿Adobe a 11,7 veces su caja es una ganga ?", a: "Es el más barato de los tres y con diferencia el más sólido (calidad 9/10), pero no una ganga evidente. Mi precio de compra razonable es de 149 dólares, frente a una cotización de 238 : todavía un 37 % por encima. Más barato no significa regalado." },
        { q: "¿Por qué mirar la caja por acción y no los ingresos ?", a: "Porque los ingresos pueden subir sin que tú te beneficies : si la empresa crea acciones nuevas sin parar para pagar a sus empleados, tu porción encoge. La caja por acción mide lo que el accionista recibe de verdad, dilución incluida." },
      ],
      tags: ['Análisis', 'Microsoft', 'Alphabet', 'Adobe', 'Valoración'],
      disclaimer:
        "Este artículo es un análisis con fines informativos y educativos y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 10 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};


const afya: Article = {
  "slug": "afya-afya-education-medicale-bresil-10-10",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 11,
  "ticker": "AFYA",
  "content": {
    "fr": {
      "title": "Afya Limited (AFYA) : qualité 10/10 bradée",
      "excerpt": "Une entreprise qui forme les médecins du Brésil, notée 10/10, et qui se paie à peine plus d'un an de cash généré. Voici pourquoi Afya coche tous mes critères, et où se cache le piège.",
      "metaDescription": "Afya Limited (AFYA) expliqué simplement : ce que fait cet acteur de l'éducation médicale au Brésil, son moat réglementaire, ses risques, et sa note 10/10.",
      "answer": "Afya forme les médecins du Brésil, un métier protégé par des licences quasi introuvables. L'entreprise valide mes 10 critères de qualité, fait croître son cash de 28 % par an, et se paie à peine plus d'un an de ce cash. La qualité est rare, le prix encore plus. Voici comment je lis ce dossier.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Afya forme les futurs médecins brésiliens : des facultés de médecine, plus des plateformes pour les praticiens déjà en exercice.",
            "Elle valide mes 10 critères de qualité sur 10, avec une marge de free cash flow de 32 % et un Cash ROCE de 20 %.",
            "Son cash par action grimpe de 28 % par an, et le chiffre d'affaires de 17 % par an : une croissance bien réelle.",
            "Le prix défie la raison : 1,1 fois son free cash flow, le plus bas de tout mon palmarès qualité. Tu paies à peine plus d'un an de cash.",
            "Le revers : c'est le Brésil. Régulation des places, dette d'acquisitions, et un real qui peut faire le yo-yo. Le prix bas n'est pas gratuit."
          ]
        },
        {
          "type": "h2",
          "text": "L'entreprise qui fabrique les médecins du Brésil"
        },
        {
          "type": "p",
          "text": "La première fois que j'ai vu le prix d'Afya dans mes données, j'ai vérifié deux fois. Une entreprise qui coche tous mes critères de qualité et qui se paie à peine plus d'un an de cash, ça n'arrive presque jamais. Alors j'ai voulu comprendre ce qui se cachait derrière."
        },
        {
          "type": "p",
          "text": "Afya, c'est l'éducation médicale privée au Brésil. Deux activités, en réalité. D'un côté, des facultés de médecine : l'entreprise forme des étudiants pendant six ans, qui paient des frais de scolarité année après année. De l'autre, des plateformes numériques pour les médecins déjà diplômés : préparation aux concours, formation continue, outils d'aide à la décision. Bref, elle accompagne un médecin brésilien du premier jour de fac jusqu'à la fin de sa carrière."
        },
        {
          "type": "p",
          "text": "Ce positionnement a une vertu rare. Au Brésil, ouvrir une faculté de médecine n'est pas un choix d'entrepreneur, c'est une autorisation que l'État accorde au compte-gouttes. Les licences sont rares, encadrées, et un nouveau concurrent ne peut pas simplement décider de se lancer. Afya a passé des années à acquérir et à exploiter ces autorisations. C'est exactement ce genre de barrière qui m'intéresse."
        },
        {
          "type": "h2",
          "text": "Est-ce une bonne entreprise ? (la qualité)"
        },
        {
          "type": "p",
          "text": "Je ne note jamais une entreprise à l'intuition. Je la passe au crible de 10 critères de qualité fondamentale : est-elle vraiment rentable, ses ventes et son cash augmentent-ils, transforme-t-elle son bénéfice en cash réel, sa dette est-elle maîtrisée, rend-elle son capital efficace ? Une entreprise qui valide tout obtient 10 sur 10. C'est rare, par construction. Afya y arrive."
        },
        {
          "type": "p",
          "text": "Un chiffre suffit à sentir la machine : sa marge de free cash flow atteint 32 %. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, locaux, impôts, investissements). Une marge de 32 %, ça veut dire que sur 100 reais de ventes, 32 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10. Sa marge nette, le bénéfice comptable rapporté aux ventes, ressort à 20 %."
        },
        {
          "type": "p",
          "text": "La croissance est là, elle aussi. Le chiffre d'affaires progresse de 17 % par an, et le cash par action de 28 % par an. Cette différence n'est pas un hasard : quand le cash par action grimpe plus vite que les ventes, c'est que l'entreprise gagne en efficacité et ne dilue pas ses actionnaires en émettant des actions à tour de bras. C'est le genre de détail qui distingue une croissance saine d'une croissance gonflée."
        },
        {
          "type": "h2",
          "text": "Le vrai trésor d'Afya : son moat"
        },
        {
          "type": "p",
          "text": "Un bon bilan ne me convainc jamais à lui seul. Ce que je cherche, c'est le moat : le fossé concurrentiel, ce qui empêche un rival de venir prendre la place. Le mot vient des douves d'un château. Plus le fossé est large, plus la forteresse est difficile à attaquer."
        },
        {
          "type": "p",
          "text": "Chez Afya, le moat tient d'abord aux barrières réglementaires. Les licences de facultés de médecine sont rares et strictement encadrées par l'État brésilien. Un concurrent ne peut pas décider, du jour au lendemain, d'ouvrir une fac face à elle : il faut une autorisation que personne ne distribue facilement. Cette rareté protège les positions d'Afya bien mieux qu'une marque ou un brevet ne le ferait."
        },
        {
          "type": "p",
          "text": "Le deuxième pilier, ce sont les revenus récurrents. Un étudiant en médecine s'engage pour six ans et paie ses frais de scolarité année après année. Une fois inscrit, il ne change pas d'école en cours de route. Afya connaît donc une grande partie de ses revenus des années à l'avance. C'est la prévisibilité d'un abonnement, appliquée à un diplôme."
        },
        {
          "type": "p",
          "text": "Le troisième pilier est structurel : le Brésil manque de médecins, et la demande de formation ne faiblit pas. Tant que le pays cherche à soigner mieux sa population, le besoin d'étudiants formés reste là. Ce moteur ne dépend pas d'une mode ni d'un cycle économique, il est ancré dans la démographie."
        },
        {
          "type": "p",
          "text": "Côté rendement du capital, ce moat se lit dans un chiffre que je regarde toujours : le Cash ROCE atteint 20 %. Cette mesure répond à une question simple : pour chaque réal mis dans le business, combien de cash il recrache chaque année ? Ici, 20 centimes par réal et par an. C'est le double du seuil que je considère comme correct, et le signe que le capital travaille vraiment."
        },
        {
          "type": "h2",
          "text": "Qu'est-ce que ma note 10/10, au juste ?"
        },
        {
          "type": "p",
          "text": "Ma note de qualité ne dit rien du prix de l'action. Elle juge le business seul. Afya valide mes 10 critères : rentabilité, croissance des ventes et du cash, conversion du bénéfice en cash, solidité du bilan, efficacité du capital. Très peu d'entreprises atteignent ce score, et tu en trouveras la liste complète dans mon [classement des entreprises notées 10 sur 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "Un détail en dit long sur l'honnêteté des comptes : le taux de conversion du bénéfice en cash ressort à 1,55. Autrement dit, le cash généré dépasse de moitié le bénéfice comptable. Une entreprise qui transforme ses profits en argent bien réel, et même davantage, ne maquille pas ses résultats. C'est exactement ce que je veux voir, parce que le bénéfice comptable se manipule plus facilement que le cash."
        },
        {
          "type": "h2",
          "text": "La qualité d'abord, le prix ensuite (et séparément)"
        },
        {
          "type": "p",
          "text": "Voici la règle que je n'enfreins jamais : je sépare deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Sur Afya, la première question est tranchée. Reste la seconde."
        },
        {
          "type": "p",
          "text": "Pour mesurer le prix, je regarde le P/FCF (price to free cash flow) : le cours de l'action rapporté au cash que l'entreprise génère vraiment chaque année. Un P/FCF de 1,1, ça veut dire qu'au rythme actuel, tu paies à peine plus d'une année de ce cash. Plus c'est bas, moins c'est cher. Afya se paie 1,1 fois son free cash flow. C'est le multiple le plus bas de tout mon palmarès qualité, et la plupart des entreprises solides se paient dix à vingt fois plus."
        },
        {
          "type": "p",
          "text": "Pour être sûr que ce n'est pas un mirage du moment, je regarde aussi où se situe ce prix dans l'histoire de l'action. Aujourd'hui, Afya se traite au percentile 29 de sa propre valorisation passée. En clair : 71 % du temps, ces cinq dernières années, l'action s'est payée plus cher qu'aujourd'hui. Ce n'est pas un plus bas absolu, mais c'est nettement dans le bas de sa fourchette habituelle. L'action vaut environ 14,69 dollars."
        },
        {
          "type": "h2",
          "text": "Pourquoi le marché brade une si belle machine ?"
        },
        {
          "type": "p",
          "text": "Parce que le marché ne paie pas une entreprise, il paie une histoire, et l'histoire d'Afya inquiète sur trois points. C'est le Brésil, et un prix aussi bas ne tombe jamais du ciel : il rémunère un risque que d'autres refusent de prendre. Soyons honnêtes sur ces risques."
        },
        {
          "type": "p",
          "text": "Premier risque : la régulation des places. Au Brésil, c'est l'État qui décide combien de futurs médecins peuvent être formés, à travers des programmes comme Mais Médicos. Une décision politique peut élargir ou geler le nombre de places en facultés. Cette même barrière réglementaire qui protège Afya peut donc aussi se retourner contre elle si le gouvernement change de cap. C'est l'épée à double tranchant de toute activité régulée."
        },
        {
          "type": "p",
          "text": "Deuxième risque : la dette liée aux acquisitions. Afya a grandi en rachetant des facultés, et cela laisse des emprunts au bilan. Sa dette nette représente environ 1,7 année de free cash flow. Concrètement, l'entreprise pourrait rembourser toute sa dette nette en moins de deux ans de cash. C'est un niveau que je juge raisonnable, mais c'est un poste à surveiller, surtout dans un pays où les taux d'intérêt peuvent grimper vite."
        },
        {
          "type": "p",
          "text": "Troisième risque : le real brésilien (BRL). Afya gagne ses revenus en reais, mais l'action se traite en dollars. Si le real se déprécie face au dollar, la valeur de ces bénéfices fond mécaniquement pour un investisseur en dollars, même si l'entreprise se porte très bien sur le terrain. C'est un risque de change que tu subis sans pouvoir le contrôler."
        },
        {
          "type": "h2",
          "text": "Le vrai débat (et le piège)"
        },
        {
          "type": "p",
          "text": "Toute la thèse tient en une question : crois-tu que ces risques brésiliens justifient un prix aussi écrasé, ou que le marché exagère sa peur ? Si tu penses qu'Afya garde son moat réglementaire et sa demande structurelle, l'action est anormalement bon marché. Si tu crois qu'un coup de rabot politique sur les places ou une chute du real peut tout casser, ce prix bas est un piège, pas une aubaine."
        },
        {
          "type": "p",
          "text": "Un P/FCF de 1,1 n'est jamais une bonne affaire en soi : il ne l'est que si la qualité tient et que les risques ne se matérialisent pas tous en même temps. C'est exactement pour ça que je juge la qualité avant le prix, et le prix séparément. Si tu veux comparer Afya à d'autres dossiers décotés mais solides, regarde mon [classement des actions sous-évaluées](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "Comment je lis Afya, sans m'emballer"
        },
        {
          "type": "p",
          "text": "Au fond, Afya a cette double nature qui m'attire : une qualité notée 10 sur 10, et un prix parmi les plus bas que j'aie vus sur une entreprise de ce calibre. On ne voit presque jamais les deux dans la même ligne. Mais cette décote a une raison, et cette raison s'appelle le Brésil. Le prix bas n'est pas un cadeau, c'est le paiement d'un risque pays bien réel."
        },
        {
          "type": "p",
          "text": "Je ne fonce donc pas. Je traite Afya comme ce qu'elle est : une entreprise excellente, à un prix qui ne s'explique que si l'on accepte sa part de risque émergent. Pour creuser, tu trouveras le détail des critères, des comparables et de la valorisation sur la [page d'analyse d'Afya](/analyse/AFYA), et tu peux relire ma [méthodologie complète](/methodologie) pour comprendre comment je sépare qualité et prix."
        },
        {
          "type": "p",
          "text": "Juger si une entreprise est bonne, puis à quel prix l'acheter, séparément, en quelques secondes et pour n'importe quelle action : c'est exactement ce que je voulais pouvoir faire. Alors je l'ai construit."
        }
      ],
      "faq": [
        {
          "q": "Que fait Afya, concrètement ?",
          "a": "Afya est un acteur de l'éducation médicale privée au Brésil. Elle gère des facultés de médecine, où les étudiants paient des frais de scolarité pendant six ans, et des plateformes numériques pour les médecins déjà en exercice (préparation aux concours, formation continue, outils cliniques)."
        },
        {
          "q": "Que veut dire un P/FCF de 1,1 ?",
          "a": "Le P/FCF (price to free cash flow) rapporte le cours de l'action au cash réellement généré chaque année. Un P/FCF de 1,1 signifie que tu paies à peine plus d'une année de ce cash. Plus c'est bas, moins c'est cher. C'est le multiple le plus bas de tout mon palmarès qualité."
        },
        {
          "q": "Pourquoi Afya obtient-elle 10/10 ?",
          "a": "Elle valide mes 10 critères de qualité fondamentale : rentabilité (marge nette 20 %, marge de free cash flow 32 %), croissance des ventes (17 % par an) et du cash (28 % par an), conversion du bénéfice en cash (1,55) et efficacité du capital (Cash ROCE 20 %). Ma note juge le business seul, pas le prix."
        },
        {
          "q": "Quels sont les risques d'Afya ?",
          "a": "Trois principalement : la régulation brésilienne du nombre de places en médecine (programme Mais Médicos), qui peut se retourner contre elle ; la dette liée à ses acquisitions (environ 1,7 année de free cash flow) ; et l'exposition au real brésilien, qui peut faire fondre la valeur des bénéfices pour un investisseur en dollars."
        },
        {
          "q": "Un P/FCF aussi bas, est-ce une bonne affaire ?",
          "a": "Pas automatiquement. Un prix très bas peut rémunérer un risque réel, ici le risque pays brésilien. Il n'est intéressant que si la qualité tient et que les risques ne se matérialisent pas tous ensemble. Ceci n'est pas un conseil en investissement, fais tes propres recherches."
        }
      ],
      "tags": [
        "Analyse",
        "Afya",
        "Brésil"
      ],
      "disclaimer": "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres à la date de publication, susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "Afya Limited (AFYA) : 10/10 quality, dirt cheap",
      "excerpt": "A company that trains Brazil's doctors, rated 10/10, trading at barely more than one year of the cash it generates. Here is why Afya meets all my criteria, and where the catch hides.",
      "metaDescription": "Afya Limited (AFYA) explained simply: what this Brazilian medical education player does, its regulatory moat, its risks, and its 10/10 quality score.",
      "answer": "Afya trains Brazil's doctors, a trade protected by licenses that are nearly impossible to obtain. The company meets my 10 quality criteria, grows its cash 28% a year, and trades at barely more than one year of that cash. Quality this rare is unusual. The price even more so. Here is how I read it.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Afya trains Brazil's future doctors: medical schools, plus platforms for physicians already in practice.",
            "It meets 10 of my 10 quality criteria, with a free cash flow margin of 32% and a Cash ROCE of 20%.",
            "Its cash per share climbs 28% a year, and revenue 17% a year: real, tangible growth.",
            "The price defies logic: 1.1 times its free cash flow, the lowest in my entire quality ranking. You pay barely more than one year of cash.",
            "The flip side: this is Brazil. Regulation of student seats, acquisition debt, and a real that can swing. The low price is not free."
          ]
        },
        {
          "type": "h2",
          "text": "The company that makes Brazil's doctors"
        },
        {
          "type": "p",
          "text": "The first time I saw Afya's price in my data, I checked twice. A company that ticks all my quality boxes and trades at barely more than one year of cash almost never happens. So I wanted to understand what was hiding behind it."
        },
        {
          "type": "p",
          "text": "Afya is private medical education in Brazil. Two businesses, really. On one side, medical schools: the company trains students for six years, who pay tuition year after year. On the other, digital platforms for doctors already qualified: exam prep, continuing education, clinical decision tools. In short, it walks a Brazilian doctor from the first day of school to the end of their career."
        },
        {
          "type": "p",
          "text": "That positioning has a rare virtue. In Brazil, opening a medical school is not an entrepreneur's choice, it is a permit the state grants very sparingly. Licenses are scarce, tightly controlled, and a new rival cannot simply decide to launch. Afya spent years acquiring and running these permits. That is exactly the kind of barrier I look for."
        },
        {
          "type": "h2",
          "text": "Is it a good company? (quality)"
        },
        {
          "type": "p",
          "text": "I never rate a company on gut feeling. I run it through 10 fundamental quality criteria: is it truly profitable, are its sales and cash growing, does it turn profit into real cash, is its debt manageable, does it use capital efficiently? A company that meets them all scores 10 out of 10. That is rare by design. Afya gets there."
        },
        {
          "type": "p",
          "text": "One number is enough to feel the machine: its free cash flow margin reaches 32%. Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, buildings, taxes, investments). A 32% margin means that out of every 100 reais of sales, 32 end up as genuinely available cash. Most companies top out near 10. Its net margin, accounting profit relative to sales, comes in at 20%."
        },
        {
          "type": "p",
          "text": "The growth is there too. Revenue rises 17% a year, and cash per share 28% a year. That gap is no accident: when cash per share climbs faster than sales, the company is gaining efficiency and not diluting its shareholders by issuing shares left and right. That is the kind of detail that separates healthy growth from inflated growth."
        },
        {
          "type": "h2",
          "text": "Afya's real treasure: its moat"
        },
        {
          "type": "p",
          "text": "A clean balance sheet never convinces me on its own. What I look for is the moat: the competitive ditch, what stops a rival from taking the spot. The word comes from a castle's moat. The wider the ditch, the harder the fortress is to attack."
        },
        {
          "type": "p",
          "text": "At Afya, the moat rests first on regulatory barriers. Medical school licenses are scarce and tightly controlled by the Brazilian state. A competitor cannot decide overnight to open a school against it: it needs a permit nobody hands out easily. That scarcity protects Afya's positions far better than a brand or a patent would."
        },
        {
          "type": "p",
          "text": "The second pillar is recurring revenue. A medical student commits for six years and pays tuition year after year. Once enrolled, they do not switch schools midway. So Afya knows a large share of its revenue years in advance. It is the predictability of a subscription, applied to a degree."
        },
        {
          "type": "p",
          "text": "The third pillar is structural: Brazil is short of doctors, and demand for training does not fade. As long as the country seeks to care for its population better, the need for trained students remains. This engine does not depend on a fad or an economic cycle, it is anchored in demographics."
        },
        {
          "type": "p",
          "text": "On return on capital, this moat shows up in a number I always check: Cash ROCE reaches 20%. This measure answers a simple question: for every real put into the business, how much cash does it spit back each year? Here, 20 cents per real per year. That is double the threshold I consider decent, and a sign that capital truly works."
        },
        {
          "type": "h2",
          "text": "What exactly is my 10/10 score?"
        },
        {
          "type": "p",
          "text": "My quality score says nothing about the stock price. It judges the business alone. Afya meets my 10 criteria: profitability, growth in sales and cash, conversion of profit into cash, balance sheet strength, capital efficiency. Very few companies reach this score, and you will find the full list in my [ranking of companies rated 10 out of 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "One detail speaks volumes about the honesty of the accounts: the profit-to-cash conversion comes in at 1.55. In other words, the cash generated exceeds accounting profit by half. A company that turns its profits into genuinely real money, and then some, is not dressing up its results. That is exactly what I want to see, because accounting profit is easier to manipulate than cash."
        },
        {
          "type": "h2",
          "text": "Quality first, price second (and separately)"
        },
        {
          "type": "p",
          "text": "Here is the rule I never break: I separate two questions most people confuse. One: is this a good company? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. On Afya, the first question is settled. The second remains."
        },
        {
          "type": "p",
          "text": "To measure price, I look at the P/FCF (price to free cash flow): the share price divided by the cash the company truly generates each year. A P/FCF of 1.1 means that at the current pace, you pay barely more than one year of that cash. The lower it is, the cheaper it is. Afya trades at 1.1 times its free cash flow. That is the lowest multiple in my entire quality ranking, and most solid companies trade ten to twenty times higher."
        },
        {
          "type": "p",
          "text": "To make sure this is not a momentary mirage, I also look at where this price sits in the stock's own history. Today, Afya trades at the 29th percentile of its own past valuation. Plainly: 71% of the time over the last five years, the stock traded more expensive than today. It is not an absolute low, but it sits clearly in the bottom of its usual range. The stock is worth about 14.69 dollars."
        },
        {
          "type": "h2",
          "text": "Why does the market dump such a fine machine?"
        },
        {
          "type": "p",
          "text": "Because the market does not pay for a company, it pays for a story, and Afya's story worries on three points. This is Brazil, and a price this low never falls from the sky: it pays for a risk others refuse to take. Let us be honest about those risks."
        },
        {
          "type": "p",
          "text": "First risk: regulation of student seats. In Brazil, the state decides how many future doctors can be trained, through programs like Mais Medicos. A political decision can widen or freeze the number of medical school seats. So the same regulatory barrier that protects Afya can also turn against it if the government changes course. That is the double-edged sword of any regulated business."
        },
        {
          "type": "p",
          "text": "Second risk: acquisition debt. Afya grew by buying schools, and that leaves loans on the balance sheet. Its net debt represents about 1.7 years of free cash flow. In plain terms, the company could repay all its net debt in under two years of cash. That is a level I consider reasonable, but it is a line to watch, especially in a country where interest rates can climb fast."
        },
        {
          "type": "p",
          "text": "Third risk: the Brazilian real (BRL). Afya earns its revenue in reais, but the stock trades in dollars. If the real weakens against the dollar, the value of those earnings mechanically melts for a dollar investor, even if the company does great on the ground. It is a currency risk you bear without being able to control it."
        },
        {
          "type": "h2",
          "text": "The real debate (and the trap)"
        },
        {
          "type": "p",
          "text": "The whole thesis comes down to one question: do you believe these Brazilian risks justify such a crushed price, or that the market is overdoing its fear? If you think Afya keeps its regulatory moat and structural demand, the stock is abnormally cheap. If you believe a political cut to seats or a fall in the real could break everything, this low price is a trap, not a windfall."
        },
        {
          "type": "p",
          "text": "A P/FCF of 1.1 is never a bargain in itself: it only is if the quality holds and the risks do not all materialize at once. That is exactly why I judge quality before price, and price separately. If you want to compare Afya with other discounted but solid cases, look at my [ranking of undervalued stocks](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "How I read Afya, without getting carried away"
        },
        {
          "type": "p",
          "text": "Deep down, Afya has the double nature that draws me in: a quality rated 10 out of 10, and a price among the lowest I have ever seen on a company of this caliber. You almost never see both in the same line. But this discount has a reason, and that reason is called Brazil. The low price is not a gift, it is the payment for a very real country risk."
        },
        {
          "type": "p",
          "text": "So I do not rush in. I treat Afya as what it is: an excellent company, at a price that only makes sense if you accept its share of emerging-market risk. To dig deeper, you will find the detail of the criteria, the comparables and the valuation on the [Afya analysis page](/analyse/AFYA), and you can revisit my [full methodology](/methodologie) to understand how I separate quality from price."
        },
        {
          "type": "p",
          "text": "Judging whether a company is good, then at what price to buy it, separately, in a few seconds and for any stock: that is exactly what I wanted to be able to do. So I built it."
        }
      ],
      "faq": [
        {
          "q": "What does Afya actually do?",
          "a": "Afya is a private medical education player in Brazil. It runs medical schools, where students pay tuition for six years, and digital platforms for doctors already in practice (exam prep, continuing education, clinical tools)."
        },
        {
          "q": "What does a P/FCF of 1.1 mean?",
          "a": "The P/FCF (price to free cash flow) divides the share price by the cash truly generated each year. A P/FCF of 1.1 means you pay barely more than one year of that cash. The lower it is, the cheaper it is. It is the lowest multiple in my entire quality ranking."
        },
        {
          "q": "Why does Afya score 10/10?",
          "a": "It meets my 10 fundamental quality criteria: profitability (net margin 20%, free cash flow margin 32%), growth in sales (17% a year) and cash (28% a year), profit-to-cash conversion (1.55) and capital efficiency (Cash ROCE 20%). My score judges the business alone, not the price."
        },
        {
          "q": "What are Afya's risks?",
          "a": "Three mainly: Brazilian regulation of medical school seats (the Mais Medicos program), which can turn against it; debt tied to its acquisitions (about 1.7 years of free cash flow); and exposure to the Brazilian real, which can melt the value of earnings for a dollar investor."
        },
        {
          "q": "Is a P/FCF this low a bargain?",
          "a": "Not automatically. A very low price can pay for a real risk, here Brazilian country risk. It is only attractive if the quality holds and the risks do not all materialize together. This is not investment advice, do your own research."
        }
      ],
      "tags": [
        "Analysis",
        "Afya",
        "Brazil"
      ],
      "disclaimer": "This article is an analysis for informational and educational purposes, and does not constitute personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date, subject to change. Do your own research."
    },
    "es": {
      "title": "Afya Limited (AFYA) : calidad 10/10 muy barata",
      "excerpt": "Una empresa que forma a los médicos de Brasil, calificada 10/10, que cotiza a apenas algo más de un año de la caja que genera. Aquí explico por qué Afya cumple todos mis criterios, y dónde se esconde la trampa.",
      "metaDescription": "Afya Limited (AFYA) explicado simple: qué hace este actor de la educación médica en Brasil, su foso regulatorio, sus riesgos y su calificación de calidad 10/10.",
      "answer": "Afya forma a los médicos de Brasil, un oficio protegido por licencias casi imposibles de obtener. La empresa cumple mis 10 criterios de calidad, hace crecer su caja un 28 % al año y cotiza a apenas algo más de un año de esa caja. La calidad es rara, el precio aún más. Así leo este caso.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Afya forma a los futuros médicos brasileños: facultades de medicina, más plataformas para los profesionales ya en ejercicio.",
            "Cumple 10 de mis 10 criterios de calidad, con un margen de flujo de caja libre del 32 % y un Cash ROCE del 20 %.",
            "Su caja por acción sube un 28 % al año, y la facturación un 17 % al año: un crecimiento bien real.",
            "El precio desafía la lógica: 1,1 veces su flujo de caja libre, el más bajo de todo mi ranking de calidad. Pagas apenas algo más de un año de caja.",
            "El reverso: es Brasil. Regulación de las plazas, deuda de adquisiciones, y un real que puede dar tumbos. El precio bajo no es gratis."
          ]
        },
        {
          "type": "h2",
          "text": "La empresa que fabrica a los médicos de Brasil"
        },
        {
          "type": "p",
          "text": "La primera vez que vi el precio de Afya en mis datos, lo comprobé dos veces. Una empresa que cumple todos mis criterios de calidad y que cotiza a apenas algo más de un año de caja casi nunca ocurre. Así que quise entender qué se escondía detrás."
        },
        {
          "type": "p",
          "text": "Afya es la educación médica privada en Brasil. Dos actividades, en realidad. Por un lado, facultades de medicina: la empresa forma a estudiantes durante seis años, que pagan matrícula año tras año. Por otro, plataformas digitales para médicos ya titulados: preparación de oposiciones, formación continua, herramientas de apoyo a la decisión clínica. En resumen, acompaña a un médico brasileño desde el primer día de carrera hasta el final de su trayectoria."
        },
        {
          "type": "p",
          "text": "Ese posicionamiento tiene una virtud rara. En Brasil, abrir una facultad de medicina no es una decisión de emprendedor, es una autorización que el Estado concede con cuentagotas. Las licencias son escasas, muy reguladas, y un nuevo competidor no puede simplemente decidir lanzarse. Afya pasó años adquiriendo y explotando esas autorizaciones. Es exactamente el tipo de barrera que me interesa."
        },
        {
          "type": "h2",
          "text": "¿Es una buena empresa? (la calidad)"
        },
        {
          "type": "p",
          "text": "Nunca califico una empresa por intuición. La paso por un tamiz de 10 criterios de calidad fundamental: ¿es de verdad rentable, crecen sus ventas y su caja, convierte su beneficio en caja real, es manejable su deuda, usa el capital con eficiencia? Una empresa que los cumple todos obtiene 10 sobre 10. Es raro, por diseño. Afya lo consigue."
        },
        {
          "type": "p",
          "text": "Un dato basta para intuir la máquina: su margen de flujo de caja libre llega al 32 %. El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, locales, impuestos, inversiones). Un margen del 32 % significa que de cada 100 reales de ventas, 32 acaban en caja realmente disponible. La mayoría de las empresas no pasan del 10. Su margen neto, el beneficio contable respecto a las ventas, es del 20 %."
        },
        {
          "type": "p",
          "text": "El crecimiento también está. La facturación sube un 17 % al año, y la caja por acción un 28 % al año. Esa diferencia no es casual: cuando la caja por acción sube más rápido que las ventas, la empresa gana eficiencia y no diluye a sus accionistas emitiendo acciones a destajo. Es el tipo de detalle que distingue un crecimiento sano de uno inflado."
        },
        {
          "type": "h2",
          "text": "El verdadero tesoro de Afya: su foso"
        },
        {
          "type": "p",
          "text": "Un buen balance nunca me convence por sí solo. Lo que busco es el foso: la trinchera competitiva, lo que impide a un rival ocupar el lugar. La palabra viene del foso de un castillo. Cuanto más ancha la zanja, más difícil de atacar es la fortaleza."
        },
        {
          "type": "p",
          "text": "En Afya, el foso descansa primero en las barreras regulatorias. Las licencias de facultades de medicina son escasas y están estrictamente controladas por el Estado brasileño. Un competidor no puede decidir de la noche a la mañana abrir una facultad frente a ella: necesita una autorización que nadie reparte fácilmente. Esa escasez protege las posiciones de Afya mucho mejor de lo que lo haría una marca o una patente."
        },
        {
          "type": "p",
          "text": "El segundo pilar son los ingresos recurrentes. Un estudiante de medicina se compromete por seis años y paga su matrícula año tras año. Una vez matriculado, no cambia de escuela a mitad de camino. Así, Afya conoce buena parte de sus ingresos con años de antelación. Es la previsibilidad de una suscripción, aplicada a un título."
        },
        {
          "type": "p",
          "text": "El tercer pilar es estructural: Brasil tiene escasez de médicos, y la demanda de formación no se debilita. Mientras el país busque cuidar mejor a su población, la necesidad de estudiantes formados se mantiene. Este motor no depende de una moda ni de un ciclo económico, está anclado en la demografía."
        },
        {
          "type": "p",
          "text": "En cuanto a la rentabilidad del capital, este foso se lee en un dato que siempre miro: el Cash ROCE llega al 20 %. Esta medida responde a una pregunta sencilla: por cada real puesto en el negocio, ¿cuánta caja devuelve cada año? Aquí, 20 céntimos por real y por año. Es el doble del umbral que considero correcto, y la señal de que el capital trabaja de verdad."
        },
        {
          "type": "h2",
          "text": "¿Qué es exactamente mi calificación 10/10?"
        },
        {
          "type": "p",
          "text": "Mi calificación de calidad no dice nada del precio de la acción. Juzga el negocio solo. Afya cumple mis 10 criterios: rentabilidad, crecimiento de ventas y caja, conversión del beneficio en caja, solidez del balance, eficiencia del capital. Muy pocas empresas alcanzan esta nota, y encontrarás la lista completa en mi [ranking de empresas calificadas 10 sobre 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "Un detalle dice mucho sobre la honestidad de las cuentas: la conversión del beneficio en caja es de 1,55. Dicho de otro modo, la caja generada supera en la mitad al beneficio contable. Una empresa que convierte sus beneficios en dinero bien real, e incluso más, no maquilla sus resultados. Es justo lo que quiero ver, porque el beneficio contable se manipula con más facilidad que la caja."
        },
        {
          "type": "h2",
          "text": "Primero la calidad, después el precio (y por separado)"
        },
        {
          "type": "p",
          "text": "Esta es la regla que nunca rompo: separo dos preguntas que la mayoría confunde. Una: ¿es una buena empresa? Dos, completamente aparte: ¿es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. En Afya, la primera pregunta está zanjada. Queda la segunda."
        },
        {
          "type": "p",
          "text": "Para medir el precio, miro el P/FCF (price to free cash flow): el precio de la acción respecto a la caja que la empresa genera de verdad cada año. Un P/FCF de 1,1 significa que, al ritmo actual, pagas apenas algo más de un año de esa caja. Cuanto más bajo, más barato. Afya cotiza a 1,1 veces su flujo de caja libre. Es el múltiplo más bajo de todo mi ranking de calidad, y la mayoría de empresas sólidas cotizan de diez a veinte veces más."
        },
        {
          "type": "p",
          "text": "Para asegurarme de que no es un espejismo del momento, también miro dónde se sitúa este precio en la historia de la acción. Hoy, Afya cotiza en el percentil 29 de su propia valoración pasada. En claro: el 71 % del tiempo, en los últimos cinco años, la acción se pagó más cara que hoy. No es un mínimo absoluto, pero está claramente en la parte baja de su rango habitual. La acción vale unos 14,69 dólares."
        },
        {
          "type": "h2",
          "text": "¿Por qué el mercado malvende una máquina tan buena?"
        },
        {
          "type": "p",
          "text": "Porque el mercado no paga por una empresa, paga por una historia, y la historia de Afya inquieta en tres puntos. Es Brasil, y un precio tan bajo nunca cae del cielo: remunera un riesgo que otros rechazan asumir. Seamos honestos con esos riesgos."
        },
        {
          "type": "p",
          "text": "Primer riesgo: la regulación de las plazas. En Brasil, es el Estado quien decide cuántos futuros médicos pueden formarse, a través de programas como Mais Medicos. Una decisión política puede ampliar o congelar el número de plazas en facultades. Así, la misma barrera regulatoria que protege a Afya también puede volverse en su contra si el gobierno cambia de rumbo. Es la espada de doble filo de toda actividad regulada."
        },
        {
          "type": "p",
          "text": "Segundo riesgo: la deuda ligada a las adquisiciones. Afya creció comprando facultades, y eso deja préstamos en el balance. Su deuda neta representa unos 1,7 años de flujo de caja libre. En concreto, la empresa podría devolver toda su deuda neta en menos de dos años de caja. Es un nivel que considero razonable, pero es una partida a vigilar, sobre todo en un país donde los tipos de interés pueden subir rápido."
        },
        {
          "type": "p",
          "text": "Tercer riesgo: el real brasileño (BRL). Afya gana sus ingresos en reales, pero la acción cotiza en dólares. Si el real se debilita frente al dólar, el valor de esos beneficios se funde mecánicamente para un inversor en dólares, aunque la empresa vaya muy bien sobre el terreno. Es un riesgo de cambio que sufres sin poder controlarlo."
        },
        {
          "type": "h2",
          "text": "El verdadero debate (y la trampa)"
        },
        {
          "type": "p",
          "text": "Toda la tesis se reduce a una pregunta: ¿crees que estos riesgos brasileños justifican un precio tan aplastado, o que el mercado exagera su miedo? Si piensas que Afya conserva su foso regulatorio y su demanda estructural, la acción está anormalmente barata. Si crees que un recorte político de las plazas o una caída del real pueden romperlo todo, ese precio bajo es una trampa, no un chollo."
        },
        {
          "type": "p",
          "text": "Un P/FCF de 1,1 nunca es una ganga en sí mismo: solo lo es si la calidad aguanta y los riesgos no se materializan todos a la vez. Por eso justamente juzgo la calidad antes que el precio, y el precio por separado. Si quieres comparar Afya con otros casos con descuento pero sólidos, mira mi [ranking de acciones infravaloradas](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "Cómo leo Afya, sin emocionarme"
        },
        {
          "type": "p",
          "text": "En el fondo, Afya tiene esa doble naturaleza que me atrae: una calidad calificada 10 sobre 10, y un precio entre los más bajos que he visto en una empresa de este calibre. Casi nunca se ven los dos en la misma línea. Pero este descuento tiene una razón, y esa razón se llama Brasil. El precio bajo no es un regalo, es el pago de un riesgo país bien real."
        },
        {
          "type": "p",
          "text": "Así que no me lanzo. Trato a Afya como lo que es: una empresa excelente, a un precio que solo se explica si se acepta su parte de riesgo emergente. Para profundizar, encontrarás el detalle de los criterios, los comparables y la valoración en la [página de análisis de Afya](/analyse/AFYA), y puedes releer mi [metodología completa](/methodologie) para entender cómo separo calidad y precio."
        },
        {
          "type": "p",
          "text": "Juzgar si una empresa es buena, y luego a qué precio comprarla, por separado, en unos segundos y para cualquier acción: es justo lo que quería poder hacer. Así que lo construí."
        }
      ],
      "faq": [
        {
          "q": "¿Qué hace Afya, en concreto?",
          "a": "Afya es un actor de la educación médica privada en Brasil. Gestiona facultades de medicina, donde los estudiantes pagan matrícula durante seis años, y plataformas digitales para médicos ya en ejercicio (preparación de oposiciones, formación continua, herramientas clínicas)."
        },
        {
          "q": "¿Qué significa un P/FCF de 1,1?",
          "a": "El P/FCF (price to free cash flow) relaciona el precio de la acción con la caja realmente generada cada año. Un P/FCF de 1,1 significa que pagas apenas algo más de un año de esa caja. Cuanto más bajo, más barato. Es el múltiplo más bajo de todo mi ranking de calidad."
        },
        {
          "q": "¿Por qué Afya obtiene 10/10?",
          "a": "Cumple mis 10 criterios de calidad fundamental: rentabilidad (margen neto 20 %, margen de flujo de caja libre 32 %), crecimiento de ventas (17 % al año) y de caja (28 % al año), conversión del beneficio en caja (1,55) y eficiencia del capital (Cash ROCE 20 %). Mi calificación juzga el negocio solo, no el precio."
        },
        {
          "q": "¿Cuáles son los riesgos de Afya?",
          "a": "Tres principalmente: la regulación brasileña del número de plazas de medicina (programa Mais Medicos), que puede volverse en su contra; la deuda ligada a sus adquisiciones (unos 1,7 años de flujo de caja libre); y la exposición al real brasileño, que puede fundir el valor de los beneficios para un inversor en dólares."
        },
        {
          "q": "¿Un P/FCF tan bajo es una ganga?",
          "a": "No automáticamente. Un precio muy bajo puede remunerar un riesgo real, aquí el riesgo país brasileño. Solo es interesante si la calidad aguanta y los riesgos no se materializan todos juntos. Esto no es asesoramiento de inversión, haz tu propia investigación."
        }
      ],
      "tags": [
        "Análisis",
        "Afya",
        "Brasil"
      ],
      "disclaimer": "Este artículo es un análisis con fines informativos y educativos, y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a la fecha de publicación, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const rnr: Article = {
  "slug": "renaissancere-rnr-reassurance-10-10",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 11,
  "ticker": "RNR",
  "content": {
    "fr": {
      "title": "RenaissanceRe Holdings (RNR) : qualité bradée",
      "excerpt": "Un réassureur d'élite, noté 10 sur 10, qui se paie aujourd'hui parmi les prix les plus bas de toute son histoire. Voici pourquoi RenaissanceRe coche mes critères de qualité, et le piège que cache son métier.",
      "metaDescription": "RenaissanceRe Holdings (RNR) expliqué simplement : ce que fait ce réassureur des Bermudes, son moat, ses risques, et pourquoi il obtient ma note 10 sur 10.",
      "answer": "RenaissanceRe est un réassureur des Bermudes d'élite : il assure les assureurs contre les grandes catastrophes, avec une discipline de souscription réputée. Il valide mes 10 critères de qualité et obtient 10 sur 10. Et il se paie aujourd'hui parmi les prix les plus bas de toute son histoire. La qualité est rare, ce prix aussi.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Ce que fait RenaissanceRe : il réassure les autres assureurs contre les grandes catastrophes naturelles, depuis les Bermudes, depuis 1993.",
            "Pourquoi c'est rare : il décroche ma note de 10 sur 10, le maximum, que très peu d'entreprises atteignent.",
            "Le moteur : une discipline de souscription réputée, des modèles de risque propriétaires, et un capital déployé au bon moment du cycle.",
            "La rentabilité : 36 % de son chiffre d'affaires finit en cash réellement disponible, et ce cash grandit de 32 % par an.",
            "Le prix : son cash ne s'est quasiment jamais payé aussi peu cher dans son histoire. Mais ses résultats sont volatils par nature, et c'est tout le sujet."
          ]
        },
        {
          "type": "h2",
          "text": "L'assureur des assureurs"
        },
        {
          "type": "p",
          "text": "On connaît les assureurs : ils couvrent ta voiture, ta maison, ton entreprise. Mais qui couvre les assureurs eux-mêmes ? Quand un ouragan ravage la Floride, l'assureur local ne peut pas tout payer seul. Il a, en amont, transféré une partie de son risque à plus gros que lui. Ce plus gros, c'est un réassureur. RenaissanceRe est l'un des meilleurs au monde à ce jeu."
        },
        {
          "type": "p",
          "text": "Fondé en 1993 et basé aux Bermudes, ce petit caillou de l'Atlantique devenu capitale mondiale de la réassurance, RenaissanceRe s'est spécialisé dans le risque que presque personne ne veut porter : la catastrophe naturelle. Ouragans, tremblements de terre, inondations. Des risques rares, énormes quand ils frappent, et terriblement difficiles à évaluer. C'est précisément là que se cache l'argent, pour qui sait calculer mieux que les autres."
        },
        {
          "type": "p",
          "text": "Et c'est exactement le pari de la maison : être le meilleur pour mettre un juste prix sur l'imprévisible. Celui qui se trompe en tarifant un ouragan se fait laminer quand il frappe. Celui qui calcule juste encaisse une prime grasse pour un risque qu'il a correctement mesuré. RenaissanceRe a bâti toute son histoire là-dessus."
        },
        {
          "type": "h2",
          "text": "Comment un réassureur gagne de l'argent (et pourquoi celui-ci est doué)"
        },
        {
          "type": "p",
          "text": "Un détour utile, parce que ce métier se juge avec un thermomètre à lui. Un réassureur encaisse des primes aujourd'hui et paiera d'éventuels sinistres plus tard, parfois beaucoup plus tard. Entre les deux, deux choses comptent vraiment."
        },
        {
          "type": "p",
          "text": "D'abord, la discipline de souscription. Souscrire, c'est l'acte de décider quel risque on accepte et à quel prix. Un réassureur indiscipliné court après le volume, accepte des risques mal tarifés, et finit lessivé à la première grosse catastrophe. RenaissanceRe, lui, est réputé pour dire non quand les prix sont trop bas, et pour charger fort quand le marché lui donne raison. Cette retenue est rare dans un secteur où la tentation de grossir vite est permanente."
        },
        {
          "type": "p",
          "text": "Ensuite, ses modèles de risque propriétaires. Pour tarifer un ouragan, il faut estimer la probabilité qu'il frappe et le montant qu'il coûtera. RenaissanceRe a construit, au fil des décennies, ses propres outils de modélisation des catastrophes. C'est un savoir-faire que l'argent seul n'achète pas : il faut des années de données et d'expérience pour calibrer ces modèles. Cet avantage explique pourquoi l'entreprise gagne de l'argent là où d'autres se brûlent."
        },
        {
          "type": "p",
          "text": "Le résultat se voit dans un chiffre qui m'a fait tiquer : sa marge de free cash flow atteint 36 %. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, sinistres, impôts). Une marge de 36 %, ça veut dire que sur 100 dollars de chiffre d'affaires, 36 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10. Sa marge nette, elle, ressort à 24 %."
        },
        {
          "type": "h2",
          "text": "Le vrai trésor : un moat qui se déploie au bon moment"
        },
        {
          "type": "p",
          "text": "Un bon bilan ne suffit jamais à me convaincre. Ce que je cherche, c'est le moat : le fossé concurrentiel, ce qui empêche un rival mieux financé de venir prendre la place. Le moat, c'est l'image d'un château entouré de douves : plus elles sont larges, plus l'attaquant peine. Chez RenaissanceRe, ce fossé tient en trois éléments."
        },
        {
          "type": "p",
          "text": "D'abord la réputation de souscription, qui lui amène les meilleurs dossiers aux meilleures conditions. Ensuite les modèles propriétaires, qui lui permettent de tarifer mieux. Et enfin, le plus subtil : le sens du timing. En réassurance, les prix montent fortement après les grosses catastrophes, parce que beaucoup d'acteurs ont été touchés et que la capacité à couvrir le risque devient rare. C'est ce qu'on appelle un marché dur. RenaissanceRe sait garder du capital de côté pour le déployer massivement à ces moments-là, quand assurer rapporte le plus."
        },
        {
          "type": "p",
          "text": "Côté chiffres, ce moat se traduit par deux mesures que je regarde toujours. La croissance d'abord : le chiffre d'affaires progresse de 28 % par an, et le cash par action de 32 % par an. Le rendement du capital ensuite : le Cash ROCE atteint 31 %. Cette mesure répond à une question simple : pour chaque dollar mis dans le business, combien de cash il recrache chaque année ? Ici, 31 cents par dollar et par an. C'est environ deux fois le seuil que je considère comme excellent."
        },
        {
          "type": "h2",
          "text": "Qu'est-ce que ma note de 10 sur 10, au juste ?"
        },
        {
          "type": "p",
          "text": "Je ne note pas une entreprise à l'intuition. Je la passe au crible de 10 critères de qualité fondamentale, concrets : est-elle vraiment rentable, ses ventes et son cash augmentent-ils, transforme-t-elle son bénéfice comptable en cash réel, sa dette est-elle maîtrisée, rend-elle de l'argent à ses actionnaires sans gaspiller ? Une entreprise qui valide tout obtient 10 sur 10. C'est rare, par construction. RenaissanceRe y parvient."
        },
        {
          "type": "p",
          "text": "Deux points le résument. Le premier : sa dette. Son ratio de dette nette sur free cash flow ressort à 0,18, autrement dit quasiment aucune dette nette : sa trésorerie couvre presque l'intégralité de ses emprunts. En clair, elle pourrait à peu près tout rembourser demain matin. C'est exactement le genre de coussin qui permet de traverser une mauvaise année de catastrophes sans paniquer, et c'est vital dans ce métier."
        },
        {
          "type": "p",
          "text": "Le second : le taux de conversion du bénéfice en cash ressort à 1,51. Ça veut dire que le cash généré dépasse de moitié le bénéfice comptable. Une entreprise qui transforme ses profits en argent bien réel, et même davantage, ne maquille pas ses comptes. Pour mémoire, la note de 10 sur 10 mesure la qualité du business seule. Le prix de l'action, lui, est une tout autre question, et je le juge séparément."
        },
        {
          "type": "h2",
          "text": "La qualité d'abord, le prix ensuite (et séparément)"
        },
        {
          "type": "p",
          "text": "Voici la règle que je n'enfreins jamais : je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Sur RenaissanceRe, la première question est tranchée. Reste la seconde."
        },
        {
          "type": "p",
          "text": "Pour mesurer le prix, je regarde le P/FCF (price to free cash flow) : le cours de l'action rapporté au cash que l'entreprise génère vraiment chaque année. Un P/FCF de 3, ça veut dire qu'au rythme actuel, tu paies à peine plus de trois années de ce cash. Plus c'est bas, moins c'est cher. RenaissanceRe se paie 3,0 fois son free cash flow, à un cours d'environ 295,75 dollars."
        },
        {
          "type": "p",
          "text": "Ce chiffre prend tout son sens quand on le compare à sa propre histoire. Ma veille le classe au percentile 4 de sa valorisation passée. Le percentile, c'est une façon de situer un chiffre dans une série : un percentile 4 signifie que dans 96 % des cas, sur son propre historique, l'action s'est payée plus cher qu'aujourd'hui. Autrement dit, elle n'a quasiment jamais été aussi bon marché. Mon système l'a d'ailleurs signalée comme opportunité du moment."
        },
        {
          "type": "p",
          "text": "Mais attention au piège. Un P/FCF aussi bas dans la réassurance n'est jamais innocent, et il y a une raison technique simple, que j'aborde juste après."
        },
        {
          "type": "h2",
          "text": "Pourquoi le marché paie si peu une si belle machine ?"
        },
        {
          "type": "p",
          "text": "Parce que le marché ne paie pas une entreprise, il paie une histoire, et l'histoire de la réassurance fait peur sur un point : la volatilité. Une année sans grande catastrophe, RenaissanceRe encaisse des primes et paie peu de sinistres : ses profits explosent. Une année avec un ouragan majeur, elle paie des milliards : ses profits s'effondrent, voire deviennent négatifs."
        },
        {
          "type": "p",
          "text": "Or un P/FCF se calcule sur le cash d'une période donnée. Si ce cash a été dopé par une ou deux années calmes, le ratio paraît artificiellement bas. Le marché le sait : il refuse de payer ce cash comme s'il était récurrent et lisse, parce qu'il ne l'est pas. C'est exactement pour ça qu'un réassureur, même excellent, se paie structurellement un multiple plus bas qu'un éditeur de logiciels au cash régulier. Ce P/FCF de 3 n'est donc pas seulement une aubaine : c'est aussi le prix de l'incertitude."
        },
        {
          "type": "h2",
          "text": "Les risques que je n'oublie pas"
        },
        {
          "type": "p",
          "text": "Je serais malhonnête de ne te montrer que la lumière. RenaissanceRe a de vrais trade-offs, et il faut les regarder en face."
        },
        {
          "type": "p",
          "text": "Premier risque, le plus évident : l'exposition aux catastrophes naturelles. Une grosse année d'ouragans peut transformer un exercice brillant en exercice désastreux. C'est dans l'ADN du métier, et aucun modèle ne supprime ce risque, il le mesure seulement. Il faut accepter des résultats en dents de scie d'une année sur l'autre, et juger l'entreprise sur un cycle entier, pas sur un trimestre."
        },
        {
          "type": "p",
          "text": "Deuxième risque : la cyclicité du marché. Les prix de la réassurance montent après les catastrophes, puis redescendent quand le capital afflue de nouveau et que la concurrence revient. Le jour où le marché redeviendra mou, la rentabilité de RenaissanceRe se tassera, et sa croissance avec. Sa progression actuelle n'est pas une rente garantie : c'est en partie une fenêtre de marché."
        },
        {
          "type": "p",
          "text": "Troisième risque, plus discret : la sensibilité aux taux d'intérêt. Comme tout assureur, RenaissanceRe place sa trésorerie en obligations en attendant de payer ses sinistres. Quand les taux bougent, la valeur de ce portefeuille bouge aussi, ce qui peut peser sur ses résultats comptables. Et le quatrième risque, le plus simple : la qualité ne protège jamais du prix. Un P/FCF bas n'est une bonne affaire que si la qualité tient et que le cycle ne se retourne pas trop tôt. C'est exactement pour ça que je juge la qualité avant le prix, et le prix séparément."
        },
        {
          "type": "h2",
          "text": "Comment je lis RenaissanceRe, sans m'emballer"
        },
        {
          "type": "p",
          "text": "Au fond, RenaissanceRe a ce profil que j'aime regarder de près : une qualité maximale, notée 10 sur 10, et un prix parmi les plus bas de sa propre histoire. Mais la réassurance n'est pas l'assurance classique : ses résultats sont volatils par nature, et ce bas multiple reflète en partie cette incertitude. Ce n'est pas une raison pour l'écarter, c'est une raison pour bien comprendre ce qu'on achète."
        },
        {
          "type": "p",
          "text": "Je ne fonce pas pour autant. Je note un prix d'achat raisonnable et je laisse le marché venir à moi plutôt que de courir après lui. Si tu veux creuser, tu trouveras le détail des critères sur la [page d'analyse de RenaissanceRe](/analyse/RNR), un autre dossier proche dans mon [analyse de Kinsale Capital](/analyse/KNSL), et le contexte complet dans mon [classement des entreprises notées 10 sur 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "Juger si une entreprise est bonne, puis à quel prix l'acheter, séparément, en quelques secondes et pour n'importe quelle action : c'est exactement ce que je voulais pouvoir faire. Alors je l'ai construit. Tu peux voir comment dans ma [méthodologie](/methodologie)."
        }
      ],
      "faq": [
        {
          "q": "C'est quoi, la réassurance ?",
          "a": "La réassurance, c'est l'assurance des assureurs. Quand un assureur classique a couvert plus de risques qu'il ne peut en porter seul, il en transfère une partie à un réassureur comme RenaissanceRe, en échange d'une prime. Ça lui permet d'absorber les très grosses pertes, comme un ouragan majeur."
        },
        {
          "q": "Que veut dire un P/FCF de 3,0 ?",
          "a": "Le P/FCF (price to free cash flow) rapporte le cours de l'action au cash réellement généré chaque année. Un P/FCF de 3,0 signifie que tu paies à peine plus de trois années de ce cash, donc un prix très bas. Mais en réassurance, un multiple bas reflète aussi la volatilité des résultats."
        },
        {
          "q": "Pourquoi RenaissanceRe obtient-il 10 sur 10 ?",
          "a": "Il valide mes 10 critères de qualité fondamentale : forte rentabilité (marge de free cash flow de 36 %), croissance soutenue, rendement du capital élevé (Cash ROCE de 31 %) et bilan solide (quasiment aucune dette nette). Ma note de 10 sur 10 mesure la qualité du business seule, indépendamment du prix de l'action."
        },
        {
          "q": "Pourquoi l'action paraît-elle si bon marché ?",
          "a": "Parce que ses résultats sont volatils : une année calme dope son cash et fait paraître le P/FCF artificiellement bas. Le marché refuse de payer ce cash comme s'il était lisse et récurrent, car une grosse catastrophe peut tout changer. Le bas prix est donc en partie le prix de l'incertitude."
        },
        {
          "q": "Quels sont les risques de RenaissanceRe ?",
          "a": "Trois principalement : l'exposition aux catastrophes naturelles, qui rend les résultats volatils d'une année sur l'autre ; la cyclicité du marché de la réassurance ; et la sensibilité aux taux d'intérêt sur son portefeuille obligataire. Ceci n'est pas un conseil en investissement, fais tes propres recherches."
        }
      ],
      "tags": [
        "Analyse",
        "RenaissanceRe",
        "Réassurance"
      ],
      "disclaimer": "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 11 juin 2026, susceptibles d'évoluer. Faites vos propres recherches."
    },
    "en": {
      "title": "RenaissanceRe Holdings (RNR) : quality on sale",
      "excerpt": "An elite reinsurer, scored 10 out of 10, that trades today among the cheapest prices in its entire history. Here is why RenaissanceRe meets my quality criteria, and the trap its business hides.",
      "metaDescription": "RenaissanceRe Holdings (RNR) explained simply: what this Bermuda reinsurer does, its moat, its risks, and why it earns my 10 out of 10 quality score.",
      "answer": "RenaissanceRe is an elite Bermuda reinsurer: it insures the insurers against major catastrophes, with a renowned underwriting discipline. It meets my 10 quality criteria and scores 10 out of 10. And it trades today among the cheapest prices in its entire history. Quality this rare is unusual. So is the price.",
      "body": [
        {
          "type": "ul",
          "items": [
            "What RenaissanceRe does: it reinsures other insurers against major natural catastrophes, from Bermuda, since 1993.",
            "Why it is rare: it earns my score of 10 out of 10, the maximum, which very few companies reach.",
            "The engine: a renowned underwriting discipline, proprietary risk models, and capital deployed at the right point in the cycle.",
            "The profitability: 36% of its revenue ends up as truly available cash, and that cash grows 32% a year.",
            "The price: its cash has almost never been this cheap in its history. But its results are volatile by nature, and that is the whole point."
          ]
        },
        {
          "type": "h2",
          "text": "The insurer of insurers"
        },
        {
          "type": "p",
          "text": "We all know insurers: they cover your car, your home, your business. But who covers the insurers themselves? When a hurricane wrecks Florida, the local insurer cannot pay for everything alone. It has, beforehand, transferred part of its risk to someone bigger. That someone bigger is a reinsurer. RenaissanceRe is one of the best in the world at this game."
        },
        {
          "type": "p",
          "text": "Founded in 1993 and based in Bermuda, that small Atlantic rock turned global capital of reinsurance, RenaissanceRe specialized in the risk almost nobody wants to carry: the natural catastrophe. Hurricanes, earthquakes, floods. Risks that are rare, enormous when they strike, and terribly hard to assess. That is exactly where the money hides, for whoever can calculate better than the others."
        },
        {
          "type": "p",
          "text": "And that is precisely the firm's bet: being the best at putting a fair price on the unpredictable. Whoever gets a hurricane wrong gets crushed when it hits. Whoever calculates right collects a fat premium for a risk it measured correctly. RenaissanceRe built its whole story on that."
        },
        {
          "type": "h2",
          "text": "How a reinsurer makes money (and why this one is good at it)"
        },
        {
          "type": "p",
          "text": "A useful detour, because this business is judged with its own thermometer. A reinsurer collects premiums today and will pay possible claims later, sometimes much later. In between, two things really matter."
        },
        {
          "type": "p",
          "text": "First, underwriting discipline. Underwriting is the act of deciding which risk you accept and at what price. An undisciplined reinsurer chases volume, accepts mispriced risks, and ends up wiped out at the first big catastrophe. RenaissanceRe is known for saying no when prices are too low, and for charging hard when the market proves it right. That restraint is rare in a sector where the temptation to grow fast is constant."
        },
        {
          "type": "p",
          "text": "Second, its proprietary risk models. To price a hurricane, you have to estimate the odds it strikes and the amount it will cost. RenaissanceRe has built, over decades, its own catastrophe-modeling tools. That know-how money alone cannot buy: it takes years of data and experience to calibrate those models. This edge explains why the company makes money where others get burned."
        },
        {
          "type": "p",
          "text": "The result shows in a number that made me pause: its free cash flow margin reaches 36%. Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, claims, taxes). A 36% margin means that out of every 100 dollars of revenue, 36 end up as genuinely available cash. Most companies top out near 10. Its net margin comes in at 24%."
        },
        {
          "type": "h2",
          "text": "The real treasure: a moat that deploys at the right moment"
        },
        {
          "type": "p",
          "text": "A clean balance sheet is never enough to convince me. What I look for is the moat: the competitive trench, what stops a better-funded rival from taking the spot. A moat is the image of a castle ringed by a ditch: the wider it is, the harder the attacker struggles. At RenaissanceRe, that ditch rests on three things."
        },
        {
          "type": "p",
          "text": "First, the underwriting reputation, which brings it the best deals on the best terms. Second, the proprietary models, which let it price better. And third, the most subtle: a sense of timing. In reinsurance, prices rise sharply after major catastrophes, because many players were hit and the capacity to cover risk becomes scarce. That is what people call a hard market. RenaissanceRe knows how to keep capital aside to deploy it massively at those moments, when insuring pays the most."
        },
        {
          "type": "p",
          "text": "In numbers, this moat shows up in two measures I always check. Growth first: revenue rises 28% a year, and cash per share 32% a year. Return on capital next: Cash ROCE reaches 31%. This measure answers a simple question: for every dollar put into the business, how much cash does it spit back each year? Here, 31 cents per dollar per year. That is roughly twice the threshold I consider excellent."
        },
        {
          "type": "h2",
          "text": "What exactly is my 10 out of 10 score?"
        },
        {
          "type": "p",
          "text": "I do not score a company on a hunch. I run it through 10 fundamental quality criteria, concrete ones: is it genuinely profitable, are its sales and cash growing, does it turn accounting profit into real cash, is its debt under control, does it return money to shareholders without wasting it? A company that passes everything gets 10 out of 10. That is rare by design. RenaissanceRe gets there."
        },
        {
          "type": "p",
          "text": "Two points sum it up. First, its debt. Its net-debt-to-free-cash-flow ratio comes in at 0.18, in other words almost no net debt: its cash covers nearly all of its borrowings. In plain terms, it could pay roughly everything off tomorrow morning. That is exactly the cushion that lets it ride out a bad catastrophe year without panic, and that is vital in this trade."
        },
        {
          "type": "p",
          "text": "Second, the cash conversion ratio comes in at 1.51. That means the cash generated exceeds the accounting profit by half. A company that turns its profits into real money, and then some, is not dressing up its books. For the record, the 10 out of 10 score measures the quality of the business alone. The share price is an entirely different question, and I judge it separately."
        },
        {
          "type": "h2",
          "text": "Quality first, price second (and separately)"
        },
        {
          "type": "p",
          "text": "Here is the rule I never break: I always separate two questions most people merge. One: is this a good business? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. On RenaissanceRe, the first question is settled. The second remains."
        },
        {
          "type": "p",
          "text": "To measure the price, I look at the P/FCF (price to free cash flow): the share price divided by the cash the company truly generates each year. A P/FCF of 3 means that at the current pace, you are paying barely more than three years of that cash. The lower it is, the cheaper it is. RenaissanceRe trades at 3.0 times its free cash flow, at a price of about 295.75 dollars."
        },
        {
          "type": "p",
          "text": "That number takes on its full meaning when you compare it to its own history. My monitoring ranks it in the 4th percentile of its past valuation. A percentile is a way to place a number in a series: a 4th percentile means that in 96% of cases, over its own history, the stock traded more expensively than today. In other words, it has almost never been this cheap. My system actually flagged it as a current opportunity."
        },
        {
          "type": "p",
          "text": "But beware the trap. A P/FCF this low in reinsurance is never innocent, and there is a simple technical reason, which I get to right after."
        },
        {
          "type": "h2",
          "text": "Why does the market pay so little for such a fine machine?"
        },
        {
          "type": "p",
          "text": "Because the market does not pay for a company, it pays for a story, and the reinsurance story is scary on one point: volatility. In a year without a major catastrophe, RenaissanceRe collects premiums and pays few claims: its profits explode. In a year with a major hurricane, it pays billions: its profits collapse, even turn negative."
        },
        {
          "type": "p",
          "text": "Now, a P/FCF is calculated on the cash of a given period. If that cash was boosted by one or two calm years, the ratio looks artificially low. The market knows it: it refuses to pay for that cash as if it were recurring and smooth, because it is not. That is exactly why a reinsurer, even an excellent one, structurally trades at a lower multiple than a software company with steady cash. This P/FCF of 3 is therefore not only a bargain: it is also the price of uncertainty."
        },
        {
          "type": "h2",
          "text": "The risks I do not forget"
        },
        {
          "type": "p",
          "text": "I would be dishonest to show you only the bright side. RenaissanceRe has real trade-offs, and they deserve a straight look."
        },
        {
          "type": "p",
          "text": "First risk, the most obvious: exposure to natural catastrophes. A heavy hurricane year can turn a brilliant fiscal year into a disastrous one. It is in the DNA of the trade, and no model removes this risk, it only measures it. You have to accept jagged results from one year to the next, and judge the company over a full cycle, not over a quarter."
        },
        {
          "type": "p",
          "text": "Second risk: market cyclicality. Reinsurance prices rise after catastrophes, then fall back when capital floods in again and competition returns. The day the market goes soft again, RenaissanceRe's profitability will sag, and its growth with it. Its current progression is not a guaranteed annuity: it is partly a market window."
        },
        {
          "type": "p",
          "text": "Third risk, more discreet: sensitivity to interest rates. Like any insurer, RenaissanceRe invests its cash in bonds while waiting to pay its claims. When rates move, the value of that portfolio moves too, which can weigh on its accounting results. And the fourth risk, the simplest: quality never protects you from price. A low P/FCF is only a bargain if the quality holds and the cycle does not turn too soon. That is exactly why I judge quality before price, and price separately."
        },
        {
          "type": "h2",
          "text": "How I read RenaissanceRe, without getting carried away"
        },
        {
          "type": "p",
          "text": "At its core, RenaissanceRe has the profile I like to study closely: top quality, scored 10 out of 10, and a price among the lowest in its own history. But reinsurance is not standard insurance: its results are volatile by nature, and this low multiple partly reflects that uncertainty. That is not a reason to dismiss it, it is a reason to understand clearly what you are buying."
        },
        {
          "type": "p",
          "text": "But I am not rushing in. I note a reasonable buy price and let the market come to me rather than chase it. If you want to dig in, you will find the criteria detail on the [RenaissanceRe analysis page](/analyse/RNR), a close cousin case in my [Kinsale Capital analysis](/analyse/KNSL), and the full context in my [ranking of companies scored 10 out of 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "Judging whether a business is good, then at what price to buy it, separately, in a few seconds and for any stock: that is exactly what I wanted to be able to do. So I built it. You can see how in my [methodology](/methodologie)."
        }
      ],
      "faq": [
        {
          "q": "What is reinsurance?",
          "a": "Reinsurance is the insurance of insurers. When a regular insurer has covered more risk than it can carry alone, it transfers part of it to a reinsurer like RenaissanceRe, in exchange for a premium. This lets it absorb very large losses, such as a major hurricane."
        },
        {
          "q": "What does a P/FCF of 3.0 mean?",
          "a": "The P/FCF (price to free cash flow) divides the share price by the cash actually generated each year. A P/FCF of 3.0 means you pay barely more than three years of that cash, so a very low price. But in reinsurance, a low multiple also reflects the volatility of results."
        },
        {
          "q": "Why does RenaissanceRe score 10 out of 10?",
          "a": "It meets my 10 fundamental quality criteria: strong profitability (36% free cash flow margin), sustained growth, high return on capital (31% Cash ROCE) and a solid balance sheet (almost no net debt). My 10 out of 10 score measures the quality of the business alone, independent of the share price."
        },
        {
          "q": "Why does the stock look so cheap?",
          "a": "Because its results are volatile: a calm year boosts its cash and makes the P/FCF look artificially low. The market refuses to pay for that cash as if it were smooth and recurring, because a major catastrophe can change everything. The low price is therefore partly the price of uncertainty."
        },
        {
          "q": "What are the risks with RenaissanceRe?",
          "a": "Three mainly: exposure to natural catastrophes, which makes results volatile from one year to the next; the cyclicality of the reinsurance market; and sensitivity to interest rates on its bond portfolio. This is not investment advice, do your own research."
        }
      ],
      "tags": [
        "Analysis",
        "RenaissanceRe",
        "Reinsurance"
      ],
      "disclaimer": "This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 11, 2026, subject to change. Do your own research."
    },
    "es": {
      "title": "RenaissanceRe Holdings (RNR) : calidad de saldo",
      "excerpt": "Una reaseguradora de élite, con nota 10 sobre 10, que cotiza hoy entre los precios más bajos de toda su historia. Aquí está por qué RenaissanceRe cumple mis criterios de calidad, y la trampa que esconde su negocio.",
      "metaDescription": "RenaissanceRe Holdings (RNR) explicada de forma sencilla: qué hace esta reaseguradora de Bermudas, su moat, sus riesgos y por qué obtiene mi nota 10 sobre 10.",
      "answer": "RenaissanceRe es una reaseguradora de Bermudas de élite: asegura a las aseguradoras contra las grandes catástrofes, con una disciplina de suscripción reconocida. Cumple mis 10 criterios de calidad y obtiene un 10 sobre 10. Y cotiza hoy entre los precios más bajos de toda su historia. Una calidad así es rara. El precio también.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Qué hace RenaissanceRe: reasegura a otras aseguradoras contra las grandes catástrofes naturales, desde Bermudas, desde 1993.",
            "Por qué es raro: logra mi nota de 10 sobre 10, el máximo, que muy pocas empresas alcanzan.",
            "El motor: una disciplina de suscripción reconocida, modelos de riesgo propios, y capital desplegado en el buen momento del ciclo.",
            "La rentabilidad: el 36 % de sus ingresos termina como caja realmente disponible, y esa caja crece un 32 % al año.",
            "El precio: su caja casi nunca se había pagado tan barata en su historia. Pero sus resultados son volátiles por naturaleza, y de eso va todo."
          ]
        },
        {
          "type": "h2",
          "text": "La aseguradora de las aseguradoras"
        },
        {
          "type": "p",
          "text": "Conocemos a las aseguradoras: cubren tu coche, tu casa, tu empresa. ¿Pero quién cubre a las aseguradoras mismas? Cuando un huracán arrasa Florida, la aseguradora local no puede pagarlo todo sola. Ha transferido, de antemano, parte de su riesgo a alguien más grande. Ese alguien más grande es una reaseguradora. RenaissanceRe es una de las mejores del mundo en este juego."
        },
        {
          "type": "p",
          "text": "Fundada en 1993 y con sede en Bermudas, esa pequeña roca del Atlántico convertida en capital mundial del reaseguro, RenaissanceRe se especializó en el riesgo que casi nadie quiere cargar: la catástrofe natural. Huracanes, terremotos, inundaciones. Riesgos raros, enormes cuando golpean, y terriblemente difíciles de evaluar. Ahí es justo donde se esconde el dinero, para quien sabe calcular mejor que los demás."
        },
        {
          "type": "p",
          "text": "Y esa es precisamente la apuesta de la casa: ser el mejor poniendo un precio justo a lo impredecible. Quien se equivoca tarificando un huracán queda arrasado cuando golpea. Quien calcula bien cobra una prima jugosa por un riesgo que midió correctamente. RenaissanceRe construyó toda su historia sobre eso."
        },
        {
          "type": "h2",
          "text": "Cómo gana dinero una reaseguradora (y por qué esta lo hace bien)"
        },
        {
          "type": "p",
          "text": "Un rodeo útil, porque este negocio se juzga con su propio termómetro. Una reaseguradora cobra primas hoy y pagará posibles siniestros más tarde, a veces mucho más tarde. Entre medias, dos cosas importan de verdad."
        },
        {
          "type": "p",
          "text": "Primero, la disciplina de suscripción. Suscribir es el acto de decidir qué riesgo se acepta y a qué precio. Una reaseguradora indisciplinada persigue volumen, acepta riesgos mal tarifados, y termina arrasada con la primera gran catástrofe. RenaissanceRe es conocida por decir no cuando los precios son demasiado bajos, y por cobrar fuerte cuando el mercado le da la razón. Esa contención es rara en un sector donde la tentación de crecer rápido es permanente."
        },
        {
          "type": "p",
          "text": "Segundo, sus modelos de riesgo propios. Para tarificar un huracán, hay que estimar la probabilidad de que golpee y el importe que costará. RenaissanceRe ha construido, a lo largo de décadas, sus propias herramientas de modelización de catástrofes. Es un saber hacer que el dinero solo no compra: hacen falta años de datos y de experiencia para calibrar esos modelos. Esta ventaja explica por qué la empresa gana dinero allí donde otras se queman."
        },
        {
          "type": "p",
          "text": "El resultado se ve en una cifra que me hizo detenerme: su margen de flujo de caja libre alcanza el 36 %. El flujo de caja libre es el dinero que de verdad queda en caja una vez pagadas todas las facturas (sueldos, siniestros, impuestos). Un margen del 36 % significa que de cada 100 dólares de ingresos, 36 terminan como caja realmente disponible. La mayoría de las empresas se quedan cerca del 10. Su margen neto, por su parte, es del 24 %."
        },
        {
          "type": "h2",
          "text": "El verdadero tesoro: un moat que se despliega en el buen momento"
        },
        {
          "type": "p",
          "text": "Un buen balance nunca me basta para convencerme. Lo que busco es el moat: el foso competitivo, lo que impide que un rival mejor financiado venga a quitar el sitio. El moat es la imagen de un castillo rodeado por un foso: cuanto más ancho, más le cuesta al atacante. En RenaissanceRe, ese foso se apoya en tres elementos."
        },
        {
          "type": "p",
          "text": "Primero, la reputación de suscripción, que le trae los mejores expedientes en las mejores condiciones. Segundo, los modelos propios, que le permiten tarificar mejor. Y tercero, el más sutil: el sentido del momento. En el reaseguro, los precios suben con fuerza tras las grandes catástrofes, porque muchos actores quedaron tocados y la capacidad de cubrir el riesgo escasea. Es lo que se llama un mercado duro. RenaissanceRe sabe guardar capital de reserva para desplegarlo masivamente en esos momentos, cuando asegurar rinde más."
        },
        {
          "type": "p",
          "text": "En cifras, ese moat se traduce en dos medidas que siempre miro. El crecimiento, primero: los ingresos suben un 28 % al año, y la caja por acción un 32 % al año. La rentabilidad del capital, después: el Cash ROCE alcanza el 31 %. Esta medida responde a una pregunta simple: por cada dólar puesto en el negocio, ¿cuánta caja devuelve cada año? Aquí, 31 centavos por dólar y por año. Es unas dos veces el umbral que considero excelente."
        },
        {
          "type": "h2",
          "text": "¿Qué es exactamente mi nota de 10 sobre 10?"
        },
        {
          "type": "p",
          "text": "No califico una empresa por intuición. La paso por el filtro de 10 criterios de calidad fundamental, concretos: ¿es de verdad rentable, crecen sus ventas y su caja, convierte el beneficio contable en caja real, tiene la deuda controlada, devuelve dinero a sus accionistas sin malgastar? Una empresa que cumple todo obtiene un 10 sobre 10. Es raro, por construcción. RenaissanceRe lo logra."
        },
        {
          "type": "p",
          "text": "Dos puntos lo resumen. El primero: su deuda. Su ratio de deuda neta sobre flujo de caja libre es de 0,18, es decir, casi nada de deuda neta: su caja cubre casi la totalidad de sus préstamos. En claro, podría devolverlo casi todo mañana por la mañana. Es justo el tipo de colchón que permite atravesar un mal año de catástrofes sin pánico, y eso es vital en este oficio."
        },
        {
          "type": "p",
          "text": "El segundo: la ratio de conversión del beneficio en caja es de 1,51. Eso significa que la caja generada supera en la mitad al beneficio contable. Una empresa que convierte sus beneficios en dinero bien real, e incluso más, no maquilla sus cuentas. Para que conste, la nota de 10 sobre 10 mide la calidad del negocio en sí. El precio de la acción es otra cuestión muy distinta, y lo juzgo por separado."
        },
        {
          "type": "h2",
          "text": "La calidad primero, el precio después (y por separado)"
        },
        {
          "type": "p",
          "text": "Esta es la regla que nunca rompo: separo siempre dos preguntas que la mayoría confunde. Una: ¿es un buen negocio? Dos, completamente aparte: ¿es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. En RenaissanceRe, la primera pregunta está resuelta. Queda la segunda."
        },
        {
          "type": "p",
          "text": "Para medir el precio, miro el P/FCF (price to free cash flow): la cotización de la acción dividida entre la caja que la empresa genera de verdad cada año. Un P/FCF de 3 significa que, al ritmo actual, pagas apenas algo más de tres años de esa caja. Cuanto más bajo, más barato. RenaissanceRe cotiza a 3,0 veces su flujo de caja libre, a un precio de unos 295,75 dólares."
        },
        {
          "type": "p",
          "text": "Esa cifra cobra todo su sentido cuando se compara con su propia historia. Mi vigilancia la sitúa en el percentil 4 de su valoración pasada. El percentil es una forma de situar una cifra en una serie: un percentil 4 significa que en el 96 % de los casos, en su propio historial, la acción cotizó más cara que hoy. Dicho de otro modo, casi nunca ha estado tan barata. Mi sistema, de hecho, la señaló como oportunidad del momento."
        },
        {
          "type": "p",
          "text": "Pero cuidado con la trampa. Un P/FCF tan bajo en el reaseguro nunca es inocente, y hay una razón técnica simple, que abordo justo después."
        },
        {
          "type": "h2",
          "text": "¿Por qué el mercado paga tan poco por una máquina tan buena?"
        },
        {
          "type": "p",
          "text": "Porque el mercado no paga por una empresa, paga por una historia, y la historia del reaseguro asusta en un punto: la volatilidad. Un año sin gran catástrofe, RenaissanceRe cobra primas y paga pocos siniestros: sus beneficios se disparan. Un año con un huracán mayor, paga miles de millones: sus beneficios se hunden, incluso se vuelven negativos."
        },
        {
          "type": "p",
          "text": "Ahora bien, un P/FCF se calcula sobre la caja de un periodo dado. Si esa caja fue impulsada por uno o dos años tranquilos, la ratio parece artificialmente baja. El mercado lo sabe: se niega a pagar esa caja como si fuera recurrente y estable, porque no lo es. Es justo por eso que una reaseguradora, aun excelente, cotiza estructuralmente a un múltiplo más bajo que una empresa de software con caja regular. Este P/FCF de 3 no es, por tanto, solo una ganga: es también el precio de la incertidumbre."
        },
        {
          "type": "h2",
          "text": "Los riesgos que no olvido"
        },
        {
          "type": "p",
          "text": "Sería deshonesto mostrarte solo la luz. RenaissanceRe tiene verdaderos trade-offs, y merecen una mirada franca."
        },
        {
          "type": "p",
          "text": "Primer riesgo, el más evidente: la exposición a las catástrofes naturales. Un año intenso de huracanes puede convertir un ejercicio brillante en uno desastroso. Está en el ADN del oficio, y ningún modelo elimina este riesgo, solo lo mide. Hay que aceptar resultados en dientes de sierra de un año a otro, y juzgar a la empresa sobre un ciclo entero, no sobre un trimestre."
        },
        {
          "type": "p",
          "text": "Segundo riesgo: la ciclicidad del mercado. Los precios del reaseguro suben tras las catástrofes, y luego bajan cuando el capital afluye de nuevo y vuelve la competencia. El día en que el mercado se ablande otra vez, la rentabilidad de RenaissanceRe se aplanará, y su crecimiento con ella. Su progresión actual no es una renta garantizada: es en parte una ventana de mercado."
        },
        {
          "type": "p",
          "text": "Tercer riesgo, más discreto: la sensibilidad a los tipos de interés. Como toda aseguradora, RenaissanceRe invierte su caja en bonos mientras espera para pagar sus siniestros. Cuando los tipos se mueven, el valor de esa cartera también, lo que puede pesar en sus resultados contables. Y el cuarto riesgo, el más simple: la calidad nunca te protege del precio. Un P/FCF bajo solo es una ganga si la calidad aguanta y el ciclo no se da la vuelta demasiado pronto. Es justo por eso que juzgo la calidad antes que el precio, y el precio por separado."
        },
        {
          "type": "h2",
          "text": "Cómo leo a RenaissanceRe, sin dejarme llevar"
        },
        {
          "type": "p",
          "text": "En el fondo, RenaissanceRe tiene el perfil que me gusta mirar de cerca: una calidad máxima, con nota 10 sobre 10, y un precio entre los más bajos de su propia historia. Pero el reaseguro no es el seguro clásico: sus resultados son volátiles por naturaleza, y ese múltiplo bajo refleja en parte esa incertidumbre. No es una razón para descartarla, es una razón para entender bien qué se compra."
        },
        {
          "type": "p",
          "text": "Pero no me lanzo por ello. Anoto un precio de compra razonable y dejo que el mercado venga a mí en lugar de perseguirlo. Si quieres profundizar, encontrarás el detalle de los criterios en la [página de análisis de RenaissanceRe](/analyse/RNR), un caso primo cercano en mi [análisis de Kinsale Capital](/analyse/KNSL), y el contexto completo en mi [clasificación de empresas con nota 10 sobre 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "Juzgar si una empresa es buena, y luego a qué precio comprarla, por separado, en unos segundos y para cualquier acción: es exactamente lo que quería poder hacer. Así que lo construí. Puedes ver cómo en mi [metodología](/methodologie)."
        }
      ],
      "faq": [
        {
          "q": "¿Qué es el reaseguro?",
          "a": "El reaseguro es el seguro de las aseguradoras. Cuando una aseguradora clásica ha cubierto más riesgo del que puede cargar sola, transfiere una parte a una reaseguradora como RenaissanceRe, a cambio de una prima. Eso le permite absorber las pérdidas muy grandes, como un huracán mayor."
        },
        {
          "q": "¿Qué significa un P/FCF de 3,0?",
          "a": "El P/FCF (price to free cash flow) divide la cotización de la acción entre la caja realmente generada cada año. Un P/FCF de 3,0 significa que pagas apenas algo más de tres años de esa caja, así que un precio muy bajo. Pero en el reaseguro, un múltiplo bajo también refleja la volatilidad de los resultados."
        },
        {
          "q": "¿Por qué RenaissanceRe obtiene un 10 sobre 10?",
          "a": "Cumple mis 10 criterios de calidad fundamental: fuerte rentabilidad (margen de flujo de caja libre del 36 %), crecimiento sostenido, alta rentabilidad del capital (Cash ROCE del 31 %) y un balance sólido (casi nada de deuda neta). Mi nota de 10 sobre 10 mide la calidad del negocio en sí, con independencia del precio de la acción."
        },
        {
          "q": "¿Por qué la acción parece tan barata?",
          "a": "Porque sus resultados son volátiles: un año tranquilo impulsa su caja y hace que el P/FCF parezca artificialmente bajo. El mercado se niega a pagar esa caja como si fuera estable y recurrente, porque una gran catástrofe puede cambiarlo todo. El precio bajo es, por tanto, en parte el precio de la incertidumbre."
        },
        {
          "q": "¿Cuáles son los riesgos de RenaissanceRe?",
          "a": "Tres principalmente: la exposición a las catástrofes naturales, que vuelve volátiles los resultados de un año a otro; la ciclicidad del mercado del reaseguro; y la sensibilidad a los tipos de interés sobre su cartera de bonos. Esto no es asesoramiento de inversión, haz tu propia investigación."
        }
      ],
      "tags": [
        "Análisis",
        "RenaissanceRe",
        "Reaseguro"
      ],
      "disclaimer": "Este artículo es un análisis con fines informativos y educativos y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 11 de junio de 2026, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const meli: Article = {
  "slug": "mercadolibre-meli-10-10-sous-evaluee",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 10,
  "ticker": "MELI",
  "content": {
    "fr": {
      "title": "MercadoLibre (MELI) : note 10/10, payée comme une value",
      "excerpt": "Une machine à cash notée 10/10, qui grandit de 41 % par an, et qui ne s'est jamais payée aussi peu cher de toute son histoire. Voici pourquoi je regarde MercadoLibre de très près, et où se cache le piège.",
      "metaDescription": "MercadoLibre (MELI) expliqué simplement : un business noté 10/10 au P/FCF le plus bas de son histoire. Sa qualité, son moat, ses risques, et comment je tranche.",
      "answer": "MercadoLibre est l'Amazon plus PayPal de l'Amérique latine, noté 10 sur 10 dans ma méthode. Il grandit de 41 % par an, génère un cash exceptionnel, et ne s'est jamais payé aussi peu cher de toute son histoire. La qualité est rare, le prix l'est tout autant. Voici comment je tranche, sans emballement.",
      "body": [
        {
          "type": "ul",
          "items": [
            "MercadoLibre coche mes 10 critères de qualité sur 10 : c'est très rare, et ça veut dire que le business est solide indépendamment du prix de l'action.",
            "Son P/FCF est de 6,8 fois, le plus bas de toute son histoire (percentile 0) : tu paies moins de sept ans du cash qu'il génère, ce qui est très bon marché pour une telle croissance.",
            "Sa croissance est rare : 41 % par an sur le chiffre d'affaires, et près de 90 % par an sur le cash par action.",
            "Sa marge nette comptable n'est que de 6 %, volontairement basse parce qu'il réinvestit tout pour grandir : c'est ce qui peut effrayer, et créer l'occasion.",
            "Ma règle, le fil de tout l'article : je juge la qualité du business et le prix de l'action séparément."
          ]
        },
        {
          "type": "h2",
          "text": "L'Amazon et le PayPal d'un continent, dans une seule entreprise"
        },
        {
          "type": "p",
          "text": "La première fois que j'ai vu les chiffres de MercadoLibre, j'ai relu deux fois. Une entreprise qui grandit de 41 % par an et qui se paie comme une value oubliée, ça ne se croise pas tous les jours. MercadoLibre, c'est le géant de la vente en ligne en Amérique latine (Brésil, Argentine, Mexique), couplé à Mercado Pago, sa banque et son service de paiement. En clair : l'Amazon plus le PayPal d'un continent, dans la même maison."
        },
        {
          "type": "p",
          "text": "Quand je regarde une action, je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Mélanger les deux, c'est l'erreur numéro un. Tout l'intérêt de MercadoLibre, c'est qu'aujourd'hui les deux réponses semblent pointer dans le même sens."
        },
        {
          "type": "h2",
          "text": "Est-ce une bonne entreprise ? La note 10 sur 10"
        },
        {
          "type": "p",
          "text": "Je ne me fie pas à mon intuition. Je passe chaque entreprise au crible de 10 critères financiers concrets : est-elle rentable, ses ventes et son cash augmentent-ils, génère-t-elle vraiment de l'argent, sa dette est-elle maîtrisable, son capital travaille-t-il bien ? Une entreprise qui valide les 10 reçoit une note de 10 sur 10. C'est rare, et MercadoLibre en fait partie. Voir la liste complète des entreprises notées au maximum sur mon [classement des entreprises notées 10 sur 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "Le chiffre qui m'arrête, c'est le Cash ROCE de 121 %. Le Cash ROCE mesure combien de cash l'entreprise génère pour chaque euro réellement immobilisé dans son activité. Un Cash ROCE de 121 %, ça veut dire que pour un euro de capital vraiment engagé, MercadoLibre récupère plus d'un euro de cash en une année. C'est presque irréel : la plupart des entreprises tournent à un chiffre, ou à quelques dizaines de pour cent au mieux."
        },
        {
          "type": "p",
          "text": "Ajoute la marge de FCF de 37 %. Le free cash flow, ou FCF, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, machines, impôts, entrepôts). Une marge de FCF de 37 %, ça veut dire que sur 100 euros de ventes, 37 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10. Côté solidité, la dette nette ne représente que 0,5 fois le cash annuel généré : autrement dit, l'entreprise pourrait effacer sa dette en six mois de cash. Rien de fragile ici."
        },
        {
          "type": "h2",
          "text": "Une croissance que peu d'entreprises savent tenir"
        },
        {
          "type": "p",
          "text": "Beaucoup d'entreprises bon marché le sont parce qu'elles ne grandissent plus. Ce n'est pas le cas ici, au contraire. Le chiffre d'affaires progresse de 41 % par an. Et le cash par action, lui, grimpe de près de 90 % par an. Ce deuxième chiffre est celui que je préfère, parce que c'est le cash qui revient à chaque action que tu détiennes, pas un agrégat comptable que l'on peut habiller."
        },
        {
          "type": "p",
          "text": "Cette croissance ne tombe pas du ciel. Elle vient d'un continent qui passe au commerce en ligne et au paiement numérique avec dix ans de retard sur les États-Unis, et MercadoLibre est aux premières loges. Quand un marché entier se digitalise et que tu es déjà l'infrastructure par défaut, tu grandis avec lui."
        },
        {
          "type": "h2",
          "text": "Le vrai trésor : son moat"
        },
        {
          "type": "p",
          "text": "Un bon bilan ne raconte pas tout. Ce qui me convainc, c'est le moat de MercadoLibre. Le moat, c'est le fossé concurrentiel : ce qui empêche un rival de prendre sa place, même avec beaucoup d'argent. Chez MercadoLibre, ce fossé tient en trois douves qui se renforcent l'une l'autre."
        },
        {
          "type": "p",
          "text": "D'abord l'effet de réseau. Plus il y a d'acheteurs, plus les vendeurs viennent, et plus il y a de vendeurs, plus les acheteurs viennent. La plateforme devient incontournable des deux côtés, et un nouvel entrant doit séduire les deux camps en même temps, ce qui est presque impossible. Ensuite la logistique propriétaire, Mercado Envíos : ses propres entrepôts et son réseau de livraison, un avantage colossal dans des pays où livrer vite et fiable est un casse-tête. Enfin Mercado Pago, qui gère paiements et crédit : une fois que tu paies, empruntes et reçois ton argent dans l'écosystème, en sortir devient pénible. Les trois ensemble verrouillent le terrain."
        },
        {
          "type": "h2",
          "text": "Alors pourquoi est-ce si peu cher ? Le prix"
        },
        {
          "type": "p",
          "text": "Parce que le marché ne paie pas une entreprise, il paie une histoire, et l'histoire latino-américaine fait peur. Pour mesurer ce que le marché accepte de payer, je regarde un ratio simple : le P/FCF (price to free cash flow). C'est le prix de l'action divisé par le free cash flow qu'elle génère chaque année. Un P/FCF de 6,8, ça veut dire que tu paies aujourd'hui moins de sept années de ce cash. Plus c'est bas, moins c'est cher."
        },
        {
          "type": "p",
          "text": "Or 6,8 fois, c'est le plus bas de toute l'histoire de MercadoLibre. Pour situer ça, ma méthode regarde le percentile : le percentile compare le multiple d'aujourd'hui à tout l'historique de l'entreprise, sur une échelle de 0 à 100. Un percentile de 0, ça veut dire que l'action ne s'est jamais payée aussi peu cher. Jamais. C'est précisément pour ça que mon outil la signale comme une opportunité. L'action vaut environ 1588 dollars au moment où j'écris. Tu retrouves tous les détails sur mon [analyse complète de MercadoLibre](/analyse/MELI), et d'autres cas du même genre sur la [liste des actions sous-évaluées](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "Le piège de la marge nette à 6 %"
        },
        {
          "type": "p",
          "text": "Voici ce qui fait fuir beaucoup d'investisseurs : la marge nette n'est que de 6 %. La marge nette, c'est le bénéfice comptable final rapporté aux ventes. À 6 %, on dirait une entreprise à peine rentable. Sauf que ce chiffre est volontairement bas : MercadoLibre réinvestit massivement dans ses entrepôts, sa technologie et son crédit pour grandir vite. C'est un choix, pas une faiblesse, et c'est exactement ce que confirme la marge de FCF à 37 % : le cash, lui, est bien là."
        },
        {
          "type": "p",
          "text": "C'est tout le sel de cette action. Beaucoup s'arrêtent au bénéfice comptable maigre et passent leur chemin. Moi, je préfère regarder le cash, qui se maquille beaucoup plus mal. Et le cash dit autre chose que la marge nette."
        },
        {
          "type": "h2",
          "text": "Les risques que je ne cache pas"
        },
        {
          "type": "p",
          "text": "Aucune thèse honnête ne tient sans ses risques. Le premier est macroéconomique : l'Amérique latine, ce sont des devises instables et une inflation parfois galopante (Argentine, Brésil). Quand le real ou le peso plonge face au dollar, le chiffre d'affaires converti en dollars en souffre, même si l'activité réelle se porte bien. Ce risque devise est permanent, et il explique une partie de la décote."
        },
        {
          "type": "p",
          "text": "Le deuxième, c'est la concurrence. Amazon pousse sa logistique au Mexique, et Shopee, l'asiatique, casse les prix au Brésil. Le moat de MercadoLibre est profond, mais ces rivaux ont des poches profondes et de la patience. Le troisième, plus psychologique, je l'ai dit : la marge nette comptable de 6 % peut effrayer ceux qui ne regardent pas le cash. Si tu crois que ces risques vont casser le business, ce prix bas est un piège, pas une aubaine. Si tu crois que le moat tient, c'est une rareté."
        },
        {
          "type": "h2",
          "text": "Comment je tranche, sans émotion"
        },
        {
          "type": "p",
          "text": "Voici la vraie question : crois-tu que MercadoLibre va continuer à digitaliser un continent en gardant son fossé, ou que la macro et la concurrence vont l'éroder ? Si la qualité tient, payer 6,8 fois le cash d'une entreprise qui grandit de 41 % par an est anormalement bon marché. Un P/FCF faible n'est jamais une bonne affaire en soi : il l'est seulement si la qualité tient. C'est exactement pour ça que je juge toujours la qualité avant le prix, selon une méthode que je détaille dans ma [page méthodologie](/methodologie)."
        },
        {
          "type": "p",
          "text": "Savoir si une entreprise est bonne, et à quel prix l'acheter, séparément : c'est tout ce que j'ai voulu pouvoir faire en quelques secondes pour n'importe quelle action. C'est pour ça que j'ai construit mon site. MercadoLibre est l'un des rares cas où une qualité notée 10 sur 10 croise un prix au plus bas de son histoire. Reste à toi de décider si tu crois à l'histoire."
        }
      ],
      "faq": [
        {
          "q": "Que fait MercadoLibre exactement ?",
          "a": "C'est la plus grande plateforme de vente en ligne d'Amérique latine, couplée à Mercado Pago, son service de paiement et de crédit, et à Mercado Envíos, sa logistique. En résumé, l'Amazon et le PayPal d'un continent dans une même entreprise."
        },
        {
          "q": "Pourquoi sa marge nette n'est-elle que de 6 % ?",
          "a": "Parce que l'entreprise réinvestit massivement dans ses entrepôts, sa technologie et son crédit pour grandir vite. C'est un choix volontaire. Le vrai indicateur de sa rentabilité est sa marge de free cash flow de 37 %, qui montre que le cash, lui, est bien présent."
        },
        {
          "q": "Un P/FCF de 6,8 fois, est-ce toujours une bonne affaire ?",
          "a": "Non. Un prix bas peut cacher une entreprise en déclin. Il n'est intéressant que si la qualité est au rendez-vous. Ici, la note de 10 sur 10 et une croissance de 41 % par an suggèrent que la qualité tient, mais les risques macro et la concurrence restent réels."
        },
        {
          "q": "Quels sont les principaux risques de MercadoLibre ?",
          "a": "Trois surtout : la macro latino-américaine (devises instables, inflation en Argentine et au Brésil), la concurrence d'Amazon et de Shopee, et une marge nette comptable basse qui peut effrayer les investisseurs qui ne regardent pas le cash."
        },
        {
          "q": "Faut-il acheter l'action MercadoLibre maintenant ?",
          "a": "Ça dépend de ta conviction sur la solidité de son moat face à la macro et à la concurrence, et de ta discipline de prix. Le multiple est au plus bas de son histoire. Ceci n'est pas un conseil en investissement, fais tes propres recherches."
        }
      ],
      "tags": [
        "Analyse",
        "MercadoLibre",
        "Valorisation",
        "Amérique latine"
      ],
      "disclaimer": "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres à la date de publication, susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "MercadoLibre (MELI): rated 10/10, priced like value",
      "excerpt": "A cash machine rated 10/10, growing 41% a year, that has never been this cheap in its entire history. Here is why I watch MercadoLibre very closely, and where the trap hides.",
      "metaDescription": "MercadoLibre (MELI) explained simply: a business rated 10/10 at the lowest P/FCF in its history. Its quality, its moat, its risks, and how I decide.",
      "answer": "MercadoLibre is Latin America's Amazon plus PayPal, rated 10 out of 10 in my method. It grows 41% a year, generates exceptional cash, and has never been this cheap in its entire history. Quality is rare, and so is the price. Here is how I decide, without getting carried away.",
      "body": [
        {
          "type": "ul",
          "items": [
            "MercadoLibre ticks all 10 of my 10 quality criteria: that is very rare, and it means the business is sound regardless of the stock price.",
            "Its P/FCF is 6.8 times, the lowest in its entire history (percentile 0): you pay less than seven years of the cash it generates, which is very cheap for such growth.",
            "Its growth is rare: 41% a year in revenue, and nearly 90% a year in cash per share.",
            "Its accounting net margin is only 6%, deliberately low because it reinvests everything to grow: that is what can scare people, and create the opportunity.",
            "My rule, the thread of this whole piece: I judge the quality of the business and the price of the stock separately."
          ]
        },
        {
          "type": "h2",
          "text": "A continent's Amazon and PayPal, in a single company"
        },
        {
          "type": "p",
          "text": "The first time I saw MercadoLibre's numbers, I read them twice. A company growing 41% a year that trades like a forgotten value stock is not something you meet every day. MercadoLibre is the online retail giant of Latin America (Brazil, Argentina, Mexico), paired with Mercado Pago, its bank and payments arm. In plain terms: a continent's Amazon plus PayPal, under one roof."
        },
        {
          "type": "p",
          "text": "When I look at a stock, I always separate two questions most people confuse. One: is this a good company? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. Mixing the two is the number one error. What makes MercadoLibre interesting is that today both answers seem to point the same way."
        },
        {
          "type": "h2",
          "text": "Is it a good company? The 10 out of 10 score"
        },
        {
          "type": "p",
          "text": "I do not trust my gut. I run every company through 10 concrete financial criteria: is it profitable, are its sales and cash growing, does it truly generate money, is its debt manageable, does its capital work hard? A company that passes all 10 gets a score of 10 out of 10. That is rare, and MercadoLibre is one of them. See the full list of top-scoring companies on my [ranking of companies rated 10 out of 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "The number that stops me is the Cash ROCE of 121%. Cash ROCE measures how much cash the company generates for each dollar truly tied up in its operations. A Cash ROCE of 121% means that for one dollar of capital genuinely committed, MercadoLibre brings back more than one dollar of cash in a single year. It is almost unreal: most companies run in the single digits, or a few tens of percent at best."
        },
        {
          "type": "p",
          "text": "Add the FCF margin of 37%. Free cash flow, or FCF, is the money that truly stays in the bank once every bill is paid (salaries, machines, taxes, warehouses). An FCF margin of 37% means that on 100 dollars of sales, 37 end up as genuinely available cash. Most companies top out around 10. On strength, net debt is just 0.5 times the annual cash generated: in other words, the company could wipe out its debt with six months of cash. Nothing fragile here."
        },
        {
          "type": "h2",
          "text": "Growth few companies can sustain"
        },
        {
          "type": "p",
          "text": "Many cheap companies are cheap because they no longer grow. Not here, quite the opposite. Revenue is climbing 41% a year. And cash per share is rising nearly 90% a year. That second number is my favorite, because it is the cash that flows back to each share you own, not an accounting aggregate that can be dressed up."
        },
        {
          "type": "p",
          "text": "This growth does not fall from the sky. It comes from a continent shifting to online commerce and digital payments with a ten-year lag on the United States, and MercadoLibre has a front-row seat. When an entire market digitizes and you are already the default infrastructure, you grow with it."
        },
        {
          "type": "h2",
          "text": "The real treasure: its moat"
        },
        {
          "type": "p",
          "text": "A good balance sheet does not tell the whole story. What convinces me is MercadoLibre's moat. The moat is the competitive ditch: what stops a rival from taking its place, even with a lot of money. At MercadoLibre, that ditch rests on three walls that reinforce one another."
        },
        {
          "type": "p",
          "text": "First, the network effect. The more buyers there are, the more sellers come, and the more sellers there are, the more buyers come. The platform becomes unavoidable on both sides, and a newcomer has to win over both camps at once, which is nearly impossible. Then the proprietary logistics, Mercado Envíos: its own warehouses and delivery network, a huge edge in countries where shipping fast and reliably is a headache. Finally Mercado Pago, which handles payments and credit: once you pay, borrow and receive your money inside the ecosystem, leaving it becomes painful. The three together lock down the ground."
        },
        {
          "type": "h2",
          "text": "So why is it this cheap? The price"
        },
        {
          "type": "p",
          "text": "Because the market does not pay for a company, it pays for a story, and the Latin American story is scary. To measure what the market is willing to pay, I look at one simple ratio: the P/FCF (price to free cash flow). It is the share price divided by the free cash flow it generates each year. A P/FCF of 6.8 means you are paying less than seven years of that cash today. The lower it is, the cheaper it is."
        },
        {
          "type": "p",
          "text": "And 6.8 times is the lowest in MercadoLibre's entire history. To frame it, my method looks at the percentile: the percentile compares today's multiple to the company's whole history, on a scale of 0 to 100. A percentile of 0 means the stock has never been this cheap. Never. That is exactly why my tool flags it as an opportunity. The stock is worth about 1588 dollars as I write. You will find all the details on my [full MercadoLibre analysis](/analyse/MELI), and other cases of the same kind on the [list of undervalued stocks](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "The trap of the 6% net margin"
        },
        {
          "type": "p",
          "text": "Here is what scares many investors away: the net margin is only 6%. The net margin is the final accounting profit relative to sales. At 6%, it looks like a barely profitable company. Except that figure is deliberately low: MercadoLibre reinvests heavily in its warehouses, its technology and its credit business to grow fast. It is a choice, not a weakness, and it is exactly what the 37% FCF margin confirms: the cash is very much there."
        },
        {
          "type": "p",
          "text": "That is the whole point of this stock. Many stop at the thin accounting profit and walk away. I prefer to look at the cash, which is much harder to dress up. And the cash says something different from the net margin."
        },
        {
          "type": "h2",
          "text": "The risks I will not hide"
        },
        {
          "type": "p",
          "text": "No honest thesis stands without its risks. The first is macroeconomic: Latin America means unstable currencies and sometimes runaway inflation (Argentina, Brazil). When the real or the peso drops against the dollar, revenue converted into dollars suffers, even if the real business is doing fine. This currency risk is permanent, and it explains part of the discount."
        },
        {
          "type": "p",
          "text": "The second is competition. Amazon is pushing its logistics in Mexico, and Shopee, the Asian player, undercuts prices in Brazil. MercadoLibre's moat is deep, but these rivals have deep pockets and patience. The third, more psychological, I already said it: the 6% accounting net margin can scare those who do not look at the cash. If you believe these risks will break the business, this low price is a trap, not a windfall. If you believe the moat holds, it is a rarity."
        },
        {
          "type": "h2",
          "text": "How I decide, without emotion"
        },
        {
          "type": "p",
          "text": "Here is the real question: do you believe MercadoLibre will keep digitizing a continent while holding its ditch, or that the macro and competition will erode it? If the quality holds, paying 6.8 times the cash of a company growing 41% a year is abnormally cheap. A low P/FCF is never a bargain in itself: it only is if the quality holds. That is exactly why I always judge quality before price, with a method I detail on my [methodology page](/methodologie)."
        },
        {
          "type": "p",
          "text": "Knowing whether a company is good, and at what price to buy it, separately: that is all I ever wanted to be able to do in a few seconds for any stock. That is why I built my site. MercadoLibre is one of those rare cases where a quality rated 10 out of 10 meets a price at the lowest of its history. It is up to you to decide whether you believe the story."
        }
      ],
      "faq": [
        {
          "q": "What does MercadoLibre actually do?",
          "a": "It is the largest online retail platform in Latin America, paired with Mercado Pago, its payments and credit arm, and Mercado Envíos, its logistics. In short, a continent's Amazon and PayPal in a single company."
        },
        {
          "q": "Why is its net margin only 6%?",
          "a": "Because the company reinvests heavily in its warehouses, its technology and its credit business to grow fast. It is a deliberate choice. The real gauge of its profitability is its free cash flow margin of 37%, which shows the cash is very much present."
        },
        {
          "q": "Is a P/FCF of 6.8 always a bargain?",
          "a": "No. A low price can hide a company in decline. It is only attractive if the quality is there too. Here, the 10 out of 10 score and 41% annual growth suggest the quality holds, but the macro risks and competition remain real."
        },
        {
          "q": "What are MercadoLibre's main risks?",
          "a": "Three above all: the Latin American macro (unstable currencies, inflation in Argentina and Brazil), competition from Amazon and Shopee, and a low accounting net margin that can scare investors who do not look at the cash."
        },
        {
          "q": "Should you buy MercadoLibre stock now?",
          "a": "It depends on your conviction about the strength of its moat against the macro and competition, and on your price discipline. The multiple is at the lowest of its history. This is not investment advice, do your own research."
        }
      ],
      "tags": [
        "Analysis",
        "MercadoLibre",
        "Valuation",
        "Latin America"
      ],
      "disclaimer": "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date, subject to change. Do your own research."
    },
    "es": {
      "title": "MercadoLibre (MELI): nota 10/10, a precio de value",
      "excerpt": "Una máquina de generar caja con nota 10/10, que crece un 41 % al año, y que nunca se había pagado tan barata en toda su historia. Aquí explico por qué vigilo de cerca a MercadoLibre, y dónde se esconde la trampa.",
      "metaDescription": "MercadoLibre (MELI) explicado simple: un negocio con nota 10/10 al P/FCF más bajo de su historia. Su calidad, su foso, sus riesgos, y cómo decido.",
      "answer": "MercadoLibre es el Amazon más PayPal de América Latina, con nota 10 sobre 10 en mi método. Crece un 41 % al año, genera una caja excepcional, y nunca se había pagado tan barata en toda su historia. La calidad es rara, y el precio también. Así es como decido, sin dejarme llevar.",
      "body": [
        {
          "type": "ul",
          "items": [
            "MercadoLibre cumple mis 10 criterios de calidad sobre 10: es muy raro, y significa que el negocio es sólido al margen del precio de la acción.",
            "Su P/FCF es de 6,8 veces, el más bajo de toda su historia (percentil 0): pagas menos de siete años de la caja que genera, lo que es muy barato para semejante crecimiento.",
            "Su crecimiento es raro: 41 % al año en ingresos, y cerca del 90 % al año en caja por acción.",
            "Su margen neto contable es de solo el 6 %, deliberadamente bajo porque reinvierte todo para crecer: eso es lo que puede asustar, y crear la oportunidad.",
            "Mi regla, el hilo de todo el artículo: juzgo la calidad del negocio y el precio de la acción por separado."
          ]
        },
        {
          "type": "h2",
          "text": "El Amazon y el PayPal de un continente, en una sola empresa"
        },
        {
          "type": "p",
          "text": "La primera vez que vi las cifras de MercadoLibre, las leí dos veces. Una empresa que crece un 41 % al año y cotiza como una value olvidada no se cruza todos los días. MercadoLibre es el gigante de la venta en línea de América Latina (Brasil, Argentina, México), unido a Mercado Pago, su banco y su servicio de pagos. En claro: el Amazon más el PayPal de un continente, bajo el mismo techo."
        },
        {
          "type": "p",
          "text": "Cuando miro una acción, siempre separo dos preguntas que la mayoría confunde. Una: ¿es una buena empresa? Dos, completamente aparte: ¿es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Mezclar las dos es el error número uno. Lo interesante de MercadoLibre es que hoy ambas respuestas parecen apuntar en la misma dirección."
        },
        {
          "type": "h2",
          "text": "¿Es una buena empresa? La nota 10 sobre 10"
        },
        {
          "type": "p",
          "text": "No me fío de mi intuición. Paso cada empresa por un tamiz de 10 criterios financieros concretos: ¿es rentable, crecen sus ventas y su caja, genera de verdad dinero, es manejable su deuda, trabaja bien su capital? Una empresa que supera los 10 recibe una nota de 10 sobre 10. Es raro, y MercadoLibre es una de ellas. Mira la lista completa de empresas con la nota máxima en mi [clasificación de empresas con nota 10 sobre 10](/classement/qualite-10-sur-10)."
        },
        {
          "type": "p",
          "text": "La cifra que me frena es el Cash ROCE del 121 %. El Cash ROCE mide cuánta caja genera la empresa por cada euro realmente inmovilizado en su actividad. Un Cash ROCE del 121 % significa que por un euro de capital de verdad comprometido, MercadoLibre recupera más de un euro de caja en un solo año. Es casi irreal: la mayoría de las empresas se mueven en un dígito, o en unas pocas decenas de por ciento en el mejor de los casos."
        },
        {
          "type": "p",
          "text": "Añade el margen de FCF del 37 %. El flujo de caja libre, o FCF, es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, máquinas, impuestos, almacenes). Un margen de FCF del 37 % significa que de cada 100 euros de ventas, 37 acaban en caja realmente disponible. La mayoría de las empresas no pasan del 10. En cuanto a solidez, la deuda neta es solo 0,5 veces la caja anual generada: dicho de otro modo, la empresa podría borrar su deuda con seis meses de caja. Nada frágil aquí."
        },
        {
          "type": "h2",
          "text": "Un crecimiento que pocas empresas saben sostener"
        },
        {
          "type": "p",
          "text": "Muchas empresas baratas lo son porque ya no crecen. No es el caso aquí, al contrario. Los ingresos avanzan un 41 % al año. Y la caja por acción sube cerca del 90 % al año. Esa segunda cifra es la que prefiero, porque es la caja que vuelve a cada acción que poseas, no un agregado contable que se pueda maquillar."
        },
        {
          "type": "p",
          "text": "Ese crecimiento no cae del cielo. Viene de un continente que pasa al comercio en línea y al pago digital con diez años de retraso respecto a Estados Unidos, y MercadoLibre está en primera fila. Cuando todo un mercado se digitaliza y tú ya eres la infraestructura por defecto, creces con él."
        },
        {
          "type": "h2",
          "text": "El verdadero tesoro: su foso"
        },
        {
          "type": "p",
          "text": "Un buen balance no lo cuenta todo. Lo que me convence es el foso de MercadoLibre. El foso es la trinchera competitiva: lo que impide a un rival ocupar su lugar, incluso con mucho dinero. En MercadoLibre, ese foso se apoya en tres muros que se refuerzan entre sí."
        },
        {
          "type": "p",
          "text": "Primero, el efecto de red. Cuantos más compradores hay, más vendedores acuden, y cuantos más vendedores hay, más compradores acuden. La plataforma se vuelve ineludible por ambos lados, y un recién llegado tiene que conquistar los dos bandos a la vez, lo que es casi imposible. Luego la logística propia, Mercado Envíos: sus propios almacenes y su red de reparto, una ventaja enorme en países donde entregar rápido y fiable es un quebradero de cabeza. Por último Mercado Pago, que gestiona pagos y crédito: una vez que pagas, pides prestado y recibes tu dinero dentro del ecosistema, salir de él se vuelve incómodo. Los tres juntos blindan el terreno."
        },
        {
          "type": "h2",
          "text": "¿Y por qué está tan barata? El precio"
        },
        {
          "type": "p",
          "text": "Porque el mercado no paga por una empresa, paga por una historia, y la historia latinoamericana da miedo. Para medir lo que el mercado acepta pagar, miro un ratio sencillo: el P/FCF (price to free cash flow). Es el precio de la acción dividido entre el flujo de caja libre que genera cada año. Un P/FCF de 6,8 significa que pagas hoy menos de siete años de esa caja. Cuanto más bajo, más barato."
        },
        {
          "type": "p",
          "text": "Y 6,8 veces es el más bajo de toda la historia de MercadoLibre. Para situarlo, mi método mira el percentil: el percentil compara el múltiplo de hoy con todo el historial de la empresa, en una escala de 0 a 100. Un percentil de 0 significa que la acción nunca se había pagado tan barata. Nunca. Por eso justamente mi herramienta la señala como una oportunidad. La acción vale unos 1588 dólares mientras escribo. Encontrarás todos los detalles en mi [análisis completo de MercadoLibre](/analyse/MELI), y otros casos del mismo tipo en la [lista de acciones infravaloradas](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "La trampa del margen neto del 6 %"
        },
        {
          "type": "p",
          "text": "Esto es lo que ahuyenta a muchos inversores: el margen neto es de solo el 6 %. El margen neto es el beneficio contable final respecto a las ventas. Al 6 %, parece una empresa apenas rentable. Salvo que esa cifra es deliberadamente baja: MercadoLibre reinvierte con fuerza en sus almacenes, su tecnología y su crédito para crecer rápido. Es una elección, no una debilidad, y es exactamente lo que confirma el margen de FCF del 37 %: la caja sí está ahí."
        },
        {
          "type": "p",
          "text": "Esa es toda la sal de esta acción. Muchos se quedan en el escaso beneficio contable y siguen su camino. Yo prefiero mirar la caja, que se maquilla mucho peor. Y la caja dice algo distinto del margen neto."
        },
        {
          "type": "h2",
          "text": "Los riesgos que no escondo"
        },
        {
          "type": "p",
          "text": "Ninguna tesis honesta se sostiene sin sus riesgos. El primero es macroeconómico: América Latina son divisas inestables y una inflación a veces desbocada (Argentina, Brasil). Cuando el real o el peso se hunden frente al dólar, los ingresos convertidos a dólares sufren, aunque el negocio real vaya bien. Ese riesgo de divisa es permanente, y explica parte del descuento."
        },
        {
          "type": "p",
          "text": "El segundo es la competencia. Amazon empuja su logística en México, y Shopee, el actor asiático, baja los precios en Brasil. El foso de MercadoLibre es profundo, pero estos rivales tienen bolsillos profundos y paciencia. El tercero, más psicológico, ya lo dije: el margen neto contable del 6 % puede asustar a quienes no miran la caja. Si crees que estos riesgos van a romper el negocio, ese precio bajo es una trampa, no un chollo. Si crees que el foso aguanta, es una rareza."
        },
        {
          "type": "h2",
          "text": "Cómo decido, sin emoción"
        },
        {
          "type": "p",
          "text": "Aquí está la verdadera pregunta: ¿crees que MercadoLibre seguirá digitalizando un continente manteniendo su trinchera, o que la macro y la competencia la erosionarán? Si la calidad aguanta, pagar 6,8 veces la caja de una empresa que crece un 41 % al año es anormalmente barato. Un P/FCF bajo nunca es una ganga en sí mismo: solo lo es si la calidad aguanta. Por eso justamente juzgo siempre la calidad antes que el precio, con un método que detallo en mi [página de metodología](/methodologie)."
        },
        {
          "type": "p",
          "text": "Saber si una empresa es buena, y a qué precio comprarla, por separado: es todo lo que siempre quise poder hacer en unos segundos para cualquier acción. Por eso construí mi sitio. MercadoLibre es uno de esos raros casos en que una calidad con nota 10 sobre 10 se cruza con un precio en el mínimo de su historia. Queda en tus manos decidir si crees en la historia."
        }
      ],
      "faq": [
        {
          "q": "¿Qué hace MercadoLibre exactamente?",
          "a": "Es la mayor plataforma de venta en línea de América Latina, unida a Mercado Pago, su servicio de pagos y crédito, y a Mercado Envíos, su logística. En resumen, el Amazon y el PayPal de un continente en una misma empresa."
        },
        {
          "q": "¿Por qué su margen neto es de solo el 6 %?",
          "a": "Porque la empresa reinvierte con fuerza en sus almacenes, su tecnología y su crédito para crecer rápido. Es una elección deliberada. El verdadero indicador de su rentabilidad es su margen de flujo de caja libre del 37 %, que muestra que la caja sí está presente."
        },
        {
          "q": "¿Un P/FCF de 6,8 es siempre una ganga?",
          "a": "No. Un precio bajo puede ocultar una empresa en declive. Solo es atractivo si la calidad también está presente. Aquí, la nota de 10 sobre 10 y un crecimiento del 41 % anual sugieren que la calidad aguanta, pero los riesgos macro y la competencia siguen siendo reales."
        },
        {
          "q": "¿Cuáles son los principales riesgos de MercadoLibre?",
          "a": "Tres sobre todo: la macro latinoamericana (divisas inestables, inflación en Argentina y Brasil), la competencia de Amazon y Shopee, y un margen neto contable bajo que puede asustar a los inversores que no miran la caja."
        },
        {
          "q": "¿Hay que comprar acciones de MercadoLibre ahora?",
          "a": "Depende de tu convicción sobre la fortaleza de su foso frente a la macro y la competencia, y de tu disciplina de precio. El múltiplo está en el mínimo de su historia. Esto no es asesoramiento de inversión, haz tu propia investigación."
        }
      ],
      "tags": [
        "Análisis",
        "MercadoLibre",
        "Valoración",
        "América Latina"
      ],
      "disclaimer": "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a la fecha de publicación, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const pfcfSous5x: Article = {
  "slug": "actions-10-10-pfcf-sous-5x-juin-2026",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 9,
  "content": {
    "fr": {
      "title": "Actions 10/10 payées moins de 5 ans de cash : piège ?",
      "excerpt": "Sept entreprises que je note 10/10 se paient moins de 5 ans du cash qu'elles génèrent. Aubaine ou piège ? Voici comment je sépare la qualité du prix, et pourquoi le marché doute.",
      "metaDescription": "Sept actions notées 10/10 se paient un P/FCF sous 5 en juin 2026. Vraie décote ou piège de valeur ? Ma méthode pour séparer la qualité du prix du marché.",
      "answer": "En juin 2026, sept entreprises que je note 10/10 sur la qualité se paient moins de 5 ans du cash qu'elles génèrent. C'est rare, et tentant. Mais un prix très bas cache souvent une raison. Voici comment je sépare la qualité du prix, et pourquoi je creuse toujours le doute du marché avant de conclure.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Sept actions que je note 10/10 sur la qualité affichent un P/FCF sous 5 en juin 2026 : tu les paies moins de cinq ans du cash qu'elles génèrent.",
            "La plus extrême : Afya, à 1,1 fois son cash, soit à peine plus d'un an. Universal Insurance à 2,9, RenaissanceRe à 3,0.",
            "Beaucoup sont des assureurs ou des réassureurs : ce n'est pas un hasard, c'est le coeur de l'article.",
            "Un P/FCF très bas n'est pas une preuve d'aubaine : ce peut être une vraie décote, ou un piège de valeur si le marché doute pour une bonne raison.",
            "Ma règle, le fil de tout ce qui suit : juger la qualité du business et le prix de l'action séparément, puis comprendre pourquoi le marché doute."
          ]
        },
        {
          "type": "h2",
          "text": "Le chiffre qui fait saliver, et qui doit rendre méfiant"
        },
        {
          "type": "p",
          "text": "Imagine une entreprise qui te rapporte 100 euros de cash par an, et qu'on te propose d'acheter pour 110 euros. Tu récupères ta mise en un peu plus d'un an, et tout le cash des années suivantes est du bonus. C'est, en gros, ce que dit le marché sur Afya en juin 2026 : un P/FCF de 1,1."
        },
        {
          "type": "p",
          "text": "Le P/FCF, c'est le prix de l'action divisé par le free cash flow qu'elle génère chaque année. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, machines, impôts). Un P/FCF de 1,1 veut dire que tu paies à peine plus d'un an de ce cash. Plus le chiffre est bas, moins c'est cher. À ce niveau, on n'est plus dans le pas cher, on est dans l'anormalement bas."
        },
        {
          "type": "p",
          "text": "Et c'est précisément ce qui doit te rendre prudent. Quand le marché brade une entreprise à ce point, il ne le fait jamais par bonté. Il anticipe quelque chose : un risque, une menace, un cash qui ne durera pas. Mon métier d'analyste, c'est de deviner quoi, avant de me réjouir."
        },
        {
          "type": "h2",
          "text": "Pourquoi je juge la qualité avant de regarder le prix"
        },
        {
          "type": "p",
          "text": "Quand je regarde une action, je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Mélanger les deux, c'est la source d'erreur numéro un."
        },
        {
          "type": "p",
          "text": "Pour la qualité, je ne me fie pas à mon intuition. Je passe l'entreprise au crible de dix critères financiers concrets : est-elle rentable, ses ventes et son cash augmentent-ils, rachète-t-elle ses propres actions plutôt que de gaspiller, sa dette est-elle maîtrisable, son rendement du capital est-il élevé ? Chaque critère réussi vaut un point. Une note de 10 sur 10 veut dire que l'entreprise coche les dix cases, sur des faits comptables, pas sur une histoire."
        },
        {
          "type": "p",
          "text": "Un critère que je surveille de près : le Cash ROCE, le rendement du capital employé mesuré en cash. En clair, pour chaque euro immobilisé dans le business (usines, stocks, fonds de roulement), combien de cash l'entreprise en tire chaque année. Un Cash ROCE élevé veut dire que la machine transforme peu de capital en beaucoup de liquidités : le signe d'un business qui n'a pas besoin d'avaler de l'argent pour croître."
        },
        {
          "type": "h2",
          "text": "Les sept 10/10 sous 5 ans de cash en juin 2026"
        },
        {
          "type": "p",
          "text": "Voici la liste vérifiée, des moins chères aux plus chères, avec leur P/FCF. Lis-la comme une liste de questions à creuser, pas comme une liste de courses."
        },
        {
          "type": "ul",
          "items": [
            "Afya (AFYA), éducation médicale au Brésil : 1,1 fois son cash. Tu la paies à peine plus d'un an de free cash flow.",
            "Universal Insurance (UVE), assurance habitation : 2,9 fois. Moins de trois ans de cash.",
            "RenaissanceRe (RNR), réassurance : 3,0 fois.",
            "Collegium Pharmaceutical (COLL), pharmacie spécialisée : 3,8 fois.",
            "SkyWest (SKYW), aérien régional aux États-Unis : 3,9 fois.",
            "Mercury General (MCY), assurance : 4,0 fois.",
            "Selective Insurance (SIGI), assurance : 4,8 fois."
          ]
        },
        {
          "type": "p",
          "text": "Une chose saute aux yeux : cinq des sept noms touchent de près ou de loin à l'assurance ou à la réassurance (Universal, RenaissanceRe, Mercury, Selective, et le risque pour les autres). Ce n'est pas un hasard. C'est même la première piste pour comprendre pourquoi le marché doute."
        },
        {
          "type": "h2",
          "text": "Pourquoi le marché brade-t-il autant d'assureurs ?"
        },
        {
          "type": "p",
          "text": "L'assurance est un métier cyclique. Une compagnie encaisse des primes, place l'argent, et paie des sinistres. Quand une année est calme, le cash gonfle, le P/FCF s'effondre, et l'action paraît ridiculement bon marché. Mais un seul gros événement (ouragan, incendie, vague de sinistres) peut effacer plusieurs années de bénéfices d'un coup. Le marché le sait. Il refuse donc de payer le cash d'une bonne année comme s'il était garanti chaque année."
        },
        {
          "type": "p",
          "text": "C'est là que la cyclicité devient un piège pour l'oeil non averti. Un assureur à 3 fois son cash n'est pas forcément trois fois moins cher qu'un autre à 9 fois : il peut simplement sortir d'une année exceptionnellement clémente que personne ne croit reproductible. Le bas P/FCF reflète alors un doute légitime, pas une erreur du marché."
        },
        {
          "type": "p",
          "text": "À cela s'ajoutent des risques propres à chaque dossier. Afya est exposée à un seul pays, le Brésil : sa devise, sa réglementation de l'éducation, ses taux. Universal et Mercury sont concentrées sur des zones très exposées aux catastrophes. SkyWest dépend de quelques grandes compagnies aériennes qui lui sous-traitent des vols : perdre un contrat, c'est perdre une partie du chiffre d'affaires d'un trait de plume. Aucun de ces risques n'apparaît dans la note de qualité, qui regarde le passé comptable. Le prix, lui, regarde l'avenir."
        },
        {
          "type": "h2",
          "text": "Décote réelle ou piège de valeur ?"
        },
        {
          "type": "p",
          "text": "Un piège de valeur (value trap en anglais), c'est une action qui paraît bon marché sur les chiffres passés, mais qui le reste parce que l'avenir est moins beau que le passé. Le cash se tarit, la croissance s'arrête, le risque se matérialise, et le prix bas n'était pas une aubaine, juste un avertissement que tu n'avais pas écouté."
        },
        {
          "type": "p",
          "text": "À l'inverse, une vraie décote, c'est une bonne entreprise temporairement mal aimée : le marché surréagit à une peur, le cash continue de couler, et le bas prix finit par se corriger. Tout l'enjeu est de distinguer les deux, et aucun ratio ne le fait à ta place. Un P/FCF faible n'est jamais une bonne affaire en soi : il l'est seulement si la qualité tient ET si le doute du marché est exagéré."
        },
        {
          "type": "p",
          "text": "C'est pour ça que la note de qualité et le prix ne suffisent pas seuls. Un 10/10 me dit que le business a été solide. Un P/FCF sous 5 me dit que le marché doute. Mon travail commence là : pourquoi doute-t-il, et a-t-il raison ? Pour une bonne partie de ces assureurs, le doute porte sur la durabilité du cash dans un métier cyclique. Pour Afya, sur le risque pays. Ce sont des questions auxquelles je réponds dossier par dossier, jamais avec une moyenne."
        },
        {
          "type": "h2",
          "text": "Comment j'utilise cette liste, concrètement"
        },
        {
          "type": "p",
          "text": "Je ne traite pas cette liste comme sept ordres d'achat. Je la traite comme sept invitations à enquêter. Pour chaque nom, je me pose trois questions dans l'ordre : le 10/10 tient-il encore sur les derniers chiffres, ou la qualité s'effrite-t-elle ? Le cash récent est-il représentatif, ou gonflé par une année facile ? Et le risque qui justifie le bas prix est-il déjà connu de tout le monde, ou sous-estimé ?"
        },
        {
          "type": "p",
          "text": "Si tu veux creuser un dossier, tu peux ouvrir sa page d'analyse, par exemple [l'analyse de RenaissanceRe](/analyse/RNR) ou [celle de SkyWest](/analyse/SKYW), pour voir le détail des dix critères et le prix d'achat que je m'autorise. Tu peux aussi parcourir [mon classement des actions notées 10/10](/classement/qualite-10-sur-10) pour la qualité, ou [celui des actions sous-évaluées](/classement/sous-evaluees) côté prix, et repérer les rares cas où les deux s'alignent vraiment. Et si tu veux comprendre comment je note, tout est détaillé dans [ma méthodologie](/methodologie)."
        },
        {
          "type": "h2",
          "text": "Ce que je retiens"
        },
        {
          "type": "p",
          "text": "Un P/FCF sous 5 sur une action 10/10 n'est ni un piège ni une aubaine par défaut : c'est un point de départ. La note me dit que le business a été bon. Le prix me dit que le marché a peur. Mon travail, c'est de comprendre la peur avant de me prononcer, et de ne jamais confondre pas cher avec bonne affaire. Le pas cher, on en trouve partout. La qualité pas chère et justement bradée, beaucoup plus rarement. C'est exactement ce que mon site m'aide à trier en quelques secondes, action par action."
        }
      ],
      "faq": [
        {
          "q": "C'est quoi, un P/FCF sous 5 ?",
          "a": "C'est un prix d'action qui vaut moins de cinq ans du free cash flow généré chaque année. Autrement dit, tu récupères en théorie ta mise en moins de cinq ans de cash. C'est très bon marché, mais un prix aussi bas cache presque toujours une raison qu'il faut comprendre."
        },
        {
          "q": "Pourquoi tant d'assureurs dans cette liste ?",
          "a": "Parce que l'assurance est cyclique. Une année calme gonfle le cash et écrase le P/FCF, mais un seul gros sinistre peut effacer plusieurs années de bénéfices. Le marché refuse donc de payer le cash d'une bonne année comme s'il était garanti, d'où des P/FCF structurellement bas."
        },
        {
          "q": "Une action 10/10 à bas prix est-elle forcément une bonne affaire ?",
          "a": "Non. Le 10/10 juge la qualité passée sur des faits comptables, pas l'avenir. Un bas prix peut être une vraie décote ou un piège de valeur si le cash se tarit. Il faut toujours comprendre pourquoi le marché doute avant de conclure."
        },
        {
          "q": "C'est quoi un piège de valeur ?",
          "a": "Une action qui paraît bon marché sur les chiffres passés mais qui le reste parce que l'avenir est moins bon : le cash baisse, la croissance s'arrête, le risque se réalise. Le prix bas n'était pas une aubaine, juste un avertissement ignoré."
        },
        {
          "q": "Comment je sépare la qualité du prix ?",
          "a": "Je note la qualité sur dix critères financiers objectifs (rentabilité, croissance, rachats, dette, rendement du capital). Le prix, je le mesure à part avec le P/FCF. Une action n'est intéressante que si la qualité tient et que le prix est bas pour de mauvaises raisons exagérées par le marché. Ceci n'est pas un conseil en investissement."
        }
      ],
      "tags": [
        "Méthode",
        "Valorisation",
        "Assurance",
        "Piège de valeur"
      ],
      "disclaimer": "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres à la date de publication (juin 2026), susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "10/10 stocks paid under 5 years of cash: a trap?",
      "excerpt": "Seven companies I score 10/10 trade at under 5 years of the cash they generate. Bargain or trap? Here is how I separate quality from price, and why the market doubts.",
      "metaDescription": "Seven stocks scored 10/10 trade at a P/FCF below 5 in June 2026. Real discount or value trap? My method to separate quality from price and dig into the doubt.",
      "answer": "In June 2026, seven companies I score 10/10 on quality trade at under five years of the cash they generate. That is rare, and tempting. But a very low price usually hides a reason. Here is how I separate quality from price, and why I always dig into the market's doubt before drawing conclusions.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Seven stocks I score 10/10 on quality show a P/FCF below 5 in June 2026: you pay less than five years of the cash they generate.",
            "The most extreme: Afya, at 1.1 times its cash, barely more than a year. Universal Insurance at 2.9, RenaissanceRe at 3.0.",
            "Many are insurers or reinsurers: that is no accident, it is the heart of this piece.",
            "A very low P/FCF is not proof of a bargain: it can be a real discount, or a value trap if the market doubts for a good reason.",
            "My rule, the thread of everything below: judge the quality of the business and the price of the stock separately, then understand why the market doubts."
          ]
        },
        {
          "type": "h2",
          "text": "The number that makes you salivate, and should make you cautious"
        },
        {
          "type": "p",
          "text": "Picture a company that brings you 100 dollars of cash a year, offered to you for 110 dollars. You get your stake back in a little over a year, and all the cash in the years after is a bonus. That is, roughly, what the market says about Afya in June 2026: a P/FCF of 1.1."
        },
        {
          "type": "p",
          "text": "P/FCF is the share price divided by the free cash flow it generates each year. Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, machines, taxes). A P/FCF of 1.1 means you pay barely more than one year of that cash. The lower the number, the cheaper it is. At this level, we are no longer in cheap territory, we are in abnormally low territory."
        },
        {
          "type": "p",
          "text": "And that is exactly what should make you careful. When the market dumps a company this hard, it never does it out of kindness. It is anticipating something: a risk, a threat, cash that will not last. My job as an analyst is to guess what, before getting excited."
        },
        {
          "type": "h2",
          "text": "Why I judge quality before looking at the price"
        },
        {
          "type": "p",
          "text": "When I look at a stock, I always separate two questions most people confuse. One: is this a good company? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. Mixing the two is the number one source of error."
        },
        {
          "type": "p",
          "text": "For quality, I do not trust my gut. I run the company through ten concrete financial criteria: is it profitable, are its sales and cash growing, does it buy back its own shares rather than waste money, is its debt manageable, is its return on capital high? Each criterion passed is worth one point. A score of 10 out of 10 means the company ticks all ten boxes, on accounting facts, not on a story."
        },
        {
          "type": "p",
          "text": "One criterion I watch closely: Cash ROCE, the return on capital employed measured in cash. In plain terms, for every dollar tied up in the business (plants, inventory, working capital), how much cash the company pulls out each year. A high Cash ROCE means the machine turns little capital into a lot of liquidity: the sign of a business that does not need to swallow money to grow."
        },
        {
          "type": "h2",
          "text": "The seven 10/10 stocks under 5 years of cash in June 2026"
        },
        {
          "type": "p",
          "text": "Here is the verified list, from cheapest to least cheap, with their P/FCF. Read it as a list of questions to dig into, not a shopping list."
        },
        {
          "type": "ul",
          "items": [
            "Afya (AFYA), medical education in Brazil: 1.1 times its cash. You pay barely more than one year of free cash flow.",
            "Universal Insurance (UVE), home insurance: 2.9 times. Less than three years of cash.",
            "RenaissanceRe (RNR), reinsurance: 3.0 times.",
            "Collegium Pharmaceutical (COLL), specialty pharma: 3.8 times.",
            "SkyWest (SKYW), regional aviation in the United States: 3.9 times.",
            "Mercury General (MCY), insurance: 4.0 times.",
            "Selective Insurance (SIGI), insurance: 4.8 times."
          ]
        },
        {
          "type": "p",
          "text": "One thing jumps out: five of the seven names touch insurance or reinsurance one way or another (Universal, RenaissanceRe, Mercury, Selective, plus the risk angle for the rest). That is no accident. It is the first lead to understand why the market doubts."
        },
        {
          "type": "h2",
          "text": "Why is the market dumping so many insurers?"
        },
        {
          "type": "p",
          "text": "Insurance is a cyclical business. A company collects premiums, invests the money, and pays claims. When a year is quiet, cash swells, P/FCF collapses, and the stock looks ridiculously cheap. But a single big event (a hurricane, a fire, a wave of claims) can wipe out several years of profit at once. The market knows this. So it refuses to pay the cash of a good year as if it were guaranteed every year."
        },
        {
          "type": "p",
          "text": "This is where cyclicality becomes a trap for the untrained eye. An insurer at 3 times its cash is not necessarily three times cheaper than one at 9 times: it may simply be coming off an unusually mild year nobody believes is repeatable. The low P/FCF then reflects a legitimate doubt, not a market error."
        },
        {
          "type": "p",
          "text": "On top of that come risks specific to each case. Afya is exposed to a single country, Brazil: its currency, its education regulation, its rates. Universal and Mercury are concentrated in areas highly exposed to catastrophes. SkyWest depends on a few large airlines that subcontract flights to it: losing a contract means losing a chunk of revenue with a stroke of a pen. None of these risks shows up in the quality score, which looks at the accounting past. The price, on the other hand, looks at the future."
        },
        {
          "type": "h2",
          "text": "Real discount or value trap?"
        },
        {
          "type": "p",
          "text": "A value trap is a stock that looks cheap on past figures but stays cheap because the future is less rosy than the past. Cash dries up, growth stops, the risk materializes, and the low price was not a bargain, just a warning you failed to hear."
        },
        {
          "type": "p",
          "text": "Conversely, a real discount is a good company that is temporarily unloved: the market overreacts to a fear, the cash keeps flowing, and the low price eventually corrects. The whole challenge is telling the two apart, and no ratio does it for you. A low P/FCF is never a bargain in itself: it only is if the quality holds AND the market's doubt is overblown."
        },
        {
          "type": "p",
          "text": "That is why the quality score and the price are not enough on their own. A 10/10 tells me the business has been solid. A P/FCF below 5 tells me the market doubts. My work begins there: why does it doubt, and is it right? For a good chunk of these insurers, the doubt is about the durability of cash in a cyclical business. For Afya, about country risk. These are questions I answer case by case, never with an average."
        },
        {
          "type": "h2",
          "text": "How I actually use this list"
        },
        {
          "type": "p",
          "text": "I do not treat this list as seven buy orders. I treat it as seven invitations to investigate. For each name, I ask three questions in order: does the 10/10 still hold on the latest figures, or is quality eroding? Is recent cash representative, or inflated by an easy year? And is the risk that justifies the low price already known to everyone, or underestimated?"
        },
        {
          "type": "p",
          "text": "If you want to dig into a case, you can open its analysis page, for example [the RenaissanceRe analysis](/analyse/RNR) or [the SkyWest one](/analyse/SKYW), to see the detail of the ten criteria and the buy price I allow myself. You can also browse [my ranking of 10/10 stocks](/classement/qualite-10-sur-10) on quality, or [the undervalued ones](/classement/sous-evaluees) on price, and spot the rare cases where both truly align. And if you want to understand how I score, it is all laid out in [my methodology](/methodologie)."
        },
        {
          "type": "h2",
          "text": "What I take away"
        },
        {
          "type": "p",
          "text": "A P/FCF below 5 on a 10/10 stock is neither a trap nor a bargain by default: it is a starting point. The score tells me the business has been good. The price tells me the market is afraid. My job is to understand the fear before forming a view, and never to confuse cheap with a good deal. Cheap is everywhere. Quality that is cheap and rightly dumped is far rarer. That is exactly what my site helps me sort in a few seconds, stock by stock."
        }
      ],
      "faq": [
        {
          "q": "What is a P/FCF below 5?",
          "a": "It is a share price worth less than five years of the free cash flow generated each year. In other words, in theory you recover your stake in under five years of cash. That is very cheap, but such a low price almost always hides a reason you need to understand."
        },
        {
          "q": "Why so many insurers on this list?",
          "a": "Because insurance is cyclical. A quiet year swells cash and crushes the P/FCF, but a single big loss can wipe out several years of profit. So the market refuses to pay the cash of a good year as if it were guaranteed, which keeps P/FCF structurally low."
        },
        {
          "q": "Is a cheap 10/10 stock always a good deal?",
          "a": "No. The 10/10 judges past quality on accounting facts, not the future. A low price can be a real discount or a value trap if cash dries up. You must always understand why the market doubts before concluding."
        },
        {
          "q": "What is a value trap?",
          "a": "A stock that looks cheap on past figures but stays cheap because the future is worse: cash falls, growth stops, the risk materializes. The low price was not a bargain, just a warning that was ignored."
        },
        {
          "q": "How do I separate quality from price?",
          "a": "I score quality on ten objective financial criteria (profitability, growth, buybacks, debt, return on capital). Price I measure separately with the P/FCF. A stock is only interesting if quality holds and the price is low for bad reasons the market has overblown. This is not investment advice."
        }
      ],
      "tags": [
        "Method",
        "Valuation",
        "Insurance",
        "Value trap"
      ],
      "disclaimer": "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date (June 2026), subject to change. Do your own research."
    },
    "es": {
      "title": "Acciones 10/10 a menos de 5 años de caja: trampa?",
      "excerpt": "Siete empresas que puntúo 10/10 cotizan a menos de 5 años de la caja que generan. Ganga o trampa? Así separo la calidad del precio, y por qué el mercado duda.",
      "metaDescription": "Siete acciones puntuadas 10/10 cotizan con un P/FCF por debajo de 5 en junio de 2026. Descuento real o trampa de valor? Mi método para separar calidad y precio.",
      "answer": "En junio de 2026, siete empresas que puntúo 10/10 en calidad cotizan a menos de cinco años de la caja que generan. Es raro, y tentador. Pero un precio muy bajo suele esconder una razón. Así separo la calidad del precio, y por qué siempre indago en la duda del mercado antes de concluir.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Siete acciones que puntúo 10/10 en calidad muestran un P/FCF por debajo de 5 en junio de 2026: pagas menos de cinco años de la caja que generan.",
            "La más extrema: Afya, a 1,1 veces su caja, apenas más de un año. Universal Insurance a 2,9, RenaissanceRe a 3,0.",
            "Muchas son aseguradoras o reaseguradoras: no es casualidad, es el núcleo de este artículo.",
            "Un P/FCF muy bajo no es prueba de ganga: puede ser un descuento real, o una trampa de valor si el mercado duda por una buena razón.",
            "Mi regla, el hilo de todo lo que sigue: juzgar la calidad del negocio y el precio de la acción por separado, y luego entender por qué duda el mercado."
          ]
        },
        {
          "type": "h2",
          "text": "La cifra que hace salivar, y que debe ponerte en guardia"
        },
        {
          "type": "p",
          "text": "Imagina una empresa que te aporta 100 euros de caja al año, y que te ofrecen comprar por 110 euros. Recuperas tu inversión en algo más de un año, y toda la caja de los años siguientes es un extra. Eso es, a grandes rasgos, lo que dice el mercado sobre Afya en junio de 2026: un P/FCF de 1,1."
        },
        {
          "type": "p",
          "text": "El P/FCF es el precio de la acción dividido por el flujo de caja libre que genera cada año. El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, máquinas, impuestos). Un P/FCF de 1,1 significa que pagas apenas más de un año de esa caja. Cuanto más baja la cifra, más barato es. A este nivel ya no estamos en lo barato, estamos en lo anormalmente bajo."
        },
        {
          "type": "p",
          "text": "Y eso es precisamente lo que debe hacerte prudente. Cuando el mercado malvende una empresa hasta este punto, nunca lo hace por bondad. Anticipa algo: un riesgo, una amenaza, una caja que no durará. Mi oficio de analista es adivinar qué, antes de alegrarme."
        },
        {
          "type": "h2",
          "text": "Por qué juzgo la calidad antes de mirar el precio"
        },
        {
          "type": "p",
          "text": "Cuando miro una acción, siempre separo dos preguntas que la mayoría confunde. Una: es una buena empresa? Dos, completamente aparte: es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Mezclar las dos es la fuente de error número uno."
        },
        {
          "type": "p",
          "text": "Para la calidad, no me fío de mi intuición. Paso la empresa por un tamiz de diez criterios financieros concretos: es rentable, crecen sus ventas y su caja, recompra sus propias acciones en lugar de derrochar, es manejable su deuda, es alto su rendimiento del capital? Cada criterio superado vale un punto. Una nota de 10 sobre 10 significa que la empresa marca las diez casillas, sobre hechos contables, no sobre una historia."
        },
        {
          "type": "p",
          "text": "Un criterio que vigilo de cerca: el Cash ROCE, el rendimiento del capital empleado medido en caja. En claro, por cada euro inmovilizado en el negocio (fábricas, existencias, capital de trabajo), cuánta caja saca la empresa cada año. Un Cash ROCE alto significa que la máquina convierte poco capital en mucha liquidez: la señal de un negocio que no necesita tragar dinero para crecer."
        },
        {
          "type": "h2",
          "text": "Las siete 10/10 a menos de 5 años de caja en junio de 2026"
        },
        {
          "type": "p",
          "text": "Aquí está la lista verificada, de las más baratas a las menos baratas, con su P/FCF. Léela como una lista de preguntas para indagar, no como una lista de la compra."
        },
        {
          "type": "ul",
          "items": [
            "Afya (AFYA), educación médica en Brasil: 1,1 veces su caja. La pagas apenas más de un año de flujo de caja libre.",
            "Universal Insurance (UVE), seguro de hogar: 2,9 veces. Menos de tres años de caja.",
            "RenaissanceRe (RNR), reaseguro: 3,0 veces.",
            "Collegium Pharmaceutical (COLL), farmacia especializada: 3,8 veces.",
            "SkyWest (SKYW), aviación regional en Estados Unidos: 3,9 veces.",
            "Mercury General (MCY), seguros: 4,0 veces.",
            "Selective Insurance (SIGI), seguros: 4,8 veces."
          ]
        },
        {
          "type": "p",
          "text": "Una cosa salta a la vista: cinco de los siete nombres rozan de cerca o de lejos el seguro o el reaseguro (Universal, RenaissanceRe, Mercury, Selective, y el ángulo de riesgo para el resto). No es casualidad. Es la primera pista para entender por qué duda el mercado."
        },
        {
          "type": "h2",
          "text": "Por qué malvende el mercado tantas aseguradoras?"
        },
        {
          "type": "p",
          "text": "El seguro es un negocio cíclico. Una compañía cobra primas, invierte el dinero y paga siniestros. Cuando un año es tranquilo, la caja se hincha, el P/FCF se desploma y la acción parece ridículamente barata. Pero un solo gran evento (huracán, incendio, oleada de siniestros) puede borrar varios años de beneficio de golpe. El mercado lo sabe. Por eso se niega a pagar la caja de un buen año como si estuviera garantizada cada año."
        },
        {
          "type": "p",
          "text": "Ahí es donde la ciclicidad se vuelve una trampa para el ojo inexperto. Una aseguradora a 3 veces su caja no es necesariamente tres veces más barata que otra a 9 veces: puede simplemente venir de un año excepcionalmente benigno que nadie cree repetible. El bajo P/FCF refleja entonces una duda legítima, no un error del mercado."
        },
        {
          "type": "p",
          "text": "A eso se suman riesgos propios de cada caso. Afya está expuesta a un solo país, Brasil: su divisa, su regulación de la educación, sus tipos. Universal y Mercury están concentradas en zonas muy expuestas a catástrofes. SkyWest depende de unas pocas grandes aerolíneas que le subcontratan vuelos: perder un contrato es perder una parte de la facturación de un plumazo. Ninguno de estos riesgos aparece en la nota de calidad, que mira el pasado contable. El precio, en cambio, mira el futuro."
        },
        {
          "type": "h2",
          "text": "Descuento real o trampa de valor?"
        },
        {
          "type": "p",
          "text": "Una trampa de valor (value trap en inglés) es una acción que parece barata según las cifras pasadas, pero que sigue barata porque el futuro es menos bonito que el pasado. La caja se agota, el crecimiento se para, el riesgo se materializa, y el precio bajo no era una ganga, solo un aviso que no escuchaste."
        },
        {
          "type": "p",
          "text": "A la inversa, un descuento real es una buena empresa pasajeramente poco querida: el mercado sobrerreacciona a un miedo, la caja sigue fluyendo, y el precio bajo acaba corrigiéndose. Todo el reto es distinguir las dos, y ningún ratio lo hace por ti. Un P/FCF bajo nunca es una ganga en sí mismo: solo lo es si la calidad aguanta Y si la duda del mercado es exagerada."
        },
        {
          "type": "p",
          "text": "Por eso la nota de calidad y el precio no bastan solos. Un 10/10 me dice que el negocio ha sido sólido. Un P/FCF por debajo de 5 me dice que el mercado duda. Mi trabajo empieza ahí: por qué duda, y tiene razón? Para buena parte de estas aseguradoras, la duda es sobre la durabilidad de la caja en un negocio cíclico. Para Afya, sobre el riesgo país. Son preguntas que respondo caso por caso, nunca con una media."
        },
        {
          "type": "h2",
          "text": "Cómo uso esta lista, en concreto"
        },
        {
          "type": "p",
          "text": "No trato esta lista como siete órdenes de compra. La trato como siete invitaciones a investigar. Para cada nombre me hago tres preguntas en orden: aguanta aún el 10/10 con las últimas cifras, o se erosiona la calidad? Es representativa la caja reciente, o inflada por un año fácil? Y el riesgo que justifica el precio bajo, ya lo conoce todo el mundo, o está subestimado?"
        },
        {
          "type": "p",
          "text": "Si quieres profundizar en un caso, puedes abrir su página de análisis, por ejemplo [el análisis de RenaissanceRe](/analyse/RNR) o [el de SkyWest](/analyse/SKYW), para ver el detalle de los diez criterios y el precio de compra que me permito. También puedes recorrer [mi clasificación de acciones 10/10](/classement/qualite-10-sur-10) en calidad, o [la de acciones infravaloradas](/classement/sous-evaluees) en precio, y detectar los raros casos en que ambas se alinean de verdad. Y si quieres entender cómo puntúo, está todo detallado en [mi metodología](/methodologie)."
        },
        {
          "type": "h2",
          "text": "Lo que me quedo"
        },
        {
          "type": "p",
          "text": "Un P/FCF por debajo de 5 en una acción 10/10 no es ni una trampa ni una ganga por defecto: es un punto de partida. La nota me dice que el negocio ha sido bueno. El precio me dice que el mercado tiene miedo. Mi trabajo es entender el miedo antes de pronunciarme, y no confundir nunca barato con buena operación. Barato hay en todas partes. Calidad barata y justamente malvendida, mucho más raro. Eso es exactamente lo que mi sitio me ayuda a clasificar en unos segundos, acción por acción."
        }
      ],
      "faq": [
        {
          "q": "Qué es un P/FCF por debajo de 5?",
          "a": "Es un precio de acción que vale menos de cinco años del flujo de caja libre generado cada año. Dicho de otro modo, en teoría recuperas tu inversión en menos de cinco años de caja. Es muy barato, pero un precio tan bajo casi siempre esconde una razón que hay que entender."
        },
        {
          "q": "Por qué tantas aseguradoras en esta lista?",
          "a": "Porque el seguro es cíclico. Un año tranquilo hincha la caja y aplasta el P/FCF, pero un solo gran siniestro puede borrar varios años de beneficio. Por eso el mercado se niega a pagar la caja de un buen año como si estuviera garantizada, y eso mantiene el P/FCF estructuralmente bajo."
        },
        {
          "q": "Una acción 10/10 barata es siempre una buena operación?",
          "a": "No. El 10/10 juzga la calidad pasada sobre hechos contables, no el futuro. Un precio bajo puede ser un descuento real o una trampa de valor si la caja se agota. Siempre hay que entender por qué duda el mercado antes de concluir."
        },
        {
          "q": "Qué es una trampa de valor?",
          "a": "Una acción que parece barata según las cifras pasadas pero que sigue barata porque el futuro es peor: la caja baja, el crecimiento se para, el riesgo se realiza. El precio bajo no era una ganga, solo un aviso ignorado."
        },
        {
          "q": "Cómo separo la calidad del precio?",
          "a": "Puntúo la calidad sobre diez criterios financieros objetivos (rentabilidad, crecimiento, recompras, deuda, rendimiento del capital). El precio lo mido aparte con el P/FCF. Una acción solo es interesante si la calidad aguanta y el precio es bajo por malas razones exageradas por el mercado. Esto no es un consejo de inversión."
        }
      ],
      "tags": [
        "Método",
        "Valoración",
        "Seguros",
        "Trampa de valor"
      ],
      "disclaimer": "Análisis con fines informativos y educativos, no es un consejo de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a la fecha de publicación (junio de 2026), sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const reperer10sous: Article = {
  "slug": "reperer-actions-10-10-sous-evaluees",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 11,
  "content": {
    "fr": {
      "title": "Repérer une action excellente et pas chère",
      "excerpt": "Ma méthode en deux temps pour trouver une action à la fois de qualité et sous-évaluée : la qualité d'abord, le prix ensuite, jugés séparément. Avec trois exemples vérifiés en juin 2026.",
      "metaDescription": "Comment je repère une action excellente et pas chère : note qualité sur 10, puis prix via le P/FCF et son percentile. Méthode en deux temps, 3 exemples.",
      "answer": "Je sépare toujours deux questions : l'entreprise est-elle excellente, et le prix est-il bas. Une note de qualité sur 10 juge le business sans regarder le cours. Ensuite le P/FCF, comparé à son propre passé, juge le prix. Quand les deux s'alignent, je tiens une vraie opportunité.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Je ne mélange jamais deux questions : la qualité du business d'un côté, le prix de l'action de l'autre.",
            "La qualité, je la résume dans une note sur 10, calculée sur dix critères chiffrés objectifs (rentabilité, croissance, marges, dette, génération de cash).",
            "Le prix, je le juge à part avec le P/FCF (prix rapporté au cash généré), comparé à son propre historique via le percentile.",
            "Une opportunité, c'est rare : qualité 10/10 ET P/FCF dans le bas de sa propre fourchette historique.",
            "Trois exemples vérifiés en juin 2026 : RenaissanceRe, MercadoLibre, Roper. La règle : jamais la qualité à n'importe quel prix, jamais le pas cher sans vérifier la qualité."
          ]
        },
        {
          "type": "h2",
          "text": "L'erreur qui ruine la plupart des décisions"
        },
        {
          "type": "p",
          "text": "La première fois que j'ai voulu acheter une action, j'ai fait la bêtise que presque tout le monde fait : j'ai regardé le prix et la qualité dans la même seconde, comme une seule impression. \"Belle boîte, action pas chère, j'achète.\" Erreur. Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Tant que ces deux choses se brouillent dans ta tête, tu prends de mauvaises décisions sans même t'en rendre compte."
        },
        {
          "type": "p",
          "text": "Alors j'ai fini par tout couper en deux. Une question : est-ce une bonne entreprise. Une autre, complètement à part : est-ce un bon prix. Je réponds à la première sans jamais regarder le cours, puis seulement à la seconde. Cet article te montre exactement comment je m'y prends, en deux temps, avec trois cas réels de juin 2026."
        },
        {
          "type": "h2",
          "text": "Temps 1 : l'entreprise est-elle excellente (la qualité)"
        },
        {
          "type": "p",
          "text": "Je ne me fie pas à mon intuition, ni à la réputation d'une marque. Je passe l'entreprise au crible de dix critères financiers chiffrés et objectifs, puis je résume tout dans une note de qualité sur 10. Une note de 10/10 ne dit rien du prix de l'action : elle dit que le business coche, un par un, mes dix critères de solidité. C'est une mesure du business, pas une recommandation d'achat."
        },
        {
          "type": "p",
          "text": "Concrètement, ces dix critères regardent : la rentabilité, la croissance du chiffre d'affaires (les ventes) et du cash par action, les rachats d'actions (l'entreprise réduit son nombre d'actions plutôt que de gaspiller), les marges, le Cash ROCE, l'endettement, la conversion du bénéfice en cash, et le cycle de trésorerie. Si l'entreprise coche les dix, elle décroche 10/10."
        },
        {
          "type": "p",
          "text": "Deux termes méritent une explication, car ce sont eux qui séparent une vraie machine à cash d'une entreprise qui semble belle de loin. Le premier : la marge de free cash flow. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, machines, impôts). Une marge de free cash flow de 30 %, ça veut dire que sur 100 euros de ventes, 30 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10."
        },
        {
          "type": "p",
          "text": "Le second : le Cash ROCE. C'est le rendement du capital investi, mais mesuré en cash réel et non en bénéfice comptable. En clair : pour chaque euro mis dans la machine, combien de cash en ressort chaque année. Un Cash ROCE élevé veut dire que l'entreprise transforme efficacement ses investissements en argent disponible. C'est, pour moi, l'un des signes les plus fiables d'un bon business. Si tu veux le détail complet de ces dix critères, je l'explique dans ma [méthodologie](/methodologie)."
        },
        {
          "type": "h2",
          "text": "Pourquoi une note sur 10, et pas juste mon avis"
        },
        {
          "type": "p",
          "text": "Parce que mon avis fluctue, et qu'il se laisse séduire par une belle histoire. Une note chiffrée, non. Elle applique exactement les mêmes dix critères à toutes les actions, sans état d'âme. C'est aussi mon filtre principal contre le piège que je vais décrire plus bas : si une action est pas chère mais note mal, je passe mon chemin sans regret."
        },
        {
          "type": "p",
          "text": "Surtout, la note règle la première question une bonne fois pour toutes. Une fois que je sais qu'une entreprise est 10/10, je n'ai plus à débattre de sa solidité. Il ne me reste qu'une chose à trancher : est-ce que le marché me la propose à un prix correct. Et ça, c'est le temps 2."
        },
        {
          "type": "h2",
          "text": "Temps 2 : le prix est-il bas (jugé séparément)"
        },
        {
          "type": "p",
          "text": "Pour mesurer ce que le marché demande, j'utilise un ratio simple : le P/FCF (price to free cash flow), le prix de l'action rapporté au free cash flow qu'elle génère chaque année. Un P/FCF de 10×, ça veut dire que tu paies aujourd'hui dix années de ce cash. Plus c'est bas, moins c'est cher. Le sens d'abord, le chiffre ensuite : un P/FCF de 1,1×, ce serait payer à peine plus d'un an du cash généré, donc très bon marché."
        },
        {
          "type": "p",
          "text": "Mais un P/FCF brut ne dit pas grand-chose seul. 14× pour une entreprise, c'est cher ou bon marché. La seule façon honnête de répondre, c'est de comparer ce chiffre à ce que cette même action s'est payé dans le passé. C'est là qu'intervient le percentile. Un percentile, c'est une position dans un classement, de 0 à 100. Dire que le P/FCF est au percentile 4, ça veut dire qu'il est plus bas que pendant 96 % de son propre passé : l'action ne s'est presque jamais payée aussi peu cher. Au percentile 0, c'est le point le plus bas jamais observé."
        },
        {
          "type": "p",
          "text": "Je préfère cette mesure à un simple \"c'est moins cher que la moyenne du secteur\", parce qu'elle compare l'entreprise à elle-même. Une excellente entreprise mérite souvent un multiple plus élevé que la moyenne. Ce que je cherche, ce n'est pas qu'elle soit absolument la moins chère du marché, c'est qu'elle se paie peu cher par rapport à son propre standard. Quand le percentile est dans le décile bas (les 10 % les moins chers de son histoire), le marché lui fait un prix inhabituel."
        },
        {
          "type": "h2",
          "text": "Une opportunité, c'est quand les deux s'alignent"
        },
        {
          "type": "p",
          "text": "Voilà le coeur de la méthode. Je marque une action \"opportunité\" seulement quand les deux temps disent oui en même temps : qualité 10/10 ET P/FCF dans le bas de sa propre fourchette historique. Pas l'un sans l'autre. C'est rare, et ça doit l'être : un excellent business à un prix inhabituellement bas, ça ne court pas les rues."
        },
        {
          "type": "p",
          "text": "Trois cas vérifiés en juin 2026, sans rien inventer sur les chiffres. RenaissanceRe (ticker RNR), un réassureur, note 10/10 et se paie 3,0× son free cash flow, au percentile 4 : moins cher que pendant 96 % de son passé. MercadoLibre (ticker MELI), le géant du e-commerce et du paiement en Amérique latine, note 10/10 à 6,8×, au percentile 0, soit le point le moins cher jamais observé. Roper (ticker ROP), un conglomérat de logiciels, note 10/10 à 14,4×, au percentile 8."
        },
        {
          "type": "p",
          "text": "Note bien : Roper se paie 14,4×, presque cinq fois plus cher que RenaissanceRe en valeur absolue. Pourtant les deux sont des opportunités. Pourquoi. Parce que 14,4× est bas pour Roper, une entreprise qui a presque toujours mérité un multiple élevé. C'est exactement pour ça que je compare chaque action à son propre passé, et pas seulement à ses voisines. Tu peux retrouver ce genre de profils dans mon [classement des actions sous-évaluées](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "Le piège : pas cher ne veut jamais dire bonne affaire"
        },
        {
          "type": "p",
          "text": "C'est l'erreur que je veux t'éviter. Quand une action affiche un P/FCF très bas, le réflexe est de crier à l'aubaine. Mauvaise idée. Une action peut être bon marché pour une excellente raison : l'entreprise décline pour de bon, et le marché a raison de la payer peu. On appelle ça un value trap, un piège de la valeur. Tu crois acheter une décote, tu achètes un déclin."
        },
        {
          "type": "p",
          "text": "C'est précisément à ça que sert la note de qualité. Le percentile bas, seul, n'est jamais un signal d'achat : c'est juste un prix bas, et un prix bas peut être parfaitement justifié. Je n'achète bon marché que ce qui note aussi 10/10. La qualité d'abord, le prix ensuite, jamais l'inverse."
        },
        {
          "type": "p",
          "text": "Le piège fonctionne aussi dans l'autre sens, et il est plus sournois. Une entreprise 10/10 peut être un placement décevant si tu la paies au sommet de son historique. La qualité ne te protège pas d'un mauvais prix d'entrée. C'est pour ça que je ne me contente jamais de la note : même pour mes [actions notées 10/10 sur la qualité](/classement/qualite-10-sur-10), je vérifie toujours le P/FCF et son percentile avant de bouger."
        },
        {
          "type": "h2",
          "text": "Comment j'applique ça, sans émotion"
        },
        {
          "type": "p",
          "text": "Ma routine tient en trois gestes. Un : je regarde la note sur 10. Si elle n'est pas excellente, je m'arrête là, peu importe le prix. Deux : si elle est bonne, je regarde le P/FCF et surtout son percentile, pour savoir si l'action se paie cher ou pas par rapport à son propre passé. Trois : je n'agis que quand les deux s'alignent, et sinon je note le ticker et j'attends que le prix vienne à moi."
        },
        {
          "type": "p",
          "text": "Cette discipline a un effet libérateur : elle m'évite de débattre avec mes émotions. Je n'ai pas à \"sentir\" si une action est une bonne affaire. J'ai deux réponses chiffrées, indépendantes, et une règle simple pour les combiner. Le marché peut paniquer ou s'emballer, ma grille, elle, ne bouge pas."
        },
        {
          "type": "p",
          "text": "C'est exactement ce que je voulais pouvoir faire en quelques secondes pour n'importe quelle action : juger la qualité d'un business d'un côté, son prix de l'autre, et repérer les rares cas où les deux s'alignent. Comme je ne trouvais pas l'outil, je l'ai construit. Tu peux y taper un ticker, comme [RenaissanceRe](/analyse/RNR), pour voir sa note sur 10 et son P/FCF en percentile d'un coup d'oeil. Le pas cher, on en trouve partout. La qualité pas chère, beaucoup plus rarement."
        },
        {
          "type": "h2",
          "text": "En clair"
        },
        {
          "type": "p",
          "text": "Repérer une action excellente et pas chère, ce n'est pas une question de flair, c'est une question de méthode en deux temps. La qualité se juge sur dix critères chiffrés, résumés dans une note sur 10. Le prix se juge à part, avec le P/FCF replacé dans son propre historique via le percentile. Les deux ne se mélangent jamais. Et l'opportunité, la vraie, c'est seulement quand les deux disent oui."
        }
      ],
      "faq": [
        {
          "q": "C'est quoi, la note de qualité sur 10 ?",
          "a": "C'est un résumé chiffré de la solidité d'un business, calculé sur dix critères financiers objectifs : rentabilité, croissance des ventes et du cash par action, rachats d'actions, marges, Cash ROCE, endettement, conversion en cash, cycle de trésorerie. Une note de 10/10 dit que l'entreprise coche tous mes critères, indépendamment du prix de l'action."
        },
        {
          "q": "C'est quoi le P/FCF, et pourquoi le percentile ?",
          "a": "Le P/FCF (price to free cash flow) rapporte le prix de l'action au cash qu'elle génère chaque année. Un P/FCF de 7× veut dire que tu paies sept années de ce cash. Le percentile replace ce chiffre dans l'historique de l'action : percentile 4 signifie qu'elle est moins chère que pendant 96 % de son passé."
        },
        {
          "q": "Pourquoi juger la qualité et le prix séparément ?",
          "a": "Parce que ce sont deux questions différentes. Une entreprise géniale payée trop cher reste un mauvais placement ; une entreprise médiocre, même bradée, reste médiocre. En les jugeant à part, je repère les rares cas où un excellent business se paie à un prix inhabituellement bas, et j'évite de confondre une décote avec un déclin."
        },
        {
          "q": "Un P/FCF bas, est-ce toujours une bonne affaire ?",
          "a": "Non. Un prix bas peut cacher une entreprise en déclin : c'est le value trap, le piège de la valeur. Un percentile bas n'est intéressant que si la note de qualité est aussi au rendez-vous. D'où ma règle : la qualité d'abord, le prix ensuite, jamais l'inverse."
        },
        {
          "q": "Une note 10/10 suffit-elle pour acheter ?",
          "a": "Non. Une excellente entreprise payée au sommet de son historique peut décevoir : la qualité ne protège pas d'un mauvais prix d'entrée. Je vérifie toujours le P/FCF et son percentile avant d'agir. Ceci n'est pas un conseil en investissement personnalisé, fais tes propres recherches."
        }
      ],
      "tags": [
        "Méthode",
        "Qualité",
        "Valorisation",
        "Sous-évaluées"
      ],
      "disclaimer": "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 11 juin 2026, susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "Spotting an excellent and cheap stock",
      "excerpt": "My two-step method to find a stock that is both high quality and undervalued: quality first, price second, judged separately. With three examples verified in June 2026.",
      "metaDescription": "How I spot a stock that is both excellent and cheap: a quality score out of 10, then price via P/FCF and its percentile. Two-step method, 3 examples.",
      "answer": "I always separate two questions: is the company excellent, and is the price low. A quality score out of 10 judges the business without looking at the stock price. Then the P/FCF, compared to its own past, judges the price. When the two line up, I have a real opportunity.",
      "body": [
        {
          "type": "ul",
          "items": [
            "I never mix two questions: the quality of the business on one side, the price of the stock on the other.",
            "Quality, I sum it up in a score out of 10, computed on ten objective numerical criteria (profitability, growth, margins, debt, cash generation).",
            "Price, I judge separately with the P/FCF (price relative to the cash generated), compared to its own history via the percentile.",
            "An opportunity is rare: a 10/10 quality score AND a P/FCF at the low end of its own historical range.",
            "Three examples verified in June 2026: RenaissanceRe, MercadoLibre, Roper. The rule: never quality at any price, never cheap without checking quality."
          ]
        },
        {
          "type": "h2",
          "text": "The mistake that ruins most decisions"
        },
        {
          "type": "p",
          "text": "The first time I wanted to buy a stock, I made the blunder almost everyone makes: I looked at price and quality in the same second, as a single impression. \"Nice company, cheap stock, I buy.\" Wrong. A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. As long as those two things blur together in your head, you make bad decisions without even noticing."
        },
        {
          "type": "p",
          "text": "So I ended up splitting everything in two. One question: is this a good company. Another, entirely apart: is this a good price. I answer the first without ever looking at the stock price, then only the second. This article shows you exactly how I go about it, in two steps, with three real cases from June 2026."
        },
        {
          "type": "h2",
          "text": "Step 1: is the company excellent (quality)"
        },
        {
          "type": "p",
          "text": "I do not trust my gut, nor a brand's reputation. I run the company through ten objective numerical financial criteria, then sum it all up in a quality score out of 10. A 10/10 score says nothing about the stock's price: it says the business checks, one by one, my ten soundness criteria. It is a measure of the business, not a buy recommendation."
        },
        {
          "type": "p",
          "text": "Concretely, these ten criteria look at: profitability, growth in revenue (sales) and in cash per share, share buybacks (the company shrinks its share count rather than wasting money), margins, Cash ROCE, debt, the conversion of profit into cash, and the cash cycle. If the company checks all ten, it earns 10/10."
        },
        {
          "type": "p",
          "text": "Two terms deserve an explanation, because they are what separates a true cash machine from a company that looks nice from afar. The first: the free cash flow margin. Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, machines, taxes). A free cash flow margin of 30% means that on 100 dollars of sales, 30 end up as genuinely available cash. Most companies top out around 10."
        },
        {
          "type": "p",
          "text": "The second: Cash ROCE. It is the return on capital employed, but measured in real cash rather than accounting profit. In plain terms: for each dollar put into the machine, how much cash comes back out each year. A high Cash ROCE means the company turns its investments into available cash efficiently. To me, it is one of the most reliable signs of a good business. If you want the full detail of these ten criteria, I explain it in my [methodology](/methodologie)."
        },
        {
          "type": "h2",
          "text": "Why a score out of 10, and not just my opinion"
        },
        {
          "type": "p",
          "text": "Because my opinion fluctuates, and it lets itself be seduced by a nice story. A numerical score does not. It applies exactly the same ten criteria to every stock, with no soft spot. It is also my main filter against the trap I will describe below: if a stock is cheap but scores poorly, I walk away without regret."
        },
        {
          "type": "p",
          "text": "Above all, the score settles the first question once and for all. Once I know a company is 10/10, I no longer have to debate its soundness. Only one thing is left to decide: whether the market is offering it to me at a fair price. And that is step 2."
        },
        {
          "type": "h2",
          "text": "Step 2: is the price low (judged separately)"
        },
        {
          "type": "p",
          "text": "To gauge what the market is asking, I use a simple ratio: the P/FCF (price to free cash flow), the stock's price relative to the free cash flow it generates each year. A P/FCF of 10x means you are paying ten years of that cash today. The lower it is, the cheaper it is. Meaning first, number second: a P/FCF of 1.1x would mean paying barely more than one year of the cash generated, so very cheap."
        },
        {
          "type": "p",
          "text": "But a raw P/FCF says little on its own. 14x for a company, is that expensive or cheap. The only honest way to answer is to compare that number to what this same stock has paid in the past. That is where the percentile comes in. A percentile is a position in a ranking, from 0 to 100. Saying the P/FCF is at percentile 4 means it is lower than during 96% of its own past: the stock has almost never been this cheap. At percentile 0, it is the lowest point ever observed."
        },
        {
          "type": "p",
          "text": "I prefer this measure to a plain \"it is cheaper than the sector average\", because it compares the company to itself. An excellent company often deserves a higher multiple than average. What I look for is not that it is the absolute cheapest on the market, but that it trades cheap relative to its own standard. When the percentile is in the bottom decile (the 10% cheapest of its history), the market is giving it an unusual price."
        },
        {
          "type": "h2",
          "text": "An opportunity is when the two line up"
        },
        {
          "type": "p",
          "text": "This is the heart of the method. I flag a stock as an \"opportunity\" only when both steps say yes at the same time: a 10/10 quality score AND a P/FCF at the low end of its own historical range. Not one without the other. It is rare, and it should be: an excellent business at an unusually low price does not grow on trees."
        },
        {
          "type": "p",
          "text": "Three cases verified in June 2026, inventing nothing on the figures. RenaissanceRe (ticker RNR), a reinsurer, scores 10/10 and trades at 3.0x its free cash flow, at percentile 4: cheaper than during 96% of its past. MercadoLibre (ticker MELI), the Latin American e-commerce and payments giant, scores 10/10 at 6.8x, at percentile 0, the cheapest point ever observed. Roper (ticker ROP), a software conglomerate, scores 10/10 at 14.4x, at percentile 8."
        },
        {
          "type": "p",
          "text": "Notice this: Roper trades at 14.4x, nearly five times more expensive than RenaissanceRe in absolute terms. Yet both are opportunities. Why. Because 14.4x is low for Roper, a company that has almost always deserved a high multiple. That is exactly why I compare each stock to its own past, and not just to its neighbors. You can find this kind of profile in my [ranking of undervalued stocks](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "The trap: cheap never means a bargain"
        },
        {
          "type": "p",
          "text": "This is the mistake I want to spare you. When a stock shows a very low P/FCF, the reflex is to cry bargain. Bad idea. A stock can be cheap for an excellent reason: the company is genuinely in decline, and the market is right to pay little for it. We call this a value trap. You think you are buying a discount, you are buying a decline."
        },
        {
          "type": "p",
          "text": "That is precisely what the quality score is for. A low percentile, on its own, is never a buy signal: it is just a low price, and a low price can be perfectly justified. I only buy cheap what also scores 10/10. Quality first, price second, never the other way around."
        },
        {
          "type": "p",
          "text": "The trap works the other way too, and it is sneakier. A 10/10 company can be a disappointing investment if you pay for it at the top of its history. Quality does not protect you from a bad entry price. That is why I never settle for the score alone: even for my [stocks rated 10/10 on quality](/classement/qualite-10-sur-10), I always check the P/FCF and its percentile before I move."
        },
        {
          "type": "h2",
          "text": "How I apply this, without emotion"
        },
        {
          "type": "p",
          "text": "My routine comes down to three gestures. One: I look at the score out of 10. If it is not excellent, I stop there, whatever the price. Two: if it is good, I look at the P/FCF and above all its percentile, to know whether the stock trades expensive or not relative to its own past. Three: I act only when the two line up, and otherwise I note the ticker and wait for the price to come to me."
        },
        {
          "type": "p",
          "text": "This discipline has a freeing effect: it spares me from arguing with my emotions. I do not have to \"feel\" whether a stock is a bargain. I have two numerical answers, independent, and a simple rule to combine them. The market may panic or get carried away; my grid does not budge."
        },
        {
          "type": "p",
          "text": "That is exactly what I wanted to be able to do in seconds for any stock: judge a business's quality on one side, its price on the other, and spot the rare cases where the two line up. Since I could not find the tool, I built it. You can type a ticker, like [RenaissanceRe](/analyse/RNR), to see its score out of 10 and its P/FCF percentile at a glance. Cheap is everywhere. Quality on the cheap, far rarer."
        },
        {
          "type": "h2",
          "text": "In plain terms"
        },
        {
          "type": "p",
          "text": "Spotting a stock that is both excellent and cheap is not a matter of flair, it is a matter of a two-step method. Quality is judged on ten numerical criteria, summed up in a score out of 10. Price is judged separately, with the P/FCF placed back in its own history via the percentile. The two never mix. And the real opportunity is only when both say yes."
        }
      ],
      "faq": [
        {
          "q": "What is the quality score out of 10?",
          "a": "It is a numerical summary of a business's soundness, computed on ten objective financial criteria: profitability, growth in sales and in cash per share, share buybacks, margins, Cash ROCE, debt, conversion into cash, the cash cycle. A 10/10 score says the company checks all my criteria, independent of the stock price."
        },
        {
          "q": "What is P/FCF, and why the percentile?",
          "a": "The P/FCF (price to free cash flow) compares the stock's price to the cash it generates each year. A P/FCF of 7x means you pay seven years of that cash. The percentile places that number in the stock's history: percentile 4 means it is cheaper than during 96% of its past."
        },
        {
          "q": "Why judge quality and price separately?",
          "a": "Because they are two different questions. A great company bought too expensive is still a bad investment; a mediocre company, even dirt cheap, stays mediocre. By judging them apart, I spot the rare cases where an excellent business trades at an unusually low price, and I avoid mistaking a discount for a decline."
        },
        {
          "q": "Is a low P/FCF always a bargain?",
          "a": "No. A low price can hide a company in decline: that is the value trap. A low percentile is only attractive if the quality score is there too. Hence my rule: quality first, price second, never the other way around."
        },
        {
          "q": "Is a 10/10 score enough to buy?",
          "a": "No. An excellent company paid for at the top of its history can disappoint: quality does not protect you from a bad entry price. I always check the P/FCF and its percentile before acting. This is not personalized investment advice, do your own research."
        }
      ],
      "tags": [
        "Method",
        "Quality",
        "Valuation",
        "Undervalued"
      ],
      "disclaimer": "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 11, 2026, subject to change. Do your own research."
    },
    "es": {
      "title": "Detectar una acción excelente y barata",
      "excerpt": "Mi método en dos tiempos para encontrar una acción a la vez de calidad e infravalorada: primero la calidad, después el precio, juzgados por separado. Con tres ejemplos verificados en junio de 2026.",
      "metaDescription": "Cómo detecto una acción a la vez excelente y barata: una nota de calidad sobre 10, luego el precio vía P/FCF y su percentil. Método en dos tiempos, 3 ejemplos.",
      "answer": "Siempre separo dos preguntas: ¿es excelente la empresa, y es bajo el precio? Una nota de calidad sobre 10 juzga el negocio sin mirar la cotización. Después el P/FCF, comparado con su propio pasado, juzga el precio. Cuando ambos se alinean, tengo una oportunidad real.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Nunca mezclo dos preguntas: la calidad del negocio por un lado, el precio de la acción por el otro.",
            "La calidad la resumo en una nota sobre 10, calculada con diez criterios numéricos objetivos (rentabilidad, crecimiento, márgenes, deuda, generación de caja).",
            "El precio lo juzgo aparte con el P/FCF (precio respecto a la caja generada), comparado con su propio historial mediante el percentil.",
            "Una oportunidad es rara: nota de calidad 10/10 Y un P/FCF en la parte baja de su propio rango histórico.",
            "Tres ejemplos verificados en junio de 2026: RenaissanceRe, MercadoLibre, Roper. La regla: nunca la calidad a cualquier precio, nunca lo barato sin comprobar la calidad."
          ]
        },
        {
          "type": "h2",
          "text": "El error que arruina la mayoría de las decisiones"
        },
        {
          "type": "p",
          "text": "La primera vez que quise comprar una acción cometí el error que casi todo el mundo comete: miré el precio y la calidad en el mismo segundo, como una sola impresión. \"Buena empresa, acción barata, compro.\" Error. Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Mientras esas dos cosas se confundan en tu cabeza, tomas malas decisiones sin darte ni cuenta."
        },
        {
          "type": "p",
          "text": "Así que acabé partiéndolo todo en dos. Una pregunta: ¿es una buena empresa? Otra, completamente aparte: ¿es un buen precio? Respondo a la primera sin mirar nunca la cotización, y solo después a la segunda. Este artículo te muestra exactamente cómo lo hago, en dos tiempos, con tres casos reales de junio de 2026."
        },
        {
          "type": "h2",
          "text": "Tiempo 1: ¿es excelente la empresa? (la calidad)"
        },
        {
          "type": "p",
          "text": "No me fío de mi intuición, ni de la reputación de una marca. Paso la empresa por un tamiz de diez criterios financieros numéricos y objetivos, y luego lo resumo todo en una nota de calidad sobre 10. Una nota de 10/10 no dice nada del precio de la acción: dice que el negocio cumple, uno a uno, mis diez criterios de solidez. Es una medida del negocio, no una recomendación de compra."
        },
        {
          "type": "p",
          "text": "En concreto, estos diez criterios miran: la rentabilidad, el crecimiento de la facturación (las ventas) y de la caja por acción, las recompras de acciones (la empresa reduce su número de acciones en lugar de derrochar), los márgenes, el Cash ROCE, el endeudamiento, la conversión del beneficio en caja y el ciclo de tesorería. Si la empresa cumple los diez, obtiene 10/10."
        },
        {
          "type": "p",
          "text": "Dos términos merecen una explicación, porque son los que separan una verdadera máquina de generar caja de una empresa que se ve bonita de lejos. El primero: el margen de flujo de caja libre. El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, máquinas, impuestos). Un margen de flujo de caja libre del 30 % significa que de cada 100 euros de ventas, 30 acaban en caja realmente disponible. La mayoría de las empresas no pasan del 10."
        },
        {
          "type": "p",
          "text": "El segundo: el Cash ROCE. Es la rentabilidad del capital empleado, pero medida en caja real y no en beneficio contable. En claro: por cada euro metido en la máquina, cuánta caja sale cada año. Un Cash ROCE alto significa que la empresa transforma con eficacia sus inversiones en dinero disponible. Para mí es una de las señales más fiables de un buen negocio. Si quieres el detalle completo de estos diez criterios, lo explico en mi [metodología](/methodologie)."
        },
        {
          "type": "h2",
          "text": "Por qué una nota sobre 10, y no solo mi opinión"
        },
        {
          "type": "p",
          "text": "Porque mi opinión fluctúa, y se deja seducir por una buena historia. Una nota numérica no. Aplica exactamente los mismos diez criterios a todas las acciones, sin debilidades. Es además mi filtro principal contra la trampa que describiré más abajo: si una acción es barata pero puntúa mal, sigo mi camino sin arrepentirme."
        },
        {
          "type": "p",
          "text": "Sobre todo, la nota zanja la primera pregunta de una vez por todas. Una vez que sé que una empresa es 10/10, ya no tengo que debatir su solidez. Solo me queda una cosa que decidir: si el mercado me la ofrece a un precio correcto. Y eso es el tiempo 2."
        },
        {
          "type": "h2",
          "text": "Tiempo 2: ¿es bajo el precio? (juzgado por separado)"
        },
        {
          "type": "p",
          "text": "Para medir lo que pide el mercado, uso un ratio sencillo: el P/FCF (price to free cash flow), el precio de la acción respecto al flujo de caja libre que genera cada año. Un P/FCF de 10× significa que pagas hoy diez años de esa caja. Cuanto más bajo, más barato. El sentido primero, el número después: un P/FCF de 1,1× sería pagar apenas algo más de un año de la caja generada, así que muy barato."
        },
        {
          "type": "p",
          "text": "Pero un P/FCF en bruto dice poco por sí solo. 14× para una empresa, ¿es caro o barato? La única forma honesta de responder es comparar ese número con lo que esa misma acción ha pagado en el pasado. Ahí entra el percentil. Un percentil es una posición en una clasificación, de 0 a 100. Decir que el P/FCF está en el percentil 4 significa que está más bajo que durante el 96 % de su propio pasado: la acción casi nunca se ha pagado tan barata. En el percentil 0, es el punto más bajo jamás observado."
        },
        {
          "type": "p",
          "text": "Prefiero esta medida a un simple \"está más barata que la media del sector\", porque compara la empresa consigo misma. Una empresa excelente suele merecer un múltiplo más alto que la media. Lo que busco no es que sea la más barata del mercado en términos absolutos, sino que se pague barata respecto a su propio estándar. Cuando el percentil está en el decil bajo (el 10 % más barato de su historia), el mercado le pone un precio inusual."
        },
        {
          "type": "h2",
          "text": "Una oportunidad es cuando ambos se alinean"
        },
        {
          "type": "p",
          "text": "Este es el corazón del método. Marco una acción como \"oportunidad\" solo cuando los dos tiempos dicen que sí a la vez: nota de calidad 10/10 Y un P/FCF en la parte baja de su propio rango histórico. No uno sin el otro. Es raro, y debe serlo: un negocio excelente a un precio inusualmente bajo no abunda."
        },
        {
          "type": "p",
          "text": "Tres casos verificados en junio de 2026, sin inventar nada en las cifras. RenaissanceRe (ticker RNR), una reaseguradora, puntúa 10/10 y cotiza a 3,0× su flujo de caja libre, en el percentil 4: más barata que durante el 96 % de su pasado. MercadoLibre (ticker MELI), el gigante del comercio electrónico y los pagos en América Latina, puntúa 10/10 a 6,8×, en el percentil 0, el punto más barato jamás observado. Roper (ticker ROP), un conglomerado de software, puntúa 10/10 a 14,4×, en el percentil 8."
        },
        {
          "type": "p",
          "text": "Fíjate bien: Roper cotiza a 14,4×, casi cinco veces más cara que RenaissanceRe en valor absoluto. Y sin embargo ambas son oportunidades. ¿Por qué? Porque 14,4× es bajo para Roper, una empresa que casi siempre ha merecido un múltiplo alto. Por eso justamente comparo cada acción con su propio pasado, y no solo con sus vecinas. Puedes encontrar este tipo de perfiles en mi [clasificación de acciones infravaloradas](/classement/sous-evaluees)."
        },
        {
          "type": "h2",
          "text": "La trampa: barato nunca significa ganga"
        },
        {
          "type": "p",
          "text": "Este es el error que quiero evitarte. Cuando una acción muestra un P/FCF muy bajo, el reflejo es gritar ganga. Mala idea. Una acción puede estar barata por una excelente razón: la empresa declina de verdad, y el mercado tiene razón al pagar poco por ella. A esto lo llamamos value trap, trampa de valor. Crees comprar un descuento, compras un declive."
        },
        {
          "type": "p",
          "text": "Para eso sirve precisamente la nota de calidad. Un percentil bajo, por sí solo, nunca es una señal de compra: es solo un precio bajo, y un precio bajo puede estar perfectamente justificado. Solo compro barato lo que también puntúa 10/10. Primero la calidad, después el precio, nunca al revés."
        },
        {
          "type": "p",
          "text": "La trampa funciona también en sentido inverso, y es más taimada. Una empresa 10/10 puede ser una inversión decepcionante si la pagas en lo más alto de su historia. La calidad no te protege de un mal precio de entrada. Por eso nunca me conformo con la nota sola: incluso con mis [acciones con nota 10/10 en calidad](/classement/qualite-10-sur-10), siempre compruebo el P/FCF y su percentil antes de moverme."
        },
        {
          "type": "h2",
          "text": "Cómo aplico esto, sin emoción"
        },
        {
          "type": "p",
          "text": "Mi rutina se reduce a tres gestos. Uno: miro la nota sobre 10. Si no es excelente, me detengo ahí, sea cual sea el precio. Dos: si es buena, miro el P/FCF y sobre todo su percentil, para saber si la acción se paga cara o no respecto a su propio pasado. Tres: solo actúo cuando ambos se alinean, y si no, anoto el ticker y espero a que el precio venga a mí."
        },
        {
          "type": "p",
          "text": "Esta disciplina tiene un efecto liberador: me evita discutir con mis emociones. No tengo que \"sentir\" si una acción es una ganga. Tengo dos respuestas numéricas, independientes, y una regla sencilla para combinarlas. El mercado puede entrar en pánico o embalarse; mi rejilla no se mueve."
        },
        {
          "type": "p",
          "text": "Es exactamente lo que quería poder hacer en unos segundos para cualquier acción: juzgar la calidad de un negocio por un lado, su precio por el otro, y detectar los raros casos en que ambos se alinean. Como no encontraba la herramienta, la construí. Puedes teclear un ticker, como [RenaissanceRe](/analyse/RNR), para ver su nota sobre 10 y su P/FCF en percentil de un vistazo. Lo barato se encuentra en todas partes. La calidad barata, mucho más raramente."
        },
        {
          "type": "h2",
          "text": "En claro"
        },
        {
          "type": "p",
          "text": "Detectar una acción a la vez excelente y barata no es cuestión de olfato, es cuestión de un método en dos tiempos. La calidad se juzga con diez criterios numéricos, resumidos en una nota sobre 10. El precio se juzga aparte, con el P/FCF situado de nuevo en su propio historial mediante el percentil. Los dos nunca se mezclan. Y la oportunidad, la de verdad, solo aparece cuando ambos dicen que sí."
        }
      ],
      "faq": [
        {
          "q": "¿Qué es la nota de calidad sobre 10?",
          "a": "Es un resumen numérico de la solidez de un negocio, calculado con diez criterios financieros objetivos: rentabilidad, crecimiento de ventas y de caja por acción, recompras de acciones, márgenes, Cash ROCE, endeudamiento, conversión en caja, ciclo de tesorería. Una nota de 10/10 dice que la empresa cumple todos mis criterios, al margen del precio de la acción."
        },
        {
          "q": "¿Qué es el P/FCF, y por qué el percentil?",
          "a": "El P/FCF (price to free cash flow) compara el precio de la acción con la caja que genera cada año. Un P/FCF de 7× significa que pagas siete años de esa caja. El percentil sitúa ese número en el historial de la acción: percentil 4 significa que está más barata que durante el 96 % de su pasado."
        },
        {
          "q": "¿Por qué juzgar calidad y precio por separado?",
          "a": "Porque son dos preguntas distintas. Una empresa genial comprada demasiado cara sigue siendo una mala inversión; una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Al juzgarlas aparte, detecto los raros casos en que un negocio excelente se paga a un precio inusualmente bajo, y evito confundir un descuento con un declive."
        },
        {
          "q": "¿Un P/FCF bajo es siempre una ganga?",
          "a": "No. Un precio bajo puede ocultar una empresa en declive: es el value trap, la trampa de valor. Un percentil bajo solo es interesante si la nota de calidad también está presente. De ahí mi regla: primero la calidad, después el precio, nunca al revés."
        },
        {
          "q": "¿Basta una nota 10/10 para comprar?",
          "a": "No. Una empresa excelente pagada en lo más alto de su historia puede decepcionar: la calidad no te protege de un mal precio de entrada. Siempre compruebo el P/FCF y su percentil antes de actuar. Esto no es asesoramiento de inversión personalizado, haz tu propia investigación."
        }
      ],
      "tags": [
        "Método",
        "Calidad",
        "Valoración",
        "Infravaloradas"
      ],
      "disclaimer": "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 11 de junio de 2026, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const topMoinsCheres: Article = {
  "slug": "top-actions-10-10-moins-cheres-juin-2026",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 9,
  "content": {
    "fr": {
      "title": "Actions notées 10/10 les moins chères : juin 2026",
      "excerpt": "Cinq entreprises à la qualité comptable parfaite, payées une à quatre années de cash. Ce que chacune fait, et pourquoi le marché les boude encore.",
      "metaDescription": "Cinq actions notées 10/10 et payées entre 1,1 et 3,9 fois leur cash en juin 2026 : ce que fait chaque entreprise, et la tension qui les rend si peu chères.",
      "answer": "En juin 2026, cinq actions cumulent une qualité comptable parfaite, notée 10/10, et un prix très bas. Afya, Universal Insurance, RenaissanceRe, Collegium et SkyWest se paient entre 1,1 et 3,9 fois leur cash annuel. Bonne note ne veut pas dire bonne affaire : chacune porte une tension qui explique ce prix.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Une note de 10/10 ne juge que la qualité du business : elle vient de faits comptables (rentabilité, croissance, cash, dette), pas d'une opinion sur l'action.",
            "Le P/FCF mesure le prix, pas la qualité : un P/FCF de 1,1 veut dire que tu paies à peine plus d'un an du cash généré, donc très bon marché.",
            "Top par P/FCF croissant en juin 2026 : Afya 1,1 fois, Universal Insurance 2,9, RenaissanceRe 3,0, Collegium 3,8, SkyWest 3,9.",
            "Si peu cher avec une note parfaite, ça cache toujours une tension : pays émergent, ouragans, fin de brevet, cyclicité. Le prix bas paie ce risque.",
            "Le fil de tout l'article : la qualité d'un business et le prix de son action se jugent séparément."
          ]
        },
        {
          "type": "h2",
          "text": "Ce que veut dire une note de 10/10"
        },
        {
          "type": "p",
          "text": "Sur mon site, chaque action reçoit une note de qualité sur 10. Cette note ne dit rien du prix. Elle répond à une seule question : est-ce un bon business ? Et elle y répond avec des faits comptables, pas avec une intuition. Est-ce rentable, les ventes montent-elles, le cash suit-il, l'entreprise rachète-t-elle ses actions plutôt que de gaspiller, la dette est-elle maîtrisable ? Une note de 10/10, ça veut dire que tous ces voyants sont au vert, en même temps. C'est rare."
        },
        {
          "type": "p",
          "text": "Pourquoi je sépare la qualité du prix dès le départ ? Parce que mélanger les deux est l'erreur numéro un. Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre, même bradée, reste médiocre. Une note parfaite ne te dit donc pas d'acheter. Elle te dit juste : le business, lui, tient debout. Le prix, c'est une autre conversation."
        },
        {
          "type": "h2",
          "text": "Le P/FCF, en une phrase"
        },
        {
          "type": "p",
          "text": "Pour le prix, je regarde un ratio simple : le P/FCF (price to free cash flow, prix sur flux de trésorerie libre). Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, machines, impôts). Le P/FCF, c'est le prix de l'action divisé par ce cash annuel. Un P/FCF de 1,1, ça veut dire que tu paies à peine plus d'un an du cash généré. Plus c'est bas, moins c'est cher."
        },
        {
          "type": "p",
          "text": "Maintenant, le piège : un P/FCF aussi bas, avec une qualité parfaite, ne tombe pas du ciel. Le marché n'est pas idiot. S'il brade une belle machine, c'est qu'il a peur de quelque chose. Mon travail, c'est de nommer cette peur pour chaque cas, et de te laisser juger si elle est exagérée ou justifiée. Voici les cinq, du moins cher au moins moins cher."
        },
        {
          "type": "h2",
          "text": "Afya (AFYA) : 1,1 fois le cash, le moins cher du lot"
        },
        {
          "type": "p",
          "text": "Secteur : éducation. Afya forme des médecins au Brésil, des facultés de médecine privées jusqu'à la formation continue des praticiens. C'est l'action la moins chère de la sélection, à 1,1 fois son free cash flow. Autrement dit, au prix actuel, l'entreprise génère en un peu plus d'un an l'équivalent de sa valeur en cash. Sur le papier, c'est presque indécent."
        },
        {
          "type": "p",
          "text": "La tension ? Le risque pays. Afya est brésilienne, cotée via une structure étrangère, exposée à la monnaie locale, à la réglementation de l'enseignement médical et à des taux d'intérêt qui ont longtemps été parmi les plus élevés du monde. Quand un investisseur achète un actif émergent, il exige une décote, une réduction de prix pour compenser ce risque. C'est cette décote que tu vois dans le 1,1. La qualité du business est réelle, le doute porte sur l'environnement, pas sur les comptes."
        },
        {
          "type": "h2",
          "text": "Universal Insurance (UVE) : 2,9 fois, l'assureur de la Floride"
        },
        {
          "type": "p",
          "text": "Secteur : assurance. Universal Insurance assure surtout des habitations en Floride. À 2,9 fois son cash, l'action est très bon marché pour une entreprise notée 10/10. Et là, la tension saute aux yeux : la Floride, c'est l'État des ouragans."
        },
        {
          "type": "p",
          "text": "Un assureur habitation concentré sur une zone à catastrophes naturelles vit avec une épée au-dessus de la tête. Une saison cyclonique violente peut transformer une année rentable en année de pertes. Le marché paie donc ce risque de queue, ce scénario rare mais brutal, par une décote permanente. La note de 10/10 reflète des comptes solides aujourd'hui. Le prix bas reflète la crainte du ciel de demain. Les deux peuvent être vrais en même temps."
        },
        {
          "type": "h2",
          "text": "RenaissanceRe (RNR) : 3,0 fois, la réassurance"
        },
        {
          "type": "p",
          "text": "Secteur : réassurance. RenaissanceRe est un réassureur : en clair, l'assureur des assureurs. Quand une compagnie d'assurance veut se protéger d'un sinistre géant, elle se réassure auprès d'acteurs comme RNR. À 3,0 fois son cash, c'est l'une des affaires les plus solides de cette liste, et pourtant l'une des moins chères."
        },
        {
          "type": "p",
          "text": "La tension rejoint celle d'Universal, en plus large : la réassurance encaisse des primes régulières et paie, parfois, des sinistres énormes et imprévisibles (ouragans, tremblements de terre, grandes catastrophes). Les résultats sont donc volatils par nature. Le marché déteste la volatilité des bénéfices et la sanctionne par un multiple bas, même quand l'entreprise a prouvé qu'elle savait gérer le risque sur la durée. C'est exactement le genre d'endroit où un prix bas peut récompenser celui qui supporte l'irrégularité."
        },
        {
          "type": "h2",
          "text": "Collegium Pharmaceutical (COLL) : 3,8 fois, le brevet qui court"
        },
        {
          "type": "p",
          "text": "Secteur : pharmacie. Collegium Pharmaceutical commercialise des traitements de la douleur, dont une gamme conçue pour limiter les abus. À 3,8 fois son cash, l'action reste très peu chère. Mais ici, la tension a un nom précis que tout investisseur en pharma connaît : le mur des brevets."
        },
        {
          "type": "p",
          "text": "Un laboratoire vit de molécules protégées par des brevets. Tant que le brevet court, l'entreprise est seule sur son produit et encaisse des marges grasses. Le jour où il tombe, les génériques arrivent et le cash peut s'effondrer. Le marché regarde donc moins le cash d'aujourd'hui que la durée de vie restante des brevets. Un P/FCF de 3,8 traduit cette inquiétude : tu paies très peu, parce que le marché doute que le cash dure. Toute la thèse tient à la capacité de Collegium à renouveler son portefeuille avant l'échéance."
        },
        {
          "type": "h2",
          "text": "SkyWest (SKYW) : 3,9 fois, l'aérien régional"
        },
        {
          "type": "p",
          "text": "Secteur : transport aérien. SkyWest opère des vols régionaux aux États-Unis, le plus souvent sous les couleurs des grandes compagnies (American, Delta, United) via des contrats. À 3,9 fois son cash, c'est la cinquième de mon classement, et la tension est celle de tout le secteur aérien : la cyclicité."
        },
        {
          "type": "p",
          "text": "L'aérien dépend du prix du carburant, de l'emploi des pilotes, du cycle économique et de la santé des grands transporteurs qui lui sous-traitent les lignes. Quand l'économie tousse, les voyages baissent et les coûts fixes (avions, maintenance) restent. Le marché applique donc historiquement des multiples bas aux compagnies aériennes, par méfiance envers cette dépendance au cycle. Une note de 10/10 dit que SkyWest gère bien ses comptes ici et maintenant. Le 3,9 dit que le marché reste prudent sur la suite du cycle."
        },
        {
          "type": "h2",
          "text": "Pourquoi une note parfaite ne suffit jamais"
        },
        {
          "type": "p",
          "text": "Tu as peut-être remarqué le fil rouge : pour chacune, la note de 10/10 dit la même chose (le business est sain), et le prix bas raconte une peur différente (pays émergent, ouragans, brevets, cycle). C'est précisément pour ça que je juge la qualité et le prix séparément. La note te donne le socle. Le P/FCF te donne la mise. La tension te dit ce que tu achètes vraiment."
        },
        {
          "type": "p",
          "text": "Un P/FCF très bas n'est jamais une bonne affaire en soi. Il l'est seulement si tu penses que la peur du marché est exagérée et que la qualité va tenir. Si tu crois que l'ouragan, le brevet ou la récession vont vraiment frapper, alors le prix bas n'est pas une aubaine, c'est un avertissement. Le bon réflexe, c'est de partir de la liste des entreprises notées 10/10, puis de croiser avec les moins chères, et enfin de lire chaque tension à froid."
        },
        {
          "type": "p",
          "text": "Tu peux explorer toi-même ces deux angles : la liste complète des entreprises notées 10/10 sur [le classement qualité 10/10](/classement/qualite-10-sur-10), et celles que le marché paie le moins cher sur [le classement des actions sous-évaluées](/classement/sous-evaluees). Croiser les deux, c'est exactement ce que ce palmarès fait pour toi. C'est aussi, en une phrase, pourquoi j'ai construit ce site : pouvoir juger la qualité et le prix d'une action en quelques secondes, séparément, pour ne plus confondre une bonne entreprise et une bonne affaire."
        }
      ],
      "faq": [
        {
          "q": "Une action notée 10/10 est-elle un bon achat ?",
          "a": "Pas forcément. La note juge seulement la qualité du business, à partir de faits comptables. Le prix se juge à part, avec le P/FCF. Une note parfaite payée trop cher reste un mauvais placement, et un prix bas peut cacher un vrai risque."
        },
        {
          "q": "Comment la note de qualité est-elle calculée ?",
          "a": "Sur des critères financiers objectifs : rentabilité, croissance des ventes et du cash, marges, rachats d'actions, endettement, rendement du capital. C'est de la comptabilité, pas une opinion. La note dit si le business est solide, indépendamment du prix de l'action."
        },
        {
          "q": "Un P/FCF de 1,1 veut dire quoi concrètement ?",
          "a": "Que tu paies l'action à peine plus d'un an du cash qu'elle génère. Plus le P/FCF est bas, moins l'action est chère. Mais un chiffre aussi bas signale presque toujours une peur du marché qu'il faut comprendre avant d'acheter."
        },
        {
          "q": "Pourquoi ces cinq actions sont-elles si peu chères ?",
          "a": "Chacune porte une tension : risque pays pour Afya, ouragans pour Universal Insurance et RenaissanceRe, fin de brevet pour Collegium, cyclicité pour SkyWest. Le prix bas paie ce risque. La qualité, elle, reste prouvée par les comptes."
        },
        {
          "q": "Que faire d'un palmarès comme celui-ci ?",
          "a": "S'en servir comme point de départ, pas comme liste de courses. Tu pars des entreprises de qualité, tu repères les moins chères, puis tu juges si la peur du marché est exagérée. C'est une analyse éducative, fais tes propres recherches."
        }
      ],
      "tags": [
        "Palmarès",
        "Qualité",
        "Valorisation",
        "P/FCF"
      ],
      "disclaimer": "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres à la date de publication (juin 2026), susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "Cheapest stocks rated 10/10: June 2026",
      "excerpt": "Five companies with flawless accounting quality, priced at one to four years of cash. What each one does, and why the market still shuns them.",
      "metaDescription": "Five stocks rated 10/10 and priced between 1.1 and 3.9 times their cash in June 2026: what each company does, and the tension that makes them so cheap.",
      "answer": "In June 2026, five stocks combine flawless accounting quality, rated 10/10, with a very low price. Afya, Universal Insurance, RenaissanceRe, Collegium and SkyWest trade between 1.1 and 3.9 times their annual cash. A great score does not mean a great deal: each one carries a tension that explains the price.",
      "body": [
        {
          "type": "ul",
          "items": [
            "A 10/10 score only judges the quality of the business: it comes from accounting facts (profitability, growth, cash, debt), not from an opinion on the stock.",
            "P/FCF measures the price, not the quality: a P/FCF of 1.1 means you pay barely more than one year of the cash generated, so it is very cheap.",
            "Top by rising P/FCF in June 2026: Afya 1.1 times, Universal Insurance 2.9, RenaissanceRe 3.0, Collegium 3.8, SkyWest 3.9.",
            "So cheap with a perfect score always hides a tension: emerging market, hurricanes, patent cliff, cyclicality. The low price pays for that risk.",
            "The thread of this whole piece: the quality of a business and the price of its stock are judged separately."
          ]
        },
        {
          "type": "h2",
          "text": "What a 10/10 score actually means"
        },
        {
          "type": "p",
          "text": "On my site, every stock gets a quality score out of 10. That score says nothing about the price. It answers one question: is this a good business? And it answers with accounting facts, not with a gut feeling. Is it profitable, are sales rising, does cash follow, does the company buy back its shares rather than waste money, is debt manageable? A 10/10 score means all these lights are green at the same time. That is rare."
        },
        {
          "type": "p",
          "text": "Why do I separate quality from price from the start? Because mixing the two is the number one mistake. A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. So a perfect score does not tell you to buy. It only tells you the business itself stands firm. Price is a different conversation."
        },
        {
          "type": "h2",
          "text": "P/FCF, in one sentence"
        },
        {
          "type": "p",
          "text": "For the price, I look at one simple ratio: the P/FCF (price to free cash flow). Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, machines, taxes). P/FCF is the share price divided by that yearly cash. A P/FCF of 1.1 means you pay barely more than one year of the cash generated. The lower it is, the cheaper it is."
        },
        {
          "type": "p",
          "text": "Now the trap: a P/FCF this low, with flawless quality, does not fall from the sky. The market is not stupid. If it gives away a fine machine, it is afraid of something. My job is to name that fear for each case, and let you judge whether it is overblown or justified. Here are the five, from cheapest to least cheap."
        },
        {
          "type": "h2",
          "text": "Afya (AFYA): 1.1 times cash, the cheapest of the lot"
        },
        {
          "type": "p",
          "text": "Sector: education. Afya trains doctors in Brazil, from private medical schools to continuing education for practitioners. It is the cheapest stock in the selection, at 1.1 times its free cash flow. In other words, at the current price, the company generates the equivalent of its value in cash in a little over one year. On paper, it is almost indecent."
        },
        {
          "type": "p",
          "text": "The tension? Country risk. Afya is Brazilian, listed through a foreign structure, exposed to the local currency, to the regulation of medical education, and to interest rates that were long among the highest in the world. When an investor buys an emerging asset, they demand a discount, a price cut to compensate for that risk. That discount is what you see in the 1.1. The quality of the business is real, the doubt is about the environment, not about the accounts."
        },
        {
          "type": "h2",
          "text": "Universal Insurance (UVE): 2.9 times, Florida's insurer"
        },
        {
          "type": "p",
          "text": "Sector: insurance. Universal Insurance mostly insures homes in Florida. At 2.9 times its cash, the stock is very cheap for a company rated 10/10. And here the tension is obvious: Florida is the state of hurricanes."
        },
        {
          "type": "p",
          "text": "A home insurer concentrated in a natural-disaster zone lives with a sword over its head. One violent hurricane season can turn a profitable year into a year of losses. So the market pays for this tail risk, the rare but brutal scenario, with a permanent discount. The 10/10 score reflects solid accounts today. The low price reflects the fear of tomorrow's sky. Both can be true at the same time."
        },
        {
          "type": "h2",
          "text": "RenaissanceRe (RNR): 3.0 times, reinsurance"
        },
        {
          "type": "p",
          "text": "Sector: reinsurance. RenaissanceRe is a reinsurer: in plain words, the insurer of insurers. When an insurance company wants to protect itself from a giant claim, it reinsures with players like RNR. At 3.0 times its cash, it is one of the most solid businesses on this list, and yet one of the cheapest."
        },
        {
          "type": "p",
          "text": "The tension echoes Universal's, on a larger scale: reinsurance collects regular premiums and sometimes pays huge, unpredictable claims (hurricanes, earthquakes, major disasters). Results are therefore volatile by nature. The market hates earnings volatility and punishes it with a low multiple, even when the company has proven it can manage risk over time. This is exactly the kind of place where a low price can reward whoever can stomach the irregularity."
        },
        {
          "type": "h2",
          "text": "Collegium Pharmaceutical (COLL): 3.8 times, the ticking patent"
        },
        {
          "type": "p",
          "text": "Sector: pharmaceuticals. Collegium Pharmaceutical sells pain treatments, including a range designed to limit abuse. At 3.8 times its cash, the stock is still very cheap. But here the tension has a precise name every pharma investor knows: the patent cliff."
        },
        {
          "type": "p",
          "text": "A drugmaker lives off molecules protected by patents. As long as the patent runs, the company is alone with its product and earns fat margins. The day it expires, generics arrive and the cash can collapse. So the market looks less at today's cash than at the remaining life of the patents. A P/FCF of 3.8 reflects that worry: you pay very little, because the market doubts the cash will last. The whole thesis hinges on Collegium's ability to renew its portfolio before the deadline."
        },
        {
          "type": "h2",
          "text": "SkyWest (SKYW): 3.9 times, regional aviation"
        },
        {
          "type": "p",
          "text": "Sector: air transport. SkyWest operates regional flights in the United States, most often under the colors of the major airlines (American, Delta, United) through contracts. At 3.9 times its cash, it is the fifth in my ranking, and the tension is the one of the whole airline sector: cyclicality."
        },
        {
          "type": "p",
          "text": "Aviation depends on fuel prices, pilot employment, the economic cycle, and the health of the major carriers that subcontract routes to it. When the economy stumbles, travel falls and the fixed costs (planes, maintenance) remain. So the market historically applies low multiples to airlines, wary of this dependence on the cycle. A 10/10 score says SkyWest manages its accounts well here and now. The 3.9 says the market stays cautious about the rest of the cycle."
        },
        {
          "type": "h2",
          "text": "Why a perfect score is never enough"
        },
        {
          "type": "p",
          "text": "You may have noticed the common thread: for each one, the 10/10 score says the same thing (the business is healthy), and the low price tells a different fear (emerging market, hurricanes, patents, cycle). That is exactly why I judge quality and price separately. The score gives you the foundation. The P/FCF gives you the bet. The tension tells you what you are really buying."
        },
        {
          "type": "p",
          "text": "A very low P/FCF is never a bargain in itself. It only is if you think the market's fear is overblown and the quality will hold. If you believe the hurricane, the patent or the recession will truly hit, then the low price is not a windfall, it is a warning. The right reflex is to start from the list of companies rated 10/10, cross it with the cheapest ones, and finally read each tension calmly."
        },
        {
          "type": "p",
          "text": "You can explore both angles yourself: the full list of companies rated 10/10 on [the 10/10 quality ranking](/classement/qualite-10-sur-10), and the ones the market prices lowest on [the undervalued stocks ranking](/classement/sous-evaluees). Crossing the two is exactly what this list does for you. It is also, in one sentence, why I built this site: to judge the quality and the price of a stock in a few seconds, separately, so I never again confuse a good company with a good deal."
        }
      ],
      "faq": [
        {
          "q": "Is a stock rated 10/10 a good buy?",
          "a": "Not necessarily. The score only judges the quality of the business, from accounting facts. The price is judged separately, with the P/FCF. A perfect score bought too expensive is still a bad investment, and a low price can hide a real risk."
        },
        {
          "q": "How is the quality score calculated?",
          "a": "On objective financial criteria: profitability, growth in sales and cash, margins, share buybacks, debt, return on capital. It is accounting, not an opinion. The score tells you whether the business is sound, independent of the stock price."
        },
        {
          "q": "What does a P/FCF of 1.1 mean concretely?",
          "a": "That you pay for the stock barely more than one year of the cash it generates. The lower the P/FCF, the cheaper the stock. But a figure this low almost always signals a market fear you should understand before buying."
        },
        {
          "q": "Why are these five stocks so cheap?",
          "a": "Each carries a tension: country risk for Afya, hurricanes for Universal Insurance and RenaissanceRe, a patent cliff for Collegium, cyclicality for SkyWest. The low price pays for that risk. The quality itself stays proven by the accounts."
        },
        {
          "q": "What should you do with a ranking like this?",
          "a": "Use it as a starting point, not a shopping list. You start from quality companies, spot the cheapest, then judge whether the market's fear is overblown. This is an educational analysis, do your own research."
        }
      ],
      "tags": [
        "Ranking",
        "Quality",
        "Valuation",
        "P/FCF"
      ],
      "disclaimer": "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date (June 2026), subject to change. Do your own research."
    },
    "es": {
      "title": "Acciones 10/10 más baratas: junio de 2026",
      "excerpt": "Cinco empresas con calidad contable perfecta, pagadas entre uno y cuatro años de caja. Qué hace cada una y por qué el mercado aún las evita.",
      "metaDescription": "Cinco acciones con nota 10/10 y pagadas entre 1,1 y 3,9 veces su caja en junio de 2026: qué hace cada empresa y la tensión que las hace tan baratas.",
      "answer": "En junio de 2026, cinco acciones combinan una calidad contable perfecta, con nota 10/10, y un precio muy bajo. Afya, Universal Insurance, RenaissanceRe, Collegium y SkyWest cotizan entre 1,1 y 3,9 veces su caja anual. Una gran nota no significa una gran ganga: cada una arrastra una tensión que explica ese precio.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Una nota de 10/10 solo juzga la calidad del negocio: viene de hechos contables (rentabilidad, crecimiento, caja, deuda), no de una opinión sobre la acción.",
            "El P/FCF mide el precio, no la calidad: un P/FCF de 1,1 significa que pagas apenas algo más de un año de la caja generada, así que es muy barato.",
            "Top por P/FCF creciente en junio de 2026: Afya 1,1 veces, Universal Insurance 2,9, RenaissanceRe 3,0, Collegium 3,8, SkyWest 3,9.",
            "Tan barato con una nota perfecta siempre esconde una tensión: país emergente, huracanes, fin de patente, ciclicidad. El precio bajo paga ese riesgo.",
            "El hilo de todo el artículo: la calidad de un negocio y el precio de su acción se juzgan por separado."
          ]
        },
        {
          "type": "h2",
          "text": "Qué significa una nota de 10/10"
        },
        {
          "type": "p",
          "text": "En mi sitio, cada acción recibe una nota de calidad sobre 10. Esa nota no dice nada del precio. Responde a una sola pregunta: ¿es un buen negocio? Y responde con hechos contables, no con una intuición. ¿Es rentable, suben las ventas, sigue la caja, recompra la empresa sus acciones en lugar de derrochar, es manejable la deuda? Una nota de 10/10 significa que todas esas luces están en verde al mismo tiempo. Es raro."
        },
        {
          "type": "p",
          "text": "¿Por qué separo la calidad del precio desde el principio? Porque mezclar las dos es el error número uno. Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, aunque esté tirada de precio, sigue siendo mediocre. Así que una nota perfecta no te dice que compres. Solo te dice que el negocio, en sí, se sostiene. El precio es otra conversación."
        },
        {
          "type": "h2",
          "text": "El P/FCF, en una frase"
        },
        {
          "type": "p",
          "text": "Para el precio, miro un ratio sencillo: el P/FCF (price to free cash flow, precio sobre flujo de caja libre). El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, máquinas, impuestos). El P/FCF es el precio de la acción dividido por esa caja anual. Un P/FCF de 1,1 significa que pagas apenas algo más de un año de la caja generada. Cuanto más bajo, más barato."
        },
        {
          "type": "p",
          "text": "Ahora la trampa: un P/FCF tan bajo, con una calidad perfecta, no cae del cielo. El mercado no es tonto. Si regala una buena máquina, es que teme algo. Mi trabajo es nombrar ese miedo en cada caso y dejarte juzgar si es exagerado o justificado. Aquí están las cinco, de la más barata a la menos barata."
        },
        {
          "type": "h2",
          "text": "Afya (AFYA): 1,1 veces la caja, la más barata del grupo"
        },
        {
          "type": "p",
          "text": "Sector: educación. Afya forma médicos en Brasil, desde facultades de medicina privadas hasta la formación continua de los profesionales. Es la acción más barata de la selección, a 1,1 veces su flujo de caja libre. Dicho de otro modo, al precio actual, la empresa genera el equivalente a su valor en caja en algo más de un año. Sobre el papel, es casi indecente."
        },
        {
          "type": "p",
          "text": "¿La tensión? El riesgo país. Afya es brasileña, cotiza a través de una estructura extranjera, expuesta a la moneda local, a la regulación de la enseñanza médica y a unos tipos de interés que durante mucho tiempo estuvieron entre los más altos del mundo. Cuando un inversor compra un activo emergente, exige un descuento, una rebaja de precio para compensar ese riesgo. Ese descuento es lo que ves en el 1,1. La calidad del negocio es real, la duda está en el entorno, no en las cuentas."
        },
        {
          "type": "h2",
          "text": "Universal Insurance (UVE): 2,9 veces, la aseguradora de Florida"
        },
        {
          "type": "p",
          "text": "Sector: seguros. Universal Insurance asegura sobre todo viviendas en Florida. A 2,9 veces su caja, la acción es muy barata para una empresa con nota 10/10. Y aquí la tensión salta a la vista: Florida es el estado de los huracanes."
        },
        {
          "type": "p",
          "text": "Una aseguradora de hogar concentrada en una zona de catástrofes naturales vive con una espada sobre la cabeza. Una temporada de huracanes violenta puede convertir un año rentable en un año de pérdidas. Por eso el mercado paga ese riesgo de cola, el escenario raro pero brutal, con un descuento permanente. La nota de 10/10 refleja cuentas sólidas hoy. El precio bajo refleja el miedo al cielo de mañana. Las dos cosas pueden ser ciertas a la vez."
        },
        {
          "type": "h2",
          "text": "RenaissanceRe (RNR): 3,0 veces, el reaseguro"
        },
        {
          "type": "p",
          "text": "Sector: reaseguro. RenaissanceRe es una reaseguradora: en pocas palabras, la aseguradora de las aseguradoras. Cuando una compañía de seguros quiere protegerse de un siniestro gigante, se reasegura con actores como RNR. A 3,0 veces su caja, es uno de los negocios más sólidos de esta lista y, sin embargo, de los más baratos."
        },
        {
          "type": "p",
          "text": "La tensión es la de Universal, pero a mayor escala: el reaseguro cobra primas regulares y paga, a veces, siniestros enormes e imprevisibles (huracanes, terremotos, grandes catástrofes). Los resultados son, por naturaleza, volátiles. El mercado detesta la volatilidad de los beneficios y la castiga con un múltiplo bajo, incluso cuando la empresa ha demostrado que sabe gestionar el riesgo a lo largo del tiempo. Es justo el tipo de lugar donde un precio bajo puede recompensar a quien soporta la irregularidad."
        },
        {
          "type": "h2",
          "text": "Collegium Pharmaceutical (COLL): 3,8 veces, la patente que corre"
        },
        {
          "type": "p",
          "text": "Sector: farmacia. Collegium Pharmaceutical comercializa tratamientos del dolor, incluida una gama diseñada para limitar los abusos. A 3,8 veces su caja, la acción sigue siendo muy barata. Pero aquí la tensión tiene un nombre preciso que todo inversor en farmacia conoce: el muro de las patentes."
        },
        {
          "type": "p",
          "text": "Un laboratorio vive de moléculas protegidas por patentes. Mientras la patente corre, la empresa está sola con su producto y obtiene márgenes grasos. El día en que caduca, llegan los genéricos y la caja puede desplomarse. Por eso el mercado mira menos la caja de hoy que la vida restante de las patentes. Un P/FCF de 3,8 refleja esa inquietud: pagas muy poco, porque el mercado duda de que la caja dure. Toda la tesis depende de la capacidad de Collegium para renovar su cartera antes del vencimiento."
        },
        {
          "type": "h2",
          "text": "SkyWest (SKYW): 3,9 veces, la aviación regional"
        },
        {
          "type": "p",
          "text": "Sector: transporte aéreo. SkyWest opera vuelos regionales en Estados Unidos, casi siempre bajo los colores de las grandes aerolíneas (American, Delta, United) mediante contratos. A 3,9 veces su caja, es la quinta de mi clasificación, y la tensión es la de todo el sector aéreo: la ciclicidad."
        },
        {
          "type": "p",
          "text": "La aviación depende del precio del combustible, del empleo de los pilotos, del ciclo económico y de la salud de las grandes aerolíneas que le subcontratan las rutas. Cuando la economía tose, los viajes bajan y los costes fijos (aviones, mantenimiento) se quedan. Por eso el mercado aplica históricamente múltiplos bajos a las aerolíneas, desconfiando de esa dependencia del ciclo. Una nota de 10/10 dice que SkyWest gestiona bien sus cuentas aquí y ahora. El 3,9 dice que el mercado sigue prudente sobre el resto del ciclo."
        },
        {
          "type": "h2",
          "text": "Por qué una nota perfecta nunca basta"
        },
        {
          "type": "p",
          "text": "Quizá hayas notado el hilo conductor: en cada una, la nota de 10/10 dice lo mismo (el negocio está sano), y el precio bajo cuenta un miedo distinto (país emergente, huracanes, patentes, ciclo). Por eso juzgo la calidad y el precio por separado. La nota te da la base. El P/FCF te da la apuesta. La tensión te dice qué compras de verdad."
        },
        {
          "type": "p",
          "text": "Un P/FCF muy bajo nunca es una ganga en sí mismo. Solo lo es si crees que el miedo del mercado es exagerado y que la calidad va a aguantar. Si crees que el huracán, la patente o la recesión van a golpear de verdad, entonces el precio bajo no es una oportunidad, es una advertencia. El buen reflejo es partir de la lista de empresas con nota 10/10, cruzarla con las más baratas y, por último, leer cada tensión en frío."
        },
        {
          "type": "p",
          "text": "Puedes explorar tú mismo los dos ángulos: la lista completa de empresas con nota 10/10 en [la clasificación de calidad 10/10](/classement/qualite-10-sur-10), y las que el mercado paga más barato en [la clasificación de acciones infravaloradas](/classement/sous-evaluees). Cruzar las dos es justo lo que hace este ranking por ti. Es también, en una frase, por qué construí este sitio: poder juzgar la calidad y el precio de una acción en pocos segundos, por separado, para no volver a confundir una buena empresa con una buena ganga."
        }
      ],
      "faq": [
        {
          "q": "¿Una acción con nota 10/10 es una buena compra?",
          "a": "No necesariamente. La nota solo juzga la calidad del negocio, a partir de hechos contables. El precio se juzga aparte, con el P/FCF. Una nota perfecta comprada demasiado cara sigue siendo una mala inversión, y un precio bajo puede esconder un riesgo real."
        },
        {
          "q": "¿Cómo se calcula la nota de calidad?",
          "a": "Con criterios financieros objetivos: rentabilidad, crecimiento de las ventas y de la caja, márgenes, recompra de acciones, deuda, rentabilidad del capital. Es contabilidad, no una opinión. La nota dice si el negocio es sólido, independientemente del precio de la acción."
        },
        {
          "q": "¿Qué significa en concreto un P/FCF de 1,1?",
          "a": "Que pagas la acción apenas algo más de un año de la caja que genera. Cuanto más bajo es el P/FCF, más barata es la acción. Pero una cifra tan baja casi siempre señala un miedo del mercado que conviene entender antes de comprar."
        },
        {
          "q": "¿Por qué estas cinco acciones son tan baratas?",
          "a": "Cada una arrastra una tensión: riesgo país para Afya, huracanes para Universal Insurance y RenaissanceRe, fin de patente para Collegium, ciclicidad para SkyWest. El precio bajo paga ese riesgo. La calidad, en cambio, sigue probada por las cuentas."
        },
        {
          "q": "¿Qué hacer con un ranking como este?",
          "a": "Usarlo como punto de partida, no como lista de la compra. Partes de empresas de calidad, detectas las más baratas y luego juzgas si el miedo del mercado es exagerado. Es un análisis educativo, haz tus propias investigaciones."
        }
      ],
      "tags": [
        "Ranking",
        "Calidad",
        "Valoración",
        "P/FCF"
      ],
      "disclaimer": "Análisis con fines informativos y educativos, no es un consejo de inversión personalizado. Los resultados pasados no garantizan los futuros. Cifras a la fecha de publicación (junio de 2026), sujetas a cambios. Haz tus propias investigaciones."
    }
  }
};

const reassurance: Article = {
  "slug": "meilleures-actions-reassurance-10-10",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 10,
  "content": {
    "fr": {
      "title": "Réassurance de qualité : les actions notées 10/10",
      "excerpt": "Un secteur que le marché trouve ennuyeux et volatil, et qui cache pourtant des machines à cash notées 10/10. Voici ce que je regarde, et pourquoi.",
      "metaDescription": "Réassurance et assurance : pourquoi ce secteur négligé abrite des actions notées 10/10 chez moi (RNR, ACGL). Qualité, prix, et le vrai risque, expliqués.",
      "answer": "La réassurance passe pour ennuyeuse et imprévisible, alors qu'elle abrite des entreprises notées 10/10 chez moi : très rentables, peu endettées, parfois bradées. RenaissanceRe et Arch Capital en sont les vedettes. Le piège : leurs résultats sont volatils à cause des catastrophes. Voici comment je sépare la qualité du prix.",
      "body": [
        {
          "type": "ul",
          "items": [
            "La réassurance, c'est l'assurance des assureurs : un métier souvent perçu comme ennuyeux et imprévisible, donc délaissé par le marché.",
            "Plusieurs de ces entreprises décrochent pourtant la note maximale chez moi, 10 sur 10, sur des critères de qualité purement financiers.",
            "RenaissanceRe (RNR) se paie environ 3 fois son cash annuel (P/FCF 3,0), Arch Capital (ACGL) environ 5,6 fois : c'est très bon marché.",
            "Leur force : discipline de souscription, cycle dur favorable, et un float investi qui rapporte en plus.",
            "Le vrai trade-off : qualité solide et prix bas, mais des résultats qui peuvent plonger une année de grosses catastrophes."
          ]
        },
        {
          "type": "h2",
          "text": "Le secteur que personne ne veut regarder"
        },
        {
          "type": "p",
          "text": "Quand je parle de réassurance, je vois souvent la même réaction : un haussement d'épaules. C'est perçu comme ennuyeux, technique, et surtout imprévisible. Une grosse saison d'ouragans, un tremblement de terre, et les résultats d'une réassureuse peuvent plonger. Le marché déteste ça. Du coup, il a tendance à délaisser tout le secteur, à le ranger dans la case cyclique sans intérêt."
        },
        {
          "type": "p",
          "text": "Et c'est précisément ce désintérêt qui crée l'occasion. Plusieurs de ces entreprises décrochent chez moi la note maximale, 10 sur 10, tout en se payant moins cher que la plupart des belles actions de la cote. Avant d'aller plus loin, je veux que tu comprennes le métier, parce que sans ça les chiffres ne veulent rien dire."
        },
        {
          "type": "h2",
          "text": "C'est quoi, la réassurance ?"
        },
        {
          "type": "p",
          "text": "Ton assureur auto ou habitation, lui aussi, a peur de la catastrophe. Si un ouragan détruit dix mille maisons d'un coup, il ne peut pas tout payer seul. Alors il s'assure à son tour, auprès d'un réassureur. La réassurance, c'est donc l'assurance des assureurs : elle prend en charge une partie des très gros risques, contre une prime."
        },
        {
          "type": "p",
          "text": "Pourquoi ce métier peut être extrêmement rentable ? Trois leviers. D'abord la discipline de souscription : souscrire, c'est accepter de couvrir un risque à un certain prix. Une réassureuse de qualité refuse les mauvais risques, même quand la concurrence brade ses tarifs. Ensuite le cycle : après une grosse catastrophe, les capacités se raréfient, les prix montent fort. On appelle ça un cycle dur, et c'est le moment où les meilleures gagnent le plus. Enfin le float : l'argent des primes encaissées avant de payer les sinistres. En attendant, la réassureuse l'investit et garde les revenus. C'est le secret de Warren Buffett avec l'assurance : on est payé pour détenir l'argent des autres."
        },
        {
          "type": "h2",
          "text": "Comment je note la qualité, séparément du prix"
        },
        {
          "type": "p",
          "text": "Voici ma règle de base, le fil de tout ce que je fais : je juge la qualité d'une entreprise et le prix de son action comme deux questions complètement distinctes. Une entreprise géniale payée trop cher reste un mauvais placement. Une entreprise médiocre bradée reste médiocre. Confondre les deux, c'est l'erreur numéro un, et je l'explique en détail dans ma [méthodologie](/methodologie)."
        },
        {
          "type": "p",
          "text": "La note sur 10 ne regarde que la qualité du business, jamais le prix. Je passe l'entreprise au crible de critères financiers concrets : est-elle vraiment rentable, ses ventes et son cash augmentent-ils, sa dette est-elle maîtrisée, rend-elle bien le capital ? Un 10 sur 10 veut dire qu'elle coche tout. Deux chiffres reviennent souvent dans mon analyse, alors autant te les expliquer tout de suite."
        },
        {
          "type": "p",
          "text": "La marge nette, d'abord : sur 100 euros de ventes, combien finissent en bénéfice net une fois tout payé. Une marge nette de 24 % chez RenaissanceRe veut dire que sur 100 euros de primes, 24 restent en bénéfice. C'est énorme pour de l'assurance. Le Cash ROCE ensuite : le rendement du capital employé, version cash. En clair, pour chaque euro immobilisé dans le business, combien de cash il génère chaque année. Un Cash ROCE de 31 %, ça veut dire 31 centimes de cash par euro employé, an après an. C'est le signe d'une machine qui transforme efficacement le capital en argent réel."
        },
        {
          "type": "h2",
          "text": "RenaissanceRe (RNR) : la machine de souscription"
        },
        {
          "type": "p",
          "text": "RenaissanceRe est une réassureuse basée aux Bermudes, spécialiste reconnu des risques catastrophe. Elle décroche chez moi le 10 sur 10. Sa marge nette atteint 24 %, son Cash ROCE 31 %, et elle ne porte quasiment pas de dette. Cette combinaison est rare : forte rentabilité, capital qui travaille dur, bilan propre. Quand une année se passe mal côté sinistres, un bilan sans dette est exactement ce qui permet de tenir et de rebondir."
        },
        {
          "type": "p",
          "text": "Et le prix ? Son P/FCF tourne autour de 3,0. Le P/FCF, c'est le prix de l'action divisé par le cash qu'elle génère chaque année. Un P/FCF de 3, ça veut dire que tu paies à peine trois années du cash produit : très bon marché. Pour situer, ce niveau la place dans le percentile 4. Le percentile, c'est la position dans un classement de 0 à 100 : être au percentile 4, ça veut dire que seules 4 % des actions sont aussi bon marché ou plus. Autrement dit, presque rien n'est moins cher. Le détail chiffré est sur sa [fiche d'analyse RenaissanceRe](/analyse/RNR)."
        },
        {
          "type": "h2",
          "text": "Arch Capital (ACGL) : la croissance disciplinée"
        },
        {
          "type": "p",
          "text": "Arch Capital est un profil un peu différent : un groupe diversifié qui fait à la fois de l'assurance et de la réassurance, ce qui lisse une partie de la volatilité. Elle obtient aussi le 10 sur 10. Sa marge nette est de 26 %, son Cash ROCE de 24 %, et surtout son chiffre d'affaires croît d'environ 23 % par an. Une croissance pareille, sur un métier aussi rentable, c'est exactement le profil que je cherche."
        },
        {
          "type": "p",
          "text": "Côté prix, son P/FCF est d'environ 5,6. C'est plus cher que RenaissanceRe, et c'est logique : le marché paie un peu plus pour la diversification et la croissance. Mais 5,6 fois le cash, pour une entreprise notée 10 sur 10 qui grossit de plus de 20 % par an, ça reste modeste. Tu trouveras le détail sur sa [fiche d'analyse Arch Capital](/analyse/ACGL)."
        },
        {
          "type": "h2",
          "text": "Les autres 10 sur 10 du même panier"
        },
        {
          "type": "p",
          "text": "La réassurance pure n'est pas seule dans cette poche de qualité. Dans le même panier d'assureurs notés 10 sur 10, je retrouve Kinsale, un spécialiste de l'assurance de niche, autour de 7,1 fois son cash. W. R. Berkley, assureur diversifié de long terme, autour de 7,0 fois. Et Progressive, le géant de l'assurance auto américaine, autour de 7,4 fois. Trois business très différents, une même note maximale, et des prix qui restent raisonnables."
        },
        {
          "type": "p",
          "text": "Si tu veux voir tous les business qui décrochent le maximum, je tiens un [classement des actions notées 10 sur 10](/classement/qualite-10-sur-10). Et si c'est le prix qui te motive, mon [classement des actions sous-évaluées](/classement/sous-evaluees) part du même principe : la qualité d'abord, le prix ensuite."
        },
        {
          "type": "h2",
          "text": "Pourquoi le marché délaisse tout ça"
        },
        {
          "type": "p",
          "text": "Si ces entreprises sont si bonnes et si peu chères, où est le piège ? Il est réel, et je ne vais pas te le cacher. Les résultats d'une réassureuse sont volatils. Une année calme côté catastrophes, le bénéfice explose. Une année avec deux ouragans majeurs, il peut s'effondrer, voire virer au rouge. Le marché déteste cette imprévisibilité, et il préfère payer cher une croissance régulière et lisse plutôt qu'un bénéfice en dents de scie."
        },
        {
          "type": "p",
          "text": "C'est ça, le vrai trade-off : qualité solide et prix bas, contre volatilité des sinistres. Un P/FCF de 3 n'est pas un cadeau gratuit, c'est la prime que le marché exige pour accepter de ne pas savoir ce que rapportera l'an prochain. La vraie question, celle qui décide tout, c'est : crois-tu que sur un cycle complet, sur cinq ou dix ans, la discipline de souscription et le float l'emportent sur les mauvaises années ? Si oui, ces prix sont anormalement bas. Sinon, mieux vaut passer ton chemin."
        },
        {
          "type": "h2",
          "text": "Comment je m'en sers"
        },
        {
          "type": "p",
          "text": "Je n'achète jamais un secteur parce qu'il est bon marché. Je commence par la qualité : le 10 sur 10 me dit que le business tient debout. Ensuite seulement je regarde le prix, et je note un point d'entrée raisonnable. Pour un métier volatil comme la réassurance, je raisonne sur la moyenne d'un cycle, pas sur l'année en cours, et j'accepte d'avance que certaines années seront moches. C'est le prix de l'entrée. C'est exactement pour pouvoir trancher ça en quelques secondes, qualité d'un côté, prix de l'autre, que j'ai construit mon site d'investissement."
        }
      ],
      "faq": [
        {
          "q": "C'est quoi, la réassurance, en une phrase ?",
          "a": "C'est l'assurance des assureurs : un réassureur prend en charge une partie des très gros risques d'une compagnie d'assurance, contre une prime, pour qu'une catastrophe ne mette pas l'assureur à terre."
        },
        {
          "q": "Pourquoi un P/FCF de 3 est-il considéré comme bon marché ?",
          "a": "Le P/FCF est le prix de l'action divisé par le cash généré chaque année. À 3, tu paies à peine trois années de ce cash. C'est très bas : seules quelques pour cent des actions sont aussi peu chères. Mais bas marché ne veut pas dire bonne affaire si le risque est élevé."
        },
        {
          "q": "Que veut dire la note 10 sur 10 ?",
          "a": "Elle mesure uniquement la qualité du business, jamais le prix. Un 10 sur 10 coche tous mes critères financiers : rentabilité, croissance, faible dette, bon rendement du capital. Le prix se juge séparément, dans un second temps."
        },
        {
          "q": "Quel est le principal risque de la réassurance ?",
          "a": "La volatilité des sinistres. Une année de grosses catastrophes peut faire plonger les bénéfices, voire les rendre négatifs. C'est pour ça que le marché délaisse le secteur, et c'est ce qui crée à la fois le prix bas et le risque."
        },
        {
          "q": "RenaissanceRe ou Arch Capital, laquelle choisir ?",
          "a": "Ce sont deux profils. RenaissanceRe est moins chère (P/FCF 3,0) et plus concentrée sur la catastrophe. Arch Capital est plus chère (5,6) mais diversifiée et en forte croissance, environ 23 % par an. Ceci n'est pas un conseil, fais tes propres recherches."
        }
      ],
      "tags": [
        "Palmarès",
        "Réassurance",
        "Assurance",
        "Qualité",
        "Valorisation"
      ],
      "disclaimer": "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres à la date de publication, susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "Quality reinsurance: the stocks I rate 10/10",
      "excerpt": "A sector the market finds boring and volatile, yet it hides cash machines I rate 10 out of 10. Here is what I look at, and why.",
      "metaDescription": "Reinsurance and insurance: why this neglected sector hides stocks I rate 10 out of 10 (RNR, ACGL). Quality, price, and the real risk, explained simply.",
      "answer": "Reinsurance looks boring and unpredictable, yet it hides companies I rate 10 out of 10: highly profitable, low debt, sometimes dirt cheap. RenaissanceRe and Arch Capital are the stars. The catch: their results are volatile because of catastrophes. Here is how I separate quality from price.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Reinsurance is insurance for insurers: a business widely seen as boring and unpredictable, so the market neglects it.",
            "Yet several of these companies earn my top score, 10 out of 10, on purely financial quality criteria.",
            "RenaissanceRe (RNR) trades at about 3 times its annual cash (P/FCF 3.0), Arch Capital (ACGL) at about 5.6 times: very cheap.",
            "Their edge: underwriting discipline, a favorable hard cycle, and an invested float that earns extra income.",
            "The real trade-off: solid quality and a low price, but results that can sink in a heavy catastrophe year."
          ]
        },
        {
          "type": "h2",
          "text": "The sector nobody wants to look at"
        },
        {
          "type": "p",
          "text": "When I bring up reinsurance, I usually get the same reaction: a shrug. It is seen as boring, technical, and above all unpredictable. One big hurricane season, one earthquake, and a reinsurer's results can sink. The market hates that. So it tends to neglect the whole sector, filing it under dull and cyclical."
        },
        {
          "type": "p",
          "text": "And that very lack of interest is what creates the opportunity. Several of these companies earn my top score, 10 out of 10, while trading cheaper than most of the fine stocks on the market. Before going further, I want you to understand the business, because without that the numbers mean nothing."
        },
        {
          "type": "h2",
          "text": "What is reinsurance?"
        },
        {
          "type": "p",
          "text": "Your car or home insurer is also afraid of catastrophe. If a hurricane destroys ten thousand homes at once, it cannot pay for everything alone. So it insures itself in turn, with a reinsurer. Reinsurance is therefore insurance for insurers: it takes on part of the very large risks in exchange for a premium."
        },
        {
          "type": "p",
          "text": "Why can this business be extremely profitable? Three levers. First, underwriting discipline: to underwrite is to agree to cover a risk at a certain price. A quality reinsurer refuses bad risks, even when rivals slash their rates. Second, the cycle: after a big catastrophe, capacity becomes scarce and prices rise sharply. That is called a hard cycle, and it is when the best ones earn the most. Third, the float: the premium money collected before claims are paid. In the meantime, the reinsurer invests it and keeps the income. That is Warren Buffett's secret with insurance: you are paid to hold other people's money."
        },
        {
          "type": "h2",
          "text": "How I score quality, separately from price"
        },
        {
          "type": "p",
          "text": "Here is my ground rule, the thread through everything I do: I judge the quality of a company and the price of its stock as two completely separate questions. A great company bought too expensive is still a bad investment. A mediocre company, even dirt cheap, stays mediocre. Confusing the two is the number one mistake, and I explain it in detail in my [methodology](/methodologie)."
        },
        {
          "type": "p",
          "text": "The score out of 10 looks only at the quality of the business, never the price. I run the company through concrete financial criteria: is it truly profitable, are its sales and cash growing, is its debt manageable, does it return capital well? A 10 out of 10 means it ticks everything. Two numbers come up often in my analysis, so let me explain them right away."
        },
        {
          "type": "p",
          "text": "Net margin first: out of 100 dollars of sales, how many end up as net profit once everything is paid. A 24% net margin at RenaissanceRe means that out of 100 dollars of premiums, 24 stay as profit. That is huge for insurance. Then Cash ROCE: the return on capital employed, the cash version. In plain terms, for each dollar tied up in the business, how much cash it generates each year. A Cash ROCE of 31% means 31 cents of cash per dollar employed, year after year. It is the mark of a machine that turns capital into real money efficiently."
        },
        {
          "type": "h2",
          "text": "RenaissanceRe (RNR): the underwriting machine"
        },
        {
          "type": "p",
          "text": "RenaissanceRe is a Bermuda-based reinsurer, a recognized specialist in catastrophe risk. It earns my 10 out of 10. Its net margin reaches 24%, its Cash ROCE 31%, and it carries almost no debt. That combination is rare: high profitability, hard-working capital, a clean balance sheet. When a year goes badly on claims, a debt-free balance sheet is exactly what lets it hold on and bounce back."
        },
        {
          "type": "p",
          "text": "And the price? Its P/FCF is around 3.0. The P/FCF is the share price divided by the cash it generates each year. A P/FCF of 3 means you are paying barely three years of the cash produced: very cheap. To put it in context, that level places it in the 4th percentile. A percentile is the position in a ranking from 0 to 100: being in the 4th percentile means only 4% of stocks are this cheap or cheaper. In other words, almost nothing is cheaper. The full figures are on its [RenaissanceRe analysis page](/analyse/RNR)."
        },
        {
          "type": "h2",
          "text": "Arch Capital (ACGL): disciplined growth"
        },
        {
          "type": "p",
          "text": "Arch Capital is a slightly different profile: a diversified group doing both insurance and reinsurance, which smooths part of the volatility. It also earns the 10 out of 10. Its net margin is 26%, its Cash ROCE 24%, and above all its revenue grows about 23% a year. Growth like that, in a business this profitable, is exactly the profile I am looking for."
        },
        {
          "type": "p",
          "text": "On price, its P/FCF is about 5.6. That is more expensive than RenaissanceRe, and it makes sense: the market pays a bit more for diversification and growth. But 5.6 times cash, for a company rated 10 out of 10 growing more than 20% a year, stays modest. You will find the details on its [Arch Capital analysis page](/analyse/ACGL)."
        },
        {
          "type": "h2",
          "text": "The other 10 out of 10 names in the same basket"
        },
        {
          "type": "p",
          "text": "Pure reinsurance is not alone in this quality pocket. In the same basket of insurers rated 10 out of 10, I find Kinsale, a niche insurance specialist, at about 7.1 times its cash. W. R. Berkley, a long-term diversified insurer, at about 7.0 times. And Progressive, the giant of US auto insurance, at about 7.4 times. Three very different businesses, the same top score, and prices that stay reasonable."
        },
        {
          "type": "p",
          "text": "If you want to see every business earning the top mark, I keep a [ranking of stocks rated 10 out of 10](/classement/qualite-10-sur-10). And if price is what drives you, my [ranking of undervalued stocks](/classement/sous-evaluees) starts from the same principle: quality first, price second."
        },
        {
          "type": "h2",
          "text": "Why the market neglects all this"
        },
        {
          "type": "p",
          "text": "If these companies are so good and so cheap, where is the catch? It is real, and I will not hide it from you. A reinsurer's results are volatile. A calm catastrophe year, and profit soars. A year with two major hurricanes, and it can collapse, even turn red. The market hates that unpredictability, and it would rather pay up for steady, smooth growth than for jagged earnings."
        },
        {
          "type": "p",
          "text": "That is the real trade-off: solid quality and a low price, against the volatility of claims. A P/FCF of 3 is not a free gift, it is the premium the market demands for accepting that it cannot know what next year will earn. The real question, the one that decides everything, is this: do you believe that over a full cycle, over five or ten years, underwriting discipline and the float outweigh the bad years? If yes, these prices are abnormally low. If not, better to walk away."
        },
        {
          "type": "h2",
          "text": "How I use this"
        },
        {
          "type": "p",
          "text": "I never buy a sector just because it is cheap. I start with quality: the 10 out of 10 tells me the business stands up. Only then do I look at the price, and I note a reasonable entry point. For a volatile business like reinsurance, I think in terms of a cycle average, not the current year, and I accept in advance that some years will be ugly. That is the cost of entry. It is precisely to settle that in a few seconds, quality on one side, price on the other, that I built my investment site."
        }
      ],
      "faq": [
        {
          "q": "What is reinsurance, in one sentence?",
          "a": "It is insurance for insurers: a reinsurer takes on part of an insurance company's very large risks in exchange for a premium, so that a catastrophe does not bring the insurer down."
        },
        {
          "q": "Why is a P/FCF of 3 considered cheap?",
          "a": "The P/FCF is the share price divided by the cash generated each year. At 3, you pay barely three years of that cash. That is very low: only a few percent of stocks are this cheap. But low price does not mean a bargain if the risk is high."
        },
        {
          "q": "What does a score of 10 out of 10 mean?",
          "a": "It measures only the quality of the business, never the price. A 10 out of 10 ticks all my financial criteria: profitability, growth, low debt, good return on capital. Price is judged separately, in a second step."
        },
        {
          "q": "What is the main risk of reinsurance?",
          "a": "The volatility of claims. A heavy catastrophe year can sink profits, even turn them negative. That is why the market neglects the sector, and it is what creates both the low price and the risk."
        },
        {
          "q": "RenaissanceRe or Arch Capital, which one?",
          "a": "They are two profiles. RenaissanceRe is cheaper (P/FCF 3.0) and more concentrated on catastrophe. Arch Capital is more expensive (5.6) but diversified and growing fast, about 23% a year. This is not advice, do your own research."
        }
      ],
      "tags": [
        "Ranking",
        "Reinsurance",
        "Insurance",
        "Quality",
        "Valuation"
      ],
      "disclaimer": "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date, subject to change. Do your own research."
    },
    "es": {
      "title": "Reaseguro de calidad: las acciones que valoro 10/10",
      "excerpt": "Un sector que el mercado ve aburrido y volátil, y que sin embargo esconde máquinas de generar caja que valoro 10 sobre 10. Esto es lo que miro, y por qué.",
      "metaDescription": "Reaseguro y seguro: por qué este sector olvidado esconde acciones que valoro 10 sobre 10 (RNR, ACGL). Calidad, precio y el riesgo real, explicados.",
      "answer": "El reaseguro parece aburrido e impredecible, pero esconde empresas que valoro 10 sobre 10: muy rentables, con poca deuda, a veces baratísimas. RenaissanceRe y Arch Capital son las estrellas. La trampa: sus resultados son volátiles por las catástrofes. Así separo la calidad del precio.",
      "body": [
        {
          "type": "ul",
          "items": [
            "El reaseguro es el seguro de las aseguradoras: un negocio visto como aburrido e impredecible, y por eso olvidado por el mercado.",
            "Sin embargo, varias de estas empresas logran mi nota máxima, 10 sobre 10, con criterios de calidad puramente financieros.",
            "RenaissanceRe (RNR) cotiza a unas 3 veces su caja anual (P/FCF 3,0), Arch Capital (ACGL) a unas 5,6 veces: muy barato.",
            "Su fuerza: disciplina de suscripción, un ciclo duro favorable y un float invertido que da ingresos adicionales.",
            "El verdadero compromiso: calidad sólida y precio bajo, pero resultados que pueden hundirse en un año de grandes catástrofes."
          ]
        },
        {
          "type": "h2",
          "text": "El sector que nadie quiere mirar"
        },
        {
          "type": "p",
          "text": "Cuando hablo de reaseguro, suelo ver la misma reacción: un encogimiento de hombros. Se percibe como aburrido, técnico y sobre todo impredecible. Una gran temporada de huracanes, un terremoto, y los resultados de una reaseguradora pueden hundirse. El mercado odia eso. Por eso tiende a olvidar todo el sector, a meterlo en el cajón de lo cíclico sin interés."
        },
        {
          "type": "p",
          "text": "Y es justo ese desinterés el que crea la oportunidad. Varias de estas empresas logran conmigo la nota máxima, 10 sobre 10, cotizando más baratas que la mayoría de las buenas acciones del mercado. Antes de seguir, quiero que entiendas el negocio, porque sin eso las cifras no significan nada."
        },
        {
          "type": "h2",
          "text": "¿Qué es el reaseguro?"
        },
        {
          "type": "p",
          "text": "Tu aseguradora de coche o de hogar también teme la catástrofe. Si un huracán destruye diez mil casas de golpe, no puede pagarlo todo sola. Así que se asegura a su vez, con una reaseguradora. El reaseguro es, por tanto, el seguro de las aseguradoras: asume parte de los riesgos muy grandes a cambio de una prima."
        },
        {
          "type": "p",
          "text": "¿Por qué este negocio puede ser muy rentable? Tres palancas. Primero, la disciplina de suscripción: suscribir es aceptar cubrir un riesgo a cierto precio. Una reaseguradora de calidad rechaza los malos riesgos, aunque la competencia rebaje sus tarifas. Segundo, el ciclo: tras una gran catástrofe, la capacidad escasea y los precios suben con fuerza. Eso se llama un ciclo duro, y es cuando las mejores ganan más. Tercero, el float: el dinero de las primas cobradas antes de pagar los siniestros. Mientras tanto, la reaseguradora lo invierte y se queda los ingresos. Ese es el secreto de Warren Buffett con el seguro: te pagan por tener el dinero de los demás."
        },
        {
          "type": "h2",
          "text": "Cómo puntúo la calidad, aparte del precio"
        },
        {
          "type": "p",
          "text": "Esta es mi regla básica, el hilo de todo lo que hago: juzgo la calidad de una empresa y el precio de su acción como dos preguntas completamente distintas. Una empresa genial comprada demasiado cara sigue siendo una mala inversión. Una empresa mediocre, por barata que sea, sigue siendo mediocre. Confundir ambas es el error número uno, y lo explico en detalle en mi [metodología](/methodologie)."
        },
        {
          "type": "p",
          "text": "La nota sobre 10 mira solo la calidad del negocio, nunca el precio. Paso la empresa por un tamiz de criterios financieros concretos: ¿es realmente rentable, crecen sus ventas y su caja, es manejable su deuda, devuelve bien el capital? Un 10 sobre 10 significa que cumple con todo. Dos cifras aparecen a menudo en mi análisis, así que te las explico ya."
        },
        {
          "type": "p",
          "text": "El margen neto, primero: de cada 100 euros de ventas, cuántos acaban en beneficio neto una vez pagado todo. Un margen neto del 24 % en RenaissanceRe significa que de cada 100 euros de primas, 24 quedan como beneficio. Es enorme para un seguro. Luego el Cash ROCE: el rendimiento del capital empleado, en versión caja. En claro, por cada euro inmovilizado en el negocio, cuánta caja genera cada año. Un Cash ROCE del 31 % significa 31 céntimos de caja por euro empleado, año tras año. Es la señal de una máquina que convierte el capital en dinero real de forma eficiente."
        },
        {
          "type": "h2",
          "text": "RenaissanceRe (RNR): la máquina de suscripción"
        },
        {
          "type": "p",
          "text": "RenaissanceRe es una reaseguradora con sede en Bermudas, especialista reconocida en riesgo de catástrofe. Logra conmigo el 10 sobre 10. Su margen neto alcanza el 24 %, su Cash ROCE el 31 %, y casi no tiene deuda. Esa combinación es rara: alta rentabilidad, capital que trabaja duro, un balance limpio. Cuando un año va mal en siniestros, un balance sin deuda es justo lo que permite aguantar y recuperarse."
        },
        {
          "type": "p",
          "text": "¿Y el precio? Su P/FCF ronda el 3,0. El P/FCF es el precio de la acción dividido por la caja que genera cada año. Un P/FCF de 3 significa que pagas apenas tres años de la caja producida: muy barato. Para situarlo, ese nivel la coloca en el percentil 4. El percentil es la posición en una clasificación de 0 a 100: estar en el percentil 4 significa que solo el 4 % de las acciones están así de baratas o más. Dicho de otro modo, casi nada es más barato. El detalle está en su [ficha de análisis de RenaissanceRe](/analyse/RNR)."
        },
        {
          "type": "h2",
          "text": "Arch Capital (ACGL): crecimiento disciplinado"
        },
        {
          "type": "p",
          "text": "Arch Capital es un perfil algo distinto: un grupo diversificado que hace a la vez seguro y reaseguro, lo que suaviza parte de la volatilidad. También logra el 10 sobre 10. Su margen neto es del 26 %, su Cash ROCE del 24 %, y sobre todo su facturación crece alrededor del 23 % al año. Un crecimiento así, en un negocio tan rentable, es justo el perfil que busco."
        },
        {
          "type": "p",
          "text": "En cuanto al precio, su P/FCF es de unas 5,6 veces. Es más caro que RenaissanceRe, y es lógico: el mercado paga algo más por la diversificación y el crecimiento. Pero 5,6 veces la caja, para una empresa valorada 10 sobre 10 que crece más del 20 % al año, sigue siendo modesto. Encontrarás el detalle en su [ficha de análisis de Arch Capital](/analyse/ACGL)."
        },
        {
          "type": "h2",
          "text": "Los otros 10 sobre 10 de la misma cesta"
        },
        {
          "type": "p",
          "text": "El reaseguro puro no está solo en esta bolsa de calidad. En la misma cesta de aseguradoras valoradas 10 sobre 10 encuentro a Kinsale, especialista en seguro de nicho, a unas 7,1 veces su caja. W. R. Berkley, aseguradora diversificada de largo plazo, a unas 7,0 veces. Y Progressive, el gigante del seguro de coche en Estados Unidos, a unas 7,4 veces. Tres negocios muy distintos, la misma nota máxima, y precios que siguen siendo razonables."
        },
        {
          "type": "p",
          "text": "Si quieres ver todos los negocios que logran la nota máxima, mantengo una [clasificación de acciones valoradas 10 sobre 10](/classement/qualite-10-sur-10). Y si lo que te mueve es el precio, mi [clasificación de acciones infravaloradas](/classement/sous-evaluees) parte del mismo principio: la calidad primero, el precio después."
        },
        {
          "type": "h2",
          "text": "Por qué el mercado olvida todo esto"
        },
        {
          "type": "p",
          "text": "Si estas empresas son tan buenas y tan baratas, ¿dónde está la trampa? Es real, y no te la voy a ocultar. Los resultados de una reaseguradora son volátiles. Un año tranquilo en catástrofes, y el beneficio se dispara. Un año con dos huracanes mayores, y puede hundirse, incluso ponerse en rojo. El mercado odia esa imprevisibilidad, y prefiere pagar caro un crecimiento regular y suave antes que un beneficio en dientes de sierra."
        },
        {
          "type": "p",
          "text": "Ese es el verdadero compromiso: calidad sólida y precio bajo, frente a la volatilidad de los siniestros. Un P/FCF de 3 no es un regalo gratis, es la prima que el mercado exige por aceptar que no puede saber cuánto rendirá el año que viene. La verdadera pregunta, la que lo decide todo, es esta: ¿crees que en un ciclo completo, en cinco o diez años, la disciplina de suscripción y el float pesan más que los malos años? Si es así, estos precios son anormalmente bajos. Si no, mejor seguir de largo."
        },
        {
          "type": "h2",
          "text": "Cómo lo uso yo"
        },
        {
          "type": "p",
          "text": "Nunca compro un sector solo porque esté barato. Empiezo por la calidad: el 10 sobre 10 me dice que el negocio se sostiene. Solo después miro el precio, y anoto un punto de entrada razonable. Para un negocio volátil como el reaseguro, razono sobre la media de un ciclo, no sobre el año en curso, y acepto de antemano que algunos años serán feos. Ese es el coste de entrar. Es justo para poder zanjar eso en unos segundos, calidad por un lado, precio por otro, que construí mi sitio de inversión."
        }
      ],
      "faq": [
        {
          "q": "¿Qué es el reaseguro, en una frase?",
          "a": "Es el seguro de las aseguradoras: una reaseguradora asume parte de los riesgos muy grandes de una compañía de seguros a cambio de una prima, para que una catástrofe no derribe a la aseguradora."
        },
        {
          "q": "¿Por qué un P/FCF de 3 se considera barato?",
          "a": "El P/FCF es el precio de la acción dividido por la caja generada cada año. A 3, pagas apenas tres años de esa caja. Es muy bajo: solo un pequeño porcentaje de acciones están así de baratas. Pero precio bajo no significa buena oportunidad si el riesgo es alto."
        },
        {
          "q": "¿Qué significa la nota 10 sobre 10?",
          "a": "Mide solo la calidad del negocio, nunca el precio. Un 10 sobre 10 cumple todos mis criterios financieros: rentabilidad, crecimiento, poca deuda, buen rendimiento del capital. El precio se juzga aparte, en un segundo paso."
        },
        {
          "q": "¿Cuál es el principal riesgo del reaseguro?",
          "a": "La volatilidad de los siniestros. Un año de grandes catástrofes puede hundir los beneficios, incluso volverlos negativos. Por eso el mercado olvida el sector, y eso es lo que crea a la vez el precio bajo y el riesgo."
        },
        {
          "q": "¿RenaissanceRe o Arch Capital, cuál elegir?",
          "a": "Son dos perfiles. RenaissanceRe es más barata (P/FCF 3,0) y más concentrada en catástrofe. Arch Capital es más cara (5,6) pero diversificada y en fuerte crecimiento, cerca del 23 % al año. Esto no es un consejo, haz tu propia investigación."
        }
      ],
      "tags": [
        "Clasificación",
        "Reaseguro",
        "Seguro",
        "Calidad",
        "Valoración"
      ],
      "disclaimer": "Análisis con fines informativos y educativos, no es un consejo de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a la fecha de publicación, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const bsyRop: Article = {
  "slug": "bentley-bsy-vs-roper-rop-logiciel-10-10",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 11,
  "ticker": "BSY",
  "content": {
    "fr": {
      "title": "Bentley Systems (BSY) ou Roper (ROP) : 10/10 comparés",
      "excerpt": "Deux éditeurs de logiciels notés 10 sur 10, deux façons d'être excellents. L'un grandit tout seul, l'autre rachète. L'un est plus cher, l'autre signalé en opportunité. Voici comment je les départage, sans gagnant absolu.",
      "metaDescription": "Bentley (BSY) face à Roper (ROP), deux logiciels notés 10/10 : valorisation, croissance, dette et allocation du capital. Comment je compare, sans gagnant.",
      "answer": "Bentley et Roper sont deux éditeurs de logiciels notés 10 sur 10 dans ma méthode : qualité maximale. Mais ils ne sont pas interchangeables. Roper se paie nettement moins cher et affiche de meilleures marges ; Bentley grandit un peu plus vite sur le cash par action et porte moins de dette. Deux profils, pas un gagnant.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Bentley Systems (BSY) et Roper Technologies (ROP) obtiennent tous deux ma note de 10 sur 10 : la qualité du business est au sommet des deux côtés.",
            "Le prix les sépare : Roper se paie 14,4 fois son cash annuel (signalé opportunité), Bentley 25,1 fois (cher en absolu, mais bas dans sa propre histoire).",
            "Roper est une machine à acquisitions, donc plus endettée (dette nette de 4,2 ans de cash) ; Bentley grandit surtout tout seul, avec moins de dette (2,4 ans).",
            "Bentley grandit un peu plus vite sur le cash par action (21 % par an contre 11 %) ; Roper a de meilleures marges (marge nette 21 % contre 18 %).",
            "Le fil de tout l'article : juger la qualité d'un business et le prix de l'action séparément, jamais en même temps."
          ]
        },
        {
          "type": "h2",
          "text": "Deux 10 sur 10, et pourtant deux entreprises très différentes"
        },
        {
          "type": "p",
          "text": "La première fois que j'ai mis Bentley et Roper côte à côte, je me suis dit que comparer deux notes parfaites n'avait pas grand intérêt. Si les deux valent 10 sur 10, autant tirer à pile ou face. J'avais tort. Deux entreprises peuvent atteindre l'excellence par des chemins radicalement différents, et c'est précisément ce qui rend la comparaison utile."
        },
        {
          "type": "p",
          "text": "D'abord, un mot sur cette note. Quand je dis 10 sur 10, je ne note pas à l'intuition. Je passe l'entreprise au crible de 10 critères de qualité fondamentale : est-elle vraiment rentable, ses ventes et son cash augmentent-ils, transforme-t-elle son bénéfice comptable en cash réel, sa dette est-elle maîtrisée, rend-elle de l'argent à ses actionnaires sans gaspiller ? Une entreprise qui valide tout obtient 10. C'est rare, par construction. Bentley et Roper y arrivent toutes les deux. Mais la note mesure la qualité du business, pas le prix de l'action. Ce sont deux questions que je ne mélange jamais."
        },
        {
          "type": "p",
          "text": "Bentley édite des logiciels d'ingénierie et d'infrastructure : les outils qui servent à concevoir des ponts, des routes, des réseaux d'eau, des usines. On parle de BIM (Building Information Modeling), c'est-à-dire la maquette numérique d'un ouvrage, qui suit le chantier puis l'exploitation pendant des décennies. Roper, lui, n'est pas vraiment un éditeur unique : c'est un conglomérat, une holding qui possède une collection de logiciels de niche, chacun leader sur son petit marché, rachetés un par un au fil des années. Le premier construit, le second collectionne."
        },
        {
          "type": "h2",
          "text": "Le prix : Roper est nettement moins cher"
        },
        {
          "type": "p",
          "text": "Commençons par la question qui fâche, parce que c'est elle qui les sépare le plus. Pour mesurer ce qu'on paie, je regarde un ratio simple : le P/FCF (price to free cash flow). C'est le prix de l'action divisé par le free cash flow qu'elle génère chaque année. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées (salaires, machines, impôts). Un P/FCF de 14, ça veut dire que tu paies aujourd'hui l'équivalent de quatorze années de ce cash. Plus c'est bas, moins c'est cher."
        },
        {
          "type": "p",
          "text": "Roper se paie 14,4 fois son free cash flow. Bentley se paie 25,1 fois. À la louche, pour le même euro de cash annuel généré, Bentley te coûte presque deux fois plus cher que Roper. C'est un écart énorme entre deux entreprises de qualité comparable."
        },
        {
          "type": "p",
          "text": "Mais un chiffre brut ne suffit jamais : il faut le replacer dans l'histoire de l'entreprise. C'est là qu'intervient le percentile. Le percentile situe la valorisation d'aujourd'hui par rapport à toutes celles que l'action a connues dans son passé. Un percentile de 0, ça veut dire que l'action n'a quasiment jamais été aussi peu chère qu'aujourd'hui, par rapport à elle-même. Un percentile de 8, c'est presque pareil : très bas dans son historique."
        },
        {
          "type": "p",
          "text": "Et là, surprise. Bentley est à un percentile de 0 : malgré son P/FCF élevé de 25, elle n'a jamais été aussi bon marché dans sa propre histoire. Autrement dit, elle est chère en absolu, mais l'action s'est toujours payée encore plus cher avant. Roper est à un percentile de 8, et mon outil la signale carrément comme une opportunité : à la fois pas chère en absolu (14,4 fois) et basse dans son historique. Sur le seul terrain du prix, Roper a une longueur d'avance."
        },
        {
          "type": "h2",
          "text": "La croissance et les marges : avantages croisés"
        },
        {
          "type": "p",
          "text": "Si Roper est moins chère, c'est peut-être qu'elle grandit moins vite ? Pas vraiment. Les deux croissent à un rythme proche sur le chiffre d'affaires : environ 12 % par an pour Roper, 11 % pour Bentley. Quasiment au coude à coude."
        },
        {
          "type": "p",
          "text": "La nuance se joue ailleurs, sur le cash par action. Là, Bentley va plus vite : son free cash flow par action grimpe de 21 % par an, contre 11 % pour Roper. Pourquoi je regarde le cash par action et pas seulement le chiffre d'affaires ? Parce que c'est ce qui revient réellement à chaque actionnaire. Une entreprise peut faire grossir ses ventes tout en émettant des actions à tour de bras, et chaque détenteur se retrouve avec une part plus mince du gâteau. Le cash par action corrige ça : il mesure la richesse créée par action que tu détiens."
        },
        {
          "type": "p",
          "text": "En face, Roper reprend l'avantage sur la rentabilité pure. Sa marge nette est de 21 %, contre 18 % pour Bentley. La marge nette, c'est la part du chiffre d'affaires qui reste en bénéfice une fois tout payé. Et sur la marge de free cash flow, même hiérarchie : 30 % pour Roper, 27 % pour Bentley. Une marge de FCF de 30 % veut dire que sur 100 euros de ventes, 30 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10. Les deux sont donc largement au-dessus du lot, Roper un cran devant."
        },
        {
          "type": "p",
          "text": "Tu vois le tableau se dessiner : Bentley pour la vitesse du cash par action, Roper pour les marges et le prix. Aucune ne domine sur tous les fronts."
        },
        {
          "type": "h2",
          "text": "L'allocation du capital : construire ou racheter ?"
        },
        {
          "type": "p",
          "text": "C'est ici que les deux modèles divergent le plus, et c'est le point que je trouve le plus instructif. L'allocation du capital, c'est la façon dont une direction utilise l'argent qu'elle gagne : le réinvestir, racheter des concurrents, racheter ses propres actions, ou rembourser de la dette. C'est l'une des choses qui distingue un bon management d'un mauvais."
        },
        {
          "type": "p",
          "text": "Roper est un acquéreur en série. Son métier, au fond, c'est d'utiliser le cash qu'elle génère pour racheter d'autres éditeurs de logiciels de niche, les laisser tourner avec une grande autonomie, et encaisser leur cash à son tour. C'est un modèle redoutable quand il est bien exécuté : chaque acquisition réussie ajoute une nouvelle source de cash récurrent. Mais il a une contrepartie. Pour financer ces rachats, Roper s'endette davantage."
        },
        {
          "type": "p",
          "text": "Je mesure cet endettement avec un ratio : la dette nette rapportée au free cash flow. Il répond à une question concrète : combien d'années de cash faudrait-il pour rembourser toute la dette ? Chez Roper, c'est 4,2 ans. Chez Bentley, 2,4 ans. Bentley est donc nettement moins endettée, parce qu'elle grandit surtout de façon organique : elle développe ses propres logiciels plutôt que de racheter ceux des autres à crédit. Sa croissance vient de l'intérieur, pas du chéquier."
        },
        {
          "type": "p",
          "text": "Ni l'un ni l'autre n'est mauvais, ce sont des philosophies différentes. La dette de 4,2 ans de Roper n'est pas alarmante pour une machine à acquisitions dont les cash flows sont très réguliers, mais elle la rend plus sensible aux taux d'intérêt et aux mauvaises acquisitions. La prudence de Bentley, avec 2,4 ans, est un coussin de sécurité, au prix d'une croissance externe plus lente."
        },
        {
          "type": "h2",
          "text": "Le moat : pourquoi aucune ne se fait déloger facilement"
        },
        {
          "type": "p",
          "text": "Un bon bilan ne suffit jamais à me convaincre. Ce que je cherche vraiment, c'est le moat : le fossé concurrentiel, ce qui empêche un rival de venir prendre la place. Et c'est peut-être le point sur lequel les deux se ressemblent le plus."
        },
        {
          "type": "p",
          "text": "Leur moat à toutes les deux repose sur le même mécanisme : des coûts de changement élevés. Quand un logiciel devient critique pour faire ton travail, en changer coûte cher en temps, en formation, en risque d'erreur. Demande à un bureau d'études d'abandonner les outils Bentley au milieu de la conception d'un pont : c'est impensable, des années de fichiers et de réflexes sont en jeu. Même logique pour les logiciels de niche de Roper, souvent leaders sur des marchés étroits où ils sont devenus le standard de fait. Personne ne change de logiciel comptable spécialisé ou de système de gestion hospitalier pour économiser quelques euros."
        },
        {
          "type": "p",
          "text": "Ce moat se voit dans un chiffre que je regarde toujours : le Cash ROCE. Il répond à une question simple : pour chaque euro mis dans le business, combien de cash il recrache chaque année ? Chez Roper, c'est 26 %, donc 26 centimes de cash par euro investi, par an. C'est environ deux fois le seuil que je considère comme excellent. Chez Bentley, ce rendement est très élevé lui aussi, porté par un modèle léger en actifs : Bentley vend des licences logicielles, elle n'a quasiment pas d'usines ni de stocks à financer. Peu de capital immobilisé, beaucoup de cash en retour."
        },
        {
          "type": "h2",
          "text": "Les risques que je n'oublie pas"
        },
        {
          "type": "p",
          "text": "Je serais malhonnête de ne te montrer que la lumière. Les deux ont de vrais trade-offs."
        },
        {
          "type": "p",
          "text": "Pour Roper, le risque tient à son propre modèle : tout repose sur sa capacité à continuer de trouver de bonnes entreprises à racheter, à bon prix, et à bien les intégrer. Le jour où elle surpaie une acquisition, ou où elle manque de cibles de qualité, la machine ralentit, et la dette de 4,2 ans devient un poids plutôt qu'un levier. Une machine à acquisitions ne vaut que tant qu'elle achète bien."
        },
        {
          "type": "p",
          "text": "Pour Bentley, le risque est surtout dans le prix. À 25 fois son cash, l'action est chère en absolu, même si elle est basse dans sa propre histoire. Un P/FCF élevé ne pardonne pas la déception : si la croissance ralentit, le multiple peut se dégonfler vite. Bentley est aussi exposée aux cycles de l'infrastructure et de la construction, qui dépendent des budgets publics et privés."
        },
        {
          "type": "p",
          "text": "Et le risque commun aux deux, le plus simple : la qualité ne protège jamais du prix. Un P/FCF bas comme celui de Roper n'est une bonne affaire que si la qualité tient, et un P/FCF élevé comme celui de Bentley n'est justifié que si la croissance suit. C'est exactement pour ça que je juge la qualité d'abord, et le prix séparément."
        },
        {
          "type": "h2",
          "text": "Alors, laquelle choisir ?"
        },
        {
          "type": "p",
          "text": "Honnêtement, il n'y a pas de gagnant absolu, et c'est tout l'intérêt. Si je devais résumer : Roper est le choix de la valorisation et des marges, signalée en opportunité, au prix d'une dette plus lourde et d'une dépendance à ses rachats. Bentley est le choix de la croissance organique du cash par action et de la prudence financière, au prix d'une valorisation chère en absolu."
        },
        {
          "type": "p",
          "text": "Le bon arbitrage dépend de ce que tu cherches et de ce en quoi tu crois. Tu préfères une entreprise qui grandit surtout par sa propre force, quitte à la payer cher ? Bentley. Tu préfères une mécanique d'acquisitions éprouvée, moins chère aujourd'hui, en acceptant plus de dette ? Roper. Aucune réponse n'est universellement bonne, elles répondent à des tempéraments différents."
        },
        {
          "type": "p",
          "text": "Pour creuser, tu trouveras le détail des critères et de la valorisation sur la page d'analyse de Bentley, sur celle de Roper, et la liste complète des entreprises qui décrochent ma note maximale dans mon classement des sociétés notées 10 sur 10. Si tu veux comprendre la mécanique derrière ces notes, tout est expliqué dans ma méthodologie."
        },
        {
          "type": "p",
          "text": "Juger si une entreprise est bonne, puis à quel prix l'acheter, séparément, en quelques secondes et pour n'importe quelle action : c'est exactement ce que je voulais pouvoir faire. Alors je l'ai construit."
        }
      ],
      "faq": [
        {
          "q": "Pourquoi comparer deux actions notées 10/10 ?",
          "a": "Parce que deux entreprises peuvent être excellentes par des chemins opposés. Bentley et Roper valident toutes les deux mes 10 critères de qualité, mais l'une grandit organiquement avec peu de dette, l'autre rachète des concurrents et porte plus de dette. La note mesure la qualité, pas le prix ni le profil de risque."
        },
        {
          "q": "Bentley ou Roper est-elle la moins chère ?",
          "a": "Roper, nettement. Elle se paie 14,4 fois son free cash flow contre 25,1 fois pour Bentley, et mon outil la signale en opportunité. Attention toutefois : Bentley est à un percentile de 0, donc chère en absolu mais au plus bas de sa propre histoire de valorisation."
        },
        {
          "q": "Pourquoi Roper est-elle plus endettée que Bentley ?",
          "a": "Parce que Roper est une machine à acquisitions : elle s'endette pour racheter des éditeurs de logiciels de niche. Sa dette nette représente 4,2 ans de cash, contre 2,4 ans pour Bentley, qui grandit surtout de façon organique sans financer ses rachats à crédit."
        },
        {
          "q": "C'est quoi, le Cash ROCE ?",
          "a": "Le Cash ROCE répond à une question simple : pour chaque euro mis dans le business, combien de cash il recrache par an ? Roper affiche 26 %, soit 26 centimes par euro et par an, environ deux fois mon seuil d'excellence. Bentley est très élevée aussi, grâce à son modèle léger en actifs."
        },
        {
          "q": "Faut-il acheter Bentley ou Roper ?",
          "a": "Il n'y a pas de gagnant absolu. Roper privilégie le prix et les marges, Bentley la croissance organique du cash et la prudence financière. Le bon choix dépend de ce que tu cherches et du prix que tu acceptes de payer. Ceci n'est pas un conseil en investissement, fais tes propres recherches."
        }
      ],
      "tags": [
        "Analyse",
        "Logiciel",
        "Comparatif",
        "Valorisation"
      ],
      "disclaimer": "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres à la date de publication (juin 2026), susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "Bentley Systems (BSY) or Roper (ROP) : 10/10 compared",
      "excerpt": "Two software companies rated 10 out of 10, two ways of being excellent. One grows on its own, the other buys. One is pricier, the other flagged as an opportunity. Here is how I split them, with no absolute winner.",
      "metaDescription": "Bentley Systems (BSY) versus Roper (ROP) : two software firms rated 10/10. Valuation, growth, debt, capital allocation. How I compare, with no absolute winner.",
      "answer": "Bentley and Roper are two software companies rated 10 out of 10 in my method: top quality. But they are not interchangeable. Roper trades clearly cheaper and posts better margins; Bentley grows a bit faster on cash per share and carries less debt. Two profiles, not one winner.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Bentley Systems (BSY) and Roper Technologies (ROP) both earn my 10 out of 10 score: business quality is top-tier on both sides.",
            "Price separates them: Roper trades at 14.4 times its yearly cash (flagged as an opportunity), Bentley at 25.1 times (expensive in absolute terms, but low in its own history).",
            "Roper is an acquisition machine, so more indebted (net debt of 4.2 years of cash); Bentley grows mostly on its own, with less debt (2.4 years).",
            "Bentley grows a bit faster on cash per share (21% a year versus 11%); Roper has better margins (net margin 21% versus 18%).",
            "The thread of this whole piece: judge the quality of a business and the price of the stock separately, never at the same time."
          ]
        },
        {
          "type": "h2",
          "text": "Two 10/10s, and yet two very different companies"
        },
        {
          "type": "p",
          "text": "The first time I put Bentley and Roper side by side, I told myself comparing two perfect scores was pointless. If both are worth 10 out of 10, you may as well flip a coin. I was wrong. Two companies can reach excellence through radically different paths, and that is exactly what makes the comparison useful."
        },
        {
          "type": "p",
          "text": "First, a word on that score. When I say 10 out of 10, I do not grade on gut feeling. I run the company through 10 fundamental quality criteria: is it truly profitable, are its sales and cash growing, does it turn accounting profit into real cash, is its debt under control, does it return money to shareholders without wasting it? A company that passes them all gets a 10. That is rare, by design. Bentley and Roper both manage it. But the score measures business quality, not the stock price. Those are two questions I never mix."
        },
        {
          "type": "p",
          "text": "Bentley makes engineering and infrastructure software: the tools used to design bridges, roads, water networks, plants. We are talking about BIM (Building Information Modeling), the digital model of a structure, which follows the construction site and then operations for decades. Roper is not really a single publisher: it is a conglomerate, a holding company that owns a collection of niche software firms, each a leader in its small market, acquired one by one over the years. The first builds, the second collects."
        },
        {
          "type": "h2",
          "text": "Price: Roper is clearly cheaper"
        },
        {
          "type": "p",
          "text": "Let us start with the awkward question, because it is the one that separates them most. To measure what you pay, I look at one simple ratio: the P/FCF (price to free cash flow). It is the share price divided by the free cash flow it generates each year. Free cash flow is the money that truly stays in the bank once every bill is paid (salaries, machines, taxes). A P/FCF of 14 means you are paying today the equivalent of fourteen years of that cash. The lower it is, the cheaper it is."
        },
        {
          "type": "p",
          "text": "Roper trades at 14.4 times its free cash flow. Bentley trades at 25.1 times. Roughly speaking, for the same euro of yearly cash generated, Bentley costs you almost twice as much as Roper. That is a huge gap between two companies of comparable quality."
        },
        {
          "type": "p",
          "text": "But a raw number is never enough: you have to place it back in the company's history. That is where the percentile comes in. The percentile situates today's valuation against every valuation the stock has seen in its past. A percentile of 0 means the stock has almost never been this cheap relative to itself. A percentile of 8 is nearly the same: very low in its history."
        },
        {
          "type": "p",
          "text": "And here is the surprise. Bentley is at a percentile of 0: despite its high P/FCF of 25, it has never been this cheap in its own history. In other words, it is expensive in absolute terms, but the stock has always traded even more expensively before. Roper is at a percentile of 8, and my tool flags it outright as an opportunity: both cheap in absolute terms (14.4 times) and low in its history. On price alone, Roper has the edge."
        },
        {
          "type": "h2",
          "text": "Growth and margins: crossed advantages"
        },
        {
          "type": "p",
          "text": "If Roper is cheaper, maybe it grows more slowly? Not really. Both grow at a similar pace on revenue: about 12% a year for Roper, 11% for Bentley. Almost neck and neck."
        },
        {
          "type": "p",
          "text": "The nuance lies elsewhere, in cash per share. There, Bentley moves faster: its free cash flow per share climbs 21% a year, versus 11% for Roper. Why do I look at cash per share and not just revenue? Because that is what actually comes back to each shareholder. A company can grow its sales while issuing shares left and right, and every holder ends up with a thinner slice of the cake. Cash per share corrects for that: it measures the wealth created per share you hold."
        },
        {
          "type": "p",
          "text": "In return, Roper takes the lead on pure profitability. Its net margin is 21%, versus 18% for Bentley. Net margin is the share of revenue that remains as profit once everything is paid. And on free cash flow margin, same ranking: 30% for Roper, 27% for Bentley. A 30% FCF margin means that out of 100 euros of sales, 30 end up as genuinely available cash. Most companies top out near 10. Both are therefore well above the pack, Roper a notch ahead."
        },
        {
          "type": "p",
          "text": "You can see the picture forming: Bentley for the speed of cash per share, Roper for margins and price. Neither dominates on every front."
        },
        {
          "type": "h2",
          "text": "Capital allocation: build or buy?"
        },
        {
          "type": "p",
          "text": "This is where the two models diverge most, and it is the point I find most instructive. Capital allocation is how a management uses the money it earns: reinvesting it, buying competitors, buying back its own shares, or paying down debt. It is one of the things that tells good management from bad."
        },
        {
          "type": "p",
          "text": "Roper is a serial acquirer. Its job, at heart, is to use the cash it generates to buy other niche software firms, let them run with great autonomy, and collect their cash in turn. It is a formidable model when well executed: each successful acquisition adds a new source of recurring cash. But it has a flip side. To finance those purchases, Roper takes on more debt."
        },
        {
          "type": "p",
          "text": "I measure that debt with a ratio: net debt against free cash flow. It answers a concrete question: how many years of cash would it take to repay all the debt? At Roper, it is 4.2 years. At Bentley, 2.4 years. Bentley is therefore far less indebted, because it grows mostly organically: it develops its own software rather than buying others' on credit. Its growth comes from within, not from the checkbook."
        },
        {
          "type": "p",
          "text": "Neither is bad, they are different philosophies. Roper's 4.2 years of debt is not alarming for an acquisition machine whose cash flows are very steady, but it makes it more sensitive to interest rates and to bad acquisitions. Bentley's caution, at 2.4 years, is a safety cushion, at the cost of slower external growth."
        },
        {
          "type": "h2",
          "text": "The moat: why neither is easily dislodged"
        },
        {
          "type": "p",
          "text": "A clean balance sheet is never enough to convince me. What I really look for is the moat: the competitive trench, what stops a rival from taking the spot. And it may be the point on which the two resemble each other most."
        },
        {
          "type": "p",
          "text": "The moat of both rests on the same mechanism: high switching costs. When a piece of software becomes critical to doing your job, changing it is costly in time, training, and risk of error. Ask a design office to drop Bentley's tools in the middle of designing a bridge: it is unthinkable, years of files and reflexes are at stake. Same logic for Roper's niche software, often leaders in narrow markets where they have become the de facto standard. Nobody switches specialized accounting software or a hospital management system to save a few euros."
        },
        {
          "type": "p",
          "text": "This moat shows up in a number I always check: Cash ROCE. It answers a simple question: for every euro put into the business, how much cash does it spit back each year? At Roper, it is 26%, so 26 cents of cash per euro invested, per year. That is roughly twice the threshold I consider excellent. At Bentley, this return is very high too, carried by an asset-light model: Bentley sells software licenses, it has almost no factories or inventory to finance. Little capital tied up, plenty of cash in return."
        },
        {
          "type": "h2",
          "text": "The risks I do not forget"
        },
        {
          "type": "p",
          "text": "I would be dishonest to show you only the bright side. Both have real trade-offs."
        },
        {
          "type": "p",
          "text": "For Roper, the risk lies in its own model: everything rests on its ability to keep finding good companies to buy, at a good price, and to integrate them well. The day it overpays for an acquisition, or runs short of quality targets, the machine slows, and the 4.2 years of debt become a weight rather than a lever. An acquisition machine is only worth as much as it buys well."
        },
        {
          "type": "p",
          "text": "For Bentley, the risk is mostly in the price. At 25 times its cash, the stock is expensive in absolute terms, even if it is low in its own history. A high P/FCF does not forgive disappointment: if growth slows, the multiple can deflate fast. Bentley is also exposed to the cycles of infrastructure and construction, which depend on public and private budgets."
        },
        {
          "type": "p",
          "text": "And the risk shared by both, the simplest one: quality never protects you from price. A low P/FCF like Roper's is only a bargain if the quality holds, and a high P/FCF like Bentley's is only justified if the growth follows. That is exactly why I judge quality first, and price separately."
        },
        {
          "type": "h2",
          "text": "So, which one to choose?"
        },
        {
          "type": "p",
          "text": "Honestly, there is no absolute winner, and that is the whole point. If I had to sum up: Roper is the choice of valuation and margins, flagged as an opportunity, at the cost of heavier debt and a dependence on its acquisitions. Bentley is the choice of organic growth in cash per share and financial caution, at the cost of a valuation that is expensive in absolute terms."
        },
        {
          "type": "p",
          "text": "The right trade-off depends on what you are looking for and what you believe in. Do you prefer a company that grows mostly on its own strength, even if you pay up for it? Bentley. Do you prefer a proven acquisition machine, cheaper today, while accepting more debt? Roper. No answer is universally right, they suit different temperaments."
        },
        {
          "type": "p",
          "text": "To dig deeper, you will find the detail of the criteria and valuation on Bentley's analysis page, on Roper's, and the full list of companies that earn my top score in my ranking of firms rated 10 out of 10. If you want to understand the mechanics behind these scores, it is all explained in my methodology."
        },
        {
          "type": "p",
          "text": "Judging whether a company is good, then at what price to buy it, separately, in a few seconds and for any stock: that is exactly what I wanted to be able to do. So I built it."
        }
      ],
      "faq": [
        {
          "q": "Why compare two stocks both rated 10/10?",
          "a": "Because two companies can be excellent through opposite paths. Bentley and Roper both pass my 10 quality criteria, but one grows organically with little debt while the other buys competitors and carries more debt. The score measures quality, not price or risk profile."
        },
        {
          "q": "Is Bentley or Roper the cheaper one?",
          "a": "Roper, clearly. It trades at 14.4 times its free cash flow versus 25.1 times for Bentley, and my tool flags it as an opportunity. Note, though: Bentley is at a percentile of 0, so expensive in absolute terms but at the bottom of its own valuation history."
        },
        {
          "q": "Why is Roper more indebted than Bentley?",
          "a": "Because Roper is an acquisition machine: it takes on debt to buy niche software firms. Its net debt represents 4.2 years of cash, versus 2.4 years for Bentley, which grows mostly organically without financing its purchases on credit."
        },
        {
          "q": "What is Cash ROCE?",
          "a": "Cash ROCE answers a simple question: for every euro put into the business, how much cash does it spit back per year? Roper posts 26%, so 26 cents per euro per year, about twice my excellence threshold. Bentley is very high too, thanks to its asset-light model."
        },
        {
          "q": "Should you buy Bentley or Roper?",
          "a": "There is no absolute winner. Roper favors price and margins, Bentley favors organic cash growth and financial caution. The right choice depends on what you are looking for and the price you accept to pay. This is not investment advice, do your own research."
        }
      ],
      "tags": [
        "Analysis",
        "Software",
        "Comparison",
        "Valuation"
      ],
      "disclaimer": "This article is an analysis for informational and educational purposes, and does not constitute personalized investment advice. Past performance does not guarantee future results. Figures as of the publication date (June 2026), subject to change. Do your own research."
    },
    "es": {
      "title": "Bentley Systems (BSY) o Roper (ROP) : 10/10 comparadas",
      "excerpt": "Dos empresas de software con nota 10 sobre 10, dos formas de ser excelentes. Una crece sola, la otra compra. Una es más cara, la otra señalada como oportunidad. Así es como las separo, sin un ganador absoluto.",
      "metaDescription": "Bentley (BSY) frente a Roper (ROP), dos software con nota 10/10: valoración, crecimiento, deuda y asignación de capital. Cómo comparo, sin ganador absoluto.",
      "answer": "Bentley y Roper son dos empresas de software con nota 10 sobre 10 en mi método: calidad máxima. Pero no son intercambiables. Roper cotiza claramente más barata y luce mejores márgenes; Bentley crece algo más rápido en caja por acción y carga menos deuda. Dos perfiles, no un ganador.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Bentley Systems (BSY) y Roper Technologies (ROP) obtienen ambas mi nota de 10 sobre 10: la calidad del negocio está en lo más alto en los dos casos.",
            "El precio las separa: Roper cotiza a 14,4 veces su caja anual (señalada como oportunidad), Bentley a 25,1 veces (cara en absoluto, pero baja en su propia historia).",
            "Roper es una máquina de adquisiciones, por eso más endeudada (deuda neta de 4,2 años de caja); Bentley crece sobre todo sola, con menos deuda (2,4 años).",
            "Bentley crece algo más rápido en caja por acción (21 % al año frente al 11 %); Roper tiene mejores márgenes (margen neto del 21 % frente al 18 %).",
            "El hilo de todo el artículo: juzgar la calidad de un negocio y el precio de la acción por separado, nunca a la vez."
          ]
        },
        {
          "type": "h2",
          "text": "Dos 10 sobre 10 y, sin embargo, dos empresas muy distintas"
        },
        {
          "type": "p",
          "text": "La primera vez que puse a Bentley y Roper una al lado de la otra, me dije que comparar dos notas perfectas no tenía mucho interés. Si las dos valen 10 sobre 10, igual da lanzar una moneda al aire. Me equivocaba. Dos empresas pueden alcanzar la excelencia por caminos radicalmente distintos, y eso es justamente lo que hace útil la comparación."
        },
        {
          "type": "p",
          "text": "Primero, una palabra sobre esa nota. Cuando digo 10 sobre 10, no califico por intuición. Paso la empresa por un tamiz de 10 criterios de calidad fundamental: ¿es de verdad rentable, crecen sus ventas y su caja, transforma su beneficio contable en caja real, está controlada su deuda, devuelve dinero a sus accionistas sin derrochar? Una empresa que los valida todos obtiene un 10. Es raro, por construcción. Bentley y Roper lo logran las dos. Pero la nota mide la calidad del negocio, no el precio de la acción. Son dos preguntas que nunca mezclo."
        },
        {
          "type": "p",
          "text": "Bentley edita software de ingeniería e infraestructura: las herramientas que sirven para diseñar puentes, carreteras, redes de agua, fábricas. Hablamos de BIM (Building Information Modeling), es decir, la maqueta digital de una obra, que acompaña a la construcción y luego a la explotación durante décadas. Roper no es realmente un editor único: es un conglomerado, una sociedad holding que posee una colección de empresas de software de nicho, cada una líder en su pequeño mercado, compradas una a una a lo largo de los años. La primera construye, la segunda colecciona."
        },
        {
          "type": "h2",
          "text": "El precio: Roper es claramente más barata"
        },
        {
          "type": "p",
          "text": "Empecemos por la pregunta incómoda, porque es la que más las separa. Para medir lo que se paga, miro un ratio sencillo: el P/FCF (price to free cash flow). Es el precio de la acción dividido entre el flujo de caja libre que genera cada año. El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas (sueldos, máquinas, impuestos). Un P/FCF de 14 significa que pagas hoy el equivalente a catorce años de esa caja. Cuanto más bajo, más barato."
        },
        {
          "type": "p",
          "text": "Roper cotiza a 14,4 veces su flujo de caja libre. Bentley cotiza a 25,1 veces. A grandes rasgos, por el mismo euro de caja anual generada, Bentley te cuesta casi el doble que Roper. Es una brecha enorme entre dos empresas de calidad comparable."
        },
        {
          "type": "p",
          "text": "Pero un dato en bruto nunca basta: hay que situarlo en la historia de la empresa. Ahí entra el percentil. El percentil sitúa la valoración de hoy frente a todas las que la acción ha conocido en su pasado. Un percentil de 0 significa que la acción casi nunca ha estado tan barata como hoy respecto a sí misma. Un percentil de 8 es casi lo mismo: muy bajo en su historial."
        },
        {
          "type": "p",
          "text": "Y aquí, sorpresa. Bentley está en un percentil de 0: pese a su P/FCF alto de 25, nunca ha estado tan barata en su propia historia. Dicho de otro modo, es cara en absoluto, pero la acción siempre se había pagado aún más cara antes. Roper está en un percentil de 8, y mi herramienta la señala directamente como una oportunidad: a la vez barata en absoluto (14,4 veces) y baja en su historial. Solo en el terreno del precio, Roper saca ventaja."
        },
        {
          "type": "h2",
          "text": "El crecimiento y los márgenes: ventajas cruzadas"
        },
        {
          "type": "p",
          "text": "Si Roper es más barata, ¿quizá crece menos? No realmente. Las dos crecen a un ritmo parecido en ingresos: alrededor del 12 % al año Roper, el 11 % Bentley. Casi a la par."
        },
        {
          "type": "p",
          "text": "El matiz está en otro sitio, en la caja por acción. Ahí Bentley va más rápido: su flujo de caja libre por acción sube un 21 % al año, frente al 11 % de Roper. ¿Por qué miro la caja por acción y no solo los ingresos? Porque es lo que de verdad le llega a cada accionista. Una empresa puede hacer crecer sus ventas mientras emite acciones sin parar, y cada tenedor se queda con una porción más fina del pastel. La caja por acción corrige eso: mide la riqueza creada por cada acción que posees."
        },
        {
          "type": "p",
          "text": "En cambio, Roper recupera la ventaja en la rentabilidad pura. Su margen neto es del 21 %, frente al 18 % de Bentley. El margen neto es la parte de los ingresos que queda como beneficio una vez pagado todo. Y en el margen de flujo de caja libre, la misma jerarquía: 30 % para Roper, 27 % para Bentley. Un margen de FCF del 30 % significa que de cada 100 euros de ventas, 30 acaban en caja realmente disponible. La mayoría de las empresas no pasan del 10. Las dos están, pues, muy por encima de la media, Roper un escalón por delante."
        },
        {
          "type": "p",
          "text": "Ves cómo se dibuja el cuadro: Bentley por la velocidad de la caja por acción, Roper por los márgenes y el precio. Ninguna domina en todos los frentes."
        },
        {
          "type": "h2",
          "text": "La asignación de capital: ¿construir o comprar?"
        },
        {
          "type": "p",
          "text": "Aquí es donde más divergen los dos modelos, y es el punto que me parece más instructivo. La asignación de capital es la forma en que una dirección usa el dinero que gana: reinvertirlo, comprar competidores, recomprar sus propias acciones o amortizar deuda. Es una de las cosas que distingue a una buena gestión de una mala."
        },
        {
          "type": "p",
          "text": "Roper es una compradora en serie. Su negocio, en el fondo, es usar la caja que genera para comprar otras empresas de software de nicho, dejarlas funcionar con gran autonomía y cobrar su caja a su vez. Es un modelo temible cuando se ejecuta bien: cada adquisición exitosa añade una nueva fuente de caja recurrente. Pero tiene una contrapartida. Para financiar esas compras, Roper se endeuda más."
        },
        {
          "type": "p",
          "text": "Mido ese endeudamiento con un ratio: la deuda neta frente al flujo de caja libre. Responde a una pregunta concreta: ¿cuántos años de caja harían falta para devolver toda la deuda? En Roper, son 4,2 años. En Bentley, 2,4 años. Bentley está, pues, claramente menos endeudada, porque crece sobre todo de forma orgánica: desarrolla su propio software en lugar de comprar el de otros a crédito. Su crecimiento viene de dentro, no del talonario."
        },
        {
          "type": "p",
          "text": "Ni una ni otra es mala, son filosofías distintas. La deuda de 4,2 años de Roper no es alarmante para una máquina de adquisiciones cuyos flujos de caja son muy regulares, pero la hace más sensible a los tipos de interés y a las malas adquisiciones. La prudencia de Bentley, con 2,4 años, es un colchón de seguridad, a costa de un crecimiento externo más lento."
        },
        {
          "type": "h2",
          "text": "El foso: por qué a ninguna se la desbanca con facilidad"
        },
        {
          "type": "p",
          "text": "Un buen balance nunca basta para convencerme. Lo que de verdad busco es el foso: la trinchera competitiva, lo que impide a un rival venir a ocupar el lugar. Y quizá sea el punto en el que más se parecen las dos."
        },
        {
          "type": "p",
          "text": "El foso de ambas se apoya en el mismo mecanismo: unos costes de cambio elevados. Cuando un software se vuelve crítico para hacer tu trabajo, cambiarlo cuesta caro en tiempo, formación y riesgo de error. Pídele a una oficina de ingeniería que abandone las herramientas de Bentley a mitad del diseño de un puente: es impensable, hay años de archivos y reflejos en juego. Misma lógica para el software de nicho de Roper, a menudo líder en mercados estrechos donde se ha vuelto el estándar de facto. Nadie cambia de software contable especializado o de sistema de gestión hospitalaria para ahorrarse unos euros."
        },
        {
          "type": "p",
          "text": "Este foso se ve en un dato que siempre miro: el Cash ROCE. Responde a una pregunta sencilla: por cada euro metido en el negocio, ¿cuánta caja escupe cada año? En Roper, es el 26 %, es decir, 26 céntimos de caja por euro invertido, al año. Es alrededor del doble del umbral que considero excelente. En Bentley, esta rentabilidad es muy alta también, impulsada por un modelo ligero en activos: Bentley vende licencias de software, casi no tiene fábricas ni existencias que financiar. Poco capital inmovilizado, mucha caja de vuelta."
        },
        {
          "type": "h2",
          "text": "Los riesgos que no olvido"
        },
        {
          "type": "p",
          "text": "Sería deshonesto enseñarte solo la luz. Las dos tienen verdaderos trade-offs."
        },
        {
          "type": "p",
          "text": "Para Roper, el riesgo está en su propio modelo: todo depende de su capacidad de seguir encontrando buenas empresas que comprar, a buen precio, e integrarlas bien. El día que pague de más por una adquisición, o que le falten objetivos de calidad, la máquina se ralentiza, y los 4,2 años de deuda pasan de palanca a lastre. Una máquina de adquisiciones solo vale mientras compra bien."
        },
        {
          "type": "p",
          "text": "Para Bentley, el riesgo está sobre todo en el precio. A 25 veces su caja, la acción es cara en absoluto, aunque esté baja en su propia historia. Un P/FCF alto no perdona la decepción: si el crecimiento se ralentiza, el múltiplo puede desinflarse rápido. Bentley está también expuesta a los ciclos de la infraestructura y la construcción, que dependen de los presupuestos públicos y privados."
        },
        {
          "type": "p",
          "text": "Y el riesgo común a las dos, el más sencillo: la calidad nunca te protege del precio. Un P/FCF bajo como el de Roper solo es una ganga si la calidad aguanta, y un P/FCF alto como el de Bentley solo se justifica si el crecimiento acompaña. Por eso justamente juzgo primero la calidad, y el precio por separado."
        },
        {
          "type": "h2",
          "text": "Entonces, ¿cuál elegir?"
        },
        {
          "type": "p",
          "text": "Honestamente, no hay un ganador absoluto, y ahí está todo el interés. Si tuviera que resumir: Roper es la opción de la valoración y los márgenes, señalada como oportunidad, a costa de una deuda más pesada y de una dependencia de sus compras. Bentley es la opción del crecimiento orgánico de la caja por acción y de la prudencia financiera, a costa de una valoración cara en absoluto."
        },
        {
          "type": "p",
          "text": "El buen arbitraje depende de lo que buscas y de aquello en lo que crees. ¿Prefieres una empresa que crece sobre todo por su propia fuerza, aunque la pagues cara? Bentley. ¿Prefieres una mecánica de adquisiciones contrastada, más barata hoy, aceptando más deuda? Roper. Ninguna respuesta es universalmente buena, responden a temperamentos distintos."
        },
        {
          "type": "p",
          "text": "Para profundizar, encontrarás el detalle de los criterios y de la valoración en la página de análisis de Bentley, en la de Roper, y la lista completa de empresas que se llevan mi nota máxima en mi clasificación de empresas con nota 10 sobre 10. Si quieres entender la mecánica detrás de estas notas, está todo explicado en mi metodología."
        },
        {
          "type": "p",
          "text": "Juzgar si una empresa es buena, y luego a qué precio comprarla, por separado, en unos segundos y para cualquier acción: es exactamente lo que quería poder hacer. Así que lo construí."
        }
      ],
      "faq": [
        {
          "q": "¿Por qué comparar dos acciones con nota 10/10?",
          "a": "Porque dos empresas pueden ser excelentes por caminos opuestos. Bentley y Roper validan ambas mis 10 criterios de calidad, pero una crece de forma orgánica con poca deuda y la otra compra competidores y carga más deuda. La nota mide la calidad, no el precio ni el perfil de riesgo."
        },
        {
          "q": "¿Cuál es más barata, Bentley o Roper?",
          "a": "Roper, claramente. Cotiza a 14,4 veces su flujo de caja libre frente a 25,1 veces de Bentley, y mi herramienta la señala como oportunidad. Ojo, eso sí: Bentley está en un percentil de 0, así que es cara en absoluto pero está en el mínimo de su propia historia de valoración."
        },
        {
          "q": "¿Por qué Roper está más endeudada que Bentley?",
          "a": "Porque Roper es una máquina de adquisiciones: se endeuda para comprar empresas de software de nicho. Su deuda neta representa 4,2 años de caja, frente a 2,4 años de Bentley, que crece sobre todo de forma orgánica sin financiar sus compras a crédito."
        },
        {
          "q": "¿Qué es el Cash ROCE?",
          "a": "El Cash ROCE responde a una pregunta sencilla: por cada euro metido en el negocio, ¿cuánta caja escupe al año? Roper luce un 26 %, es decir, 26 céntimos por euro al año, alrededor del doble de mi umbral de excelencia. Bentley es muy alta también, gracias a su modelo ligero en activos."
        },
        {
          "q": "¿Hay que comprar Bentley o Roper?",
          "a": "No hay un ganador absoluto. Roper prioriza el precio y los márgenes, Bentley el crecimiento orgánico de la caja y la prudencia financiera. La buena elección depende de lo que buscas y del precio que aceptes pagar. Esto no es asesoramiento de inversión, haz tu propia investigación."
        }
      ],
      "tags": [
        "Análisis",
        "Software",
        "Comparativa",
        "Valoración"
      ],
      "disclaimer": "Este artículo es un análisis con fines informativos y educativos, y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a la fecha de publicación (junio de 2026), sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const assuranceTop: Article = {
  "slug": "assurance-actions-10-10-pfcf-bas-juin-2026",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 11,
  "content": {
    "fr": {
      "title": "Assurance : reine de mon top qualité à prix cassé",
      "excerpt": "En juin 2026, l'assurance est de loin le secteur le plus présent dans mes actions notées 10/10, avec un cash payé environ 5 fois. Aubaine ignorée par le marché, ou risque bien réel ? Voici comment je tranche.",
      "metaDescription": "L'assurance domine mes actions notées 10/10, P/FCF moyen autour de 5 fois. Pourquoi tant d'assureurs cochent mes critères et pourquoi le marché les paie peu.",
      "answer": "En juin 2026, l'assurance est le secteur le plus représenté dans mon top des actions notées 10/10, avec un cash payé environ 5 fois en moyenne. Ces compagnies cochent mes 10 critères de qualité, et pourtant le marché les paie peu. Aubaine ignorée ou risque réel ? Je sépare la qualité du prix pour répondre.",
      "body": [
        {
          "type": "ul",
          "items": [
            "L'assurance est, en juin 2026, le secteur le plus présent dans mon top des actions notées 10/10 sur la qualité.",
            "Le prix payé y est très bas : un P/FCF moyen d'environ 5 fois, soit cinq années du cash généré.",
            "Pourquoi tant d'assureurs cochent mes critères : un float rentable, une discipline de souscription, des primes qui montent en cycle dur.",
            "Pourquoi le marché les paie peu : ils sont jugés cycliques, exposés aux catastrophes, avec une comptabilité des réserves perçue comme opaque.",
            "Ma règle, fil de tout l'article : je juge la qualité du business et le prix de l'action séparément. La qualité est là, le prix se mérite."
          ]
        },
        {
          "type": "h2",
          "text": "Le constat qui m'a sauté aux yeux"
        },
        {
          "type": "p",
          "text": "Quand je filtre mes actions notées 10 sur 10 sur la qualité, un secteur revient sans cesse, bien plus que les autres : l'assurance. Pas la tech, pas le luxe, pas la santé. L'assurance, ce métier qu'on trouve ennuyeux, est aujourd'hui le plus représenté dans mon haut de panier."
        },
        {
          "type": "p",
          "text": "Et le plus troublant n'est pas là. Ces assureurs d'élite se paient en moyenne autour de 5 fois leur cash. Dit autrement, le marché les traite à la fois comme des entreprises de très haute qualité (par leurs fondamentaux) et comme des affaires bradées (par leur prix). Les deux à la fois, c'est rare, et ça mérite qu'on s'arrête."
        },
        {
          "type": "p",
          "text": "Avant d'aller plus loin, posons les deux mots qui reviendront partout. La note sur 10, d'abord : je passe chaque entreprise au crible de 10 critères de qualité fondamentale (rentabilité, croissance, solidité du bilan, rendement du capital). Une société qui valide tout obtient 10 sur 10. C'est rare, par construction. Le P/FCF ensuite (price to free cash flow) : le prix de l'action rapporté au free cash flow qu'elle génère chaque année. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées. Un P/FCF de 5, ça veut dire que tu paies à peine cinq années de ce cash. Le sens d'abord : plus c'est bas, moins c'est cher."
        },
        {
          "type": "h2",
          "text": "La liste, sans rien inventer sur les chiffres"
        },
        {
          "type": "p",
          "text": "Voici les assureurs qui décrochent ma note maximale, avec ce que tu paies pour leur cash. Lis la colonne P/FCF comme un nombre d'années de free cash flow : plus il est bas, plus l'action est bon marché par rapport à ce qu'elle génère."
        },
        {
          "type": "ul",
          "items": [
            "RenaissanceRe (RNR) : 3,0 fois. Tu paies trois années de cash, un niveau qu'on voit d'habitude sur une entreprise en grande difficulté.",
            "Universal Insurance (UVE) : 2,9 fois. Encore plus bas, ce qui en dit long sur la méfiance du marché.",
            "Mercury General (MCY) : 4,0 fois.",
            "Selective Insurance (SIGI) : 4,8 fois.",
            "Arch Capital (ACGL) : 5,6 fois, assureur diversifié.",
            "W. R. Berkley (WRB) : 7,0 fois, l'assureur valeur par excellence.",
            "Kinsale Capital (KNSL) : 7,1 fois, le spécialiste des risques atypiques.",
            "Cincinnati Financial (CINF) : 7,4 fois, des décennies de dividendes en hausse.",
            "Progressive (PGR) : 7,4 fois, l'assureur auto le plus efficace d'Amérique."
          ]
        },
        {
          "type": "p",
          "text": "Tous ces noms ont en commun deux choses, et c'est tout l'intérêt : une note de qualité parfaite, et un multiple de cash inférieur à la moyenne du marché. Bon business et bon prix, ensemble. Pour la mécanique fine d'un de ces dossiers, j'ai détaillé le cas de Kinsale dans mon [analyse complète de Kinsale Capital](/blog/kinsale-capital-assureur-10-10)."
        },
        {
          "type": "h2",
          "text": "Pourquoi tant d'assureurs cochent mes 10 critères"
        },
        {
          "type": "p",
          "text": "Un secteur entier qui truste le haut de mon classement, ce n'est pas un hasard. Trois ressorts l'expliquent, et chacun mérite un mot simple."
        },
        {
          "type": "p",
          "text": "Le premier, c'est le float. Un assureur encaisse tes primes aujourd'hui et ne paie un éventuel sinistre que des mois, parfois des années plus tard. Entre les deux, il garde ce magot et l'investit. Cet argent des autres, encaissé avant d'être dépensé, travaille gratuitement pour lui. Quand le float est bien géré, il devient une source de cash quasi permanente, avec très peu de besoins d'investissement en machines ou en usines. D'où des marges qui ressemblent parfois à celles d'un éditeur de logiciels."
        },
        {
          "type": "p",
          "text": "Le deuxième, c'est la discipline de souscription. Souscrire, c'est l'acte de décider quel risque on accepte et à quel prix. Les meilleurs assureurs disent non bien plus souvent qu'ils ne disent oui, et refusent de courir après le volume quand les prix deviennent trop bas. Cette retenue, dans un métier où la tentation de grossir vite est permanente, se traduit dans un seul chiffre : le combined ratio. C'est la somme des sinistres et des frais rapportée aux primes encaissées. Sous 100 pour cent, l'assureur gagne de l'argent rien qu'en assurant, avant même de toucher un centime sur ses placements. Les compagnies de ma liste opèrent structurellement sous ce seuil."
        },
        {
          "type": "p",
          "text": "Le troisième, c'est le cycle. L'assurance vit des cycles : quand les sinistres ont coûté cher, les assureurs faibles se retirent, l'offre se raréfie, et les prix des primes montent. On appelle ça un cycle dur. En 2026, plusieurs lignes restent en cycle dur, ce qui dope la croissance des primes et la rentabilité des plus disciplinés. Ce contexte amplifie temporairement la qualité affichée, et je le garde en tête : un cycle se retourne."
        },
        {
          "type": "h2",
          "text": "Alors pourquoi le marché les paie-t-il si peu ?"
        },
        {
          "type": "p",
          "text": "Voilà la vraie question. Si ces entreprises sont si solides, pourquoi un cash payé 3, 4, 5 fois, là où une belle action de croissance se paie 20 ou 30 fois ? Le marché n'est pas idiot. Il applique une décote pour trois raisons honnêtes, qu'il faut peser."
        },
        {
          "type": "p",
          "text": "D'abord, l'assurance est perçue comme cyclique. Les résultats montent en cycle dur, mais peuvent retomber quand les prix des primes se détendent. Le marché refuse de payer cher des bénéfices qu'il juge passagers. Un P/FCF bas, ici, c'est en partie le marché qui dit : je ne crois pas que ce niveau de cash dure."
        },
        {
          "type": "p",
          "text": "Ensuite, le risque catastrophe. Un ouragan, un tremblement de terre, une série d'incendies, et une seule mauvaise année peut effacer plusieurs années de profits, surtout chez les réassureurs comme RenaissanceRe ou les assureurs très exposés à une région comme Universal Insurance en Floride. Cette sensibilité aux catastrophes rend les résultats moins prévisibles, et le marché déteste l'imprévisible."
        },
        {
          "type": "p",
          "text": "Enfin, la comptabilité des réserves est jugée opaque. Un assureur doit estimer aujourd'hui ce qu'il paiera demain pour des sinistres pas encore réglés : ce sont les réserves. Or ces estimations reposent sur des hypothèses que l'extérieur ne peut pas vérifier facilement. Un assureur peut, en théorie, sous-réserver pour gonfler ses profits du moment. Cette zone grise pousse beaucoup d'investisseurs à se méfier, et donc à payer moins cher."
        },
        {
          "type": "h2",
          "text": "Blind spot du marché, ou risque bien réel ?"
        },
        {
          "type": "p",
          "text": "Ma réponse est nuancée, et elle passe par ma règle de fond : je sépare toujours deux questions que la plupart des gens confondent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce le bon prix ? Une entreprise géniale payée trop cher reste un mauvais placement, et un prix bas peut cacher un déclin bien réel."
        },
        {
          "type": "p",
          "text": "Côté qualité, la réponse est claire : ces assureurs sont d'excellents business, et ma note de 10 sur 10 le dit sans ambiguïté. Le float, la discipline, la conversion du bénéfice en cash réel sont là, mesurés, pas supposés."
        },
        {
          "type": "p",
          "text": "Côté prix, c'est plus subtil. Une partie de la décote est un vrai blind spot : le marché déteste le cyclique et l'imprévisible au point de sous-payer la qualité durable de certaines de ces maisons. Mais une autre partie est un risque réel : un cycle qui se retourne, une saison de catastrophes brutale, des réserves mal calibrées. Le P/FCF bas n'est jamais une bonne affaire en soi. Il l'est seulement si la qualité tient dans le mauvais temps, pas seulement dans le beau."
        },
        {
          "type": "p",
          "text": "C'est pour ça que je ne traite jamais cette liste comme un panier à acheter en bloc. Je regarde dossier par dossier : un réassureur exposé aux catastrophes ne se juge pas comme un assureur auto régulier. La note de qualité me dit où chercher. Le prix me dit quand. Et le risque propre à chaque compagnie me dit combien j'y crois."
        },
        {
          "type": "h2",
          "text": "Ce que j'en fais, concrètement"
        },
        {
          "type": "p",
          "text": "Je ne te vendrai pas de certitude sur le timing. Personne ne sait quand un cycle d'assurance se retourne, ni quand le marché cessera de sous-payer ces business. Ce que je sais, c'est qu'acheter de la qualité à bon prix a historiquement bien vieilli, à condition de ne jamais confondre une décote avec un déclin."
        },
        {
          "type": "p",
          "text": "Concrètement, je commence par la qualité, puis je vérifie le prix, puis je pèse le risque spécifique. Tu peux faire le même chemin : filtrer les entreprises que je note [10 sur 10 sur la qualité](/classement/qualite-10-sur-10), croiser avec mon classement des [actions sous-évaluées](/classement/sous-evaluees), et comprendre comment ces deux jugements sont construits dans ma [méthodologie](/methodologie)."
        },
        {
          "type": "p",
          "text": "C'est exactement ce que je voulais pouvoir faire en quelques secondes pour n'importe quelle action : juger la qualité d'un côté, le prix de l'autre, et repérer les rares cas où les deux s'alignent. Comme je ne trouvais pas l'outil, je l'ai construit. Le pas cher, on en trouve partout. La qualité pas chère, et qui tient dans la tempête, beaucoup plus rarement."
        }
      ],
      "faq": [
        {
          "q": "Pourquoi l'assurance domine-t-elle ton top des actions 10/10 ?",
          "a": "Parce que les meilleurs assureurs combinent trois forces que mes critères récompensent : un float rentable (l'argent des primes encaissé d'avance et investi), une discipline de souscription qui les rend bénéficiaires rien qu'en assurant, et des primes en hausse en cycle dur. Ces trois ressorts produisent beaucoup de cash avec peu de besoins d'investissement."
        },
        {
          "q": "Pourquoi le marché paie-t-il ces assureurs si peu cher ?",
          "a": "Pour trois raisons honnêtes. Ils sont perçus comme cycliques, donc le marché doute que leurs bénéfices actuels durent. Ils sont exposés aux catastrophes, ce qui rend les résultats imprévisibles. Et leur comptabilité des réserves, ces sommes estimées pour des sinistres futurs, est jugée opaque. Cette méfiance fait baisser le prix, donc le P/FCF."
        },
        {
          "q": "Un P/FCF de 5 fois, est-ce une bonne affaire ?",
          "a": "Pas en soi. Un P/FCF de 5 veut dire que tu paies cinq années du cash généré, ce qui est très bas. Mais un prix bas peut cacher un cycle qui va se retourner ou un risque catastrophe mal mesuré. Il n'est intéressant que si la qualité du business tient aussi dans le mauvais temps. D'où ma règle : la qualité d'abord, le prix ensuite."
        },
        {
          "q": "C'est quoi le float et le combined ratio, en clair ?",
          "a": "Le float, c'est l'argent des primes qu'un assureur encaisse avant de payer d'éventuels sinistres : il l'investit entre-temps, gratuitement. Le combined ratio est la somme des sinistres et des frais rapportée aux primes. Sous 100 pour cent, l'assureur gagne de l'argent rien qu'en assurant, avant même ses placements."
        },
        {
          "q": "Faut-il acheter ces actions d'assurance maintenant ?",
          "a": "Ça dépend de ta discipline de prix et de ta lecture du risque propre à chaque compagnie, pas d'une prévision de marché. Une note de qualité 10/10 et un P/FCF bas signalent un bon business à un prix raisonnable, mais ne disent pas si demain sera vert ou rouge. Ceci n'est pas un conseil en investissement personnalisé : fais tes propres recherches."
        }
      ],
      "tags": [
        "Assurance",
        "Qualité",
        "Valorisation",
        "Analyse"
      ],
      "disclaimer": "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 11 juin 2026, susceptibles d'évoluer. Faites vos propres recherches."
    },
    "en": {
      "title": "Insurance : queen of my quality top at a low price",
      "excerpt": "In June 2026, insurance is by far the most common sector among my stocks rated 10/10, with cash priced at about 5 times on average. A bargain the market ignores, or a real risk? Here is how I decide.",
      "metaDescription": "Insurance dominates my 10/10 stocks, average P/FCF around 5 times. Why so many insurers tick my criteria, and why the market pays so little for them.",
      "answer": "In June 2026, insurance is the most represented sector in my top of stocks rated 10/10, with cash priced at about 5 times on average. These companies tick my 10 quality criteria, yet the market pays little for them. Ignored bargain or real risk? I separate quality from price to answer.",
      "body": [
        {
          "type": "ul",
          "items": [
            "In June 2026, insurance is the most common sector among my stocks rated 10/10 on quality.",
            "The price paid is very low: an average P/FCF of about 5 times, meaning five years of the cash generated.",
            "Why so many insurers tick my criteria: a profitable float, underwriting discipline, premiums rising in a hard cycle.",
            "Why the market pays little: they are seen as cyclical, exposed to catastrophes, with reserve accounting viewed as opaque.",
            "My rule, the thread of this whole piece: I judge the quality of the business and the price of the stock separately. Quality is there, price has to be earned."
          ]
        },
        {
          "type": "h2",
          "text": "The pattern that jumped out at me"
        },
        {
          "type": "p",
          "text": "When I filter my stocks rated 10 out of 10 on quality, one sector keeps coming back, far more than the others: insurance. Not tech, not luxury, not healthcare. Insurance, the business everyone finds boring, is today the most represented at the top of my list."
        },
        {
          "type": "p",
          "text": "And the most striking part is not even that. These elite insurers trade on average at about 5 times their cash. Put another way, the market treats them at once as very high quality companies (by their fundamentals) and as bargain-bin deals (by their price). Both at once is rare, and worth stopping for."
        },
        {
          "type": "p",
          "text": "Before going further, let us define the two words that come up everywhere. The score out of 10 first: I run each company through 10 fundamental quality criteria (profitability, growth, balance sheet strength, return on capital). A company that ticks them all gets 10 out of 10. It is rare, by design. Then the P/FCF (price to free cash flow): the share price relative to the free cash flow it generates each year. Free cash flow is the money that truly stays in the bank once every bill is paid. A P/FCF of 5 means you pay barely five years of that cash. Meaning first: the lower it is, the cheaper it is."
        },
        {
          "type": "h2",
          "text": "The list, with nothing invented on the numbers"
        },
        {
          "type": "p",
          "text": "Here are the insurers earning my top score, with what you pay for their cash. Read the P/FCF column as a number of years of free cash flow: the lower it is, the cheaper the stock relative to what it generates."
        },
        {
          "type": "ul",
          "items": [
            "RenaissanceRe (RNR): 3.0 times. You pay three years of cash, a level usually seen on a company in deep trouble.",
            "Universal Insurance (UVE): 2.9 times. Even lower, which says a lot about market distrust.",
            "Mercury General (MCY): 4.0 times.",
            "Selective Insurance (SIGI): 4.8 times.",
            "Arch Capital (ACGL): 5.6 times, a diversified insurer.",
            "W. R. Berkley (WRB): 7.0 times, the value insurer par excellence.",
            "Kinsale Capital (KNSL): 7.1 times, the specialist in unusual risks.",
            "Cincinnati Financial (CINF): 7.4 times, decades of rising dividends.",
            "Progressive (PGR): 7.4 times, the most efficient auto insurer in America."
          ]
        },
        {
          "type": "p",
          "text": "All these names share two things, and that is the whole point: a perfect quality score, and a cash multiple below the market average. Good business and good price, together. For the fine mechanics of one of these cases, I detailed Kinsale in my [full Kinsale Capital analysis](/blog/kinsale-capital-assureur-10-10)."
        },
        {
          "type": "h2",
          "text": "Why so many insurers tick my 10 criteria"
        },
        {
          "type": "p",
          "text": "A whole sector crowding the top of my ranking is no accident. Three drivers explain it, and each deserves a plain word."
        },
        {
          "type": "p",
          "text": "The first is the float. An insurer collects your premiums today and pays a possible claim only months, sometimes years later. In between, it keeps that pile and invests it. This other people's money, collected before it is spent, works for free. When the float is well managed, it becomes a near-permanent source of cash, with very little need to invest in machines or factories. Hence margins that sometimes look like a software company's."
        },
        {
          "type": "p",
          "text": "The second is underwriting discipline. Underwriting is the act of deciding which risk you accept and at what price. The best insurers say no far more often than they say yes, and refuse to chase volume when prices get too low. This restraint, in a business where the temptation to grow fast is constant, shows up in one number: the combined ratio. It is the sum of claims and expenses relative to premiums collected. Below 100 percent, the insurer makes money just by insuring, before earning a cent on its investments. The companies on my list operate structurally below that line."
        },
        {
          "type": "p",
          "text": "The third is the cycle. Insurance lives in cycles: when claims have been costly, weak insurers retreat, supply tightens, and premium prices rise. This is called a hard cycle. In 2026, several lines remain in a hard cycle, which boosts premium growth and the profitability of the most disciplined. This context temporarily amplifies the quality on display, and I keep it in mind: a cycle turns."
        },
        {
          "type": "h2",
          "text": "So why does the market pay so little for them?"
        },
        {
          "type": "p",
          "text": "That is the real question. If these companies are so solid, why pay 3, 4, 5 times their cash, where a fine growth stock trades at 20 or 30 times? The market is not stupid. It applies a discount for three honest reasons, which must be weighed."
        },
        {
          "type": "p",
          "text": "First, insurance is seen as cyclical. Results climb in a hard cycle but can fall back when premium prices ease. The market refuses to pay up for earnings it deems temporary. A low P/FCF, here, is partly the market saying: I do not believe this level of cash lasts."
        },
        {
          "type": "p",
          "text": "Next, catastrophe risk. A hurricane, an earthquake, a string of wildfires, and a single bad year can wipe out several years of profit, especially at reinsurers like RenaissanceRe or insurers heavily exposed to one region like Universal Insurance in Florida. This sensitivity to catastrophes makes results less predictable, and the market hates the unpredictable."
        },
        {
          "type": "p",
          "text": "Finally, reserve accounting is viewed as opaque. An insurer must estimate today what it will pay tomorrow for claims not yet settled: these are reserves. Those estimates rest on assumptions outsiders cannot easily verify. An insurer could, in theory, under-reserve to inflate current profits. This grey area pushes many investors to be wary, and therefore to pay less."
        },
        {
          "type": "h2",
          "text": "A market blind spot, or a real risk?"
        },
        {
          "type": "p",
          "text": "My answer is nuanced, and it runs through my core rule: I always separate two questions most people confuse. One: is this a good company? Two, entirely apart: is this the right price? A great company bought too expensive is still a bad investment, and a low price can hide a very real decline."
        },
        {
          "type": "p",
          "text": "On quality, the answer is clear: these insurers are excellent businesses, and my 10 out of 10 says so without ambiguity. The float, the discipline, the conversion of profit into real cash are there, measured, not assumed."
        },
        {
          "type": "p",
          "text": "On price, it is subtler. Part of the discount is a genuine blind spot: the market hates the cyclical and the unpredictable to the point of underpaying the durable quality of some of these houses. But another part is a real risk: a turning cycle, a brutal catastrophe season, mis-set reserves. A low P/FCF is never a bargain in itself. It only is if the quality holds in bad weather, not just in good."
        },
        {
          "type": "p",
          "text": "That is why I never treat this list as a basket to buy in one block. I look case by case: a catastrophe-exposed reinsurer is not judged like a steady auto insurer. The quality score tells me where to look. The price tells me when. And each company's own risk tells me how much I believe in it."
        },
        {
          "type": "h2",
          "text": "What I actually do with this"
        },
        {
          "type": "p",
          "text": "I will not sell you certainty on timing. No one knows when an insurance cycle turns, nor when the market will stop underpaying these businesses. What I do know is that buying quality at a good price has aged well historically, as long as you never confuse a discount with a decline."
        },
        {
          "type": "p",
          "text": "In practice, I start with quality, then check the price, then weigh the specific risk. You can walk the same path: filter the companies I rate [10 out of 10 on quality](/classement/qualite-10-sur-10), cross them with my ranking of [undervalued stocks](/classement/sous-evaluees), and understand how those two judgments are built in my [methodology](/methodologie)."
        },
        {
          "type": "p",
          "text": "That is exactly what I wanted to be able to do in a few seconds for any stock: judge quality on one side, price on the other, and spot the rare cases where the two align. Since I could not find the tool, I built it. Cheap is everywhere. Quality on the cheap, and that holds through the storm, far more rarely."
        }
      ],
      "faq": [
        {
          "q": "Why does insurance dominate your top of 10/10 stocks?",
          "a": "Because the best insurers combine three strengths my criteria reward: a profitable float (premium money collected in advance and invested), underwriting discipline that makes them profitable just by insuring, and rising premiums in a hard cycle. These three drivers produce a lot of cash with little need to invest."
        },
        {
          "q": "Why does the market pay so little for these insurers?",
          "a": "For three honest reasons. They are seen as cyclical, so the market doubts their current earnings will last. They are exposed to catastrophes, which makes results unpredictable. And their reserve accounting, the sums estimated for future claims, is viewed as opaque. This wariness lowers the price, hence the P/FCF."
        },
        {
          "q": "Is a P/FCF of 5 times a bargain?",
          "a": "Not on its own. A P/FCF of 5 means you pay five years of the cash generated, which is very low. But a low price can hide a cycle about to turn or a poorly measured catastrophe risk. It is only attractive if the quality of the business also holds in bad weather. Hence my rule: quality first, price second."
        },
        {
          "q": "What are the float and the combined ratio, in plain terms?",
          "a": "The float is the premium money an insurer collects before paying possible claims: it invests it in the meantime, for free. The combined ratio is the sum of claims and expenses relative to premiums. Below 100 percent, the insurer makes money just by insuring, before its investments even count."
        },
        {
          "q": "Should you buy these insurance stocks now?",
          "a": "It depends on your price discipline and your read of each company's own risk, not on a market forecast. A 10/10 quality score and a low P/FCF signal a good business at a reasonable price, but do not say whether tomorrow will be green or red. This is not personalized investment advice: do your own research."
        }
      ],
      "tags": [
        "Insurance",
        "Quality",
        "Valuation",
        "Analysis"
      ],
      "disclaimer": "This article is an analysis for informational and educational purposes, and does not constitute personalized investment advice. Past performance does not guarantee future results. Figures as of June 11, 2026, subject to change. Do your own research."
    },
    "es": {
      "title": "Seguros : reina de mi top de calidad a precio bajo",
      "excerpt": "En junio de 2026, los seguros son con diferencia el sector más presente entre mis acciones con nota 10/10, con la caja pagada unas 5 veces de media. ¿Ganga ignorada por el mercado o riesgo real? Así es como decido.",
      "metaDescription": "Los seguros dominan mis acciones 10/10, P/FCF medio de unas 5 veces. Por qué tantas aseguradoras cumplen mis criterios y el mercado las paga tan poco.",
      "answer": "En junio de 2026, los seguros son el sector más representado en mi top de acciones con nota 10/10, con la caja pagada unas 5 veces de media. Estas compañías cumplen mis 10 criterios de calidad y, aun así, el mercado las paga poco. ¿Ganga ignorada o riesgo real? Separo la calidad del precio para responder.",
      "body": [
        {
          "type": "ul",
          "items": [
            "En junio de 2026, los seguros son el sector más presente entre mis acciones con nota 10/10 en calidad.",
            "El precio pagado es muy bajo: un P/FCF medio de unas 5 veces, es decir, cinco años de la caja generada.",
            "Por qué tantas aseguradoras cumplen mis criterios: un float rentable, disciplina de suscripción, primas al alza en ciclo duro.",
            "Por qué el mercado las paga poco: se las ve cíclicas, expuestas a catástrofes, con una contabilidad de reservas percibida como opaca.",
            "Mi regla, hilo de todo el artículo: juzgo la calidad del negocio y el precio de la acción por separado. La calidad está, el precio se merece."
          ]
        },
        {
          "type": "h2",
          "text": "El dato que me saltó a la vista"
        },
        {
          "type": "p",
          "text": "Cuando filtro mis acciones con nota 10 sobre 10 en calidad, un sector vuelve una y otra vez, mucho más que los demás: los seguros. Ni la tecnología, ni el lujo, ni la salud. Los seguros, ese negocio que todos encuentran aburrido, son hoy el más representado en lo alto de mi lista."
        },
        {
          "type": "p",
          "text": "Y lo más inquietante no es ni siquiera eso. Estas aseguradoras de élite cotizan de media a unas 5 veces su caja. Dicho de otro modo, el mercado las trata a la vez como empresas de muy alta calidad (por sus fundamentales) y como gangas de saldo (por su precio). Las dos cosas a la vez son raras, y merecen que nos detengamos."
        },
        {
          "type": "p",
          "text": "Antes de seguir, definamos las dos palabras que aparecerán por todas partes. Primero la nota sobre 10: paso cada empresa por el tamiz de 10 criterios de calidad fundamental (rentabilidad, crecimiento, solidez del balance, rentabilidad del capital). Una empresa que los cumple todos obtiene 10 sobre 10. Es raro, por construcción. Luego el P/FCF (price to free cash flow): el precio de la acción respecto al flujo de caja libre que genera cada año. El flujo de caja libre es el dinero que de verdad queda en caja una vez pagadas todas las facturas. Un P/FCF de 5 significa que pagas apenas cinco años de esa caja. El sentido primero: cuanto más bajo, más barato."
        },
        {
          "type": "h2",
          "text": "La lista, sin inventar nada en las cifras"
        },
        {
          "type": "p",
          "text": "Aquí están las aseguradoras que logran mi nota máxima, con lo que pagas por su caja. Lee la columna P/FCF como un número de años de flujo de caja libre: cuanto más bajo, más barata la acción respecto a lo que genera."
        },
        {
          "type": "ul",
          "items": [
            "RenaissanceRe (RNR): 3,0 veces. Pagas tres años de caja, un nivel que suele verse en una empresa en grave apuro.",
            "Universal Insurance (UVE): 2,9 veces. Aún más bajo, lo que dice mucho de la desconfianza del mercado.",
            "Mercury General (MCY): 4,0 veces.",
            "Selective Insurance (SIGI): 4,8 veces.",
            "Arch Capital (ACGL): 5,6 veces, aseguradora diversificada.",
            "W. R. Berkley (WRB): 7,0 veces, la aseguradora valor por excelencia.",
            "Kinsale Capital (KNSL): 7,1 veces, la especialista en riesgos atípicos.",
            "Cincinnati Financial (CINF): 7,4 veces, décadas de dividendos al alza.",
            "Progressive (PGR): 7,4 veces, la aseguradora de auto más eficiente de América."
          ]
        },
        {
          "type": "p",
          "text": "Todos estos nombres comparten dos cosas, y ese es todo el interés: una nota de calidad perfecta y un múltiplo de caja por debajo de la media del mercado. Buen negocio y buen precio, juntos. Para la mecánica fina de uno de estos casos, detallé Kinsale en mi [análisis completo de Kinsale Capital](/blog/kinsale-capital-assureur-10-10)."
        },
        {
          "type": "h2",
          "text": "Por qué tantas aseguradoras cumplen mis 10 criterios"
        },
        {
          "type": "p",
          "text": "Un sector entero copando la cima de mi clasificación no es casualidad. Tres resortes lo explican, y cada uno merece una palabra sencilla."
        },
        {
          "type": "p",
          "text": "El primero es el float. Una aseguradora cobra tus primas hoy y paga un posible siniestro solo meses, a veces años después. Entre medias, guarda ese montón y lo invierte. Ese dinero ajeno, cobrado antes de gastarse, trabaja gratis para ella. Cuando el float se gestiona bien, se convierte en una fuente de caja casi permanente, con muy poca necesidad de invertir en máquinas o fábricas. De ahí unos márgenes que a veces parecen los de una empresa de software."
        },
        {
          "type": "p",
          "text": "El segundo es la disciplina de suscripción. Suscribir es el acto de decidir qué riesgo se acepta y a qué precio. Las mejores aseguradoras dicen no mucho más a menudo de lo que dicen sí, y se niegan a perseguir volumen cuando los precios bajan demasiado. Esa contención, en un negocio donde la tentación de crecer rápido es constante, se traduce en una sola cifra: el combined ratio. Es la suma de siniestros y gastos respecto a las primas cobradas. Por debajo del 100 por ciento, la aseguradora gana dinero solo por asegurar, antes incluso de cobrar un céntimo de sus inversiones. Las compañías de mi lista operan estructuralmente por debajo de ese umbral."
        },
        {
          "type": "p",
          "text": "El tercero es el ciclo. Los seguros viven en ciclos: cuando los siniestros han costado caro, las aseguradoras débiles se retiran, la oferta escasea y los precios de las primas suben. Se llama ciclo duro. En 2026, varias líneas siguen en ciclo duro, lo que impulsa el crecimiento de las primas y la rentabilidad de las más disciplinadas. Este contexto amplifica temporalmente la calidad mostrada, y lo tengo presente: un ciclo se da la vuelta."
        },
        {
          "type": "h2",
          "text": "¿Y por qué el mercado las paga tan poco?"
        },
        {
          "type": "p",
          "text": "Esta es la verdadera pregunta. Si estas empresas son tan sólidas, ¿por qué pagar 3, 4, 5 veces su caja, donde una buena acción de crecimiento cotiza a 20 o 30 veces? El mercado no es tonto. Aplica un descuento por tres razones honestas, que hay que sopesar."
        },
        {
          "type": "p",
          "text": "Primero, los seguros se ven como cíclicos. Los resultados suben en ciclo duro, pero pueden caer cuando los precios de las primas se relajan. El mercado se niega a pagar caro unos beneficios que juzga pasajeros. Un P/FCF bajo, aquí, es en parte el mercado diciendo: no creo que este nivel de caja dure."
        },
        {
          "type": "p",
          "text": "Después, el riesgo de catástrofe. Un huracán, un terremoto, una serie de incendios, y un solo mal año puede borrar varios años de beneficio, sobre todo en reaseguradoras como RenaissanceRe o en aseguradoras muy expuestas a una región como Universal Insurance en Florida. Esta sensibilidad a las catástrofes hace los resultados menos previsibles, y el mercado detesta lo imprevisible."
        },
        {
          "type": "p",
          "text": "Por último, la contabilidad de las reservas se juzga opaca. Una aseguradora debe estimar hoy lo que pagará mañana por siniestros aún no liquidados: son las reservas. Esas estimaciones se basan en hipótesis que desde fuera no se pueden verificar fácilmente. Una aseguradora podría, en teoría, infrarreservar para inflar sus beneficios del momento. Esa zona gris empuja a muchos inversores a desconfiar y, por tanto, a pagar menos."
        },
        {
          "type": "h2",
          "text": "¿Punto ciego del mercado o riesgo real?"
        },
        {
          "type": "p",
          "text": "Mi respuesta es matizada, y pasa por mi regla de fondo: siempre separo dos preguntas que la mayoría confunde. Una: ¿es una buena empresa? Dos, completamente aparte: ¿es el precio correcto? Una empresa genial comprada demasiado cara sigue siendo una mala inversión, y un precio bajo puede ocultar un declive muy real."
        },
        {
          "type": "p",
          "text": "En calidad, la respuesta es clara: estas aseguradoras son negocios excelentes, y mi nota de 10 sobre 10 lo dice sin ambigüedad. El float, la disciplina, la conversión del beneficio en caja real están ahí, medidos, no supuestos."
        },
        {
          "type": "p",
          "text": "En precio, es más sutil. Parte del descuento es un punto ciego genuino: el mercado detesta lo cíclico y lo imprevisible hasta el punto de infravalorar la calidad duradera de algunas de estas casas. Pero otra parte es un riesgo real: un ciclo que se da la vuelta, una temporada de catástrofes brutal, reservas mal calibradas. Un P/FCF bajo nunca es una ganga en sí mismo. Solo lo es si la calidad aguanta con mal tiempo, no solo con buen tiempo."
        },
        {
          "type": "p",
          "text": "Por eso nunca trato esta lista como una cesta para comprar en bloque. Miro caso por caso: una reaseguradora expuesta a catástrofes no se juzga como una aseguradora de auto estable. La nota de calidad me dice dónde mirar. El precio me dice cuándo. Y el riesgo propio de cada compañía me dice cuánto creo en ella."
        },
        {
          "type": "h2",
          "text": "Qué hago con esto, en concreto"
        },
        {
          "type": "p",
          "text": "No te venderé certeza sobre el timing. Nadie sabe cuándo se da la vuelta un ciclo de seguros, ni cuándo el mercado dejará de infravalorar estos negocios. Lo que sí sé es que comprar calidad a buen precio ha envejecido bien históricamente, siempre que nunca confundas un descuento con un declive."
        },
        {
          "type": "p",
          "text": "En concreto, empiezo por la calidad, luego compruebo el precio, y luego sopeso el riesgo específico. Tú puedes recorrer el mismo camino: filtrar las empresas que califico con [10 sobre 10 en calidad](/classement/qualite-10-sur-10), cruzarlas con mi clasificación de [acciones infravaloradas](/classement/sous-evaluees), y entender cómo se construyen esos dos juicios en mi [metodología](/methodologie)."
        },
        {
          "type": "p",
          "text": "Es exactamente lo que quería poder hacer en unos segundos para cualquier acción: juzgar la calidad por un lado, el precio por otro, y detectar los raros casos en que ambos se alinean. Como no encontraba la herramienta, la construí. Lo barato se encuentra por todas partes. La calidad barata, y que aguanta en la tormenta, mucho más raramente."
        }
      ],
      "faq": [
        {
          "q": "¿Por qué los seguros dominan tu top de acciones 10/10?",
          "a": "Porque las mejores aseguradoras combinan tres fuerzas que mis criterios premian: un float rentable (el dinero de las primas cobrado por adelantado e invertido), una disciplina de suscripción que las hace rentables solo por asegurar, y primas al alza en ciclo duro. Estos tres resortes producen mucha caja con poca necesidad de invertir."
        },
        {
          "q": "¿Por qué el mercado paga tan poco por estas aseguradoras?",
          "a": "Por tres razones honestas. Se las ve cíclicas, así que el mercado duda de que sus beneficios actuales duren. Están expuestas a catástrofes, lo que hace los resultados imprevisibles. Y su contabilidad de reservas, esas sumas estimadas para siniestros futuros, se juzga opaca. Esa desconfianza baja el precio, de ahí el P/FCF."
        },
        {
          "q": "¿Un P/FCF de 5 veces es una ganga?",
          "a": "No por sí solo. Un P/FCF de 5 significa que pagas cinco años de la caja generada, lo cual es muy bajo. Pero un precio bajo puede ocultar un ciclo a punto de darse la vuelta o un riesgo de catástrofe mal medido. Solo es interesante si la calidad del negocio también aguanta con mal tiempo. De ahí mi regla: primero la calidad, después el precio."
        },
        {
          "q": "¿Qué son el float y el combined ratio, en claro?",
          "a": "El float es el dinero de las primas que una aseguradora cobra antes de pagar posibles siniestros: lo invierte mientras tanto, gratis. El combined ratio es la suma de siniestros y gastos respecto a las primas. Por debajo del 100 por ciento, la aseguradora gana dinero solo por asegurar, antes incluso de contar sus inversiones."
        },
        {
          "q": "¿Hay que comprar estas acciones de seguros ahora?",
          "a": "Depende de tu disciplina de precio y de tu lectura del riesgo propio de cada compañía, no de una previsión de mercado. Una nota de calidad 10/10 y un P/FCF bajo señalan un buen negocio a un precio razonable, pero no dicen si mañana será verde o rojo. Esto no es asesoramiento de inversión personalizado: haz tu propia investigación."
        }
      ],
      "tags": [
        "Seguros",
        "Calidad",
        "Valoración",
        "Análisis"
      ],
      "disclaimer": "Este artículo es un análisis con fines informativos y educativos, y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 11 de junio de 2026, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const kgc: Article = {
  "slug": "kinross-gold-kgc-10-10-or",
  "date": "2026-06-11",
  "updated": "2026-06-11",
  "readingTime": 9,
  "ticker": "KGC",
  "content": {
    "fr": {
      "title": "Kinross Gold (KGC) : la mine d'or notée 10 sur 10",
      "excerpt": "Une minière d'or qui coche tous mes critères de qualité, dopée par un or au plus haut. Mais une note parfaite n'est pas une thèse : voici le pari réel, et le risque que personne ne te dit.",
      "metaDescription": "Kinross Gold (KGC) note 10 sur 10, P/FCF 11,3 et trésorerie nette positive. Mais c'est un pari sur l'or, pas un compounder. Ma lecture honnête, qualité et prix.",
      "answer": "Kinross Gold coche tous mes critères de qualité financière : note 10 sur 10, marge de cash de 36 %, trésorerie nette positive, et un cash par action qui a plus que doublé sur un an avec la flambée de l'or. Mais une note parfaite n'est pas une thèse. Acheter Kinross, c'est d'abord parier sur le prix de l'or. Voici comment je sépare les deux.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Kinross Gold (KGC) obtient ma note de qualité maximale, 10 sur 10 : ses chiffres sont irréprochables aujourd'hui.",
            "Marge de free cash flow de 36 %, Cash ROCE de 27 %, et une trésorerie nette positive (plus de cash que de dette).",
            "Le cash par action a bondi de 116 % sur un an, porté par un or en pleine hausse : c'est un effet de levier, pas un miracle de gestion.",
            "Avec un P/FCF de 11,3, l'action n'est pas chère, mais le moteur de tout, c'est le prix de l'or, pas un avantage concurrentiel.",
            "Mon verdict : un 10 sur 10 sur les chiffres, oui, mais un pari macro sur l'or, pas un compounder à garder les yeux fermés."
          ]
        },
        {
          "type": "h2",
          "text": "Une note parfaite qui mérite une explication"
        },
        {
          "type": "p",
          "text": "Kinross Gold est un producteur d'or. L'entreprise exploite des mines au Canada, sur le continent américain et en Afrique de l'Ouest : elle sort le métal du sol, le raffine, le vend. Sur mon site, je lui attribue une note de qualité de 10 sur 10. Première chose à comprendre tout de suite : cette note juge la solidité financière du business, pas le prix de l'action. Une note de 10 sur 10 ne dit pas \"achète\", elle dit \"sur le papier, cette entreprise coche tous mes critères\"."
        },
        {
          "type": "p",
          "text": "Quand je regarde une action, je sépare toujours deux questions que la plupart des gens mélangent. Un : est-ce une bonne entreprise ? Deux, complètement à part : est-ce un bon prix ? Mélanger les deux est la première source d'erreur. Kinross est un cas d'école, parce que ses chiffres sont superbes pour une raison précise qu'il faut comprendre avant de se réjouir."
        },
        {
          "type": "h2",
          "text": "Est-ce une bonne entreprise ? (la qualité)"
        },
        {
          "type": "p",
          "text": "Je ne me fie pas à mon intuition. Je passe l'entreprise au crible de critères financiers concrets : est-elle rentable, son cash augmente-t-il, sa dette est-elle maîtrisée, transforme-t-elle vraiment ses profits comptables en argent réel ? Sur tous ces points, Kinross impressionne."
        },
        {
          "type": "p",
          "text": "Sa marge nette atteint 34 %. Sur 100 dollars de ventes, 34 finissent en bénéfice : pour une activité industrielle qui creuse des trous dans le sol, c'est énorme. Mais le chiffre qui me parle le plus, c'est la marge de free cash flow : 36 %. Le free cash flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées, salaires, machines, impôts, et surtout les lourds investissements miniers. Une marge de 36 % veut dire que sur 100 dollars de ventes, 36 finissent en cash réellement disponible. La plupart des entreprises plafonnent autour de 10."
        },
        {
          "type": "p",
          "text": "Deux autres signaux confirment la santé du bilan. D'abord le Cash ROCE de 27 % : c'est le rendement du capital en cash, autrement dit combien d'argent réel l'entreprise génère pour chaque dollar immobilisé dans ses mines et ses équipements. 27 %, c'est très élevé. Ensuite la dette : sa dette nette rapportée au free cash flow ressort à moins 0,4. Le chiffre est négatif, et c'est une bonne nouvelle : Kinross a plus de cash que de dette, une trésorerie nette positive. Pour un secteur qui s'endette souvent lourdement pour ouvrir des mines, c'est rassurant."
        },
        {
          "type": "p",
          "text": "Dernier point technique mais important : la conversion ressort à 1,07. Cela veut dire que pour chaque dollar de bénéfice comptable, l'entreprise encaisse en réalité un peu plus d'un dollar de cash. Le bénéfice comptable se maquille facilement, le cash beaucoup moins. Quand la conversion dépasse 1, c'est que les profits affichés sont du vrai argent, pas une illusion de tableur."
        },
        {
          "type": "h2",
          "text": "D'où vient vraiment cette explosion du cash ?"
        },
        {
          "type": "p",
          "text": "Voici le coeur de l'affaire, et la partie que beaucoup oublient de raconter. Le cash par action de Kinross a bondi de 116 % sur un an. Le chiffre d'affaires progresse de 27 % par an. Spectaculaire. Mais d'où ça vient ? Pas d'un produit révolutionnaire ni d'une part de marché conquise. De l'or, simplement, dont le prix monte."
        },
        {
          "type": "p",
          "text": "Un mineur d'or, c'est une machine à fort levier opérationnel. Ses coûts d'extraction sont en grande partie fixes : que l'once se vende 2 000 ou 3 000 dollars, sortir le métal coûte à peu près pareil. Donc chaque dollar de hausse du prix de l'or tombe presque entièrement dans la marge. Quand l'or grimpe, le cash des mineurs n'augmente pas, il explose. C'est exactement ce que disent ces 116 %."
        },
        {
          "type": "p",
          "text": "Et l'or est en phase de hausse pour des raisons de fond : il joue son rôle historique de valeur refuge quand l'incertitude monte, et les banques centrales en achètent massivement pour diversifier leurs réserves. Ce contexte gonfle le cash de Kinross. C'est réel, c'est encaissé, mais ce n'est pas du mérite managérial : c'est un vent porteur."
        },
        {
          "type": "h2",
          "text": "Le mot qui change tout : le moat"
        },
        {
          "type": "p",
          "text": "Quand j'analyse une entreprise, je cherche son moat : son fossé concurrentiel, ce qui empêche un rival de prendre sa place et de lui rogner ses marges. Une marque forte, un coût de changement élevé, un réseau, un brevet. C'est ce qui permet à une entreprise d'imposer ses prix et de durer."
        },
        {
          "type": "p",
          "text": "Kinross n'a quasiment pas de moat, et il faut le dire franchement. L'or est une commodité : une once de Kinross vaut exactement le même prix qu'une once d'un concurrent. Aucun client ne paiera plus cher l'or de Kinross parce que c'est Kinross. L'entreprise n'a aucun pouvoir sur son prix de vente, il est fixé par un marché mondial sur lequel elle n'a aucune influence. C'est la différence avec une Adobe, dont le moat lui permet d'imposer ses tarifs. Ici, le prix tombe du ciel."
        },
        {
          "type": "p",
          "text": "Ce que Kinross maîtrise, en revanche, c'est sa discipline : un bilan sain, une trésorerie nette positive, une bonne conversion du cash. Un mineur bien géré dans un secteur sans moat, c'est mieux qu'un mineur mal géré. Mais ça ne crée pas un avantage durable. Ça limite les dégâts quand le vent tourne."
        },
        {
          "type": "h2",
          "text": "Est-ce un bon prix ? (la valorisation)"
        },
        {
          "type": "p",
          "text": "Pour mesurer ce que le marché accepte de payer, je regarde un ratio simple : le P/FCF (price to free cash flow), le prix de l'action divisé par le free cash flow qu'elle génère chaque année. Un P/FCF de 11, ça veut dire que tu paies aujourd'hui environ onze années de ce cash. Plus c'est bas, moins c'est cher. Kinross se paie 11,3 fois son free cash flow, l'action vaut environ 23,66 dollars."
        },
        {
          "type": "p",
          "text": "Pour situer ce 11,3, je regarde son percentile : 23. Concrètement, parmi toutes les actions que je suis, Kinross est moins chère que 77 % d'entre elles sur ce critère. C'est donc plutôt bon marché. Sur le papier, qualité parfaite ET prix raisonnable : le combo que je recherche, comme dans mon classement des actions sous-évaluées que tu peux consulter ici : [actions sous-évaluées](/classement/sous-evaluees)."
        },
        {
          "type": "p",
          "text": "Sauf qu'il y a un piège dans ce 11,3. Ce free cash flow record est calculé sur un cash gonflé par un or au plus haut. Si l'or se replie, le cash chute, et le même prix d'action correspondra soudain à un P/FCF beaucoup plus élevé. Autrement dit, l'action peut sembler bon marché aujourd'hui précisément parce que le cash est temporairement énorme. Sur un producteur de commodité, un multiple bas en haut de cycle est un classique, pas une aubaine garantie."
        },
        {
          "type": "h2",
          "text": "Les risques, sans rien te cacher"
        },
        {
          "type": "p",
          "text": "Le risque principal tient en une phrase : Kinross dépend totalement du prix de l'or. C'est son unique moteur. Si l'or monte, le cash explose. Si l'or baisse, le cash chute aussi vite, par le même effet de levier qui jouait à la hausse. Tu n'achètes pas vraiment une entreprise, tu achètes une exposition à l'or avec une dose de gestion par-dessus."
        },
        {
          "type": "p",
          "text": "Deuxième risque : la géographie. Une partie des mines se trouve en Afrique de l'Ouest, une région où le risque géopolitique est réel, fiscalité qui change, instabilité, voire remise en cause de licences d'exploitation. Une mine ne se déménage pas. Troisième risque, plus terre à terre : les coûts d'extraction. Ils peuvent grimper, énergie, main-d'oeuvre, qualité du minerai qui baisse à mesure qu'on creuse, et grignoter la belle marge actuelle."
        },
        {
          "type": "h2",
          "text": "Le trade-off honnête, et comment je tranche"
        },
        {
          "type": "p",
          "text": "Voici le coeur de ma lecture. Sur les chiffres, Kinross mérite son 10 sur 10 : c'est une minière saine, rentable, peu endettée, qui convertit bien. Je ne vais pas faire semblant du contraire. Mais une note de qualité juge le passé et le présent, pas l'avenir d'un pari macro."
        },
        {
          "type": "p",
          "text": "Acheter Kinross aujourd'hui, ce n'est pas acheter un compounder, une de ces entreprises qui composent leur valeur année après année grâce à un avantage durable. C'est faire un pari : crois-tu que l'or va rester haut ou monter encore ? Si oui, l'effet de levier joue pour toi et l'action est attractive. Si tu penses que l'or est en haut de cycle, alors ce 10 sur 10 et ce P/FCF bas sont un mirage de fin de fête."
        },
        {
          "type": "p",
          "text": "Ma règle ne change pas : je juge la qualité et le prix séparément, mais sur un mineur j'ajoute une troisième question, à quel point la thèse dépend d'une variable que je ne contrôle pas ? Ici, presque entièrement. Ce n'est ni un défaut ni une qualité, c'est une nature. Il faut juste l'acheter en sachant qu'on achète de l'or, pas un fossé concurrentiel."
        },
        {
          "type": "h2",
          "text": "Ce que je fais, concrètement"
        },
        {
          "type": "p",
          "text": "Je traite Kinross pour ce qu'elle est : une façon de qualité de s'exposer à l'or, pour qui veut ce pari. Pas le coeur d'un portefeuille que je veux oublier dix ans, plutôt une position assumée sur un thème macro, dimensionnée en conséquence. Et je ne me raconte pas d'histoire sur la note : 10 sur 10 décrit un bilan, pas une certitude sur le cours de l'once dans deux ans."
        },
        {
          "type": "p",
          "text": "Savoir si une entreprise est solide, et à quel prix l'acheter, séparément, en quelques secondes pour n'importe quelle action : c'est exactement ce que je voulais pouvoir faire. Comme l'outil n'existait pas, je l'ai construit. Tu peux y ouvrir la fiche complète de Kinross ici : [analyse Kinross Gold](/analyse/KGC), comprendre comment je calcule mes notes via ma [méthodologie](/methodologie), ou parcourir les entreprises que je note 10 sur 10 sur la qualité : [qualité 10 sur 10](/classement/qualite-10-sur-10). Le reste, c'est ton pari et ta discipline."
        }
      ],
      "faq": [
        {
          "q": "Pourquoi Kinross Gold est-elle notée 10 sur 10 ?",
          "a": "Parce que ses fondamentaux financiers cochent tous mes critères : marge de free cash flow de 36 %, Cash ROCE de 27 %, trésorerie nette positive et une bonne conversion du bénéfice en cash. Mais cette note juge la solidité du business aujourd'hui, pas le prix de l'action ni l'avenir du prix de l'or."
        },
        {
          "q": "Le cash de Kinross a bondi de 116 %, est-ce durable ?",
          "a": "Ce n'est pas garanti, car cette hausse vient surtout du prix de l'or, pas d'un mérite de gestion. Un mineur a un fort levier opérationnel : ses coûts sont fixes, donc chaque hausse de l'or gonfle énormément le cash. Si l'or baisse, le cash chute aussi vite par le même mécanisme."
        },
        {
          "q": "Un P/FCF de 11,3 fait-il de Kinross une bonne affaire ?",
          "a": "Pas automatiquement. Un P/FCF de 11,3 veut dire que tu paies environ onze années du cash annuel, ce qui est plutôt bon marché. Mais ce cash est gonflé par un or au plus haut. Si l'or se replie, le cash baisse et le multiple grimpe. Un multiple bas en haut de cycle n'est pas une aubaine garantie."
        },
        {
          "q": "Kinross Gold a-t-elle un moat ?",
          "a": "Très peu. L'or est une commodité : une once vaut le même prix partout, donc Kinross n'a aucun pouvoir sur son prix de vente, fixé par le marché mondial. Sa seule force est une bonne gestion et un bilan sain, ce qui limite les dégâts mais ne crée pas d'avantage concurrentiel durable."
        },
        {
          "q": "Faut-il acheter l'action Kinross Gold ?",
          "a": "Ça dépend surtout de ta conviction sur l'or. Les chiffres sont excellents, mais acheter Kinross revient à parier sur un or qui reste haut ou monte. Ajoute le risque géopolitique en Afrique de l'Ouest et les coûts d'extraction. Ceci n'est pas un conseil en investissement personnalisé, fais tes propres recherches."
        }
      ],
      "tags": [
        "Analyse",
        "Or",
        "Matières premières",
        "Valorisation"
      ],
      "disclaimer": "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 11 juin 2026, susceptibles d'évoluer. Fais tes propres recherches."
    },
    "en": {
      "title": "Kinross Gold (KGC) : the gold miner rated 10 of 10",
      "excerpt": "A gold miner that ticks every quality box, boosted by gold at record highs. But a perfect score is not a thesis: here is the real bet, and the risk nobody mentions.",
      "metaDescription": "Kinross Gold (KGC) scores 10 of 10, with a 11.3 P/FCF and net cash. But it is a bet on gold, not a compounder. My honest read, quality and price kept separate.",
      "answer": "Kinross Gold ticks every one of my financial quality criteria: a 10 of 10 score, a 36% cash margin, net cash on the balance sheet, and cash per share that more than doubled in a year as gold surged. But a perfect score is not a thesis. Buying Kinross is, first of all, a bet on the price of gold. Here is how I keep the two apart.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Kinross Gold (KGC) earns my top quality score, 10 of 10: its numbers are flawless right now.",
            "A 36% free cash flow margin, a 27% Cash ROCE, and net cash (more cash than debt) on the balance sheet.",
            "Cash per share jumped 116% in a year, driven by rising gold: that is operating leverage, not a management miracle.",
            "At a P/FCF of 11.3 the stock is not expensive, but the engine of everything is the gold price, not a competitive edge.",
            "My verdict: a 10 of 10 on the numbers, yes, but a macro bet on gold, not a compounder you can hold blindfolded."
          ]
        },
        {
          "type": "h2",
          "text": "A perfect score that needs explaining"
        },
        {
          "type": "p",
          "text": "Kinross Gold is a gold producer. The company runs mines in Canada, across the Americas and in West Africa: it pulls the metal out of the ground, refines it, sells it. On my site, I give it a quality score of 10 of 10. First thing to grasp right away: this score judges the financial soundness of the business, not the price of the stock. A 10 of 10 does not say \"buy\", it says \"on paper, this company ticks every one of my criteria\"."
        },
        {
          "type": "p",
          "text": "When I look at a stock, I always separate two questions most people mix up. One: is this a good company? Two, entirely apart: is this a good price? Mixing the two is the number one source of error. Kinross is a textbook case, because its numbers are superb for a precise reason you need to understand before getting excited."
        },
        {
          "type": "h2",
          "text": "Is it a good company? (quality)"
        },
        {
          "type": "p",
          "text": "I do not trust my gut. I run the company through concrete financial criteria: is it profitable, is its cash growing, is its debt manageable, does it really turn accounting profit into real money? On all these points, Kinross impresses."
        },
        {
          "type": "p",
          "text": "Its net margin reaches 34%. On 100 dollars of sales, 34 end up as profit: for an industrial activity that digs holes in the ground, that is huge. But the number that speaks to me most is the free cash flow margin: 36%. Free cash flow is the money that truly stays in the bank once every bill is paid, salaries, machines, taxes, and above all the heavy mining investments. A 36% margin means that on 100 dollars of sales, 36 end up as genuinely available cash. Most companies top out around 10."
        },
        {
          "type": "p",
          "text": "Two other signals confirm the balance sheet's health. First the Cash ROCE of 27%: it is the return on capital in cash, in other words how much real money the company generates for every dollar tied up in its mines and equipment. 27% is very high. Then the debt: its net debt relative to free cash flow comes out at minus 0.4. The figure is negative, and that is good news: Kinross has more cash than debt, a net cash position. For a sector that often borrows heavily to open mines, that is reassuring."
        },
        {
          "type": "p",
          "text": "One last technical but important point: cash conversion comes out at 1.07. That means for every dollar of accounting profit, the company actually collects a bit more than a dollar of cash. Accounting profit is easy to dress up, cash much less so. When conversion exceeds 1, the reported profits are real money, not a spreadsheet illusion."
        },
        {
          "type": "h2",
          "text": "Where does this cash explosion really come from?"
        },
        {
          "type": "p",
          "text": "Here is the heart of the matter, and the part many forget to tell. Kinross cash per share jumped 116% in a year. Revenue grows 27% a year. Spectacular. But where does it come from? Not from a revolutionary product or a market share won. From gold, plainly, whose price is climbing."
        },
        {
          "type": "p",
          "text": "A gold miner is a high operating leverage machine. Its extraction costs are largely fixed: whether an ounce sells for 2,000 or 3,000 dollars, getting the metal out costs roughly the same. So every dollar of rise in the gold price drops almost entirely into the margin. When gold climbs, a miner's cash does not just rise, it explodes. That is exactly what those 116% are saying."
        },
        {
          "type": "p",
          "text": "And gold is in an upswing for structural reasons: it plays its historic role as a safe haven when uncertainty rises, and central banks are buying it heavily to diversify their reserves. That backdrop inflates Kinross cash. It is real, it is collected, but it is not managerial merit: it is a tailwind."
        },
        {
          "type": "h2",
          "text": "The word that changes everything: the moat"
        },
        {
          "type": "p",
          "text": "When I analyze a company, I look for its moat: its competitive ditch, what stops a rival from taking its place and eating its margins. A strong brand, a high switching cost, a network, a patent. That is what lets a company set its prices and last."
        },
        {
          "type": "p",
          "text": "Kinross has almost no moat, and that has to be said plainly. Gold is a commodity: an ounce from Kinross is worth exactly the same as an ounce from a rival. No customer will pay more for Kinross gold because it is Kinross. The company has no power over its selling price, it is set by a world market over which it has no influence. That is the difference with an Adobe, whose moat lets it set its own prices. Here, the price falls from the sky."
        },
        {
          "type": "p",
          "text": "What Kinross does control is its discipline: a sound balance sheet, a net cash position, good cash conversion. A well-run miner in a sector with no moat beats a badly run one. But it does not create a durable advantage. It limits the damage when the wind turns."
        },
        {
          "type": "h2",
          "text": "Is it a good price? (valuation)"
        },
        {
          "type": "p",
          "text": "To measure what the market is willing to pay, I look at one simple ratio: the P/FCF (price to free cash flow), the share price divided by the free cash flow it generates each year. A P/FCF of 11 means you are paying about eleven years of that cash today. The lower it is, the cheaper it is. Kinross trades at 11.3 times its free cash flow, and the stock is worth about 23.66 dollars."
        },
        {
          "type": "p",
          "text": "To place that 11.3, I look at its percentile: 23. In plain terms, among all the stocks I follow, Kinross is cheaper than 77% of them on this criterion. So it is rather inexpensive. On paper, perfect quality AND a reasonable price: the combo I look for, like in my ranking of undervalued stocks you can browse here: [undervalued stocks](/classement/sous-evaluees)."
        },
        {
          "type": "p",
          "text": "Except there is a trap in that 11.3. This record free cash flow is computed on cash inflated by gold at record highs. If gold pulls back, the cash drops, and the same share price will suddenly map to a much higher P/FCF. In other words, the stock can look cheap today precisely because the cash is temporarily huge. On a commodity producer, a low multiple at the top of the cycle is a classic, not a guaranteed bargain."
        },
        {
          "type": "h2",
          "text": "The risks, with nothing hidden"
        },
        {
          "type": "p",
          "text": "The main risk fits in one sentence: Kinross depends entirely on the gold price. That is its only engine. If gold rises, the cash explodes. If gold falls, the cash drops just as fast, through the same leverage that worked on the way up. You are not really buying a company, you are buying exposure to gold with a dose of management on top."
        },
        {
          "type": "p",
          "text": "Second risk: geography. Part of the mines sit in West Africa, a region where geopolitical risk is real, taxes that change, instability, even mining licenses being called into question. A mine cannot be moved. Third risk, more down to earth: extraction costs. They can climb, energy, labor, ore quality falling as you dig deeper, and eat into the fine margin we see today."
        },
        {
          "type": "h2",
          "text": "The honest trade-off, and how I decide"
        },
        {
          "type": "p",
          "text": "Here is the core of my read. On the numbers, Kinross deserves its 10 of 10: it is a sound, profitable, low-debt miner that converts cash well. I will not pretend otherwise. But a quality score judges the past and present, not the future of a macro bet."
        },
        {
          "type": "p",
          "text": "Buying Kinross today is not buying a compounder, one of those companies that compound their value year after year thanks to a durable advantage. It is making a bet: do you believe gold will stay high or climb further? If yes, the leverage works for you and the stock is attractive. If you think gold is at the top of the cycle, then this 10 of 10 and this low P/FCF are an end-of-party mirage."
        },
        {
          "type": "p",
          "text": "My rule does not change: I judge quality and price separately, but on a miner I add a third question, how much does the thesis hinge on a variable I do not control? Here, almost entirely. That is neither a flaw nor a virtue, it is a nature. You just have to buy it knowing you are buying gold, not a competitive ditch."
        },
        {
          "type": "h2",
          "text": "What I actually do"
        },
        {
          "type": "p",
          "text": "I treat Kinross for what it is: a quality way to get exposure to gold, for anyone who wants that bet. Not the core of a portfolio I want to forget for ten years, rather a deliberate position on a macro theme, sized accordingly. And I do not kid myself about the score: 10 of 10 describes a balance sheet, not a certainty about the price of an ounce two years from now."
        },
        {
          "type": "p",
          "text": "Knowing whether a company is sound, and at what price to buy it, separately, in a few seconds for any stock: that is exactly what I wanted to be able to do. Since the tool did not exist, I built it. You can open Kinross's full profile here: [Kinross Gold analysis](/analyse/KGC), understand how I compute my scores via my [methodology](/methodologie), or browse the companies I rate 10 of 10 on quality: [quality 10 of 10](/classement/qualite-10-sur-10). The rest is your bet and your discipline."
        }
      ],
      "faq": [
        {
          "q": "Why is Kinross Gold rated 10 of 10?",
          "a": "Because its financial fundamentals tick all my criteria: a 36% free cash flow margin, a 27% Cash ROCE, a net cash position and good conversion of profit into cash. But this score judges the soundness of the business today, not the stock price nor the future of the gold price."
        },
        {
          "q": "Kinross cash jumped 116%, is that sustainable?",
          "a": "It is not guaranteed, because that rise comes mainly from the gold price, not from management merit. A miner has high operating leverage: its costs are fixed, so every rise in gold inflates the cash enormously. If gold falls, the cash drops just as fast through the same mechanism."
        },
        {
          "q": "Does a P/FCF of 11.3 make Kinross a bargain?",
          "a": "Not automatically. A P/FCF of 11.3 means you pay about eleven years of the annual cash, which is rather cheap. But that cash is inflated by gold at record highs. If gold pulls back, the cash falls and the multiple climbs. A low multiple at the top of the cycle is not a guaranteed bargain."
        },
        {
          "q": "Does Kinross Gold have a moat?",
          "a": "Very little. Gold is a commodity: an ounce is worth the same everywhere, so Kinross has no power over its selling price, set by the world market. Its only strength is good management and a sound balance sheet, which limits the damage but does not create a durable competitive advantage."
        },
        {
          "q": "Should you buy Kinross Gold stock?",
          "a": "It mainly depends on your conviction about gold. The numbers are excellent, but buying Kinross amounts to betting that gold stays high or climbs. Add the geopolitical risk in West Africa and extraction costs. This is not personalized investment advice, do your own research."
        }
      ],
      "tags": [
        "Analysis",
        "Gold",
        "Commodities",
        "Valuation"
      ],
      "disclaimer": "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 11, 2026, subject to change. Do your own research."
    },
    "es": {
      "title": "Kinross Gold (KGC) : la minera de oro con un 10 de 10",
      "excerpt": "Una minera de oro que cumple todos mis criterios de calidad, impulsada por un oro en máximos. Pero una nota perfecta no es una tesis: aquí está la apuesta real y el riesgo que nadie te cuenta.",
      "metaDescription": "Kinross Gold (KGC) saca un 10 de 10, con un P/FCF de 11,3 y caja neta. Pero es una apuesta por el oro, no un compounder. Mi lectura honesta, calidad y precio.",
      "answer": "Kinross Gold cumple todos mis criterios de calidad financiera: nota de 10 de 10, margen de caja del 36 %, caja neta positiva y una caja por acción que más que se duplicó en un año con la subida del oro. Pero una nota perfecta no es una tesis. Comprar Kinross es, ante todo, apostar por el precio del oro. Así separo las dos cosas.",
      "body": [
        {
          "type": "ul",
          "items": [
            "Kinross Gold (KGC) obtiene mi nota de calidad máxima, 10 de 10: hoy sus cifras son impecables.",
            "Margen de flujo de caja libre del 36 %, Cash ROCE del 27 % y caja neta positiva (más caja que deuda).",
            "La caja por acción saltó un 116 % en un año, impulsada por un oro al alza: es apalancamiento operativo, no un milagro de gestión.",
            "Con un P/FCF de 11,3 la acción no es cara, pero el motor de todo es el precio del oro, no una ventaja competitiva.",
            "Mi veredicto: un 10 de 10 en las cifras, sí, pero una apuesta macro por el oro, no un compounder para tener a ciegas."
          ]
        },
        {
          "type": "h2",
          "text": "Una nota perfecta que merece una explicación"
        },
        {
          "type": "p",
          "text": "Kinross Gold es un productor de oro. La empresa explota minas en Canadá, en el continente americano y en África Occidental: saca el metal del suelo, lo refina, lo vende. En mi sitio le doy una nota de calidad de 10 de 10. Lo primero que hay que entender de inmediato: esta nota juzga la solidez financiera del negocio, no el precio de la acción. Un 10 de 10 no dice \"compra\", dice \"sobre el papel, esta empresa cumple todos mis criterios\"."
        },
        {
          "type": "p",
          "text": "Cuando miro una acción, siempre separo dos preguntas que la mayoría mezcla. Una: ¿es una buena empresa? Dos, completamente aparte: ¿es un buen precio? Mezclar ambas es la fuente de error número uno. Kinross es un caso de manual, porque sus cifras son magníficas por una razón concreta que hay que entender antes de alegrarse."
        },
        {
          "type": "h2",
          "text": "¿Es una buena empresa? (la calidad)"
        },
        {
          "type": "p",
          "text": "No me fío de mi intuición. Paso la empresa por un tamiz de criterios financieros concretos: ¿es rentable, crece su caja, es manejable su deuda, convierte de verdad su beneficio contable en dinero real? En todos estos puntos, Kinross impresiona."
        },
        {
          "type": "p",
          "text": "Su margen neto llega al 34 %. De cada 100 dólares de ventas, 34 acaban en beneficio: para una actividad industrial que cava agujeros en el suelo, es enorme. Pero la cifra que más me dice es el margen de flujo de caja libre: 36 %. El flujo de caja libre es el dinero que de verdad queda en las arcas una vez pagadas todas las facturas, sueldos, máquinas, impuestos y, sobre todo, las pesadas inversiones mineras. Un margen del 36 % significa que de cada 100 dólares de ventas, 36 acaban en caja realmente disponible. La mayoría de las empresas no pasan del 10."
        },
        {
          "type": "p",
          "text": "Otras dos señales confirman la salud del balance. Primero el Cash ROCE del 27 %: es la rentabilidad del capital en caja, es decir cuánto dinero real genera la empresa por cada dólar inmovilizado en sus minas y equipos. Un 27 % es muy alto. Luego la deuda: su deuda neta respecto al flujo de caja libre sale en menos 0,4. La cifra es negativa, y es buena noticia: Kinross tiene más caja que deuda, una posición de caja neta. Para un sector que suele endeudarse mucho para abrir minas, es tranquilizador."
        },
        {
          "type": "p",
          "text": "Un último punto técnico pero importante: la conversión sale en 1,07. Significa que por cada dólar de beneficio contable, la empresa cobra en realidad algo más de un dólar de caja. El beneficio contable se maquilla con facilidad, la caja mucho menos. Cuando la conversión supera 1, los beneficios declarados son dinero de verdad, no una ilusión de hoja de cálculo."
        },
        {
          "type": "h2",
          "text": "¿De dónde viene de verdad esta explosión de caja?"
        },
        {
          "type": "p",
          "text": "Aquí está el meollo del asunto, y la parte que muchos olvidan contar. La caja por acción de Kinross saltó un 116 % en un año. Los ingresos crecen un 27 % anual. Espectacular. ¿Pero de dónde viene? No de un producto revolucionario ni de cuota de mercado conquistada. Del oro, sin más, cuyo precio sube."
        },
        {
          "type": "p",
          "text": "Un minero de oro es una máquina de fuerte apalancamiento operativo. Sus costes de extracción son en gran parte fijos: que la onza se venda a 2.000 o a 3.000 dólares, sacar el metal cuesta más o menos lo mismo. Así que cada dólar de subida del precio del oro cae casi entero en el margen. Cuando el oro sube, la caja de los mineros no aumenta, explota. Eso es exactamente lo que dicen ese 116 %."
        },
        {
          "type": "p",
          "text": "Y el oro está en fase de subida por razones de fondo: cumple su papel histórico de valor refugio cuando crece la incertidumbre, y los bancos centrales lo compran de forma masiva para diversificar sus reservas. Ese contexto infla la caja de Kinross. Es real, está cobrado, pero no es mérito de gestión: es un viento a favor."
        },
        {
          "type": "h2",
          "text": "La palabra que lo cambia todo: el foso"
        },
        {
          "type": "p",
          "text": "Cuando analizo una empresa, busco su foso (moat): su trinchera competitiva, lo que impide a un rival ocupar su lugar y recortarle los márgenes. Una marca fuerte, un coste de cambio alto, una red, una patente. Es lo que permite a una empresa imponer sus precios y perdurar."
        },
        {
          "type": "p",
          "text": "Kinross casi no tiene foso, y hay que decirlo con franqueza. El oro es una materia prima: una onza de Kinross vale exactamente lo mismo que una onza de un competidor. Ningún cliente pagará más por el oro de Kinross porque sea Kinross. La empresa no tiene poder alguno sobre su precio de venta, lo fija un mercado mundial sobre el que no tiene ninguna influencia. Esa es la diferencia con una Adobe, cuyo foso le permite imponer sus tarifas. Aquí, el precio cae del cielo."
        },
        {
          "type": "p",
          "text": "Lo que Kinross sí controla es su disciplina: un balance sano, una posición de caja neta, una buena conversión de la caja. Un minero bien gestionado en un sector sin foso es mejor que uno mal gestionado. Pero no crea una ventaja duradera. Limita los daños cuando el viento cambia."
        },
        {
          "type": "h2",
          "text": "¿Es un buen precio? (la valoración)"
        },
        {
          "type": "p",
          "text": "Para medir lo que el mercado acepta pagar, miro un ratio sencillo: el P/FCF (price to free cash flow), el precio de la acción dividido entre el flujo de caja libre que genera cada año. Un P/FCF de 11 significa que pagas hoy unos once años de esa caja. Cuanto más bajo, más barato. Kinross cotiza a 11,3 veces su flujo de caja libre, y la acción vale unos 23,66 dólares."
        },
        {
          "type": "p",
          "text": "Para situar ese 11,3 miro su percentil: 23. En términos claros, entre todas las acciones que sigo, Kinross es más barata que el 77 % de ellas en este criterio. Así que es más bien barata. Sobre el papel, calidad perfecta Y precio razonable: el combo que busco, como en mi clasificación de acciones infravaloradas que puedes consultar aquí: [acciones infravaloradas](/classement/sous-evaluees)."
        },
        {
          "type": "p",
          "text": "Salvo que hay una trampa en ese 11,3. Este flujo de caja libre récord se calcula sobre una caja inflada por un oro en máximos. Si el oro retrocede, la caja cae, y el mismo precio de la acción corresponderá de pronto a un P/FCF mucho más alto. Dicho de otro modo, la acción puede parecer barata hoy precisamente porque la caja es temporalmente enorme. En un productor de materia prima, un múltiplo bajo en la cima del ciclo es un clásico, no una ganga garantizada."
        },
        {
          "type": "h2",
          "text": "Los riesgos, sin ocultarte nada"
        },
        {
          "type": "p",
          "text": "El riesgo principal cabe en una frase: Kinross depende por completo del precio del oro. Es su único motor. Si el oro sube, la caja explota. Si el oro baja, la caja cae igual de rápido, por el mismo apalancamiento que jugaba al alza. No compras realmente una empresa, compras una exposición al oro con una dosis de gestión encima."
        },
        {
          "type": "p",
          "text": "Segundo riesgo: la geografía. Parte de las minas está en África Occidental, una región donde el riesgo geopolítico es real, fiscalidad que cambia, inestabilidad, incluso licencias de explotación cuestionadas. Una mina no se muda. Tercer riesgo, más terrenal: los costes de extracción. Pueden subir, energía, mano de obra, calidad del mineral que baja a medida que se cava más hondo, y comerse el buen margen actual."
        },
        {
          "type": "h2",
          "text": "El equilibrio honesto, y cómo decido"
        },
        {
          "type": "p",
          "text": "Aquí está el núcleo de mi lectura. En las cifras, Kinross merece su 10 de 10: es una minera sana, rentable, con poca deuda, que convierte bien la caja. No voy a fingir lo contrario. Pero una nota de calidad juzga el pasado y el presente, no el futuro de una apuesta macro."
        },
        {
          "type": "p",
          "text": "Comprar Kinross hoy no es comprar un compounder, una de esas empresas que componen su valor año tras año gracias a una ventaja duradera. Es hacer una apuesta: ¿crees que el oro va a seguir alto o subir más? Si sí, el apalancamiento juega a tu favor y la acción es atractiva. Si piensas que el oro está en la cima del ciclo, entonces ese 10 de 10 y ese P/FCF bajo son un espejismo de fin de fiesta."
        },
        {
          "type": "p",
          "text": "Mi regla no cambia: juzgo la calidad y el precio por separado, pero en un minero añado una tercera pregunta, ¿hasta qué punto la tesis depende de una variable que no controlo? Aquí, casi por completo. No es ni un defecto ni una virtud, es una naturaleza. Solo hay que comprarla sabiendo que compras oro, no una trinchera competitiva."
        },
        {
          "type": "h2",
          "text": "Lo que hago, en concreto"
        },
        {
          "type": "p",
          "text": "Trato a Kinross por lo que es: una forma de calidad de exponerse al oro, para quien quiera esa apuesta. No el núcleo de una cartera que quiero olvidar diez años, más bien una posición asumida sobre un tema macro, dimensionada en consecuencia. Y no me engaño con la nota: 10 de 10 describe un balance, no una certeza sobre el precio de la onza dentro de dos años."
        },
        {
          "type": "p",
          "text": "Saber si una empresa es sólida, y a qué precio comprarla, por separado, en unos segundos para cualquier acción: es exactamente lo que quería poder hacer. Como la herramienta no existía, la construí. Puedes abrir la ficha completa de Kinross aquí: [análisis Kinross Gold](/analyse/KGC), entender cómo calculo mis notas con mi [metodología](/methodologie), o recorrer las empresas que califico con 10 de 10 en calidad: [calidad 10 de 10](/classement/qualite-10-sur-10). El resto es tu apuesta y tu disciplina."
        }
      ],
      "faq": [
        {
          "q": "¿Por qué Kinross Gold tiene un 10 de 10?",
          "a": "Porque sus fundamentales financieros cumplen todos mis criterios: margen de flujo de caja libre del 36 %, Cash ROCE del 27 %, una posición de caja neta y buena conversión del beneficio en caja. Pero esta nota juzga la solidez del negocio hoy, no el precio de la acción ni el futuro del precio del oro."
        },
        {
          "q": "La caja de Kinross saltó un 116 %, ¿es sostenible?",
          "a": "No está garantizado, porque esa subida viene sobre todo del precio del oro, no del mérito de gestión. Un minero tiene fuerte apalancamiento operativo: sus costes son fijos, así que cada subida del oro infla enormemente la caja. Si el oro baja, la caja cae igual de rápido por el mismo mecanismo."
        },
        {
          "q": "¿Un P/FCF de 11,3 hace de Kinross una ganga?",
          "a": "No automáticamente. Un P/FCF de 11,3 significa que pagas unos once años de la caja anual, lo que es más bien barato. Pero esa caja está inflada por un oro en máximos. Si el oro retrocede, la caja baja y el múltiplo sube. Un múltiplo bajo en la cima del ciclo no es una ganga garantizada."
        },
        {
          "q": "¿Tiene Kinross Gold un foso?",
          "a": "Muy poco. El oro es una materia prima: una onza vale lo mismo en todas partes, así que Kinross no tiene poder sobre su precio de venta, fijado por el mercado mundial. Su única fuerza es una buena gestión y un balance sano, lo que limita los daños pero no crea una ventaja competitiva duradera."
        },
        {
          "q": "¿Hay que comprar acciones de Kinross Gold?",
          "a": "Depende sobre todo de tu convicción sobre el oro. Las cifras son excelentes, pero comprar Kinross equivale a apostar a que el oro se mantiene alto o sube. Suma el riesgo geopolítico en África Occidental y los costes de extracción. Esto no es asesoramiento de inversión personalizado, haz tu propia investigación."
        }
      ],
      "tags": [
        "Análisis",
        "Oro",
        "Materias primas",
        "Valoración"
      ],
      "disclaimer": "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 11 de junio de 2026, sujetas a cambios. Haz tu propia investigación."
    }
  }
};

const adobeResults: Article = {
  slug: 'adobe-resultats-q2-2026-action-chute',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 8,
  ticker: 'ADBE',
  content: {
    fr: {
      title: "Adobe (ADBE) : résultats records, l'action chute",
      excerpt:
        "Adobe publie un trimestre record et relève ses prévisions, et pourtant l'action recule. Départ du directeur financier, peur de l'IA : ma lecture par les fondamentaux.",
      metaDescription:
        "Adobe (ADBE) bat les attentes au T2 2026 mais l'action chute. Départ du CFO, peur de l'IA, valorisation au plus bas : mon analyse qualité contre prix.",
      answer:
        "Adobe a publié un trimestre record et relevé ses prévisions, et pourtant l'action a chuté d'environ 6 %. Le marché a sanctionné le départ surprise du directeur financier et sa peur que l'IA érode le modèle. Résultat : une entreprise d'élite se paie son cash moins cher que jamais. Voici comment je sépare la qualité du prix.",
      body: [
        {
          type: 'ul',
          items: [
            "Trimestre record : 6,62 milliards de dollars de chiffre d'affaires, en hausse de 13 % sur un an, et un bénéfice par action ajusté de 5,96 dollars, au-dessus des attentes.",
            "L'action a quand même reculé d'environ 6 %, surtout à cause du départ surprise du directeur financier et de la crainte que l'IA abîme le modèle d'Adobe.",
            "Les revenus récurrents liés à l'IA dépassent désormais 500 millions de dollars : pour l'instant, l'IA nourrit Adobe plus qu'elle ne la détruit.",
            "Adobe se paie environ 10 fois son free cash-flow, contre une moyenne de 33 sur dix ans : le marché la traite comme une entreprise en déclin.",
            "Une bonne entreprise n'est pas la même chose qu'un bon prix : je juge la qualité d'abord, la valorisation ensuite.",
          ],
        },
        { type: 'h2', text: "Ce qui s'est passé hier soir" },
        {
          type: 'p',
          text: "Adobe a dévoilé les résultats de son deuxième trimestre fiscal 2026 le 11 juin au soir. Le chiffre d'affaires atteint 6,62 milliards de dollars, en hausse de 13 % sur un an. C'est un record. Le bénéfice par action ajusté ressort à 5,96 dollars, au-dessus de ce qu'attendaient les analystes (autour de 5,81 dollars).",
        },
        {
          type: 'p',
          text: "Sur le sujet qui obsède tout le monde, l'intelligence artificielle, les chiffres sont solides. Les revenus récurrents liés à l'IA dépassent désormais 500 millions de dollars, soit plusieurs fois plus qu'un an plus tôt. Firefly, l'outil d'IA générative d'Adobe, approche les 300 millions de revenus récurrents. Et la direction a relevé ses prévisions pour l'année : elle vise maintenant entre 20,5 et 20,6 milliards de dollars de chiffre d'affaires, avec un programme de rachat d'actions de 25 milliards en place. Sur le papier, c'est un sans-faute.",
        },
        { type: 'h2', text: "Pourquoi l'action chute alors que les chiffres sont bons" },
        {
          type: 'p',
          text: "La raison principale n'est pas dans les résultats du trimestre. C'est une annonce qui les a accompagnés : le directeur financier d'Adobe, Dan Durn, quitte l'entreprise. Et la bourse déteste ça. Un directeur financier qui part, c'est toujours une question qui flotte : pourquoi maintenant, que sait-il qu'on ignore ? Dans la plupart des cas, c'est un départ banal. Mais le marché vend d'abord et pose les questions ensuite. L'action a reculé d'environ 6 % malgré d'excellents résultats.",
        },
        {
          type: 'p',
          text: "Derrière, il y a une inquiétude plus ancienne. Depuis des mois, une question pèse sur Adobe : l'IA va-t-elle détruire son business ? Si n'importe qui peut générer une image ou une vidéo professionnelle en tapant une phrase, pourquoi payer un abonnement Adobe ? Cette peur avait déjà fait fondre l'action jusqu'à des plus-bas de plusieurs années. C'est exactement le contexte que j'avais décrit dans mon analyse fondamentale d'Adobe, juste avant ces résultats.",
        },
        { type: 'h2', text: "Est-ce une bonne entreprise ? La qualité d'abord" },
        {
          type: 'p',
          text: "Quand je regarde une action, je commence toujours par une question, et une seule : est-ce un bon business, indépendamment de son prix ? Pour Adobe, la réponse est oui, sans hésiter. L'entreprise vend les outils qui font tourner la création professionnelle dans le monde entier : Photoshop, Illustrator, Premiere. Son avantage concurrentiel, ce qu'on appelle son moat (le fossé qui empêche un rival de prendre sa place), tient à une chose simple. Demande à un monteur ou à un service marketing d'abandonner ces outils : il ne peut pas. Des années de fichiers, de réflexes, de formation. Cela se traduit par une énorme proportion de revenus en abonnement, qui retombent chaque année.",
        },
        {
          type: 'p',
          text: "Et ce trimestre apporte une preuve concrète que ce moat tient face à l'IA. Les 500 millions de revenus liés à l'IA ne sortent pas de nulle part : ils montrent qu'Adobe arrive à intégrer l'IA dans ses propres outils et à la facturer, au lieu de se faire remplacer par elle. Pour l'instant, l'IA nourrit Adobe plus qu'elle ne la dévore.",
        },
        { type: 'h2', text: "Est-ce un bon prix ? La valorisation" },
        {
          type: 'p',
          text: "Une fois la qualité validée, et seulement après, je regarde le prix. Pour ça, j'utilise un ratio simple : le P/FCF (price-to-free-cash-flow). C'est le prix de l'action divisé par le free cash-flow qu'elle génère chaque année. Le free cash-flow, c'est l'argent qui reste vraiment dans les caisses une fois toutes les factures payées. Un P/FCF de 10, ça veut dire que tu paies aujourd'hui dix années de ce cash. Plus c'est bas, moins c'est cher.",
        },
        {
          type: 'p',
          text: "Voici ce que la chute du cours a produit, en quelques repères :",
        },
        {
          type: 'ul',
          items: [
            "P/FCF aujourd'hui : environ 10 fois le free cash-flow.",
            "Moyenne d'Adobe sur dix ans : environ 33 fois.",
            "Free cash-flow généré par action sur un an : autour de 24 dollars, en croissance.",
            "Lecture : le marché paie l'une des plus belles machines à cash de la tech comme si son déclin était acté.",
          ],
        },
        {
          type: 'p',
          text: "Une entreprise qui croît encore à 13 %, dominante dans son domaine, qui dégage des milliards de cash, payée environ un tiers de sa valorisation habituelle. Soit le marché a raison et l'IA va vraiment la casser, soit la peur est allée trop loin.",
        },
        { type: 'h2', text: "Le vrai débat : l'IA nourrit ou détruit Adobe ?" },
        {
          type: 'p',
          text: "Toute la thèse tient dans cette question. Si tu penses qu'Adobe défend son territoire et apprend à vendre l'IA, alors l'action est anormalement bon marché aujourd'hui. Si tu crois à une disruption profonde, ce bas prix n'est pas une aubaine, c'est un piège. C'est ce qu'on appelle un value trap : une action qui a l'air donnée parce que l'entreprise va, en réalité, gagner moins demain.",
        },
        {
          type: 'p',
          text: "Un P/FCF faible n'est jamais une bonne affaire en soi. Il l'est seulement si la qualité tient dans la durée. C'est précisément pour ça que je juge toujours la qualité avant le prix, jamais l'inverse.",
        },
        { type: 'h2', text: "Comment je tranche, sans émotion" },
        {
          type: 'p',
          text: "Ces résultats ne changent pas ma méthode, ils la confirment. Adobe reste une entreprise d'élite, désormais au cash le moins cher de son histoire. Mais la baisse du jour est dominée par une émotion (le départ d'un dirigeant), pas par une dégradation des fondamentaux. Je ne me précipite pas sur une réaction de marché. Je garde un prix d'achat raisonnable en tête, et je laisse le cours venir à moi plutôt que de courir après lui. Tu peux suivre les chiffres à jour sur ma page d'analyse fondamentale d'Adobe.",
        },
        {
          type: 'p',
          text: "Savoir si une entreprise est bonne, et à quel prix l'acheter, deux questions traitées séparément : c'est tout ce que je voulais pouvoir faire en quelques secondes pour n'importe quelle action. C'est pour ça que j'ai construit mon site d'investissement, où j'applique cette grille à plus de 5 000 actions, dont le [classement des actions sous-évaluées](/classement/sous-evaluees) et ma [méthodologie complète](/methodologie). L'analyse détaillée d'Adobe se trouve sur sa [page d'analyse](/analyse/ADBE).",
        },
      ],
      faq: [
        {
          q: "Pourquoi l'action Adobe baisse-t-elle si les résultats sont bons ?",
          a: "Surtout à cause du départ surprise de son directeur financier, qui a inquiété le marché, et de la peur de fond que l'IA érode son modèle. À court terme, un cours réagit aux émotions et aux surprises, pas seulement aux fondamentaux. Un trimestre record peut coïncider avec une baisse.",
        },
        {
          q: "C'est quoi, le free cash-flow ?",
          a: "L'argent qui reste réellement à l'entreprise après avoir payé tout ce qu'il faut pour tourner et investir. C'est plus difficile à maquiller que le bénéfice comptable, donc je m'y fie davantage pour juger la solidité d'un business.",
        },
        {
          q: "Un P/FCF bas, est-ce toujours une bonne affaire ?",
          a: "Non. Un prix bas peut cacher une entreprise en déclin (un value trap). Il n'est intéressant que si la qualité du business tient dans le temps. D'où ma règle : la qualité d'abord, le prix ensuite.",
        },
        {
          q: "L'IA va-t-elle tuer Adobe ?",
          a: "C'est le vrai débat, et personne n'a la réponse avec certitude. Mais ce trimestre montre qu'Adobe arrive pour l'instant à vendre l'IA plutôt qu'à se faire remplacer par elle : plus de 500 millions de revenus récurrents liés à l'IA. Le risque reste réel et mérite d'être suivi.",
        },
        {
          q: "Faut-il acheter Adobe maintenant ?",
          a: "Ça dépend de ta conviction sur l'IA et de ta discipline de prix. L'action est au cash le moins cher de son histoire, mais une entreprise géniale payée trop cher reste un mauvais placement. Ceci n'est pas un conseil en investissement, fais tes propres recherches.",
        },
      ],
      tags: ['Analyse', 'Adobe', 'Résultats', 'IA', 'Valorisation'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 12 juin 2026, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: "Adobe (ADBE): record quarter, the stock still fell",
      excerpt:
        "Adobe posted a record quarter and raised guidance, yet the stock dropped. A CFO exit and AI fears: my read through the fundamentals.",
      metaDescription:
        "Adobe (ADBE) beat estimates in Q2 2026 but the stock fell. CFO departure, AI fears, valuation near lows: my quality versus price analysis.",
      answer:
        "Adobe posted a record quarter and raised its guidance, yet the stock fell about 6 %. The market punished a surprise CFO departure and its fear that AI will erode the model. The result: an elite company now trades at the cheapest cash multiple in its history. Here is how I separate quality from price.",
      body: [
        {
          type: 'ul',
          items: [
            "Record quarter: 6.62 billion dollars in revenue, up 13 % year over year, and adjusted earnings of 5.96 dollars per share, above expectations.",
            "The stock still fell about 6 %, mainly on a surprise CFO departure and the fear that AI will damage Adobe's model.",
            "AI-related recurring revenue now exceeds 500 million dollars: for now, AI feeds Adobe more than it destroys it.",
            "Adobe trades at roughly 10 times its free cash flow, versus a 33 average over ten years: the market treats it like a company in decline.",
            "A good company is not the same as a good price: I judge quality first, valuation second.",
          ],
        },
        { type: 'h2', text: "What happened last night" },
        {
          type: 'p',
          text: "Adobe reported its second fiscal quarter of 2026 on the evening of June 11. Revenue reached 6.62 billion dollars, up 13 % year over year. That is a record. Adjusted earnings came in at 5.96 dollars per share, above what analysts expected (around 5.81 dollars).",
        },
        {
          type: 'p',
          text: "On the topic everyone obsesses over, artificial intelligence, the numbers are strong. AI-related recurring revenue now tops 500 million dollars, several times more than a year earlier. Firefly, Adobe's generative AI tool, is approaching 300 million in recurring revenue. Management also raised full-year guidance, now targeting 20.5 to 20.6 billion dollars in revenue, with a 25 billion dollar buyback program in place. On paper, it is flawless.",
        },
        { type: 'h2', text: "Why the stock fell while the numbers were good" },
        {
          type: 'p',
          text: "The main reason is not in the quarter's results. It is an announcement that came with them: Adobe's chief financial officer, Dan Durn, is leaving. The market hates that. A departing CFO always leaves a question hanging: why now, what does he know that we do not? In most cases it is an ordinary move. But the market sells first and asks questions later. The stock fell about 6 % despite excellent results.",
        },
        {
          type: 'p',
          text: "Behind it lies an older worry. For months, one question has weighed on Adobe: will AI destroy its business? If anyone can generate a professional image or video by typing a sentence, why pay for an Adobe subscription? That fear had already pushed the stock to multi-year lows. It is exactly the context I described in my Adobe fundamental analysis, just before these results.",
        },
        { type: 'h2', text: "Is it a good company? Quality first" },
        {
          type: 'p',
          text: "When I look at a stock, I always start with one question, and only one: is this a good business, regardless of its price? For Adobe, the answer is clearly yes. The company sells the tools that run professional creation worldwide: Photoshop, Illustrator, Premiere. Its competitive advantage, what we call its moat (the gap that stops a rival from taking its place), comes down to one thing. Ask an editor or a marketing team to drop these tools: they cannot. Years of files, habits, training. That translates into a huge share of subscription revenue that recurs every year.",
        },
        {
          type: 'p',
          text: "And this quarter offers concrete proof that the moat holds against AI. The 500 million dollars of AI revenue did not appear from nowhere: they show Adobe can build AI into its own tools and charge for it, rather than be replaced by it. For now, AI feeds Adobe more than it eats it.",
        },
        { type: 'h2', text: "Is it a good price? The valuation" },
        {
          type: 'p',
          text: "Once quality is confirmed, and only then, I look at the price. For that I use a simple ratio: P/FCF (price-to-free-cash-flow). It is the share price divided by the free cash flow the company generates each year. Free cash flow is the money that truly stays in the bank once every bill is paid. A P/FCF of 10 means you are paying ten years of that cash today. The lower it is, the cheaper it is.",
        },
        {
          type: 'p',
          text: "Here is what the drop in the stock produced, in a few markers:",
        },
        {
          type: 'ul',
          items: [
            "P/FCF today: about 10 times free cash flow.",
            "Adobe's ten-year average: about 33 times.",
            "Free cash flow generated per share over a year: around 24 dollars, and growing.",
            "Read: the market is pricing one of tech's best cash machines as if its decline were a done deal.",
          ],
        },
        {
          type: 'p',
          text: "A company still growing at 13 %, dominant in its field, throwing off billions in cash, priced at about a third of its usual valuation. Either the market is right and AI will truly break it, or the fear has gone too far.",
        },
        { type: 'h2', text: "The real debate: does AI feed or destroy Adobe?" },
        {
          type: 'p',
          text: "The whole thesis sits in that question. If you think Adobe defends its turf and learns to sell AI, then the stock is unusually cheap today. If you believe in deep disruption, this low price is not a bargain, it is a trap. That is what we call a value trap: a stock that looks cheap because the company will in fact earn less tomorrow.",
        },
        {
          type: 'p',
          text: "A low P/FCF is never a bargain on its own. It only is if the quality holds over time. That is exactly why I always judge quality before price, never the other way around.",
        },
        { type: 'h2', text: "How I decide, without emotion" },
        {
          type: 'p',
          text: "These results do not change my method, they confirm it. Adobe remains an elite company, now at the cheapest cash multiple in its history. But today's drop is driven by an emotion (an executive leaving), not by weaker fundamentals. I do not rush into a market reaction. I keep a reasonable buy price in mind and let the stock come to me rather than chase it. You can follow the up-to-date numbers on my Adobe fundamental analysis page.",
        },
        {
          type: 'p',
          text: "Knowing whether a company is good, and at what price to buy it, as two separate questions: that is all I wanted to be able to do in seconds for any stock. That is why I built my investing site, where I apply this grid to more than 5,000 stocks, including the [ranking of undervalued stocks](/classement/sous-evaluees) and my [full methodology](/methodologie). The detailed Adobe analysis is on its [analysis page](/analyse/ADBE).",
        },
      ],
      faq: [
        {
          q: "Why is Adobe stock falling if the results are good?",
          a: "Mostly because of the surprise departure of its chief financial officer, which worried the market, and the underlying fear that AI will erode its model. In the short term, a stock reacts to emotions and surprises, not only to fundamentals. A record quarter can coincide with a drop.",
        },
        {
          q: "What is free cash flow?",
          a: "The money that truly remains with the company after paying everything it needs to operate and invest. It is harder to dress up than accounting profit, so I rely on it more to judge how solid a business is.",
        },
        {
          q: "Is a low P/FCF always a bargain?",
          a: "No. A low price can hide a company in decline (a value trap). It is only attractive if the quality of the business holds over time. Hence my rule: quality first, price second.",
        },
        {
          q: "Will AI kill Adobe?",
          a: "That is the real debate, and nobody knows for sure. But this quarter shows Adobe can, for now, sell AI rather than be replaced by it: more than 500 million dollars of AI-related recurring revenue. The risk is real and worth watching.",
        },
        {
          q: "Should you buy Adobe now?",
          a: "It depends on your conviction about AI and your price discipline. The stock is at the cheapest cash multiple in its history, but a great company bought too expensive is still a bad investment. This is not investment advice, do your own research.",
        },
      ],
      tags: ['Analysis', 'Adobe', 'Earnings', 'AI', 'Valuation'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 12, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "Adobe (ADBE): resultados récord y la acción cae",
      excerpt:
        "Adobe publica un trimestre récord y sube su guía, pero la acción baja. Salida del director financiero y miedo a la IA: mi lectura por los fundamentales.",
      metaDescription:
        "Adobe (ADBE) supera previsiones en el Q2 2026 pero la acción cae. Salida del CFO, miedo a la IA, valoración en mínimos: mi análisis calidad contra precio.",
      answer:
        "Adobe publicó un trimestre récord y subió su guía, y aun así la acción cayó alrededor de un 6 %. El mercado castigó la salida sorpresa del director financiero y su miedo a que la IA erosione el modelo. El resultado: una empresa de élite cotiza a su caja más barata de la historia. Así separo la calidad del precio.",
      body: [
        {
          type: 'ul',
          items: [
            "Trimestre récord: 6,62 mil millones de dólares de ingresos, un 13 % más interanual, y un beneficio ajustado de 5,96 dólares por acción, por encima de lo esperado.",
            "La acción cayó igualmente alrededor de un 6 %, sobre todo por la salida sorpresa del director financiero y el miedo a que la IA dañe el modelo de Adobe.",
            "Los ingresos recurrentes ligados a la IA ya superan los 500 millones de dólares: por ahora, la IA alimenta a Adobe más de lo que la destruye.",
            "Adobe cotiza a unas 10 veces su free cash flow, frente a una media de 33 en diez años: el mercado la trata como una empresa en declive.",
            "Una buena empresa no es lo mismo que un buen precio: juzgo la calidad primero, la valoración después.",
          ],
        },
        { type: 'h2', text: "Qué pasó ayer por la noche" },
        {
          type: 'p',
          text: "Adobe presentó los resultados de su segundo trimestre fiscal de 2026 la tarde del 11 de junio. Los ingresos alcanzan 6,62 mil millones de dólares, un 13 % más interanual. Es un récord. El beneficio ajustado por acción se sitúa en 5,96 dólares, por encima de lo que esperaban los analistas (en torno a 5,81 dólares).",
        },
        {
          type: 'p',
          text: "En el tema que obsesiona a todos, la inteligencia artificial, las cifras son sólidas. Los ingresos recurrentes ligados a la IA ya superan los 500 millones de dólares, varias veces más que un año antes. Firefly, la herramienta de IA generativa de Adobe, se acerca a los 300 millones en ingresos recurrentes. La dirección también subió su guía anual: ahora apunta a entre 20,5 y 20,6 mil millones de dólares de ingresos, con un programa de recompra de acciones de 25 mil millones en marcha. Sobre el papel, es impecable.",
        },
        { type: 'h2', text: "Por qué cae la acción si las cifras son buenas" },
        {
          type: 'p',
          text: "La razón principal no está en los resultados del trimestre. Es un anuncio que los acompañó: el director financiero de Adobe, Dan Durn, deja la empresa. Y a la bolsa eso no le gusta. Un director financiero que se va siempre deja una pregunta en el aire: ¿por qué ahora, qué sabe que nosotros no? En la mayoría de los casos es una salida normal. Pero el mercado vende primero y pregunta después. La acción cayó alrededor de un 6 % pese a unos excelentes resultados.",
        },
        {
          type: 'p',
          text: "Detrás hay una inquietud más antigua. Desde hace meses, una pregunta pesa sobre Adobe: ¿la IA destruirá su negocio? Si cualquiera puede generar una imagen o un vídeo profesional escribiendo una frase, ¿por qué pagar una suscripción de Adobe? Ese miedo ya había hundido la acción hasta mínimos de varios años. Es justo el contexto que describí en mi análisis fundamental de Adobe, justo antes de estos resultados.",
        },
        { type: 'h2', text: "¿Es una buena empresa? La calidad primero" },
        {
          type: 'p',
          text: "Cuando miro una acción, siempre empiezo por una pregunta, y solo una: ¿es un buen negocio, al margen de su precio? Para Adobe, la respuesta es claramente sí. La empresa vende las herramientas que hacen funcionar la creación profesional en todo el mundo: Photoshop, Illustrator, Premiere. Su ventaja competitiva, lo que llamamos su foso o moat (el muro que impide a un rival ocupar su lugar), se reduce a una cosa. Pídele a un editor o a un equipo de marketing que abandone esas herramientas: no puede. Años de archivos, de hábitos, de formación. Eso se traduce en una enorme proporción de ingresos por suscripción que se repiten cada año.",
        },
        {
          type: 'p',
          text: "Y este trimestre aporta una prueba concreta de que ese foso aguanta frente a la IA. Los 500 millones de dólares de ingresos por IA no salen de la nada: muestran que Adobe consigue integrar la IA en sus propias herramientas y cobrarla, en vez de ser sustituida por ella. Por ahora, la IA alimenta a Adobe más de lo que la devora.",
        },
        { type: 'h2', text: "¿Es un buen precio? La valoración" },
        {
          type: 'p',
          text: "Una vez confirmada la calidad, y solo entonces, miro el precio. Para eso uso un ratio sencillo: el P/FCF (price-to-free-cash-flow). Es el precio de la acción dividido por el free cash flow que genera cada año. El free cash flow es el dinero que de verdad queda en caja una vez pagadas todas las facturas. Un P/FCF de 10 significa que hoy pagas diez años de esa caja. Cuanto más bajo, más barato.",
        },
        {
          type: 'p',
          text: "Esto es lo que produjo la caída de la acción, en unas pocas referencias:",
        },
        {
          type: 'ul',
          items: [
            "P/FCF hoy: alrededor de 10 veces el free cash flow.",
            "Media de Adobe a diez años: alrededor de 33 veces.",
            "Free cash flow generado por acción en un año: en torno a 24 dólares, y creciendo.",
            "Lectura: el mercado paga una de las mejores máquinas de caja de la tecnología como si su declive estuviera decidido.",
          ],
        },
        {
          type: 'p',
          text: "Una empresa que todavía crece al 13 %, dominante en su campo, que genera miles de millones en caja, valorada a un tercio de su valoración habitual. O el mercado tiene razón y la IA la romperá de verdad, o el miedo ha ido demasiado lejos.",
        },
        { type: 'h2', text: "El verdadero debate: ¿la IA alimenta o destruye a Adobe?" },
        {
          type: 'p',
          text: "Toda la tesis está en esa pregunta. Si crees que Adobe defiende su terreno y aprende a vender IA, entonces la acción está hoy inusualmente barata. Si crees en una disrupción profunda, este precio bajo no es una ganga, es una trampa. Es lo que llamamos un value trap: una acción que parece regalada porque la empresa, en realidad, ganará menos mañana.",
        },
        {
          type: 'p',
          text: "Un P/FCF bajo nunca es una ganga por sí solo. Solo lo es si la calidad aguanta en el tiempo. Por eso juzgo siempre la calidad antes que el precio, nunca al revés.",
        },
        { type: 'h2', text: "Cómo decido, sin emoción" },
        {
          type: 'p',
          text: "Estos resultados no cambian mi método, lo confirman. Adobe sigue siendo una empresa de élite, ahora a la caja más barata de su historia. Pero la caída de hoy está dominada por una emoción (la marcha de un directivo), no por un deterioro de los fundamentales. No me lanzo sobre una reacción del mercado. Mantengo en mente un precio de compra razonable y dejo que la acción venga a mí en lugar de perseguirla. Puedes seguir las cifras actualizadas en mi página de análisis fundamental de Adobe.",
        },
        {
          type: 'p',
          text: "Saber si una empresa es buena, y a qué precio comprarla, como dos preguntas separadas: es todo lo que quería poder hacer en segundos para cualquier acción. Por eso construí mi web de inversión, donde aplico esta rejilla a más de 5.000 acciones, incluido el [ranking de acciones infravaloradas](/classement/sous-evaluees) y mi [metodología completa](/methodologie). El análisis detallado de Adobe está en su [página de análisis](/analyse/ADBE).",
        },
      ],
      faq: [
        {
          q: "¿Por qué cae la acción de Adobe si los resultados son buenos?",
          a: "Sobre todo por la salida sorpresa de su director financiero, que inquietó al mercado, y por el miedo de fondo a que la IA erosione su modelo. A corto plazo, una acción reacciona a las emociones y a las sorpresas, no solo a los fundamentales. Un trimestre récord puede coincidir con una caída.",
        },
        {
          q: "¿Qué es el free cash flow?",
          a: "El dinero que de verdad le queda a la empresa tras pagar todo lo necesario para operar e invertir. Es más difícil de maquillar que el beneficio contable, así que me fío más de él para juzgar la solidez de un negocio.",
        },
        {
          q: "¿Un P/FCF bajo es siempre una ganga?",
          a: "No. Un precio bajo puede esconder una empresa en declive (un value trap). Solo es atractivo si la calidad del negocio aguanta en el tiempo. De ahí mi regla: la calidad primero, el precio después.",
        },
        {
          q: "¿La IA matará a Adobe?",
          a: "Ese es el verdadero debate, y nadie lo sabe con certeza. Pero este trimestre muestra que Adobe consigue, por ahora, vender IA en lugar de ser sustituida por ella: más de 500 millones de dólares de ingresos recurrentes ligados a la IA. El riesgo es real y conviene seguirlo.",
        },
        {
          q: "¿Hay que comprar Adobe ahora?",
          a: "Depende de tu convicción sobre la IA y de tu disciplina de precio. La acción está a la caja más barata de su historia, pero una gran empresa comprada demasiado cara sigue siendo una mala inversión. Esto no es asesoramiento de inversión, haz tu propia investigación.",
        },
      ],
      tags: ['Análisis', 'Adobe', 'Resultados', 'IA', 'Valoración'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 12 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};

const gddy: Article = {
  slug: 'godaddy-gddy-analyse-action-10-sur-10',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 8,
  ticker: 'GDDY',
  content: {
    fr: {
      title: "GoDaddy (GDDY) : analyse d'une action notée 10/10",
      excerpt:
        "GoDaddy n'est plus un simple vendeur de noms de domaine. Derrière une croissance molle se cache une machine à cash payée bon marché. Mon analyse fondamentale.",
      metaDescription:
        "GoDaddy (GDDY) obtient 10/10 à ma grille de qualité, avec un P/FCF d'environ 8. Forces, croissance molle, valorisation : mon analyse fondamentale complète.",
      answer:
        "GoDaddy obtient la note maximale à ma grille de qualité : très rentable, généreuse en cash, elle rachète massivement ses actions. Le marché la paie pourtant moins de huit fois son free cash flow. Son point faible est une croissance des ventes molle. Voici pourquoi le cash compense, et où est le piège.",
      body: [
        {
          type: 'ul',
          items: [
            "Note de qualité : 10/10 à ma grille de critères fondamentaux.",
            "Marge de free cash flow de 26 % : sur 100 dollars de ventes, 26 finissent en cash réellement disponible.",
            "Croissance des ventes faible (environ 7 %/an), le seul vrai bémol de la thèse.",
            "Mais le cash par action grimpe vite (autour de 28 %/an), porté par de gros rachats d'actions.",
            "Valorisation basse : moins de 8 fois le free cash flow, pour une qualité de 10/10.",
          ],
        },
        { type: 'h2', text: "GoDaddy, ce n'est plus ce que tu crois" },
        {
          type: 'p',
          text: "Pour la plupart des gens, GoDaddy reste le vendeur de noms de domaine, celui des pubs un peu kitsch. Cette image a dix ans de retard. Aujourd'hui, GoDaddy est une plateforme d'infrastructure pour les petites entreprises : hébergement de sites, outils de présence en ligne, paiement, marketing, et désormais des assistants basés sur l'IA pour monter une boutique en quelques minutes.",
        },
        {
          type: 'p',
          text: "Le client type n'est pas un développeur. C'est un artisan, un commerçant, un indépendant qui veut exister en ligne sans rien comprendre à la technique. Des dizaines de millions de clients de ce profil, qui paient un abonnement année après année. C'est ce socle qui m'intéresse.",
        },
        { type: 'h2', text: "Pourquoi ma grille lui met 10/10" },
        {
          type: 'p',
          text: "Je ne note pas une entreprise à l'intuition. Je la passe au crible de critères financiers concrets : est-elle rentable, son cash augmente-t-il, rachète-t-elle ses actions plutôt que d'en créer, sa dette est-elle maîtrisable ? GoDaddy coche presque tout. Sa marge nette tourne autour de 17 %, et surtout sa marge de free cash flow atteint 26 %. Le free cash flow, c'est l'argent qui reste réellement une fois toutes les factures payées. Une marge de 26 %, c'est le double de l'entreprise moyenne.",
        },
        {
          type: 'p',
          text: "Le signe qui ne trompe pas, côté gestion : GoDaddy réduit son nombre d'actions d'environ 5 % par an. Quand une entreprise rachète ses propres actions, chaque action restante représente une plus grosse part du gâteau. C'est pour ça que son cash par action progresse d'environ 28 % par an, bien plus vite que ses ventes.",
        },
        { type: 'h2', text: "Le vrai bémol : la croissance" },
        {
          type: 'p',
          text: "Maintenant, l'honnêteté. GoDaddy n'est pas une fusée. Ses ventes ne progressent que d'environ 7 % par an, sous le seuil de 10 % que j'aime voir. C'est le marché de l'hébergement et des outils PME : mature, concurrentiel, avec Wix, Squarespace ou Shopify qui poussent. Une note de 10/10 ne veut pas dire entreprise parfaite. Elle veut dire que sur l'ensemble de mes critères objectifs, le profil financier est solide. La croissance molle est le trade-off à accepter ici.",
        },
        {
          type: 'p',
          text: "Ce qui sauve la thèse, c'est l'allocation du capital. Une entreprise qui croît peu mais qui transforme efficacement son cash en valeur par action peut très bien rémunérer ses actionnaires. GoDaddy fait exactement ça : peu de croissance du chiffre d'affaires, mais beaucoup de cash redistribué via les rachats.",
        },
        { type: 'h2', text: "Est-ce le bon prix ?" },
        {
          type: 'p',
          text: "C'est la deuxième question, que je traite toujours séparément de la qualité. Pour mesurer le prix, je regarde le P/FCF (price-to-free-cash-flow) : le prix de l'action divisé par le free cash flow annuel. Un P/FCF de 8, ça veut dire que tu paies huit années de ce cash. GoDaddy se paie aujourd'hui moins de 8 fois son free cash flow. Pour une entreprise notée 10/10, c'est bon marché : le marché valorise la médiocrité de la croissance, pas la qualité du cash.",
        },
        {
          type: 'p',
          text: "Le risque à garder en tête : si la croissance ne repart pas et que la concurrence grignote les marges, ce bas prix sera mérité. Si au contraire les nouveaux outils IA relancent les abonnements, l'action est anormalement bon marché. Un P/FCF bas n'est une affaire que si la qualité tient.",
        },
        {
          type: 'p',
          text: "C'est tout l'intérêt de séparer les deux questions, la qualité d'un côté, le prix de l'autre. C'est exactement ce que je voulais pouvoir faire en quelques secondes pour n'importe quelle action, alors je l'ai codé dans mon site d'investissement. Tu peux y voir le détail des critères sur la [page d'analyse de GoDaddy](/analyse/GDDY), le [classement des actions sous-évaluées](/classement/sous-evaluees) et ma [méthodologie complète](/methodologie).",
        },
      ],
      faq: [
        {
          q: "GoDaddy est-elle juste un vendeur de noms de domaine ?",
          a: "Plus depuis longtemps. C'est devenu une plateforme d'infrastructure pour petites entreprises : hébergement, sites, paiement, marketing, outils d'IA. Le nom de domaine n'est que la porte d'entrée vers des abonnements récurrents.",
        },
        {
          q: "Pourquoi 10/10 si la croissance est faible ?",
          a: "Ma note mesure la solidité financière globale : rentabilité, génération de cash, marges, rachats d'actions, dette. GoDaddy excelle sur presque tout. La croissance molle est son point faible, mais elle ne suffit pas à dégrader un profil par ailleurs très solide.",
        },
        {
          q: "Un P/FCF inférieur à 8, est-ce une bonne affaire ?",
          a: "Seulement si la qualité tient. Un prix bas peut refléter une croissance en panne. Chez GoDaddy, le cash par action progresse vite grâce aux rachats, ce qui rend le bas prix plus intéressant qu'il n'en a l'air, à condition que les marges résistent.",
        },
        {
          q: "Faut-il acheter l'action GoDaddy ?",
          a: "Ça dépend de ta conviction sur sa capacité à défendre ses marges face à Wix, Squarespace et Shopify, et de ta discipline de prix. Ceci n'est pas un conseil en investissement personnalisé, fais tes propres recherches.",
        },
      ],
      tags: ['Analyse', 'GoDaddy', 'Software', 'Valorisation'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 12 juin 2026, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: "GoDaddy (GDDY): a stock rated 10/10, explained",
      excerpt:
        "GoDaddy is no longer just a domain name seller. Behind soft growth sits a cash machine priced cheaply. My fundamental analysis.",
      metaDescription:
        "GoDaddy (GDDY) scores 10/10 on my quality grid, at a P/FCF near 8. Strengths, soft growth, valuation: my full fundamental analysis.",
      answer:
        "GoDaddy earns the top score on my quality grid: highly profitable, cash generous, buying back stock aggressively. Yet the market pays less than eight times its free cash flow. Its weak spot is soft sales growth. Here is why the cash makes up for it, and where the trap is.",
      body: [
        {
          type: 'ul',
          items: [
            "Quality score: 10/10 on my fundamental grid.",
            "Free cash flow margin of 26 %: out of 100 dollars of sales, 26 end up as cash truly available.",
            "Weak sales growth (about 7 % a year), the one real caveat of the thesis.",
            "But cash per share climbs fast (around 28 % a year), driven by heavy buybacks.",
            "Low valuation: under 8 times free cash flow, for a 10/10 quality.",
          ],
        },
        { type: 'h2', text: "GoDaddy is no longer what you think" },
        {
          type: 'p',
          text: "For most people, GoDaddy is still the domain name seller from the cheesy ads. That image is ten years out of date. Today GoDaddy is an infrastructure platform for small businesses: website hosting, online presence tools, payments, marketing, and now AI-based assistants to spin up a store in minutes.",
        },
        {
          type: 'p',
          text: "The typical customer is not a developer. It is a craftsperson, a shopkeeper, a freelancer who wants to exist online without understanding the tech. Tens of millions of such customers, paying a subscription year after year. That base is what interests me.",
        },
        { type: 'h2', text: "Why my grid gives it 10/10" },
        {
          type: 'p',
          text: "I do not score a company on a hunch. I run it through concrete financial criteria: is it profitable, is its cash growing, does it buy back shares rather than issue them, is its debt manageable? GoDaddy ticks almost everything. Its net margin is around 17 %, and above all its free cash flow margin reaches 26 %. Free cash flow is the money that truly stays once every bill is paid. A 26 % margin is double the average company.",
        },
        {
          type: 'p',
          text: "The tell on capital management: GoDaddy shrinks its share count by about 5 % a year. When a company buys back its own shares, each remaining share is a bigger slice of the pie. That is why its cash per share grows about 28 % a year, far faster than its sales.",
        },
        { type: 'h2', text: "The real caveat: growth" },
        {
          type: 'p',
          text: "Now, the honest part. GoDaddy is no rocket. Its sales grow only about 7 % a year, below the 10 % threshold I like to see. This is the hosting and SMB tools market: mature, competitive, with Wix, Squarespace and Shopify pushing. A 10/10 score does not mean a perfect company. It means that across my objective criteria, the financial profile is solid. Soft growth is the trade-off to accept here.",
        },
        {
          type: 'p',
          text: "What saves the thesis is capital allocation. A company that grows little but efficiently turns its cash into per-share value can still reward shareholders well. GoDaddy does exactly that: little revenue growth, but plenty of cash returned through buybacks.",
        },
        { type: 'h2', text: "Is it the right price?" },
        {
          type: 'p',
          text: "That is the second question, which I always handle separately from quality. To measure price, I look at P/FCF (price-to-free-cash-flow): the share price divided by annual free cash flow. A P/FCF of 8 means you pay eight years of that cash. GoDaddy trades today at under 8 times its free cash flow. For a 10/10 stock, that is cheap: the market is pricing the mediocre growth, not the quality of the cash.",
        },
        {
          type: 'p',
          text: "The risk to keep in mind: if growth does not pick up and competition erodes margins, that low price will be deserved. If instead the new AI tools revive subscriptions, the stock is unusually cheap. A low P/FCF is only a bargain if the quality holds.",
        },
        {
          type: 'p',
          text: "That is the whole point of separating the two questions, quality on one side, price on the other. It is exactly what I wanted to do in seconds for any stock, so I coded it into my investing site. You can see the criteria in detail on the [GoDaddy analysis page](/analyse/GDDY), the [ranking of undervalued stocks](/classement/sous-evaluees) and my [full methodology](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Is GoDaddy just a domain name seller?",
          a: "Not for a long time. It has become an infrastructure platform for small businesses: hosting, websites, payments, marketing, AI tools. The domain name is only the entry point to recurring subscriptions.",
        },
        {
          q: "Why 10/10 if growth is weak?",
          a: "My score measures overall financial soundness: profitability, cash generation, margins, buybacks, debt. GoDaddy excels at almost everything. Soft growth is its weak spot, but it is not enough to drag down an otherwise very solid profile.",
        },
        {
          q: "Is a P/FCF under 8 a bargain?",
          a: "Only if the quality holds. A low price can reflect stalled growth. At GoDaddy, cash per share grows fast thanks to buybacks, which makes the low price more interesting than it looks, provided margins hold up.",
        },
        {
          q: "Should you buy GoDaddy stock?",
          a: "It depends on your conviction about its ability to defend margins against Wix, Squarespace and Shopify, and on your price discipline. This is not personalized investment advice, do your own research.",
        },
      ],
      tags: ['Analysis', 'GoDaddy', 'Software', 'Valuation'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 12, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "GoDaddy (GDDY): análisis de una acción 10/10",
      excerpt:
        "GoDaddy ya no es un simple vendedor de dominios. Tras un crecimiento flojo se esconde una máquina de caja barata. Mi análisis fundamental.",
      metaDescription:
        "GoDaddy (GDDY) saca 10/10 en mi rejilla de calidad, con un P/FCF cercano a 8. Fortalezas, crecimiento flojo, valoración: mi análisis fundamental completo.",
      answer:
        "GoDaddy obtiene la nota máxima en mi rejilla de calidad: muy rentable, generosa en caja, recompra acciones con fuerza. Aun así el mercado la paga a menos de ocho veces su free cash flow. Su punto débil es un crecimiento de ventas flojo. Aquí explico por qué la caja compensa, y dónde está la trampa.",
      body: [
        {
          type: 'ul',
          items: [
            "Nota de calidad: 10/10 en mi rejilla de criterios fundamentales.",
            "Margen de free cash flow del 26 %: de 100 dólares de ventas, 26 acaban en caja realmente disponible.",
            "Crecimiento de ventas flojo (alrededor del 7 % anual), el único pero real de la tesis.",
            "Pero la caja por acción sube rápido (en torno al 28 % anual), impulsada por fuertes recompras.",
            "Valoración baja: menos de 8 veces el free cash flow, para una calidad de 10/10.",
          ],
        },
        { type: 'h2', text: "GoDaddy ya no es lo que crees" },
        {
          type: 'p',
          text: "Para la mayoría, GoDaddy sigue siendo el vendedor de dominios de los anuncios algo hortera. Esa imagen lleva diez años de retraso. Hoy GoDaddy es una plataforma de infraestructura para pequeñas empresas: alojamiento de webs, herramientas de presencia online, pagos, marketing, y ahora asistentes con IA para montar una tienda en minutos.",
        },
        {
          type: 'p',
          text: "El cliente típico no es un programador. Es un artesano, un comerciante, un autónomo que quiere existir en internet sin entender de tecnología. Decenas de millones de clientes de ese perfil, que pagan una suscripción año tras año. Esa base es lo que me interesa.",
        },
        { type: 'h2', text: "Por qué mi rejilla le da 10/10" },
        {
          type: 'p',
          text: "No puntúo una empresa por intuición. La paso por criterios financieros concretos: ¿es rentable, crece su caja, recompra acciones en vez de emitirlas, tiene la deuda controlada? GoDaddy cumple casi todo. Su margen neto ronda el 17 %, y sobre todo su margen de free cash flow alcanza el 26 %. El free cash flow es el dinero que de verdad queda una vez pagadas todas las facturas. Un margen del 26 % es el doble de la empresa media.",
        },
        {
          type: 'p',
          text: "La señal que no engaña, en gestión: GoDaddy reduce su número de acciones alrededor de un 5 % al año. Cuando una empresa recompra sus propias acciones, cada acción restante representa una porción mayor del pastel. Por eso su caja por acción crece cerca de un 28 % al año, mucho más rápido que sus ventas.",
        },
        { type: 'h2', text: "El verdadero pero: el crecimiento" },
        {
          type: 'p',
          text: "Ahora, la honestidad. GoDaddy no es un cohete. Sus ventas crecen solo alrededor de un 7 % anual, por debajo del umbral del 10 % que me gusta ver. Es el mercado del alojamiento y las herramientas para pymes: maduro, competitivo, con Wix, Squarespace o Shopify empujando. Una nota de 10/10 no significa empresa perfecta. Significa que en el conjunto de mis criterios objetivos, el perfil financiero es sólido. El crecimiento flojo es el trade-off a aceptar aquí.",
        },
        {
          type: 'p',
          text: "Lo que salva la tesis es la asignación de capital. Una empresa que crece poco pero convierte su caja en valor por acción de forma eficiente puede recompensar bien a sus accionistas. GoDaddy hace justo eso: poco crecimiento de ingresos, pero mucha caja devuelta vía recompras.",
        },
        { type: 'h2', text: "¿Es el precio correcto?" },
        {
          type: 'p',
          text: "Es la segunda pregunta, que siempre trato por separado de la calidad. Para medir el precio miro el P/FCF (price-to-free-cash-flow): el precio de la acción dividido por el free cash flow anual. Un P/FCF de 8 significa que pagas ocho años de esa caja. GoDaddy cotiza hoy a menos de 8 veces su free cash flow. Para una acción 10/10, es barato: el mercado valora la mediocridad del crecimiento, no la calidad de la caja.",
        },
        {
          type: 'p',
          text: "El riesgo a tener presente: si el crecimiento no repunta y la competencia erosiona los márgenes, ese precio bajo estará merecido. Si en cambio las nuevas herramientas de IA reactivan las suscripciones, la acción está inusualmente barata. Un P/FCF bajo solo es una ganga si la calidad aguanta.",
        },
        {
          type: 'p',
          text: "Ese es todo el sentido de separar las dos preguntas, la calidad por un lado, el precio por otro. Es justo lo que quería poder hacer en segundos para cualquier acción, así que lo programé en mi web de inversión. Puedes ver el detalle de los criterios en la [página de análisis de GoDaddy](/analyse/GDDY), el [ranking de acciones infravaloradas](/classement/sous-evaluees) y mi [metodología completa](/methodologie).",
        },
      ],
      faq: [
        {
          q: "¿GoDaddy es solo un vendedor de dominios?",
          a: "Ya no desde hace tiempo. Se ha convertido en una plataforma de infraestructura para pequeñas empresas: alojamiento, webs, pagos, marketing, herramientas de IA. El dominio es solo la puerta de entrada a suscripciones recurrentes.",
        },
        {
          q: "¿Por qué 10/10 si el crecimiento es débil?",
          a: "Mi nota mide la solidez financiera global: rentabilidad, generación de caja, márgenes, recompras, deuda. GoDaddy destaca en casi todo. El crecimiento flojo es su punto débil, pero no basta para degradar un perfil por lo demás muy sólido.",
        },
        {
          q: "¿Un P/FCF por debajo de 8 es una ganga?",
          a: "Solo si la calidad aguanta. Un precio bajo puede reflejar un crecimiento estancado. En GoDaddy, la caja por acción crece rápido gracias a las recompras, lo que hace el precio bajo más interesante de lo que parece, siempre que los márgenes resistan.",
        },
        {
          q: "¿Hay que comprar la acción de GoDaddy?",
          a: "Depende de tu convicción sobre su capacidad de defender los márgenes frente a Wix, Squarespace y Shopify, y de tu disciplina de precio. Esto no es asesoramiento de inversión personalizado, haz tu propia investigación.",
        },
      ],
      tags: ['Análisis', 'GoDaddy', 'Software', 'Valoración'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 12 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};

const methodeQualite: Article = {
  slug: 'methode-lubin-qualite-valorisation-separees',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 7,
  content: {
    fr: {
      title: "Qualité et prix : pourquoi je ne les mélange jamais",
      excerpt:
        "La plupart des erreurs d'investissement viennent d'une confusion : croire qu'une bonne entreprise est forcément un bon achat. Voici comment je sépare les deux.",
      metaDescription:
        "Une bonne entreprise n'est pas un bon investissement si tu la paies trop cher. Ma méthode sépare qualité et prix : voici pourquoi, avec des exemples réels.",
      answer:
        "Une bonne entreprise et un bon investissement sont deux choses différentes. La qualité mesure la solidité du business. Le prix mesure ce que tu paies pour cette solidité. Mélanger les deux est l'erreur numéro un. Ma méthode les juge séparément, qualité d'abord, prix ensuite. Voici comment, et pourquoi ça change tout.",
      body: [
        {
          type: 'ul',
          items: [
            "Qualité et prix répondent à deux questions différentes, jamais à la même.",
            "Une entreprise géniale payée trop cher reste un mauvais placement.",
            "Une entreprise pas chère mais en déclin est un piège, pas une affaire (value trap).",
            "Ma règle : je juge la qualité d'abord, le prix seulement ensuite.",
            "La case à viser : qualité élevée ET prix bas, en même temps.",
          ],
        },
        { type: 'h2', text: "L'erreur qui coûte le plus cher" },
        {
          type: 'p',
          text: "« C'est une super entreprise, donc c'est un bon investissement. » Cette phrase a ruiné plus de portefeuilles que n'importe quel krach. Parce qu'elle confond deux choses qui n'ont rien à voir : la qualité d'une entreprise, et la qualité d'un investissement.",
        },
        {
          type: 'p',
          text: "Une entreprise de qualité, c'est un business solide : rentable, qui génère du cash, qui résiste aux crises. Un bon investissement, c'est autre chose : c'est acheter quelque chose pour moins que ce que ça vaut. Tu peux avoir la meilleure entreprise du monde et faire un mauvais placement, simplement en la payant trop cher.",
        },
        { type: 'h2', text: "Les deux questions, jamais une seule" },
        {
          type: 'p',
          text: "C'est pour ça que je pose toujours deux questions séparées. La première : est-ce une bonne entreprise ? Là je regarde la qualité, sur des critères objectifs : la régularité du free cash flow (l'argent qui reste vraiment une fois les factures payées), les marges, la solidité du bilan, le rendement du capital. Je résume ça par une note sur 10.",
        },
        {
          type: 'p',
          text: "La deuxième question, et seulement après : est-ce un bon prix ? Là je regarde la valorisation, c'est-à-dire combien je paie pour ce que l'entreprise génère. L'outil le plus simple pour ça est le P/FCF (price-to-free-cash-flow) : le prix de l'action divisé par le free cash flow annuel. Un P/FCF de 12, ça veut dire que tu paies douze années de ce cash.",
        },
        { type: 'h2', text: "Cas réel : la super entreprise trop chère" },
        {
          type: 'p',
          text: "Prends Adobe avant ses derniers résultats. Une entreprise d'élite, dominante, des marges énormes. Tout le monde le sait. Et comme tout le monde le sait, l'action s'est longtemps payée plus de 30 fois son free cash flow. À ce prix, même une entreprise formidable peut stagner des années, parce que la bonne nouvelle est déjà dans le cours. Tu as payé le futur d'avance.",
        },
        {
          type: 'p',
          text: "C'est le piège numéro un : confondre « entreprise admirable » et « action à acheter maintenant ». L'admiration n'est pas une stratégie. Le prix, si.",
        },
        { type: 'h2', text: "Cas réel : le piège inverse, le value trap" },
        {
          type: 'p',
          text: "L'autre piège est symétrique. Tu tombes sur une action à 4 fois son free cash flow. Ça paraît donné, réflexe : « c'est sous-évalué, j'achète ». Sauf que parfois le prix est bas pour une bonne raison. L'entreprise perd des parts de marché, ses marges s'effritent, son cash de demain sera plus faible. Tu crois acheter une affaire, tu achètes une entreprise en train de fondre. Ça s'appelle un value trap, un piège de la valeur.",
        },
        {
          type: 'p',
          text: "C'est exactement pour l'éviter que je ne regarde jamais le prix sans avoir d'abord jugé la qualité. Un P/FCF bas n'est jamais une bonne affaire en soi. Il l'est seulement si la qualité, derrière, tient dans la durée.",
        },
        { type: 'h2', text: "La case que je cherche" },
        {
          type: 'p',
          text: "Si je devais résumer ma méthode en une image, ce serait un tableau à quatre cases, deux axes : la qualité, et le prix. Qualité faible et prix élevé : à fuir. Qualité élevée et prix élevé : la belle entreprise trop chère, je la mets en liste d'attente. Qualité faible et prix bas : le value trap. Et la case que je cherche vraiment : qualité élevée et prix bas, en même temps.",
        },
        {
          type: 'p',
          text: "C'est rare, et c'est inconfortable à acheter, parce que sur le moment personne n'en veut. Mais c'est là que se font les meilleurs investissements. Pouvoir répondre à ces deux questions, séparément, en quelques secondes pour n'importe quelle action : c'est tout ce que je voulais. C'est pour ça que j'ai construit mon site, avec une note de qualité et un prix de référence pour chaque action. Tu peux commencer par le [classement des actions sous-évaluées](/classement/sous-evaluees) ou lire ma [méthodologie complète](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Qualité et valorisation, quelle différence ?",
          a: "La qualité mesure si l'entreprise est un bon business, indépendamment de son cours : rentabilité, cash, marges, dette. La valorisation mesure si le prix payé est raisonnable au regard de ce que l'entreprise génère. Les deux sont indépendantes.",
        },
        {
          q: "C'est quoi un value trap ?",
          a: "Une action qui semble bon marché mais dont l'entreprise est en déclin. Le prix est bas parce que le cash futur sera plus faible. On croit acheter une affaire, on achète un problème. Un prix bas n'est intéressant que si la qualité tient.",
        },
        {
          q: "Pourquoi juger la qualité avant le prix ?",
          a: "Parce qu'un prix bas n'a de sens que sur une entreprise solide. Commencer par la qualité évite de se faire piéger par des actions optiquement bon marché mais en perdition. Le prix ne sert qu'à décider quand acheter une entreprise déjà jugée bonne.",
        },
        {
          q: "Comment appliquer cette méthode concrètement ?",
          a: "Pour chaque action, réponds à deux questions séparées : est-ce un bon business (qualité), et est-ce un bon prix (valorisation). N'achète que lorsque les deux réponses sont oui. Ceci n'est pas un conseil en investissement, fais tes propres recherches.",
        },
      ],
      tags: ['Méthode', 'Valorisation', 'Pédagogie', 'P/FCF'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Fais tes propres recherches.",
    },
    en: {
      title: "Quality or price: why I never mix the two",
      excerpt:
        "Most investing mistakes come from one confusion: believing a good company is always a good buy. Here is how I separate the two.",
      metaDescription:
        "A good company is not a good investment if you overpay. My method separates quality and price: here is why, with real examples.",
      answer:
        "A good company and a good investment are two different things. Quality measures how solid the business is. Price measures what you pay for that solidity. Mixing the two is the number one mistake. My method judges them separately, quality first, price second. Here is how, and why it changes everything.",
      body: [
        {
          type: 'ul',
          items: [
            "Quality and price answer two different questions, never the same one.",
            "A great company bought too expensive is still a bad investment.",
            "A cheap but declining company is a trap, not a bargain (a value trap).",
            "My rule: I judge quality first, price only afterward.",
            "The box to aim for: high quality AND low price, at the same time.",
          ],
        },
        { type: 'h2', text: "The most expensive mistake" },
        {
          type: 'p',
          text: "« It is a great company, so it is a good investment. » That sentence has ruined more portfolios than any crash. Because it confuses two unrelated things: the quality of a company, and the quality of an investment.",
        },
        {
          type: 'p',
          text: "A quality company is a solid business: profitable, cash generating, resilient in downturns. A good investment is something else: it is buying something for less than it is worth. You can own the best company in the world and still make a poor investment, simply by overpaying.",
        },
        { type: 'h2', text: "Two questions, never just one" },
        {
          type: 'p',
          text: "That is why I always ask two separate questions. First: is this a good company? There I look at quality, on objective criteria: the consistency of free cash flow (the money that truly remains once bills are paid), margins, balance sheet strength, return on capital. I sum it up as a score out of 10.",
        },
        {
          type: 'p',
          text: "The second question, and only after: is this a good price? There I look at valuation, meaning how much I pay for what the company generates. The simplest tool is P/FCF (price-to-free-cash-flow): the share price divided by annual free cash flow. A P/FCF of 12 means you pay twelve years of that cash.",
        },
        { type: 'h2', text: "Real case: the great company too expensive" },
        {
          type: 'p',
          text: "Take Adobe before its latest results. An elite company, dominant, huge margins. Everyone knows it. And because everyone knows it, the stock long traded above 30 times its free cash flow. At that price, even a wonderful company can stall for years, because the good news is already in the price. You paid the future in advance.",
        },
        {
          type: 'p',
          text: "That is the number one trap: confusing an admirable company with a stock to buy now. Admiration is not a strategy. Price is.",
        },
        { type: 'h2', text: "Real case: the opposite trap, the value trap" },
        {
          type: 'p',
          text: "The other trap is symmetrical. You find a stock at 4 times its free cash flow. It looks cheap, the reflex is: « it is undervalued, I buy ». Except sometimes the price is low for a good reason. The company is losing market share, its margins are eroding, its future cash will be lower. You think you are buying a bargain, you are buying a company that is melting. That is a value trap.",
        },
        {
          type: 'p',
          text: "It is precisely to avoid this that I never look at price before judging quality. A low P/FCF is never a bargain on its own. It only is if the quality behind it holds over time.",
        },
        { type: 'h2', text: "The box I am looking for" },
        {
          type: 'p',
          text: "If I had to sum up my method in one image, it would be a four-box grid, two axes: quality and price. Low quality and high price: avoid. High quality and high price: the fine company too expensive, I put it on a watchlist. Low quality and low price: the value trap. And the box I truly hunt for: high quality and low price, at the same time.",
        },
        {
          type: 'p',
          text: "It is rare, and it is uncomfortable to buy, because at that moment nobody wants it. But that is where the best investments are made. Being able to answer those two questions, separately, in seconds for any stock: that is all I wanted. That is why I built my site, with a quality score and a reference price for every stock. You can start with the [ranking of undervalued stocks](/classement/sous-evaluees) or read my [full methodology](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Quality versus valuation, what is the difference?",
          a: "Quality measures whether the company is a good business, regardless of its share price: profitability, cash, margins, debt. Valuation measures whether the price paid is reasonable given what the company generates. The two are independent.",
        },
        {
          q: "What is a value trap?",
          a: "A stock that looks cheap but whose company is in decline. The price is low because future cash will be weaker. You think you are buying a bargain, you are buying a problem. A low price is only attractive if the quality holds.",
        },
        {
          q: "Why judge quality before price?",
          a: "Because a low price only makes sense on a solid company. Starting with quality avoids being trapped by stocks that look cheap but are failing. Price only serves to decide when to buy a company already judged good.",
        },
        {
          q: "How do I apply this method concretely?",
          a: "For each stock, answer two separate questions: is it a good business (quality), and is it a good price (valuation). Only buy when both answers are yes. This is not investment advice, do your own research.",
        },
      ],
      tags: ['Method', 'Valuation', 'Education', 'P/FCF'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Do your own research.",
    },
    es: {
      title: "Calidad o precio: por qué nunca los mezclo",
      excerpt:
        "La mayoría de los errores de inversión vienen de una confusión: creer que una buena empresa es siempre una buena compra. Así separo las dos cosas.",
      metaDescription:
        "Una buena empresa no es una buena inversión si pagas de más. Mi método separa calidad y precio: aquí explico por qué, con ejemplos reales.",
      answer:
        "Una buena empresa y una buena inversión son dos cosas distintas. La calidad mide la solidez del negocio. El precio mide lo que pagas por esa solidez. Mezclar ambas es el error número uno. Mi método las juzga por separado, calidad primero, precio después. Aquí explico cómo, y por qué lo cambia todo.",
      body: [
        {
          type: 'ul',
          items: [
            "Calidad y precio responden a dos preguntas distintas, nunca a la misma.",
            "Una empresa genial comprada demasiado cara sigue siendo una mala inversión.",
            "Una empresa barata pero en declive es una trampa, no una ganga (value trap).",
            "Mi regla: juzgo la calidad primero, el precio solo después.",
            "La casilla a buscar: calidad alta Y precio bajo, al mismo tiempo.",
          ],
        },
        { type: 'h2', text: "El error que más caro cuesta" },
        {
          type: 'p',
          text: "« Es una gran empresa, así que es una buena inversión. » Esa frase ha arruinado más carteras que cualquier crac. Porque confunde dos cosas que no tienen relación: la calidad de una empresa, y la calidad de una inversión.",
        },
        {
          type: 'p',
          text: "Una empresa de calidad es un negocio sólido: rentable, que genera caja, que resiste las crisis. Una buena inversión es otra cosa: es comprar algo por menos de lo que vale. Puedes tener la mejor empresa del mundo y hacer una mala inversión, simplemente pagándola demasiado cara.",
        },
        { type: 'h2', text: "Dos preguntas, nunca una sola" },
        {
          type: 'p',
          text: "Por eso siempre hago dos preguntas separadas. La primera: ¿es una buena empresa? Ahí miro la calidad, con criterios objetivos: la regularidad del free cash flow (el dinero que de verdad queda una vez pagadas las facturas), los márgenes, la solidez del balance, el rendimiento del capital. Lo resumo en una nota sobre 10.",
        },
        {
          type: 'p',
          text: "La segunda pregunta, y solo después: ¿es un buen precio? Ahí miro la valoración, es decir cuánto pago por lo que la empresa genera. La herramienta más sencilla es el P/FCF (price-to-free-cash-flow): el precio de la acción dividido por el free cash flow anual. Un P/FCF de 12 significa que pagas doce años de esa caja.",
        },
        { type: 'h2', text: "Caso real: la gran empresa demasiado cara" },
        {
          type: 'p',
          text: "Toma Adobe antes de sus últimos resultados. Una empresa de élite, dominante, con márgenes enormes. Todos lo saben. Y como todos lo saben, la acción cotizó mucho tiempo por encima de 30 veces su free cash flow. A ese precio, hasta una empresa maravillosa puede estancarse años, porque la buena noticia ya está en la cotización. Pagaste el futuro por adelantado.",
        },
        {
          type: 'p',
          text: "Esa es la trampa número uno: confundir una empresa admirable con una acción para comprar ahora. La admiración no es una estrategia. El precio, sí.",
        },
        { type: 'h2', text: "Caso real: la trampa inversa, el value trap" },
        {
          type: 'p',
          text: "La otra trampa es simétrica. Encuentras una acción a 4 veces su free cash flow. Parece regalada, el reflejo es: « está infravalorada, compro ». Salvo que a veces el precio es bajo por una buena razón. La empresa pierde cuota de mercado, sus márgenes se erosionan, su caja de mañana será menor. Crees comprar una ganga, compras una empresa que se derrite. Eso es un value trap.",
        },
        {
          type: 'p',
          text: "Es justo para evitar esto que nunca miro el precio antes de juzgar la calidad. Un P/FCF bajo nunca es una ganga por sí solo. Solo lo es si la calidad detrás aguanta en el tiempo.",
        },
        { type: 'h2', text: "La casilla que busco" },
        {
          type: 'p',
          text: "Si tuviera que resumir mi método en una imagen, sería una rejilla de cuatro casillas, dos ejes: calidad y precio. Calidad baja y precio alto: huir. Calidad alta y precio alto: la buena empresa demasiado cara, la pongo en lista de espera. Calidad baja y precio bajo: el value trap. Y la casilla que de verdad busco: calidad alta y precio bajo, al mismo tiempo.",
        },
        {
          type: 'p',
          text: "Es raro, y es incómodo de comprar, porque en ese momento nadie la quiere. Pero ahí es donde se hacen las mejores inversiones. Poder responder a esas dos preguntas, por separado, en segundos para cualquier acción: es todo lo que quería. Por eso construí mi web, con una nota de calidad y un precio de referencia para cada acción. Puedes empezar por el [ranking de acciones infravaloradas](/classement/sous-evaluees) o leer mi [metodología completa](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Calidad y valoración, ¿qué diferencia hay?",
          a: "La calidad mide si la empresa es un buen negocio, al margen de su cotización: rentabilidad, caja, márgenes, deuda. La valoración mide si el precio pagado es razonable respecto a lo que la empresa genera. Ambas son independientes.",
        },
        {
          q: "¿Qué es un value trap?",
          a: "Una acción que parece barata pero cuya empresa está en declive. El precio es bajo porque la caja futura será menor. Crees comprar una ganga, compras un problema. Un precio bajo solo es atractivo si la calidad aguanta.",
        },
        {
          q: "¿Por qué juzgar la calidad antes que el precio?",
          a: "Porque un precio bajo solo tiene sentido en una empresa sólida. Empezar por la calidad evita caer en acciones ópticamente baratas pero en quiebra. El precio solo sirve para decidir cuándo comprar una empresa ya juzgada buena.",
        },
        {
          q: "¿Cómo aplico este método en concreto?",
          a: "Para cada acción, responde a dos preguntas separadas: ¿es un buen negocio (calidad), y es un buen precio (valoración)? Compra solo cuando ambas respuestas sean sí. Esto no es asesoramiento de inversión, haz tu propia investigación.",
        },
      ],
      tags: ['Método', 'Valoración', 'Pedagogía', 'P/FCF'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Haz tu propia investigación.",
    },
  },
};

const softwareApp: Article = {
  slug: 'meilleures-actions-logicielles-10-sur-10-juin-2026',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 9,
  content: {
    fr: {
      title: "Meilleures actions logicielles : 4 valeurs 10/10",
      excerpt:
        "Intuit, Roper, Salesforce, Bentley : quatre éditeurs de logiciels notés 10/10 à ma grille. Même qualité, valorisations très différentes. Le comparatif.",
      metaDescription:
        "INTU, ROP, CRM et BSY ont toutes 10/10 à ma grille de qualité, mais des P/FCF de 13 à 24. Quel éditeur logiciel offre le meilleur rapport qualité prix ?",
      answer:
        "Intuit, Roper, Salesforce et Bentley obtiennent toutes la note maximale à ma grille de qualité. Mais leurs valorisations vont du simple à presque le double : Salesforce se paie environ 13 fois son cash, Bentley près de 24. Même qualité ne veut pas dire même prix. Voici comment je les départage.",
      body: [
        {
          type: 'ul',
          items: [
            "Quatre éditeurs notés 10/10 : Intuit (INTU), Roper (ROP), Salesforce (CRM), Bentley (BSY).",
            "Salesforce est la moins chère : environ 13 fois son free cash flow.",
            "Intuit et Roper suivent, autour de 13 à 14 fois.",
            "Bentley est la plus chère, près de 24 fois, car sa qualité se paie.",
            "Toutes dégagent plus de 25 % de marge de free cash flow : des machines à cash.",
          ],
        },
        { type: 'h2', text: "Pourquoi le logiciel domine ma sélection qualité" },
        {
          type: 'p',
          text: "Le logiciel est le secteur le plus représenté dans mon haut de classement, et ce n'est pas un hasard. Un bon éditeur vend un abonnement, encaissé d'avance, avec un coût marginal quasi nul pour servir un client de plus. Résultat : des marges énormes et beaucoup de cash. Le free cash flow, c'est l'argent qui reste réellement une fois toutes les factures payées. Les quatre entreprises de ce comparatif en dégagent toutes plus de 25 % de leurs ventes.",
        },
        {
          type: 'p',
          text: "Ma note sur 10 mesure cette solidité : rentabilité, croissance du cash, marges, rachats d'actions, dette. Ces quatre-là cochent l'ensemble des cases. La vraie question n'est donc pas laquelle est la meilleure entreprise, mais laquelle se paie au meilleur prix.",
        },
        { type: 'h2', text: "Le comparatif, qualité égale, prix différents" },
        {
          type: 'p',
          text: "Pour comparer le prix, j'utilise le P/FCF (price-to-free-cash-flow) : le cours divisé par le free cash flow annuel. Un P/FCF de 13 veut dire que tu paies treize années de ce cash. Voici les quatre, du moins cher au plus cher :",
        },
        {
          type: 'ul',
          items: [
            "Salesforce (CRM) : environ 13 fois le free cash flow. Le géant du CRM, en pleine bascule vers les agents IA. Croissance autour de 12 %/an.",
            "Intuit (INTU) : environ 13 à 14 fois. TurboTax et QuickBooks, un quasi-monopole sur la compta et les impôts des PME américaines. Croissance proche de 15 %/an, la plus rapide du lot.",
            "Roper (ROP) : environ 14 fois. Un assembleur de logiciels de niche, très diversifié, peu connu du grand public mais redoutablement régulier.",
            "Bentley (BSY) : près de 24 fois. Les logiciels d'ingénierie pour les infrastructures (ponts, réseaux, usines). La plus chère, parce que la plus protégée.",
          ],
        },
        { type: 'h2', text: "Pourquoi Bentley se paie deux fois plus cher" },
        {
          type: 'p',
          text: "Un P/FCF de 24 contre 13, c'est presque le double. Est-ce que Bentley est deux fois moins intéressante ? Pas forcément. Le marché paie cher ce qu'il juge le plus durable. Bentley vend des logiciels que des ingénieurs utilisent sur des projets longs de dix ou vingt ans. Le coût pour en changer est gigantesque. C'est ce qu'on appelle un moat, un fossé concurrentiel : ce qui empêche un rival de prendre la place. Plus le moat est solide, plus le marché accepte de payer cher.",
        },
        {
          type: 'p',
          text: "À l'inverse, Salesforce est moins chère parce que sa croissance ralentit et que la concurrence dans le logiciel d'entreprise est féroce. Le marché doute un peu plus, donc il paie un peu moins. Le prix n'est pas un hasard, il raconte les peurs et les espoirs du moment.",
        },
        { type: 'h2', text: "Laquelle choisir ?" },
        {
          type: 'p',
          text: "Il n'y a pas de réponse unique, parce que prix bas ne veut pas dire meilleure affaire. Si tu cherches la décote maximale sur une qualité solide, Salesforce et Intuit sont les plus intéressantes sur le papier. Si tu privilégies la prévisibilité et que tu acceptes de payer plus cher pour dormir tranquille, Bentley se défend. Le bon réflexe n'est pas de prendre la moins chère, mais de te demander pour chacune si la qualité justifie son prix.",
        },
        {
          type: 'p',
          text: "C'est exactement le travail que je voulais pouvoir faire en quelques secondes, alors je l'ai codé. Tu peux voir le détail de chaque entreprise sur sa page d'analyse, par exemple [Intuit](/analyse/INTU), [Salesforce](/analyse/CRM) ou [Bentley](/analyse/BSY), et le [classement des actions sous-évaluées](/classement/sous-evaluees). Ma [méthodologie complète](/methodologie) explique chaque critère.",
        },
      ],
      faq: [
        {
          q: "Pourquoi quatre éditeurs ont-ils la même note de 10/10 ?",
          a: "Parce que ma note mesure la solidité financière objective (rentabilité, cash, marges, dette), pas le prix. Quatre entreprises peuvent être également solides comme business tout en se payant des prix très différents en bourse.",
        },
        {
          q: "Faut-il acheter la moins chère, Salesforce ?",
          a: "Pas automatiquement. Un P/FCF plus bas peut refléter des doutes du marché sur la croissance. La moins chère n'est la meilleure affaire que si sa qualité tient. Compare toujours le prix à la solidité, pas dans l'absolu.",
        },
        {
          q: "Pourquoi Bentley est-elle la plus chère ?",
          a: "Parce que son moat est jugé très solide : ses logiciels d'ingénierie sont utilisés sur des projets d'infrastructure de très long terme, avec un coût de changement énorme. Le marché paie cher cette durabilité perçue.",
        },
        {
          q: "Le logiciel est-il toujours un bon secteur d'investissement ?",
          a: "C'est un secteur à marges élevées et revenus récurrents, donc structurellement attractif. Mais cela ne garantit aucun prix d'entrée raisonnable. Ceci n'est pas un conseil en investissement, fais tes propres recherches.",
        },
      ],
      tags: ['Palmarès', 'Software', 'Comparatif', 'Valorisation'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 12 juin 2026, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: "Best software stocks: four names rated 10/10",
      excerpt:
        "Intuit, Roper, Salesforce, Bentley: four software makers rated 10/10 on my grid. Same quality, very different valuations. The comparison.",
      metaDescription:
        "INTU, ROP, CRM and BSY all score 10/10 on my quality grid, but P/FCF ranges from 13 to 24. Which software stock offers the best quality for the price?",
      answer:
        "Intuit, Roper, Salesforce and Bentley all earn the top score on my quality grid. But their valuations range from single to nearly double: Salesforce trades at about 13 times its cash, Bentley near 24. Same quality does not mean same price. Here is how I tell them apart.",
      body: [
        {
          type: 'ul',
          items: [
            "Four makers rated 10/10: Intuit (INTU), Roper (ROP), Salesforce (CRM), Bentley (BSY).",
            "Salesforce is the cheapest: about 13 times its free cash flow.",
            "Intuit and Roper follow, around 13 to 14 times.",
            "Bentley is the most expensive, near 24 times, because its quality is priced in.",
            "All generate over 25 % free cash flow margin: true cash machines.",
          ],
        },
        { type: 'h2', text: "Why software dominates my quality selection" },
        {
          type: 'p',
          text: "Software is the most represented sector at the top of my ranking, and that is no accident. A good maker sells a subscription, collected upfront, with near-zero marginal cost to serve one more customer. The result: huge margins and lots of cash. Free cash flow is the money that truly remains once every bill is paid. All four companies here generate over 25 % of their sales as free cash flow.",
        },
        {
          type: 'p',
          text: "My score out of 10 measures that soundness: profitability, cash growth, margins, buybacks, debt. These four tick every box. So the real question is not which is the best company, but which trades at the best price.",
        },
        { type: 'h2', text: "The comparison, equal quality, different prices" },
        {
          type: 'p',
          text: "To compare price, I use P/FCF (price-to-free-cash-flow): the share price divided by annual free cash flow. A P/FCF of 13 means you pay thirteen years of that cash. Here are the four, cheapest to priciest:",
        },
        {
          type: 'ul',
          items: [
            "Salesforce (CRM): about 13 times free cash flow. The CRM giant, mid-pivot toward AI agents. Growth around 12 % a year.",
            "Intuit (INTU): about 13 to 14 times. TurboTax and QuickBooks, a near-monopoly on US small-business accounting and taxes. Growth close to 15 % a year, the fastest of the group.",
            "Roper (ROP): about 14 times. A collector of niche software businesses, highly diversified, little known to the public but remarkably steady.",
            "Bentley (BSY): near 24 times. Engineering software for infrastructure (bridges, networks, plants). The priciest, because the most protected.",
          ],
        },
        { type: 'h2', text: "Why Bentley trades at twice the price" },
        {
          type: 'p',
          text: "A P/FCF of 24 versus 13 is almost double. Is Bentley half as interesting? Not necessarily. The market pays up for what it deems most durable. Bentley sells software that engineers use on projects lasting ten or twenty years. The cost to switch is enormous. That is a moat, a competitive gap: what stops a rival from taking its place. The stronger the moat, the more the market is willing to pay.",
        },
        {
          type: 'p',
          text: "Conversely, Salesforce is cheaper because its growth is slowing and competition in enterprise software is fierce. The market doubts a bit more, so it pays a bit less. Price is not random, it tells the fears and hopes of the moment.",
        },
        { type: 'h2', text: "Which one to choose?" },
        {
          type: 'p',
          text: "There is no single answer, because a low price does not mean the best deal. If you want the deepest discount on solid quality, Salesforce and Intuit look most interesting on paper. If you favor predictability and accept paying more to sleep easy, Bentley holds up. The right reflex is not to grab the cheapest, but to ask, for each one, whether the quality justifies its price.",
        },
        {
          type: 'p',
          text: "That is exactly the work I wanted to do in seconds, so I coded it. You can see the detail of each company on its analysis page, for example [Intuit](/analyse/INTU), [Salesforce](/analyse/CRM) or [Bentley](/analyse/BSY), and the [ranking of undervalued stocks](/classement/sous-evaluees). My [full methodology](/methodologie) explains every criterion.",
        },
      ],
      faq: [
        {
          q: "Why do four makers share the same 10/10 score?",
          a: "Because my score measures objective financial soundness (profitability, cash, margins, debt), not price. Four companies can be equally solid as businesses while trading at very different prices on the market.",
        },
        {
          q: "Should you buy the cheapest, Salesforce?",
          a: "Not automatically. A lower P/FCF can reflect market doubts about growth. The cheapest is only the best deal if its quality holds. Always compare price to soundness, not in absolute terms.",
        },
        {
          q: "Why is Bentley the most expensive?",
          a: "Because its moat is seen as very strong: its engineering software is used on very long-term infrastructure projects, with an enormous switching cost. The market pays up for that perceived durability.",
        },
        {
          q: "Is software always a good sector to invest in?",
          a: "It is a high-margin, recurring-revenue sector, so structurally attractive. But that guarantees no reasonable entry price. This is not investment advice, do your own research.",
        },
      ],
      tags: ['Ranking', 'Software', 'Comparison', 'Valuation'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 12, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "Mejores acciones de software: cuatro 10/10",
      excerpt:
        "Intuit, Roper, Salesforce, Bentley: cuatro empresas de software con 10/10 en mi rejilla. Misma calidad, valoraciones muy distintas. El comparativo.",
      metaDescription:
        "INTU, ROP, CRM y BSY sacan 10/10 en mi rejilla de calidad, pero con P/FCF de 13 a 24. ¿Qué acción de software ofrece la mejor calidad por su precio?",
      answer:
        "Intuit, Roper, Salesforce y Bentley obtienen la nota máxima en mi rejilla de calidad. Pero sus valoraciones van de lo sencillo a casi el doble: Salesforce cotiza a unas 13 veces su caja, Bentley cerca de 24. Misma calidad no significa mismo precio. Así las distingo.",
      body: [
        {
          type: 'ul',
          items: [
            "Cuatro empresas con 10/10: Intuit (INTU), Roper (ROP), Salesforce (CRM), Bentley (BSY).",
            "Salesforce es la más barata: unas 13 veces su free cash flow.",
            "Intuit y Roper siguen, alrededor de 13 a 14 veces.",
            "Bentley es la más cara, cerca de 24 veces, porque su calidad se paga.",
            "Todas generan más del 25 % de margen de free cash flow: máquinas de caja.",
          ],
        },
        { type: 'h2', text: "Por qué el software domina mi selección de calidad" },
        {
          type: 'p',
          text: "El software es el sector más representado en lo alto de mi clasificación, y no es casualidad. Una buena empresa vende una suscripción, cobrada por adelantado, con un coste marginal casi nulo para servir a un cliente más. El resultado: márgenes enormes y mucha caja. El free cash flow es el dinero que de verdad queda una vez pagadas todas las facturas. Las cuatro empresas de este comparativo generan más del 25 % de sus ventas en free cash flow.",
        },
        {
          type: 'p',
          text: "Mi nota sobre 10 mide esa solidez: rentabilidad, crecimiento de la caja, márgenes, recompras, deuda. Estas cuatro cumplen todas las casillas. Así que la verdadera pregunta no es cuál es la mejor empresa, sino cuál cotiza al mejor precio.",
        },
        { type: 'h2', text: "El comparativo, igual calidad, distinto precio" },
        {
          type: 'p',
          text: "Para comparar el precio uso el P/FCF (price-to-free-cash-flow): la cotización dividida por el free cash flow anual. Un P/FCF de 13 significa que pagas trece años de esa caja. Aquí están las cuatro, de la más barata a la más cara:",
        },
        {
          type: 'ul',
          items: [
            "Salesforce (CRM): unas 13 veces el free cash flow. El gigante del CRM, en plena transición hacia los agentes de IA. Crecimiento en torno al 12 % anual.",
            "Intuit (INTU): unas 13 a 14 veces. TurboTax y QuickBooks, un casi monopolio en la contabilidad y los impuestos de las pymes de EE. UU. Crecimiento cercano al 15 % anual, el más rápido del grupo.",
            "Roper (ROP): unas 14 veces. Un ensamblador de software de nicho, muy diversificado, poco conocido por el público pero notablemente regular.",
            "Bentley (BSY): cerca de 24 veces. Software de ingeniería para infraestructuras (puentes, redes, plantas). La más cara, porque la más protegida.",
          ],
        },
        { type: 'h2', text: "Por qué Bentley cotiza al doble de precio" },
        {
          type: 'p',
          text: "Un P/FCF de 24 frente a 13 es casi el doble. ¿Es Bentley la mitad de interesante? No necesariamente. El mercado paga caro lo que considera más duradero. Bentley vende software que los ingenieros usan en proyectos de diez o veinte años. El coste de cambiar es gigantesco. Eso es un moat, un foso competitivo: lo que impide a un rival ocupar su lugar. Cuanto más sólido el foso, más acepta pagar el mercado.",
        },
        {
          type: 'p',
          text: "A la inversa, Salesforce es más barata porque su crecimiento se ralentiza y la competencia en software empresarial es feroz. El mercado duda un poco más, así que paga un poco menos. El precio no es aleatorio, cuenta los miedos y las esperanzas del momento.",
        },
        { type: 'h2', text: "¿Cuál elegir?" },
        {
          type: 'p',
          text: "No hay una única respuesta, porque precio bajo no significa mejor negocio. Si buscas el mayor descuento sobre una calidad sólida, Salesforce e Intuit parecen las más interesantes sobre el papel. Si prefieres la previsibilidad y aceptas pagar más por dormir tranquilo, Bentley se defiende. El reflejo correcto no es coger la más barata, sino preguntarte, para cada una, si la calidad justifica su precio.",
        },
        {
          type: 'p',
          text: "Es justo el trabajo que quería poder hacer en segundos, así que lo programé. Puedes ver el detalle de cada empresa en su página de análisis, por ejemplo [Intuit](/analyse/INTU), [Salesforce](/analyse/CRM) o [Bentley](/analyse/BSY), y el [ranking de acciones infravaloradas](/classement/sous-evaluees). Mi [metodología completa](/methodologie) explica cada criterio.",
        },
      ],
      faq: [
        {
          q: "¿Por qué cuatro empresas comparten el mismo 10/10?",
          a: "Porque mi nota mide la solidez financiera objetiva (rentabilidad, caja, márgenes, deuda), no el precio. Cuatro empresas pueden ser igual de sólidas como negocio y cotizar a precios muy distintos en bolsa.",
        },
        {
          q: "¿Hay que comprar la más barata, Salesforce?",
          a: "No automáticamente. Un P/FCF más bajo puede reflejar dudas del mercado sobre el crecimiento. La más barata solo es el mejor negocio si su calidad aguanta. Compara siempre el precio con la solidez, no en absoluto.",
        },
        {
          q: "¿Por qué Bentley es la más cara?",
          a: "Porque su foso se considera muy sólido: su software de ingeniería se usa en proyectos de infraestructura de muy largo plazo, con un coste de cambio enorme. El mercado paga caro esa durabilidad percibida.",
        },
        {
          q: "¿El software es siempre un buen sector para invertir?",
          a: "Es un sector de márgenes altos e ingresos recurrentes, así que estructuralmente atractivo. Pero eso no garantiza ningún precio de entrada razonable. Esto no es asesoramiento de inversión, haz tu propia investigación.",
        },
      ],
      tags: ['Ranking', 'Software', 'Comparativo', 'Valoración'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 12 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};

const dataSecteurs: Article = {
  slug: 'etude-secteurs-actions-10-sur-10-juin-2026',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 8,
  content: {
    fr: {
      title: "Actions 10/10 : les 3 secteurs qui dominent en 2026",
      excerpt:
        "Sur des milliers d'actions analysées, à peine 60 décrochent la note parfaite. Et trois secteurs en concentrent l'essentiel. Ce que ça dit du marché.",
      metaDescription:
        "Sur des milliers d'actions, environ 60 obtiennent 10/10 à ma grille. Assurance, logiciel et finance dominent. L'étude data des secteurs de qualité en 2026.",
      answer:
        "Sur les milliers d'actions que j'analyse, à peine une soixantaine obtient la note maximale de qualité. Trois secteurs en concentrent l'essentiel : l'assurance, le logiciel et la finance. Ce n'est pas un hasard, c'est lié à la façon dont ces métiers génèrent du cash. Voici ce que cette concentration révèle.",
      body: [
        {
          type: 'ul',
          items: [
            "Environ 60 actions seulement obtiennent 10/10 sur des milliers analysées : la qualité parfaite est rare.",
            "Trois secteurs dominent largement : assurance, logiciel, finance.",
            "Le logiciel et l'assurance sont les deux plus représentés.",
            "Point commun : ces métiers encaissent du cash d'avance et le réinvestissent.",
            "Mais qualité élevée ne dit rien du prix : certains de ces secteurs sont chers, d'autres bradés.",
          ],
        },
        { type: 'h2', text: "La qualité parfaite est plus rare qu'on ne croit" },
        {
          type: 'p',
          text: "Quand j'analyse l'ensemble du marché, la première leçon est humble : la qualité irréprochable est rare. Sur des milliers d'entreprises passées au crible, à peine une soixantaine obtient ma note maximale, 10 sur 10. Cette note ne récompense pas une action à la mode. Elle valide un profil financier objectif : rentabilité, croissance du cash, marges, rachats d'actions, dette maîtrisée. La plupart des entreprises échouent sur au moins un de ces critères.",
        },
        {
          type: 'p',
          text: "La deuxième leçon est plus intéressante : ces rares élues ne sont pas réparties au hasard. Elles se concentrent dans une poignée de secteurs.",
        },
        { type: 'h2', text: "Les trois secteurs qui raflent la mise" },
        {
          type: 'p',
          text: "Trois familles dominent nettement le haut de mon classement : l'assurance, le logiciel et la finance. À elles trois, elles rassemblent la majeure partie des actions notées 10/10. Le logiciel et l'assurance sont les deux plus présents, suivis par divers métiers de la finance.",
        },
        {
          type: 'p',
          text: "Pourquoi ces trois-là ? Parce qu'ils partagent une mécanique : ils encaissent de l'argent avant de le dépenser, et le font travailler entre-temps. Un assureur touche des primes aujourd'hui et paiera des sinistres plus tard. Un éditeur de logiciels facture un abonnement d'avance, avec un coût quasi nul pour servir un client de plus. Une société financière fait tourner du capital. Dans les trois cas, le free cash flow (l'argent qui reste vraiment une fois les factures payées) est structurellement abondant.",
        },
        { type: 'h2', text: "Ce que la concentration ne dit pas" },
        {
          type: 'p',
          text: "Attention au piège. Savoir qu'un secteur concentre des entreprises de qualité ne te dit rien sur leur prix. Et c'est là que ça devient passionnant, parce que ces trois secteurs ne sont pas valorisés pareil.",
        },
        {
          type: 'p',
          text: "Le logiciel est souvent cher : le marché adore ses marges, donc il paie d'avance. L'assurance, au contraire, est souvent bradée : le métier est aride, mal compris, exposé aux catastrophes, donc délaissé. On trouve des assureurs notés 10/10 qui se paient moins de 5 fois leur free cash flow, là où des éditeurs de logiciels équivalents en qualité se paient 3 ou 4 fois plus cher.",
        },
        { type: 'h2', text: "Ce que j'en fais, concrètement" },
        {
          type: 'p',
          text: "Cette carte des secteurs me sert de boussole. Elle me dit où chercher des entreprises solides. Mais je ne m'arrête jamais là. Une fois la qualité repérée, je pose la deuxième question, toujours séparée : à quel prix ? C'est cette double grille, la qualité d'abord, le prix ensuite, qui sépare une bonne idée d'un bon investissement.",
        },
        {
          type: 'p',
          text: "C'est exactement ce que je voulais pouvoir faire en quelques secondes pour n'importe quelle action, alors je l'ai construit. Tu peux explorer le [classement des entreprises notées 10 sur 10](/classement/qualite-10-sur-10), celui des [actions sous-évaluées](/classement/sous-evaluees), et lire ma [méthodologie complète](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Combien d'actions obtiennent 10/10 ?",
          a: "À peine une soixantaine sur les milliers que j'analyse. La note maximale est rare car elle exige un profil financier solide sur l'ensemble de mes critères objectifs, sans point faible majeur.",
        },
        {
          q: "Pourquoi l'assurance et le logiciel dominent-ils ?",
          a: "Parce que ces métiers encaissent du cash d'avance (primes, abonnements) et le réinvestissent, ce qui produit structurellement beaucoup de free cash flow. C'est exactement ce que ma grille de qualité récompense.",
        },
        {
          q: "Un secteur de qualité est-il forcément un bon investissement ?",
          a: "Non. La qualité du secteur ne dit rien du prix. Le logiciel est souvent cher, l'assurance souvent bradée. Il faut toujours croiser la qualité avec la valorisation avant de conclure.",
        },
        {
          q: "Comment utiliser cette étude ?",
          a: "Comme une boussole pour savoir où chercher des entreprises solides, puis vérifier le prix de chacune. Ceci n'est pas un conseil en investissement personnalisé, fais tes propres recherches.",
        },
      ],
      tags: ['Étude', 'Secteurs', 'Qualité', 'Données'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 12 juin 2026, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: "10/10 stocks: the 3 sectors that dominate in 2026",
      excerpt:
        "Out of thousands of stocks analyzed, barely 60 earn the perfect score. And three sectors hold most of them. What that says about the market.",
      metaDescription:
        "Out of thousands of stocks, about 60 score 10/10 on my grid. Insurance, software and finance dominate. The data study of quality sectors in 2026.",
      answer:
        "Out of the thousands of stocks I analyze, barely sixty earn the top quality score. Three sectors hold most of them: insurance, software and finance. That is no accident, it is tied to how these businesses generate cash. Here is what that concentration reveals.",
      body: [
        {
          type: 'ul',
          items: [
            "Only about 60 stocks score 10/10 out of thousands analyzed: perfect quality is rare.",
            "Three sectors clearly dominate: insurance, software, finance.",
            "Software and insurance are the two most represented.",
            "Common thread: these businesses collect cash upfront and reinvest it.",
            "But high quality says nothing about price: some of these sectors are expensive, others dirt cheap.",
          ],
        },
        { type: 'h2', text: "Perfect quality is rarer than you think" },
        {
          type: 'p',
          text: "When I analyze the whole market, the first lesson is humbling: flawless quality is rare. Out of thousands of companies screened, barely sixty earn my top score, 10 out of 10. That score does not reward a trendy stock. It validates an objective financial profile: profitability, cash growth, margins, buybacks, controlled debt. Most companies fail on at least one of these criteria.",
        },
        {
          type: 'p',
          text: "The second lesson is more interesting: these rare winners are not spread at random. They cluster in a handful of sectors.",
        },
        { type: 'h2', text: "The three sectors that take the prize" },
        {
          type: 'p',
          text: "Three families clearly dominate the top of my ranking: insurance, software and finance. Together they hold most of the stocks rated 10/10. Software and insurance are the two most present, followed by various finance businesses.",
        },
        {
          type: 'p',
          text: "Why those three? Because they share one mechanic: they collect money before spending it, and put it to work in the meantime. An insurer takes premiums today and pays claims later. A software maker bills a subscription upfront, with near-zero cost to serve one more customer. A financial firm turns capital. In all three, free cash flow (the money that truly remains once bills are paid) is structurally abundant.",
        },
        { type: 'h2', text: "What the concentration does not tell you" },
        {
          type: 'p',
          text: "Beware the trap. Knowing that a sector concentrates quality companies tells you nothing about their price. And that is where it gets fascinating, because these three sectors are not valued the same.",
        },
        {
          type: 'p',
          text: "Software is often expensive: the market loves its margins, so it pays in advance. Insurance, by contrast, is often dirt cheap: the business is dry, poorly understood, exposed to disasters, hence neglected. You find insurers rated 10/10 trading at under 5 times their free cash flow, while software makers of equal quality trade at 3 or 4 times that price.",
        },
        { type: 'h2', text: "What I actually do with this" },
        {
          type: 'p',
          text: "This sector map is my compass. It tells me where to look for solid companies. But I never stop there. Once quality is spotted, I ask the second question, always separate: at what price? It is this double grid, quality first, price second, that separates a good idea from a good investment.",
        },
        {
          type: 'p',
          text: "That is exactly what I wanted to do in seconds for any stock, so I built it. You can explore the [ranking of companies rated 10 out of 10](/classement/qualite-10-sur-10), the one for [undervalued stocks](/classement/sous-evaluees), and read my [full methodology](/methodologie).",
        },
      ],
      faq: [
        {
          q: "How many stocks score 10/10?",
          a: "Barely sixty out of the thousands I analyze. The top score is rare because it requires a solid financial profile across all my objective criteria, with no major weak spot.",
        },
        {
          q: "Why do insurance and software dominate?",
          a: "Because these businesses collect cash upfront (premiums, subscriptions) and reinvest it, which structurally produces a lot of free cash flow. That is exactly what my quality grid rewards.",
        },
        {
          q: "Is a quality sector necessarily a good investment?",
          a: "No. Sector quality says nothing about price. Software is often expensive, insurance often cheap. You must always cross quality with valuation before concluding.",
        },
        {
          q: "How should I use this study?",
          a: "As a compass for where to look for solid companies, then check each one's price. This is not personalized investment advice, do your own research.",
        },
      ],
      tags: ['Study', 'Sectors', 'Quality', 'Data'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 12, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "Acciones 10/10: los 3 sectores que dominan en 2026",
      excerpt:
        "De miles de acciones analizadas, apenas 60 logran la nota perfecta. Y tres sectores concentran la mayoría. Lo que dice del mercado.",
      metaDescription:
        "De miles de acciones, unas 60 sacan 10/10 en mi rejilla. Seguros, software y finanzas dominan. El estudio de datos de los sectores de calidad en 2026.",
      answer:
        "De los miles de acciones que analizo, apenas unas sesenta logran la nota máxima de calidad. Tres sectores concentran la mayoría: seguros, software y finanzas. No es casualidad, está ligado a cómo estos negocios generan caja. Esto es lo que revela esa concentración.",
      body: [
        {
          type: 'ul',
          items: [
            "Solo unas 60 acciones sacan 10/10 de entre miles analizadas: la calidad perfecta es rara.",
            "Tres sectores dominan ampliamente: seguros, software, finanzas.",
            "El software y los seguros son los dos más representados.",
            "Punto en común: estos negocios cobran caja por adelantado y la reinvierten.",
            "Pero calidad alta no dice nada del precio: algunos de estos sectores son caros, otros están regalados.",
          ],
        },
        { type: 'h2', text: "La calidad perfecta es más rara de lo que se cree" },
        {
          type: 'p',
          text: "Cuando analizo todo el mercado, la primera lección es humilde: la calidad impecable es rara. De miles de empresas filtradas, apenas unas sesenta logran mi nota máxima, 10 sobre 10. Esa nota no premia una acción de moda. Valida un perfil financiero objetivo: rentabilidad, crecimiento de la caja, márgenes, recompras, deuda controlada. La mayoría de las empresas fallan en al menos uno de esos criterios.",
        },
        {
          type: 'p',
          text: "La segunda lección es más interesante: esas raras elegidas no están repartidas al azar. Se concentran en un puñado de sectores.",
        },
        { type: 'h2', text: "Los tres sectores que se llevan el premio" },
        {
          type: 'p',
          text: "Tres familias dominan claramente lo alto de mi clasificación: seguros, software y finanzas. Entre las tres reúnen la mayor parte de las acciones con 10/10. El software y los seguros son los dos más presentes, seguidos de diversos negocios financieros.",
        },
        {
          type: 'p',
          text: "¿Por qué esos tres? Porque comparten una mecánica: cobran dinero antes de gastarlo, y lo ponen a trabajar mientras tanto. Una aseguradora cobra primas hoy y pagará siniestros más tarde. Una empresa de software factura una suscripción por adelantado, con un coste casi nulo para servir a un cliente más. Una firma financiera hace girar capital. En los tres casos, el free cash flow (el dinero que de verdad queda una vez pagadas las facturas) es estructuralmente abundante.",
        },
        { type: 'h2', text: "Lo que la concentración no dice" },
        {
          type: 'p',
          text: "Cuidado con la trampa. Saber que un sector concentra empresas de calidad no dice nada de su precio. Y ahí es donde se vuelve apasionante, porque estos tres sectores no se valoran igual.",
        },
        {
          type: 'p',
          text: "El software suele ser caro: al mercado le encantan sus márgenes, así que paga por adelantado. Los seguros, en cambio, suelen estar regalados: el negocio es árido, mal comprendido, expuesto a catástrofes, y por eso abandonado. Hay aseguradoras con 10/10 que cotizan a menos de 5 veces su free cash flow, mientras empresas de software de igual calidad cotizan a 3 o 4 veces ese precio.",
        },
        { type: 'h2', text: "Qué hago con esto, en concreto" },
        {
          type: 'p',
          text: "Este mapa de sectores me sirve de brújula. Me dice dónde buscar empresas sólidas. Pero nunca me detengo ahí. Una vez detectada la calidad, hago la segunda pregunta, siempre separada: ¿a qué precio? Es esa doble rejilla, la calidad primero, el precio después, la que separa una buena idea de una buena inversión.",
        },
        {
          type: 'p',
          text: "Es justo lo que quería poder hacer en segundos para cualquier acción, así que lo construí. Puedes explorar el [ranking de empresas calificadas 10 sobre 10](/classement/qualite-10-sur-10), el de [acciones infravaloradas](/classement/sous-evaluees), y leer mi [metodología completa](/methodologie).",
        },
      ],
      faq: [
        {
          q: "¿Cuántas acciones sacan 10/10?",
          a: "Apenas unas sesenta de los miles que analizo. La nota máxima es rara porque exige un perfil financiero sólido en el conjunto de mis criterios objetivos, sin un punto débil mayor.",
        },
        {
          q: "¿Por qué dominan los seguros y el software?",
          a: "Porque estos negocios cobran caja por adelantado (primas, suscripciones) y la reinvierten, lo que produce estructuralmente mucho free cash flow. Es justo lo que premia mi rejilla de calidad.",
        },
        {
          q: "¿Un sector de calidad es siempre una buena inversión?",
          a: "No. La calidad del sector no dice nada del precio. El software suele ser caro, los seguros suelen estar baratos. Hay que cruzar siempre la calidad con la valoración antes de concluir.",
        },
        {
          q: "¿Cómo usar este estudio?",
          a: "Como una brújula para saber dónde buscar empresas sólidas, y luego comprobar el precio de cada una. Esto no es asesoramiento de inversión personalizado, haz tu propia investigación.",
        },
      ],
      tags: ['Estudio', 'Sectores', 'Calidad', 'Datos'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 12 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};

const bkng: Article = {
  slug: 'booking-holdings-bkng-analyse-action-10-sur-10',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 8,
  ticker: 'BKNG',
  content: {
    fr: {
      title: "Booking Holdings (BKNG) : analyse d'une action 10/10",
      excerpt:
        "Derrière Booking.com se cache une des plus belles machines à cash de la cote. Notée 10/10, payée 15 fois son free cash flow. Mon analyse alors que le voyage repart.",
      metaDescription:
        "Booking Holdings (BKNG) obtient 10/10 à ma grille, avec un P/FCF d'environ 15. Croissance forte, marges énormes : mon analyse alors que le voyage reprend.",
      answer:
        "Booking Holdings, la maison mère de Booking.com, obtient la note maximale à ma grille de qualité : croissance forte, marges énormes, rachats d'actions massifs. Elle se paie environ 15 fois son free cash flow, ni bradée ni excessive. Alors que le voyage mondial repart, voici pourquoi cette action mérite le coup d'oeil, et ses risques.",
      body: [
        {
          type: 'ul',
          items: [
            "Note de qualité : 10/10 à ma grille de critères fondamentaux.",
            "Croissance des ventes forte, autour de 22 %/an, rare à cette taille.",
            "Marge de free cash flow de 30 % : une machine à cash.",
            "Le cash par action grimpe d'environ 33 %/an, dopé par d'énormes rachats d'actions.",
            "Valorisation moyenne : environ 15 fois le free cash flow, ni cadeau ni excès.",
          ],
        },
        { type: 'h2', text: "Bien plus que Booking.com" },
        {
          type: 'p',
          text: "Tout le monde connaît Booking.com pour réserver un hôtel. Peu de gens réalisent que derrière se cache un empire : Booking Holdings, qui possède aussi Priceline, Agoda, Kayak, et le service de réservation de restaurants OpenTable. C'est la plus grande agence de voyage en ligne au monde, de très loin.",
        },
        {
          type: 'p',
          text: "Son modèle est presque magique sur le plan financier. Booking ne possède ni hôtel ni avion. Elle met en relation des voyageurs et des hébergeurs, et prend une commission au passage. Pas d'actifs lourds, peu de coûts fixes : presque chaque euro de commission supplémentaire tombe en cash. C'est ce qui explique des marges que peu d'entreprises atteignent.",
        },
        { type: 'h2', text: "Pourquoi ma grille lui met 10/10" },
        {
          type: 'p',
          text: "Ma note sur 10 mesure la solidité financière objective : rentabilité, croissance du cash, marges, rachats d'actions, dette. Booking excelle partout. Sa marge de free cash flow atteint 30 %. Le free cash flow, c'est l'argent qui reste vraiment une fois toutes les factures payées. Trente pour cent, ça veut dire que sur 100 euros de ventes, 30 finissent en cash disponible.",
        },
        {
          type: 'p',
          text: "Plus rare encore : malgré sa taille, l'entreprise croît toujours d'environ 22 % par an. Et elle rachète ses propres actions à un rythme soutenu, près de 6 % du total chaque année. Quand le nombre d'actions baisse, chaque action restante pèse davantage. C'est pour ça que son cash par action progresse encore plus vite que ses ventes, autour de 33 % par an.",
        },
        { type: 'h2', text: "L'angle du moment : le voyage repart" },
        {
          type: 'p',
          text: "Le contexte ajoute du piquant. Le voyage international retrouve des couleurs, et Booking est la mieux placée pour en profiter : plus de voyageurs, plus de réservations, plus de commissions. Quand une entreprise déjà dominante surfe sur un vent porteur, les volumes peuvent surprendre à la hausse.",
        },
        {
          type: 'p',
          text: "Mais c'est aussi son risque. Le voyage est cyclique : il monte fort dans les bonnes périodes, et se contracte vite en cas de récession, de tensions géopolitiques ou de choc sanitaire. Une part des résultats actuels reflète une reprise qui ne durera pas éternellement à ce rythme. À garder en tête avant de se projeter.",
        },
        { type: 'h2', text: "Est-ce le bon prix ?" },
        {
          type: 'p',
          text: "C'est ma deuxième question, toujours séparée de la qualité. Pour mesurer le prix, je regarde le P/FCF (price-to-free-cash-flow) : le cours divisé par le free cash flow annuel. Booking se paie environ 15 fois son free cash flow. Ce n'est ni bradé, ni excessif. Pour une entreprise qui croît à 22 % avec des marges pareilles, c'est même plutôt raisonnable au regard de sa qualité.",
        },
        {
          type: 'p',
          text: "Le vrai débat, c'est la durabilité de la croissance. Si le voyage continue de progresser, 15 fois le cash est un prix correct pour un leader. Si la reprise s'essouffle, le multiple peut se contracter. Comme toujours, le prix bas ou moyen n'est intéressant que si la qualité tient. C'est cette double lecture que je voulais pouvoir faire en quelques secondes, alors je l'ai codée. Vois le détail sur la [page d'analyse de Booking](/analyse/BKNG), le [classement des actions sous-évaluées](/classement/sous-evaluees) et ma [méthodologie](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Que possède Booking Holdings exactement ?",
          a: "Booking.com, Priceline, Agoda, Kayak et OpenTable. C'est la plus grande agence de voyage en ligne au monde, présente sur l'hôtellerie, les vols, les locations et la réservation de restaurants.",
        },
        {
          q: "Pourquoi ses marges sont-elles si élevées ?",
          a: "Parce que Booking ne possède ni hôtel ni avion. Elle met en relation voyageurs et hébergeurs contre une commission, sans actifs lourds. Presque chaque commission supplémentaire tombe en cash, d'où une marge de free cash flow d'environ 30 %.",
        },
        {
          q: "Un P/FCF de 15 est-il cher ?",
          a: "C'est une valorisation moyenne, ni bradée ni excessive. Pour une entreprise qui croît à 22 % par an avec de telles marges, c'est plutôt raisonnable au regard de sa qualité, à condition que la croissance du voyage se poursuive.",
        },
        {
          q: "Faut-il acheter l'action Booking Holdings ?",
          a: "Ça dépend de ta vision sur la durabilité de la reprise du voyage et de ta discipline de prix, car le secteur est cyclique. Ceci n'est pas un conseil en investissement personnalisé, fais tes propres recherches.",
        },
      ],
      tags: ['Analyse', 'Booking', 'Voyage', 'Valorisation'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 12 juin 2026, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: "Booking Holdings (BKNG): a 10/10 stock, explained",
      excerpt:
        "Behind Booking.com sits one of the finest cash machines on the market. Rated 10/10, priced at 15 times free cash flow. My analysis as travel rebounds.",
      metaDescription:
        "Booking Holdings (BKNG) scores 10/10 on my grid, at a P/FCF near 15. Strong growth, huge margins: my analysis as global travel recovers.",
      answer:
        "Booking Holdings, the parent of Booking.com, earns the top score on my quality grid: strong growth, huge margins, heavy buybacks. It trades at about 15 times its free cash flow, neither cheap nor excessive. As global travel rebounds, here is why this stock is worth a look, and its risks.",
      body: [
        {
          type: 'ul',
          items: [
            "Quality score: 10/10 on my fundamental grid.",
            "Strong sales growth, around 22 % a year, rare at this size.",
            "Free cash flow margin of 30 %: a cash machine.",
            "Cash per share climbs about 33 % a year, fueled by huge buybacks.",
            "Mid valuation: about 15 times free cash flow, neither a gift nor excess.",
          ],
        },
        { type: 'h2', text: "Far more than Booking.com" },
        {
          type: 'p',
          text: "Everyone knows Booking.com to book a hotel. Few realize there is an empire behind it: Booking Holdings, which also owns Priceline, Agoda, Kayak, and the restaurant reservation service OpenTable. It is by far the largest online travel agency in the world.",
        },
        {
          type: 'p',
          text: "Its model is almost magical financially. Booking owns no hotel and no plane. It connects travelers with hosts and takes a commission along the way. No heavy assets, few fixed costs: nearly every extra euro of commission drops to cash. That explains margins few companies reach.",
        },
        { type: 'h2', text: "Why my grid gives it 10/10" },
        {
          type: 'p',
          text: "My score out of 10 measures objective financial soundness: profitability, cash growth, margins, buybacks, debt. Booking excels everywhere. Its free cash flow margin reaches 30 %. Free cash flow is the money that truly remains once every bill is paid. Thirty percent means that out of 100 euros of sales, 30 end up as available cash.",
        },
        {
          type: 'p',
          text: "Rarer still: despite its size, the company still grows about 22 % a year. And it buys back its own shares at a steady pace, nearly 6 % of the total each year. When the share count falls, each remaining share weighs more. That is why its cash per share grows even faster than its sales, around 33 % a year.",
        },
        { type: 'h2', text: "The angle of the moment: travel is back" },
        {
          type: 'p',
          text: "The backdrop adds spice. International travel is regaining color, and Booking is best placed to benefit: more travelers, more bookings, more commissions. When an already dominant company rides a tailwind, volumes can surprise to the upside.",
        },
        {
          type: 'p',
          text: "But that is also its risk. Travel is cyclical: it rises strongly in good times and contracts fast in a recession, geopolitical tension or health shock. Part of the current results reflects a recovery that will not last forever at this pace. Worth keeping in mind before projecting.",
        },
        { type: 'h2', text: "Is it the right price?" },
        {
          type: 'p',
          text: "That is my second question, always separate from quality. To measure price, I look at P/FCF (price-to-free-cash-flow): the share price divided by annual free cash flow. Booking trades at about 15 times its free cash flow. That is neither cheap nor excessive. For a company growing 22 % with such margins, it is even rather reasonable given its quality.",
        },
        {
          type: 'p',
          text: "The real debate is the durability of growth. If travel keeps rising, 15 times cash is a fair price for a leader. If the recovery fades, the multiple can contract. As always, a low or mid price is only attractive if the quality holds. That double read is what I wanted to do in seconds, so I coded it. See the detail on the [Booking analysis page](/analyse/BKNG), the [ranking of undervalued stocks](/classement/sous-evaluees) and my [methodology](/methodologie).",
        },
      ],
      faq: [
        {
          q: "What exactly does Booking Holdings own?",
          a: "Booking.com, Priceline, Agoda, Kayak and OpenTable. It is the largest online travel agency in the world, present in hotels, flights, rentals and restaurant reservations.",
        },
        {
          q: "Why are its margins so high?",
          a: "Because Booking owns no hotel and no plane. It connects travelers with hosts for a commission, with no heavy assets. Nearly every extra commission drops to cash, hence a free cash flow margin near 30 %.",
        },
        {
          q: "Is a P/FCF of 15 expensive?",
          a: "It is a mid valuation, neither cheap nor excessive. For a company growing 22 % a year with such margins, it is rather reasonable given its quality, provided travel growth continues.",
        },
        {
          q: "Should you buy Booking Holdings stock?",
          a: "It depends on your view of how durable the travel recovery is and on your price discipline, since the sector is cyclical. This is not personalized investment advice, do your own research.",
        },
      ],
      tags: ['Analysis', 'Booking', 'Travel', 'Valuation'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 12, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "Booking Holdings (BKNG): análisis de una acción 10/10",
      excerpt:
        "Tras Booking.com se esconde una de las mejores máquinas de caja del mercado. Con 10/10 y a 15 veces su free cash flow. Mi análisis mientras el viaje repunta.",
      metaDescription:
        "Booking Holdings (BKNG) saca 10/10 en mi rejilla, con un P/FCF cercano a 15. Crecimiento fuerte, márgenes enormes: mi análisis mientras el viaje se recupera.",
      answer:
        "Booking Holdings, la matriz de Booking.com, obtiene la nota máxima en mi rejilla de calidad: crecimiento fuerte, márgenes enormes, fuertes recompras. Cotiza a unas 15 veces su free cash flow, ni regalada ni excesiva. Mientras el viaje mundial repunta, aquí explico por qué merece una mirada, y sus riesgos.",
      body: [
        {
          type: 'ul',
          items: [
            "Nota de calidad: 10/10 en mi rejilla de criterios fundamentales.",
            "Crecimiento de ventas fuerte, en torno al 22 % anual, raro a este tamaño.",
            "Margen de free cash flow del 30 %: una máquina de caja.",
            "La caja por acción sube cerca del 33 % anual, impulsada por enormes recompras.",
            "Valoración media: unas 15 veces el free cash flow, ni regalo ni exceso.",
          ],
        },
        { type: 'h2', text: "Mucho más que Booking.com" },
        {
          type: 'p',
          text: "Todo el mundo conoce Booking.com para reservar un hotel. Pocos se dan cuenta de que detrás hay un imperio: Booking Holdings, que también posee Priceline, Agoda, Kayak y el servicio de reservas de restaurantes OpenTable. Es, con mucho, la mayor agencia de viajes online del mundo.",
        },
        {
          type: 'p',
          text: "Su modelo es casi mágico en lo financiero. Booking no posee ni hoteles ni aviones. Conecta a viajeros con alojamientos y se lleva una comisión por el camino. Sin activos pesados, con pocos costes fijos: casi cada euro de comisión adicional cae en caja. Eso explica unos márgenes que pocas empresas alcanzan.",
        },
        { type: 'h2', text: "Por qué mi rejilla le da 10/10" },
        {
          type: 'p',
          text: "Mi nota sobre 10 mide la solidez financiera objetiva: rentabilidad, crecimiento de la caja, márgenes, recompras, deuda. Booking destaca en todo. Su margen de free cash flow alcanza el 30 %. El free cash flow es el dinero que de verdad queda una vez pagadas todas las facturas. Un 30 % significa que de 100 euros de ventas, 30 acaban en caja disponible.",
        },
        {
          type: 'p',
          text: "Más raro aún: pese a su tamaño, la empresa sigue creciendo alrededor de un 22 % al año. Y recompra sus propias acciones a buen ritmo, cerca de un 6 % del total cada año. Cuando el número de acciones baja, cada acción restante pesa más. Por eso su caja por acción crece aún más rápido que sus ventas, en torno al 33 % anual.",
        },
        { type: 'h2', text: "El ángulo del momento: el viaje repunta" },
        {
          type: 'p',
          text: "El contexto añade interés. El viaje internacional recupera color, y Booking es la mejor situada para aprovecharlo: más viajeros, más reservas, más comisiones. Cuando una empresa ya dominante surfea un viento a favor, los volúmenes pueden sorprender al alza.",
        },
        {
          type: 'p',
          text: "Pero ese es también su riesgo. El viaje es cíclico: sube con fuerza en los buenos tiempos y se contrae rápido ante una recesión, tensiones geopolíticas o un shock sanitario. Parte de los resultados actuales refleja una recuperación que no durará para siempre a este ritmo. Conviene tenerlo presente antes de proyectar.",
        },
        { type: 'h2', text: "¿Es el precio correcto?" },
        {
          type: 'p',
          text: "Es mi segunda pregunta, siempre separada de la calidad. Para medir el precio miro el P/FCF (price-to-free-cash-flow): la cotización dividida por el free cash flow anual. Booking cotiza a unas 15 veces su free cash flow. No es ni barata ni excesiva. Para una empresa que crece al 22 % con semejantes márgenes, es incluso bastante razonable dada su calidad.",
        },
        {
          type: 'p',
          text: "El verdadero debate es la durabilidad del crecimiento. Si el viaje sigue subiendo, 15 veces la caja es un precio justo para un líder. Si la recuperación se agota, el múltiplo puede contraerse. Como siempre, un precio bajo o medio solo es atractivo si la calidad aguanta. Esa doble lectura es lo que quería poder hacer en segundos, así que la programé. Mira el detalle en la [página de análisis de Booking](/analyse/BKNG), el [ranking de acciones infravaloradas](/classement/sous-evaluees) y mi [metodología](/methodologie).",
        },
      ],
      faq: [
        {
          q: "¿Qué posee exactamente Booking Holdings?",
          a: "Booking.com, Priceline, Agoda, Kayak y OpenTable. Es la mayor agencia de viajes online del mundo, presente en hoteles, vuelos, alquileres y reservas de restaurantes.",
        },
        {
          q: "¿Por qué sus márgenes son tan altos?",
          a: "Porque Booking no posee ni hoteles ni aviones. Conecta a viajeros con alojamientos a cambio de una comisión, sin activos pesados. Casi cada comisión adicional cae en caja, de ahí un margen de free cash flow cercano al 30 %.",
        },
        {
          q: "¿Un P/FCF de 15 es caro?",
          a: "Es una valoración media, ni barata ni excesiva. Para una empresa que crece al 22 % anual con esos márgenes, es bastante razonable dada su calidad, siempre que el crecimiento del viaje continúe.",
        },
        {
          q: "¿Hay que comprar la acción de Booking Holdings?",
          a: "Depende de tu visión sobre la durabilidad de la recuperación del viaje y de tu disciplina de precio, ya que el sector es cíclico. Esto no es asesoramiento de inversión personalizado, haz tu propia investigación.",
        },
      ],
      tags: ['Análisis', 'Booking', 'Viajes', 'Valoración'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 12 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};

const qlysIntu: Article = {
  slug: 'qualys-qlys-intuit-intu-comparatif-10-sur-10',
  date: '2026-06-12',
  updated: '2026-06-12',
  readingTime: 8,
  content: {
    fr: {
      title: "Qualys (QLYS) ou Intuit (INTU) : 2 logiciels 10/10",
      excerpt:
        "Deux éditeurs de logiciels notés 10/10, deux valorisations différentes. Qualys plus rentable mais plus chère, Intuit moins chère et plus large. Le comparatif.",
      metaDescription:
        "Qualys (QLYS) à 18x le cash, Intuit (INTU) à 13x : deux logiciels notés 10/10. Marges, croissance, moat : lequel offre le meilleur rapport qualité prix ?",
      answer:
        "Qualys et Intuit ont toutes deux 10/10 à ma grille de qualité, mais des profils opposés. Qualys, dans la cybersécurité, affiche des marges supérieures mais se paie plus cher, environ 18 fois son cash. Intuit, plus large et plus connue, croît plus vite et coûte moins cher, environ 13 fois. Voici comment je tranche.",
      body: [
        {
          type: 'ul',
          items: [
            "Deux éditeurs notés 10/10 : Qualys (QLYS) et Intuit (INTU).",
            "Qualys : la plus rentable (marge nette d'environ 29 %), mais la plus chère (environ 18 fois le cash).",
            "Intuit : la moins chère (environ 13 fois), la croissance la plus rapide (environ 15 %/an).",
            "Intuit a un moat plus large grâce à TurboTax et QuickBooks.",
            "Même note, choix différent selon que tu privilégies la décote ou la croissance.",
          ],
        },
        { type: 'h2', text: "Deux logiciels, deux mondes" },
        {
          type: 'p',
          text: "Qualys et Intuit sont toutes les deux des éditeurs de logiciels notés 10/10 par ma grille, mais elles ne font pas du tout le même métier. Qualys vend de la cybersécurité en ligne : elle scanne en permanence les systèmes de ses clients pour repérer les failles et vérifier la conformité. Un service technique, vendu surtout à de grandes entreprises.",
        },
        {
          type: 'p',
          text: "Intuit, c'est l'inverse du spectre : grand public et petites entreprises. Elle édite TurboTax, le logiciel numéro un pour faire ses impôts aux États-Unis, et QuickBooks, la référence de la comptabilité des PME américaines. Deux quasi-monopoles sur des tâches que personne n'a envie de faire à la main.",
        },
        { type: 'h2', text: "Qualys, la plus rentable" },
        {
          type: 'p',
          text: "Côté marges, Qualys impressionne. Sa marge nette dépasse 29 %, et sa marge de free cash flow frôle 31 %. Le free cash flow, c'est l'argent qui reste vraiment une fois les factures payées. À ce niveau, Qualys transforme presque un tiers de ses ventes en cash pur. La cybersécurité est un besoin non négociable : une entreprise coupe beaucoup de budgets avant de couper sa sécurité. Ça donne un pouvoir de tarification solide.",
        },
        {
          type: 'p',
          text: "Le revers, c'est le prix. Qualys se paie environ 18 fois son free cash flow. Pour mesurer ça, j'utilise le P/FCF (price-to-free-cash-flow), le cours divisé par le cash annuel. Dix-huit fois, ce n'est pas excessif pour cette qualité, mais ce n'est pas une décote non plus.",
        },
        { type: 'h2', text: "Intuit, moins chère et plus large" },
        {
          type: 'p',
          text: "Intuit se paie environ 13 fois son free cash flow, nettement moins que Qualys. Et pourtant, elle croît plus vite, autour de 15 % par an contre 13 % pour Qualys. Sur le papier, payer moins cher une croissance plus rapide, c'est attirant.",
        },
        {
          type: 'p',
          text: "Surtout, son moat est plus large. Un moat, c'est le fossé concurrentiel qui empêche un rival de prendre la place. Une fois que des millions de PME tiennent leur comptabilité sur QuickBooks, en changer est un cauchemar. Cette adhérence vaut de l'or. Qualys a un bon moat technique, mais Intuit a un moat de masse, ancré dans les habitudes de tout un pays.",
        },
        { type: 'h2', text: "Laquelle je préfère, et pourquoi" },
        {
          type: 'p',
          text: "Même note de qualité, mais le choix dépend de ce que tu cherches. Si tu veux la marge maximale et que la cybersécurité te parle, Qualys est superbe, à condition d'accepter de la payer un peu cher. Si tu veux le meilleur compromis entre qualité, croissance et prix, Intuit a ma préférence sur ce duel : moins chère, croissance plus rapide, moat plus profond.",
        },
        {
          type: 'p',
          text: "Mais le mot d'ordre reste le même : la moins chère n'est pas automatiquement la meilleure affaire, et la plus rentable non plus. Tout dépend du prix payé pour la qualité obtenue. C'est cette double lecture que je voulais pouvoir faire en quelques secondes, alors je l'ai codée. Compare-les toi-même sur [Qualys](/analyse/QLYS) et [Intuit](/analyse/INTU), ou parcours le [classement des entreprises 10 sur 10](/classement/qualite-10-sur-10) et ma [méthodologie](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Qualys et Intuit font-elles le même métier ?",
          a: "Non. Qualys vend de la cybersécurité en ligne, surtout aux grandes entreprises. Intuit édite TurboTax (impôts) et QuickBooks (comptabilité PME), pour le grand public et les petites entreprises. Deux modèles très différents, même note de qualité.",
        },
        {
          q: "Pourquoi Qualys est-elle plus chère ?",
          a: "Parce que ses marges sont parmi les plus élevées de la cote et que la cybersécurité est un besoin non négociable. Le marché paie cette rentabilité et cette résilience par un P/FCF d'environ 18, contre 13 pour Intuit.",
        },
        {
          q: "Intuit est-elle la meilleure affaire des deux ?",
          a: "Sur ce duel, elle cumule un prix plus bas, une croissance plus rapide et un moat plus large. Mais moins cher ne veut pas dire sans risque. Compare toujours le prix à la qualité avant de conclure.",
        },
        {
          q: "Faut-il acheter Qualys ou Intuit ?",
          a: "Ça dépend de ce que tu privilégies, la marge maximale ou le meilleur compromis croissance-prix, et de ta discipline d'entrée. Ceci n'est pas un conseil en investissement personnalisé, fais tes propres recherches.",
        },
      ],
      tags: ['Comparatif', 'Software', 'Cybersécurité', 'Valorisation'],
      disclaimer:
        "Analyse à but informatif et éducatif, pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas du futur. Chiffres au 12 juin 2026, susceptibles d'évoluer. Fais tes propres recherches.",
    },
    en: {
      title: "Qualys (QLYS) or Intuit (INTU): two 10/10 names",
      excerpt:
        "Two software makers rated 10/10, two different valuations. Qualys more profitable but pricier, Intuit cheaper and broader. The comparison.",
      metaDescription:
        "Qualys (QLYS) at 18x cash, Intuit (INTU) at 13x: two software makers rated 10/10. Margins, growth, moat: which offers the best quality for the price?",
      answer:
        "Qualys and Intuit both score 10/10 on my quality grid, but with opposite profiles. Qualys, in cybersecurity, posts higher margins but trades pricier, about 18 times its cash. Intuit, broader and better known, grows faster and costs less, about 13 times. Here is how I decide.",
      body: [
        {
          type: 'ul',
          items: [
            "Two makers rated 10/10: Qualys (QLYS) and Intuit (INTU).",
            "Qualys: the most profitable (net margin around 29 %), but the priciest (about 18 times cash).",
            "Intuit: the cheapest (about 13 times), the fastest growth (about 15 % a year).",
            "Intuit has a broader moat thanks to TurboTax and QuickBooks.",
            "Same score, different choice depending on whether you favor discount or growth.",
          ],
        },
        { type: 'h2', text: "Two software firms, two worlds" },
        {
          type: 'p',
          text: "Qualys and Intuit are both software makers rated 10/10 by my grid, but they are in completely different businesses. Qualys sells cybersecurity online: it continuously scans its clients' systems to spot flaws and check compliance. A technical service, sold mostly to large enterprises.",
        },
        {
          type: 'p',
          text: "Intuit is the opposite end of the spectrum: consumers and small businesses. It makes TurboTax, the number one software to file taxes in the United States, and QuickBooks, the reference for US small-business accounting. Two near-monopolies on tasks nobody wants to do by hand.",
        },
        { type: 'h2', text: "Qualys, the more profitable" },
        {
          type: 'p',
          text: "On margins, Qualys impresses. Its net margin tops 29 %, and its free cash flow margin nears 31 %. Free cash flow is the money that truly remains once bills are paid. At that level, Qualys turns nearly a third of its sales into pure cash. Cybersecurity is a non-negotiable need: a company cuts many budgets before cutting its security. That gives solid pricing power.",
        },
        {
          type: 'p',
          text: "The flip side is the price. Qualys trades at about 18 times its free cash flow. To measure that, I use P/FCF (price-to-free-cash-flow), the share price divided by annual cash. Eighteen times is not excessive for this quality, but it is no discount either.",
        },
        { type: 'h2', text: "Intuit, cheaper and broader" },
        {
          type: 'p',
          text: "Intuit trades at about 13 times its free cash flow, clearly less than Qualys. And yet it grows faster, around 15 % a year versus 13 % for Qualys. On paper, paying less for faster growth is appealing.",
        },
        {
          type: 'p',
          text: "Above all, its moat is broader. A moat is the competitive gap that stops a rival from taking its place. Once millions of small businesses run their books on QuickBooks, switching is a nightmare. That stickiness is worth gold. Qualys has a good technical moat, but Intuit has a mass moat, anchored in the habits of an entire country.",
        },
        { type: 'h2', text: "Which I prefer, and why" },
        {
          type: 'p',
          text: "Same quality score, but the choice depends on what you want. If you want the maximum margin and cybersecurity speaks to you, Qualys is superb, provided you accept paying up a bit. If you want the best balance of quality, growth and price, Intuit gets my preference in this duel: cheaper, faster growth, deeper moat.",
        },
        {
          type: 'p',
          text: "But the watchword stays the same: the cheapest is not automatically the best deal, and neither is the most profitable. It all depends on the price paid for the quality obtained. That double read is what I wanted to do in seconds, so I coded it. Compare them yourself on [Qualys](/analyse/QLYS) and [Intuit](/analyse/INTU), or browse the [ranking of companies rated 10 out of 10](/classement/qualite-10-sur-10) and my [methodology](/methodologie).",
        },
      ],
      faq: [
        {
          q: "Are Qualys and Intuit in the same business?",
          a: "No. Qualys sells cybersecurity online, mostly to large enterprises. Intuit makes TurboTax (taxes) and QuickBooks (small-business accounting), for consumers and small businesses. Two very different models, same quality score.",
        },
        {
          q: "Why is Qualys more expensive?",
          a: "Because its margins are among the highest on the market and cybersecurity is a non-negotiable need. The market pays for that profitability and resilience with a P/FCF near 18, versus 13 for Intuit.",
        },
        {
          q: "Is Intuit the better deal of the two?",
          a: "In this duel it combines a lower price, faster growth and a broader moat. But cheaper does not mean risk-free. Always compare price to quality before concluding.",
        },
        {
          q: "Should you buy Qualys or Intuit?",
          a: "It depends on what you favor, maximum margin or the best growth-price balance, and on your entry discipline. This is not personalized investment advice, do your own research.",
        },
      ],
      tags: ['Comparison', 'Software', 'Cybersecurity', 'Valuation'],
      disclaimer:
        "Analysis for informational and educational purposes, not personalized investment advice. Past performance does not guarantee future results. Figures as of June 12, 2026, subject to change. Do your own research.",
    },
    es: {
      title: "Qualys (QLYS) o Intuit (INTU): dos software 10/10",
      excerpt:
        "Dos empresas de software con 10/10, dos valoraciones distintas. Qualys más rentable pero más cara, Intuit más barata y más amplia. El comparativo.",
      metaDescription:
        "Qualys (QLYS) a 18x la caja, Intuit (INTU) a 13x: dos software con 10/10. Márgenes, crecimiento, foso: ¿cuál ofrece la mejor calidad por su precio?",
      answer:
        "Qualys e Intuit sacan ambas 10/10 en mi rejilla de calidad, pero con perfiles opuestos. Qualys, en ciberseguridad, presenta márgenes superiores pero cotiza más cara, unas 18 veces su caja. Intuit, más amplia y conocida, crece más rápido y cuesta menos, unas 13 veces. Así lo decido.",
      body: [
        {
          type: 'ul',
          items: [
            "Dos empresas con 10/10: Qualys (QLYS) e Intuit (INTU).",
            "Qualys: la más rentable (margen neto cercano al 29 %), pero la más cara (unas 18 veces la caja).",
            "Intuit: la más barata (unas 13 veces), el crecimiento más rápido (cerca del 15 % anual).",
            "Intuit tiene un foso más amplio gracias a TurboTax y QuickBooks.",
            "Misma nota, elección distinta según prefieras el descuento o el crecimiento.",
          ],
        },
        { type: 'h2', text: "Dos software, dos mundos" },
        {
          type: 'p',
          text: "Qualys e Intuit son ambas empresas de software con 10/10 en mi rejilla, pero no hacen para nada el mismo negocio. Qualys vende ciberseguridad online: escanea de forma continua los sistemas de sus clientes para detectar fallos y verificar el cumplimiento. Un servicio técnico, vendido sobre todo a grandes empresas.",
        },
        {
          type: 'p',
          text: "Intuit es el extremo opuesto del espectro: gran público y pequeñas empresas. Edita TurboTax, el software número uno para hacer los impuestos en Estados Unidos, y QuickBooks, la referencia de la contabilidad de las pymes estadounidenses. Dos casi monopolios sobre tareas que nadie quiere hacer a mano.",
        },
        { type: 'h2', text: "Qualys, la más rentable" },
        {
          type: 'p',
          text: "En márgenes, Qualys impresiona. Su margen neto supera el 29 %, y su margen de free cash flow roza el 31 %. El free cash flow es el dinero que de verdad queda una vez pagadas las facturas. A ese nivel, Qualys convierte casi un tercio de sus ventas en caja pura. La ciberseguridad es una necesidad no negociable: una empresa recorta muchos presupuestos antes de recortar su seguridad. Eso da un poder de fijación de precios sólido.",
        },
        {
          type: 'p',
          text: "El reverso es el precio. Qualys cotiza a unas 18 veces su free cash flow. Para medirlo uso el P/FCF (price-to-free-cash-flow), la cotización dividida por la caja anual. Dieciocho veces no es excesivo para esta calidad, pero tampoco es un descuento.",
        },
        { type: 'h2', text: "Intuit, más barata y más amplia" },
        {
          type: 'p',
          text: "Intuit cotiza a unas 13 veces su free cash flow, claramente menos que Qualys. Y sin embargo crece más rápido, en torno al 15 % anual frente al 13 % de Qualys. Sobre el papel, pagar menos por un crecimiento más rápido es atractivo.",
        },
        {
          type: 'p',
          text: "Sobre todo, su foso es más amplio. Un foso es la brecha competitiva que impide a un rival ocupar su lugar. Una vez que millones de pymes llevan su contabilidad en QuickBooks, cambiar es una pesadilla. Esa adherencia vale oro. Qualys tiene un buen foso técnico, pero Intuit tiene un foso de masa, anclado en los hábitos de todo un país.",
        },
        { type: 'h2', text: "Cuál prefiero, y por qué" },
        {
          type: 'p',
          text: "Misma nota de calidad, pero la elección depende de lo que busques. Si quieres el margen máximo y la ciberseguridad te interesa, Qualys es estupenda, siempre que aceptes pagarla algo cara. Si quieres el mejor equilibrio entre calidad, crecimiento y precio, Intuit tiene mi preferencia en este duelo: más barata, crecimiento más rápido, foso más profundo.",
        },
        {
          type: 'p',
          text: "Pero la consigna sigue siendo la misma: la más barata no es automáticamente el mejor negocio, ni tampoco la más rentable. Todo depende del precio pagado por la calidad obtenida. Esa doble lectura es lo que quería poder hacer en segundos, así que la programé. Compáralas tú mismo en [Qualys](/analyse/QLYS) e [Intuit](/analyse/INTU), o recorre el [ranking de empresas 10 sobre 10](/classement/qualite-10-sur-10) y mi [metodología](/methodologie).",
        },
      ],
      faq: [
        {
          q: "¿Qualys e Intuit hacen el mismo negocio?",
          a: "No. Qualys vende ciberseguridad online, sobre todo a grandes empresas. Intuit edita TurboTax (impuestos) y QuickBooks (contabilidad de pymes), para el gran público y las pequeñas empresas. Dos modelos muy distintos, misma nota de calidad.",
        },
        {
          q: "¿Por qué Qualys es más cara?",
          a: "Porque sus márgenes están entre los más altos del mercado y la ciberseguridad es una necesidad no negociable. El mercado paga esa rentabilidad y resiliencia con un P/FCF cercano a 18, frente a 13 de Intuit.",
        },
        {
          q: "¿Intuit es el mejor negocio de las dos?",
          a: "En este duelo combina un precio más bajo, un crecimiento más rápido y un foso más amplio. Pero más barata no significa sin riesgo. Compara siempre el precio con la calidad antes de concluir.",
        },
        {
          q: "¿Hay que comprar Qualys o Intuit?",
          a: "Depende de lo que priorices, el margen máximo o el mejor equilibrio crecimiento-precio, y de tu disciplina de entrada. Esto no es asesoramiento de inversión personalizado, haz tu propia investigación.",
        },
      ],
      tags: ['Comparativo', 'Software', 'Ciberseguridad', 'Valoración'],
      disclaimer:
        "Análisis con fines informativos y educativos, no asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 12 de junio de 2026, sujetas a cambios. Haz tu propia investigación.",
    },
  },
};

export const ARTICLES: Article[] = [adobeResults, gddy, methodeQualite, softwareApp, dataSecteurs, bkng, qlysIntu, afya, rnr, meli, pfcfSous5x, reperer10sous, topMoinsCheres, reassurance, bsyRop, assuranceTop, kgc, techPfcf, rotation, kinsale, adobe];

/** Articles triés du plus récent au plus ancien. */
export function listArticles(): Article[] {
  return [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** Normalise une langue i18n quelconque vers une langue d'article supportée. */
export function toArticleLang(lng: string | undefined | null): ArticleLang {
  const base = (lng || 'fr').toLowerCase().split('-')[0];
  return base === 'en' ? 'en' : base === 'es' ? 'es' : 'fr';
}
