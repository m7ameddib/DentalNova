import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, Printer, Radiation, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { Modal } from '@/components/common/Modal';
import { PrescriptionPrintable, XrayPrescriptionPrintable } from './PrintableTemplates';
import { prescriptionsApi } from '@/api/prescriptions.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateTimeDisplay } from '@/utils/date';
import { Patient, Prescription, PrescriptionType } from '@/types/domain';

const COLLAPSED_HISTORY_LIMIT = 4;

function prescriptionType(rx: Prescription): PrescriptionType {
  return rx.type ?? 'MEDICATION';
}

export function PrescriptionSection({ patientId, patient }: { patientId: number; patient: Patient }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const canManage = usePermission(PERMISSIONS.PRESCRIPTIONS_MANAGE);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [viewing, setViewing] = useState<Prescription | null>(null);
  const [deleting, setDeleting] = useState<Prescription | null>(null);

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: () => prescriptionsApi.list(patientId),
    enabled: canManage,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => prescriptionsApi.remove(patientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', patientId] });
      setDeleting(null);
      setViewing(null);
    },
  });

  if (!canManage) return null;

  async function handlePrint(prescription: Prescription) {
    const clinic = await loadClinicPrintInfo();
    const type = prescriptionType(prescription);
    if (type === 'XRAY') {
      print(
        <XrayPrescriptionPrintable patient={patient} prescription={prescription} clinic={clinic} language={language} />,
      );
      return;
    }
    print(<PrescriptionPrintable patient={patient} prescription={prescription} clinic={clinic} language={language} />);
  }

  const visibleHistory = showAllHistory ? prescriptions : prescriptions.slice(0, COLLAPSED_HISTORY_LIMIT);

  return (
    <SectionCard
      title={t('patientRecord.sections.prescription')}
      icon={<ClipboardList size={16} />}
      onAdd={() => navigate(`/patients/${patientId}/prescription/new`)}
      addTitle={t('patientRecord.prescription.addTitle') ?? ''}
      headerExtra={
        <button
          type="button"
          className="section-card__add-btn section-card__add-btn--secondary"
          title={t('patientRecord.prescription.addXrayTitle') ?? ''}
          onClick={() => navigate(`/patients/${patientId}/prescription/xray/new`)}
        >
          <Radiation size={15} />
        </button>
      }
      className="section-card--prescription"
    >
      <div className="prescription-history">
        {prescriptions.length === 0 ? (
          <p className="muted">{t('patientRecord.prescription.noHistory')}</p>
        ) : (
          <ul className="prescription-history__list">
            {visibleHistory.map((rx) => {
              const type = prescriptionType(rx);
              return (
              <li key={rx.id} className="prescription-history__item">
                <div className="prescription-history__meta">
                  <span>{formatDateTimeDisplay(rx.createdAt, language)}</span>
                  <span className="prescription-history__type">
                    {type === 'XRAY' ? t('patientRecord.prescription.typeXray') : t('patientRecord.prescription.typeMedication')}
                  </span>
                  <span className="muted">{rx.doctorName ?? '—'}</span>
                  <span className="muted">
                    {type === 'XRAY'
                      ? t('patientRecord.prescription.studyCount', { count: rx.items.length })
                      : t('patientRecord.prescription.medicineCount', { count: rx.items.length })}
                  </span>
                </div>
                <div className="prescription-history__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('common.view') ?? ''}
                    onClick={() => setViewing(rx)}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('common.print') ?? ''}
                    onClick={() => handlePrint(rx)}
                  >
                    <Printer size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    title={t('patientRecord.prescription.delete') ?? ''}
                    onClick={() => setDeleting(rx)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
            })}
          </ul>
        )}
        {prescriptions.length > COLLAPSED_HISTORY_LIMIT && (
          <button type="button" className="link-btn" onClick={() => setShowAllHistory((v) => !v)}>
            {showAllHistory
              ? t('patientRecord.treatment.showLess')
              : t('patientRecord.treatment.showAll', { count: prescriptions.length })}
          </button>
        )}
      </div>

      {viewing && (
        <Modal
          title={
            prescriptionType(viewing) === 'XRAY'
              ? t('patientRecord.prescription.viewXrayTitle')
              : t('patientRecord.prescription.viewTitle')
          }
          icon={prescriptionType(viewing) === 'XRAY' ? <Radiation size={16} /> : <ClipboardList size={16} />}
          onClose={() => setViewing(null)}
          size="wide"
          headerExtra={
            <button type="button" className="icon-btn" title={t('common.print') ?? ''} onClick={() => handlePrint(viewing)}>
              <Printer size={16} />
            </button>
          }
        >
          <div className="receipt__meta prescription-view__meta">
            <span>
              {t('prescriptionPrint.doctor')}: {viewing.doctorName ?? '—'}
            </span>
            <span>
              {t('common.date')}: {formatDateTimeDisplay(viewing.createdAt, language)}
            </span>
          </div>
          {prescriptionType(viewing) === 'XRAY' ? (
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>{t('xrayPrescriptionPrint.study')}</th>
                  <th>{t('xrayPrescriptionPrint.teeth')}</th>
                  <th>{t('xrayPrescriptionBuilder.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.medicineName}</td>
                    <td>{item.dose || '—'}</td>
                    <td className="muted">{item.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>{t('prescriptionPrint.medicine')}</th>
                  <th>{t('prescriptionPrint.dose')}</th>
                  <th>{t('prescriptionPrint.frequency')}</th>
                  <th>{t('prescriptionPrint.duration')}</th>
                  <th>{t('prescriptionPrint.instructions')}</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.medicineName}</td>
                    <td>{item.dose || '—'}</td>
                    <td>{item.frequency || '—'}</td>
                    <td>{item.duration || '—'}</td>
                    <td className="muted">{item.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="form-actions form-actions--start">
            <button type="button" className="btn btn--danger btn--small" onClick={() => setDeleting(viewing)}>
              <Trash2 size={13} /> {t('patientRecord.prescription.delete')}
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={t('patientRecord.prescription.deleteConfirmTitle')} icon={<Trash2 size={16} />} onClose={() => setDeleting(null)}>
          <p>
            {t('patientRecord.prescription.deleteConfirmBody', {
              date: formatDateTimeDisplay(deleting.createdAt, language),
              patient: patient.fullName,
            })}
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              {t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}
