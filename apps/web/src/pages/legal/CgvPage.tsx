// Page « Conditions Générales de Vente » (CGV).
// Contenu en français uniquement, droit français applicable. Bannière EN/ES via LegalLangBanner.
import SeoHead from "../../components/SeoHead.js";
import { LegalLangBanner } from "./LegalLangBanner.js";
import "./legal.css";

export function CgvPage() {
  return (
    <main className="legal">
      <SeoHead titleKey="seo.legal.cgv.title" descKey="seo.legal.cgv.desc" />
      <div className="legal-wrap">
        <LegalLangBanner />
        <h1>Conditions Générales de Vente (CGV)</h1>
        <p className="legal-updated">Dernière mise à jour : juin 2026</p>

        <section>
          <h2>1. Objet et champ d'application</h2>
          <p>
            Les présentes Conditions Générales de Vente (ci-après « CGV »)
            régissent les relations contractuelles entre Lubin Célestin DANILO,
            micro-entrepreneur immatriculé sous le SIRET 935 377 812 00018,
            dont le siège est situé 8 B bis rue de l'Entrepôt, 59800 Lille,
            France (ci-après « l'Éditeur »), et toute personne physique majeure
            consommatrice souscrivant un abonnement au service Lubin Investment
            (ci-après « le Client »).
          </p>
          <p>
            Les CGV sont accessibles à tout moment sur le site et prévalent sur
            toute autre version. Toute souscription emporte acceptation sans
            réserve des présentes CGV.
          </p>
        </section>

        <section>
          <h2>2. Offres et prix</h2>
          <p>
            L'Éditeur propose les offres suivantes :
          </p>
          <ul>
            <li>
              <strong>Offre Gratuite</strong> : accès limité aux fonctionnalités
              de base, sans engagement, sans paiement.
            </li>
            <li>
              <strong>Offre Pro mensuelle</strong> :{" "}
              <strong>19 € TTC par mois</strong>, accès à l'ensemble des
              fonctionnalités, reconduction tacite mensuelle.
            </li>
            <li>
              <strong>Offre Pro annuelle</strong> :{" "}
              <strong>159 € TTC par an</strong>, accès à l'ensemble des
              fonctionnalités, reconduction tacite annuelle.
            </li>
          </ul>
          <p>
            Les prix sont indiqués en euros, toutes taxes comprises.{" "}
            <strong>
              TVA non applicable, article 293 B du Code général des impôts.
            </strong>{" "}
            L'Éditeur se réserve le droit de modifier ses tarifs à tout moment ;
            les abonnements en cours ne sont pas affectés jusqu'à leur
            renouvellement, conformément à l'article 7 ci-après.
          </p>
        </section>

        <section>
          <h2>3. Souscription et paiement</h2>
          <p>
            La souscription s'effectue en ligne via le formulaire prévu à cet
            effet. Le paiement est traité par notre prestataire{" "}
            <strong>Stripe Payments Europe Ltd</strong> (1 Grand Canal Street
            Lower, Dublin 2, Irlande). L'Éditeur n'a accès à aucune donnée
            bancaire du Client ; seul un identifiant de moyen de paiement
            (token) est conservé par Stripe.
          </p>
          <p>
            Le paiement est effectué par carte bancaire ou tout autre moyen
            proposé par Stripe. Le premier paiement intervient au moment de la
            souscription. Les paiements suivants sont prélevés automatiquement à
            la date anniversaire de la souscription (mensuelle ou annuelle).
          </p>
        </section>

        <section>
          <h2>4. Facturation</h2>
          <p>
            Une facture électronique est émise après chaque paiement et est
            accessible depuis l'espace personnel du Client. Conformément à la
            réglementation fiscale, les factures sont conservées pendant 10 ans.
          </p>
        </section>

        <section>
          <h2>5. Prélèvement automatique</h2>
          <p>
            En souscrivant à une offre payante, le Client autorise expressément
            l'Éditeur, via Stripe, à prélever le montant correspondant sur le
            moyen de paiement enregistré à chaque échéance de l'abonnement.
          </p>
          <p>
            En cas d'échec de prélèvement, l'accès aux fonctionnalités payantes
            pourra être suspendu jusqu'à régularisation. Une relance par email
            sera envoyée au Client.
          </p>
        </section>

        <section>
          <h2>6. Durée et reconduction tacite</h2>
          <p>
            L'abonnement est souscrit pour une durée indéterminée avec une
            période initiale d'un mois (offre mensuelle) ou d'un an (offre
            annuelle). À l'issue de chaque période, l'abonnement est{" "}
            <strong>reconduit tacitement</strong> pour une période identique,
            sauf résiliation par le Client dans les conditions prévues à
            l'article 9.
          </p>
          <p>
            Conformément à l'article L.215-1 du Code de la consommation,
            l'Éditeur informera le Client par écrit, au plus tôt trois mois et
            au plus tard un mois avant le terme de la période autorisant le
            rejet de la reconduction, de la possibilité de ne pas reconduire le
            contrat. Lorsque cette information n'a pas été adressée au Client,
            celui-ci peut mettre gratuitement un terme au contrat à tout moment
            à compter de la date de reconduction.
          </p>
        </section>

        <section>
          <h2>7. Modification des tarifs</h2>
          <p>
            En cas d'évolution des tarifs, le Client sera informé par email au
            moins 30 jours avant l'entrée en vigueur des nouveaux tarifs. Le
            Client pourra alors résilier son abonnement sans frais avant la
            prochaine échéance.
          </p>
        </section>

        <section>
          <h2>8. Droit de rétractation</h2>
          <p>
            Conformément à <strong>l'article L.221-18 du Code de la
            consommation</strong>, le Client consommateur dispose d'un délai de{" "}
            <strong>quatorze (14) jours</strong> à compter de la conclusion du
            contrat pour exercer son droit de rétractation, sans avoir à
            justifier de motifs ni à payer de pénalités.
          </p>
          <p>
            Pour exercer ce droit, le Client peut notifier sa décision par email
            à admin@lubin-investment.com ou utiliser le formulaire-type de
            rétractation figurant en annexe des présentes. La charge de la
            preuve de l'exercice du droit de rétractation pèse sur le Client.
          </p>

          <h3>Renoncement exprès au droit de rétractation</h3>
          <p>
            Conformément à <strong>l'article L.221-28 1° du Code de la
            consommation</strong>, le Client est informé que s'il demande
            l'exécution immédiate du Service avant l'expiration du délai de
            rétractation de 14 jours, il <strong>renonce expressément à son
            droit de rétractation</strong> dès lors que le Service aura été
            pleinement exécuté avant la fin de ce délai.
          </p>
          <p>
            Lors de la souscription, le Client est invité à cocher une case
            spécifique acceptant : (i) l'exécution immédiate de l'abonnement et
            (ii) la perte de son droit de rétractation une fois le Service
            pleinement exécuté. En l'absence de cette acceptation expresse, le
            Service ne sera activé qu'à l'issue du délai de 14 jours.
          </p>
          <p>
            En cas d'exercice valable du droit de rétractation, l'Éditeur
            remboursera le Client de tous les paiements reçus dans un délai
            maximal de 14 jours à compter de la notification, par le même moyen
            de paiement que celui utilisé pour la transaction initiale.
          </p>
        </section>

        <section>
          <h2>9. Résiliation</h2>
          <p>
            Le Client peut résilier son abonnement à tout moment depuis son
            espace personnel ou par email à admin@lubin-investment.com. La
            résiliation prend effet à la fin de la période de facturation en
            cours, sans remboursement prorata temporis. Aucun frais de
            résiliation n'est appliqué.
          </p>
          <p>
            L'Éditeur se réserve le droit de résilier l'abonnement de plein
            droit, sans préavis, en cas de manquement grave du Client aux CGU
            (notamment fraude, abus, scraping massif, atteinte à la sécurité du
            Service). Aucun remboursement ne sera dû dans ce cas.
          </p>
        </section>

        <section>
          <h2>10. Service après-vente et réclamations</h2>
          <p>
            Toute réclamation doit être adressée par email à
            admin@lubin-investment.com. L'Éditeur s'engage à répondre dans un
            délai raisonnable, et au plus tard sous 14 jours.
          </p>
        </section>

        <section>
          <h2>11. Médiation de la consommation</h2>
          <p>
            Conformément aux articles L.616-1 et R.616-1 du Code de la
            consommation, le Client consommateur a la possibilité, en cas de
            litige non résolu à l'amiable, de recourir gratuitement au service
            d'un médiateur de la consommation.
          </p>
          <p>
            Médiateur désigné : <strong>Médiation de la consommation pour les
            entrepreneurs du Numérique (CM2C)</strong>, 14 rue Saint-Jean,
            75017 Paris, <a href="https://cm2c.net" target="_blank"
            rel="noopener noreferrer">cm2c.net</a>. Le Client peut saisir
            gratuitement le médiateur par voie électronique ou postale.
          </p>
          <p>
            Le Client peut également recourir à la plateforme européenne de
            règlement en ligne des litiges (RLL) :{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noreferrer"
            >
              https://ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </section>

        <section>
          <h2>12. Droit applicable et juridiction compétente</h2>
          <p>
            Les présentes CGV sont régies par le droit français. À défaut de
            résolution amiable, tout litige relatif à l'exécution ou à
            l'interprétation des présentes sera soumis aux tribunaux français
            compétents conformément aux règles de droit commun, sans préjudice
            des règles protectrices du consommateur prévues par les articles
            L.141-5 et suivants du Code de la consommation et par le Règlement
            (UE) n° 1215/2012.
          </p>
        </section>

        <section>
          <h2>Annexe, Formulaire-type de rétractation</h2>
          <p>
            Veuillez compléter et renvoyer le présent formulaire uniquement si
            vous souhaitez vous rétracter du contrat.
          </p>
          <p>
            À l'attention de Lubin Célestin DANILO, 8 B bis rue de l'Entrepôt,
            59800 Lille, France, admin@lubin-investment.com :
            <br />
            « Je vous notifie par la présente ma rétractation du contrat portant
            sur la prestation de service ci-dessous :
            <br />
           , Commandé le [date] / Reçu le [date]
            <br />
           , Nom du consommateur :
            <br />
           , Adresse du consommateur :
            <br />
           , Signature (uniquement en cas de notification papier) :
            <br />
           , Date : »
          </p>
        </section>
      </div>
    </main>
  );
}
