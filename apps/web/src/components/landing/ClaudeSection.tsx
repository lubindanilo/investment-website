/**
 * Section 5 : le connecteur MCP, joué comme une vidéo.
 *
 * Un seul fil de conversation qui se déroule en direct : la question s'écrit caractère par
 * caractère dans la barre de saisie, part dans le fil, l'appel d'outil MCP s'affiche avec sa
 * durée, puis la réponse arrive mot à mot et la carte de données s'assemble. Trois échanges
 * s'enchaînent, puis ça reboucle. Aucun bouton à cliquer : ça tourne tout seul.
 *
 * Les données jouées sont réelles (titre mis en avant, résultat de la requête PEA avec les
 * filtres affichés). La revue de watchlist dépend du compte, elle est marquée « exemple ».
 *
 * Accessibilité et robots : le transcript complet est rendu en clair (classe `sr-only`) dès
 * le chargement, et le mode sans mouvement affiche la conversation entière d'un coup.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { ScoreRing, useSectionIn, SplitTitle } from './bits.js';
import { CompositionStrip, CriteriaList } from './HeroSection.js';
import { CompanyLogo } from '../ui/CompanyLogo.js';
import { useMotion } from './motion.js';
import { fmtPrice, type LandingShowcase, type LandingStock } from './useLandingData.js';

/** Un bloc affiché dans le fil. */
type Item =
  | { kind: 'user'; text: string }
  | { kind: 'tool'; label: string; done: boolean; ms: number }
  | { kind: 'text'; words: string[]; shown: number }
  | { kind: 'card'; id: 'analyze' | 'screen' | 'watchlist' | 'added' };

/** Une étape du scénario. Le lecteur les enchaîne comme une timeline vidéo. */
type CardId = 'analyze' | 'screen' | 'watchlist' | 'added';
type Step =
  | { do: 'type'; text: string }
  | { do: 'send'; text: string }
  | { do: 'tool'; label: string; ms: number }
  | { do: 'say'; text: string }
  | { do: 'card'; id: CardId }
  | { do: 'wait'; ms: number }
  | { do: 'clear' };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Marque de Claude : l'astérisque à huit branches effilées. Tracé en SVG plutôt qu'importé
 * comme image, pour qu'il suive la couleur du contexte et reste net à toute taille.
 *
 * Les branches sont des losanges étirés qui s'affinent vers l'extérieur : quatre en croix,
 * quatre en diagonale et légèrement plus courtes, ce qui donne sa silhouette au symbole.
 */
export function ClaudeMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <path
          key={deg}
          // Chaque branche part du CENTRE et s'affine vers l'extérieur. Pas de disque central :
          // l'astérisque de Claude est fait de branches qui convergent, pas d'un moyeu.
          d={deg % 90 === 0
            ? 'M16 16 L14.1 4.6 Q16 2.6 17.9 4.6 Z'      // branches en croix, plus longues
            : 'M16 16 L14.6 7.4 Q16 5.8 17.4 7.4 Z'}     // branches en diagonale, plus courtes
          transform={`rotate(${deg} 16 16)`}
        />
      ))}
    </svg>
  );
}

/** Pastille de l'assistant dans le fil. */
function AssistantMark() {
  return (
    <span className="cl-av" aria-hidden="true"><ClaudeMark size={15} /></span>
  );
}

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

