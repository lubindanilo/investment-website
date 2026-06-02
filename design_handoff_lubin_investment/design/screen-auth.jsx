/* ============================================================
   LUBIN — Écran AUTH (login / signup), sobre
   ============================================================ */

function AuthScreen({ mode, go }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!email.includes("@")) { setErr("Entrez une adresse e-mail valide."); return; }
    if (pw.length < 6) { setErr("Le mot de passe doit faire au moins 6 caractères."); return; }
    setErr("");
    go("analyser");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }} className="auth-grid">
      {/* Panneau gauche : formulaire */}
      <div className="col" style={{ justifyContent: "center", padding: "40px 8%", background: "var(--bg)" }}>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", padding: 0, alignSelf: "flex-start", marginBottom: 40 }}><Logo size={30} /></button>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>{isSignup ? "Créer un compte" : "Bon retour"}</h1>
          <p className="muted" style={{ fontSize: 14.5, marginBottom: 28 }}>{isSignup ? "Quelques secondes pour commencer à noter le marché." : "Connectez-vous pour reprendre vos analyses."}</p>
          <form onSubmit={submit} className="col gap-16">
            <div className="col gap-6">
              <label className="label">E-mail</label>
              <div style={{ position: "relative" }}>
                <Icon name="mail" size={16} style={{ position: "absolute", left: 13, top: 14, color: "var(--ink-4)" }} />
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" style={{ paddingLeft: 40 }} />
              </div>
            </div>
            <div className="col gap-6">
              <div className="row between"><label className="label">Mot de passe</label>{!isSignup && <a style={{ fontSize: 12.5, color: "var(--brand-ink)", fontWeight: 600, cursor: "pointer" }}>Oublié ?</a>}</div>
              <div style={{ position: "relative" }}>
                <Icon name="lock" size={16} style={{ position: "absolute", left: 13, top: 14, color: "var(--ink-4)" }} />
                <input className="input" type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" style={{ paddingLeft: 40, paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Afficher" style={{ position: "absolute", right: 10, top: 11, background: "none", border: "none", color: "var(--ink-4)", padding: 4 }}><Icon name="eye" size={16} /></button>
              </div>
            </div>
            {err && <div className="badge badge-bad" style={{ alignSelf: "flex-start", padding: "6px 11px" }}>{err}</div>}
            <button type="submit" className="btn btn-brand btn-lg btn-block" style={{ marginTop: 4 }}>{isSignup ? "Créer mon compte" : "Se connecter"}</button>
          </form>
          <div className="row gap-12" style={{ margin: "22px 0" }}>
            <div className="divider" style={{ flex: 1 }} /><span className="tiny muted">ou</span><div className="divider" style={{ flex: 1 }} />
          </div>
          <button className="btn btn-ghost btn-block" style={{ height: 46 }}>Continuer avec Google</button>
          <p className="tiny muted" style={{ textAlign: "center", marginTop: 24 }}>
            {isSignup ? "Déjà un compte ? " : "Pas encore de compte ? "}
            <a onClick={() => go(isSignup ? "login" : "signup")} style={{ color: "var(--brand-ink)", fontWeight: 600, cursor: "pointer" }}>{isSignup ? "Se connecter" : "Créer un compte"}</a>
          </p>
        </div>
      </div>

      {/* Panneau droit : pitch visuel */}
      <div className="auth-aside" style={{ position: "relative", background: "var(--ink)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "56px 6%" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(680px 360px at 30% 10%, var(--brand), transparent 60%)", opacity: 0.45 }} />
        <div style={{ position: "relative", maxWidth: 420 }}>
          <span className="kicker" style={{ color: "oklch(0.8 0.08 277)" }}>Lubin Investment</span>
          <h2 style={{ fontSize: 32, color: "#fff", marginTop: 12, lineHeight: 1.15 }}>La donnée tranche,<br />pas les opinions.</h2>
          <p style={{ color: "oklch(0.78 0.01 270)", fontSize: 15.5, lineHeight: 1.6, marginTop: 16 }}>Une note de qualité sur 10, une valorisation séparée, et une veille qui surveille tout le marché pour vous.</p>
          <div style={{ marginTop: 36, maxWidth: 320 }}>
            <HeroPreview />
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
