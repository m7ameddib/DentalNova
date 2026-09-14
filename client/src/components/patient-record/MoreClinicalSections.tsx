import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ClipboardList, FlaskConical, StickyNote, Pill } from 'lucide-react';

type MoreTab = 'files' | 'rx' | 'followUps' | 'lab' | 'notes';

interface MoreClinicalSectionsProps {
  files: ReactNode;
  prescriptions: ReactNode;
  followUps: ReactNode;
  lab: ReactNode;
  notes: ReactNode;
}

export function MoreClinicalSections({
  files,
  prescriptions,
  followUps,
  lab,
  notes,
}: MoreClinicalSectionsProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MoreTab>('files');

  const tabs: { id: MoreTab; label: string; icon: ReactNode }[] = [
    { id: 'files', label: t('patientRecord.sections.files'), icon: <FileText size={14} /> },
    { id: 'rx', label: t('patientRecord.sections.prescription'), icon: <Pill size={14} /> },
    { id: 'followUps', label: t('patientRecord.sections.followUps'), icon: <ClipboardList size={14} /> },
    { id: 'lab', label: t('patientRecord.sections.labCases'), icon: <FlaskConical size={14} /> },
    { id: 'notes', label: t('patientRecord.clinicalNotes.title'), icon: <StickyNote size={14} /> },
  ];

  return (
    <div className="more-clinical">
      <div className="more-clinical__tabs" role="tablist" aria-label={t('patientRecord.more.title')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'more-clinical__tab more-clinical__tab--active' : 'more-clinical__tab'}
            onClick={() => setTab(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      <div className="more-clinical__panel" role="tabpanel">
        {tab === 'files' && files}
        {tab === 'rx' && prescriptions}
        {tab === 'followUps' && followUps}
        {tab === 'lab' && lab}
        {tab === 'notes' && notes}
      </div>
    </div>
  );
}
