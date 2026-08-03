/**
 * Logo officiel d'une société, avec repli sur son code boursier.
 *
 * Trois niveaux, du plus rapide au plus tolérant :
 *   1. le fichier VERSIONNÉ dans `public/logos/` quand le manifeste le connaît. Servi par le
 *      CDN, sans requête vers notre API ni vers un tiers, et il s'affichera encore si les
 *      fournisseurs de logos ferment ;
 *   2. sinon `/api/screener/logo/:ticker`, qui résout à la volée (Finnhub pour les titres US,
 *      le domaine officiel de la société ailleurs) et redirige ;
 *   3. sinon les initiales du ticker, comme avant.
 *
 * Pour élargir le niveau 1 :  node scripts/fetch-logos.mjs
 *
 * Le composant rend le CONTENU d'une pastille (pas la pastille) : il s'insère dans n'importe
 * quel cadre existant (`.tick-badge`, `.anl-company-logo`…) sans en changer le gabarit.
 */
import { useEffect, useState } from 'react';
import { LOGO_FILES } from '../../data/logoManifest.js';
import './CompanyLogo.css';

export function CompanyLogo({ ticker, name }: { ticker: string; name?: string }) {
  // Rang dans la liste des sources ci-dessous. Épuisée → les initiales.
  const [rank, setRank] = useState(0);
  // Nouveau ticker : on repart de la source la plus rapide (sinon un seul échec condamnait
  // tous les tickers affichés ensuite dans le même emplacement).
  useEffect(() => { setRank(0); }, [ticker]);

  const short = ticker.split('.')[0];
  const stored = LOGO_FILES[ticker.toUpperCase()];
  // Liste EXPLICITE : sans elle, un ticker non stocké retentait la même URL d'API et l'image
  // restait cassée (même `src` = pas de nouveau rendu, donc plus jamais de `onError`).
  const sources = [
    ...(stored ? [`/logos/${stored}`] : []),
    `/api/screener/logo/${encodeURIComponent(ticker)}`,
  ];
  const src = sources[rank] ?? null;

  if (!ticker || src == null) return <>{short}</>;
  return (
    <img
      key={src}
      className="clogo"
      src={src}
      alt={name ? `${name} logo` : ''}
      loading="lazy"
      decoding="async"
      // Un fichier local manquant fait retomber sur l'API, puis sur les initiales.
      onError={() => setRank(r => r + 1)}
    />
  );
}
