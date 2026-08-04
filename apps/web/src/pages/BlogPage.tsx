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
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listArticles, toArticleLang } from '@lubin/shared';
import { api } from '../lib/api.js';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './BlogPage.css';

// Forme d'affichage d'une carte article (dérivée de @lubin/shared, langue active).
type DisplayArticle = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;       // ISO YYYY-MM-DD
  readingTime: number; // en minutes
  tags: string[];
};

// Note : la liste des thèmes à venir (signal éditorial) est désormais dans
// apps/web/src/i18n/locales/*.json (clé blog.upcoming.items) pour être traduite FR/EN/ES.

export function BlogPage() {
  const { t, i18n } = useTranslation();
  const lang = toArticleLang(i18n.language);
  const articles: DisplayArticle[] = listArticles().map((a) => ({
    slug: a.slug,
    date: a.date,
    readingTime: a.readingTime,
    title: a.content[lang].title,
    excerpt: a.content[lang].excerpt,
    tags: a.content[lang].tags,
  }));
  // Liste des thèmes à venir (signal éditorial). Lue depuis les locales pour FR/EN/ES.
  const upcomingTopics: string[] = (t('blog.upcoming.items', { returnObjects: true }) as string[]) ?? [];

  // Recherche par titre. Normalisation (minuscules + suppression des accents) pour
  // que « chemins » matche « Chemins » et « societe » matche « société ».
  const [query, setQuery] = useState('');
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filteredArticles = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return articles;
    return articles.filter((a) => normalize(a.title).includes(q));
  }, [articles, query]);

  return (
    <div className="blog">
      <SeoHead titleKey="seo.blog.title" descKey="seo.blog.desc" />
      <div className="wrap blog-wrap">

        {/* Hero */}
        <header className="blog-hero">
          <div className="blog-hero-chip">{articles.length === 0 ? t('blog.hero.chipComing') : t('blog.hero.chipLive')}</div>
          <h1 className="blog-hero-title">{t('blog.hero.title')}</h1>
          <p className="blog-hero-lede">{t('blog.hero.lede')}</p>
        </header>

        {/* Classements — section ÉPINGLÉE, au-dessus et hors du flux daté des articles.
            Ce sont des sélections recalculées en continu, pas des billets : les mélanger aux
            articles brouillerait les deux formats. C'est aussi le seul maillage interne vers
            ces 17 pages, qui n'étaient liées depuis AUCUNE page du site. */}
        <ClassementsSection />

        {/* Barre de recherche (affichée seulement s'il y a des articles) */}
        {articles.length > 0 && (
          <div className="blog-search">
            <Icon name="search" size={18} className="blog-search-icon" />
            <input
              type="search"
              className="blog-search-input"
              placeholder={t('blog.search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('blog.search.placeholder')}
            />
            {query && (
              <button
                type="button"
                className="blog-search-clear"
                onClick={() => setQuery('')}
                aria-label={t('blog.search.clear')}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        )}

        {/* État liste d'articles */}
        {articles.length === 0 ? (
          <ComingSoonState />
        ) : filteredArticles.length === 0 ? (
          <p className="blog-search-empty">{t('blog.search.noResults', { query: query.trim() })}</p>
        ) : (
          <section className="blog-list">
            {filteredArticles.map(article => (
              <ArticleCard key={article.slug} article={article} locale={i18n.language} />
            ))}
          </section>
        )}

        {/* Thèmes à venir */}
        {articles.length === 0 && upcomingTopics.length > 0 && (
          <section className="blog-upcoming">
            <h2 className="blog-section-title">{t('blog.upcoming.title')}</h2>
            <ul className="blog-upcoming-list">
              {upcomingTopics.map((topic, i) => (
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
          <h2 className="blog-cta-title">{t('blog.cta.title')}</h2>
          <p className="blog-cta-sub">{t('blog.cta.sub')}</p>
          <Link to="/analyser" className="btn btn-brand blog-cta-btn">
            {t('blog.cta.button')} <Icon name="arrowRight" size={16} />
          </Link>
        </section>

      </div>
    </div>
  );
}

/**
 * Section épinglée listant les collections d'intention (/classement/:slug).
 *
 * La liste vient de l'API (`/api/screener/classements`), donc de la même définition
 * `CLASSEMENTS` que le pré-rendu bot : pas de liste de slugs recopiée côté front, qui
 * dériverait au premier ajout de collection.
 *
 * Rendu silencieux si l'appel échoue : le blog doit rester lisible même API en panne.
 */
type ClassementItem = { slug: string; title: string; intro: string };

/** Coupe une intro sur la dernière frontière de mot, sans couper un mot en deux. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}

function ClassementsSection() {
  const { t, i18n } = useTranslation();
  const lang = toArticleLang(i18n.language);
  const [items, setItems] = useState<ClassementItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.screener
      .classements(lang)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { /* section masquée, le reste du blog reste intact */ });
    return () => { cancelled = true; };
  }, [lang]);

  if (items.length === 0) return null;

  // Hiérarchie volontaire : 17 cartes identiques se lisent comme une liste de liens et
  // n'invitent à cliquer sur aucune. Les 3 premières (ordre de déclaration côté API, donc
  // les collections à plus forte intention) prennent une carte large avec un extrait ;
  // le reste passe en cartes compactes. Toutes restent liées, c'est le but du maillage.
  const featured = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <section className="blog-collections" aria-labelledby="blog-collections-title">
      <div className="blog-collections-head">
        <span className="blog-collections-badge">
          <span className="blog-collections-dot" aria-hidden="true" />
          {t('blog.collections.badge')}
        </span>
        <h2 id="blog-collections-title" className="blog-collections-title">
          {t('blog.collections.title')}
        </h2>
        <p className="blog-collections-lede">{t('blog.collections.lede')}</p>
      </div>

      <ul className="blog-collections-featured">
        {featured.map((c, i) => (
          <li key={c.slug}>
            <Link to={`/classement/${c.slug}`} className="blog-collection-card is-featured">
              <span className="blog-collection-num" aria-hidden="true">
                {(i + 1).toString().padStart(2, '0')}
              </span>
              <span className="blog-collection-name">{c.title}</span>
              {c.intro && <span className="blog-collection-intro">{clip(c.intro, 108)}</span>}
              <span className="blog-collection-arrow" aria-hidden="true">
                <Icon name="arrowRight" size={15} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {rest.length > 0 && (
        <ul className="blog-collections-grid">
          {rest.map((c, i) => (
            <li key={c.slug}>
              <Link to={`/classement/${c.slug}`} className="blog-collection-card">
                <span className="blog-collection-num" aria-hidden="true">
                  {(i + 4).toString().padStart(2, '0')}
                </span>
                <span className="blog-collection-name">{c.title}</span>
                <span className="blog-collection-arrow" aria-hidden="true">
                  <Icon name="chevronR" size={15} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ComingSoonState() {
  const { t } = useTranslation();
  return (
    <section className="blog-empty">
      <div className="blog-empty-card">
        <div className="blog-empty-icon"><Icon name="info" size={28} /></div>
        <h2 className="blog-empty-title">{t('blog.empty.title')}</h2>
        <p className="blog-empty-text">{t('blog.empty.text')}</p>
        <p className="blog-empty-text" style={{ marginTop: 12 }}>
          {/* Trans avec liens — on découpe en 3 morceaux pour préserver les <Link>. */}
          {t('blog.empty.also.prefix')}{' '}
          <Link to="/methodologie" className="blog-link">{t('blog.empty.also.methodology')}</Link>
          {t('blog.empty.also.middle')}{' '}
          <Link to="/screener" className="blog-link">{t('blog.empty.also.screener')}</Link>
          {t('blog.empty.also.suffix')}
        </p>
      </div>
    </section>
  );
}

function ArticleCard({ article, locale }: { article: DisplayArticle; locale: string }) {
  const { t } = useTranslation();
  // Locale Intl : 'fr-FR' par défaut. On garde 'fr' / 'en' / 'es' issu d'i18n.language et
  // on les expand en locales valides Intl.
  const intlLocale = locale.startsWith('en') ? 'en-US' : locale.startsWith('es') ? 'es-ES' : 'fr-FR';
  return (
    <article className="blog-card">
      <div className="blog-card-meta">
        <time dateTime={article.date} className="blog-card-date">
          {new Date(article.date + 'T12:00:00Z').toLocaleDateString(intlLocale, {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </time>
        <span className="blog-card-readingTime">· {t('blog.card.readingTime', { minutes: article.readingTime })}</span>
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
