/* ============================================================
   LUBIN — Écrans SCREENER & WATCHLIST (tableaux denses)
   ============================================================ */

function SortHeader({ label, col, sort, setSort, align }) {
  const active = sort.col === col;
  return (
    <th className="sortable num-cell" style={{ textAlign: align || "left" }}
      onClick={() => setSort({ col, dir: active && sort.dir === "desc" ? "asc" : "desc" })}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.25 }}><Icon name={active && sort.dir === "asc" ? "arrowUp" : "arrowDown"} size={11} stroke={2.4} /></span>
      </span>
    </th>
  );
}

/* ---------- SCREENER ---------- */
function ScreenerScreen({ go }) {
  const [minScore, setMinScore] = useState(6);
  const [maxPfcf, setMaxPfcf] = useState(40);
  const [sort, setSort] = useState({ col: "score", dir: "desc" });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let p = 0;
    const t = setInterval(() => { p = Math.min(100, p + Math.random() * 7); setProgress(p); if (p >= 100) clearInterval(t); }, 220);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    let r = window.LUBIN_DATA.UNIVERSE.filter((u) => u.score >= minScore && u.pfcf <= maxPfcf);
    r = [...r].sort((a, b) => {
      const dir = sort.dir === "desc" ? -1 : 1;
      const av = a[sort.col], bv = b[sort.col];
      return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * dir;
    });
    return r;
  }, [minScore, maxPfcf, sort]);

  const sparks = useMemo(() => {
    const o = {};
    window.LUBIN_DATA.UNIVERSE.forEach((u) => { o[u.ticker] = window.LUBIN_DATA.priceHorizons(u.ticker.charCodeAt(0) + u.pfcf, u.price)["1A"].slice(-22); });
    return o;
  }, []);

  return (
    <div style={{ background: "var(--bg)", minHeight: "calc(100vh - var(--nav-h))" }}>
      <div className="wrap-wide" style={{ paddingTop: 26 }}>
        <div className="row between" style={{ marginBottom: 6, alignItems: "flex-start" }}>
          <div className="col gap-4">
            <h1 style={{ fontSize: 26 }}>Screener</h1>
            <p className="muted" style={{ fontSize: 14 }}>Les meilleures notes de l'univers, triées par la veille. Les 10/10 en tête.</p>
          </div>
          <div className="col gap-6" style={{ width: 280, alignItems: "flex-end" }}>
            <div className="row between wide"><span className="tiny muted" style={{ fontWeight: 600 }}>Veille de l'univers</span><span className="num tiny" style={{ fontWeight: 700, color: progress >= 100 ? "var(--good)" : "var(--brand-ink)" }}>{progress >= 100 ? "À jour" : Math.round(progress) + " %"}</span></div>
            <div style={{ width: "100%", height: 6, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: progress >= 100 ? "var(--good)" : "var(--brand)", borderRadius: 99, transition: "width .3s" }} />
            </div>
            <span className="tiny muted">{Math.round(62 * progress)} / 6 200 titres réévalués</span>
          </div>
        </div>

        {/* Filtres */}
        <div className="card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row gap-8"><Icon name="filter" size={15} style={{ color: "var(--ink-3)" }} /><span className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>Filtres</span></div>
          <div className="row gap-12">
            <span className="label">Note minimale</span>
            <div className="seg">{[4, 6, 8, 9, 10].map((s) => <button key={s} data-active={minScore === s} onClick={() => setMinScore(s)}>{s}+</button>)}</div>
          </div>
          <div className="row gap-12" style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
            <span className="label" style={{ whiteSpace: "nowrap" }}>P/FCF max</span>
            <input type="range" min={8} max={40} value={maxPfcf} onChange={(e) => setMaxPfcf(+e.target.value)} style={{ flex: 1, accentColor: "var(--brand)" }} />
            <span className="num tiny" style={{ fontWeight: 700, color: "var(--brand-ink)", minWidth: 32 }}>{maxPfcf}×</span>
          </div>
          <span className="tiny muted" style={{ marginLeft: "auto" }}>{rows.length} résultats</span>
        </div>

        <div className="card scroll-x" style={{ padding: 0, overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Société</th>
                <th>Secteur</th>
                <SortHeader label="Note" col="score" sort={sort} setSort={setSort} align="right" />
                <SortHeader label="P/FCF" col="pfcf" sort={sort} setSort={setSort} align="right" />
                <SortHeader label="Cours" col="price" sort={sort} setSort={setSort} align="right" />
                <SortHeader label="Var." col="change" sort={sort} setSort={setSort} align="right" />
                <th style={{ textAlign: "right" }}>1 an</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.ticker} onClick={() => go("analyser", u.ticker)}>
                  <td>
                    <div className="row gap-10">
                      <span className="num" style={{ fontWeight: 700, fontSize: 13.5, minWidth: 46 }}>{u.ticker}</span>
                      <span style={{ color: "var(--ink-2)", fontSize: 13.5 }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>{u.sector}</td>
                  <td className="num-cell"><ScorePill score={u.score} /></td>
                  <td className="num-cell num" style={{ fontWeight: 600 }}>{u.pfcf.toFixed(1)}×</td>
                  <td className="num-cell num">{u.price.toFixed(2)}</td>
                  <td className="num-cell num" style={{ color: u.change >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 600 }}>{u.change >= 0 ? "+" : ""}{u.change.toFixed(2)} %</td>
                  <td className="num-cell" style={{ textAlign: "right" }}><div style={{ display: "inline-flex" }}><Sparkline data={sparks[u.ticker]} /></div></td>
                  <td className="num-cell" style={{ width: 40 }}><span style={{ color: "var(--ink-4)" }}><Icon name="chevronR" size={16} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ height: 50 }} />
      </div>
    </div>
  );
}

