import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { patientsApi } from '@/api/patients.api';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { useUiStore } from '@/store/ui.store';
import { centsToAmount, formatMoney } from '@/utils/money';
import { TreatmentPlanEstimatePrintable } from './PrintableTemplates';
import { Patient, PatientTreatment } from '@/types/domain';
import { expandTreatmentDisplayRows } from '@/utils/treatment-display';

export function TreatmentPlanModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);

  const { data: treatments = [] } = useQuery({
    queryKey: ['patient-treatments', patient.id],
    queryFn: () => patientsApi.treatments(patient.id),
  });

  const planned = useMemo(
    () => treatments.filter((tr) => tr.status === 'PLANNED'),
    [treatments],
  );

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set(planned.map((p) => p.id)));
  }, [planned]);

  const selectedTreatments = planned.filter((tr) => selectedIds.has(tr.id));
  const totalCents = selectedTreatments.reduce((sum, tr) => sum + tr.finalAmountCents, 0);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePrint() {
    const clinic = await loadClinicPrintInfo();
    print(
      <TreatmentPlanEstimatePrintable
        patient={patient}
        treatments={selectedTreatments}
        totalCents={totalCents}
        clinic={clinic}
        language={language}
      />,
    );
  }

  return (
    <Modal
      title={t('patientRecord.treatmentPlan.title')}
      icon={<FileText size={16} />}
      onClose={onClose}
      size="wide"
    >
      <p className="muted treatment-plan-modal__disclaimer">{t('patientRecord.treatmentPlan.disclaimer')}</p>
      {planned.length === 0 ? (
        <p className="muted">{t('patientRecord.treatmentPlan.noPlanned')}</p>
      ) : (
        <>
          <table className="payment-history-table treatment-plan-table">
            <thead>
              <tr>
                <th />
                <th>{t('patientRecord.treatment.columns.treatment')}</th>
                <th>{t('patientRecord.treatment.columns.teeth')}</th>
                <th>{t('patientRecord.treatment.columns.base')}</th>
                <th>{t('patientRecord.treatment.columns.discount')}</th>
                <th>{t('patientRecord.treatment.columns.final')}</th>
              </tr>
            </thead>
            <tbody>
              {expandTreatmentDisplayRows(planned).map((row) => (
                <TreatmentPlanRow
                  key={row.key}
                  treatment={row.treatment}
                  tooth={row.tooth}
                  baseAmountCents={row.baseAmountCents}
                  discountCents={row.discountCents}
                  finalAmountCents={row.finalAmountCents}
                  checked={selectedIds.has(row.treatment.id)}
                  onToggle={() => toggle(row.treatment.id)}
                />
              ))}
            </tbody>
          </table>
          <div className="treatment-plan-modal__total">
            <span>{t('patientRecord.treatmentPlan.total')}</span>
            <strong>{formatMoney(totalCents)}</strong>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handlePrint}
              disabled={selectedTreatments.length === 0}
            >
              <Printer size={14} /> {t('patientRecord.treatmentPlan.print')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function TreatmentPlanRow({
  treatment: tr,
  tooth,
  baseAmountCents,
  discountCents,
  finalAmountCents,
  checked,
  onToggle,
}: {
  treatment: PatientTreatment;
  tooth: number | null;
  baseAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const treatmentLabel = t(`patientRecord.treatmentTypes.${tr.treatmentCode}`, {
    defaultValue: tr.treatmentLabel,
  });
  return (
    <tr>
      <td>
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={treatmentLabel} />
      </td>
      <td>
        {tooth != null
          ? t('patientRecord.treatment.toothTreatmentLine', { tooth, treatment: treatmentLabel })
          : treatmentLabel}
      </td>
      <td>
        {tooth != null
          ? t('patientRecord.treatment.toothLine', { tooth })
          : tr.teeth.length > 0
            ? tr.teeth.join(', ')
            : '—'}
      </td>
      <td>{formatMoney(baseAmountCents)}</td>
      <td>{discountCents > 0 ? `-${centsToAmount(discountCents).toFixed(2)}` : '—'}</td>
      <td>{formatMoney(finalAmountCents)}</td>
    </tr>
  );
}
