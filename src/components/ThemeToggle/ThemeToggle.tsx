import React, { useState } from 'react';
import { useTheme, type Theme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import './ThemeToggle.css';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('theme.light'), icon: '☀️' },
    { value: 'dark', label: t('theme.dark'), icon: '🌙' },
    { value: 'system', label: t('theme.system'), icon: '💻' }
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[0];

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  return (
    <div className="theme-toggle">
      <button
        className="theme-toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('theme.toggleLabel')}
        title={t('theme.current', { theme: currentTheme.label })}
      >
        <span className="theme-icon">{currentTheme.icon}</span>
      </button>
      
      {isOpen && (
        <>
          <div className="theme-overlay" onClick={() => setIsOpen(false)} />
          <div className="theme-dropdown">
            {themes.map((themeOption) => (
              <button
                key={themeOption.value}
                className={`theme-option ${theme === themeOption.value ? 'active' : ''}`}
                onClick={() => handleThemeChange(themeOption.value)}
              >
                <span className="theme-option-icon">{themeOption.icon}</span>
                <span className="theme-option-label">{themeOption.label}</span>
                {theme === themeOption.value && (
                  <span className="theme-check">✓</span>
                )}
              </button>
            ))}
            <div className="theme-status">
              <span className="theme-status-text">
                {t('theme.currentlyUsing')}: {resolvedTheme === 'dark' ? '🌙' : '☀️'} {resolvedTheme === 'dark' ? t('theme.dark') : t('theme.light')}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeToggle;