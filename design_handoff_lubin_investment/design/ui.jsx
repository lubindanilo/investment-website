/* ============================================================
   LUBIN — Primitives UI partagées
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Icônes (line, 1.6px stroke) ---------- */
const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  chevronR: '<path d="m9 6 6 6-6 6"/>',
  chevronD: '<path d="m6 9 6 6 6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7h6l-3-7ZM19 7l-3 7h6l-3-7Z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>',
};

function Icon({ name, size = 18, stroke = 1.7, className = "", style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }} />
  );
}

/* ---------- Logo Lubin ---------- */
function Logo({ size = 30, showWord = true, color }) {
  const c = color || "var(--brand)";
  return (
    <div className="row gap-10" style={{ alignItems: "center" }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill={c} />
        {/* jauge : arc + repère, évoque la note sur 10 */}
        <path d="M9 21a7 7 0 0 1 14 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.45" />
        <path d="M9 21a7 7 0 0 1 11.5-5.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="16" cy="21" r="2.1" fill="#fff" />
        <rect x="15.3" y="11" width="1.4" height="6.2" rx="0.7" fill="#fff" transform="rotate(34 16 14)" />
      </svg>
      {showWord && (
        <span style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: "-0.04em", color: "var(--ink)" }}>
          Lubin
        </span>
      )}
    </div>
  );
}

/* ---------- ScoreCircle (anneau coloré, note /10) ---------- */
function scoreColor(score) {
  if (score >= 8) return { ring: "var(--good)", bg: "var(--good-bg)", ink: "var(--good-ink)", label: "Élevée" };
  if (score >= 6) return { ring: "var(--warn)", bg: "var(--warn-bg)", ink: "var(--warn-ink)", label: "Moyenne" };
  return { ring: "var(--bad)", bg: "var(--bad-bg)", ink: "var(--bad-ink)", label: "Faible" };
}

function ScoreCircle({ score, size = 116, stroke = 9, animate = true }) {
  const c = scoreColor(score);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / 10;
  const offset = circ * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.ring} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={offset}
          style={animate ? { transition: "stroke-dashoffset 1s cubic-bezier(.3,.7,.3,1)" } : {}} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="num" style={{ fontSize: size * 0.34, fontWeight: 700, lineHeight: 1, color: c.ink }}>
          {score}<span style={{ fontSize: size * 0.16, color: "var(--ink-3)", fontWeight: 600 }}>/10</span>
        </div>
        <div style={{ fontSize: size * 0.1, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: c.ink, marginTop: 3 }}>
          {c.label}
        </div>
      </div>
    </div>
  );
}

/* ---------- Badge de statut (OUI / PARTIEL / NON) ---------- */
const STATUS_LABEL = { good: "OUI", warn: "PARTIEL", bad: "NON" };
function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className={`badge-dot dot-${status}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ---------- Bouton icône ---------- */
function IconBtn({ name, onClick, label, active, size = 16 }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 8,
        border: "1px solid " + (active ? "var(--brand)" : "var(--line)"),
        background: active ? "var(--brand-soft)" : "var(--surface)",
        color: active ? "var(--brand-ink)" : "var(--ink-3)", transition: "all .14s", flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.borderColor = "oklch(0.86 0.006 270)"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = "var(--ink-3)"; e.currentTarget.style.borderColor = "var(--line)"; } }}>
      <Icon name={name} size={size} />
    </button>
  );
}

/* ---------- Variation de prix colorée ---------- */
function PriceChange({ change, abs, currency = "$", size = 13 }) {
  const up = change >= 0;
  return (
    <span className="num" style={{ color: up ? "var(--good)" : "var(--bad)", fontSize: size, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
      <Icon name={up ? "arrowUp" : "arrowDown"} size={size - 1} stroke={2.4} />
      {up ? "+" : ""}{change.toFixed(2)} %
      {abs != null && <span style={{ color: "var(--ink-4)", fontWeight: 500 }}>· {up ? "+" : ""}{currency}{Math.abs(abs).toFixed(2)}</span>}
    </span>
  );
}

/* ---------- Score pill (compact, pour tables) ---------- */
function ScorePill({ score }) {
  const c = scoreColor(score);
  return (
    <span className="num" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2,
      minWidth: 46, padding: "4px 9px", borderRadius: 8, fontWeight: 700, fontSize: 13.5,
      background: c.bg, color: c.ink,
    }}>
      {score}<span style={{ fontSize: 10.5, opacity: 0.65 }}>/10</span>
    </span>
  );
}

/* ---------- Popover info (i) ---------- */
function InfoPop({ title, why, calc }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-label="En savoir plus"
        style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center",
          border: "1px solid var(--line)", background: open ? "var(--brand-soft)" : "transparent", color: open ? "var(--brand-ink)" : "var(--ink-4)", transition: "all .14s" }}>
        <Icon name="info" size={13} />
      </button>
      {open && (
        <span className="pop fade-in" style={{ top: 28, left: "50%", transform: "translateX(-50%)" }} onClick={(e) => e.stopPropagation()}>
          <span style={{ position: "absolute", top: -5, left: "50%", marginLeft: -5 }} className="pop-arrow" />
          <b style={{ display: "block", marginBottom: 6, fontSize: 12.5 }}>{title}</b>
          <span style={{ display: "block", opacity: 0.85, marginBottom: 8 }}>{why}</span>
          <span style={{ display: "block", fontSize: 11, opacity: 0.6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Calcul</span>
          <span className="mono" style={{ display: "block", fontSize: 11.5, opacity: 0.8 }}>{calc}</span>
        </span>
      )}
    </span>
  );
}

Object.assign(window, { Icon, Logo, ScoreCircle, scoreColor, StatusBadge, STATUS_LABEL, IconBtn, PriceChange, ScorePill, InfoPop });
