/* ============================================================
   LUBIN — Graphiques SVG (cours, sparkline, modale critère)
   Courbe de marque en indigo. Vert/orange/rouge réservés à la data.
   ============================================================ */

/* Construit un path lissé (Catmull-Rom -> Bézier) à partir de points {x,y} */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ---------- Courbe de cours (page Analyser) ---------- */
function PriceChart({ data, color = "var(--brand)", height = 240, currency = "$" }) {
  const ref = useRef(null);
  const [w, setW] = useState(700);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const pad = { t: 14, r: 8, b: 22, l: 46 };
  const iw = Math.max(120, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * iw,
    y: pad.t + ih - ((v - min) / span) * ih,
    v,
  }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${pad.t + ih} L ${pts[0].x} ${pad.t + ih} Z`;
  const up = data[data.length - 1] >= data[0];
  const gid = "pg" + Math.round(min);

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + (span * i) / yTicks);

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((x - pad.l) / iw) * (data.length - 1));
    if (i >= 0 && i < data.length) setHover({ ...pts[i], i });
  }

  return (
    <div ref={ref} style={{ width: "100%" }} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} onMouseMove={onMove} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const y = pad.t + ih - ((t - min) / span) * ih;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
              <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fontFamily="var(--mono)" fill="var(--ink-4)">
                {currency}{t.toFixed(0)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {hover && (
          <g>
            <line x1={hover.x} y1={pad.t} x2={hover.x} y2={pad.t + ih} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={hover.x} cy={hover.y} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="num" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
          Point {hover.i + 1} · <b style={{ color: "var(--ink)" }}>{currency}{hover.v.toFixed(2)}</b>
        </div>
      )}
    </div>
  );
}

/* ---------- Sparkline (tables / cartes) ---------- */
function Sparkline({ data, width = 86, height = 28, color }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const up = data[data.length - 1] >= data[0];
  const c = color || (up ? "var(--good)" : "var(--bad)");
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (width - 2) + 1,
    y: height - 2 - ((v - min) / span) * (height - 4),
  }));
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={smoothPath(pts)} fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Graphique de critère (modale) : barres ou courbe, gère les trous ---------- */
function CriterionChart({ series, type, height = 320, unit = "" }) {
  const ref = useRef(null);
  const [w, setW] = useState(760);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const pad = { t: 18, r: 12, b: 30, l: 52 };
  const iw = Math.max(160, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const vals = series.map((d) => d.v).filter((v) => v != null);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (type === "bar") min = Math.min(0, min);
  const span = (max - min) || 1;
  const y0 = pad.t + ih - ((0 - min) / span) * ih; // ligne du zéro pour barres
  const xFor = (i) => pad.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const yFor = (v) => pad.t + ih - ((v - min) / span) * ih;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + (span * i) / yTicks);

  // largeur de barre basée sur l'espacement (les trous restent vides)
  const slot = iw / series.length;
  const bw = Math.min(26, slot * 0.62);

  // courbe : on segmente sur les trous (pas de ligne qui traverse les null)
  const segments = [];
  let cur = [];
  series.forEach((d, i) => {
    if (d.v == null) { if (cur.length) segments.push(cur); cur = []; }
    else cur.push({ x: xFor(i), y: yFor(d.v), v: d.v, i });
  });
  if (cur.length) segments.push(cur);

  return (
    <div ref={ref} style={{ width: "100%" }} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} style={{ display: "block" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * w;
          const i = Math.round(((x - pad.l) / iw) * (series.length - 1));
          if (i >= 0 && i < series.length && series[i].v != null) setHover(i);
          else setHover(null);
        }}>
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
              <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fontFamily="var(--mono)" fill="var(--ink-4)">
                {t.toFixed(t > 100 ? 0 : 1)}
              </text>
            </g>
          );
        })}
        {type === "bar" && <line x1={pad.l} y1={y0} x2={w - pad.r} y2={y0} stroke="var(--line)" strokeWidth="1.2" />}

        {type === "bar"
          ? series.map((d, i) => {
              if (d.v == null) return null;
              const x = xFor(i);
              const y = yFor(d.v);
              const h = Math.abs(y0 - y);
              const active = hover === i;
              return (
                <rect key={i} x={x - bw / 2} y={Math.min(y, y0)} width={bw} height={Math.max(2, h)} rx="3"
                  fill={active ? "var(--brand-press)" : "var(--brand)"} opacity={active ? 1 : 0.85}
                  style={{ transition: "opacity .12s" }} />
              );
            })
          : segments.map((seg, si) => (
              <path key={si} d={smoothPath(seg)} fill="none" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            ))}

        {type === "line" && series.map((d, i) =>
          d.v == null ? null : <circle key={i} cx={xFor(i)} cy={yFor(d.v)} r={hover === i ? 4.5 : 0} fill="#fff" stroke="var(--brand)" strokeWidth="2.5" />
        )}

        {hover != null && series[hover].v != null && (
          <g>
            <line x1={xFor(hover)} y1={pad.t} x2={xFor(hover)} y2={pad.t + ih} stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
          </g>
        )}
      </svg>
      <div className="row between" style={{ marginTop: 2 }}>
        <span className="tiny muted">{series.length} trimestres · zones vides = données manquantes</span>
        {hover != null && series[hover].v != null && (
          <span className="num" style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
            T{hover + 1} : {series[hover].v.toFixed(1)}{unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Barre de composition de la note (vert/orange/rouge) ---------- */
function CompositionBar({ counts, height = 10 }) {
  const total = counts.good + counts.warn + counts.bad || 1;
  const seg = (n, color) => n > 0 && (
    <div style={{ width: `${(n / total) * 100}%`, background: color, height: "100%" }} title={`${n}`} />
  );
  return (
    <div style={{ display: "flex", width: "100%", height, borderRadius: 99, overflow: "hidden", background: "var(--line)" }}>
      {seg(counts.good, "var(--good)")}
      {seg(counts.warn, "var(--warn)")}
      {seg(counts.bad, "var(--bad)")}
    </div>
  );
}

Object.assign(window, { PriceChart, Sparkline, CriterionChart, CompositionBar, smoothPath });
