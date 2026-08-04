/**
 * Vérificateur public de visibilité IA — outil gratuit, sans compte.
 *
 * Deux entrées :
 *   /visibilite-ia                       → formulaire vide
 *   /visibilite-ia/exemple.fr/une-page   → lance la vérif au chargement (URL partageable)
 *
 * L'URL cible vit dans le CHEMIN, pas dans un paramètre de requête : c'est ce qui rend le
 * résultat partageable proprement, et ce qui permet à un lien partagé de rester frais (la
 * vérif est rejouée, avec un cache CDN de 10 min côté API).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SeoHead from '../components/SeoHead.js';
import './AiVisibilityPage.css';

type Verdict = 'ssr' | 'dynamic' | 'invisible' | 'thin';

interface Finding {
  id: string;
  level: 'blocking' | 'warn' | 'ok' | 'info';
  title: string;
  detail: string;
  evidence: string;
}

interface Report {
  url: string;
  finalUrl: string;
  checkedAt: string;
  verdict: Verdict;
  botWords: number;
  rawWords: number;
  title: string | null;
  h1: string | null;
  isHtml: boolean;
  hasJsonLd: boolean;
  excerpt: string;
  findings: Finding[];
}

const API = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';

export function AiVisibilityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  // La route est déclarée en `/visibilite-ia/*` : la cible est dans le splat.
  const target = (params['*'] ?? '').trim();

  const [input, setInput] = useState(target);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastChecked = useRef<string | null>(null);

  const run = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`${API}/api/ai-visibility/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as Report & { error?: string };
      if (!res.ok) {
        setError(data.error ?? t('aiVisibility.errGeneric'));
        return;
      }
      setReport(data);
    } catch {
      setError(t('aiVisibility.errNetwork'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Lien partagé : on lance la vérif au chargement, une seule fois par cible.
  useEffect(() => {
    if (!target || lastChecked.current === target) return;
    lastChecked.current = target;
    setInput(target);
    void run(target);
  }, [target, run]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = input.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!clean) return;
    // On passe par l'URL : le résultat devient partageable, et le bouton retour marche.
    navigate(`/visibilite-ia/${clean}`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers refusé : on n'affiche rien plutôt qu'une erreur inutile */
    }
  }

  const verdictLabel = report ? t(`aiVisibility.verdict.${report.verdict}.label`) : '';
  const verdictSub = report ? t(`aiVisibility.verdict.${report.verdict}.sub`) : '';

  return (
    <div className="aiv">
      <SeoHead
        title={
          report
            ? t('aiVisibility.seoTitleResult', { n: report.botWords, host: safeHost(report.url) })
            : t('seo.aiVisibility.title')
        }
        descKey={report ? undefined : 'seo.aiVisibility.desc'}
        description={report ? verdictSub : undefined}
      />

      <header className="aiv-hero">
        <h1 className="aiv-h1">{t('aiVisibility.h1')}</h1>
        <p className="aiv-lede">{t('aiVisibility.lede')}</p>

        <form className="aiv-form" onSubmit={onSubmit}>
          <input
            className="aiv-input"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={t('aiVisibility.placeholder')}
            aria-label={t('aiVisibility.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn btn-brand aiv-submit" type="submit" disabled={loading || !input.trim()}>
            {loading ? t('aiVisibility.checking') : t('aiVisibility.cta')}
          </button>
        </form>
        <p className="aiv-note">{t('aiVisibility.noAccount')}</p>
      </header>

      {loading && (
        <div className="aiv-loading" role="status">
          <span className="aiv-spinner" aria-hidden="true" />
          <span>{t('aiVisibility.loadingDetail')}</span>
        </div>
      )}

      {error && !loading && (
        <div className="aiv-error" role="alert">
          <strong>{t('aiVisibility.errTitle')}</strong>
          <span>{error}</span>
        </div>
      )}

      {report && !loading && (
        <>
          <section className={`aiv-result aiv-result--${report.verdict}`} aria-live="polite">
            <div className="aiv-figure">
              <span className="aiv-number num">{report.botWords.toLocaleString('fr-FR')}</span>
              <span className="aiv-unit">{t('aiVisibility.wordsSeen')}</span>
            </div>
            <div className="aiv-verdict">
              <span className={`aiv-badge aiv-badge--${report.verdict}`}>{verdictLabel}</span>
              <p className="aiv-verdict-sub">{verdictSub}</p>
              <dl className="aiv-compare">
                <div>
                  <dt>{t('aiVisibility.botSees')}</dt>
                  <dd className="num">{report.botWords.toLocaleString('fr-FR')}</dd>
                </div>
                <div>
                  <dt>{t('aiVisibility.rawSees')}</dt>
                  <dd className="num">{report.rawWords.toLocaleString('fr-FR')}</dd>
                </div>
              </dl>
              <div className="aiv-actions">
                <button type="button" className="btn btn-ghost" onClick={copyLink}>
                  {copied ? t('aiVisibility.copied') : t('aiVisibility.share')}
                </button>
              </div>
            </div>
          </section>

          {report.excerpt && (
            <section className="aiv-excerpt">
              <h2 className="aiv-h2">{t('aiVisibility.excerptTitle')}</h2>
              <p className="aiv-excerpt-body">
                {report.excerpt}
                {report.excerpt.length >= 400 ? '…' : ''}
              </p>
            </section>
          )}

          <section className="aiv-findings">
            <h2 className="aiv-h2">{t('aiVisibility.findingsTitle')}</h2>
            <ul className="aiv-list">
              {report.findings.map((f) => (
                <li key={`${f.id}-${f.title}`} className={`aiv-item aiv-item--${f.level}`}>
                  <div className="aiv-item-head">
                    <span className="aiv-item-id">{f.id}</span>
                    <h3 className="aiv-item-title">{f.title}</h3>
                  </div>
                  <p className="aiv-item-detail">{f.detail}</p>
                  <span className="aiv-item-evidence" title={t('aiVisibility.evidenceHelp')}>
                    {f.evidence}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="aiv-next">
            <h2 className="aiv-h2">{t('aiVisibility.nextTitle')}</h2>
            <p className="aiv-next-body">{t('aiVisibility.nextBody')}</p>
            <div className="aiv-actions">
              <Link className="btn btn-brand" to="/pricing">{t('aiVisibility.nextCta')}</Link>
              <button type="button" className="btn btn-ghost" onClick={() => { setReport(null); setInput(''); navigate('/visibilite-ia'); }}>
                {t('aiVisibility.checkAnother')}
              </button>
            </div>
          </section>
        </>
      )}

      <section className="aiv-how">
        <h2 className="aiv-h2">{t('aiVisibility.howTitle')}</h2>
        <p className="aiv-how-body">{t('aiVisibility.howBody')}</p>
        <p className="aiv-how-body">{t('aiVisibility.howBody2')}</p>
      </section>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default AiVisibilityPage;
