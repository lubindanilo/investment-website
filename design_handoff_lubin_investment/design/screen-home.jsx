/* ============================================================
   LUBIN — Écran ACCUEIL (marketing public)
   ============================================================ */

function HeroPreview() {
  // mini-aperçu de ScoreCard, statique, pour le hero
  return (
    <div className="card" style={{ padding: 18, width: "100%", maxWidth: 380, boxShadow: "var(--sh-lg)" }}>
      <div className="row gap-16" style={{ alignItems: "center" }}>
        <ScoreCircle score={9} size={88} stroke={7} animate={false} />
        <div className="col gap-4" style={{ flex: 1 }}>
          <div className="row gap-8"><span style={{ fontWeight: 700, fontSize: 16 }}>Helios Micro.</span><span className="num tiny" style={{ color: "var(--ink-3)", background: "var(--bg-soft)", padding: "2px 7px", borderRadius: 6 }}>HLMS</span></div>
          <span className="tiny muted">Semi-conducteurs · Calcul</span>
          <div className="row gap-8" style={{ marginTop: 2 }}>
            <span className="num tiny" style={{ fontWeight: 600 }}>$284.16</span>
            <span className="num tiny" style={{ color: "var(--good)", fontWeight: 600 }}>+1.84 %</span>
          </div>
        </div>
      </div>
      <div className="col gap-6" style={{ marginTop: 14 }}>
        <CompositionBar counts={{ good: 8, warn: 2, bad: 0 }} />
        <span className="num tiny" style={{ color: "var(--ink-3)" }}><span style={{ color: "var(--good)" }}>8 oui</span> · <span style={{ color: "var(--warn)" }}>2 partiel</span> · 0 non</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        {[["Marge nette", "31,4 %", "good"], ["Cash ROCE", "34,2 %", "good"], ["P/FCF", "32,4×", "warn"], ["Dette/FCF", "0,4×", "good"]].map((r, i) => (
          <div key={i} className="row between" style={{ background: "var(--surface-2)", border: "1px solid var(--line-soft)", borderRadius: 9, padding: "8px 10px" }}>
            <span className="tiny" style={{ color: "var(--ink-2)", fontWeight: 500 }}>{r[0]}</span>
            <span className="num tiny" style={{ fontWeight: 700, color: r[2] === "good" ? "var(--good-ink)" : "var(--warn-ink)" }}>{r[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeScreen({ go }) {
  const benefits = [
    { icon: "bars", t: "Des chiffres, pas du bla-bla", d: "10 critères financiers objectifs calculés en quelques secondes. La donnée tranche, pas les opinions." },
    { icon: "pulse", t: "Toute la cote, surveillée", d: "Une veille automatique note en continu l'univers boursier et fait remonter les meilleures entreprises." },
    { icon: "shield", t: "La méthode des grands investisseurs", d: "Rentabilité, croissance, qualité du bilan : les critères des compounders de long terme." },
    { icon: "scale", t: "Qualité et prix, séparés", d: "La qualité du business et le prix d'entrée sont jugés indépendamment. Jamais l'un pour l'autre." },
  ];
  const steps = [
    { n: "01", t: "Tapez un ticker", d: "Entrez le symbole d'une action. La note de qualité s'affiche en quelques secondes." },
    { n: "02", t: "Lisez la note et sa composition", d: "Une note sur 10, sa répartition vert/orange/rouge, et le détail des 10 critères." },
    { n: "03", t: "Décidez du prix d'entrée", d: "Ajustez vos hypothèses pour obtenir le prix d'achat conseillé, séparé de la qualité." },
  ];
  return (
    <div style={{ background: "var(--bg)" }}>
      <MarketingNav go={go} />

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(900px 420px at 78% -8%, var(--brand-soft), transparent 62%)", pointerEvents: "none" }} />
        <div className="wrap" style={{ position: "relative", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center", padding: "76px 28px 84px" }}>
          <div className="col gap-22 hero-copy">
            <div className="chip" style={{ alignSelf: "flex-start", color: "var(--brand-ink)", borderColor: "var(--brand-soft)", background: "var(--brand-softer)" }}>
              <span className="badge-dot" style={{ background: "var(--brand)" }} /> Analyse fondamentale automatisée
            </div>
            <h1 style={{ fontSize: 54, lineHeight: 1.02, letterSpacing: "-0.035em" }}>
              Analyse fondamentale,<br /><span style={{ color: "var(--brand)" }}>sans le bruit.</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--ink-2)", maxWidth: 480 }}>
              Tapez un ticker, obtenez une note de qualité sur 10 calculée sur des critères financiers objectifs. Repérez les pépites, évitez le bruit des forums.
            </p>
            <div className="row gap-12" style={{ marginTop: 4 }}>
              <button className="btn btn-brand btn-lg" onClick={() => go("analyser")}>Analyser une action <Icon name="arrowRight" size={18} /></button>
              <button className="btn btn-ghost btn-lg" onClick={() => go("screener")}>Explorer le screener</button>
            </div>
            <div className="row gap-28" style={{ marginTop: 10 }}>
              {[["10", "critères chiffrés"], ["6 200+", "titres surveillés"], ["< 3 s", "par analyse"]].map((s, i) => (
                <div key={i} className="col gap-2">
                  <span className="num" style={{ fontSize: 24, fontWeight: 700, whiteSpace: "nowrap" }}>{s[0]}</span>
                  <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>{s[1]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="row center hero-art" style={{ justifyContent: "flex-end" }}>
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* BÉNÉFICES */}
      <section className="wrap" style={{ padding: "20px 28px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {benefits.map((b, i) => (
            <div key={i} className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--brand-soft)", color: "var(--brand-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={b.icon} size={21} /></div>
              <h3 style={{ fontSize: 16.5 }}>{b.t}</h3>
              <p className="tiny" style={{ color: "var(--ink-3)", lineHeight: 1.5 }}>{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{ background: "var(--bg-soft)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ padding: "72px 28px" }}>
          <div className="col gap-8" style={{ marginBottom: 40, alignItems: "center", textAlign: "center" }}>
            <span className="kicker">Comment ça marche</span>
            <h2 style={{ fontSize: 34 }}>Une action jugée en un coup d'œil</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="steps-grid">
            {steps.map((s, i) => (
              <div key={i} className="col gap-12">
                <span className="num" style={{ fontSize: 40, fontWeight: 700, color: "var(--brand)", opacity: 0.9 }}>{s.n}</span>
                <h3 style={{ fontSize: 19 }}>{s.t}</h3>
                <p style={{ color: "var(--ink-2)", lineHeight: 1.55, fontSize: 14.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="wrap" style={{ padding: "84px 28px" }}>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-xl)", background: "var(--ink)", padding: "56px 48px", textAlign: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 300px at 50% 120%, var(--brand), transparent 70%)", opacity: 0.5 }} />
          <div className="col gap-18" style={{ position: "relative", alignItems: "center" }}>
            <h2 style={{ fontSize: 38, color: "#fff", maxWidth: 560 }}>Trouvez les 10/10 sans les chercher</h2>
            <p style={{ color: "oklch(0.82 0.01 270)", fontSize: 17, maxWidth: 480, lineHeight: 1.5 }}>La veille note tout le marché en continu. Vous n'avez plus qu'à choisir.</p>
            <div className="row gap-12" style={{ marginTop: 6 }}>
              <button className="btn btn-brand btn-lg" onClick={() => go("signup")}>Créer un compte <Icon name="arrowRight" size={18} /></button>
              <button className="btn btn-lg" onClick={() => go("analyser")} style={{ background: "oklch(1 0 0 / 0.1)", color: "#fff", border: "1px solid oklch(1 0 0 / 0.2)" }}>Essayer maintenant</button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--line)", padding: "32px 0" }}>
        <div className="wrap row between footer-row">
          <Logo size={26} />
          <span className="tiny muted">Lubin Investment — Analyse fondamentale, sans le bruit. Données illustratives, ne constituent pas un conseil en investissement.</span>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { HomeScreen, HeroPreview });
