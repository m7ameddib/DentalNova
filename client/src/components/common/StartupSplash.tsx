import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';

export function StartupSplash() {
  const { t } = useTranslation();
  return (
    <div className="startup-splash" role="status">
      <BrandLogo variant="auth" />
      <h1 className="startup-splash__title">DentalNova</h1>
      <p className="startup-splash__text">{t('installation.opening')}</p>
      <div className="startup-splash__spinner" aria-hidden />
    </div>
  );
}
