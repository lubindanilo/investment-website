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


export const ARTICLES: Article[] = [techPfcf, rotation, kinsale, adobe];

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
