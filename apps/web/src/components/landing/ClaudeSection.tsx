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
  | { kind: 'text'; words: string[]; shown: number }
  | { kind: 'think' }
  | { kind: 'card'; id: 'analyze' | 'screen' | 'watchlist' | 'added' };

/** Une étape du scénario. Le lecteur les enchaîne comme une timeline vidéo. */
type CardId = 'analyze' | 'screen' | 'watchlist' | 'added';
type Step =
  | { do: 'type'; text: string }
  | { do: 'send'; text: string }
  | { do: 'say'; text: string }
  | { do: 'card'; id: CardId }
  | { do: 'think'; ms: number }
  | { do: 'wait'; ms: number }
  | { do: 'clear' };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const NEXT_PROMPT_DELAY_MS = 950;
const ANSWER_WORD_DELAY_MS = 46;
const CARD_REVEAL_DELAY_MS = 700;

/**
 * Marque de Claude : l'ICÔNE OFFICIELLE, versionnée dans `public/claude-icon.png`.
 *
 * Elle était auparavant redessinée en SVG, et c'était faux : la vraie marque est un astérisque
 * IRRÉGULIER d'une dizaine de branches de longueurs et d'angles variables, pas une croix
 * symétrique à huit branches. Aucune reconstruction à la main ne tombe juste, donc on sert le
 * fichier d'origine (récupéré depuis claude.ai, ramené à 96 px).
 */
export function ClaudeMark({ size = 16 }: { size?: number }) {
  return (
    <img
      src="/claude-icon.png"
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    />
  );
}

