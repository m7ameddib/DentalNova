import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { followUpsApi } from '@/api/follow-ups.api';
import { useUiStore } from '@/store/ui.store';
import { formatDateDisplay } from '@/utils/date';

export function FollowUpsSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useUiStore();

  const { data } = useQuery({
    queryKey: ['patient-follow-ups', patientId],
    queryFn: () => followUpsApi.forPatient(patientId),
  });

  const activeCount = data?.activeCount ?? 0;
  const nextDate = data?.nextFollowUpDate;
  const activeItems = data?.active ?? [];

  return (
    <SectionCard
      title={t('patientRecord.sections.followUps')}
      icon={<ClipboardList size={16} />}
      onAdd={() => navigate(`/follow-ups?patientId=${patientId}`)}
      addTitle={t('followUp.viewDetails') ?? ''}
      className="section-card--follow-ups"
    >
      {activeCount === 0 ? (
        <p className="muted">{t('followUp.patientEmpty')}</p>
      ) : (
        <ul className="compact-follow-up-list">
          <li className="follow-ups-compact">
            <span className="follow-ups-compact__count">
              {t('followUp.activeCount', { count: activeCount })}
            </span>
            {nextDate && (
              <span className="follow-ups-compact__next">
                {t('followUp.nextDate')}: {formatDateDisplay(nextDate, language)}
              </span>
            )}
          </li>
          {activeItems.map((fu) => (
            <li key={fu.id}>
              <button
                type="button"
                className="compact-follow-up-list__item"
                onClick={() => navigate(`/follow-ups?patientId=${patientId}&followUpId=${fu.id}`)}
              >
                <span>{fu.reason}</span>
                <span className="muted">{formatDateDisplay(fu.followUpDate, language)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