/* ---------- WATCHLIST ---------- */
function WatchlistScreen({ go, watchlist, removeWatch }) {
  const [sort, setSort] = useState({ col: "score", dir: "desc" });
  const all = window.LUBIN_DATA.WATCHLIST_INIT;
  const rows = useMemo(() => {
    let r = all.filter((w) => watchlist.includes(w.ticker));
    r = [...r].sort((a, b) => {
      const dir = sort.dir === "desc" ? -1 : 1;
      const av = a[sort.col], bv = b[sort.col];
      return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * dir;
    });
    return r;
  }, [watchlist, sort]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "calc(100vh - var(--nav-h))" }}>
      <div className="wrap-wide" style={{ paddingTop: 26 }}>
        <div className="row between" style={{ marginBottom: 18, alignItems: "flex-start" }}>
          <div className="col gap-4">
            <h1 style={{ fontSize: 26 }}>Watchlist</h1>
            <p className="muted" style={{ fontSize: 14 }}>{rows.length} action{rows.length > 1 ? "s" : ""} suivie{rows.length > 1 ? "s" : ""} · prix et notes mis à jour en continu.</p>
          </div>
          <button className="btn btn-ghost" onClick={() => go("screener")}><Icon name="plus" size={16} /> Ajouter depuis le screener</button>
        </div>

        {rows.length === 0 ? (
          <div className="card col center" style={{ alignItems: "center", textAlign: "center", padding: "60px 24px", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}><Icon name="star" size={24} /></div>
            <h3 style={{ fontSize: 19 }}>Votre watchlist est vide</h3>
            <p className="muted" style={{ maxWidth: 360, fontSize: 14, lineHeight: 1.5 }}>Ajoutez des actions depuis une analyse ou le screener pour suivre leur note et leurs prochains résultats.</p>
            <button className="btn btn-brand" onClick={() => go("screener")} style={{ marginTop: 4 }}>Explorer le screener</button>
          </div>
        ) : (
          <div className="card scroll-x" style={{ padding: 0, overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Société</th>
                  <SortHeader label="Cours" col="price" sort={sort} setSort={setSort} align="right" />
                  <SortHeader label="Var." col="change" sort={sort} setSort={setSort} align="right" />
                  <SortHeader label="P/FCF" col="pfcf" sort={sort} setSort={setSort} align="right" />
                  <SortHeader label="Note" col="score" sort={sort} setSort={setSort} align="right" />
                  <th>Prochains résultats</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.ticker} onClick={() => go("analyser", w.ticker)}>
                    <td>
                      <div className="row gap-10">
                        <span className="num" style={{ fontWeight: 700, fontSize: 13.5, minWidth: 46 }}>{w.ticker}</span>
                        <span style={{ color: "var(--ink-2)", fontSize: 13.5 }}>{w.name}</span>
                      </div>
                    </td>
                    <td className="num-cell num" style={{ fontWeight: 600 }}>${w.price.toFixed(2)}</td>
                    <td className="num-cell num" style={{ color: w.change >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 600 }}>{w.change >= 0 ? "+" : ""}{w.change.toFixed(2)} %</td>
                    <td className="num-cell num">{w.pfcf.toFixed(1)}×</td>
                    <td className="num-cell"><ScorePill score={w.score} /></td>
                    <td><span className="num tiny" style={{ color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="calendar" size={13} style={{ color: "var(--ink-4)" }} />{w.nextEarnings}</span></td>
                    <td className="num-cell" style={{ width: 50 }}>
                      <button onClick={(e) => { e.stopPropagation(); removeWatch(w.ticker); }} aria-label="Retirer"
                        style={{ background: "none", border: "none", color: "var(--ink-4)", padding: 6, borderRadius: 7, transition: "all .14s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--bad)"; e.currentTarget.style.background = "var(--bad-bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-4)"; e.currentTarget.style.background = "none"; }}>
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ height: 50 }} />
      </div>
    </div>
  );
}

Object.assign(window, { ScreenerScreen, WatchlistScreen });
