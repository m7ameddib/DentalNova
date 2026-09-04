import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { labCasesApi } from '@/api/lab-cases.api';
import { useUiStore } from '@/store/ui.store';
import { formatDateDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';

export function LabCasesSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useUiStore();

  const { data } = useQuery({
    queryKey: ['patient-lab-cases', patientId],
    queryFn: () => labCasesApi.forPatient(patientId),
  });

  const active = data?.active ?? [];

  return (
    <SectionCard
      title={t('patientRecord.sections.labCases')}
      icon={<FlaskConical size={16} />}
      onAdd={() => navigate(`/lab-cases?patientId=${patientId}`)}
      addTitle={t('labCases.addCase') ?? ''}
      className="section-card--lab-cases"
    >
      {active.length === 0 ? (
        <p className="muted">{t('labCases.patientEmpty')}</p>
      ) : (
        <ul className="compact-lab-case-list">
          {active.slice(0, 4).map((c) => (
            <li key={c.id}>
              <span className="compact-lab-case-list__work">
                {c.workTypeLabel}
                {c.teeth.length ? ` ${c.teeth.join(',')}` : ''}
              </span>
              <span className="compact-lab-case-list__meta">
                {t(`labCases.statuses.${c.status}`)}
                {c.expectedDeliveryDate && (
                  <> · {formatDateDisplay(c.expectedDeliveryDate, language)}</>
                )}
                {c.dueAlert && (
                  <span className={`lab-case-alert lab-case-alert--inline lab-case-alert--${c.dueAlert.toLowerCase()}`}>
                    {t(`labCases.alerts.${c.dueAlert}`)}
                  </span>
                )}
                {(c.remainingLabBalanceCents ?? 0) > 0 && (
                  <span className="compact-lab-case-list__lab-due">
                    {' · '}
                    {t('labCases.financial.labDue', { amount: formatMoney(c.remainingLabBalanceCents ?? 0) })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
