import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { patientsApi } from '@/api/patients.api';
import { PatientSection } from '@/components/patient-record/PatientSection';
import { MedicalAlertsSection } from '@/components/patient-record/MedicalAlertsSection';
import { AppointmentsSection } from '@/components/patient-record/AppointmentsSection';
import { TreatmentSection } from '@/components/patient-record/TreatmentSection';
import { AccountSection } from '@/components/patient-record/AccountSection';
import { FilesSection } from '@/components/patient-record/FilesSection';
import { PrescriptionSection } from '@/components/patient-record/PrescriptionSection';
import { FollowUpsSection } from '@/components/patient-record/FollowUpsSection';
import { MedicalAlertsBanner } from '@/components/patient-record/MedicalAlertsBanner';
import { ClinicalVisitNotesSection } from '@/components/patient-record/ClinicalVisitNotesSection';
import { LabCasesSection } from '@/components/patient-record/LabCasesSection';
import { BrandLogo } from '@/components/common/BrandLogo';

export function PatientRecordPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const isNew = id === 'new';
  const patientId = id && !isNew ? Number(id) : null;

  const { data: patient, isPending, isError } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !isNew && !!patientId,
    staleTime: 30_000,
  });

  if (!isNew && patientId && isPending && !patient) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if (!isNew && patientId && !patient && (isError || !isPending)) {
    return <div className="page-loading">{t('patientRecord.notFound')}</div>;
  }

  const emptyWorkspace = !patient && !isNew;

  return (
    <div className={`patient-record${emptyWorkspace ? ' patient-record--empty' : ''}`} key={id ?? 'empty'}>
      {patient ? <MedicalAlertsBanner patientId={patient.id} /> : null}

      <div className="patient-record__identity">
        <PatientSection patient={patient ?? null} forceAdd={isNew} />
        {patient ? (
          <div className="patient-record__medical-alerts">
            <MedicalAlertsSection patientId={patient.id} />
          </div>
        ) : null}
      </div>

      {patient ? (
        <>
          <div className="patient-record__main-row">
            <div className="patient-record__treatment-col">
              <TreatmentSection patientId={patient.id} patient={patient} />
            </div>
            <div className="patient-record__account-col">
              <AccountSection patientId={patient.id} patient={patient} />
            </div>
            <div className="patient-record__appointments-col">
              <AppointmentsSection patientId={patient.id} />
            </div>
          </div>

          <div className="patient-record__secondary-row">
            <FilesSection patientId={patient.id} />
            <PrescriptionSection patientId={patient.id} patient={patient} />
            <FollowUpsSection patientId={patient.id} />
            <LabCasesSection patientId={patient.id} />
            <ClinicalVisitNotesSection patientId={patient.id} />
          </div>
        </>
      ) : (
        <div className="patient-record__empty-state" aria-hidden="true">
          <BrandLogo variant="workspace" />
        </div>
      )}
    </div>
  );
}
