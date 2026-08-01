/**
 * Section 5 : le connecteur MCP. Trois conversations montrent ce que Claude fait
 * réellement avec les 10 outils Lubin (analyser, filtrer le screener, réviser et
 * MODIFIER la watchlist).
 *
 * Les deux premières conversations affichent de la vraie donnée : le titre mis en avant
 * et le résultat réel de la requête PEA (mêmes filtres que ceux montrés en chips). La
 * troisième est une revue de watchlist, forcément propre à chaque compte : elle est
 * explicitement marquée « exemple ».
 *
 * La boucle d'animation ne monte/démonte rien : tout le texte est dans le DOM au
 * chargement (crawlers GEO), seule une classe CSS rejoue les transitions.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { DotScore, useSectionIn } from './bits.js';
import { fmtPrice, type LandingStock } from './useLandingData.js';

/** Rejoue le cycle d'animation d'une conversation tant qu'elle est visible. */
function useConvLoop(cycleMs: number): [React.RefObject<HTMLElement>, number] {
  const ref = useRef<HTMLElement>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') { setTick(1); return; }
    let timer: ReturnType<typeof setInterval> | null = null;
    const obs = new IntersectionObserver(entries => {
      const visible = entries.some(e => e.isIntersecting);
      if (visible && !timer) {
        setTick(t => t + 1);
        timer = setInterval(() => setTick(t => t + 1), cycleMs + 3000);
      } else if (!visible && timer) {
        clearInterval(timer); timer = null;
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => { obs.disconnect(); if (timer) clearInterval(timer); };
  }, [cycleMs]);
  return [ref, tick];
}

function Conv({ index, cycleMs, title, desc, children }: {
  index: string; cycleMs: number; title: string; desc: string; children: React.ReactNode;
}) {
  const [ref, tick] = useConvLoop(cycleMs);
  return (
    <article ref={ref as React.RefObject<HTMLElement>} className={`conv ${tick > 0 ? 'on' : ''}`} key={tick}>
      <div className="lead">
        <span className="n">{index}</span>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      <div className="thread" key={tick}>{children}</div>
    </article>
  );
}

/** Bulle utilisateur avec effet de frappe (largeur animée, texte toujours présent). */
function Ask({ text, chars, dur, delay }: { text: string; chars: number; dur: string; delay?: string }) {
  return (
    <div className="bub-u">
      <span className="type" style={{ ['--tc' as string]: chars, ['--td' as string]: dur, ...(delay ? { animationDelay: delay } : {}) }}>
        {text}
      </span>
    </div>
  );
}

function Working({ delay }: { delay: string }) {
  return <div className="working" style={{ ['--dl' as string]: delay }} aria-hidden="true"><b /><b /><b /></div>;
}

/** URL du connecteur MCP à coller dans Claude, avec copie en un clic. */
function CopyUrl() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  // URL canonique du connecteur : jamais l'origine courante (localhost, preview Vercel).
  const url = 'https://lubin-investment.com/api/mcp';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* presse-papiers indisponible : l'URL reste lisible et sélectionnable */ }
  }

  return (
    <div className="connect-url">
      <code className="num">{url}</code>
      <button type="button" className="btn btn-ghost" onClick={copy}>
        {copied ? t('landing.claude.connect.copied') : t('landing.claude.connect.copy')}
      </button>
    </div>
  );
}

