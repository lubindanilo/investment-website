/**
 * BlogPage — page index du blog Lubin Investment.
 *
 * État actuel : pas encore d'articles publiés. La page sert de :
 *   1. Page de réservation SEO (URL /blog indexable dès le lancement)
 *   2. Accroche pour newsletter (collecte d'emails « bientôt »)
 *   3. Structure prête à recevoir des articles via le tableau ARTICLES ci-dessous.
 *
 * Pour ajouter un article plus tard : pousser un objet dans ARTICLES + créer la page
 * /blog/[slug] (route à ajouter ultérieurement avec un système MDX ou markdown statique).
 *
 * TODO i18n : extraire vers locales/*.json en sprint 3 quand on aura plusieurs articles.
 */
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './BlogPage.css';

// Articles publiés. Vide pour l'instant — premier article à venir.
const ARTICLES: Array<{
  slug: string;
  title: string;
  excerpt: string;
  date: string;       // ISO YYYY-MM-DD
  readingTime: number; // en minutes
  tags: string[];
}> = [
  // À VENIR :
  // {
  //   slug: 'pourquoi-le-fcf-est-meilleur-que-le-pnl',
  //   title: 'Pourquoi le free cash flow est plus fiable que le bénéfice net',
  //   excerpt: 'Le bénéfice net comptable se manipule. Le cash, lui, ne ment pas. Plongée dans la métrique que les compounders surveillent en priorité.',
  //   date: '2026-07-01',
  //   readingTime: 7,
  //   tags: ['Méthode', 'Fondamentaux'],
  // },
];

// Thèmes prévus pour les premiers articles (signal éditorial pour les lecteurs et Google).
const UPCOMING_TOPICS = [
  'La méthode Lubin expliquée critère par critère',
  'Lire un 10-K en 15 minutes : la cheat sheet',
  'Cash ROCE vs ROIC : pourquoi nous avons choisi la version de Bettin-Mauboussin',
  'Théil-Sen vs moindres carrés : pourquoi la médiane des pentes change tout',
  '5 pièges des fiches Yahoo Finance que personne ne mentionne',
  'Pourquoi nous excluons l\'or et les commodities de notre univers',
];

export function BlogPage() {
  return (
    <div className="blog">
      <SeoHead titleKey="seo.blog.title" descKey="seo.blog.desc" />
      <div className="wrap blog-wrap">

        {/* Hero */}
        <header className="blog-hero">
          <div className="blog-hero-chip">{ARTICLES.length === 0 ? 'Bientôt en ligne' : 'Le blog'}</div>
          <h1 className="blog-hero-title">
            Comprendre les marchés avec méthode
          </h1>
          <p className="blog-hero-lede">
            Analyses fondamentales, décryptages de méthode, plongées dans les fondamentaux des
            entreprises de qualité. Le contenu que nous aurions aimé lire avant d'investir
            notre premier euro.
          </p>
        </header>

        {/* État liste d'articles */}
        {ARTICLES.length === 0 ? (
          <ComingSoonState />
        ) : (
          <section className="blog-list">
            {ARTICLES.map(article => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </section>
        )}

        {/* Thèmes à venir */}
        {ARTICLES.length === 0 && (
          <section className="blog-upcoming">
            <h2 className="blog-section-title">Ce qui arrive bientôt</h2>
            <ul className="blog-upcoming-list">
              {UPCOMING_TOPICS.map((topic, i) => (
                <li key={i} className="blog-upcoming-item">
                  <span className="blog-upcoming-num">{(i + 1).toString().padStart(2, '0')}</span>
                  <span className="blog-upcoming-text">{topic}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA final */}
        <section className="blog-cta">
          <h2 className="blog-cta-title">En attendant : commence à analyser</h2>
          <p className="blog-cta-sub">
            La meilleure façon de comprendre la méthode, c'est de l'appliquer. Tape un ticker,
            obtiens une note en quelques secondes.
          </p>
          <Link to="/analyser" className="btn btn-brand blog-cta-btn">
            Analyser une action <Icon name="arrowRight" size={16} />
          </Link>
        </section>

      </div>
    </div>
  );
}

function ComingSoonState() {
  return (
    <section className="blog-empty">
      <div className="blog-empty-card">
        <div className="blog-empty-icon"><Icon name="info" size={28} /></div>
        <h2 className="blog-empty-title">Premier article en cours de rédaction</h2>
        <p className="blog-empty-text">
          On prépare le terrain. Le premier article — sur les pièges du bénéfice net comptable
          face au free cash flow — sortira dans les prochaines semaines.
        </p>
        <p className="blog-empty-text" style={{ marginTop: 12 }}>
          En attendant, tu peux consulter la <Link to="/methodologie" className="blog-link">méthodologie complète</Link> du
          scoring sur 10 critères, ou explorer le <Link to="/screener" className="blog-link">screener</Link> des
          meilleures entreprises notées par notre veille.
        </p>
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: typeof ARTICLES[number] }) {
  return (
    <article className="blog-card">
      <div className="blog-card-meta">
        <time dateTime={article.date} className="blog-card-date">
          {new Date(article.date + 'T12:00:00Z').toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </time>
        <span className="blog-card-readingTime">· {article.readingTime} min de lecture</span>
      </div>
      <h2 className="blog-card-title">
        <Link to={`/blog/${article.slug}`}>{article.title}</Link>
      </h2>
      <p className="blog-card-excerpt">{article.excerpt}</p>
      <div className="blog-card-tags">
        {article.tags.map(tag => (
          <span key={tag} className="blog-card-tag">{tag}</span>
        ))}
      </div>
    </article>
  );
}