export function ClaudeSection({ show, peaRows, rows, ready }: {
  show: LandingShowcase;
  peaRows: LandingStock[];
  rows: LandingStock[];
  ready: boolean;
}) {
  const { stock: featured, criteria, resilience, pfcfPercentile } = show;
  const { t } = useTranslation();
  const locale = currentLocale();
  const [headRef, headIn] = useSectionIn<HTMLDivElement>();
  const motion = useMotion();
  const price = fmtPrice(featured.price, featured.currency, locale);
  const added = useMemo(() => rows[1] ?? rows[0] ?? featured, [rows, featured]);

  const [items, setItems] = useState<Item[]>([]);
  // La frappe passe par le DOM (ref) et non par un state : sinon chaque caractère
  // re-rendrait toute la section, et la « vidéo » saccade sur les machines modestes.
  const inputRef = useRef<HTMLSpanElement>(null);
  const setInput = (v: string) => { if (inputRef.current) inputRef.current.textContent = v; };
  const [chapter, setChapter] = useState(0);
  // Visibilité : une simple RÉFÉRENCE, pas un state. La boucle de lecture la consulte pour
  // se mettre en pause hors écran ; en faire une dépendance d'effet tuait la lecture en
  // cours dès que l'observer changeait d'avis (fil figé au milieu d'un échange).
  const visibleRef = useRef(true);
  const [live, setLive] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const q1 = t('landing.claude.a.question', { name: featured.name });
  const q2 = t('landing.claude.b.question');
  const q3 = t('landing.claude.c.question');
  const q4 = t('landing.claude.c.question2', { name: added.name });

  // Ne joue que quand la section est à l'écran.
  useEffect(() => {
    const el = playerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setLive(true); return; }
    const obs = new IntersectionObserver(es => {
      const seen = es.some(e => e.isIntersecting);
      visibleRef.current = seen;
      if (seen) setLive(true);
    }, { threshold: 0.2 });
    obs.observe(el);
    // Filet : certains contextes (webviews, pages en arrière-plan, navigateurs embarqués)
    // ne délivrent jamais de callback. Sans ça, la démo ne démarrerait jamais.
    const fallback = setTimeout(() => { visibleRef.current = true; setLive(true); }, 1200);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  // Le fil suit toujours le dernier message, comme une vraie conversation.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items]);

  useEffect(() => {
    // Rien ne se joue avant que la vraie vitrine soit chargée : sinon la démo taperait
    // le nom d'une action de repli, puis repartirait de zéro avec la bonne.
    if (!ready) return;
    // Sans mouvement : la conversation complète, d'un bloc, sans animation.
    if (!motion) {
      setItems([
        { kind: 'user', text: q1 },
        { kind: 'tool', label: `analyze_stock("${featured.ticker}")`, done: true, ms: 240 },
        { kind: 'text', words: t('landing.claude.a.answer', { name: featured.name, note: featured.note10 ?? '—' }).split(' '), shown: 999 },
        { kind: 'card', id: 'analyze' },
        { kind: 'user', text: q2 },
        { kind: 'tool', label: 'screen_stocks({ zones: "pea", minMax: 8, maxPfcf: 15, caps: "large" })', done: true, ms: 380 },
        { kind: 'card', id: 'screen' },
        { kind: 'user', text: q3 },
        { kind: 'tool', label: 'analyze_watchlist()', done: true, ms: 910 },
        { kind: 'card', id: 'watchlist' },
      ]);
      return;
    }

    let cancelled = false;
    const script: Step[] = [
      // ── 1. Il analyse ───────────────────────────────────────────────
      { do: 'type', text: q1 },
      { do: 'send', text: q1 },
      { do: 'tool', label: `analyze_stock("${featured.ticker}")`, ms: 240 },
      { do: 'say', text: t('landing.claude.a.answer', { name: featured.name, note: featured.note10 ?? '—' }) },
      { do: 'card', id: 'analyze' },
      { do: 'wait', ms: 2600 },
      // ── 2. Il cherche pour toi ──────────────────────────────────────
      { do: 'type', text: q2 },
      { do: 'send', text: q2 },
      { do: 'tool', label: 'screen_stocks({ zones: "pea", minMax: 8, maxPfcf: 15, caps: "large" })', ms: 380 },
      { do: 'say', text: t('landing.claude.b.answer', { count: peaRows.length }) },
      { do: 'card', id: 'screen' },
      { do: 'wait', ms: 2800 },
      // ── 3. Il surveille, et il agit ─────────────────────────────────
      { do: 'type', text: q3 },
      { do: 'send', text: q3 },
      { do: 'tool', label: 'analyze_watchlist()', ms: 910 },
      { do: 'say', text: t('landing.claude.c.answer') },
      { do: 'card', id: 'watchlist' },
      { do: 'wait', ms: 2200 },
      { do: 'type', text: q4 },
      { do: 'send', text: q4 },
      { do: 'tool', label: `add_to_watchlist("${added.ticker}")`, ms: 320 },
      { do: 'card', id: 'added' },
      { do: 'wait', ms: 3400 },
      { do: 'clear' },
    ];

    /** Met la lecture en pause tant que la section n'est pas à l'écran. */
    async function waitVisible() {
      while (!cancelled && !visibleRef.current) await sleep(300);
    }

    async function run() {
      setItems([]); setInput(''); setChapter(0);
      while (!cancelled) {
        for (const [i, step] of script.entries()) {
          if (cancelled) return;
          await waitVisible();
          if (cancelled) return;
          // Le chapitre suit la position dans le script (3 blocs).
          setChapter(i < 6 ? 0 : i < 12 ? 1 : 2);
          switch (step.do) {
            case 'type': {
              for (let c = 1; c <= step.text.length; c++) {
                if (cancelled) return;
                setInput(step.text.slice(0, c));
                await sleep(step.text.length > 60 ? 16 : 26);
              }
              await sleep(420);
              break;
            }
            case 'send': {
              setInput('');
              setItems(prev => [...prev, { kind: 'user', text: step.text }]);
              await sleep(500);
              break;
            }
            case 'tool': {
              setItems(prev => [...prev, { kind: 'tool', label: step.label, done: false, ms: step.ms }]);
              await sleep(700 + step.ms);
              if (cancelled) return;
              setItems(prev => prev.map((it, k) => (k === prev.length - 1 && it.kind === 'tool' ? { ...it, done: true } : it)));
              await sleep(320);
              break;
            }
            case 'say': {
              const words = step.text.split(' ');
              setItems(prev => [...prev, { kind: 'text', words, shown: 0 }]);
              for (let w = 1; w <= words.length; w++) {
                if (cancelled) return;
                setItems(prev => prev.map((it, k) => (k === prev.length - 1 && it.kind === 'text' ? { ...it, shown: w } : it)));
                await sleep(45);
              }
              await sleep(260);
              break;
            }
            case 'card': {
              setItems(prev => [...prev, { kind: 'card', id: step.id }]);
              await sleep(900);
              break;
            }
            case 'wait': await sleep(step.ms); break;
            case 'clear': {
              setItems([]);
              await sleep(700);
              break;
            }
          }
        }
      }
    }

    void run();
    return () => { cancelled = true; };
    // Le script dépend des libellés et des données affichées.
  }, [ready, motion, featured, peaRows, added, q1, q2, q3, q4, t]);

  const chapters = [t('landing.claude.a.title'), t('landing.claude.b.title'), t('landing.claude.c.title')];

  return (
    <section className="claude" id="claude">
      <div className="wrap">
        <div ref={headRef} className={`sec-head ${headIn ? 'in' : ''}`}>
          <span className="kicker rv">{t('landing.claude.kicker')}</span>
          <SplitTitle text={t('landing.claude.title')} className="rv" />
          <p className="rv claude-sub" data-d="2">{t('landing.claude.sub')}</p>
          <div className="trust-band rv" data-d="3">
            <b>{t('landing.claude.band1')}</b><span className="sep">·</span>
            {t('landing.claude.band2')}<span className="sep">·</span>
            {t('landing.claude.band3')}
          </div>
        </div>

        <div className="player" ref={playerRef} data-live={live ? '1' : '0'} data-items={items.length}>
          <div className="screen">
            {/* Chapitres : indicateur de progression, pas un menu (ça se joue tout seul). */}
            <div className="steps-strip" aria-hidden="true">
              {chapters.map((c, i) => (
                <span key={c} className="strip-item" data-on={chapter === i ? '1' : '0'}>
                  <b className="num">{`0${i + 1}`}</b>{c}
                </span>
              ))}
              <span className={`live-dot ${live ? 'on' : ''}`} aria-hidden="true" />
            </div>

            <div className="thread live" ref={threadRef}>
              {items.map((it, i) => {
                if (it.kind === 'user') return <div key={i} className="bub-u show">{it.text}</div>;
                if (it.kind === 'tool') {
                  return (
                    <div key={i} className={`toolcall ${it.done ? 'done' : ''}`}>
                      <span className="tc-dot" />
                      <code className="num">{it.label}</code>
                      <span className="tc-ms num">{it.done ? `${it.ms} ms` : '…'}</span>
                    </div>
                  );
                }
                if (it.kind === 'text') {
                  return (
                    <div key={i} className="msg-a">
                      <AssistantMark />
                      <p className="bub-a">
                        {it.words.slice(0, it.shown).join(' ')}
                        {it.shown < it.words.length && <span className="caret" />}
                      </p>
                    </div>
                  );
                }
                return <div key={i} className="reply show">{renderCard(it.id)}</div>;
              })}
            </div>

            {/* Barre de saisie : c'est elle qui « tape » les questions. */}
            <div className="composer">
              <span className="composer-txt"><span ref={inputRef} /><span className="caret" /></span>
              <span className="composer-send" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </div>
        </div>

        {/* Transcript en clair pour les lecteurs d'écran et les robots qui n'exécutent pas le JS. */}
        <div className="sr-only">
          <p>{q1}</p><p>{t('landing.claude.a.answer', { name: featured.name, note: featured.note10 ?? '—' })}</p>
          <p>{q2}</p><p>{t('landing.claude.b.answer', { count: peaRows.length })}</p>
          <p>{q3}</p><p>{t('landing.claude.c.answer')}</p>
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

  /** Les cartes de données renvoyées par les outils, assemblées dans le fil. */
  /**
   * Cartes de données renvoyées par les outils MCP. Volontairement RICHES : c'est ce que le
   * visiteur regarde pour juger de ce que l'intégration lui apporte. Tout vient de l'API
   * (mêmes champs que la fiche du hero) ; seule la revue de watchlist dépend d'un compte, elle
   * est donc marquée « exemple ».
   */
  function renderCard(id: CardId) {
    const passCount = criteria.filter(c => c.status === 'pass').length;
    const pct = pfcfPercentile != null ? Math.max(2, Math.min(98, pfcfPercentile)) : null;

    if (id === 'analyze') {
      return (
        <div className="lcard">
          <div className="lcard-h">
            <span className="tick-badge sm"><CompanyLogo ticker={featured.ticker} name={featured.name} /></span>
            <div style={{ minWidth: 0 }}>
              <b className="lcard-name">{featured.name}</b>
              <div className="tiny muted">{featured.sector ?? featured.ticker}</div>
            </div>
            {featured.opportunity && <span className="badge badge-good lcard-flag">{t('landing.card.opportunity')}</span>}
          </div>
          <div className="lcard-b">
            {/* Les deux scores côte à côte, comme sur la fiche : la qualité, puis la résilience. */}
            <div className="lc-scores">
              <div className="lc-score">
                <ScoreRing note10={featured.note10} size={78} />
                <span className="tiny muted">{t('landing.card.qualityKicker')}</span>
              </div>
              {resilience && (
                <div className="lc-score">
                  <span className="lc-grade" data-g={resilience.grade}>{resilience.grade}</span>
                  <span className="tiny muted">{t('landing.card.resilience')} · {resilience.score}/100</span>
                </div>
              )}
              <div className="lc-crit">
                <div className="tiny muted" style={{ marginBottom: 8 }}>{t('landing.card.passCount', { count: passCount })}</div>
                <CompositionStrip criteria={criteria} />
                <CriteriaList criteria={criteria.slice(0, 4)} compact />
              </div>
            </div>
            {/* Valorisation : le multiple ET sa position dans son propre historique. */}
            <div className="lc-val">
              <div className="lc-val-head">
                <span className="tiny muted">P/FCF</span>
                <b className="num lc-val-big">{featured.pfcfTTM != null ? `${featured.pfcfTTM.toFixed(1)}x` : '—'}</b>
                {price && <span className="num lc-price">{price}</span>}
              </div>
              {pct != null && (
                <>
                  <div className="gauge-scale" aria-hidden="true">
                    <span className="gauge-mark" style={{ left: `${pct}%` }} />
                  </div>
                  <p className="tiny muted lc-val-note">{t('landing.mech.card2.percentile', { pct: Math.round(pct) })}</p>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (id === 'screen') {
      return (
        <div className="lcard">
          <div className="lcard-h wrap-chips">
            <span className="chip sm">{t('landing.claude.b.chipZone')}</span>
            <span className="chip sm">{t('landing.claude.b.chipNote')}</span>
            <span className="chip sm">{t('landing.claude.b.chipPfcf')}</span>
            <span className="chip sm">{t('landing.claude.b.chipCap')}</span>
            <span className="num lcard-count">{peaRows.length}</span>
          </div>
          <div className="lcard-b">
            <div className="lc-rows">
              {peaRows.slice(0, 4).map((r, i) => (
                <div key={r.ticker} className="lc-row" style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
                  <span className="tick-badge sm"><CompanyLogo ticker={r.ticker} name={r.name} /></span>
                  <span className="lc-row-id">
                    <b className="lc-row-name">{r.name}</b>
                    <span className="tiny muted num">{r.ticker}</span>
                  </span>
                  <span className="lc-pill num" data-n={r.note10 ?? 0}>{r.note10}/10</span>
                  <span className="num lc-row-pfcf" data-cheap={r.pfcfTTM != null && r.pfcfTTM < 15 ? '1' : '0'}>
                    {r.pfcfTTM != null ? `${r.pfcfTTM.toFixed(1)}x` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (id === 'watchlist') {
      // Chiffres d'illustration : la revue porte sur LA watchlist du compte connecté, qu'on ne
      // peut pas connaître depuis la page d'accueil. D'où le marquage explicite.
      const tiles = [
        { k: 'avg', v: '8,4/10', tone: 'brand', bar: 84 },
        { k: 'weak', v: '2', tone: 'bad', bar: 20 },
        { k: 'down', v: '3', tone: 'warn', bar: 30 },
        { k: 'above', v: '5', tone: 'warn', bar: 50 },
      ] as const;
      return (
        <div className="lcard">
          <div className="lcard-h wrap-chips">
            <b className="lcard-name">{t('landing.claude.c.title')}</b>
            <span className="chip sm lcard-flag">{t('landing.claude.c.exampleTag')}</span>
          </div>
          <div className="lcard-b">
            <div className="tiles">
              {tiles.map((tile, i) => (
                <div key={tile.k} className="tile" data-tone={tile.tone} style={{ animationDelay: `${i * 0.09}s` }}>
                  <div className="tiny muted">{t(`landing.claude.c.${tile.k}`)}</div>
                  <div className="num tile-v">{tile.v}</div>
                  <span className="tile-bar" aria-hidden="true"><i style={{ width: `${tile.bar}%` }} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="lcard lcard-added">
        <div className="lcard-b added">
          <span className="check" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <span className="tick-badge sm"><CompanyLogo ticker={added.ticker} name={added.name} /></span>
          <span className="lc-row-id">
            <b className="lc-row-name">{added.name}</b>
            <span className="tiny muted num">{added.ticker}</span>
          </span>
          <span className="lc-pill num" data-n={added.note10 ?? 0}>{added.note10}/10</span>
        </div>
      </div>
    );
  }
}
