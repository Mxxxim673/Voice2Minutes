import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import LanguageSelector from '../LanguageSelector/LanguageSelector';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
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
                to="/meeting-minutes" 
                className={`nav-link ${location.pathname === '/meeting-minutes' ? 'active' : ''}`}
              >
                {t('navigation.meetingMinutes')}
              </Link>
            </li>
            <li>
              <Link 
                to="/usage" 
                className={`nav-link ${location.pathname === '/usage' ? 'active' : ''}`}
              >
                {t('navigation.usage')}
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
          
          <div className="nav-right">
            <LanguageSelector />
            {user ? (
              <div className="user-menu">
                <span className="user-email">{user.email}</span>
                <button onClick={logout} className="logout-button">
                  {t('auth.logout')}
                </button>
              </div>
            ) : (
              <Link to="/auth" className="auth-button">
                {t('auth.login')}
              </Link>
            )}
          </div>
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