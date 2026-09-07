import { useUiStore } from '@/store/ui.store';

export function AuthLangSwitch() {
  const { language, setLanguage } = useUiStore();

  return (
    <div className="login-page__lang">
      <button
        type="button"
        className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
        onClick={() => setLanguage('ar')}
      >
        AR
      </button>
    </div>
  );
}
