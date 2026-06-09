/**
 * BlogArticlePage — page détail d'un article (/blog/:slug), rendue dans la langue
 * active. Le contenu vient de @lubin/shared (source unique partagée avec le prérendu
 * bots et le sitemap). Voir packages/shared/src/articles.ts.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getArticleBySlug, toArticleLang, type ArticleBlock } from '@lubin/shared';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './BlogArticlePage.css';

const LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };

function renderBlock(block: ArticleBlock, i: number) {
  if (block.type === 'h2') return <h2 key={i} className="article-h2">{block.text}</h2>;
  if (block.type === 'ul') {
    return (
      <ul key={i} className="article-ul">
        {block.items.map((it, j) => <li key={j}>{it}</li>)}
      </ul>
    );
  }
  return <p key={i} className="article-p">{block.text}</p>;
}

export function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const article = slug ? getArticleBySlug(slug) : undefined;

  if (!article) return <Navigate to="/blog" replace />;

  const lang = toArticleLang(i18n.language);
  const c = article.content[lang];
  const dateLabel = new Date(article.date + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="blog">
      <SeoHead title={c.title} description={c.metaDescription} type="article" />
      <div className="wrap article-wrap">

        <nav className="article-breadcrumb" aria-label="Fil d'Ariane">
          <Link to="/">Lubin Investment</Link> <span>›</span> <Link to="/blog">Blog</Link>
        </nav>

        <header className="article-header">
          <div className="article-tags">
            {c.tags.map((tag) => <span key={tag} className="blog-card-tag">{tag}</span>)}
          </div>
          <h1 className="article-title">{c.title}</h1>
          <div className="article-meta">
            <time dateTime={article.date}>{dateLabel}</time>
            <span>· {article.readingTime} min</span>
          </div>
        </header>

        {/* Réponse auto-portée (answer-first) */}
        <p className="article-lead">{c.answer}</p>

        <article className="article-body">
          {c.body.map(renderBlock)}
        </article>

        {/* FAQ */}
        <section className="article-faq">
          <h2 className="article-h2">FAQ</h2>
          {c.faq.map((f, i) => (
            <details key={i} className="article-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        {/* CTA */}
        <section className="article-cta">
          {article.ticker ? (
            <Link to={`/analyse/${article.ticker}`} className="btn btn-brand">
              Voir l'analyse {article.ticker} <Icon name="arrowRight" size={16} />
            </Link>
          ) : (
            <Link to="/analyser" className="btn btn-brand">
              Analyser une action <Icon name="arrowRight" size={16} />
            </Link>
          )}
        </section>

        <p className="article-disclaimer">{c.disclaimer}</p>

      </div>
    </div>
  );
}
