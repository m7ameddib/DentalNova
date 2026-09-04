import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_DIRECTION: Record<SupportedLanguage, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

const STORAGE_KEY = 'dnt-dental-language';

export function getStoredLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(stored ?? '')
    ? (stored as SupportedLanguage)
    : 'en';
}

export function persistLanguage(lang: SupportedLanguage) {
  localStorage.setItem(STORAGE_KEY, lang);
}

// Resources are typed loosely here; new languages can be added simply by
// dropping another locale file in ./locales and registering it below.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function applyDocumentDirection(lang: SupportedLanguage) {
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGE_DIRECTION[lang];
}

applyDocumentDirection(getStoredLanguage());

export default i18n;
