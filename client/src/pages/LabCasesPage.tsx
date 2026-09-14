import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Printer, Wallet } from 'lucide-react';
import { LabOrderPrintable } from '@/components/patient-record/PrintableTemplates';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { Modal } from '@/components/common/Modal';
import { labCasesApi, LabCaseListFilter } from '@/api/lab-cases.api';
import { patientsApi } from '@/api/patients.api';
import { LabCaseFormModal } from '@/components/lab-cases/LabCaseFormModal';
import { LabCaseWithDetails, Patient } from '@/types/domain';
import { useUiStore } from '@/store/ui.store';
import { formatDateDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';

const FILTERS: LabCaseListFilter[] = ['active', 'due_today', 'overdue', 'received', 'delivered', 'all'];

function labStatusClass(status: LabCaseWithDetails['status']) {
  if (status === 'CANCELLED') return 'ops-status is-overdue';
  if (status === 'DELIVERED_TO_PATIENT') return 'ops-status is-delivered';
  if (status === 'RECEIVED_FROM_LAB') return 'ops-status is-received';
  if (status === 'PENDING') return 'ops-status is-pending';
  return 'ops-status is-sent';
}

export function LabCasesPage() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const patientFilterId = searchParams.get('patientId');
  const caseFilterId = searchParams.get('caseId');
  const print = usePrintStore((s) => s.print);

  const [filter, setFilter] = useState<LabCaseListFilter>('active');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(!!patientFilterId && !caseFilterId);
  const [editCase, setEditCase] = useState<LabCaseWithDetails | null>(null);
  const [cancelling, setCancelling] = useState<LabCaseWithDetails | null>(null);

  const { data: presetPatient } = useQuery({
    queryKey: ['patient-lite-lab', patientFilterId],
    queryFn: () => patientsApi.getById(Number(patientFilterId)),
    enabled: !!patientFilterId,
  });

  const { data: summary } = useQuery({
    queryKey: ['lab-cases-summary'],
    queryFn: () => labCasesApi.summary(),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['lab-cases', filter, search],
    queryFn: () => labCasesApi.list(filter, search.trim() || undefined),
  });

  const filteredItems = useMemo(() => {
    if (!patientFilterId) return items;
    return items.filter((i) => String(i.patientId) === patientFilterId);
  }, [items, patientFilterId]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['lab-cases'] });
    queryClient.invalidateQueries({ queryKey: ['lab-cases-summary'] });
    queryClient.invalidateQueries({ queryKey: ['patient-lab-cases'] });
  }

  function openAdd() {
    setEditCase(null);
    setFormOpen(true);
  }

  function openEdit(row: LabCaseWithDetails) {
    setEditCase(row);
    setFormOpen(true);
  }

  useEffect(() => {
    if (!caseFilterId || items.length === 0) return;
    const found = items.find((row) => String(row.id) === caseFilterId);
    if (found) openEdit(found);
  }, [caseFilterId, items]);

  const cancelMutation = useMutation({
    mutationFn: (row: LabCaseWithDetails) => labCasesApi.update(row.id, { status: 'CANCELLED' }),
    onSuccess: () => {
      invalidate();
      setCancelling(null);
    },
  });

  async function handlePrint(row: LabCaseWithDetails) {
    const clinic = await loadClinicPrintInfo();
    print(<LabOrderPrintable labCase={row} clinic={clinic} language={language} />);
  }

  function dueBadge(alert: LabCaseWithDetails['dueAlert']) {
    if (!alert) return null;
    const cls =
      alert === 'OVERDUE' ? 'ops-status is-overdue' : alert === 'DUE_TODAY' ? 'ops-status is-due' : 'ops-status is-pending';
    return <span className={cls}>{t(`labCases.alerts.${alert}`)}</span>;
  }

  return (
    <div className="ops-shell lab-cases-page">
      <header className="ops-page-head">
        <div className="ops-page-head-copy">
          <h1>{t('labCases.title')}</h1>
          <p>{t('labCases.pageHint')}</p>
        </div>
        <div className="ops-page-head-actions">
          <Link to="/lab-accounts" className="page-feature-link page-feature-link--lab">
            <span className="page-feature-link__icon" aria-hidden="true">
              <Wallet size={16} />
            </span>
            {t('labCases.accounts.title')}
          </Link>
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            <Plus size={14} /> {t('labCases.addCase')}
          </button>
        </div>
      </header>

      <div className="ops-kpis">
        <div className="ops-kpi is-due">
          <span className="ops-kpi-label">{t('labCases.alerts.DUE_TODAY')}</span>
          <span className="ops-kpi-value">{summary?.dueToday ?? 0}</span>
        </div>
        <div className="ops-kpi is-overdue">
          <span className="ops-kpi-label">{t('labCases.alerts.OVERDUE')}</span>
          <span className="ops-kpi-value">{summary?.overdue ?? 0}</span>
        </div>
      </div>

      <div className="ops-toolbar">
        <div className="ops-seg">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              className={filter === f ? 'active' : undefined}
              onClick={() => setFilter(f)}
            >
              {t(`labCases.filters.${f}`)}
            </button>
          ))}
        </div>
        <label className="ops-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('labCases.searchPlaceholder') ?? ''}
          />
        </label>
      </div>

      {isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : filteredItems.length === 0 ? (
        <div className="ops-empty">
          <strong>{t('labCases.empty')}</strong>
          <p>{t('labCases.emptyHint')}</p>
          <button type="button" className="btn btn--primary btn--small" onClick={openAdd}>
            <Plus size={14} /> {t('labCases.addCase')}
          </button>
        </div>
      ) : (
        <div className="ops-worklist">
          <div className="ops-worklist-head lab-cols">
            <span>{t('labCases.patient')}</span>
            <span>{t('labCases.workType')}</span>
            <span>{t('labCases.labName')}</span>
            <span>{t('labCases.teeth')}</span>
            <span>{t('labCases.sentDate')}</span>
            <span>{t('labCases.expectedDelivery')}</span>
            <span>{t('labCases.financial.labCost')}</span>
            <span>{t('labCases.status')}</span>
            <span>{t('common.actions')}</span>
          </div>
          {filteredItems.map((row) => (
            <div
              key={row.id}
              className={[
                'ops-work-row',
                'is-static',
                'lab-cols',
                row.status === 'CANCELLED' ? 'is-cancelled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="ops-id" data-label={t('labCases.patient')}>
                <strong>{row.patientName}</strong>
                <span>#{row.patientFileNumber}</span>
              </div>
              <div className="ops-id" data-label={t('labCases.workType')}>
                <strong>{row.workTypeLabel}</strong>
                {row.treatmentLabel && <span>{row.treatmentLabel}</span>}
              </div>
              <span className="ops-meta" data-label={t('labCases.labName')}>
                {row.labName}
              </span>
              <span data-label={t('labCases.teeth')}>{row.teeth.join(', ') || '—'}</span>
              <span data-label={t('labCases.sentDate')}>
                {row.sentDate ? formatDateDisplay(row.sentDate, language) : '—'}
              </span>
              <div className="ops-id" data-label={t('labCases.expectedDelivery')}>
                <span>
                  {row.expectedDeliveryDate ? formatDateDisplay(row.expectedDeliveryDate, language) : t('labCases.noDueDate')}
                </span>
                {dueBadge(row.dueAlert)}
              </div>
              <div className="ops-id" data-label={t('labCases.financial.labCost')}>
                <strong className="ops-money">{formatMoney(row.labCostCents)}</strong>
                {row.remainingLabBalanceCents != null && row.remainingLabBalanceCents > 0 && (
                  <span className="ops-money is-out">
                    {t('labCases.financial.remaining')}: {formatMoney(row.remainingLabBalanceCents)}
                  </span>
                )}
              </div>
              <span data-label={t('labCases.status')}>
                <span className={labStatusClass(row.status)}>{t(`labCases.statuses.${row.status}`)}</span>
              </span>
              <div className="ops-row-actions" data-label={t('common.actions')}>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => openEdit(row)}>
                  {t('common.edit')}
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => handlePrint(row)}>
                  <Printer size={13} /> {t('common.print')}
                </button>
                {row.status !== 'CANCELLED' && (
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setCancelling(row)}>
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LabCaseFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditCase(null);
        }}
        onSaved={invalidate}
        editCase={editCase}
        presetPatient={(presetPatient as Patient) ?? null}
      />

      {cancelling && (
        <Modal title={t('labCases.cancelConfirmTitle')} onClose={() => setCancelling(null)}>
          <p>{t('labCases.cancelConfirmBody')}</p>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setCancelling(null)}>
              {t('common.back')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => cancelMutation.mutate(cancelling)}
              disabled={cancelMutation.isPending}
            >
              {t('labCases.statuses.CANCELLED')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
