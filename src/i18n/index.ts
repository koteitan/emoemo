import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import ja from './ja.json';
import { LANG_KEY, migrateLanguage } from '../utils/storage';

// Seed 'emoemo:lng' from the old unnamespaced 'i18nextLng' before the detector
// looks it up. Must run before init().
migrateLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANG_KEY,
    },
  });

export default i18n;
