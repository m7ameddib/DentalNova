import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Plus, Printer } from 'lucide-react';
import { followUpsApi } from '@/api/follow-ups.api';
import { patientsApi } from '@/api/patients.api';
import { settingsApi } from '@/api/settings.api';
import { FollowUpExpandedPanel } from '@/components/follow-up/FollowUpExpandedPanel';
import { FollowUpPrintable } from '@/components/follow-up/FollowUpPrintable';
import { FollowUpType, FollowUpWithPatient, Patient } from '@/types/domain';
import { usePrintStore } from '@/store/print.store';
import { useUiStore } from '@/store/ui.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { DateField } from '@/components/common/DateField';
import { getErrorMessage } from '@/utils/errors';
import { formatMoney } from '@/utils/money';
import { openFollowUpWhatsApp, openFollowUpsWhatsAppBulk } from '@/utils/followUpWhatsApp';

type FilterType = 'ALL' | FollowUpType;

function statusOpsClass(status: FollowUpWithPatient['displayStatus']) {
  if (status === 'OVERDUE') return 'ops-status is-overdue';
  if (status === 'TODAY') return 'ops-status is-due';
  if (status === 'COMPLETED') return 'ops-status is-done';
  return 'ops-status is-pending';
}

export function FollowUpPage() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientFilter = searchParams.get('patientId');
  const followUpFilterId = searchParams.get('followUpId');

  const [showHistory, setShowHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [listQuery, setListQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(
    followUpFilterId ? Number(followUpFilterId) : null,
  );

  useEffect(() => {
    if (followUpFilterId) setExpandedId(Number(followUpFilterId));
  }, [followUpFilterId]);
  const [error, setError] = useState<string | null>(null);
  const [addingClinical, setAddingClinical] = useState(false);
  const [newPatientQuery, setNewPatientQuery] = useState('');
  const [newPatient, setNewPatient] = useState<Patient | null>(null);
  const [newReason, setNewReason] = useState('');
  const [newDate, setNewDate] = useState(todayIso());

  const typeParam = filter === 'ALL' ? undefined : filter;

  const { data: summary } = useQuery({
    queryKey: ['follow-ups-summary', selectedDate],
    queryFn: () => followUpsApi.summary(selectedDate),
  });

  const isToday = selectedDate === todayIso();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['follow-ups', typeParam, selectedDate],
    queryFn: () => followUpsApi.list(typeParam, selectedDate),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['follow-ups-history', patientFilter],
    queryFn: () => followUpsApi.history(patientFilter ? Number(patientFilter) : undefined),
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  const { data: patientSearch = [] } = useQuery({
    queryKey: ['follow-up-patient-search', newPatientQuery],
    queryFn: () => patientsApi.search(newPatientQuery),
    enabled: newPatientQuery.trim().length >= 2,
  });

  const filteredItems = useMemo(() => {
    if (!patientFilter) return items;
    return items.filter((i) => String(i.patientId) === patientFilter);
  }, [items, patientFilter]);

  const visibleItems = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return filteredItems;
    return filteredItems.filter(
      (fu) =>
        fu.patientName.toLowerCase().includes(q) ||
        fu.patientFileNumber.toLowerCase().includes(q) ||
        fu.reason.toLowerCase().includes(q) ||
        (fu.details ?? '').toLowerCase().includes(q),
    );
  }, [filteredItems, listQuery]);

  const historyByFollowUpId = useMemo(() => {
    const map = new Map<number, (typeof history)[0]>();
    for (const h of history) {
      if (h.followUpId != null && !map.has(h.followUpId)) {
        map.set(h.followUpId, h);
      }
    }
    return map;
  }, [history]);

  const createMutation = useMutation({
    mutationFn: followUpsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['follow-ups-summary'] });
      setAddingClinical(false);
      setNewPatient(null);
      setNewPatientQuery('');
      setNewReason('');
      setNewDate(todayIso());
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function handleWhatsApp(fu: FollowUpWithPatient) {
    if (!clinicSettings) return;
    if (!openFollowUpWhatsApp(fu, clinicSettings)) {
      setError(t('whatsapp.noPhone'));
      return;
    }
    setError(null);
  }

  async function handlePrintFollowUps() {
    const clinic = await loadClinicPrintInfo();
    print(
      <FollowUpPrintable
        clinic={clinic}
        language={language}
        items={filteredItems}
        historyByFollowUpId={historyByFollowUpId}
        reportDate={selectedDate}
      />,
    );
  }

  function handleWhatsAppSummary() {
    if (!clinicSettings) return;
    if (filteredItems.length === 0) {
      setError(t('followUp.noItemsForDate', { date: formatDateDisplay(selectedDate, language) }));
      return;
    }
    const { opened } = openFollowUpsWhatsAppBulk(filteredItems, clinicSettings);
    if (opened === 0) {
      setError(t('whatsapp.noPhone'));
      return;
    }
    setError(null);
  }

  function toggleRow(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="ops-shell follow-up-page">
      <header className="ops-page-head">
        <div className="ops-page-head-copy">
          <h1>{t('followUp.title')}</h1>
          <p>{t('followUp.pageHint')}</p>
        </div>
        <div className="ops-page-head-actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={handlePrintFollowUps}>
            <Printer size={14} />{' '}
            {isToday ? t('followUp.printToday') : t('followUp.printForDate', { date: formatDateDisplay(selectedDate, language) })}
          </button>
          <button type="button" className="btn btn--ghost btn--small btn--whatsapp" onClick={handleWhatsAppSummary}>
            <MessageCircle size={14} />{' '}
            {isToday ? t('followUp.whatsappToday') : t('followUp.whatsappForDate', { date: formatDateDisplay(selectedDate, language) })}
          </button>
          <button type="button" className="btn btn--primary btn--small" onClick={() => setAddingClinical((v) => !v)}>
            <Plus size={14} /> {t('followUp.addClinical')}
          </button>
        </div>
      </header>

      <div className="ops-kpis">
        <div className="ops-kpi is-due">
          <span className="ops-kpi-label">
            {isToday
              ? t('followUp.summary.dueToday')
              : t('followUp.summary.dueOnDate', { date: formatDateDisplay(selectedDate, language) })}
          </span>
          <span className="ops-kpi-value">{summary?.dueToday ?? 0}</span>
        </div>
        <div className="ops-kpi is-overdue">
          <span className="ops-kpi-label">{t('followUp.summary.overdue')}</span>
          <span className="ops-kpi-value">{summary?.overdue ?? 0}</span>
        </div>
        <div className="ops-kpi is-ok">
          <span className="ops-kpi-label">{t('followUp.summary.completed')}</span>
          <span className="ops-kpi-value">{summary?.completed ?? 0}</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi-label">{t('followUp.summary.clinical')}</span>
          <span className="ops-kpi-value">{summary?.clinical ?? 0}</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi-label">{t('followUp.summary.financial')}</span>
          <span className="ops-kpi-value">{summary?.financial ?? 0}</span>
        </div>
      </div>

      {addingClinical && (
        <div className="ops-panel">
          <h3>{t('followUp.addClinical')}</h3>
          <div className="ops-form-grid">
            <label className="ops-field">
              <span>{t('receipt.patient')}</span>
              <input
                value={newPatient ? newPatient.fullName : newPatientQuery}
                onChange={(e) => {
                  setNewPatient(null);
                  setNewPatientQuery(e.target.value);
                }}
                placeholder={t('common.searchPlaceholder') ?? ''}
              />
            </label>
            <label className="ops-field">
              <span>{t('followUp.columns.reason')}</span>
              <input value={newReason} onChange={(e) => setNewReason(e.target.value)} />
            </label>
            <label className="ops-field">
              <span>{t('followUp.columns.date')}</span>
              <DateField value={newDate} onChange={setNewDate} />
            </label>
            <div className="ops-row-actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setAddingClinical(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={!newPatient || !newReason.trim() || createMutation.isPending}
                onClick={() =>
                  newPatient &&
                  createMutation.mutate({
                    patientId: newPatient.id,
                    type: 'CLINICAL',
                    reason: newReason.trim(),
                    followUpDate: newDate,
                  })
                }
              >
                {t('common.save')}
              </button>
            </div>
          </div>
          {!newPatient && patientSearch.length > 0 && newPatientQuery.length >= 2 && (
            <ul className="ops-suggest-list">
              {patientSearch.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setNewPatient(p);
                      setNewPatientQuery('');
                    }}
                  >
                    {p.fullName} — {p.fileNumber}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="ops-toolbar">
        <div className="ops-datebar">
          <label htmlFor="follow-up-selected-date">{t('followUp.selectDate')}</label>
          <DateField
            id="follow-up-selected-date"
            value={selectedDate}
            onChange={(value) => {
              setSelectedDate(value);
              setExpandedId(null);
              setError(null);
            }}
          />
          {!isToday && (
            <button type="button" className="link-btn" onClick={() => setSelectedDate(todayIso())}>
              {t('followUp.backToToday')}
            </button>
          )}
        </div>
        <div className="ops-seg" role="tablist">
          {(['ALL', 'CLINICAL', 'FINANCIAL'] as FilterType[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              className={filter === f ? 'active' : undefined}
              onClick={() => setFilter(f)}
            >
              {t(`followUp.filters.${f}`)}
            </button>
          ))}
        </div>
        <label className="ops-search">
          <input
            type="search"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder={t('followUp.searchPlaceholder') ?? ''}
          />
        </label>
        {patientFilter && (
          <button type="button" className="link-btn" onClick={() => setSearchParams({})}>
            {t('followUp.clearPatientFilter')}
          </button>
        )}
      </div>

      {error && <div className="ops-banner is-warn">{error}</div>}

      {isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : visibleItems.length === 0 ? (
        <div className="ops-empty">
          <strong>{t('followUp.emptyForDate', { date: formatDateDisplay(selectedDate, language) })}</strong>
          <p>{t('followUp.emptyHint')}</p>
          <button type="button" className="btn btn--primary btn--small" onClick={() => setAddingClinical(true)}>
            <Plus size={14} /> {t('followUp.addClinical')}
          </button>
        </div>
      ) : (
        <div className="ops-worklist">
          <div className="ops-worklist-head fu-cols">
            <span>{t('followUp.columns.patient')}</span>
            <span>{t('followUp.columns.type')}</span>
            <span>{t('followUp.columns.reason')}</span>
            <span>{t('followUp.columns.date')}</span>
            <span>{t('followUp.columns.details')}</span>
            <span>{t('followUp.columns.status')}</span>
            <span>{t('common.actions')}</span>
          </div>
          {visibleItems.map((fu) => (
            <div key={fu.id} className={expandedId === fu.id ? 'ops-work-block is-open' : 'ops-work-block'}>
              <div
                className={[
                  'ops-work-row',
                  'fu-cols',
                  expandedId === fu.id ? 'is-open' : '',
                  fu.status === 'COMPLETED' ? 'is-done-row' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggleRow(fu.id)}
              >
                <div className="ops-id" data-label={t('followUp.columns.patient')}>
                  <strong>{fu.patientName}</strong>
                  <span>#{fu.patientFileNumber}</span>
                </div>
                <span data-label={t('followUp.columns.type')}>
                  <span className={`ops-status ${fu.type === 'FINANCIAL' ? 'is-financial' : 'is-clinical'}`}>
                    {t(`followUp.types.${fu.type}`)}
                  </span>
                </span>
                <span className="ops-meta" data-label={t('followUp.columns.reason')}>
                  {fu.reason}
                </span>
                <span data-label={t('followUp.columns.date')}>{formatDateDisplay(fu.followUpDate, language)}</span>
                <div className="ops-id" data-label={t('followUp.columns.details')}>
                  {fu.type === 'FINANCIAL' ? (
                    <>
                      <strong className="ops-money is-out">{formatMoney(fu.remainingCents ?? 0)}</strong>
                      {fu.lastPaymentDate && (
                        <span>
                          {t('followUp.lastPayment')}: {formatDateDisplay(fu.lastPaymentDate, language)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>{fu.details || fu.note || '—'}</span>
                  )}
                </div>
                <span data-label={t('followUp.columns.status')}>
                  <span className={statusOpsClass(fu.displayStatus)}>
                    {fu.status === 'COMPLETED'
                      ? `${t('followUp.completedToday')} ✓`
                      : t(`followUp.statuses.${fu.displayStatus}`)}
                  </span>
                </span>
                <div className="ops-row-actions" data-label={t('common.actions')} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn--ghost btn--small btn--whatsapp" onClick={() => handleWhatsApp(fu)}>
                    <MessageCircle size={14} /> {t('followUp.actions.whatsapp')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleRow(fu.id)}>
                    {t('followUp.actions.open')}
                  </button>
                </div>
              </div>
              {expandedId === fu.id && (
                <div className="ops-expanded">
                  <FollowUpExpandedPanel
                    fu={fu}
                    latestHistory={historyByFollowUpId.get(fu.id)}
                    onDone={() => setExpandedId(null)}
                    onWhatsApp={handleWhatsApp}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="ops-history">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? t('followUp.hideHistory') : t('followUp.showHistory')}
        </button>
        {showHistory && (
          <>
            <h2>{t('followUp.historyTitle')}</h2>
            {history.length === 0 ? (
              <p className="muted">{t('followUp.historyEmpty')}</p>
            ) : (
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('followUp.columns.patient')}</th>
                      <th>{t('followUp.columns.type')}</th>
                      <th>{t('followUp.columns.reason')}</th>
                      <th>{t('followUp.columns.result')}</th>
                      <th>{t('common.note')}</th>
                      <th>{t('followUp.performedBy')}</th>
                      <th>{t('followUp.actions.nextDate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{formatDateDisplay(h.createdAt.slice(0, 10), language)}</td>
                        <td>{h.patientName}</td>
                        <td>{t(`followUp.types.${h.type}`)}</td>
                        <td>{h.reason}</td>
                        <td>{h.result ? t(`followUp.results.${h.result}`) : '—'}</td>
                        <td className="ops-meta">
                          {[h.note, h.appointmentSummary, h.paymentAmountCents != null ? formatMoney(h.paymentAmountCents) : null]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                        <td>{h.performedByName || '—'}</td>
                        <td>{h.nextFollowUpDate ? formatDateDisplay(h.nextFollowUpDate, language) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
