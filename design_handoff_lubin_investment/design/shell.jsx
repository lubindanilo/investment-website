/* ============================================================
   LUBIN — Shell : navigation app, nav marketing, modale graphique
   ============================================================ */

/* ---------- Navigation de l'application (Analyser / Screener / Watchlist) ---------- */
function AppNav({ route, go, onSearch }) {
  const tabs = [
    { id: "analyser", label: "Analyser" },
    { id: "screener", label: "Screener" },
    { id: "watchlist", label: "Watchlist" },
  ];
  const [menu, setMenu] = useState(false);
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50, height: "var(--nav-h)",
      background: "oklch(1 0 0 / 0.82)", backdropFilter: "blur(14px)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div className="wrap-wide row between" style={{ height: "100%" }}>
        <div className="row gap-28">
          <button onClick={() => go("home")} style={{ background: "none", border: "none", padding: 0 }}><Logo size={28} /></button>
          <nav className="row gap-4 only-desktop">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => go(t.id)}
                style={{
                  background: "none", border: "none", padding: "8px 13px", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
                  color: route === t.id ? "var(--brand-ink)" : "var(--ink-2)",
                  position: "relative", transition: "color .14s",
                }}>
                {t.label}
                {route === t.id && <span style={{ position: "absolute", left: 13, right: 13, bottom: -19, height: 2, background: "var(--brand)", borderRadius: 2 }} />}
              </button>
            ))}
          </nav>
        </div>
        <div className="row gap-12">
          <button onClick={() => { go("analyser"); onSearch && onSearch(); }}
            className="row gap-8 only-desktop" style={{
              border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8,
              padding: "0 12px", height: 36, color: "var(--ink-4)", fontSize: 13, width: 210, fontWeight: 500,
            }}>
            <Icon name="search" size={15} />
            <span>Rechercher un ticker…</span>
            <kbd className="num" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-4)", border: "1px solid var(--line)", borderRadius: 4, padding: "1px 5px" }}>/</kbd>
          </button>
          <IconBtn name="bell" label="Alertes" />
          <div className="row gap-8" style={{ paddingLeft: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>LB</div>
          </div>
          <button className="only-mobile" onClick={() => setMenu(!menu)} style={{ background: "none", border: "none", color: "var(--ink)" }}><Icon name="menu" size={22} /></button>
        </div>
      </div>
      {menu && (
        <div className="only-mobile" style={{ borderTop: "1px solid var(--line)", background: "var(--surface)", padding: "8px 18px 14px" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { go(t.id); setMenu(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "12px 4px", fontSize: 16, fontWeight: 600, color: route === t.id ? "var(--brand-ink)" : "var(--ink)" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

/* ---------- Navigation marketing (Accueil) ---------- */
function MarketingNav({ go }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "oklch(1 0 0 / 0.8)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line)" }}>
      <div className="wrap row between" style={{ height: 66 }}>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", padding: 0 }}><Logo size={30} /></button>
        <nav className="row gap-4 only-desktop">
          {["Produit", "Méthode", "Screener", "Tarifs"].map((l) => (
            <a key={l} onClick={() => l === "Screener" && go("screener")} style={{ padding: "8px 13px", fontSize: 14, fontWeight: 600, color: "var(--ink-2)", cursor: "pointer" }}>{l}</a>
          ))}
        </nav>
        <div className="row gap-10">
          <button className="btn btn-ghost btn-sm" onClick={() => go("login")} style={{ height: 38 }}>Se connecter</button>
          <button className="btn btn-brand btn-sm" onClick={() => go("analyser")} style={{ height: 38 }}>Analyser une action</button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Modale graphique plein écran (clic sur une carte critère) ---------- */
function ChartModal({ crit, company, onClose }) {
  const PERIODS = ["1A", "5A", "10A", "20A", "Tout"];
  const [period, setPeriod] = useState("5A");
  const ptsByPeriod = { "1A": 4, "5A": 20, "10A": 40, "20A": 80, "Tout": 96 };
  const seed = (company.priceSeed || 1) * 17 + crit.key.length * 7;
  const base = parseFloat(String(crit.value).replace(/[^0-9.,-]/g, "").replace(",", ".")) || 20;

  const series = useMemo(
    () => window.LUBIN_DATA.makeCriterionSeries(seed, crit.chart, base, ptsByPeriod[period]),
    [period, crit.key]
  );

  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // stats
  const vals = series.map((d) => d.v).filter((v) => v != null);
  const last = vals[vals.length - 1];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const first = vals[0];
  const years = Math.max(1, ptsByPeriod[period] / 4);
  const cagr = first > 0 && last > 0 ? (Math.pow(last / first, 1 / years) - 1) * 100 : null;

  const stat = (label, val) => (
    <div className="col gap-2">
      <span className="tiny muted" style={{ fontWeight: 600 }}>{label}</span>
      <span className="num" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{val}</span>
    </div>
  );

  return (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.25 0.02 274 / 0.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div className="card fade-up" style={{ width: "min(880px, 100%)", maxHeight: "90vh", overflow: "auto", boxShadow: "var(--sh-lg)", borderRadius: "var(--r-lg)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--line)" }}>
          <div className="col gap-4">
            <div className="row gap-8">
              <span className="kicker">{company.ticker}</span>
              <StatusBadge status={crit.status} />
            </div>
            <h3 style={{ fontSize: 20 }}>{crit.label}</h3>
            <span className="tiny muted">Cible {crit.target} · {crit.chart === "bar" ? "histogramme trimestriel" : "ratio dans le temps"}</span>
          </div>
          <IconBtn name="x" label="Fermer" onClick={onClose} size={18} />
        </div>

        <div style={{ padding: "16px 24px" }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="num" style={{ fontSize: 30, fontWeight: 700, color: "var(--ink)" }}>{crit.value}</div>
            <div className="seg">
              {PERIODS.map((p) => (
                <button key={p} data-active={p === period} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <CriterionChart series={series} type={crit.chart} unit={crit.unit} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "16px 24px 22px", borderTop: "1px solid var(--line)", background: "var(--surface-2)" }}>
          {stat("Dernière valeur", last != null ? last.toFixed(1) + crit.unit : "—")}
          {stat("Moyenne", avg.toFixed(1) + crit.unit)}
          {stat("CAGR", cagr != null ? (cagr >= 0 ? "+" : "") + cagr.toFixed(1) + " %" : "n/a")}
          {stat("Points", vals.length + " / " + series.length)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AppNav, MarketingNav, ChartModal });
