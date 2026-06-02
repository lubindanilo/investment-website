/* ============================================================
   LUBIN — Écran ANALYSER (le cœur)
   États : vide (vitrine) · chargement (skeleton) · erreur · rempli
   ============================================================ */

/* ---------- Barre de recherche ticker ---------- */
function SearchBar({ onSubmit, autoFocus, big }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(val.trim().toUpperCase()); }}
      className="row gap-10" style={{ width: "100%" }}>
      <div className="row" style={{ position: "relative", flex: 1 }}>
        <Icon name="search" size={18} style={{ position: "absolute", left: 15, color: "var(--ink-4)" }} />
        <input ref={ref} className="input num" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="Entrez un ticker — ex. HLMS, BRND…"
          style={{ paddingLeft: 44, height: big ? 56 : 48, fontSize: big ? 17 : 15, letterSpacing: "0.04em" }} />
      </div>
      <button type="submit" className={"btn btn-brand " + (big ? "btn-lg" : "")} style={big ? { height: 56 } : { height: 48 }}>
        Analyser <Icon name="arrowRight" size={17} />
      </button>
    </form>
  );
}

/* ---------- État VIDE : vitrine "les mieux notées" ---------- */
function EmptyState({ onPick }) {
  const top = window.LUBIN_DATA.UNIVERSE.filter((u) => u.score >= 9).slice(0, 6);
  return (
    <div className="fade-up">
      <div className="row gap-8" style={{ marginBottom: 14, marginTop: 4 }}>
        <Icon name="star" size={16} style={{ color: "var(--brand)" }} />
        <span className="kicker">Issu de la veille · les mieux notées</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: 14 }}>
        {top.map((u) => {
          const c = scoreColor(u.score);
          return (
            <button key={u.ticker} className="card" onClick={() => onPick(u.ticker)}
              style={{ textAlign: "left", padding: 16, cursor: "pointer", transition: "transform .12s, box-shadow .14s", display: "flex", flexDirection: "column", gap: 12 }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--sh-md)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--sh-sm)"; }}>
              <div className="row between">
                <div className="col gap-2">
                  <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{u.ticker}</span>
                  <span className="tiny muted" style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                </div>
                <ScorePill score={u.score} />
              </div>
              <div className="row between" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                <span className="tiny muted">{u.sector}</span>
                <span className="num tiny" style={{ color: "var(--ink-2)" }}>P/FCF {u.pfcf.toFixed(1)}×</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- État CHARGEMENT : skeleton ---------- */
function LoadingState() {
  return (
    <div className="fade-in col gap-20" style={{ marginTop: 4 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="row gap-24">
          <div className="skel" style={{ width: 116, height: 116, borderRadius: "50%" }} />
          <div className="col gap-10 grow">
            <div className="skel" style={{ width: 220, height: 26 }} />
            <div className="skel" style={{ width: 320, height: 16 }} />
            <div className="skel" style={{ width: "70%", height: 14 }} />
            <div className="skel" style={{ width: 160, height: 40, marginTop: 8, borderRadius: 9 }} />
          </div>
        </div>
      </div>
      <div className="card skel" style={{ height: 240 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skel" style={{ height: 128 }} />)}
      </div>
    </div>
  );
}

/* ---------- État ERREUR ---------- */
function ErrorState({ ticker, kind, onRetry }) {
  const map = {
    notfound: { t: `Ticker « ${ticker} » introuvable`, d: "Aucune société ne correspond à ce symbole. Vérifiez l'orthographe ou essayez un autre ticker.", icon: "search" },
    uncovered: { t: `« ${ticker} » hors couverture`, d: "Ce titre n'est pas (encore) couvert par la veille — seuls les marchés US sont disponibles pour l'instant.", icon: "shield" },
    rate: { t: "Trop de requêtes", d: "Vous avez atteint la limite temporaire. Réessayez dans quelques secondes.", icon: "refresh" },
  };
  const e = map[kind] || map.notfound;
  return (
    <div className="card fade-up col center" style={{ alignItems: "center", textAlign: "center", padding: "56px 32px", gap: 14 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
        <Icon name={e.icon} size={26} />
      </div>
      <h3 style={{ fontSize: 19 }}>{e.t}</h3>
      <p className="muted" style={{ maxWidth: 380, fontSize: 14, lineHeight: 1.55 }}>{e.d}</p>
      <button className="btn btn-ghost" onClick={onRetry} style={{ marginTop: 6 }}>Nouvelle recherche</button>
    </div>
  );
}

/* ---------- Carte d'un critère ---------- */
function CriterionCard({ crit, onChart }) {
  return (
    <div className="card" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 9, transition: "border-color .14s" }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.3, maxWidth: "72%" }}>{crit.label}</span>
        <StatusBadge status={crit.status} />
      </div>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div className="num" style={{ fontSize: 25, fontWeight: 700, color: "var(--ink)" }}>{crit.value}</div>
        <span className="num tiny" style={{ color: "var(--ink-3)", marginBottom: 4 }}>cible {crit.target}</span>
      </div>
      <p className="tiny" style={{ color: "var(--ink-3)", lineHeight: 1.45, minHeight: 32 }}>{crit.note}</p>
      <div className="row between" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 9 }}>
        <InfoPop title={crit.label} why={crit.why} calc={crit.calc} />
        <button onClick={() => onChart(crit)} className="row gap-6"
          style={{ background: "none", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", transition: "all .14s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--brand-soft)"; e.currentTarget.style.color = "var(--brand-ink)"; e.currentTarget.style.borderColor = "transparent"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.borderColor = "var(--line)"; }}>
          <Icon name="bars" size={13} /> Historique
        </button>
      </div>
    </div>
  );
}

/* ---------- Bloc section avec titre ---------- */
function Section({ title, sub, right, children, id }) {
  return (
    <section id={id} className="col gap-14">
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div className="col gap-2">
          <h2 style={{ fontSize: 18.5 }}>{title}</h2>
          {sub && <span className="tiny muted">{sub}</span>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/* ---------- Bloc EARNINGS ---------- */
function EarningsBlock({ company }) {
  const e = company.earnings;
  const surpUp = e.last.surprise >= 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="earnings-grid">
      <div className="card" style={{ padding: 18 }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>Dernier rapport</span>
          <span className="tiny muted num">{e.last.date}</span>
        </div>
        <div className="row gap-24">
          <div className="col gap-2"><span className="tiny muted">BPA réel</span><span className="num" style={{ fontSize: 22, fontWeight: 700 }}>{company.currency}{e.last.epsActual.toFixed(2)}</span></div>
          <div className="col gap-2"><span className="tiny muted">Attendu</span><span className="num" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink-3)" }}>{company.currency}{e.last.epsExpected.toFixed(2)}</span></div>
          <div className="col gap-2"><span className="tiny muted">Surprise</span>
            <span className="num" style={{ fontSize: 22, fontWeight: 700, color: surpUp ? "var(--good)" : "var(--bad)" }}>{surpUp ? "+" : ""}{e.last.surprise.toFixed(1)} %</span>
          </div>
        </div>
        <div className="divider" style={{ margin: "14px 0" }} />
        <div className="row between"><span className="tiny muted">CA</span><span className="num tiny" style={{ fontWeight: 600 }}>{e.last.revActual} <span style={{ color: e.last.revSurprise >= 0 ? "var(--good)" : "var(--bad)" }}>({e.last.revSurprise >= 0 ? "+" : ""}{e.last.revSurprise} %)</span></span></div>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>Prochain rapport</span>
          <span className="badge badge-good" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}><Icon name="calendar" size={11} /> dans {e.next.inDays} j</span>
        </div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{e.next.date}</div>
        <span className="tiny muted">BPA attendu</span>
        <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--brand-ink)", marginTop: 2 }}>{company.currency}{e.next.epsExpected.toFixed(2)}</div>
        <div className="divider" style={{ margin: "14px 0" }} />
        <div className="row gap-6" style={{ alignItems: "flex-end", height: 30 }}>
          {company.earnings.history.map((h, i) => {
            const beat = h.a >= h.e;
            return <div key={i} title={`${h.q}: ${h.a} vs ${h.e}`} style={{ flex: 1, height: `${40 + i * 18}%`, background: beat ? "var(--good)" : "var(--bad)", borderRadius: 3, opacity: 0.8 }} />;
          })}
        </div>
        <span className="tiny muted" style={{ marginTop: 6, display: "block" }}>4 derniers trimestres · battu / manqué</span>
      </div>
    </div>
  );
}

/* ---------- Grille qualitative ---------- */
function QualGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} className="card" style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="row between">
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", maxWidth: "74%", lineHeight: 1.3 }}>{it.label}</span>
            <StatusBadge status={it.status} />
          </div>
          <p className="tiny" style={{ color: "var(--ink-3)", lineHeight: 1.45 }}>{it.note}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Bloc VALORISATION (paramètres ajustables) ---------- */
function ValuationBlock({ company }) {
  const v = company.valuation;
  const [growth, setGrowth] = useState(v.growth);
  const [exitMult, setExitMult] = useState(v.exitMultiple);
  const [ret, setRet] = useState(v.targetReturn);

  // FCF/action projeté à 5 ans, prix de sortie, actualisé au rendement visé
  const years = 5;
  const futureFcf = v.fcfPerShare * Math.pow(1 + growth / 100, years);
  const exitPrice = futureFcf * exitMult;
  const buyPrice = exitPrice / Math.pow(1 + ret / 100, years);
  const upside = ((buyPrice - company.price) / company.price) * 100;
  const cheap = company.price <= buyPrice;

  const Slider = ({ label, value, set, min, max, step, suffix }) => (
    <div className="col gap-6">
      <div className="row between"><span className="label">{label}</span><span className="num" style={{ fontWeight: 700, fontSize: 14, color: "var(--brand-ink)" }}>{value}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--brand)" }} />
    </div>
  );

  return (
    <div className="card val-grid" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "1.1fr 1fr" }}>
      <div style={{ padding: 22, borderRight: "1px solid var(--line)" }}>
        <div className="row gap-8" style={{ marginBottom: 16 }}>
          <Icon name="scale" size={16} style={{ color: "var(--ink-3)" }} />
          <span className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>Hypothèses</span>
        </div>
        <div className="col gap-18">
          <Slider label="Croissance attendue (FCF/an)" value={growth} set={setGrowth} min={0} max={30} step={1} suffix=" %" />
          <Slider label="Multiple de sortie (P/FCF)" value={exitMult} set={setExitMult} min={8} max={40} step={1} suffix="×" />
          <Slider label="Rendement annuel visé" value={ret} set={setRet} min={6} max={20} step={1} suffix=" %" />
        </div>
      </div>
      <div style={{ padding: 22, background: "var(--surface-2)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)", marginBottom: 4 }}>Prix d'achat conseillé</span>
        <div className="num" style={{ fontSize: 40, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{company.currency}{buyPrice.toFixed(0)}</div>
        <div className="row gap-8" style={{ marginTop: 10 }}>
          <span className="tiny muted">Cours actuel</span>
          <span className="num tiny" style={{ fontWeight: 600 }}>{company.currency}{company.price.toFixed(2)}</span>
        </div>
        <div className={"badge " + (cheap ? "badge-good" : "badge-bad")} style={{ marginTop: 12, alignSelf: "flex-start", fontSize: 12.5, padding: "6px 12px" }}>
          {cheap ? "Sous le prix conseillé" : "Au-dessus du prix conseillé"} · {upside >= 0 ? "+" : ""}{upside.toFixed(0)} %
        </div>
        <p className="tiny muted" style={{ marginTop: 14, lineHeight: 1.5 }}>Jugé <b style={{ color: "var(--ink-2)" }}>séparément</b> de la note de qualité. Le prix conseillé est le cours d'entrée pour viser votre rendement.</p>
      </div>
    </div>
  );
}

/* ---------- Mini-barre sticky (note visible au scroll) ---------- */
function StickyScoreBar({ company, visible, onWatch, watched }) {
  const c = scoreColor(company.score);
  return (
    <div style={{
      position: "sticky", top: "var(--nav-h)", zIndex: 40,
      transform: visible ? "translateY(0)" : "translateY(-120%)",
      opacity: visible ? 1 : 0, transition: "transform .28s cubic-bezier(.3,.7,.3,1), opacity .2s",
      pointerEvents: visible ? "auto" : "none",
    }}>
      <div style={{ background: "oklch(1 0 0 / 0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap row between" style={{ height: 54 }}>
          <div className="row gap-12">
            <span className="num" style={{ fontWeight: 800, fontSize: 15 }}>{company.ticker}</span>
            <span className="tiny muted only-desktop">{company.name}</span>
            <span className="num tiny" style={{ fontWeight: 600 }}>{company.currency}{company.price.toFixed(2)}</span>
            <PriceChange change={company.change} size={12} />
          </div>
          <div className="row gap-12">
            <span className="num" style={{ fontWeight: 700, fontSize: 14, color: c.ink, background: c.bg, padding: "4px 10px", borderRadius: 8 }}>{company.score}/10</span>
            <button className={"btn btn-sm " + (watched ? "btn-soft" : "btn-brand")} onClick={onWatch}>
              {watched ? <><Icon name="check" size={14} /> Suivie</> : <><Icon name="plus" size={14} /> Watchlist</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Vue ANALYSE remplie ---------- */
function AnalysisView({ company, onChart, onWatch, watched }) {
  const [horizon, setHorizon] = useState("1A");
  const [showQual, setShowQual] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const scoreRef = useRef(null);
  const horizons = useMemo(() => window.LUBIN_DATA.priceHorizons(company.priceSeed, company.price), [company.ticker]);
  const c = scoreColor(company.score);

  useEffect(() => {
    const onScroll = () => {
      if (!scoreRef.current) return;
      setStickyVisible(scoreRef.current.getBoundingClientRect().bottom < 70);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const counts = company.criteria.reduce((a, cr) => { a[cr.status]++; return a; }, { good: 0, warn: 0, bad: 0 });

  return (
    <>
      <StickyScoreBar company={company} visible={stickyVisible} onWatch={onWatch} watched={watched} />
      <div className="col gap-28 fade-up" style={{ paddingBottom: 60 }}>

        {/* ScoreCard */}
        <div ref={scoreRef} className="card scorecard" style={{ padding: 24, display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center" }}>
          <ScoreCircle score={company.score} />
          <div className="col gap-12">
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div className="col gap-4">
                <div className="row gap-10">
                  <h1 style={{ fontSize: 26 }}>{company.name}</h1>
                  <span className="num" style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-3)", background: "var(--bg-soft)", padding: "3px 9px", borderRadius: 7, alignSelf: "center" }}>{company.ticker}</span>
                </div>
                <div className="row gap-12">
                  <span className="tiny muted">{company.sector}</span>
                  <span className="num tiny" style={{ fontWeight: 600 }}>{company.currency}{company.price.toFixed(2)}</span>
                  <PriceChange change={company.change} abs={company.changeAbs} currency={company.currency} />
                </div>
              </div>
              <button className={"btn " + (watched ? "btn-soft" : "btn-brand")} onClick={onWatch}>
                {watched ? <><Icon name="check" size={16} /> Dans la watchlist</> : <><Icon name="plus" size={16} /> Ajouter à la watchlist</>}
              </button>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)", maxWidth: 620 }}>{company.verdict}</p>
            <div className="col gap-6" style={{ maxWidth: 440 }}>
              <div className="row between"><span className="tiny muted">Composition de la note</span>
                <span className="num tiny" style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                  <span style={{ color: "var(--good)" }}>{counts.good} oui</span> · <span style={{ color: "var(--warn)" }}>{counts.warn} partiel</span> · <span style={{ color: "var(--bad)" }}>{counts.bad} non</span>
                </span>
              </div>
              <CompositionBar counts={counts} />
            </div>
          </div>
        </div>

        {/* Cours */}
        <Section title="Cours" sub="Évolution du prix sur l'horizon sélectionné"
          right={<div className="seg">{Object.keys(horizons).map((h) => <button key={h} data-active={h === horizon} onClick={() => setHorizon(h)}>{h}</button>)}</div>}>
          <div className="card" style={{ padding: "16px 16px 8px" }}>
            <PriceChart data={horizons[horizon]} currency={company.currency} />
          </div>
        </Section>

        {/* 10 critères */}
        <Section title="Les chiffres" sub="10 critères financiers objectifs · la donnée tranche, pas les opinions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(282px, 1fr))", gap: 14 }}>
            {company.criteria.map((cr) => <CriterionCard key={cr.key} crit={cr} onChart={onChart} />)}
          </div>
        </Section>

        {/* Earnings */}
        <Section title="Résultats" sub="Dernier rapport publié et prochaine échéance">
          <EarningsBlock company={company} />
        </Section>

        {/* Qualitatif (à la demande) */}
        <Section title="Analyse qualitative" sub="Business model et management · optionnelle, à la demande"
          right={showQual ? <span className="tiny muted">15 critères évalués</span> : null}>
          {showQual ? (
            <div className="col gap-20 fade-up">
              <div className="col gap-10">
                <span className="kicker" style={{ color: "var(--ink-3)" }}>Business model · 10 critères</span>
                <QualGrid items={company.qualBusiness} />
              </div>
              <div className="col gap-10">
                <span className="kicker" style={{ color: "var(--ink-3)" }}>Management · 5 critères</span>
                <QualGrid items={company.qualMgmt} />
              </div>
            </div>
          ) : (
            <div className="card col center" style={{ alignItems: "center", textAlign: "center", padding: "36px 24px", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-ink)" }}><Icon name="layers" size={22} /></div>
              <p className="muted" style={{ maxWidth: 380, fontSize: 14, lineHeight: 1.5 }}>L'analyse qualitative évalue le moat, la prévisibilité des revenus et la qualité du management — au-delà des seuls chiffres.</p>
              <button className="btn btn-soft" onClick={() => setShowQual(true)}><Icon name="spark" size={15} /> Lancer l'analyse qualitative</button>
            </div>
          )}
        </Section>

        {/* Valorisation */}
        <Section title="Valorisation" sub="Prix d'entrée — jugé séparément de la qualité du business">
          <ValuationBlock company={company} />
        </Section>

        {/* Actualités */}
        <Section title="Actualités récentes" sub="Le contexte, sans le bruit">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {company.news.map((n, i) => (
              <a key={i} className="row between" style={{ padding: "15px 18px", borderBottom: i < company.news.length - 1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer", transition: "background .12s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--brand-softer)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div className="row gap-12">
                  <span className="tiny" style={{ fontWeight: 700, color: "var(--brand-ink)", minWidth: 84 }}>{n.src}</span>
                  <span style={{ fontSize: 14, color: "var(--ink)" }}>{n.title}</span>
                </div>
                <span className="tiny muted num" style={{ whiteSpace: "nowrap" }}>{n.time}</span>
              </a>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

/* ---------- Écran ANALYSER (orchestration des états) ---------- */
function AnalyserScreen({ pendingTicker, clearPending, watchlist, toggleWatch }) {
  const [status, setStatus] = useState("empty"); // empty | loading | error | filled
  const [company, setCompany] = useState(null);
  const [errKind, setErrKind] = useState("notfound");
  const [errTicker, setErrTicker] = useState("");
  const [modalCrit, setModalCrit] = useState(null);

  const run = useCallback((ticker) => {
    if (!ticker) return;
    setStatus("loading");
    window.scrollTo({ top: 0 });
    setTimeout(() => {
      const found = window.LUBIN_DATA.COMPANIES[ticker];
      if (found) { setCompany(found); setStatus("filled"); }
      else {
        setErrTicker(ticker);
        setErrKind(["AAPL", "MSFT", "NVDA", "ASML", "LVMH"].includes(ticker) ? "uncovered" : "notfound");
        setStatus("error");
      }
    }, 1100);
  }, []);

  useEffect(() => {
    if (pendingTicker) { run(pendingTicker); clearPending(); }
  }, [pendingTicker]);

  const watched = company && watchlist.includes(company.ticker);

  return (
    <div style={{ background: "var(--bg)", minHeight: "calc(100vh - var(--nav-h))" }}>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="col gap-6" style={{ marginBottom: 18 }}>
          <SearchBar onSubmit={run} autoFocus={status === "empty"} />
          {status === "empty" && <span className="tiny muted" style={{ marginLeft: 2 }}>Astuce : essayez <b style={{ color: "var(--ink-2)" }}>HLMS</b> (note élevée) ou <b style={{ color: "var(--ink-2)" }}>BRND</b> (note moyenne).</span>}
        </div>

        {status === "empty" && <EmptyState onPick={run} />}
        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState ticker={errTicker} kind={errKind} onRetry={() => setStatus("empty")} />}
        {status === "filled" && company && (
          <AnalysisView company={company} onChart={setModalCrit} watched={watched} onWatch={() => toggleWatch(company.ticker)} />
        )}
      </div>
      {modalCrit && <ChartModal crit={modalCrit} company={company} onClose={() => setModalCrit(null)} />}
    </div>
  );
}

Object.assign(window, { AnalyserScreen });
