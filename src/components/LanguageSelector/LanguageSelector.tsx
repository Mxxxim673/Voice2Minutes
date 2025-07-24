import React from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'ar', name: 'العربية' },
  { code: 'ru', name: 'Русский' },
];

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <div style={{ position: 'relative' }}>
      <select 
        value={i18n.language} 
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="input"
        style={{ 
          width: 'auto',
          minWidth: '120px',
          fontSize: 'var(--font-size-subhead)',
          padding: '8px 12px'
        }}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;