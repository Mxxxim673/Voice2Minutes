import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const languages = [
  { code: 'en', name: 'English', displayCode: 'EN' },
  { code: 'zh', name: '中文', displayCode: 'CN' },
  { code: 'ja', name: '日本語', displayCode: 'JA' },
  { code: 'ko', name: '한국어', displayCode: 'KO' },
  { code: 'fr', name: 'Français', displayCode: 'FR' },
  { code: 'de', name: 'Deutsch', displayCode: 'DE' },
  { code: 'es', name: 'Español', displayCode: 'ES' },
];

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className="language-selector">
      <button 
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="globe-icon">🌐</span>
        <span className="language-code">{currentLanguage.displayCode}</span>
        <span className={`arrow ${isOpen ? 'arrow-up' : 'arrow-down'}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="language-dropdown">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`language-option ${lang.code === i18n.language ? 'selected' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
      
      {isOpen && (
        <div 
          className="language-overlay" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default LanguageSelector;