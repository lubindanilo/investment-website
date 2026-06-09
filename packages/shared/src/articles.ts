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

export const ARTICLES: Article[] = [adobe];

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
