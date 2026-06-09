// Page « Mentions légales » — conforme LCEN (loi n° 2004-575 du 21 juin 2004).
// TODO i18n : extraire vers locales en sprint 3.
import SeoHead from "../../components/SeoHead.js";
import "./legal.css";

export function MentionsLegalesPage() {
  return (
    <main className="legal">
      <SeoHead titleKey="seo.legal.mentions.title" descKey="seo.legal.mentions.desc" />
      <div className="legal-wrap">
        <h1>Mentions légales</h1>
        <p className="legal-updated">Dernière mise à jour : juin 2026</p>

        <section>
          <h2>1. Éditeur du site</h2>
          <p>
            Le site Lubin Investment (ci-après « le Site ») est édité par
            [[À COMPLÉTER : nom et prénom de l'éditeur]], entrepreneur individuel
            sous le régime de la micro-entreprise.
          </p>
          <ul>
            <li>Statut : micro-entrepreneur (entreprise individuelle)</li>
            <li>SIRET : [[À COMPLÉTER : SIRET]]</li>
            <li>Code APE : [[À COMPLÉTER : code APE]]</li>
            <li>
              Adresse du siège : [[À COMPLÉTER : adresse complète du siège]]
            </li>
            <li>Courriel : admin@lubin-investment.com</li>
            <li>
              TVA : TVA non applicable, article 293 B du Code général des impôts
            </li>
          </ul>
          <p>
            Activité : édition d'un logiciel d'aide à la décision financière à
            destination des investisseurs particuliers. L'éditeur n'exerce pas
            d'activité de Conseiller en Investissements Financiers (CIF) au sens
            de l'article L.541-1 du Code monétaire et financier.
          </p>
        </section>

        <section>
          <h2>2. Directeur de la publication</h2>
          <p>
            Directeur de la publication : [[À COMPLÉTER : nom et prénom du
            directeur de publication]].
          </p>
        </section>

        <section>
          <h2>3. Hébergement</h2>
          <p>
            Le Site est hébergé par les prestataires suivants :
          </p>
          <ul>
            <li>
              <strong>Vercel Inc.</strong> — 440 N Barranca Ave #4133, Covina,
              CA 91723, États-Unis. Site :{" "}
              <a href="https://vercel.com" target="_blank" rel="noreferrer">
                vercel.com
              </a>
              .
            </li>
            <li>
              <strong>Neon Inc.</strong> (base de données) — 209 Barton
              Springs Rd, Austin, TX 78704, États-Unis. Site :{" "}
              <a href="https://neon.tech" target="_blank" rel="noreferrer">
                neon.tech
              </a>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Propriété intellectuelle</h2>
          <p>
            L'ensemble des éléments composant le Site (textes, graphismes,
            logos, icônes, code source, base de données, scores propriétaires,
            méthodologies d'analyse) est la propriété exclusive de l'éditeur ou
            de ses partenaires et est protégé par le droit français et
            international de la propriété intellectuelle, notamment les articles
            L.111-1 et suivants du Code de la propriété intellectuelle.
          </p>
          <p>
            Toute reproduction, représentation, modification, publication,
            adaptation, totale ou partielle, des éléments du Site, quel que soit
            le moyen ou le procédé utilisé, est interdite sans autorisation
            écrite préalable de l'éditeur, sauf exceptions prévues à l'article
            L.122-5 du Code de la propriété intellectuelle.
          </p>
        </section>

        <section>
          <h2>5. Données personnelles</h2>
          <p>
            Le traitement des données personnelles fait l'objet d'une politique
            dédiée, consultable sur la page « Politique de confidentialité ».
          </p>
        </section>

        <section>
          <h2>6. Droit applicable et juridiction</h2>
          <p>
            Les présentes mentions légales sont soumises au droit français. En
            cas de litige, et après échec d'une tentative de résolution amiable,
            compétence est attribuée aux tribunaux français compétents
            conformément aux règles de droit commun.
          </p>
        </section>

        <section>
          <h2>7. Contact</h2>
          <p>
            Pour toute question relative au Site, vous pouvez nous écrire à
            l'adresse : admin@lubin-investment.com.
          </p>
        </section>
      </div>
    </main>
  );
}
