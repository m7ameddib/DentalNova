import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AdminClinicScopeBanner({ clinicName }: { clinicName: string | null | undefined }) {
  const { t } = useTranslation();
  if (!clinicName) return null;
  return (
    <div className="admin-clinic-scope-banner" role="status">
      <Building2 size={16} aria-hidden="true" />
      <span>
        {t('dibnovaAdmin.selectedClinic')}: <strong>{clinicName}</strong>
      </span>
    </div>
  );
}
