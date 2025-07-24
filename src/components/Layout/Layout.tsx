import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../LanguageSelector/LanguageSelector';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="nav-bar">
        <div className="container nav-content">
          <Link to="/" className="logo">
            {t('common.appName')}
          </Link>
          
          <ul className="nav-links">
            <li>
              <Link 
                to="/audio-to-text" 
                className={`nav-link ${location.pathname === '/audio-to-text' || location.pathname === '/' ? 'active' : ''}`}
              >
                {t('navigation.audioToText')}
              </Link>
            </li>
            <li>
              <Link 
                to="/pricing" 
                className={`nav-link ${location.pathname === '/pricing' ? 'active' : ''}`}
              >
                {t('navigation.pricing')}
              </Link>
            </li>
          </ul>
          
          <LanguageSelector />
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <footer style={{ 
        textAlign: 'center', 
        padding: 'var(--spacing-lg)', 
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-footnote)'
      }}>
        {t('footer.copyright', { year: currentYear })}
      </footer>
    </div>
  );
};

export default Layout;