import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { clinicalApi } from '@/api/clinical.api';

export function MedicalAlertsBanner({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const { data: alerts = [] } = useQuery({
    queryKey: ['medical-alerts', patientId, 'active'],
    queryFn: () => clinicalApi.listAlerts(patientId, true),
  });

  if (alerts.length === 0) return null;

  return (
    <div className="medical-alerts-banner" role="alert">
      <AlertTriangle size={18} className="medical-alerts-banner__icon" aria-hidden />
      <div className="medical-alerts-banner__items">
        {alerts.map((a) => (
          <span key={a.id} className="medical-alerts-banner__item">
            {a.alertType === 'DISEASE' || a.diseaseCatalogId
              ? a.label
              : t(`patientRecord.medicalAlerts.types.${a.alertType}`, { defaultValue: a.label })}
            {a.note ? ` — ${a.note}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
