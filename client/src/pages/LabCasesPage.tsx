import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { FlaskConical, Plus, Printer, Wallet } from 'lucide-react';
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

const FILTERS: LabCaseListFilter[] = ['active', 'due_today', 'overdue', 'received', 'delivered', 'all'];

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
      alert === 'OVERDUE'
        ? 'lab-case-alert lab-case-alert--overdue'
        : alert === 'DUE_TODAY'
          ? 'lab-case-alert lab-case-alert--today'
          : 'lab-case-alert lab-case-alert--tomorrow';
    return <span className={cls}>{t(`labCases.alerts.${alert}`)}</span>;
  }

  return (
    <div className="lab-cases-page">
      <div className="lab-cases-page__header">
        <h1>
          <FlaskConical size={22} /> {t('labCases.title')}
        </h1>
        <div className="lab-cases-page__header-actions">
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
      </div>

      <div className="lab-cases-summary">
        <div className="lab-cases-summary__card">
          <span className="lab-cases-summary__value">{summary?.dueToday ?? 0}</span>
          <span className="lab-cases-summary__label">{t('labCases.alerts.DUE_TODAY')}</span>
        </div>
        <div className="lab-cases-summary__card lab-cases-summary__card--warn">
          <span className="lab-cases-summary__value">{summary?.overdue ?? 0}</span>
          <span className="lab-cases-summary__label">{t('labCases.alerts.OVERDUE')}</span>
        </div>
      </div>

      <div className="lab-cases-toolbar">
        <div className="day-toggle-group">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
              onClick={() => setFilter(f)}
            >
              {t(`labCases.filters.${f}`)}
            </button>
          ))}
        </div>
        <input
          className="lab-cases-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('labCases.searchPlaceholder') ?? ''}
        />
      </div>

      {isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : filteredItems.length === 0 ? (
        <p className="muted">{t('labCases.empty')}</p>
      ) : (
        <table className="patients-table lab-cases-table">
          <thead>
            <tr>
              <th>{t('labCases.patient')}</th>
              <th>{t('labCases.labName')}</th>
              <th>{t('labCases.teeth')}</th>
              <th>{t('labCases.workType')}</th>
              <th>{t('labCases.sentDate')}</th>
              <th>{t('labCases.expectedDelivery')}</th>
              <th>{t('labCases.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((row) => (
              <tr
                key={row.id}
                className={row.status === 'CANCELLED' ? 'lab-case-row--cancelled' : undefined}
              >
                <td>{row.patientName}</td>
                <td>{row.labName}</td>
                <td>{row.teeth.join(', ')}</td>
                <td>{row.workTypeLabel}</td>
                <td>{row.sentDate ? formatDateDisplay(row.sentDate, language) : '—'}</td>
                <td>
                  {row.expectedDeliveryDate ? formatDateDisplay(row.expectedDeliveryDate, language) : '—'}{' '}
                  {dueBadge(row.dueAlert)}
                </td>
                <td>
                  <span className={`status-chip status-chip--lab-${row.status.toLowerCase()}`}>
                    {t(`labCases.statuses.${row.status}`)}
                  </span>
                </td>
                <td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
