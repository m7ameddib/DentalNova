import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AiAssistantPage } from '@/pages/AiAssistantPage';
import { useDeploymentMode } from '@/hooks/useDeploymentMode';

/** AI Assistant stays in Online; Offline has no UI/route entry. Backend is unchanged. */
export function OnlineOnlyAiRoute() {
  const { t } = useTranslation();
  const mode = useDeploymentMode();
  if (!mode) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }
  if (mode !== 'online') {
    return <Navigate to="/" replace />;
  }
  return <AiAssistantPage />;
}
