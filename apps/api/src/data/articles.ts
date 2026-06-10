/**
 * Contenu éditorial du blog — SOURCE UNIQUE, partagée par :
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
  updated: '2026-06-09',
  readingTime: 7,
  ticker: 'ADBE',
  content: {
    fr: {
      title: "Faut-il acheter l'action Adobe (ADBE) avant ses résultats ?",
      excerpt:
        "Qualité 9/10, free cash flow au plus bas historique, mais un cours environ 35 % au-dessus du prix d'achat conseillé. Décryptage avant les résultats du 11 juin.",
      metaDescription:
        "Adobe : qualité 9/10, P/FCF au plus bas de 5 ans, mais 35 % au-dessus du prix d'achat conseillé. Analyse fondamentale avant résultats : la qualité n'est pas le prix.",
      answer:
        "Adobe affiche une qualité fondamentale de 9/10 (marge de free cash flow de 34 %, Cash ROCE de 153 %, bilan en trésorerie nette) et son cash ne s'est jamais payé aussi peu cher en cinq ans (P/FCF d'environ 12,7 contre une médiane de 33). Mais à hypothèses prudentes, le cours reste environ 35 % au-dessus du prix d'achat conseillé : une entreprise d'élite n'est pas forcément un bon point d'entrée.",
      body: [
        { type: 'h2', text: 'Adobe, une entreprise de qualité (9/10)' },
        { type: 'p', text: "Sur les 10 critères financiers objectifs de Lubin Investment, Adobe valide 9 critères. C'est une véritable machine à cash : marge de free cash flow de 34 %, rendement du capital (Cash ROCE) de 153 %, conversion du bénéfice en cash supérieure à 1, et un cycle de trésorerie négatif (les clients paient avant les fournisseurs, à la manière de Costco). Le bilan est en trésorerie nette, sans fragilité financière, et la société rachète ses propres actions chaque année." },
        { type: 'p', text: "Côté modèle d'affaires : près de 94 % de revenus récurrents par abonnement, encore en hausse, et environ 58 % du marché mondial du logiciel créatif. Le fossé concurrentiel est profond : une fois installé sur Photoshop, Premiere ou Acrobat, on en change rarement. C'est le profil d'un compounder de long terme." },
        { type: 'h2', text: "Pourquoi le cours s'est effondré" },
        { type: 'p', text: "Si l'entreprise est si solide, pourquoi l'action a-t-elle été massacrée ? Trois raisons se combinent :" },
        { type: 'ul', items: [
          "La peur de l'IA générative (Midjourney, OpenAI, Canva) : le marché parie qu'Adobe se fait disrupter.",
          "Une croissance qui ralentit, autour de 11 % par an, contre plus de 20 % auparavant.",
          "La cicatrice Figma, ce rachat à 20 milliards de dollars abandonné en 2023.",
        ] },
        { type: 'p', text: "Le seul critère au rouge de l'analyse est cohérent avec ce récit : la marge opérationnelle ne progresse plus. Attention toutefois, elle reste à un niveau très élevé (environ 35 %) ; elle a simplement cessé de s'élargir, car Adobe investit dans l'IA. Conséquence : le multiple s'est effondré à environ 12,7 fois le free cash flow, contre une médiane de 33 sur cinq ans et un secteur à près de 60. C'est le cash le moins cher de toute son histoire." },
        { type: 'h2', text: "La qualité n'est pas le prix : le verdict valorisation" },
        { type: 'p', text: "Une entreprise géniale à un mauvais prix reste un mauvais investissement. C'est pourquoi Lubin Investment juge toujours la qualité et le prix séparément. À hypothèses prudentes (croissance du free cash flow de 8 %, multiple de sortie de 11, rendement annuel visé de 15 %), le prix d'achat conseillé ressort autour de 163 dollars. Le cours actuel est d'environ 251 dollars, soit près de 35 % au-dessus du point d'entrée idéal." },
        { type: 'p', text: "Toute la thèse tient dans une seule variable : l'hypothèse de croissance. Adobe a fait croître son free cash flow par action de près de 11 % par an. Si l'on retient ce rythme plutôt que 8 %, le prix d'entrée acceptable remonte nettement." },
        { type: 'h2', text: 'Le setup avant les résultats du 11 juin' },
        { type: 'p', text: "Les attentes sont basses, ce qui crée un setup intéressant. Deux scénarios : une déception rapprocherait le cours du point d'entrée discipliné ; une bonne surprise sur l'IA pourrait re-noter le multiple depuis son plus bas historique. Dans les deux cas, l'investisseur qui dispose d'un prix cible agit avec méthode plutôt qu'avec émotion." },
        { type: 'h2', text: 'La méthode Lubin : qualité et prix, séparés' },
        { type: 'p', text: "C'est exactement ce que fait Lubin Investment en quelques secondes : une note de qualité sur 10 critères objectifs, et une valorisation indépendante qui donne un prix d'achat conseillé. Tapez un ticker et obtenez le même verdict que pour Adobe sur n'importe quelle action." },
      ],
      faq: [
        { q: 'Adobe (ADBE) est-elle une action de qualité ?', a: "Oui : Lubin Investment lui attribue 9/10 sur 10 critères financiers objectifs, avec une marge de free cash flow de 34 %, un Cash ROCE de 153 %, un bilan en trésorerie nette et des rachats d'actions réguliers." },
        { q: "Pourquoi l'action Adobe a-t-elle chuté ?", a: "La peur de l'IA générative, un ralentissement de la croissance (environ 11 %) et la cicatrice du rachat avorté de Figma ont fait s'effondrer le multiple à environ 12,7 fois le free cash flow, son plus bas historique." },
        { q: "Quel est le prix d'achat conseillé pour Adobe ?", a: "À hypothèses prudentes (croissance du free cash flow de 8 %), il ressort autour de 163 dollars, soit environ 35 % sous le cours actuel proche de 251 dollars. Ce prix monte si l'on retient une croissance plus élevée." },
        { q: 'Faut-il acheter Adobe avant ses résultats ?', a: "Cela dépend de votre hypothèse de croissance et de votre discipline de prix. Les attentes étant basses, une déception rapprocherait le cours du point d'entrée et une bonne surprise IA pourrait re-noter le multiple. Ceci n'est pas un conseil en investissement." },
      ],
      tags: ['Analyse', 'Adobe', 'Valorisation'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 9 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: 'Should you buy Adobe (ADBE) stock before earnings?',
      excerpt:
        "Quality 9/10, free cash flow at a historic low, but a price about 35% above the recommended buy price. A pre-earnings breakdown ahead of the June 11 report.",
      metaDescription:
        "Adobe: quality 9/10, P/FCF at a 5-year low, but 35% above the recommended buy price. Fundamental analysis before earnings: quality is not the same as price.",
      answer:
        "Adobe shows a fundamental quality of 9/10 (free cash flow margin of 34%, Cash ROCE of 153%, a net-cash balance sheet) and its cash has never been this cheap in five years (P/FCF around 12.7 versus a median of 33). But on prudent assumptions, the stock still trades about 35% above the recommended buy price: an elite company is not necessarily a good entry point.",
      body: [
        { type: 'h2', text: 'Adobe, a quality company (9/10)' },
        { type: 'p', text: "Across Lubin Investment's 10 objective financial criteria, Adobe passes 9. It is a genuine cash machine: a 34% free cash flow margin, a 153% return on capital (Cash ROCE), profit-to-cash conversion above 1, and a negative cash cycle (clients pay before suppliers, Costco-style). The balance sheet is net cash, with no financial weakness, and the company buys back its own shares every year." },
        { type: 'p', text: "On the business model: nearly 94% recurring subscription revenue, still growing, and about 58% of the global creative software market. The moat is deep: once you work in Photoshop, Premiere or Acrobat, you rarely switch. This is the profile of a long-term compounder." },
        { type: 'h2', text: 'Why the stock collapsed' },
        { type: 'p', text: "If the company is this strong, why was the stock crushed? Three reasons combine:" },
        { type: 'ul', items: [
          "Fear of generative AI (Midjourney, OpenAI, Canva): the market bets Adobe gets disrupted.",
          'Slowing growth, around 11% per year, versus more than 20% before.',
          'The Figma scar, that 20 billion dollar deal abandoned in 2023.',
        ] },
        { type: 'p', text: "The single red criterion fits this narrative: the operating margin is no longer expanding. Note, however, that it remains very high (around 35%); it has simply stopped growing because Adobe is investing in AI. As a result, the multiple collapsed to about 12.7 times free cash flow, versus a five-year median of 33 and a sector near 60. It is the cheapest cash in its entire history." },
        { type: 'h2', text: 'Quality is not price: the valuation verdict' },
        { type: 'p', text: "A great company at a bad price is still a bad investment. That is why Lubin Investment always judges quality and price separately. On prudent assumptions (8% free cash flow growth, an 11 exit multiple, a 15% target annual return), the recommended buy price comes out around 163 dollars. The current price is about 251 dollars, roughly 35% above the ideal entry point." },
        { type: 'p', text: "The whole thesis rests on a single variable: the growth assumption. Adobe grew its free cash flow per share by nearly 11% per year. If you use that pace rather than 8%, the acceptable entry price rises sharply." },
        { type: 'h2', text: 'The setup before the June 11 earnings' },
        { type: 'p', text: "Expectations are low, which creates an interesting setup. Two scenarios: a disappointment would push the price toward the disciplined entry point; a positive AI surprise could re-rate the multiple from its historic low. In both cases, an investor with a target price acts with method rather than emotion." },
        { type: 'h2', text: 'The Lubin method: quality and price, separated' },
        { type: 'p', text: "That is exactly what Lubin Investment does in seconds: a quality score across 10 objective criteria, and an independent valuation that gives a recommended buy price. Type a ticker and get the same verdict as for Adobe on any stock." },
      ],
      faq: [
        { q: 'Is Adobe (ADBE) a quality stock?', a: 'Yes: Lubin Investment gives it 9/10 across 10 objective financial criteria, with a 34% free cash flow margin, a 153% Cash ROCE, a net-cash balance sheet and regular share buybacks.' },
        { q: 'Why did Adobe stock fall?', a: 'Fear of generative AI, slowing growth (around 11%) and the scar of the abandoned Figma acquisition collapsed the multiple to about 12.7 times free cash flow, its historic low.' },
        { q: 'What is the recommended buy price for Adobe?', a: 'On prudent assumptions (8% free cash flow growth), it comes out around 163 dollars, about 35% below the current price near 251 dollars. That price rises with a higher growth assumption.' },
        { q: 'Should you buy Adobe before earnings?', a: 'It depends on your growth assumption and your price discipline. With low expectations, a disappointment would move the price toward the entry point, and a positive AI surprise could re-rate the multiple. This is not investment advice.' },
      ],
      tags: ['Analysis', 'Adobe', 'Valuation'],
      disclaimer:
        'This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 9, 2026, subject to change. Do your own research.',
    },
    es: {
      title: '¿Comprar acciones de Adobe (ADBE) antes de resultados?',
      excerpt:
        "Calidad 9/10, flujo de caja libre en mínimos históricos, pero una cotización un 35 % por encima del precio de compra recomendado. Análisis antes de los resultados del 11 de junio.",
      metaDescription:
        "Adobe: calidad 9/10, P/FCF en mínimos de 5 años, pero un 35 % por encima del precio de compra recomendado. Análisis fundamental antes de resultados: calidad no es precio.",
      answer:
        "Adobe muestra una calidad fundamental de 9/10 (margen de flujo de caja libre del 34 %, Cash ROCE del 153 %, balance con caja neta) y su caja nunca se había pagado tan barata en cinco años (P/FCF de unos 12,7 frente a una mediana de 33). Pero con hipótesis prudentes, la acción sigue cotizando un 35 % por encima del precio de compra recomendado: una empresa de élite no es necesariamente un buen punto de entrada.",
      body: [
        { type: 'h2', text: 'Adobe, una empresa de calidad (9/10)' },
        { type: 'p', text: "En los 10 criterios financieros objetivos de Lubin Investment, Adobe valida 9. Es una auténtica máquina de generar caja: margen de flujo de caja libre del 34 %, rentabilidad del capital (Cash ROCE) del 153 %, conversión de beneficio en caja superior a 1 y un ciclo de caja negativo (los clientes pagan antes que los proveedores, al estilo de Costco). El balance tiene caja neta, sin fragilidad financiera, y la empresa recompra sus propias acciones cada año." },
        { type: 'p', text: "Sobre el modelo de negocio: cerca del 94 % de ingresos recurrentes por suscripción, aún al alza, y alrededor del 58 % del mercado mundial de software creativo. El foso competitivo es profundo: una vez que trabajas en Photoshop, Premiere o Acrobat, rara vez cambias. Es el perfil de un compounder a largo plazo." },
        { type: 'h2', text: 'Por qué se hundió la cotización' },
        { type: 'p', text: "Si la empresa es tan sólida, ¿por qué se desplomó la acción? Se combinan tres razones:" },
        { type: 'ul', items: [
          'El miedo a la IA generativa (Midjourney, OpenAI, Canva): el mercado apuesta a que Adobe será disruptida.',
          'Un crecimiento que se ralentiza, en torno al 11 % anual, frente a más del 20 % antes.',
          'La cicatriz de Figma, esa compra de 20 000 millones de dólares abandonada en 2023.',
        ] },
        { type: 'p', text: "El único criterio en rojo encaja con este relato: el margen operativo ya no se expande. Atención, sin embargo: sigue muy alto (en torno al 35 %); simplemente ha dejado de crecer porque Adobe invierte en IA. Como resultado, el múltiplo se hundió a unas 12,7 veces el flujo de caja libre, frente a una mediana de 33 en cinco años y un sector cercano a 60. Es la caja más barata de toda su historia." },
        { type: 'h2', text: 'La calidad no es el precio: el veredicto de valoración' },
        { type: 'p', text: "Una gran empresa a mal precio sigue siendo una mala inversión. Por eso Lubin Investment juzga siempre la calidad y el precio por separado. Con hipótesis prudentes (crecimiento del flujo de caja libre del 8 %, múltiplo de salida de 11, rentabilidad anual objetivo del 15 %), el precio de compra recomendado ronda los 163 dólares. La cotización actual es de unos 251 dólares, cerca de un 35 % por encima del punto de entrada ideal." },
        { type: 'p', text: "Toda la tesis depende de una sola variable: la hipótesis de crecimiento. Adobe ha hecho crecer su flujo de caja libre por acción cerca del 11 % anual. Si se utiliza ese ritmo en lugar del 8 %, el precio de entrada aceptable sube con claridad." },
        { type: 'h2', text: 'El setup antes de los resultados del 11 de junio' },
        { type: 'p', text: "Las expectativas son bajas, lo que crea un setup interesante. Dos escenarios: una decepción acercaría la cotización al punto de entrada disciplinado; una sorpresa positiva en IA podría reevaluar el múltiplo desde su mínimo histórico. En ambos casos, el inversor con un precio objetivo actúa con método y no con emoción." },
        { type: 'h2', text: 'El método Lubin: calidad y precio, por separado' },
        { type: 'p', text: "Es exactamente lo que hace Lubin Investment en segundos: una nota de calidad sobre 10 criterios objetivos y una valoración independiente que da un precio de compra recomendado. Escribe un ticker y obtén el mismo veredicto que para Adobe en cualquier acción." },
      ],
      faq: [
        { q: '¿Es Adobe (ADBE) una acción de calidad?', a: 'Sí: Lubin Investment le otorga 9/10 en 10 criterios financieros objetivos, con un margen de flujo de caja libre del 34 %, un Cash ROCE del 153 %, un balance con caja neta y recompras de acciones regulares.' },
        { q: '¿Por qué cayó la acción de Adobe?', a: 'El miedo a la IA generativa, un crecimiento más lento (en torno al 11 %) y la cicatriz de la adquisición fallida de Figma hundieron el múltiplo a unas 12,7 veces el flujo de caja libre, su mínimo histórico.' },
        { q: '¿Cuál es el precio de compra recomendado para Adobe?', a: 'Con hipótesis prudentes (crecimiento del flujo de caja libre del 8 %), ronda los 163 dólares, un 35 % por debajo de la cotización actual cercana a 251 dólares. Ese precio sube con una hipótesis de crecimiento mayor.' },
        { q: '¿Hay que comprar Adobe antes de resultados?', a: 'Depende de tu hipótesis de crecimiento y de tu disciplina de precio. Con expectativas bajas, una decepción acercaría la cotización al punto de entrada y una sorpresa positiva en IA podría reevaluar el múltiplo. Esto no es asesoramiento de inversión.' },
      ],
      tags: ['Análisis', 'Adobe', 'Valoración'],
      disclaimer:
        'Este artículo es un análisis con fines informativos y educativos y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 9 de junio de 2026, sujetas a cambios. Haz tu propia investigación.',
    },
  },
};

const kinsale: Article = {
  slug: 'kinsale-capital-assureur-10-10',
  date: '2026-06-10',
  updated: '2026-06-10',
  readingTime: 8,
  ticker: 'KNSL',
  content: {
    fr: {
      title: "Kinsale Capital (KNSL) : l'assureur 10/10 que le marché ignore",
      excerpt:
        "Note qualité 10/10, P/FCF de 7,0x, croissance du FCF par action de 28 % par an. Kinsale Capital est une pépite méconnue de l'assurance spécialisée.",
      metaDescription:
        "Kinsale Capital : note qualité 10/10 (24/25 critères), P/FCF de 7,0x, croissance annuelle de 28 % du FCF par action. L'assureur E&S le mieux noté, valorisé comme un second souci par le marché.",
      answer:
        "Kinsale Capital est noté 10/10 par Lubin Investment : marge FCF de 52 %, Cash ROCE de 45 %, croissance du FCF par action de 28 % par an sur 5 ans, endettement nul. Et tout ça se paie 7,0x le free cash flow, soit en dessous de la médiane du secteur. Le marché achète un assureur spécialisé de première classe comme s'il s'agissait d'un second souci.",
      body: [
        { type: 'h2', text: "Kinsale Capital, l'assureur E&S qui gagne sans faire de bruit" },
        { type: 'p', text: "Je vais être direct : Kinsale Capital est l'un des meilleurs business que j'aie analysés sur Lubin Investment, et personne n'en parle. La société opère sur le marché de l'assurance excédentaire et surplus (E&S) aux États-Unis, ce segment qui assure les risques que les assureurs traditionnels ne veulent pas toucher." },
        { type: 'p', text: "Le résultat ? 24 critères sur 25 validés par l'analyse automatique. C'est la note parfaite, réservée aux entreprises qui cochent toutes les cases de la qualité fondamentale. Et pourtant, le marché laisse ce 10/10 se payer 7,0x le free cash flow, sous la médiane du secteur à 7,4x." },
        { type: 'ul', items: [
          "Note qualité parfaite 10/10 (24 critères sur 25 validés)",
          "P/FCF de 7,0x seulement, sous la médiane du secteur à 7,4x",
          "Marge FCF de 52 %, croissance du FCF par action de 28 % par an",
          "Bilan en trésorerie nette, Cash ROCE de 45 %",
          "Prix d'achat conseillé de 533 $, soit 76 % au-dessus du cours actuel",
        ]},
        { type: 'h2', text: 'Les chiffres qui font un 10/10' },
        { type: 'p', text: 'Prenons les trois piliers de la qualité :' },
        { type: 'ul', items: [
          "Rentabilité : marge nette de 28 %, marge de free cash flow de 52 %. Plus de la moitié du chiffre d'affaires se transforme en cash libre. C'est le niveau d'une société de logiciels, pas d'un assureur.",
          "Croissance : le chiffre d'affaires progresse de 33 % par an sur 5 ans. Le free cash flow par action : 28 % par an sur la même période. Les deux sont organiques.",
          "Rendement du capital : le Cash ROCE est de 45 %. Chaque dollar investi génère 45 cents de profit cash par an, soit 3 fois le seuil d'excellence.",
        ]},
        { type: 'p', text: "Ajoutez à ça un bilan en trésorerie nette (endettement remboursable en 0,00 an), un taux de conversion du bénéfice en cash de 1,89, et des rachats d'actions réguliers : le dernier programme de 250 millions de dollars annoncé en décembre 2025." },
        { type: 'h2', text: "Pourquoi le marché doute" },
        { type: 'p', text: "Kinsale a raté le consensus de revenus au premier trimestre 2026, et le cours a corrigé de 30 % depuis ses sommets. Mais regardons la réalité : le bénéfice par action réel était de 5,11 dollars contre 4,79 attendu, soit un beat de 6,7 %. Simplement, le marché s'attendait à un chiffre d'affaires encore plus élevé. C'est le genre de déception qui fait baisser une action de qualité, et c'est souvent le meilleur moment d'acheter." },
        { type: 'h2', text: 'Ce que dit la valorisation' },
        { type: 'p', text: "À 7,0x le free cash flow, Kinsale se paie moins cher que Progressive (7,4x), Chubb (8,3x) ou RLI (8,8x). Pourtant sa croissance est 2 à 3 fois plus rapide. Notre modèle de valorisation avec des hypothèses prudentes (croissance du FCF de 20 % par an, multiple de sortie de 10x) donne un prix d'achat conseillé de 533 dollars, soit une marge de sécurité de 76 % par rapport au cours actuel de 303 dollars." },
        { type: 'p', text: "C'est le genre d'écart qui n'arrive que quand une action de qualité est temporairement impopulaire." },
        { type: 'h2', text: "Kinsale dans une stratégie de rotation value" },
        { type: 'p', text: "Ce que j'aime avec Kinsale, c'est sa double nature : c'est à la fois une action de croissance (33 % par an) et une action value (P/FCF de 7,0x). Dans un contexte de rotation value qui s'accélère en 2026, ce profil hybride est exactement ce que le marché commence à rechercher." },
        { type: 'p', text: "Le prochain rendez-vous : les résultats du deuxième trimestre, prévus le 22 juillet 2026. Si Kinsale confirme son momentum, le marché pourrait commencer à re-noter le multiple." },
        { type: 'p', text: "Comme toujours chez Lubin Investment, la qualité et le prix sont jugés séparément. Kinsale coche toutes les cases des deux côtés. Tape KNSL dans l'analyseur et vérifie par toi-même." },
      ],
      faq: [
        { q: 'Quelle est la note qualité de Kinsale Capital ?', a: "Kinsale Capital obtient la note parfaite de 10/10 (24 critères sur 25) selon Lubin Investment, avec des notes maximales en rentabilité, croissance, rendement du capital et solidité bilancielle." },
        { q: 'Pourquoi Kinsale Capital est-il sous-évalué ?', a: "Kinsale se paie 7,0x le free cash flow, sous la médiane du secteur. Le marché a réagi à un raté de revenus au T1 2026, alors que le BPA a en réalité dépassé les attentes de 6,7 %. Le prix d'achat conseillé ressort à 533 dollars, soit 76 % au-dessus du cours actuel." },
        { q: 'Kinsale Capital verse-t-il un dividende ?', a: "Oui, Kinsale verse un dividende avec un rendement d'environ 0,3 %, mais le vrai retour aux actionnaires passe par les rachats d'actions : un programme de 250 millions de dollars annoncé en décembre 2025." },
        { q: 'Kinsale Capital est-il une action de croissance ou de valeur ?', a: "Les deux : 33 % de croissance annuelle du chiffre d'affaires mais un P/FCF de 7,0x. Ce profil hybride est particulièrement recherché en contexte de rotation value." },
        { q: 'Comment Kinsale surpasse-t-il ses concurrents ?', a: "Kinsale utilise une plateforme technologique propriétaire qui lui donne un avantage de coût sur les assureurs traditionnels. Combinée à une sélection rigoureuse des risques, cela lui permet de maintenir des marges supérieures au cycle près." },
      ],
      tags: ['Analyse', 'Kinsale Capital', 'Assurance'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 10 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: 'Kinsale Capital (KNSL) : a 10/10 insurer the market ignores',
      excerpt:
        'Quality score 10/10, P/FCF of 7.0x, FCF per share growth of 28% per year. Kinsale Capital is an overlooked gem in specialty insurance.',
      metaDescription:
        'Kinsale Capital: quality 10/10 (24/25 criteria), P/FCF of 7.0x, 28% annual FCF per share growth. The top-rated E&S insurer, priced like an also-ran.',
      answer:
        'Kinsale Capital scores 10/10 on Lubin Investment: 52% FCF margin, 45% Cash ROCE, 28% annual FCF per share growth over 5 years, zero debt. And all of this trades at 7.0x free cash flow, below the sector median. The market is pricing a first-class specialty insurer like a second-tier player.',
      body: [
        { type: 'h2', text: 'Kinsale Capital, the E&S insurer winning quietly' },
        { type: 'p', text: "Let me be direct: Kinsale Capital is one of the best businesses I have analyzed on Lubin Investment, and almost nobody talks about it. The company operates in the excess and surplus (E&S) insurance market in the United States, the segment that covers risks traditional insurers won't touch." },
        { type: 'p', text: "The result? 24 out of 25 criteria met by our automated analysis. That's a perfect score, reserved for companies that check every box of fundamental quality. Yet the market lets this 10/10 trade at 7.0x free cash flow, below the sector median of 7.4x." },
        { type: 'ul', items: [
          'Perfect quality score 10/10 (24 out of 25 criteria met)',
          'P/FCF of only 7.0x, below the sector median of 7.4x',
          'FCF margin of 52%, FCF per share growth of 28% per year',
          'Net cash balance sheet, Cash ROCE of 45%',
          'Buy price of $533, a 76% upside from current price',
        ]},
        { type: 'h2', text: 'The numbers behind a 10/10' },
        { type: 'p', text: 'Let us look at the three pillars of quality:' },
        { type: 'ul', items: [
          'Profitability: net margin of 28%, free cash flow margin of 52%. More than half of revenue turns into free cash. That is software-company level, not insurer level.',
          'Growth: revenue growing at 33% per year over 5 years. Free cash flow per share: 28% per year. Both are organic.',
          'Return on capital: Cash ROCE at 45%. Every dollar invested generates 45 cents of cash profit per year, 3 times the excellence threshold.',
        ]},
        { type: 'p', text: "Add a net cash balance sheet (debt repayable in 0.00 years), a cash conversion ratio of 1.89, and regular share buybacks, the latest $250 million program announced in December 2025." },
        { type: 'h2', text: 'Why the market hesitates' },
        { type: 'p', text: 'Kinsale missed Q1 2026 revenue consensus and the stock corrected 30% from its highs. But look at the facts: actual EPS was $5.11 versus $4.79 expected, a 6.7% beat. The market simply wanted even higher revenue. This is precisely the kind of disappointment that knocks down a quality stock, and often the best time to buy.' },
        { type: 'h2', text: 'What valuation says' },
        { type: 'p', text: 'At 7.0x free cash flow, Kinsale trades cheaper than Progressive (7.4x), Chubb (8.3x) and RLI (8.8x), yet grows 2 to 3 times faster. Our valuation model with prudent assumptions (20% FCF growth, 10x exit multiple) gives a buy price of $533, a 76% margin of safety above the current $303 price.' },
        { type: 'p', text: 'That is the kind of gap that only happens when a quality stock is temporarily out of favor.' },
        { type: 'h2', text: 'Kinsale in a value rotation strategy' },
        { type: 'p', text: "What I like about Kinsale is its dual nature: it is both a growth stock (33% annual revenue growth) and a value stock (7.0x P/FCF). In a 2026 value rotation context, this hybrid profile is exactly what the market is starting to look for." },
        { type: 'p', text: 'Next catalyst: Q2 2026 earnings on July 22. If Kinsale confirms its momentum, the market may start re-rating the multiple.' },
        { type: 'p', text: "As always at Lubin Investment, quality and price are judged separately. Kinsale checks every box on both sides. Type KNSL into the analyzer and see for yourself." },
      ],
      faq: [
        { q: 'What is Kinsale Capital\'s quality score?', a: 'Kinsale Capital scores a perfect 10/10 (24 out of 25 criteria) on Lubin Investment, with top marks in profitability, growth, return on capital and balance sheet strength.' },
        { q: 'Why is Kinsale Capital undervalued?', a: 'Kinsale trades at 7.0x free cash flow, below the sector median. The market reacted to a Q1 2026 revenue miss, even though EPS beat expectations by 6.7%. Our buy price is $533, 76% above the current price.' },
        { q: 'Does Kinsale Capital pay a dividend?', a: 'Yes, Kinsale pays a dividend yielding about 0.3%, but the real shareholder return comes from buybacks: a $250 million program was announced in December 2025.' },
        { q: 'Is Kinsale Capital a growth or value stock?', a: 'Both: 33% annual revenue growth but a P/FCF of 7.0x. This hybrid profile is especially sought after in a value rotation environment.' },
        { q: 'How does Kinsale outperform its competitors?', a: 'Kinsale uses a proprietary technology platform giving it a cost advantage over traditional insurers. Combined with rigorous risk selection, this sustains superior margins through the cycle.' },
      ],
      tags: ['Analysis', 'Kinsale Capital', 'Insurance'],
      disclaimer:
        'This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 10, 2026, subject to change. Do your own research.',
    },
    es: {
      title: 'Kinsale Capital (KNSL) : la aseguradora 10/10 que el mercado ignora',
      excerpt:
        'Calificación 10/10, P/FCF de 7,0x, crecimiento del FCF por acción del 28 % anual. Kinsale Capital es una joya desconocida del seguro especializado.',
      metaDescription:
        'Kinsale Capital: calidad 10/10 (24/25 criterios), P/FCF de 7,0x, crecimiento anual del 28 % del FCF por acción. La aseguradora E&S mejor calificada, valorada como una de segunda fila.',
      answer:
        'Kinsale Capital obtiene un 10/10 en Lubin Investment: margen FCF del 52 %, Cash ROCE del 45 %, crecimiento del FCF por acción del 28 % anual en 5 años, deuda cero. Y todo esto se paga a 7,0x el flujo de caja libre, por debajo de la mediana del sector. El mercado tasa una aseguradora especializada de primera clase como si fuera de segunda fila.',
      body: [
        { type: 'h2', text: 'Kinsale Capital, la aseguradora E&S que gana sin hacer ruido' },
        { type: 'p', text: 'Voy a ser directo: Kinsale Capital es uno de los mejores negocios que he analizado en Lubin Investment, y casi nadie habla de ella. Opera en el mercado de seguros de excedentes y exceso (E&S) en Estados Unidos, el segmento que cubre riesgos que las aseguradoras tradicionales no quieren tocar.' },
        { type: 'p', text: '¿El resultado? 24 de 25 criterios validados por el análisis automático. Es la nota perfecta, reservada a empresas que marcan todas las casillas de la calidad fundamental. Y sin embargo, el mercado deja que este 10/10 cotice a 7,0x el flujo de caja libre, por debajo de la mediana del sector del 7,4x.' },
        { type: 'ul', items: [
          'Puntuación de calidad perfecta 10/10 (24 de 25 criterios)',
          'P/FCF de solo 7,0x, por debajo de la mediana del sector del 7,4x',
          'Margen FCF del 52 %, crecimiento del FCF por acción del 28 % anual',
          'Balance con caja neta, Cash ROCE del 45 %',
          'Precio de compra de 533 $, un 76 % por encima del precio actual',
        ]},
        { type: 'h2', text: 'Las cifras de un 10/10' },
        { type: 'p', text: 'Veamos los tres pilares de la calidad:' },
        { type: 'ul', items: [
          'Rentabilidad: margen neto del 28 %, margen de flujo de caja libre del 52 %. Más de la mitad de los ingresos se convierte en caja libre. Es nivel de empresa de software, no de aseguradora.',
          'Crecimiento: los ingresos crecen al 33 % anual en 5 años. El flujo de caja libre por acción: 28 % anual. Ambos son orgánicos.',
          'Rentabilidad del capital: el Cash ROCE es del 45 %. Cada dólar invertido genera 45 centavos de beneficio en efectivo al año, 3 veces el umbral de excelencia.',
        ]},
        { type: 'p', text: 'Añada un balance con caja neta (deuda reembolsable en 0,00 años), una ratio de conversión de caja de 1,89, y recompras de acciones regulares: el último programa de 250 millones de dólares anunciado en diciembre de 2025.' },
        { type: 'h2', text: 'Por qué duda el mercado' },
        { type: 'p', text: 'Kinsale no alcanzó el consenso de ingresos del primer trimestre de 2026 y la acción corrigió un 30 % desde sus máximos. Pero mire los hechos: el BPA real fue de 5,11 dólares frente a los 4,79 esperados, un 6,7 % por encima. El mercado simplemente esperaba ingresos aún mayores. Es el tipo de decepción que castiga a una acción de calidad y a menudo el mejor momento para comprar.' },
        { type: 'h2', text: 'Lo que dice la valoración' },
        { type: 'p', text: 'A 7,0x el flujo de caja libre, Kinsale cotiza más barata que Progressive (7,4x), Chubb (8,3x) y RLI (8,8x), pero crece 2 o 3 veces más rápido. Nuestro modelo de valoración con hipótesis prudentes (crecimiento del FCF del 20 %, múltiplo de salida de 10x) da un precio de compra de 533 dólares, un margen de seguridad del 76 % sobre los 303 dólares actuales.' },
        { type: 'p', text: 'Es el tipo de brecha que solo ocurre cuando una acción de calidad está temporalmente fuera de moda.' },
        { type: 'h2', text: 'Kinsale en una estrategia de rotación value' },
        { type: 'p', text: 'Lo que me gusta de Kinsale es su doble naturaleza: es a la vez un valor de crecimiento (33 % anual de ingresos) y un valor de valor (P/FCF de 7,0x). En un contexto de rotación value en 2026, este perfil híbrido es exactamente lo que el mercado empieza a buscar.' },
        { type: 'p', text: 'Próxima cita: resultados del segundo trimestre el 22 de julio de 2026. Si Kinsale confirma su impulso, el mercado podría empezar a reevaluar el múltiplo.' },
        { type: 'p', text: 'Como siempre en Lubin Investment, la calidad y el precio se juzgan por separado. Kinsale marca todas las casillas en ambos lados. Escriba KNSL en el analizador y compruébelo usted mismo.' },
      ],
      faq: [
        { q: '¿Cuál es la calificación de calidad de Kinsale Capital?', a: 'Kinsale Capital obtiene la nota perfecta de 10/10 (24 de 25 criterios) en Lubin Investment, con máximas puntuaciones en rentabilidad, crecimiento, rentabilidad del capital y solidez del balance.' },
        { q: '¿Por qué Kinsale Capital está infravalorada?', a: 'Kinsale cotiza a 7,0x el flujo de caja libre, por debajo de la mediana del sector. El mercado reaccionó a una falta de ingresos en el T1 2026, aunque el BPA superó las expectativas en un 6,7 %. Nuestro precio de compra es de 533 dólares, un 76 % por encima del precio actual.' },
        { q: '¿Paga dividendo Kinsale Capital?', a: 'Sí, Kinsale paga un dividendo con una rentabilidad de alrededor del 0,3 %, pero el verdadero retorno al accionista viene de las recompras: un programa de 250 millones de dólares anunciado en diciembre de 2025.' },
        { q: '¿Es Kinsale Capital un valor de crecimiento o de valor?', a: 'Ambos: crecimiento anual de ingresos del 33 % pero un P/FCF de 7,0x. Este perfil híbrido es especialmente buscado en un entorno de rotación value.' },
        { q: '¿Cómo supera Kinsale a sus competidores?', a: 'Kinsale utiliza una plataforma tecnológica propia que le da una ventaja en costes sobre las aseguradoras tradicionales. Combinada con una selección rigurosa de riesgos, mantiene márgenes superiores a lo largo del ciclo.' },
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
  readingTime: 9,
  content: {
    fr: {
      title: 'Rotation value : les actions qualité qui en profitent en juin 2026',
      excerpt:
        "L'indice Value américain surperforme le Growth de 10 points en 2026. Voici les actions notées 10/10 par Lubin Investment qui bénéficient de cette rotation.",
      metaDescription:
        "Rotation value 2026 : le Value surperforme le Growth de 10 points. Découvrez les actions notées 10/10 par Lubin Investment avec P/FCF sous 10x qui profitent de ce mouvement de marché massif.",
      answer:
        "La rotation value de 2026 est réelle : l'indice Morningstar US Value gagne 18,6 % contre 8,3 % pour le Growth, et 4 600 milliards de dollars de capitalisation sont passés de l'indice Growth au Value depuis 2023. Chez Lubin Investment, plusieurs actions notées 10/10 avec des P/FCF sous 10x sont idéalement positionnées pour en bénéficier : Kinsale Capital, SkyWest, Progressive, Arch Capital Group, W.R. Berkley et d'autres.",
      body: [
        { type: 'h2', text: 'La rotation value est bien réelle' },
        { type: 'p', text: "Parlons chiffres, parce que c'est ce qui compte. Depuis le début de l'année 2026, l'indice Morningstar US Value a gagné 18,6 %. L'indice Growth : 8,3 %. Dix points d'écart, c'est la plus grande divergence entre valeur et croissance depuis le début de la décennie." },
        { type: 'p', text: "Le Dow Jones a touché un record à 51 562 points début juin, porté par UnitedHealth (+5 %), JPMorgan (+3 %) et Walmart. Pendant ce temps, le Nasdaq reculait de 0,1 %, les investisseurs sortant des valeurs technologiques et de l'IA pour se repositionner sur les secteurs value." },
        { type: 'p', text: "Selon Neuberger Berman, les actions value sont prêtes à accélérer leur rallye : leur sensibilité à la croissance économique (bêta des bénéfices de 1,2 contre 0,8 pour la croissance) les rend particulièrement attractives dans un environnement de reprise." },
        { type: 'ul', items: [
          "L'indice Value surperforme le Growth de 10 points en 2026",
          "4 600 Md$ ont basculé des indices Growth vers Value depuis 2023",
          "Plusieurs actions 10/10 avec P/FCF sous 10x sont idéalement positionnées",
          "L'assurance domine les profils quality-value de Lubin Investment",
          "Le score qualité élimine le risque de value trap",
        ]},
        { type: 'h2', text: 'Le basculement est massif et structurel' },
        { type: 'p', text: "Ce n'est pas un mouvement de panique passager. Depuis 2023, 4 600 milliards de dollars de capitalisation ont glissé de l'indice Russell 1000 Growth vers le Russell 1000 Value. Les taux d'intérêt plus élevés et l'inflation persistante favorisent structurellement les actifs value, qui ont une duration plus courte." },
        { type: 'p', text: "Même WisdomTree, qui vient de réaugmenter son exposition à la croissance, reconnaît que la compression des valorisations value a créé des opportunités : la surperformance du Value en 2025-2026 a été telle que les ratios se sont normalisés." },
        { type: 'h2', text: 'Les actions Lubin 10/10 qui profitent de la rotation' },
        { type: 'p', text: "Voici les actions notées 10/10 par Lubin Investment, avec un P/FCF sous 10x, qui bénéficient directement de cette rotation :" },
        { type: 'ul', items: [
          "SkyWest (SKYW) : P/FCF de 3,9x, qualité 10/10. La compagnie aérienne régionale la mieux notée, valorisée comme si elle était au bord de la faillite.",
          "Kinsale Capital (KNSL) : P/FCF de 7,1x, qualité 10/10. L'assureur E&S qui croît à 33 % par an mais se paie sous la médiane du secteur.",
          "Progressive (PGR) : P/FCF de 7,4x, qualité 10/10. L'assureur auto le plus efficace d'Amérique, avec 5,7 % de parts de marché gagnées par an.",
          "Arch Capital Group (ACGL) : P/FCF de 5,6x, qualité 10/10. Un assureur diversifié avec une croissance de 17 % par an.",
          "W.R. Berkley (WRB) : P/FCF de 7,0x, qualité 10/10. L'assureur valeur par excellence, 58 ans d'existence.",
          "Mercury General (MCY) : P/FCF de 4,0x, qualité 10/10. P/B de 1,1x, rendement de 3,7 %, une value pure.",
          "Cincinnati Financial (CINF) : P/FCF de 7,4x, qualité 10/10. 74 ans de dividendes croissants.",
        ]},
        { type: 'p', text: "Toutes ces actions partagent un point commun : une note qualité parfaite combinée à un multiple de free cash flow inférieur à la moyenne du marché. C'est exactement le type de profil que la rotation value récompense." },
        { type: 'h2', text: 'Comment jouer la rotation avec Lubin Investment' },
        { type: 'p', text: "La force de Lubin Investment, c'est de séparer la qualité du prix. Une rotation value ne signifie pas acheter n'importe quelle action bon marché. Le risque est de tomber sur des value traps, des entreprises qui semblent bon marché parce qu'elles sont structurellement en déclin." },
        { type: 'p', text: "Notre score qualité élimine ce risque : une note 10/10 signifie que l'entreprise coche tous les critères de solidité fondamentale. En combinant ce filtre qualité avec un P/FCF sous 10x, on obtient un portefeuille d'actions qui sont à la fois des bons business ET des bonnes affaires." },
        { type: 'p', text: "Les secteurs les plus représentés dans ce filtre sont l'assurance (le marché E&S en pleine croissance), les valeurs pétrolières et gazières, et certains éditeurs de logiciels. Tape un ticker dans l'analyseur pour voir où se situe chaque action dans la matrice qualité-prix." },
      ],
      faq: [
        { q: "Qu'est-ce que la rotation value de 2026 ?", a: "La rotation value désigne le déplacement massif des capitaux des actions de croissance (tech, IA) vers les actions de valeur (assurance, énergie, banques). En 2026, l'indice Value surperforme le Growth de 10 points, avec 4 600 milliards de dollars de capitalisation basculés des indices Growth vers Value depuis 2023." },
        { q: 'Quelles actions 10/10 profitent de la rotation value ?', a: "Plusieurs actions notées 10/10 par Lubin Investment avec P/FCF sous 10x : SkyWest (3,9x), Kinsale Capital (7,1x), Progressive (7,4x), Arch Capital Group (5,6x), W.R. Berkley (7,0x), Mercury General (4,0x), Cincinnati Financial (7,4x)." },
        { q: 'La rotation value est-elle durable ?', a: "Selon Neuberger Berman, oui : la sensibilité des valeurs value à la croissance économique (bêta de 1,2) et le contexte de taux plus élevés favorisent structurellement la value. WisdomTree a toutefois réduit son exposition en juin 2026, jugeant la croissance désormais moins chère." },
        { q: 'Quels secteurs bénéficient le plus de la rotation ?', a: "L'assurance domine les profils 10/10 à bas P/FCF, suivie des valeurs énergétiques et de certains logiciels. Ce sont des secteurs à forte génération de cash et faibles besoins en investissement." },
        { q: "Comment éviter les value traps dans une rotation value ?", a: "Le score qualité de Lubin Investment élimine ce risque : un 10/10 garantit une solidité fondamentale. En combinant qualité maximale et P/FCF sous 10x, on obtient des actions qui sont à la fois de bons business et des bonnes affaires." },
      ],
      tags: ['Rotation', 'Value', 'Stratégie', 'Analyse'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 10 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: 'Value rotation : quality stocks benefiting in June 2026',
      excerpt:
        'The US Value index is outperforming Growth by 10 points in 2026. Here are the 10/10 rated stocks from Lubin Investment benefiting from this rotation.',
      metaDescription:
        '2026 value rotation: Value outperforms Growth by 10 points. Discover 10/10 rated stocks from Lubin Investment with P/FCF under 10x benefiting from this massive market shift.',
      answer:
        "The 2026 value rotation is real: the Morningstar US Value Index is up 18.6% versus 8.3% for Growth, and $4.6 trillion in market cap has shifted from Growth to Value indices since 2023. At Lubin Investment, several 10/10 rated stocks with P/FCF under 10x are ideally positioned: Kinsale Capital, SkyWest, Progressive, Arch Capital Group, W.R. Berkley and others.",
      body: [
        { type: 'h2', text: 'The value rotation is real' },
        { type: 'p', text: 'Let us talk numbers. Since the start of 2026, the Morningstar US Value Index has gained 18.6%. The Growth Index: 8.3%. A 10-point gap, the largest divergence between value and growth since the start of the decade.' },
        { type: 'p', text: 'The Dow Jones hit a record 51,562 in early June, driven by UnitedHealth (+5%), JPMorgan (+3%) and Walmart. Meanwhile the Nasdaq edged down 0.1% as investors rotated out of tech and AI names into value sectors.' },
        { type: 'p', text: 'According to Neuberger Berman, value stocks are poised to accelerate their rally: their earnings beta of 1.2 versus 0.8 for growth makes them particularly attractive in a recovery environment.' },
        { type: 'ul', items: [
          'The Value index outperforms Growth by 10 points in 2026',
          '$4.6 trillion shifted from Growth to Value indices since 2023',
          'Several 10/10 stocks with P/FCF under 10x are ideally positioned',
          'Insurance dominates Lubin Investment quality-value profiles',
          'The quality score eliminates value trap risk',
        ]},
        { type: 'h2', text: 'The shift is massive and structural' },
        { type: 'p', text: "This is not a panic-driven move. Since 2023, $4.6 trillion in market cap has shifted from the Russell 1000 Growth Index to the Russell 1000 Value Index. Higher interest rates and persistent inflation structurally favor value assets, which have shorter duration." },
        { type: 'h2', text: 'Lubin 10/10 stocks benefiting from the rotation' },
        { type: 'p', text: 'Here are the 10/10 rated stocks on Lubin Investment with P/FCF under 10x, directly benefiting from this rotation:' },
        { type: 'ul', items: [
          "SkyWest (SKYW): P/FCF of 3.9x, quality 10/10. The highest-rated regional airline, priced as if near bankruptcy.",
          "Kinsale Capital (KNSL): P/FCF of 7.1x, quality 10/10. The E&S insurer growing at 33% per year but trading below sector median.",
          "Progressive (PGR): P/FCF of 7.4x, quality 10/10. America's most efficient auto insurer, gaining 5.7% market share per year.",
          "Arch Capital Group (ACGL): P/FCF of 5.6x, quality 10/10. A diversified insurer with 17% annual growth.",
          "W.R. Berkley (WRB): P/FCF of 7.0x, quality 10/10. A 58-year-old value insurer par excellence.",
          "Mercury General (MCY): P/FCF of 4.0x, quality 10/10. P/B of 1.1x, 3.7% yield, pure value.",
          "Cincinnati Financial (CINF): P/FCF of 7.4x, quality 10/10. 74 years of growing dividends.",
        ]},
        { type: 'p', text: "All these stocks share a common trait: a perfect quality score combined with a free cash flow multiple below the market average. That is exactly the profile the value rotation rewards." },
        { type: 'h2', text: 'How to play the rotation with Lubin Investment' },
        { type: 'p', text: "Lubin Investment's strength is separating quality from price. A value rotation does not mean buying any cheap stock. The risk is falling into value traps, companies that look cheap because they are structurally in decline." },
        { type: 'p', text: "Our quality score eliminates this risk: a 10/10 rating means the company checks every fundamental strength criterion. By combining this quality filter with a P/FCF under 10x, you get stocks that are both good businesses AND good bargains." },
        { type: 'p', text: 'The most represented sectors in this filter are insurance (the growing E&S market), oil and gas, and select software companies. Type a ticker into the analyzer to see where each stock sits on the quality-price matrix.' },
      ],
      faq: [
        { q: 'What is the 2026 value rotation?', a: 'The value rotation refers to the massive shift of capital from growth stocks (tech, AI) to value stocks (insurance, energy, banks). In 2026, the Value index is outperforming Growth by 10 points, with $4.6 trillion shifting from Growth to Value indices since 2023.' },
        { q: 'Which 10/10 stocks benefit from the value rotation?', a: 'Several 10/10 rated stocks with P/FCF under 10x: SkyWest (3.9x), Kinsale Capital (7.1x), Progressive (7.4x), Arch Capital Group (5.6x), W.R. Berkley (7.0x), Mercury General (4.0x), Cincinnati Financial (7.4x).' },
        { q: 'Is the value rotation sustainable?', a: 'According to Neuberger Berman, yes: value stocks\' sensitivity to economic growth (beta of 1.2) and higher interest rates structurally favor value. WisdomTree, however, reduced its value exposure in June 2026, judging growth now cheaper.' },
        { q: 'Which sectors benefit most from the rotation?', a: 'Insurance dominates the 10/10 low-P/FCF profiles, followed by energy and select software. These are high cash generation sectors with low investment needs.' },
        { q: 'How to avoid value traps during a rotation?', a: 'Lubin Investment\'s quality score eliminates this risk: a 10/10 guarantees fundamental strength. By combining maximum quality with P/FCF under 10x, you get stocks that are both good businesses and good bargains.' },
      ],
      tags: ['Rotation', 'Value', 'Strategy', 'Analysis'],
      disclaimer:
        'This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 10, 2026, subject to change. Do your own research.',
    },
    es: {
      title: 'Rotación value : las acciones de calidad que se benefician en junio 2026',
      excerpt:
        'El índice Value estadounidense supera al Growth en 10 puntos en 2026. Estas son las acciones puntuadas 10/10 por Lubin Investment que se benefician de esta rotación.',
      metaDescription:
        'Rotación value 2026: el Value supera al Growth en 10 puntos. Descubra las acciones puntuadas 10/10 por Lubin Investment con P/FCF inferior a 10x que se benefician de este movimiento masivo del mercado.',
      answer:
        'La rotación value de 2026 es real: el índice Morningstar US Value sube un 18,6 % frente al 8,3 % del Growth, y 4,6 billones de dólares en capitalización han pasado del índice Growth al Value desde 2023. En Lubin Investment, varias acciones puntuadas 10/10 con P/FCF inferior a 10x están idealmente posicionadas: Kinsale Capital, SkyWest, Progressive, Arch Capital Group, W.R. Berkley y otras.',
      body: [
        { type: 'h2', text: 'La rotación value es real' },
        { type: 'p', text: 'Hablemos de cifras. Desde principios de 2026, el índice Morningstar US Value ha ganado un 18,6 %. El índice Growth: un 8,3 %. Diez puntos de diferencia, la mayor divergencia entre valor y crecimiento desde el inicio de la década.' },
        { type: 'p', text: 'El Dow Jones alcanzó un récord de 51 562 puntos a principios de junio, impulsado por UnitedHealth (+5 %), JPMorgan (+3 %) y Walmart. Mientras tanto, el Nasdaq cedía un 0,1 % mientras los inversores rotaban desde valores tecnológicos e IA hacia sectores value.' },
        { type: 'p', text: 'Según Neuberger Berman, los valores value están listos para acelerar su rally: su beta de beneficios de 1,2 frente al 0,8 del crecimiento los hace especialmente atractivos en un entorno de recuperación.' },
        { type: 'ul', items: [
          'El índice Value supera al Growth en 10 puntos en 2026',
          '4,6 billones de dólares movidos desde Growth hacia Value desde 2023',
          'Varias acciones 10/10 con P/FCF inferior a 10x están idealmente posicionadas',
          'Los seguros dominan los perfiles quality-value de Lubin Investment',
          'La puntuación de calidad elimina el riesgo de value trap',
        ]},
        { type: 'h2', text: 'El desplazamiento es masivo y estructural' },
        { type: 'p', text: 'No es un movimiento de pánico pasajero. Desde 2023, 4,6 billones de dólares en capitalización han pasado del Russell 1000 Growth al Russell 1000 Value. Los tipos de interés más altos y la inflación persistente favorecen estructuralmente a los activos value.' },
        { type: 'h2', text: 'Las acciones Lubin 10/10 que se benefician de la rotación' },
        { type: 'p', text: 'Estas son las acciones puntuadas 10/10 por Lubin Investment con P/FCF inferior a 10x que se benefician directamente de esta rotación:' },
        { type: 'ul', items: [
          'SkyWest (SKYW): P/FCF de 3,9x, calidad 10/10. La aerolínea regional mejor calificada, valorada como si estuviera al borde de la quiebra.',
          'Kinsale Capital (KNSL): P/FCF de 7,1x, calidad 10/10. La aseguradora E&S que crece al 33 % anual pero cotiza por debajo de la mediana del sector.',
          'Progressive (PGR): P/FCF de 7,4x, calidad 10/10. La aseguradora de autos más eficiente de América, ganando un 5,7 % de cuota de mercado al año.',
          'Arch Capital Group (ACGL): P/FCF de 5,6x, calidad 10/10. Una aseguradora diversificada con un crecimiento del 17 % anual.',
          'W.R. Berkley (WRB): P/FCF de 7,0x, calidad 10/10. La aseguradora value por excelencia, 58 años de existencia.',
          'Mercury General (MCY): P/FCF de 4,0x, calidad 10/10. P/B de 1,1x, rentabilidad del 3,7 %, value pura.',
          'Cincinnati Financial (CINF): P/FCF de 7,4x, calidad 10/10. 74 años de dividendos crecientes.',
        ]},
        { type: 'p', text: 'Todas estas acciones comparten un rasgo común: una puntuación de calidad perfecta combinada con un múltiplo de flujo de caja libre inferior a la media del mercado. Es exactamente el tipo de perfil que la rotación value recompensa.' },
        { type: 'h2', text: 'Cómo jugar la rotación con Lubin Investment' },
        { type: 'p', text: 'La fuerza de Lubin Investment es separar la calidad del precio. Una rotación value no significa comprar cualquier acción barata. El riesgo es caer en value traps: empresas que parecen baratas porque están en declive estructural.' },
        { type: 'p', text: 'Nuestra puntuación de calidad elimina este riesgo: un 10/10 garantiza solidez fundamental. Al combinar este filtro de calidad con un P/FCF inferior a 10x, se obtienen acciones que son a la vez buenos negocios y buenas gangas.' },
        { type: 'p', text: 'Los sectores más representados son los seguros (el mercado E&S en crecimiento), el petróleo y el gas, y algunos editores de software. Escriba un ticker en el analizador para ver dónde se sitúa cada acción en la matriz calidad-precio.' },
      ],
      faq: [
        { q: '¿Qué es la rotación value de 2026?', a: 'La rotación value se refiere al desplazamiento masivo de capital desde acciones de crecimiento (tecnología, IA) hacia acciones de valor (seguros, energía, bancos). En 2026, el índice Value supera al Growth en 10 puntos, con 4,6 billones de dólares movidos desde índices Growth hacia Value desde 2023.' },
        { q: '¿Qué acciones 10/10 se benefician de la rotación value?', a: 'Varias acciones puntuadas 10/10 con P/FCF inferior a 10x: SkyWest (3,9x), Kinsale Capital (7,1x), Progressive (7,4x), Arch Capital Group (5,6x), W.R. Berkley (7,0x), Mercury General (4,0x), Cincinnati Financial (7,4x).' },
        { q: '¿Es sostenible la rotación value?', a: 'Según Neuberger Berman, sí: la sensibilidad de los valores value al crecimiento económico (beta de 1,2) y los tipos más altos favorecen estructuralmente a la value. WisdomTree, sin embargo, redujo su exposición en junio 2026.' },
        { q: '¿Qué sectores se benefician más de la rotación?', a: 'Los seguros dominan los perfiles 10/10 con bajo P/FCF, seguidos de la energía y algunos software. Son sectores de alta generación de caja y bajas necesidades de inversión.' },
        { q: '¿Cómo evitar value traps en una rotación?', a: 'La puntuación de calidad de Lubin Investment elimina este riesgo: un 10/10 garantiza solidez fundamental. Combinando calidad máxima con P/FCF inferior a 10x, se obtienen acciones que son buenos negocios y buenas gangas.' },
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
  readingTime: 8,
  ticker: 'MSFT',
  content: {
    fr: {
      title: "La tech paie-t-elle trop cher ses cash-flows ? (MSFT, GOOGL, ADBE)",
      excerpt:
        "Microsoft paie 49,7x ses cash-flows, Alphabet 116,6x, Adobe 11,7x seulement. La tech n'est pas un bloc homogène : focus sur trois géants.",
      metaDescription:
        "MSFT à 49,7x le FCF, GOOGL à 116,6x, ADBE à 11,7x. Analyse des valorisations tech par Lubin Investment : certains géants se paient le prix de la perfection, parfois à raison.",
      answer:
        "Non, la tech ne paie pas partout trop cher ses cash-flows, mais certains cas sont extrêmes. Microsoft (P/FCF 49,7x, qualité 8/10) se paie 3 fois son prix d'achat conseillé. Alphabet (P/FCF 116,6x, qualité 6/10) est dans une bulle de multiples avec un FCF par action en baisse de 3% par an. En revanche, Adobe (P/FCF 11,7x, qualité 9/10) est au plus bas historique de valorisation malgré une marge FCF de 34 % et une croissance saine.",
      body: [
        { type: 'h2', text: 'La tech n\'est pas un secteur, c\'est une mosaïque de business models' },
        { type: 'p', text: "Quand on dit « la tech est trop chère », on mélange tout. Microsoft lève 39 centimes de marge nette par dollar de revenu. Alphabet aussi, avec 38 %. Adobe : 29 %. Tous sont très rentables. Mais la façon dont le marché les valorise n'a rien à voir." },
        { type: 'p', text: "Chez Lubin Investment, on sépare la qualité du prix. Et le verdict est nuancé : les trois sont des entreprises de qualité, mais deux d'entre elles se paient à des niveaux qui supposent la perfection." },
        { type: 'ul', items: [
          "MSFT : qualité 8/10, P/FCF 49,7x, surcote de 64 % par rapport au prix d'achat",
          "GOOGL : qualité 6/10, P/FCF 116,6x, surcote de 85 %, FCF par action en baisse",
          "ADBE : qualité 9/10, P/FCF 11,7x, au plus bas historique, moins cher des trois",
          "Le FCF par action est le vrai juge de la création de valeur pour l'actionnaire",
          "La rotation value creuse les écarts de valorisation au sein même de la tech",
        ]},
        { type: 'h2', text: 'Microsoft (MSFT) : un 8/10 à 49,7x le FCF' },
        { type: 'p', text: "Microsoft valide 8 critères sur 10. C'est une excellente entreprise : marge nette de 39 %, croissance du chiffre d'affaires de 13,5 % par an, cycle de trésorerie négatif de -62 jours (les clients paient avant les fournisseurs, comme Costco), rachats d'actions réguliers." },
        { type: 'p', text: "Mais deux choses clignotent en rouge : le FCF par action ne croît que de 4,8 % par an (sous le seuil des 10 %), et le ratio de conversion du bénéfice en cash n'est que de 0,48. Moins de la moitié des bénéfices deviennent du cash libre. Le coupable : l'investissement massif dans l'IA, qui consomme du cash sans le transformer immédiatement en FCF." },
        { type: 'p', text: "À 49,7x le FCF, le marché paie Microsoft comme si la croissance allait s'accélérer. Notre modèle de valorisation donne un prix d'achat conseillé de 144 dollars pour un rendement annuel de 15 %, soit 64 % en dessous du cours actuel de 403 dollars. La marge de sécurité est négative." },
        { type: 'h2', text: 'Alphabet (GOOGL) : un 6/10 à 116,6x le FCF' },
        { type: 'p', text: "Alphabet est le cas le plus extrême. La note qualité n'est que de 6/10 : deux critères échouent franchement (croissance du FCF par action à -3,0 % par an, Cash ROCE à 9,2 % sous le seuil des 15 %), deux sont en avertissement (marge FCF de 9,1 % juste sous 10 %, cycle de trésorerie de 33 jours et stable)." },
        { type: 'p', text: "Le vrai problème : Alphabet est excellent pour transformer son audience en revenus publicitaires, mais moins pour transformer ces revenus en cash libre. La marge FCF n'est que de 9,1 %, et le FCF par action baisse de 3 % par an sur 5 ans à cause du stock-based compensation massif (40 % du FCF) et des investissements Capex." },
        { type: 'p', text: "Pourtant, le marché valorise Alphabet à 116,6x le FCF, soit 7 fois la médiane du secteur. C'est un multiple qui suppose une accélération spectaculaire du FCF. Notre prix d'achat conseillé de 54 dollars implique une surcote de 85 % par rapport au cours actuel de 364 dollars." },
        { type: 'h2', text: 'Adobe (ADBE) : le contre-exemple à 11,7x le FCF' },
        { type: 'p', text: "Adobe, c'est l'inverse : qualité 9/10 (23/25 critères), marge FCF de 34 %, Cash ROCE de 153 %, cycle de trésorerie négatif de -28 jours, croissance du FCF par action de 10,9 % par an. Et pourtant, le P/FCF n'est que de 11,7x, le plus bas de son histoire." },
        { type: 'p', text: "Le marché a massacré Adobe par peur de l'IA générative (Midjourney, Canva) et par le ralentissement de sa croissance (11 % par an contre 20 % avant). Mais le free cash flow, lui, continue de croître. Le résultat : un écart énorme entre la qualité réelle (9/10) et la note de marché." },
        { type: 'p', text: "Attention toutefois : même à ce prix, la valorisation n'est pas une affaire évidente. Notre prix d'achat conseillé ressort à 149 dollars, soit 37 % sous le cours actuel de 238 dollars. Mais avec des marges de sécurité aussi faibles dans le reste de la tech, Adobe est relativement le plus abordable des trois." },
        { type: 'h2', text: 'Leçons pour l\'investisseur' },
        { type: 'p', text: "Trois entreprises tech, trois réalités très différentes. La leçon est simple :" },
        { type: 'ul', items: [
          "Le multiple ne dit pas tout : Adobe est 10 fois moins cher qu'Alphabet sur le FCF, alors que sa qualité est bien supérieure.",
          "La croissance du FCF par action est le vrai juge de paix : Microsoft (4,8 %) et Alphabet (-3,0 %) échouent là où Adobe (10,9 %) réussit.",
          "Le stock-based compensation massif d'Alphabet (40 % du FCF) et de Microsoft (17 %) explique pourquoi le FCF par action progresse si peu malgré des revenus en hausse de 13 %.",
        ]},
        { type: 'p', text: "Comme toujours chez Lubin Investment, la réponse n'est pas dans un jugement binaire. Chaque action a ses forces et ses faiblesses. Tape le ticker dans l'analyseur et vérifie par toi-même où se situe le juste prix." },
      ],
      faq: [
        { q: 'Quel est le P/FCF de Microsoft en 2026 ?', a: "Microsoft se paie 49,7x le free cash flow, avec une qualité de 8/10. Le prix d'achat conseillé Lubin est de 144 dollars, soit 64 % sous le cours actuel de 403 dollars." },
        { q: 'Pourquoi Alphabet a-t-il un P/FCF aussi élevé ?', a: "Alphabet est à 116,6x le FCF malgré une qualité de seulement 6/10 et un FCF par action en baisse de 3 % par an. Le stock-based compensation absorbe 40 % du FCF, et les investissements Capex pèsent sur la génération de cash libre." },
        { q: 'Adobe est-il une bonne affaire à 11,7x le FCF ?', a: "Adobe (qualité 9/10) est au plus bas historique de son P/FCF. Mais le prix d'achat conseillé de 149 dollars reste 37 % sous le cours actuel de 238 dollars. C'est le moins cher des trois géants, mais pas une affaire évidente." },
        { q: 'Pourquoi le FCF par action est-il plus important que le chiffre d\'affaires ?', a: "Le chiffre d'affaires peut croître sans que l'actionnaire en profite si le stock-based compensation dilue les actions ou si les investissements ne génèrent pas de cash. Le FCF par action mesure la création de valeur réelle par action." },
        { q: 'La tech est-elle globalement surévaluée en juin 2026 ?', a: "Pas en bloc. Certains segments (Alphabet, Microsoft) se paient comme si la perfection était acquise. D'autres (Adobe) sont à des plus bas historiques. La rotation value de 2026 crée des disparités énormes au sein même de la tech." },
      ],
      tags: ['Analyse', 'Microsoft', 'Alphabet', 'Adobe', 'Valorisation'],
      disclaimer:
        "Cet article est une analyse à but informatif et éducatif, et ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. Chiffres au 10 juin 2026, susceptibles d'évoluer. Faites vos propres recherches.",
    },
    en: {
      title: 'Does big tech pay too much for its cash flows ? (MSFT, GOOGL, ADBE)',
      excerpt:
        'Microsoft trades at 49.7x cash flows, Alphabet at 116.6x, Adobe at only 11.7x. Tech is not a monolith: a closer look at three giants.',
      metaDescription:
        'MSFT at 49.7x FCF, GOOGL at 116.6x, ADBE at 11.7x. Lubin Investment analyzes big tech valuations: some giants are priced for perfection, sometimes rightly so.',
      answer:
        'No, not all tech stocks pay too much for their cash flows, but some cases are extreme. Microsoft (49.7x P/FCF, quality 8/10) trades at 3x its recommended buy price. Alphabet (116.6x P/FCF, quality 6/10) is in a multiple bubble with FCF per share declining 3% per year. Adobe (11.7x P/FCF, quality 9/10), however, is at its historic low despite a 34% FCF margin and healthy growth.',
      body: [
        { type: 'h2', text: 'Tech is not a sector, it is a mosaic of business models' },
        { type: 'p', text: "When people say 'tech is too expensive', they mix everything up. Microsoft earns 39 cents of net margin per revenue dollar. Alphabet too, at 38%. Adobe: 29%. All highly profitable. But how the market values them has nothing in common." },
        { type: 'p', text: 'At Lubin Investment, we separate quality from price. The verdict is nuanced: all three are quality businesses, but two of them trade at levels that assume perfection.' },
        { type: 'ul', items: [
          'MSFT: quality 8/10, P/FCF 49.7x, 64% premium above buy price',
          'GOOGL: quality 6/10, P/FCF 116.6x, 85% premium, FCF per share declining',
          'ADBE: quality 9/10, P/FCF 11.7x, historic low, cheapest of the three',
          'FCF per share is the real judge of value creation for shareholders',
          'The value rotation is widening valuation gaps within tech itself',
        ]},
        { type: 'h2', text: 'Microsoft (MSFT): an 8/10 at 49.7x FCF' },
        { type: 'p', text: "Microsoft passes 8 out of 10 criteria. It is an excellent business: 39% net margin, 13.5% annual revenue growth, a negative cash cycle of -62 days (clients pay before suppliers, Costco-style), regular buybacks." },
        { type: 'p', text: "But two red flags: FCF per share grows only 4.8% per year (below the 10% threshold), and the cash conversion ratio is only 0.48. Less than half of earnings become free cash. The culprit: massive AI investment that consumes cash without immediately generating FCF." },
        { type: 'p', text: "At 49.7x FCF, the market prices Microsoft as if growth will accelerate. Our valuation model gives a buy price of $144 for a 15% annual return, 64% below the current $403 price. The margin of safety is negative." },
        { type: 'h2', text: 'Alphabet (GOOGL): a 6/10 at 116.6x FCF' },
        { type: 'p', text: "Alphabet is the most extreme case. Quality score is only 6/10: two criteria fail clearly (FCF per share growth at -3.0% per year, Cash ROCE at 9.2% below the 15% threshold), two are warnings (FCF margin of 9.1% just under 10%, cash cycle of 33 days and stable)." },
        { type: 'p', text: "The real issue: Alphabet is excellent at turning audience into ad revenue, but less good at turning that revenue into free cash. The FCF margin is only 9.1%, and FCF per share is declining 3% per year over 5 years due to massive stock-based compensation (40% of FCF) and Capex investments." },
        { type: 'p', text: "Yet the market values Alphabet at 116.6x FCF, 7x the sector median. That is a multiple that assumes spectacular FCF acceleration. Our buy price of $54 implies an 85% premium above the current $364 price." },
        { type: 'h2', text: 'Adobe (ADBE): the counter-example at 11.7x FCF' },
        { type: 'p', text: "Adobe is the opposite: quality 9/10 (23/25 criteria), 34% FCF margin, 153% Cash ROCE, -28 day cash cycle, 10.9% FCF per share growth. Yet the P/FCF is only 11.7x, its lowest in history." },
        { type: 'p', text: "The market crushed Adobe over generative AI fears (Midjourney, Canva) and slowing growth (11% per year versus 20% before). But free cash flow keeps growing. The result: a huge gap between real quality (9/10) and market perception." },
        { type: 'p', text: "That said, even at this price, valuation is not a clear bargain. Our recommended buy price is $149, 37% below the current $238 price. But with such thin margins of safety elsewhere in tech, Adobe is relatively the most affordable of the three." },
        { type: 'h2', text: 'Lessons for investors' },
        { type: 'p', text: 'Three tech companies, three very different realities. The lesson is simple:' },
        { type: 'ul', items: [
          'Multiple does not tell everything: Adobe is 10x cheaper than Alphabet on FCF, yet its quality is far superior.',
          'FCF per share growth is the real arbiter: Microsoft (4.8%) and Alphabet (-3.0%) fail where Adobe (10.9%) succeeds.',
          'Massive stock-based compensation at Alphabet (40% of FCF) and Microsoft (17%) explains why FCF per share barely grows despite 13% revenue growth.',
        ]},
        { type: 'p', text: "As always at Lubin Investment, the answer is not binary. Each stock has its strengths and weaknesses. Type the ticker into the analyzer and see for yourself where the fair price sits." },
      ],
      faq: [
        { q: "What is Microsoft's P/FCF in 2026?", a: 'Microsoft trades at 49.7x free cash flow, with a quality score of 8/10. Lubin\'s recommended buy price is $144, 64% below the current $403 price.' },
        { q: 'Why does Alphabet have such a high P/FCF?', a: 'Alphabet trades at 116.6x FCF despite a quality score of only 6/10 and FCF per share declining 3% per year. Stock-based compensation absorbs 40% of FCF.' },
        { q: 'Is Adobe a bargain at 11.7x FCF?', a: "Adobe (quality 9/10) is at its historic low P/FCF. But the buy price of $149 remains 37% below the current $238 price. It is the cheapest of the three but not an obvious bargain." },
        { q: 'Why is FCF per share more important than revenue?', a: 'Revenue can grow without benefiting shareholders if stock-based compensation dilutes shares or investments fail to generate cash. FCF per share measures real value creation per share.' },
        { q: 'Is big tech overvalued in June 2026?', a: 'Not as a block. Some names (Alphabet, Microsoft) are priced for perfection. Others (Adobe) are at historic lows. The 2026 value rotation is creating enormous disparities within tech itself.' },
      ],
      tags: ['Analysis', 'Microsoft', 'Alphabet', 'Adobe', 'Valuation'],
      disclaimer:
        'This article is an analysis for informational and educational purposes and is not personalized investment advice. Past performance does not guarantee future results. Figures as of June 10, 2026, subject to change. Do your own research.',
    },
    es: {
      title: '¿Paga la tecnología demasiado por sus flujos de caja ? (MSFT, GOOGL, ADBE)',
      excerpt:
        'Microsoft cotiza a 49,7x sus flujos de caja, Alphabet a 116,6x, Adobe a solo 11,7x. La tecnología no es un bloque homogéneo: tres gigantes bajo la lupa.',
      metaDescription:
        'MSFT a 49,7x FCF, GOOGL a 116,6x, ADBE a 11,7x. Análisis de valoraciones tecnológicas por Lubin Investment — algunos gigantes cotizan como si la perfección estuviera garantizada.',
      answer:
        'No, la tecnología no paga demasiado por sus flujos de caja en todas partes — pero algunos casos son extremos. Microsoft (P/FCF 49,7x, calidad 8/10) cotiza a 3x su precio de compra recomendado. Alphabet (P/FCF 116,6x, calidad 6/10) está en una burbuja de múltiplos con FCF por acción en caída del 3 % anual. Adobe (P/FCF 11,7x, calidad 9/10), en cambio, está en su mínimo histórico pese a un margen FCF del 34 % y un crecimiento saludable.',
      body: [
        { type: 'h2', text: 'La tecnología no es un sector, es un mosaico de modelos de negocio' },
        { type: 'p', text: 'Cuando se dice «la tecnología es demasiado cara», se mezcla todo. Microsoft obtiene 39 centavos de margen neto por dólar de ingreso. Alphabet también, con un 38 %. Adobe: 29 %. Todos son muy rentables. Pero la forma en que el mercado los valora no tiene nada que ver.' },
        { type: 'p', text: 'En Lubin Investment, separamos la calidad del precio. Y el veredicto es matizado: los tres son negocios de calidad, pero dos cotizan a niveles que suponen perfección.' },
        { type: 'ul', items: [
          'MSFT: calidad 8/10, P/FCF 49,7x, sobrevaloración del 64 %',
          'GOOGL: calidad 6/10, P/FCF 116,6x, sobrevaloración del 85 %, FCF por acción en caída',
          'ADBE: calidad 9/10, P/FCF 11,7x, mínimo histórico, el más barato de los tres',
          'El FCF por acción es el verdadero juez de la creación de valor',
          'La rotación value amplía las brechas de valoración dentro de la tecnología',
        ]},
        { type: 'h2', text: 'Microsoft (MSFT): un 8/10 a 49,7x el FCF' },
        { type: 'p', text: 'Microsoft valida 8 de 10 criterios. Es un negocio excelente: margen neto del 39 %, crecimiento de ingresos del 13,5 % anual, ciclo de caja negativo de -62 días, recompras regulares.' },
        { type: 'p', text: 'Pero dos cosas parpadean en rojo: el FCF por acción solo crece un 4,8 % anual (por debajo del umbral del 10 %), y el ratio de conversión de caja es de solo 0,48. El culpable: la inversión masiva en IA, que consume caja sin transformarla inmediatamente en FCF.' },
        { type: 'p', text: 'A 49,7x el FCF, el mercado paga Microsoft como si el crecimiento fuera a acelerarse. Nuestro modelo de valoración da un precio de compra de 144 dólares, un 64 % por debajo del precio actual de 403 dólares.' },
        { type: 'h2', text: 'Alphabet (GOOGL): un 6/10 a 116,6x el FCF' },
        { type: 'p', text: 'Alphabet es el caso más extremo. La calidad es solo de 6/10: dos criterios fallan claramente (crecimiento del FCF por acción del -3,0 % anual, Cash ROCE del 9,2 % bajo el 15 %), dos están en advertencia.' },
        { type: 'p', text: 'El verdadero problema: Alphabet es excelente convirtiendo audiencia en ingresos publicitarios, pero menos convirtiendo esos ingresos en caja libre. El margen FCF es de solo el 9,1 %, y el FCF por acción cae un 3 % anual por el stock-based compensation masivo (40 % del FCF).' },
        { type: 'p', text: 'Sin embargo, el mercado valora Alphabet a 116,6x el FCF — 7 veces la mediana del sector. Nuestro precio de compra de 54 dólares implica una sobrevaloración del 85 % sobre los 364 dólares actuales.' },
        { type: 'h2', text: 'Adobe (ADBE): el contraejemplo a 11,7x el FCF' },
        { type: 'p', text: 'Adobe es lo contrario: calidad 9/10 (23/25 criterios), margen FCF del 34 %, Cash ROCE del 153 %, ciclo de caja negativo de -28 días, crecimiento del FCF por acción del 10,9 % anual. Y el P/FCF es de solo 11,7x — su mínimo histórico.' },
        { type: 'p', text: 'El mercado ha masacrado Adobe por el miedo a la IA generativa (Midjourney, Canva) y la ralentización del crecimiento. Pero el flujo de caja libre sigue creciendo. El resultado: una brecha enorme entre la calidad real (9/10) y la percepción del mercado.' },
        { type: 'p', text: 'Atención: incluso a este precio, la valoración no es una ganga evidente. Nuestro precio de compra es de 149 dólares, un 37 % por debajo de los 238 dólares actuales. Pero es el más asequible de los tres.' },
        { type: 'h2', text: 'Lecciones para el inversor' },
        { type: 'p', text: 'Tres empresas tecnológicas, tres realidades muy diferentes:' },
        { type: 'ul', items: [
          'El múltiplo no lo dice todo: Adobe es 10 veces más barato que Alphabet en FCF, pero su calidad es muy superior.',
          'El crecimiento del FCF por acción es el verdadero juez: Microsoft (4,8 %) y Alphabet (-3,0 %) fracasan donde Adobe (10,9 %) tiene éxito.',
          'El stock-based compensation masivo de Alphabet (40 % del FCF) y Microsoft (17 %) explica por qué el FCF por acción apenas crece pese a ingresos al alza del 13 %.',
        ]},
        { type: 'p', text: 'Como siempre en Lubin Investment, la respuesta no es binaria. Cada acción tiene sus puntos fuertes y débiles. Escriba el ticker en el analizador y compruebe dónde está el precio justo.' },
      ],
      faq: [
        { q: '¿Cuál es el P/FCF de Microsoft en 2026?', a: 'Microsoft cotiza a 49,7x el flujo de caja libre, con una calidad de 8/10. Nuestro precio de compra es de 144 dólares, un 64 % por debajo del precio actual de 403 dólares.' },
        { q: '¿Por qué Alphabet tiene un P/FCF tan alto?', a: 'Alphabet está a 116,6x el FCF pese a una calidad de solo 6/10 y un FCF por acción en caída del 3 % anual. El stock-based compensation absorbe el 40 % del FCF.' },
        { q: '¿Es Adobe una ganga a 11,7x el FCF?', a: 'Adobe (calidad 9/10) está en su mínimo histórico de P/FCF. Pero el precio de compra de 149 dólares sigue un 37 % por debajo de los 238 dólares actuales. Es el más barato de los tres, pero no una ganga evidente.' },
        { q: '¿Por qué es más importante el FCF por acción que los ingresos?', a: 'Los ingresos pueden crecer sin que el accionista se beneficie si el stock-based compensation diluye las acciones. El FCF por acción mide la creación de valor real por acción.' },
        { q: '¿Está la tecnología sobrevalorada en junio 2026?', a: 'No en bloque. Alphabet y Microsoft cotizan como si la perfección estuviera garantizada. Adobe está en mínimos históricos. La rotación value de 2026 crea disparidades enormes dentro de la propia tecnología.' },
      ],
      tags: ['Análisis', 'Microsoft', 'Alphabet', 'Adobe', 'Valoración'],
      disclaimer:
        'Este artículo es un análisis con fines informativos y educativos y no constituye asesoramiento de inversión personalizado. Las rentabilidades pasadas no garantizan resultados futuros. Cifras a 10 de junio de 2026, sujetas a cambios. Haz tu propia investigación.',
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
