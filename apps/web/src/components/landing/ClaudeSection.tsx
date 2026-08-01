/**
 * Section 5 : le connecteur MCP, joué comme une démo vidéo.
 *
 * Un seul écran de conversation qui se déroule tout seul et enchaîne trois scénarios
 * (il analyse, il cherche, il agit), avec une liste de chapitres cliquable et une barre
 * de progression. Remplace les trois cartes empilées et la grille d'outils : plus court,
 * et on VOIT ce que le connecteur fait au lieu de le lire.
 *
 * La donnée jouée est réelle : le titre mis en avant et le résultat de la requête PEA
 * (mêmes filtres que ceux affichés en chips). La revue de watchlist dépend du compte,
 * elle est donc marquée « exemple ».
 *
 * Le texte des trois scénarios est présent dans le DOM dès le chargement (crawlers GEO) ;
 * le lecteur ne fait que révéler des blocs déjà rendus.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { DotScore, useSectionIn } from './bits.js';
import { fmtPrice, type LandingStock } from './useLandingData.js';

/** Durée de chaque scénario, en ms (le lecteur passe au suivant à la fin). */
const SCENARIO_MS = [7200, 7600, 8400];

/** URL du connecteur MCP à coller dans Claude, avec copie en un clic. */
function CopyUrl() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  // URL canonique : jamais l'origine courante (localhost, preview Vercel).
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

/**
 * Lecteur : avance de scénario en scénario tant qu'il est visible. `beat` monte les
 * blocs du scénario courant les uns après les autres (question, réflexion, réponse).
 */