/** Pastille de l'assistant dans le fil. */
function AssistantMark() {
  return (
    <span className="cl-av" aria-hidden="true"><ClaudeMark size={28} /></span>
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

export function ClaudeSection({ show, peaRows, rows }: {
  show: LandingShowcase;
  peaRows: LandingStock[];
  rows: LandingStock[];
}) {
  const { stock: featured, criteria, pfcfPercentile } = show;
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
  // Visibilité : une simple RÉFÉRENCE, pas un state. La boucle de lecture la consulte pour
  // se mettre en pause hors écran ; en faire une dépendance d'effet tuait la lecture en
  // cours dès que l'observer changeait d'avis (fil figé au milieu d'un échange).
  // Démarre à FALSE : la boucle de lecture attend d'être réellement à l'écran. À `true`, le
  // scénario se déroulait dès le chargement de la page et le visiteur arrivait sur une
  // conversation déjà à moitié jouée.
  const visibleRef = useRef(false);
  const [live, setLive] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const q1 = t('landing.claude.a.question', { name: featured.name });
  const q2 = t('landing.claude.b.question');
  const q3 = t('landing.claude.c.question');
  const q4 = t('landing.claude.c.question2', { name: added.name });

  /**
   * La démo ne joue que quand la section est SOUS LES YEUX du visiteur.
   *
   * Volontairement SANS IntersectionObserver. Deux tentatives ont échoué avant celle-ci : un
   * filet minuté qui forçait la visibilité sans rien vérifier (la conversation démarrait au
   * chargement de la page, défaut signalé en production), puis une garde qui n'installait le
   * repli que si l'observer restait muet — or un observer peut parler UNE fois puis se taire,
   * et la démo ne démarrait alors jamais.
   *
   * Un contrôle géométrique sur le scroll est ici plus simple et vérifiable : il ne dépend
   * d'aucun comportement d'API. Le coût est nul, la page installe déjà deux écouteurs de scroll
   * du même genre (barre de progression, parallaxe), et celui-ci est limité par requestAnimationFrame.
   */
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;

    // Lecture SYNCHRONE, pas dans un requestAnimationFrame : certains contextes (onglet en
    // arrière-plan, webviews, navigateurs embarqués) n'exécutent jamais de frame, et la démo
    // ne démarrait alors jamais. Un getBoundingClientRect par événement de scroll est du même
    // ordre que ce que font déjà la barre de progression et la parallaxe de cette page.
    const sync = () => {
      const r = el.getBoundingClientRect();
      const h = window.innerHeight || 0;
      // Visible = le lecteur chevauche les 70 % centraux de la fenêtre.
      const seen = r.bottom > h * 0.15 && r.top < h * 0.85;
      visibleRef.current = seen;
      if (seen) setLive(true);
    };

    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  // Le fil suit toujours le dernier message, comme une vraie conversation.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items]);

  useEffect(() => {
    // Sans mouvement : la conversation complète, d'un bloc, sans animation.
    if (!motion) {
      setItems([
        { kind: 'user', text: q1 },
        { kind: 'text', words: t('landing.claude.a.answer', { name: featured.name, note: featured.note10 ?? '—' }).split(' '), shown: 999 },
        { kind: 'card', id: 'analyze' },
        { kind: 'user', text: q2 },
        { kind: 'card', id: 'screen' },
        { kind: 'user', text: q3 },
        { kind: 'card', id: 'watchlist' },
      ]);
      return;
    }

    let cancelled = false;
    const script: Step[] = [
      // ── 1. Il analyse ───────────────────────────────────────────────
      { do: 'type', text: q1 },
      { do: 'send', text: q1 },
      { do: 'think', ms: 650 },
      { do: 'say', text: t('landing.claude.a.answer', { name: featured.name, note: featured.note10 ?? '—' }) },
      { do: 'card', id: 'analyze' },
      { do: 'wait', ms: NEXT_PROMPT_DELAY_MS },
      // ── 2. Il cherche pour toi ──────────────────────────────────────
      { do: 'type', text: q2 },
      { do: 'send', text: q2 },
      { do: 'think', ms: 750 },
      { do: 'say', text: t('landing.claude.b.answer', { count: peaRows.length }) },
      { do: 'card', id: 'screen' },
      { do: 'wait', ms: NEXT_PROMPT_DELAY_MS },
      // ── 3. Il surveille, et il agit ─────────────────────────────────
      { do: 'type', text: q3 },
      { do: 'send', text: q3 },
      { do: 'think', ms: 900 },
      { do: 'say', text: t('landing.claude.c.answer') },
      { do: 'card', id: 'watchlist' },
      { do: 'wait', ms: NEXT_PROMPT_DELAY_MS },
      { do: 'type', text: q4 },
      { do: 'send', text: q4 },
      { do: 'think', ms: 520 },
      { do: 'card', id: 'added' },
      { do: 'wait', ms: 1800 },
      { do: 'clear' },
    ];

    /** Met la lecture en pause tant que la section n'est pas à l'écran. */
    async function waitVisible() {
      while (!cancelled && !visibleRef.current) await sleep(300);
    }

    async function run() {
      setItems([]); setInput('');
      while (!cancelled) {
        for (const [i, step] of script.entries()) {
          if (cancelled) return;
          await waitVisible();
          if (cancelled) return;
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
            case 'think': {
              setItems(prev => [...prev, { kind: 'think' }]);
              await sleep(step.ms);
              break;
            }
            case 'say': {
              const words = step.text.split(' ');
              // Les points de réflexion cèdent la place à la réponse.
              setItems(prev => [...prev.filter(it => it.kind !== 'think'), { kind: 'text', words, shown: 0 }]);
              for (let w = 1; w <= words.length; w++) {
                if (cancelled) return;
                setItems(prev => prev.map((it, k) => (k === prev.length - 1 && it.kind === 'text' ? { ...it, shown: w } : it)));
                await sleep(ANSWER_WORD_DELAY_MS);
              }
              await sleep(260);
              break;
            }
            case 'card': {
              setItems(prev => [...prev.filter(it => it.kind !== 'think'), { kind: 'card', id: step.id }]);
              await sleep(CARD_REVEAL_DELAY_MS);
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
  }, [motion, featured, peaRows, added, q1, q2, q3, q4, t]);


  return (
    <section className="claude" id="claude">
      <div className="wrap">
        <div ref={headRef} className={`sec-head ${headIn ? 'in' : ''}`}>
          <span className="kicker rv">{t('landing.claude.kicker')}</span>
          <SplitTitle text={t('landing.claude.title')} className="rv" />
          <p className="rv claude-sub" data-d="2">{t('landing.claude.sub')}</p>
        </div>

        <div className="player" ref={playerRef} data-live={live ? '1' : '0'} data-items={items.length}>
          <div className="screen">
            {/* Seul repère « ça tourne » depuis le retrait de la barre de fenêtre. */}
            <span className={`live-dot ${live ? 'on' : ''}`} aria-hidden="true" />
            {/* Chapitres : indicateur de progression, pas un menu (ça se joue tout seul). */}

            <div className="thread live" ref={threadRef}>
              {items.map((it, i) => {
                if (it.kind === 'user') return <div key={i} className="bub-u show">{it.text}</div>;
                if (it.kind === 'think') {
                  return (
                    <div key={i} className="msg-a">
                      <AssistantMark />
                      <span className="working show" aria-hidden="true"><b /><b /><b /></span>
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
              {show.resilienceStars && (
                <div className="lc-score">
                  <span className="lc-grade" data-g="-">★</span>
                  <span className="tiny muted">{t('landing.card.resilience')} · {show.resilienceStars.total}/5</span>
                </div>
              )}
              <div className="lc-crit">
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
