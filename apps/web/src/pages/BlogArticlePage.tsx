/**
 * BlogArticlePage — page détail d'un article (/blog/:slug), rendue dans la langue
 * active. Le contenu vient de @lubin/shared (source unique partagée avec le prérendu
 * bots et le sitemap). Voir packages/shared/src/articles.ts.
 */
import type { ReactNode } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getArticleBySlug, toArticleLang, companyDisplayName, type ArticleBlock, type ArticleLang } from '@lubin/shared';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './BlogArticlePage.css';

const LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };

// Auteur (E-E-A-T / YMYL) : signature + bio courte, basées sur l'expérience réelle
// (autodidacte, investit son propre argent), affichées aussi aux lecteurs humains.
const AUTHOR: Record<ArticleLang, { byline: string; heading: string; intro: string; quote: string }> = {
  fr: {
    byline: 'Par Lubin Danilo',
    heading: "À propos de l'auteur",
    intro: 'Lubin Danilo, fondateur de Lubin Investment.',
    quote: "Investisseur particulier autodidacte, l'analyse fondamentale me passionne et m'a donné d'excellents résultats. Cela fait désormais trois années que ma performance bat le S&P 500. Mais analyser chaque action me prenait trop de temps : des sites aux données incomplètes, des méthodes de calcul et des critères jamais alignés sur les miens. Et repérer les meilleures actions était tout aussi chronophage, même avec ma liste de critères bien définie. J'ai donc mis mon expérience en développement à profit pour créer ce logiciel, fonder ma stratégie d'investissement sur ses résultats et le partager avec ceux qui ont la même vision.",
  },
  en: {
    byline: 'By Lubin Danilo',
    heading: 'About the author',
    intro: 'Lubin Danilo, founder of Lubin Investment.',
    quote: 'A self-taught individual investor, I find fundamental analysis fascinating, and it has delivered excellent results. For three years now, my performance has beaten the S&P 500. But analyzing every stock took too much time: sites with incomplete data, calculation methods and criteria never aligned with mine. And spotting the best stocks was just as time-consuming, even with my own well-defined checklist. So I put my software development background to work to build this software, base my investment strategy on its results, and share it with those who have the same vision.',
  },
  es: {
    byline: 'Por Lubin Danilo',
    heading: 'Sobre el autor',
    intro: 'Lubin Danilo, fundador de Lubin Investment.',
    quote: 'Inversor particular autodidacta, el análisis fundamental me apasiona y me ha dado resultados excelentes. Desde hace ya tres años, mi rentabilidad supera al S&P 500. Pero analizar cada acción me llevaba demasiado tiempo: sitios con datos incompletos, métodos de cálculo y criterios nunca alineados con los míos. Y detectar las mejores acciones era igual de laborioso, incluso con mi lista de criterios bien definida. Por eso aproveché mi experiencia en desarrollo para crear este software, basar mi estrategia de inversión en sus resultados y compartirlo con quienes tienen la misma visión.',
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
  const { t, i18n } = useTranslation();
  const article = slug ? getArticleBySlug(slug) : undefined;

  if (!article) return <Navigate to="/blog" replace />;

  const lang = toArticleLang(i18n.language);
  const c = article.content[lang];
  const dateLabel = new Date(article.date + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Groupe de CTA identique en tête (sous le titre) et en fin d'article.
  // L'analyse de la société de l'article est en secondaire (fond blanc, btn-ghost) ;
  // les 2 CTA génériques (analyser / opportunités) sont en primaire (fond bleu, btn-brand).
  const ctaGroup = (
    <div className="article-cta-group">
      {article.ticker && (
        <Link to={`/analyse/${article.ticker}`} className="btn btn-ghost">
          {t('blog.ctaSeeAnalysis', { name: companyDisplayName(article.ticker) })} <Icon name="arrowRight" size={16} />
        </Link>
      )}
      <Link to="/analyser" className="btn btn-brand">
        {t('blog.ctaAnalyzeStock')} <Icon name="arrowRight" size={16} />
      </Link>
      <Link to="/screener?opp=1" className="btn btn-brand">
        {t('blog.ctaOpportunities')} <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );

  return (
    <div className="blog">
      <SeoHead title={c.title} description={c.metaDescription} type="article" />
      <div className="wrap article-wrap">

        <nav className="article-breadcrumb" aria-label={t('common.breadcrumb')}>
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
          <div className="article-header-cta">{ctaGroup}</div>
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
        <section className="article-cta">{ctaGroup}</section>

        <section className="article-author">
          <h2 className="article-h2">{AUTHOR[lang].heading}</h2>
          <p className="article-author-intro">{AUTHOR[lang].intro}</p>
          <blockquote className="article-author-quote">{AUTHOR[lang].quote}</blockquote>
        </section>

        <p className="article-disclaimer">{c.disclaimer}</p>

      </div>
    </div>
  );
}