function usePlayer(count: number): {
  ref: React.RefObject<HTMLDivElement>;
  scenario: number;
  beat: number;
  playing: boolean;
  select: (i: number) => void;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState(0);
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Ne joue que quand la section est à l'écran (rien ne tourne en fond).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') { setBeat(9); return; }
    const obs = new IntersectionObserver(es => setPlaying(es.some(e => e.isIntersecting)), { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Déroulé du scénario courant : un « beat » toutes ~1,6 s, puis on passe au suivant.
  useEffect(() => {
    if (!playing) return;
    const total = SCENARIO_MS[scenario] ?? 8000;
    const tick = setInterval(() => setBeat(b => b + 1), 1500);
    const next = setTimeout(() => {
      setBeat(0);
      setScenario(s => (s + 1) % count);
    }, total);
    return () => { clearInterval(tick); clearTimeout(next); };
  }, [playing, scenario, count]);

  function select(i: number) { setScenario(i); setBeat(0); }
  return { ref, scenario, beat, playing, select };
}

function Ask({ text, chars, dur, show }: { text: string; chars: number; dur: string; show: boolean }) {
  return (
    <div className={`bub-u ${show ? 'show' : ''}`}>
      <span className="type" style={{ ['--tc' as string]: chars, ['--td' as string]: dur }}>{text}</span>
    </div>
  );
}

function Working({ show }: { show: boolean }) {
  return <div className={`working ${show ? 'show' : ''}`} aria-hidden="true"><b /><b /><b /></div>;
}

export function ClaudeSection({ featured, peaRows, rows }: { featured: LandingStock; peaRows: LandingStock[]; rows: LandingStock[] }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [headRef, headIn] = useSectionIn<HTMLDivElement>();
  const price = fmtPrice(featured.price, featured.currency, locale);
  const added = rows[1] ?? rows[0] ?? featured;
  const { ref, scenario, beat, playing, select } = usePlayer(3);

  const chapters = [
    { key: 'a', label: t('landing.claude.a.title'), desc: t('landing.claude.a.desc') },
    { key: 'b', label: t('landing.claude.b.title'), desc: t('landing.claude.b.desc') },
    { key: 'c', label: t('landing.claude.c.title'), desc: t('landing.claude.c.desc') },
  ];

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

        <div className="player" ref={ref}>
          {/* Chapitres : cliquables, avec la barre de progression du chapitre en cours. */}
          <div className="chapters">
            {chapters.map((c, i) => (
              <button
                key={c.key}
                type="button"
                className="chapter"
                data-on={scenario === i ? '1' : '0'}
                onClick={() => select(i)}
                aria-current={scenario === i}
              >
                <span className="num chapter-n">{`0${i + 1}`}</span>
                <span className="chapter-txt">
                  <b>{c.label}</b>
                  <span className="tiny muted">{c.desc}</span>
                </span>
                <span className="chapter-bar" aria-hidden="true">
                  <i
                    key={`${i}-${scenario}-${playing}`}
                    style={scenario === i && playing ? { animationDuration: `${SCENARIO_MS[i]}ms` } : { animation: 'none', width: 0 }}
                  />
                </span>
              </button>
            ))}
          </div>

          {/* L'écran de conversation : un seul, il rejoue le chapitre actif. */}
          <div className="screen">
            <div className="screen-bar" aria-hidden="true"><i /><i /><i /><span className="num">claude · lubin-investment</span></div>

            <div className="thread" key={scenario}>
              {scenario === 0 && (
                <>
                  <Ask text={t('landing.claude.a.question', { name: featured.name })} chars={47} dur="1.6s" show={beat >= 0} />
                  <Working show={beat >= 1} />
                  <div className={`reply ${beat >= 2 ? 'show' : ''}`}>
                    <div className="lcard">
                      <div className="lcard-h">
                        <span className="tick-badge sm">{featured.ticker.split('.')[0]}</span>
                        <b style={{ fontSize: 13.5 }}>{featured.name}</b>
                        <span className="num lcard-note">{featured.note10 ?? '—'}/10</span>
                      </div>
                      <div className="lcard-b">
                        <DotScore note10={featured.note10} />
                        {featured.pfcfTTM != null && <div className="kv">P/FCF<b>{featured.pfcfTTM.toFixed(1)}x</b></div>}
                        {price && <div className="kv">{t('landing.card.price')}<b>{price}</b></div>}
                        <div className="kv">{t('landing.card.note')}<b style={{ color: 'var(--brand-ink)' }}>{featured.note10 ?? '—'}/10</b></div>
                        {featured.opportunity && <div style={{ marginTop: 10 }}><span className="badge badge-brand">{t('landing.card.opportunity')}</span></div>}
                      </div>
                    </div>
                  </div>
                  <span className={`micro ${beat >= 3 ? 'show' : ''}`}>{t('landing.claude.a.micro')}</span>
                </>
              )}

              {scenario === 1 && (
                <>
                  <Ask text={t('landing.claude.b.question')} chars={88} dur="2.2s" show={beat >= 0} />
                  <Working show={beat >= 1} />
                  <div className={`reply ${beat >= 2 ? 'show' : ''}`}>
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
                              <tr key={r.ticker} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
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
                  <span className={`micro ${beat >= 3 ? 'show' : ''}`}>{t('landing.claude.b.micro')}</span>
                </>
              )}

              {scenario === 2 && (
                <>
                  <Ask text={t('landing.claude.c.question')} chars={24} dur="1s" show={beat >= 0} />
                  <Working show={beat >= 1} />
                  <div className={`reply ${beat >= 2 ? 'show' : ''}`}>
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
                  <Ask text={t('landing.claude.c.question2', { name: added.name })} chars={33} dur="1.1s" show={beat >= 3} />
                  <div className={`reply ${beat >= 4 ? 'show' : ''}`}>
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
                  <span className={`micro ${beat >= 5 ? 'show' : ''}`}>{t('landing.claude.c.micro')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="connect rv in">
          <div>
            <span className="kicker">{t('landing.claude.connect.kicker')}</span>
            <ol className="connect-steps">
              <li>{t('landing.claude.connect.step1')}</li>
              <li>{t('landing.claude.connect.step2')}</li>
              <li>{t('landing.claude.connect.step3')}</li>
            </ol>
            <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.6 }}>{t('landing.claude.quotas')}</p>
          </div>
          <CopyUrl />
        </div>
      </div>
    </section>
  );
}
