// /comparer/:pair côté HUMAIN.
//
// Les pages de comparaison « X vs Y » existent pour être INDEXÉES : les bots reçoivent un
// vrai HTML pré-rendu (cf. renderCompareHtml dans apps/api/src/routes/seoPrerender.ts).
// Un humain qui arrive sur la même URL n'a en revanche aucune raison de lire un tableau
// figé : on l'envoie sur le comparateur interactif, avec les deux tickers déjà chargés.
//
// La redirection est un `replace` : elle ne pollue pas l'historique du navigateur, donc le
// bouton retour ramène bien à la page précédente et pas dans une boucle.
import { Navigate, useParams } from 'react-router-dom';

/** Parse « aapl-vs-msft » → ['AAPL','MSFT']. Doit rester aligné sur parseComparePair côté API. */
function parsePair(slug: string | undefined): [string, string] | null {
  const m = /^([a-z0-9.\-]{1,12})-vs-([a-z0-9.\-]{1,12})$/i.exec(slug ?? '');
  if (!m || !m[1] || !m[2]) return null;
  const a = m[1].toUpperCase();
  const b = m[2].toUpperCase();
  return a === b ? null : [a, b];
}

export default function ComparePairRedirect() {
  const { pair } = useParams<{ pair: string }>();
  const parsed = parsePair(pair);
  // Paire illisible : on renvoie sur le comparateur vide plutôt que sur une 404, l'intention
  // de l'utilisateur (comparer deux actions) reste servie.
  if (!parsed) return <Navigate to="/compare" replace />;
  return <Navigate to={`/compare?tickers=${parsed[0]},${parsed[1]}`} replace />;
}
