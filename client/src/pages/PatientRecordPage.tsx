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

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId!),
    enabled: !isNew && !!patientId,
  });

  if (!isNew && patientId && isLoading) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if (!isNew && patientId && !isLoading && !patient) {
    return <div className="page-loading">{t('patientRecord.notFound')}</div>;
  }

  return (
    <div className="patient-record" key={id ?? 'empty'}>
      {patient ? <MedicalAlertsBanner patientId={patient.id} /> : null}
      <div className="patient-record__patient-col">
        <PatientSection patient={patient ?? null} forceAdd={isNew} />
        {patient ? (
          <div className="patient-record__medical-alerts">
            <MedicalAlertsSection patientId={patient.id} />
          </div>
        ) : null}
        {patient ? <FilesSection patientId={patient.id} /> : null}
        {patient ? <PrescriptionSection patientId={patient.id} patient={patient} /> : null}
      </div>

      {patient ? (
        <>
          <div className="patient-record__account-col">
            <AccountSection patientId={patient.id} patient={patient} />
            <AppointmentsSection patientId={patient.id} />
            <FollowUpsSection patientId={patient.id} />
            <LabCasesSection patientId={patient.id} />
          </div>

          <div className="patient-record__treatment-col">
            <TreatmentSection patientId={patient.id} patient={patient} />
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
