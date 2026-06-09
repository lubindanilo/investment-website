// Page « Politique de confidentialité » — RGPD (Règlement UE 2016/679) + Loi Informatique et Libertés.
// TODO i18n : extraire vers locales en sprint 3.
import SeoHead from "../../components/SeoHead.js";
import "./legal.css";

export function ConfidentialitePage() {
  return (
    <main className="legal">
      <SeoHead titleKey="seo.legal.confidentialite.title" descKey="seo.legal.confidentialite.desc" />
      <div className="legal-wrap">
        <h1>Politique de confidentialité</h1>
        <p className="legal-updated">Dernière mise à jour : juin 2026</p>

        <section>
          <h2>1. Préambule</h2>
          <p>
            La présente politique de confidentialité décrit la manière dont
            Lubin Investment collecte, utilise et protège les données à
            caractère personnel des utilisateurs du Service, conformément au
            Règlement (UE) 2016/679 du 27 avril 2016 (« RGPD ») et à la loi
            n° 78-17 du 6 janvier 1978 modifiée (« Loi Informatique et
            Libertés »).
          </p>
        </section>

        <section>
          <h2>2. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données personnelles est
            Lubin Célestin DANILO, micro-entrepreneur immatriculé sous le SIRET
            935 377 812 00018, dont le siège est situé 8 B bis rue de
            l'Entrepôt, 59800 Lille, France.
          </p>
          <p>
            Contact : admin@lubin-investment.com.
          </p>
        </section>

        <section>
          <h2>3. Données collectées</h2>
          <p>Dans le cadre de l'utilisation du Service, nous collectons :</p>
          <ul>
            <li>
              <strong>Données de compte</strong> : adresse email, mot de passe
              (stocké uniquement sous forme de <em>hash</em> bcrypt — la version
              en clair n'est jamais conservée).
            </li>
            <li>
              <strong>Données d'usage du Service</strong> : watchlists, listes
              de comparaison, préférences d'affichage, historique de navigation
              au sein du Service.
            </li>
            <li>
              <strong>Données qualitatives issues d'analyses GPT</strong> :
              synthèses textuelles et notes générées par notre intégration avec
              OpenAI, associées à votre compte.
            </li>
            <li>
              <strong>Données de paiement</strong> : identifiant client Stripe,
              tokens de moyen de paiement, historique des transactions et des
              factures. Les données bancaires complètes (numéro de carte, CVV)
              sont collectées et stockées exclusivement par Stripe et ne
              transitent jamais par nos serveurs.
            </li>
            <li>
              <strong>Données techniques</strong> : adresse IP, type de
              navigateur, journaux de connexion (logs techniques nécessaires à
              la sécurité du Service).
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Finalités et bases légales</h2>
          <ul>
            <li>
              <strong>Création et gestion du compte</strong> — base légale :
              exécution du contrat (art. 6.1.b RGPD).
            </li>
            <li>
              <strong>Fourniture du Service et personnalisation</strong>{" "}
              (watchlists, analyses qualitatives) — base légale : exécution du
              contrat (art. 6.1.b RGPD).
            </li>
            <li>
              <strong>Gestion des paiements et de la facturation</strong> —
              base légale : exécution du contrat et obligation légale (art.
              6.1.b et 6.1.c RGPD).
            </li>
            <li>
              <strong>Sécurité du Service et prévention de la fraude</strong> —
              base légale : intérêt légitime (art. 6.1.f RGPD).
            </li>
            <li>
              <strong>Respect des obligations comptables et fiscales</strong> —
              base légale : obligation légale (art. 6.1.c RGPD).
            </li>
            <li>
              <strong>Communication transactionnelle</strong> (confirmations
              d'abonnement, factures, alertes de sécurité) — base légale :
              exécution du contrat (art. 6.1.b RGPD).
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Durées de conservation</h2>
          <ul>
            <li>
              <strong>Données de compte et d'usage</strong> : pendant toute la
              durée de la relation contractuelle, puis pendant{" "}
              <strong>3 ans à compter de la dernière activité</strong> de
              l'utilisateur, à des fins de prospection éventuelle et de
              prévention des litiges.
            </li>
            <li>
              <strong>Factures et données comptables</strong> :{" "}
              <strong>10 ans</strong>, conformément aux articles L.123-22 du
              Code de commerce et L.102 B du Livre des procédures fiscales.
            </li>
            <li>
              <strong>Logs techniques de connexion</strong> : 12 mois,
              conformément aux recommandations de la CNIL et aux obligations de
              conservation des données de connexion.
            </li>
            <li>
              <strong>Données de paiement (tokens Stripe)</strong> : durée
              définie par Stripe en tant que sous-traitant, et au plus tard
              jusqu'à la suppression du compte.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Destinataires et sous-traitants</h2>
          <p>
            Les données personnelles sont accessibles uniquement aux personnes
            habilitées au sein de l'organisation de l'Éditeur, ainsi qu'aux
            sous-traitants suivants, intervenant en qualité de sous-traitants
            au sens de l'article 28 du RGPD :
          </p>
          <ul>
            <li>
              <strong>Stripe Payments Europe Ltd</strong> (Irlande) — traitement
              des paiements et facturation.
            </li>
            <li>
              <strong>Vercel Inc.</strong> (États-Unis) — hébergement de
              l'application web et des fonctions serveur.
            </li>
            <li>
              <strong>Neon Inc.</strong> (États-Unis) — hébergement de la base
              de données PostgreSQL.
            </li>
            <li>
              <strong>OpenAI, LLC</strong> (États-Unis) — génération des
              analyses qualitatives (sans réutilisation des données pour
              l'entraînement, conformément à la politique « OpenAI API data
              usage »).
            </li>
          </ul>
          <p>
            Aucune donnée n'est cédée, vendue ou louée à des tiers à des fins
            commerciales.
          </p>
        </section>

        <section>
          <h2>7. Transferts de données hors Union européenne</h2>
          <p>
            Certains de nos sous-traitants (Vercel, Neon, OpenAI) sont établis
            aux <strong>États-Unis</strong>. Ces transferts sont encadrés par
            les{" "}
            <strong>
              Clauses Contractuelles Types (CCT) adoptées par la Commission
              européenne
            </strong>{" "}
            (décision d'exécution (UE) 2021/914), ainsi que, le cas échéant, par
            la certification de ces prestataires au{" "}
            <strong>Data Privacy Framework (DPF)</strong> UE — États-Unis.
          </p>
          <p>
            Vous pouvez obtenir une copie des garanties mises en œuvre en nous
            adressant une demande à admin@lubin-investment.com.
          </p>
        </section>

        <section>
          <h2>8. Vos droits</h2>
          <p>
            Conformément aux articles 15 à 22 du RGPD et aux articles 49 et
            suivants de la Loi Informatique et Libertés, vous disposez des
            droits suivants sur vos données personnelles :
          </p>
          <ul>
            <li>droit d'accès à vos données ;</li>
            <li>droit de rectification des données inexactes ou incomplètes ;</li>
            <li>
              droit à l'effacement (« droit à l'oubli »), sous réserve des
              obligations légales de conservation ;
            </li>
            <li>droit à la limitation du traitement ;</li>
            <li>droit à la portabilité de vos données ;</li>
            <li>
              droit d'opposition au traitement fondé sur l'intérêt légitime ;
            </li>
            <li>
              droit de définir des directives relatives au sort de vos données
              après votre décès (art. 85 LIL).
            </li>
          </ul>
          <p>
            Vous pouvez exercer ces droits en écrivant à
            admin@lubin-investment.com, en justifiant de votre identité. Une
            réponse vous sera apportée dans un délai d'un mois, prolongeable de
            deux mois en cas de complexité.
          </p>
          <p>
            En cas de difficulté, vous disposez du droit d'introduire une
            réclamation auprès de la <strong>CNIL</strong> (Commission
            Nationale de l'Informatique et des Libertés), 3 place de Fontenoy,
            TSA 80715, 75334 Paris Cedex 07 —{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
              www.cnil.fr
            </a>
            .
          </p>
        </section>

        <section>
          <h2>9. Cookies et traceurs</h2>
          <p>
            À ce stade, le Service utilise{" "}
            <strong>
              uniquement des cookies strictement nécessaires
            </strong>{" "}
            à son fonctionnement (authentification, sécurité, mémorisation de la
            session). Conformément à l'article 82 de la Loi Informatique et
            Libertés, ces cookies sont dispensés du recueil du consentement.
          </p>
          <p>
            Aucun cookie publicitaire, de mesure d'audience non exempté ou de
            traçage tiers n'est déposé. En cas d'évolution (par exemple,
            intégration d'un outil de mesure d'audience), un bandeau de
            consentement conforme aux lignes directrices de la CNIL serait mis
            en place.
          </p>
        </section>

        <section>
          <h2>10. Sécurité</h2>
          <p>
            L'Éditeur met en œuvre des mesures techniques et organisationnelles
            appropriées pour protéger les données personnelles : chiffrement
            HTTPS/TLS en transit, chiffrement au repos via les prestataires
            d'hébergement, hachage des mots de passe (bcrypt), gestion stricte
            des droits d'accès, journalisation des accès sensibles, sauvegardes
            régulières.
          </p>
        </section>

        <section>
          <h2>11. Contact — Délégué à la protection des données (DPO)</h2>
          <p>
            Compte tenu de la taille de la structure (micro-entreprise), aucun
            Délégué à la Protection des Données (DPO) n'a été désigné de manière
            obligatoire au sens de l'article 37 du RGPD. Pour toute question
            relative à vos données personnelles, vous pouvez contacter
            directement le responsable de traitement :
          </p>
          <ul>
            <li>Par email : admin@lubin-investment.com</li>
            <li>Par courrier : Lubin Célestin DANILO, 8 B bis rue de l'Entrepôt, 59800 Lille, France</li>
          </ul>
        </section>

        <section>
          <h2>12. Modification de la présente politique</h2>
          <p>
            La présente politique de confidentialité peut être mise à jour pour
            refléter les évolutions du Service ou de la réglementation. La date
            de dernière mise à jour figure en tête de page. En cas de
            modification substantielle, les utilisateurs seront informés par
            email ou via une notification au sein du Service.
          </p>
        </section>
      </div>
    </main>
  );
}
