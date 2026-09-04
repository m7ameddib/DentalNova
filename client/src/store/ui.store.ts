import { create } from 'zustand';
import i18n, {
  applyDocumentDirection,
  getStoredLanguage,
  persistLanguage,
  SupportedLanguage,
} from '@/i18n';

interface UiState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const useUiStore = create<UiState>((set) => ({
  language: getStoredLanguage(),
  setLanguage: (lang) => {
    persistLanguage(lang);
    applyDocumentDirection(lang);
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
}));
