import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  fr: { translation: fr },
  es: { translation: es },
  ar: { translation: ar },
  ru: { translation: ru },
  ja: { translation: ja },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: typeof window !== 'undefined' ? (localStorage.getItem('i18nextLng') || 'ja') : 'ja',
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;