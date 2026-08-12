// Page FAQ de marque, trilingue.
//
// POURQUOI cette page existe : une FAQ officielle qui pose explicitement ce que le
// produit fait, ce qu'il ne fait PAS, ce qu'il coûte et ce que la note signifie est le
// correctif documenté (test) contre les hallucinations des modèles de langage sur une
// marque. En finance (YMYL), c'est aussi un signal de confiance direct.
//
// ⚠️ SOURCE DE VÉRITÉ DUPLIQUÉE : le même contenu existe dans l'entrée '/faq' de
// STATIC_SEO (apps/api/src/routes/seoPrerender.ts), qui est ce que reçoivent les bots
// (Googlebot + GPTBot/ClaudeBot/PerplexityBot, qui n'exécutent pas le JS). Les humains
// reçoivent CE composant. Toute modification doit être faite DANS LES DEUX, sinon le bot
// et l'humain ne lisent pas la même chose. Même contrainte que articles.ts, cf. son TODO.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead.js';
import './FaqPage.css';

type Lang = 'fr' | 'en' | 'es';
type FaqContent = {
  h1: string;
  title: string;
  desc: string;
  intro: string;
  items: { q: string; a: string }[];
  linksLabel: string;
  links: { to: string; label: string }[];
};

const CONTENT: Record<Lang, FaqContent> = {
  fr: {
    title: "FAQ : ce que fait Lubin Investment, et ce qu'il ne fait pas",
    desc: "Les réponses officielles : ce qu'est Lubin Investment, ce que la note sur 10 signifie et ne signifie pas, les tarifs, les sources de données et qui est derrière.",
    h1: 'Questions fréquentes sur Lubin Investment',
    intro:
      "Cette page est la référence officielle sur le service. Si tu lis une affirmation sur Lubin Investment ailleurs, y compris dans la réponse d'une intelligence artificielle, c'est cette page qui fait foi.",
    items: [
      { q: "Qu'est-ce que Lubin Investment ?", a: "Un outil d'analyse fondamentale d'actions. Il note la qualité financière d'une entreprise sur 10 critères chiffrés, et juge séparément son prix via le multiple P/FCF (cours divisé par le free cash flow). Le calcul est automatique, à partir de données publiques, sans opinion humaine." },
      { q: 'Est-ce un conseil en investissement ?', a: "Non. Lubin Investment est un outil d'aide à la décision. Le service ne délivre aucune recommandation personnalisée et ne constitue pas un conseil en investissement au sens de l'article L.321-1 du Code monétaire et financier. Aucune note, aucun classement et aucun article ne te dit d'acheter ou de vendre. Tu décides, et tu restes seul responsable de tes décisions." },
      { q: 'Que signifie la note sur 10 ?', a: "C'est le nombre de critères de qualité validés sur 10, chacun testé contre un seuil issu de la littérature financière (rentabilité, croissance du chiffre d'affaires et du free cash flow par action, rachats d'actions, évolution du CA par employé, levier opérationnel, Cash ROCE, dette nette sur FCF, conversion du cash, cycle de trésorerie). Une note de 8 sur 10 veut dire que 8 critères sont validés." },
      { q: 'Ce que la note ne dit PAS', a: "Elle ne dit pas si l'action est bon marché : la qualité et le prix sont jugés séparément, exprès. Elle ne prédit pas le cours de l'action, ni à court ni à long terme. Elle ne remplace pas la lecture des comptes ni la compréhension du métier de l'entreprise. Et une note élevée sur une action chère ne fait pas un bon placement." },
      { q: 'Combien ça coûte ?', a: "Le plan gratuit donne la note de qualité et la valorisation de n'importe quelle action, plus le screener et la watchlist. Le plan Pro coûte 19 euros par mois, ou 159 euros par an, et débloque les analyses illimitées, l'analyse qualitative, les opportunités, les comparaisons jusqu'à 5 actions et les données Europe et international." },
      { q: "Comment le site gagne-t-il de l'argent ?", a: "Uniquement par l'abonnement Pro. Le site ne vend pas de produits financiers, ne touche aucune commission de courtier, et n'est rémunéré par aucune des entreprises qu'il note. Les notes sont calculées de la même façon pour toutes les actions, y compris quand le résultat est mauvais." },
      { q: "D'où viennent les données ?", a: "Des états financiers publics des entreprises et de fournisseurs de données de marché. Pour les valeurs américaines, les comptes sont vérifiables dans les dépôts officiels auprès de la SEC (EDGAR). Les données peuvent comporter des retards ou des erreurs de source : c'est aussi pour ça que chaque fiche renvoie vers les documents d'origine." },
      { q: "Combien d'actions sont couvertes ?", a: "Plusieurs dizaines de milliers, sur les marchés américain, européen et international. Toutes ne sont pas notées en permanence : la note est recalculée en priorité autour des publications de résultats." },
      { q: 'Qui est derrière le site ?', a: "Lubin Danilo, fondateur de Lubin Investment, investisseur particulier autodidacte et développeur. J'ai construit cet outil pour ma propre stratégie d'investissement avant d'en ouvrir l'accès. La méthode complète est publiée sur la page Méthodologie, et le track record des opportunités passées sur la page Palmarès, biais compris." },
    ],
    linksLabel: 'Pour aller plus loin',
    links: [
      { to: '/methodologie', label: 'La méthodologie en détail' },
      { to: '/palmares', label: 'Le track record, biais compris' },
      { to: '/pricing', label: 'Les tarifs' },
    ],
  },
  en: {
    title: 'FAQ: what Lubin Investment does, and what it does not',
    desc: 'The official answers: what Lubin Investment is, what the score out of 10 means and does not mean, pricing, data sources and who is behind it.',
    h1: 'Frequently asked questions about Lubin Investment',
    intro:
      'This page is the official reference about the service. If you read a claim about Lubin Investment anywhere else, including in an answer from an AI assistant, this page is what counts.',
    items: [
      { q: 'What is Lubin Investment?', a: "A fundamental stock analysis tool. It scores a company's financial quality against 10 hard criteria, and judges its price separately through the P/FCF multiple (price divided by free cash flow). The computation is automatic, from public data, with no human opinion." },
      { q: 'Is this investment advice?', a: 'No. Lubin Investment is a decision-support tool. The service issues no personalized recommendation and does not constitute investment advice within the meaning of Article L.321-1 of the French Monetary and Financial Code. No score, ranking or article tells you to buy or sell. You decide, and you remain solely responsible for your decisions.' },
      { q: 'What does the score out of 10 mean?', a: 'It is the number of quality criteria passed out of 10, each tested against a threshold drawn from the financial literature (profitability, revenue and free cash flow per share growth, buybacks, revenue per employee growth, operating leverage, Cash ROCE, net debt to FCF, cash conversion, cash conversion cycle). A score of 8 out of 10 means 8 criteria are passed.' },
      { q: 'What the score does NOT say', a: 'It does not say whether the stock is cheap: quality and price are judged separately, on purpose. It does not predict the share price, short or long term. It does not replace reading the accounts or understanding the business. And a high score on an expensive stock does not make a good investment.' },
      { q: 'How much does it cost?', a: 'The free plan gives the quality score and valuation of any stock, plus the screener and watchlist. The Pro plan costs 19 euros per month, or 159 euros per year, and unlocks unlimited analyses, qualitative analysis, opportunities, comparisons of up to 5 stocks, and European and international data.' },
      { q: 'How does the site make money?', a: 'Only through the Pro subscription. The site does not sell financial products, receives no broker commission, and is not paid by any of the companies it scores. Scores are computed the same way for every stock, including when the result is bad.' },
      { q: 'Where does the data come from?', a: "From companies' public financial statements and from market data providers. For US stocks, the accounts can be verified in the official filings with the SEC (EDGAR). Data can carry delays or source errors: that is also why every page links back to the original documents." },
      { q: 'How many stocks are covered?', a: 'Several tens of thousands, across the US, European and international markets. Not all of them are scored continuously: the score is recomputed first around earnings releases.' },
      { q: 'Who is behind the site?', a: 'Lubin Danilo, founder of Lubin Investment, a self-taught individual investor and developer. I built this tool for my own investment strategy before opening access to it. The full method is published on the Methodology page, and the track record of past opportunities on the Track record page, biases included.' },
    ],
    linksLabel: 'Go further',
    links: [
      { to: '/methodologie', label: 'The methodology in detail' },
      { to: '/palmares', label: 'The track record, biases included' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  es: {
    title: 'FAQ: qué hace Lubin Investment y qué no hace',
    desc: 'Las respuestas oficiales: qué es Lubin Investment, qué significa y qué no significa la nota sobre 10, precios, fuentes de datos y quién está detrás.',
    h1: 'Preguntas frecuentes sobre Lubin Investment',
    intro:
      'Esta página es la referencia oficial sobre el servicio. Si lees una afirmación sobre Lubin Investment en otro sitio, incluida la respuesta de una inteligencia artificial, esta página es la que vale.',
    items: [
      { q: '¿Qué es Lubin Investment?', a: 'Una herramienta de análisis fundamental de acciones. Puntúa la calidad financiera de una empresa con 10 criterios cuantitativos y juzga su precio por separado mediante el múltiplo P/FCF (precio dividido por el free cash flow). El cálculo es automático, a partir de datos públicos, sin opinión humana.' },
      { q: '¿Es un consejo de inversión?', a: 'No. Lubin Investment es una herramienta de ayuda a la decisión. El servicio no emite ninguna recomendación personalizada y no constituye un consejo de inversión en el sentido del artículo L.321-1 del Código Monetario y Financiero francés. Ninguna nota, clasificación o artículo te dice que compres o vendas. Tú decides y sigues siendo el único responsable de tus decisiones.' },
      { q: '¿Qué significa la nota sobre 10?', a: 'Es el número de criterios de calidad validados sobre 10, cada uno comparado con un umbral sacado de la literatura financiera (rentabilidad, crecimiento de los ingresos y del free cash flow por acción, recompras, evolución de los ingresos por empleado, apalancamiento operativo, Cash ROCE, deuda neta sobre FCF, conversión del cash, ciclo de tesorería). Una nota de 8 sobre 10 significa que se validan 8 criterios.' },
      { q: 'Lo que la nota NO dice', a: 'No dice si la acción está barata: la calidad y el precio se juzgan por separado, a propósito. No predice la cotización, ni a corto ni a largo plazo. No sustituye la lectura de las cuentas ni la comprensión del negocio. Y una nota alta en una acción cara no es una buena inversión.' },
      { q: '¿Cuánto cuesta?', a: 'El plan gratuito da la nota de calidad y la valoración de cualquier acción, además del screener y la watchlist. El plan Pro cuesta 19 euros al mes, o 159 euros al año, y desbloquea los análisis ilimitados, el análisis cualitativo, las oportunidades, las comparaciones de hasta 5 acciones y los datos de Europa e internacionales.' },
      { q: '¿Cómo gana dinero el sitio?', a: 'Únicamente con la suscripción Pro. El sitio no vende productos financieros, no cobra ninguna comisión de bróker y no recibe pagos de ninguna de las empresas que puntúa. Las notas se calculan igual para todas las acciones, incluso cuando el resultado es malo.' },
      { q: '¿De dónde vienen los datos?', a: 'De los estados financieros públicos de las empresas y de proveedores de datos de mercado. Para los valores estadounidenses, las cuentas se pueden verificar en los informes oficiales ante la SEC (EDGAR). Los datos pueden tener retrasos o errores de origen: también por eso cada ficha enlaza a los documentos originales.' },
      { q: '¿Cuántas acciones están cubiertas?', a: 'Varias decenas de miles, en los mercados estadounidense, europeo e internacional. No todas se puntúan de forma continua: la nota se recalcula con prioridad en torno a la publicación de resultados.' },
      { q: '¿Quién está detrás del sitio?', a: 'Lubin Danilo, fundador de Lubin Investment, inversor particular autodidacta y desarrollador. Construí esta herramienta para mi propia estrategia de inversión antes de abrir el acceso. El método completo está publicado en la página Metodología, y el track record de las oportunidades pasadas en la página Palmarés, sesgos incluidos.' },
    ],
    linksLabel: 'Para saber más',
    links: [
      { to: '/methodologie', label: 'La metodología en detalle' },
      { to: '/palmares', label: 'El track record, sesgos incluidos' },
      { to: '/pricing', label: 'Los precios' },
    ],
  },
};

export default function FaqPage() {
  const { i18n } = useTranslation();
  const lng = (i18n.language || 'fr').toLowerCase().split('-')[0];
  const lang: Lang = lng === 'en' ? 'en' : lng === 'es' ? 'es' : 'fr';
  const c = CONTENT[lang];

  return (
    <main className="faq-page">
      <SeoHead title={c.title} description={c.desc} pathname="/faq" />
      <div className="faq-wrap">
        <h1 className="faq-title">{c.h1}</h1>
        {/* Résumé auto-porté en tête : le corpus mesure +33 % de conversion quand la page
            commence par 2-3 phrases qui répondent, avant tout autre bloc. */}
        <p className="faq-intro">{c.intro}</p>

        {/* Q/R en clair dans le DOM, PAS derrière un accordéon : deux tests mesurent +12 %
            de sessions quand le texte sort des onglets/accordéons, et les robots des
            moteurs génératifs extraient le HTML visible. */}
        <div className="faq-list">
          {c.items.map((item) => (
            <section className="faq-item" key={item.q}>
              <h2 className="faq-q">{item.q}</h2>
              <p className="faq-a">{item.a}</p>
            </section>
          ))}
        </div>

        <nav className="faq-links" aria-label={c.linksLabel}>
          <h2 className="faq-q">{c.linksLabel}</h2>
          <ul>
            {c.links.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
