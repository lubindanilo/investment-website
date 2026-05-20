import type { AnalyzeResponse } from '@lubin/shared';
import './ScoreCard.css';

export function ScoreCard({ analysis, onAddWatchlist, alreadyInWatchlist }: {
  analysis: AnalyzeResponse;
  onAddWatchlist: () => void;
  alreadyInWatchlist: boolean;
}) {
  const pct = analysis.score / analysis.scoreMax;
  const cls = pct >= 0.75 ? 'high' : pct >= 0.5 ? 'mid' : 'low';
  const verdictCls = analysis.achat ? 'pass' : 'fail';
  const verdictLbl = analysis.achat
    ? 'CRITÈRES SATISFAITS — POTENTIELLE OPPORTUNITÉ'
    : 'CRITÈRES NON SATISFAITS';

  return (
    <div className="score-wrap">
      <div className={`score-circle ${cls}`}>
        <div className="score-num">{analysis.score}/{analysis.scoreMax}</div>
        <div className="score-label">SCORE</div>
      </div>
      <div className="score-info">
        <div className="score-header">
          <h1 className="score-company">
            {analysis.company} <span className="score-ticker">{analysis.ticker}</span>
            {analysis.fundamentalsSource === 'yahoo' && (
              <span className="score-source-badge" title={`Fondamentaux via Yahoo Finance (symbol résolu : ${analysis.yahooSymbol}). Devise : ${analysis.currency}.`}>
                via Yahoo · {analysis.currency}
              </span>
            )}
          </h1>
          <button
            className="btn-secondary score-add-btn"
            onClick={onAddWatchlist}
            disabled={alreadyInWatchlist}
          >
            {alreadyInWatchlist ? '⭐ Dans ta watchlist' : '⭐ Ajouter à la watchlist'}
          </button>
        </div>
        <p className="verdict-direct">{analysis.verdict_direct}</p>
        <div className={`verdict-box ${verdictCls}`}>{verdictLbl}</div>
      </div>
    </div>
  );
}
