/**
 * Logo officiel d'une société, avec repli sur son code boursier.
 *
 * L'URL est résolue par NOTRE API (`/api/screener/logo/:ticker`), pas par le navigateur :
 * elle sait où chercher selon la place de cotation (Finnhub pour les titres US, le domaine
 * officiel de la société ailleurs) et met le résultat en cache. Quand aucun logo n'existe,
 * l'API répond 404 et on affiche les initiales du ticker, comme avant.
 *
 * Le composant rend le CONTENU d'une pastille (pas la pastille) : il s'insère dans
 * n'importe quel cadre existant (`.tick-badge`, `.score-logo`…) sans en changer le gabarit.
 */
import { useEffect, useState } from 'react';
import './CompanyLogo.css';

export function CompanyLogo({ ticker, name }: { ticker: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  // Nouveau ticker : on retente (sinon un seul 404 condamnait tous les suivants).
  useEffect(() => { setFailed(false); }, [ticker]);

  const short = ticker.split('.')[0];
  if (failed || !ticker) return <>{short}</>;
  return (
    <img
      className="clogo"
      src={`/api/screener/logo/${encodeURIComponent(ticker)}`}
      alt={name ? `${name} logo` : ''}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
