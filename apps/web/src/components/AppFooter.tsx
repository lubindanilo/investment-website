import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './AppFooter.css';

// Pied de page partagé de l'application : navigation produit, légal et contact.
// Tous les libellés passent par i18n (bloc "footer" dans fr/en/es.json).
export default function AppFooter() {
  const { t } = useTranslation();
  // Année courante calculée à chaque rendu via l'API native du navigateur.
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-grid">
        {/* Colonne 1 — Produit */}
        <div className="app-footer-col">
          <h3>{t('footer.product')}</h3>
          <ul>
            <li>
              <Link to="/analyser">{t('footer.links.analyse')}</Link>
            </li>
            <li>
              <Link to="/screener">{t('footer.links.screener')}</Link>
            </li>
            <li>
              <Link to="/compare">{t('footer.links.compare')}</Link>
            </li>
            <li>
              <Link to="/pricing">{t('footer.links.pricing')}</Link>
            </li>
            <li>
              <Link to="/methodologie">{t('footer.links.methodology')}</Link>
            </li>
          </ul>
        </div>

        {/* Colonne 2 — Légal */}
        <div className="app-footer-col">
          <h3>{t('footer.legal')}</h3>
          <ul>
            <li>
              <Link to="/mentions-legales">{t('footer.links.mentions')}</Link>
            </li>
            <li>
              <Link to="/cgu">{t('footer.links.cgu')}</Link>
            </li>
            <li>
              <Link to="/cgv">{t('footer.links.cgv')}</Link>
            </li>
            <li>
              <Link to="/confidentialite">{t('footer.links.confidentialite')}</Link>
            </li>
          </ul>
        </div>

        {/* Colonne 3 — Contact */}
        <div className="app-footer-col">
          <h3>{t('footer.contact')}</h3>
          <ul>
            <li>
              <a href="mailto:admin@lubin-investment.com">admin@lubin-investment.com</a>
            </li>
            <li>
              <a href="#" rel="noopener noreferrer">Twitter</a>
            </li>
            <li>
              <a href="#" rel="noopener noreferrer">LinkedIn</a>
            </li>
            <li>FR · EN · ES</li>
          </ul>
        </div>
      </div>

      <div className="app-footer-bottom">
        © {year} Lubin Investment — {t('footer.disclaimerShort')}
      </div>
    </footer>
  );
}
