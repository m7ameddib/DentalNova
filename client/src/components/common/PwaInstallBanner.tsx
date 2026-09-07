import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'dnt-pwa-install-dismissed';

export function PwaInstallBanner() {
  const { t } = useTranslation();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (dismissed || !installEvent) {
    return null;
  }

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const install = async () => {
    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
      setInstalling(false);
    }
  };

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-banner__content">
        <Download size={18} aria-hidden />
        <span>{t('pwa.installHint')}</span>
      </div>
      <div className="pwa-install-banner__actions">
        <button type="button" className="btn btn--primary btn--small" onClick={install} disabled={installing}>
          {t('pwa.installAction')}
        </button>
        <button type="button" className="icon-btn" onClick={dismiss} title={t('common.close') ?? ''}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
