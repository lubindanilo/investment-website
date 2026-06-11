/**
 * Page 404 dédiée — rendue par la route catch-all (`path="*"`) de l'app.
 * Évite le warning React Router « No routes matched location » et donne à
 * l'utilisateur un message clair + des liens de retour. Marquée noindex.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SeoHead from '../components/SeoHead.js';
import './NotFoundPage.css';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="notfound">
      <SeoHead titleKey="seo.notfound.title" descKey="seo.notfound.desc" noindex />
      <div className="notfound-card">
        <span className="notfound-code num" aria-hidden="true">404</span>
        <h1 className="notfound-title">{t('notFound.title')}</h1>
        <p className="notfound-sub">{t('notFound.sub')}</p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-brand">{t('notFound.home')}</Link>
          <Link to="/screener" className="btn btn-ghost">{t('notFound.screener')}</Link>
        </div>
      </div>
    </div>
  );
}