export function ClaudeSection({ featured, peaRows, rows }: { featured: LandingStock; peaRows: LandingStock[]; rows: LandingStock[] }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [headRef, headIn] = useSectionIn<HTMLDivElement>();
  const [capsRef, capsIn] = useSectionIn<HTMLDivElement>();
  const price = fmtPrice(featured.price, featured.currency, locale);
  // Titre ajouté à la watchlist dans la 3ᵉ conversation : une vraie ligne du screener.
  const added = rows[1] ?? rows[0] ?? featured;

  const readTools = ['search', 'analyze', 'screen', 'resilience', 'trend', 'compare', 'listWatchlist', 'reviewWatchlist'] as const;
  const writeTools = ['addWatchlist', 'removeWatchlist'] as const;

  return (
    <section className="claude" id="claude">
      <div className="wrap">
        <div ref={headRef} className={`sec-head ${headIn ? 'in' : ''}`}>
          <span className="kicker rv">{t('landing.claude.kicker')}</span>
          <h2 className="rv" data-d="1" style={{ marginTop: 12 }}>{t('landing.claude.title')}</h2>
          <p className="rv claude-sub" data-d="2">{t('landing.claude.sub')}</p>
          <div className="trust-band rv" data-d="3">
            <b>{t('landing.claude.band1')}</b><span className="sep">·</span>
            {t('landing.claude.band2')}<span className="sep">·</span>
            {t('landing.claude.band3')}
          </div>
        </div>

        <div className="conv-track">
          {/* 5A — il analyse */}
          <Conv index="5A" cycleMs={8000} title={t('landing.claude.a.title')} desc={t('landing.claude.a.desc')}>
            <Ask text={t('landing.claude.a.question', { name: featured.name })} chars={47} dur="1.9s" />
            <Working delay="2.0s" />
            <div className="reply" style={{ ['--dl' as string]: '2.7s' }}>
              <div className="lcard">
                <div className="lcard-h">
                  <span className="tick-badge sm">{featured.ticker.split('.')[0]}</span>
                  <b style={{ fontSize: 13.5 }}>{featured.name}</b>
                  <span className="num lcard-note">{featured.note10 ?? '—'}/10</span>
                </div>
                <div className="lcard-b">
                  <DotScore note10={featured.note10} delayBase={2.9} />
                  {featured.pfcfTTM != null && <div className="kv">P/FCF<b>{featured.pfcfTTM.toFixed(1)}x</b></div>}
                  {price && <div className="kv">{t('landing.card.price')}<b>{price}</b></div>}
                  <div className="kv">{t('landing.card.note')}<b style={{ color: 'var(--brand-ink)' }}>{featured.note10 ?? '—'}/10</b></div>
                  {featured.opportunity && <div style={{ marginTop: 10 }}><span className="badge badge-brand">{t('landing.card.opportunity')}</span></div>}
                </div>
              </div>
            </div>
            <span className="micro">{t('landing.claude.a.micro')}</span>
          </Conv>

          {/* 5B — il cherche pour toi */}
          <Conv index="5B" cycleMs={8000} title={t('landing.claude.b.title')} desc={t('landing.claude.b.desc')}>
            <Ask text={t('landing.claude.b.question')} chars={88} dur="2.6s" />
            <Working delay="2.7s" />
            <div className="reply" style={{ ['--dl' as string]: '3.3s' }}>
              <div className="lcard">
                <div className="lcard-h wrap-chips">
                  <span className="chip sm">{t('landing.claude.b.chipZone')}</span>
                  <span className="chip sm">{t('landing.claude.b.chipNote')}</span>
                  <span className="chip sm">{t('landing.claude.b.chipPfcf')}</span>
                </div>
                <div className="lcard-b">
                  <table className="ltable">
                    <thead>
                      <tr>
                        <th>{t('landing.claude.b.thTicker')}</th>
                        <th>{t('landing.claude.b.thName')}</th>
                        <th style={{ textAlign: 'right' }}>{t('landing.claude.b.thNote')}</th>
                        <th style={{ textAlign: 'right' }}>P/FCF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peaRows.slice(0, 4).map((r, i) => (
                        <tr key={r.ticker} style={{ animationDelay: `${3.5 + i * 0.12}s` }}>
                          <td>{r.ticker}</td>
                          <td className="sans">{r.name}</td>
                          <td style={{ textAlign: 'right', color: 'var(--brand-ink)', fontWeight: 700 }}>{r.note10}/10</td>
                          <td style={{ textAlign: 'right' }}>{r.pfcfTTM != null ? `${r.pfcfTTM.toFixed(1)}x` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <span className="micro">{t('landing.claude.b.micro')}</span>
          </Conv>

          {/* 5C — il surveille, et il agit */}
          <Conv index="5C" cycleMs={9000} title={t('landing.claude.c.title')} desc={t('landing.claude.c.desc')}>
            <Ask text={t('landing.claude.c.question')} chars={24} dur="1.1s" />
            <Working delay="1.2s" />
            <div className="reply" style={{ ['--dl' as string]: '1.8s' }}>
              <div className="lcard">
                <div className="lcard-b">
                  <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
                    <span className="chip sm">{t('landing.claude.c.exampleTag')}</span>
                  </div>
                  <div className="tiles">
                    {[
                      { k: 'avg', v: '8,4/10', c: 'var(--brand-ink)' },
                      { k: 'weak', v: '2', c: 'var(--bad-ink)' },
                      { k: 'down', v: '3', c: 'var(--warn-ink)' },
                      { k: 'above', v: '5', c: 'var(--warn-ink)' },
                    ].map(tile => (
                      <div key={tile.k} className="tile">
                        <div className="tiny muted">{t(`landing.claude.c.${tile.k}`)}</div>
                        <div className="num tile-v" style={{ color: tile.c }}>{tile.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Ask text={t('landing.claude.c.question2', { name: added.name })} chars={33} dur="1.3s" delay="2.6s" />
            <div className="reply" style={{ ['--dl' as string]: '4.3s' }}>
              <div className="lcard">
                <div className="lcard-b added">
                  <span className="check" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--good-ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                  <b className="num" style={{ fontSize: 13 }}>{added.ticker}</b>
                  <span style={{ fontSize: 13 }}>{added.name}</span>
                  <span className="num" style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--brand-ink)' }}>{added.note10}/10</span>
                </div>
              </div>
            </div>
            <span className="micro">{t('landing.claude.c.micro')}</span>
          </Conv>
        </div>

        <div ref={capsRef} className={capsIn ? 'in caps-block' : 'caps-block'}>
          <div className="row rv caps-label">
            <span className="kicker">{t('landing.claude.readLabel')}</span>
            <span className="tiny muted">{t('landing.claude.readCount')}</span>
          </div>
          <div className="caps rv" data-d="1">
            {readTools.map(k => <span key={k} className="cap"><i className="d" />{t(`landing.claude.tools.${k}`)}</span>)}
          </div>
          <div className="row rv caps-label" data-d="2" style={{ marginTop: 26 }}>
            <span className="kicker">{t('landing.claude.writeLabel')}</span>
            <span className="tiny muted">{t('landing.claude.writeCount')}</span>
          </div>
          <div className="caps rv" data-d="3">
            {writeTools.map(k => <span key={k} className="cap write"><i className="d" />{t(`landing.claude.tools.${k}`)}</span>)}
          </div>
          <p className="tiny muted rv" data-d="4" style={{ marginTop: 20, lineHeight: 1.6 }}>{t('landing.claude.quotas')}</p>

          <div className="connect rv" data-d="5">
            <div>
              <span className="kicker">{t('landing.claude.connect.kicker')}</span>
              <ol className="connect-steps">
                <li>{t('landing.claude.connect.step1')}</li>
                <li>{t('landing.claude.connect.step2')}</li>
                <li>{t('landing.claude.connect.step3')}</li>
              </ol>
            </div>
            <CopyUrl />
          </div>
        </div>
      </div>
    </section>
  );
}
