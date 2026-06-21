/**
 * BlogArticlePage — page détail d'un article (/blog/:slug), rendue dans la langue
 * active. Le contenu vient de @lubin/shared (source unique partagée avec le prérendu
 * bots et le sitemap). Voir packages/shared/src/articles.ts.
 */
import type { ReactNode } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getArticleBySlug, toArticleLang, type ArticleBlock, type ArticleLang } from '@lubin/shared';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './BlogArticlePage.css';

const LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };

// Auteur (E-E-A-T / YMYL) : signature + bio courte, basées sur l'expérience réelle
// (autodidacte, investit son propre argent), affichées aussi aux lecteurs humains.
const AUTHOR: Record<ArticleLang, { byline: string; heading: string; bio: string }> = {
  fr: {
    byline: 'Par Lubin Danilo',
    heading: "À propos de l'auteur",
    bio: "Lubin Danilo, fondateur de Lubin Investment. Investisseur particulier autodidacte, j'analyse les actions par les fondamentaux depuis plusieurs années et j'investis mon propre argent avec cette méthode, que j'ai codifiée dans cet outil.",
  },
  en: {
    byline: 'By Lubin Danilo',
    heading: 'About the author',
    bio: 'Lubin Danilo, founder of Lubin Investment. A self-taught individual investor, I have analyzed stocks through their fundamentals for several years and invest my own money with this method, which I codified into this tool.',
  },
  es: {
    byline: 'Por Lubin Danilo',
    heading: 'Sobre el autor',
    bio: 'Lubin Danilo, fundador de Lubin Investment. Inversor particular autodidacta, analizo acciones por sus fundamentales desde hace varios años e invierto mi propio dinero con este método, que codifiqué en esta herramienta.',
  },
};

// Rend le texte en transformant les liens markdown [libellé](/url) en vrais liens.
// Interne (/...) -> <Link> (navigation SPA) ; externe (http...) -> <a target=_blank>.
const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
function renderText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  MD_LINK.lastIndex = 0;
  while ((m = MD_LINK.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const label = m[1] ?? '';
    const href = m[2] ?? '';
    if (href.startsWith('/')) {
      nodes.push(<Link key={k++} to={href}>{label}</Link>);
    } else {
      nodes.push(<a key={k++} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlock(block: ArticleBlock, i: number) {
  if (block.type === 'h2') return <h2 key={i} className="article-h2">{block.text}</h2>;
  if (block.type === 'ul') {
    return (
      <ul key={i} className="article-ul">
        {block.items.map((it, j) => <li key={j}>{renderText(it)}</li>)}
      </ul>
    );
  }
  if (block.type === 'table') {
    return (
      <div key={i} className="article-table-wrap" style={{ overflowX: 'auto', margin: '1.5rem 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.95rem' }}>
          <thead>
            <tr>
              {block.headers.map((h, j) => (
                <th key={j} style={{ border: '1px solid var(--color-border, #e5e7eb)', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'var(--color-surface2, #f9fafb)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ border: '1px solid var(--color-border, #e5e7eb)', padding: '0.5rem 0.75rem' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p key={i} className="article-p">{renderText(block.text)}</p>;
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
            <span rel="author">{AUTHOR[lang].byline}</span>
            <time dateTime={article.date}>· {dateLabel}</time>
            <span>· {article.readingTime} min</span>
          </div>
        </header>

        {/* Réponse auto-portée (answer-first) */}
        <p className="article-lead">{renderText(c.answer)}</p>

        <article className="article-body">
          {c.body.map(renderBlock)}
        </article>

        {/* FAQ */}
        <section className="article-faq">
          <h2 className="article-h2">FAQ</h2>
          {c.faq.map((f, i) => (
            <details key={i} className="article-faq-item">
              <summary>{f.q}</summary>
              <p>{renderText(f.a)}</p>
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

        <section className="article-author">
          <h2 className="article-h2">{AUTHOR[lang].heading}</h2>
          <p>{AUTHOR[lang].bio}</p>
        </section>

        <p className="article-disclaimer">{c.disclaimer}</p>

      </div>
    </div>
  );
}
