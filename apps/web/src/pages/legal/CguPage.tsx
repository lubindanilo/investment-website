// Page « Conditions Générales d'Utilisation » (CGU).
// Contenu en français uniquement, droit français applicable. Bannière EN/ES via LegalLangBanner.
import SeoHead from "../../components/SeoHead.js";
import { LegalLangBanner } from "./LegalLangBanner.js";
import "./legal.css";

export function CguPage() {
  return (
    <main className="legal">
      <SeoHead titleKey="seo.legal.cgu.title" descKey="seo.legal.cgu.desc" />
      <div className="legal-wrap">
        <LegalLangBanner />
        <h1>Conditions Générales d'Utilisation (CGU)</h1>
        <p className="legal-updated">Dernière mise à jour : juin 2026</p>

        <section>
          <h2>1. Objet</h2>
          <p>
            Les présentes Conditions Générales d'Utilisation (ci-après « CGU »)
            ont pour objet de définir les modalités et conditions d'accès et
            d'utilisation du site et de l'application Lubin Investment
            (ci-après « le Service »), édité par Lubin Célestin DANILO,
            micro-entrepreneur immatriculé sous le SIRET 935 377 812 00018.
          </p>
          <p>
            Lubin Investment est un <strong>outil d'aide à la décision</strong>{" "}
            destiné aux investisseurs particuliers. Le Service fournit des
            analyses fondamentales, des scores propriétaires, des comparateurs
            et des listes de suivi.
          </p>
          <p>
            <strong>
              Le Service ne constitue en aucun cas un conseil en investissement,
              une recommandation personnalisée, une sollicitation ni une
              incitation à acheter ou vendre un instrument financier.
            </strong>{" "}
            L'éditeur n'exerce pas d'activité de Conseiller en Investissements
            Financiers (CIF) au sens de l'article L.541-1 du Code monétaire et
            financier. L'utilisateur reste seul juge de l'opportunité de ses
            décisions d'investissement et en assume l'entière responsabilité.
          </p>
        </section>

        <section>
          <h2>2. Acceptation des CGU</h2>
          <p>
            L'utilisation du Service implique l'acceptation pleine et entière
            des présentes CGU. À défaut d'acceptation, l'utilisateur doit
            renoncer à utiliser le Service.
          </p>
        </section>

        <section>
          <h2>3. Accès au Service</h2>
          <p>
            L'accès au Service nécessite la création d'un compte utilisateur via
            une adresse email valide et un mot de passe. Certaines
            fonctionnalités sont accessibles gratuitement ; d'autres sont
            réservées aux abonnés Pro selon les Conditions Générales de Vente
            (CGV).
          </p>
          <p>
            L'utilisateur s'engage à fournir des informations exactes lors de la
            création de son compte et à maintenir confidentiels ses
            identifiants. Toute action effectuée depuis le compte est réputée
            l'avoir été par son titulaire.
          </p>
          <p>
            L'éditeur s'efforce de maintenir le Service accessible 24h/24 et
            7j/7, mais ne peut garantir une disponibilité ininterrompue. Le
            Service peut faire l'objet d'interruptions pour maintenance, mise à
            jour ou pour des raisons techniques indépendantes de la volonté de
            l'éditeur.
          </p>
        </section>

        <section>
          <h2>4. Comportement de l'utilisateur</h2>
          <p>L'utilisateur s'engage à :</p>
          <ul>
            <li>utiliser le Service conformément à sa destination ;</li>
            <li>
              ne pas tenter d'accéder de manière non autorisée aux systèmes
              informatiques de l'éditeur ;
            </li>
            <li>
              ne pas extraire de manière automatisée et massive les données du
              Service (scraping, robots), sauf autorisation écrite préalable ;
            </li>
            <li>
              ne pas revendre, redistribuer ou exploiter commercialement les
              contenus du Service ;
            </li>
            <li>
              ne pas porter atteinte au fonctionnement, à la sécurité ou à
              l'intégrité du Service ;
            </li>
            <li>respecter les droits de propriété intellectuelle de l'éditeur.</li>
          </ul>
          <p>
            Tout manquement à ces obligations pourra entraîner la suspension ou
            la résiliation du compte, sans préjudice de poursuites éventuelles.
          </p>
        </section>

        <section>
          <h2>5. Propriété intellectuelle</h2>
          <p>
            Le Service, sa structure générale, ses textes, ses graphismes, ses
            logos, ses scores propriétaires, ses méthodologies d'analyse, ses
            bases de données et son code source sont la propriété exclusive de
            l'éditeur et sont protégés par le droit français et international de
            la propriété intellectuelle.
          </p>
          <p>
            L'éditeur concède à l'utilisateur un droit personnel, non
            exclusif, non cessible et non transférable d'utiliser le Service
            pour son usage strictement privé, à l'exclusion de toute
            exploitation commerciale.
          </p>
        </section>

        <section>
          <h2>6. Limitation de responsabilité</h2>
          <p>
            Le Service est fourni « en l'état ». L'éditeur ne garantit ni
            l'exactitude, ni l'exhaustivité, ni l'actualité des données et
            analyses présentées. Les données financières proviennent de sources
            tierces ; des erreurs, retards ou anomalies peuvent survenir.
          </p>
          <p>
            Les performances passées d'un instrument financier ne préjugent pas
            de ses performances futures. Tout investissement comporte un risque
            de perte en capital, total ou partiel.
          </p>
          <p>
            Dans toute la mesure permise par la loi, l'éditeur ne saurait être
            tenu responsable :
          </p>
          <ul>
            <li>
              des décisions d'investissement prises par l'utilisateur sur la
              base des informations fournies par le Service ;
            </li>
            <li>
              des pertes financières, directes ou indirectes, résultant de
              l'utilisation du Service ;
            </li>
            <li>
              des dommages liés à l'indisponibilité temporaire du Service ;
            </li>
            <li>
              des dommages liés à des cas de force majeure ou au fait d'un tiers.
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Modification des CGU</h2>
          <p>
            L'éditeur se réserve le droit de modifier les présentes CGU à tout
            moment. Les utilisateurs seront informés de toute modification
            substantielle par email ou par notification au sein du Service. La
            poursuite de l'utilisation du Service après modification vaut
            acceptation des nouvelles CGU.
          </p>
        </section>

        <section>
          <h2>8. Droit applicable et règlement des litiges</h2>
          <p>
            Les présentes CGU sont régies par le droit français. Tout litige
            relatif à leur interprétation ou à leur exécution sera, à défaut
            d'accord amiable, soumis aux tribunaux français compétents.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            Pour toute question concernant les présentes CGU, vous pouvez nous
            contacter à l'adresse : admin@lubin-investment.com.
          </p>
        </section>
      </div>
    </main>
  );
}
