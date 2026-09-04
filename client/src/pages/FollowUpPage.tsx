import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, MessageCircle, Plus, Printer } from 'lucide-react';
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
import { getErrorMessage } from '@/utils/errors';
import { formatMoney } from '@/utils/money';
import { openFollowUpWhatsApp, openFollowUpsWhatsAppBulk } from '@/utils/followUpWhatsApp';

type FilterType = 'ALL' | FollowUpType;

export function FollowUpPage() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientFilter = searchParams.get('patientId');

  const [showHistory, setShowHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  function statusClass(status: FollowUpWithPatient['displayStatus']) {
    return `follow-up-status follow-up-status--${status.toLowerCase()}`;
  }

  function toggleRow(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="follow-up-page">
      <div className="follow-up-page__header">
        <h1>
          <ClipboardList size={22} className="follow-up-page__title-icon" />
          {t('followUp.title')}
        </h1>
        <div className="follow-up-page__header-actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={handlePrintFollowUps}>
            <Printer size={14} />{' '}
            {isToday ? t('followUp.printToday') : t('followUp.printForDate', { date: formatDateDisplay(selectedDate, language) })}
          </button>
          <button type="button" className="btn btn--ghost btn--small btn--whatsapp" onClick={handleWhatsAppSummary}>
            <MessageCircle size={14} />{' '}
            {isToday ? t('followUp.whatsappToday') : t('followUp.whatsappForDate', { date: formatDateDisplay(selectedDate, language) })}
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setAddingClinical((v) => !v)}>
            <Plus size={14} /> {t('followUp.addClinical')}
          </button>
        </div>
      </div>

      <div className="follow-up-date-bar">
        <label className="follow-up-date-bar__label" htmlFor="follow-up-selected-date">
          {t('followUp.selectDate')}
        </label>
        <input
          id="follow-up-selected-date"
          type="date"
          className="follow-up-date-bar__input"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setExpandedId(null);
            setError(null);
          }}
        />
        {!isToday && (
          <button type="button" className="link-btn follow-up-date-bar__today" onClick={() => setSelectedDate(todayIso())}>
            {t('followUp.backToToday')}
          </button>
        )}
      </div>

      <div className="follow-up-summary">
        <div className="follow-up-summary__card">
          <span className="follow-up-summary__value">{summary?.dueToday ?? 0}</span>
          <span className="follow-up-summary__label">
            {isToday
              ? t('followUp.summary.dueToday')
              : t('followUp.summary.dueOnDate', { date: formatDateDisplay(selectedDate, language) })}
          </span>
        </div>
        <div className="follow-up-summary__card follow-up-summary__card--warn">
          <span className="follow-up-summary__value">{summary?.overdue ?? 0}</span>
          <span className="follow-up-summary__label">{t('followUp.summary.overdue')}</span>
        </div>
        <div className="follow-up-summary__card">
          <span className="follow-up-summary__value">{summary?.completed ?? 0}</span>
          <span className="follow-up-summary__label">{t('followUp.summary.completed')}</span>
        </div>
        <div className="follow-up-summary__card">
          <span className="follow-up-summary__value">{summary?.clinical ?? 0}</span>
          <span className="follow-up-summary__label">{t('followUp.summary.clinical')}</span>
        </div>
        <div className="follow-up-summary__card">
          <span className="follow-up-summary__value">{summary?.financial ?? 0}</span>
          <span className="follow-up-summary__label">{t('followUp.summary.financial')}</span>
        </div>
      </div>

      {addingClinical && (
        <div className="follow-up-add-form">
          <label className="form-field">
            <span className="form-field__label">{t('receipt.patient')}</span>
            <input
              value={newPatient ? newPatient.fullName : newPatientQuery}
              onChange={(e) => {
                setNewPatient(null);
                setNewPatientQuery(e.target.value);
              }}
              placeholder={t('common.searchPlaceholder') ?? ''}
            />
          </label>
          {!newPatient && patientSearch.length > 0 && newPatientQuery.length >= 2 && (
            <ul className="patient-search-dropdown">
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
          <label className="form-field">
            <span className="form-field__label">{t('followUp.columns.reason')}</span>
            <input value={newReason} onChange={(e) => setNewReason(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('followUp.columns.date')}</span>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <div className="form-actions">
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
      )}

      <div className="follow-up-filters">
        {(['ALL', 'CLINICAL', 'FINANCIAL'] as FilterType[]).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
            onClick={() => setFilter(f)}
          >
            {t(`followUp.filters.${f}`)}
          </button>
        ))}
        {patientFilter && (
          <button type="button" className="link-btn" onClick={() => setSearchParams({})}>
            {t('followUp.clearPatientFilter')}
          </button>
        )}
      </div>

      {error && <div className="form-error-banner">{error}</div>}

      {isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : filteredItems.length === 0 ? (
        <p className="muted">{t('followUp.emptyForDate', { date: formatDateDisplay(selectedDate, language) })}</p>
      ) : (
        <div className="follow-up-table-wrap">
          <table className="payment-history-table follow-up-table">
            <thead>
              <tr>
                <th>{t('followUp.columns.patient')}</th>
                <th>{t('followUp.columns.type')}</th>
                <th>{t('followUp.columns.reason')}</th>
                <th>{t('followUp.columns.date')}</th>
                <th>{t('followUp.columns.details')}</th>
                <th>{t('followUp.columns.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((fu) => (
                <Fragment key={fu.id}>
                  <tr
                    className={[
                      expandedId === fu.id ? 'follow-up-table__row--selected' : '',
                      fu.status === 'COMPLETED' ? 'follow-up-table__row--completed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => toggleRow(fu.id)}
                  >
                    <td>
                      <span>{fu.patientName}</span>
                      <span className="muted follow-up-table__file">{fu.patientFileNumber}</span>
                    </td>
                    <td>{t(`followUp.types.${fu.type}`)}</td>
                    <td>{fu.reason}</td>
                    <td>{formatDateDisplay(fu.followUpDate, language)}</td>
                    <td className="follow-up-table__details">
                      {fu.type === 'FINANCIAL' ? (
                        <>
                          <span>{formatMoney(fu.remainingCents ?? 0)}</span>
                          {fu.lastPaymentDate && (
                            <span className="muted">
                              {t('followUp.lastPayment')}: {formatDateDisplay(fu.lastPaymentDate, language)}
                            </span>
                          )}
                        </>
                      ) : (
                        fu.details || fu.note || '—'
                      )}
                    </td>
                    <td>
                      <span className={statusClass(fu.displayStatus)}>
                        {fu.status === 'COMPLETED'
                          ? `${t('followUp.completedToday')} ✓`
                          : t(`followUp.statuses.${fu.displayStatus}`)}
                      </span>
                    </td>
                    <td className="follow-up-table__actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="icon-btn btn--whatsapp" onClick={() => handleWhatsApp(fu)} title={t('followUp.actions.whatsapp')}>
                        <MessageCircle size={14} />
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleRow(fu.id)}>
                        {t('followUp.actions.open')}
                      </button>
                    </td>
                  </tr>
                  {expandedId === fu.id && (
                    <tr className="follow-up-table__expand-row">
                      <td colSpan={7}>
                        <FollowUpExpandedPanel
                          fu={fu}
                          latestHistory={historyByFollowUpId.get(fu.id)}
                          onDone={() => setExpandedId(null)}
                          onWhatsApp={handleWhatsApp}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="follow-up-history-section">
        <button
          type="button"
          className="btn btn--ghost btn--small follow-up-history-toggle"
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
              <table className="payment-history-table">
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
                      <td className="muted">
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
            )}
          </>
        )}
      </section>
    </div>
  );
}
