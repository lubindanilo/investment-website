/* ============================================================
   LUBIN — App : routeur + état global
   ============================================================ */

function App() {
  const [route, setRoute] = useState("home");
  const [pendingTicker, setPendingTicker] = useState(null);
  const [watchlist, setWatchlist] = useState(["HLMS", "ARTE", "LUMA", "SOLA", "BRND"]);

  const go = useCallback((r, ticker) => {
    setRoute(r);
    if (ticker) setPendingTicker(ticker);
    window.scrollTo({ top: 0 });
  }, []);

  const toggleWatch = useCallback((t) => {
    setWatchlist((w) => w.includes(t) ? w.filter((x) => x !== t) : [...w, t]);
  }, []);
  const removeWatch = useCallback((t) => setWatchlist((w) => w.filter((x) => x !== t)), []);

  // raccourci "/" -> recherche
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        e.preventDefault(); go("analyser");
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const showAppNav = ["analyser", "screener", "watchlist"].includes(route);

  return (
    <div>
      {showAppNav && <AppNav route={route} go={go} onSearch={() => {}} />}
      {route === "home" && <HomeScreen go={go} />}
      {route === "analyser" && <AnalyserScreen pendingTicker={pendingTicker} clearPending={() => setPendingTicker(null)} watchlist={watchlist} toggleWatch={toggleWatch} />}
      {route === "screener" && <ScreenerScreen go={go} />}
      {route === "watchlist" && <WatchlistScreen go={go} watchlist={watchlist} removeWatch={removeWatch} />}
      {route === "login" && <AuthScreen mode="login" go={go} />}
      {route === "signup" && <AuthScreen mode="signup" go={go} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
