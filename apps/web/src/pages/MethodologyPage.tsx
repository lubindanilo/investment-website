/**
 * MethodologyPage — page publique « Méthodologie ».
 *
 * Détaille les 10 critères fondamentaux scorés par Lubin Investment, leurs formules,
 * leurs seuils et leur justification. Présente aussi la régression Theil-Sen utilisée
 * pour mesurer les tendances long terme et liste les sources de données mobilisées.
 *
 * Objectif éditorial : maximum de transparence. L'utilisateur doit comprendre exactement
 * ce qu'il achète quand il prend l'abonnement Pro.
 *
 * Structure : Hero → Pourquoi (3 paragraphes) → 10 critères (cards) → Theil-Sen → Sources
 * (4 cards) → Limites → CTA → Disclaimer.
 *
 * TODO i18n : extraire en sprint 3.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import SeoHead from '../components/SeoHead.js';
import './MethodologyPage.css';

// TODO i18n : extraire en sprint 3.
type Critere = {
  num: number;
  nom: string;
  formule: string;
  seuil: string;
  pourquoi: string;
};

// TODO i18n : extraire en sprint 3.
const CRITERES: Critere[] = [
  {
    num: 1,
    nom: 'Rentable',
    formule: 'Marge nette = Résultat net / Chiffre d\'affaires',
    seuil: '> 0 %',
    pourquoi:
      "Une entreprise qui ne gagne pas d'argent n'est pas une affaire d'investissement. " +
      "Ce premier filtre élimine les sociétés structurellement déficitaires.",
  },
  {
    num: 2,
    nom: 'Ventes en croissance',
    formule: 'Croissance CA = pente Theil-Sen du chiffre d\'affaires sur 5 ans',
    seuil: '> 10 % par an',
    pourquoi:
      "La croissance organique du chiffre d'affaires reste le meilleur moteur de création de valeur " +
      "à long terme. La régression Theil-Sen lisse les exercices exceptionnels.",
  },
  {
    num: 3,
    nom: 'Profits par action en croissance',
    formule: 'Croissance FCF/action SBC-ajusté = pente Theil-Sen sur 5 ans',
    seuil: '> 10 % par an',
    pourquoi:
      "Ce que touche réellement l'actionnaire, c'est le cash par action après dilution. " +
      "On retraite la rémunération en actions (Stock-Based Compensation) pour éviter les illusions comptables.",
  },
  {
    num: 4,
    nom: 'Nombre d\'actions maîtrisé',
    formule: 'Variation annuelle du nombre d\'actions dilué sur 5 ans',
    seuil: 'Stable ou en baisse',
    pourquoi:
      "Une dilution massive transfère la valeur des actionnaires existants vers les nouveaux entrants. " +
      "Les meilleures entreprises rachètent leurs actions plutôt que d'en émettre.",
  },
  {
    num: 5,
    nom: 'Profitabilité cash',
    formule: 'Marge FCF = Free Cash Flow / Chiffre d\'affaires',
    seuil: '> 10 %',
    pourquoi:
      "Le cash est un fait, le bénéfice est une opinion comptable. Une marge FCF élevée signifie " +
      "que chaque euro de revenu génère du vrai cash disponible pour les actionnaires.",
  },
  {
    num: 6,
    nom: 'Marges en expansion',
    formule: 'Operating leverage = pente Theil-Sen de la marge opérationnelle sur 5 ans',
    seuil: 'Pente positive',
    pourquoi:
      "Les marges qui s'étendent dans le temps révèlent un avantage compétitif réel : pricing power, " +
      "économies d'échelle ou effet de réseau. C'est un signal de qualité durable.",
  },
  {
    num: 7,
    nom: 'Rendement du capital investi',
    formule: 'Cash ROCE (Bettin-Mauboussin) = FCF / (Capitaux propres + Dette nette − Cash excédentaire)',
    seuil: '> 15 %',
    pourquoi:
      "Mesure popularisée par Michael Mauboussin : combien de cash l'entreprise génère pour chaque " +
      "euro réellement immobilisé. Au-dessus de 15 %, on tient un compounder de qualité.",
  },
  {
    num: 8,
    nom: 'Endettement maîtrisé',
    formule: 'Dette nette / FCF = (Dette financière − Trésorerie) / Free Cash Flow',
    seuil: '< 3 ans',
    pourquoi:
      "Combien d'années de cash flow seraient nécessaires pour rembourser toute la dette ? " +
      "Au-delà de 3 ans, le risque de bilan devient un sujet en cas de retournement.",
  },
  {
    num: 9,
    nom: 'Bénéfices transformés en cash',
    formule: 'FCF / Résultat net (Cash conversion ratio)',
    seuil: '> 1',
    pourquoi:
      "Vérifie que les bénéfices comptables se traduisent vraiment en cash. " +
      "Un ratio < 1 récurrent signale souvent une qualité comptable douteuse ou des besoins en BFR croissants.",
  },
  {
    num: 10,
    nom: 'Délai d\'encaissement net',
    formule: 'CCC = DSO + DIO − DPO (Days Sales Outstanding + Days Inventory − Days Payable)',
    seuil: 'Faible ou négatif',
    pourquoi:
      "Le Cash Conversion Cycle mesure combien de jours l'entreprise immobilise du cash dans son cycle " +
      "d'exploitation. Les meilleures (Apple, Amazon) ont un CCC négatif : leurs fournisseurs financent leur croissance.",
  },
];

// TODO i18n : extraire en sprint 3.
type Source = {
  nom: string;
  role: string;
  detail: string;
};

const SOURCES: Source[] = [
  {
    nom: 'SEC EDGAR (XBRL)',
    role: 'États financiers officiels US',
    detail:
      "Source primaire pour les sociétés américaines. Données XBRL directement issues des dépôts " +
      "10-K et 10-Q auprès du régulateur. Zéro intermédiaire, zéro retraitement.",
  },
  {
    nom: 'Finnhub',
    role: 'Cotations, fondamentaux internationaux',
    detail:
      "Couverture des marchés européens et internationaux, prix temps quasi-réel, calendriers " +
      "earnings et données fondamentales agrégées.",
  },
  {
    nom: 'Yahoo Finance',
    role: 'Fallback prix et calendriers',
    detail:
      "Utilisé en secours pour les dates de publication des résultats et certains historiques de prix " +
      "non couverts ailleurs.",
  },
  {
    nom: 'OpenAI GPT (Pro uniquement)',
    role: 'Analyse qualitative',
    detail:
      "Pour les abonnés Pro : génération d'une analyse qualitative du business model, des risques " +
      "et de la thèse d'investissement. Le scoring quantitatif des 10 critères reste 100 % déterministe.",
  },
];

export function MethodologyPage() {
  const { user } = useAuth();

  return (
    <div className="methodo">
      <SeoHead titleKey="seo.methodology.title" descKey="seo.methodology.desc" />
      <div className="wrap methodo-wrap">

        {/* Hero */}
        <header className="methodo-hero">
          <div className="methodo-hero-chip">Méthodologie</div>
          <h1 className="methodo-hero-title">
            10 critères, des sources publiques, zéro boîte noire.
          </h1>
          <p className="methodo-hero-lede">
            Lubin Investment applique la même grille de lecture à chaque société : dix critères
            fondamentaux, scorés à partir des dépôts réglementaires officiels. Voici exactement
            comment fonctionne le moteur.
          </p>
        </header>

        {/* Pourquoi */}
        <section className="methodo-why">
          <h2 className="methodo-section-title">Pourquoi cette méthode</h2>
          <div className="methodo-why-stack">
            <p>
              La plupart des analyses d'actions reposent sur des opinions, des consensus d'analystes
              ou des indicateurs de momentum. Ces signaux changent en permanence et reflètent surtout
              l'humeur du marché. Nous avons préféré nous attacher à des faits comptables vérifiables,
              extraits directement des rapports déposés auprès du régulateur.
            </p>
            <p>
              Les dix critères sélectionnés couvrent trois dimensions d'une entreprise de qualité :
              la croissance (CA, FCF/action, marges), la profitabilité du capital (Cash ROCE, marge FCF)
              et la solidité financière (endettement, conversion en cash, cycle d'exploitation).
              C'est l'ossature que les meilleurs investisseurs long terme — Buffett, Mauboussin,
              Terry Smith — utilisent depuis des décennies, traduite en formules reproductibles.
            </p>
            <p>
              Chaque critère répond à une question simple, avec un seuil clair. Pas de note opaque,
              pas de pondération secrète. Si une société rate un critère, on vous dit lequel et pourquoi.
              Et si vous n'êtes pas d'accord avec l'un de nos seuils, vous pouvez l'ignorer en
              connaissance de cause.
            </p>
          </div>
        </section>

        {/* Les 10 critères */}
        <section className="methodo-criteres">
          <h2 className="methodo-section-title">Les 10 critères en détail</h2>
          <div className="methodo-criteres-grid">
            {CRITERES.map(c => (
              <article key={c.num} className="methodo-critere-card">
                <div className="methodo-critere-head">
                  <span className="methodo-critere-num">{String(c.num).padStart(2, '0')}</span>
                  <h3 className="methodo-critere-nom">{c.nom}</h3>
                </div>
                <dl className="methodo-critere-dl">
                  <div>
                    <dt>Formule</dt>
                    <dd className="methodo-critere-formule">{c.formule}</dd>
                  </div>
                  <div>
                    <dt>Seuil</dt>
                    <dd className="methodo-critere-seuil">{c.seuil}</dd>
                  </div>
                  <div>
                    <dt>Pourquoi</dt>
                    <dd className="methodo-critere-pourquoi">{c.pourquoi}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        {/* Régression Theil-Sen */}
        <section className="methodo-theil">
          <h2 className="methodo-section-title">Pourquoi la régression Theil-Sen ?</h2>
          <div className="methodo-theil-card">
            <p>
              Pour mesurer une tendance sur 5 ans (croissance du CA, du FCF/action, des marges),
              la régression linéaire classique est sensible aux valeurs extrêmes. Une année
              exceptionnelle suffit à fausser la pente.
            </p>
            <p>
              La régression Theil-Sen calcule la pente médiane parmi toutes les paires de points
              possibles. Elle est robuste aux valeurs aberrantes : un exercice atypique ne dérègle
              pas la mesure de la tendance de fond.
            </p>
            <p>
              <strong>Exemple Adobe :</strong> en 2022, le rachat raté de Figma a fait exploser
              les frais exceptionnels. Une régression classique aurait conclu à un ralentissement
              de la croissance. La régression Theil-Sen, elle, neutralise ce point isolé et
              continue de mesurer la dynamique réelle de l'activité.
            </p>
          </div>
        </section>

        {/* Sources */}
        <section className="methodo-sources">
          <h2 className="methodo-section-title">Sources de données</h2>
          <div className="methodo-sources-grid">
            {SOURCES.map((s, i) => (
              <article key={i} className="methodo-source-card">
                <h3 className="methodo-source-nom">{s.nom}</h3>
                <p className="methodo-source-role">{s.role}</p>
                <p className="methodo-source-detail">{s.detail}</p>
              </article>
            ))}
          </div>
          <p className="methodo-sources-note">
            Nous citons systématiquement la source de chaque donnée affichée. Aucun chiffre
            « propriétaire », aucun retraitement non documenté.
          </p>
        </section>

        {/* Limites */}
        <section className="methodo-limites">
          <h2 className="methodo-section-title">Limites — ce que la méthode ne fait pas</h2>
          <div className="methodo-limites-card">
            <ul>
              <li>
                <strong>La méthode est rétrospective.</strong> Elle juge la qualité historique d'une
                société. Un compounder de qualité peut très bien décevoir dans les années à venir,
                et une société médiocre peut se redresser.
              </li>
              <li>
                <strong>Elle ignore la valorisation.</strong> Les 10 critères ne disent rien du prix
                payé. Une excellente société achetée trop cher reste un mauvais investissement.
                Nous publions séparément des indicateurs de valorisation (PER, FCF yield, EV/EBITDA).
              </li>
              <li>
                <strong>Elle est inadaptée à certains secteurs.</strong> Banques, assurances, foncières
                cotées (REIT), sociétés en phase de pré-rentabilité : les critères de marge nette,
                de Cash ROCE ou de CCC ne s'appliquent pas tels quels.
              </li>
              <li>
                <strong>Les données XBRL ne sont pas parfaites.</strong> Certains champs sont mal
                taggués par les déposants, ou utilisent des concepts XBRL non standards. Nous
                améliorons en continu nos chaînes de fallback, mais des erreurs résiduelles existent.
              </li>
              <li>
                <strong>Aucune méthode ne remplace votre jugement.</strong> Les scores sont une
                aide à la décision, pas une recommandation d'achat. Vous restez seul juge.
              </li>
            </ul>
          </div>
        </section>

        {/* CTA final */}
        <section className="methodo-cta">
          <h2 className="methodo-cta-title">Prêt à appliquer la méthode ?</h2>
          <p className="methodo-cta-sub">
            Lancez une analyse sur le titre de votre choix. Les 10 critères, en clair, en 30 secondes.
          </p>
          <div className="methodo-cta-buttons">
            <Link to={user ? '/analyser' : '/signup'} className="btn btn-brand">
              {user ? 'Lancer une analyse' : 'Créer un compte gratuit'}
            </Link>
          </div>
        </section>

        {/* Disclaimer */}
        <footer className="methodo-disclaimer">
          <p>
            Lubin Investment fournit un outil d'aide à l'analyse fondamentale d'actions cotées,
            à but informatif et éducatif. Les scores affichés ne constituent ni un conseil en
            investissement, ni une recommandation d'achat ou de vente. Les performances passées
            ne préjugent pas des performances futures. Faites vos propres recherches et consultez
            un conseiller agréé avant toute décision d'investissement.
          </p>
        </footer>

      </div>
    </div>
  );
}
