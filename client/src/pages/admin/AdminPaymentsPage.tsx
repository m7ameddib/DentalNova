import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminClinicScopeBanner } from '@/components/admin/AdminClinicScopeBanner';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_PATHS } from '@/components/admin/admin-utils';
import { dibnovaAdminApi, type AdminLicensePayment } from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';
import { formatMoney } from '@/utils/money';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { useUiStore } from '@/store/ui.store';
import { AdminPaymentReceiptPrintable } from '@/components/admin/AdminPrintables';

export function AdminPaymentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const language = useUiStore((s) => s.language);
  const {
    isOnline,
    clinicReady,
    selectedClinic,
    selectedClinicId,
    payments,
    payBalance,
    payAmount,
    setPayAmount,
    payDate,
    setPayDate,
    payMethod,
    setPayMethod,
    payNote,
    setPayNote,
    notes,
    setNotes,
    setSuccess,
    setError,
    invalidate,
  } = useAdminDashboard();

  return (
    <div className="admin-page">
      <AdminClinicScopeBanner clinicName={selectedClinic?.clinicName} />
      <AdminPageHeader
        title={t('dibnovaAdmin.paymentsTitle')}
        description={t('dibnovaAdmin.paymentsHint')}
        crumbs={[
          { label: t('dibnovaAdmin.nav.clinics'), to: ADMIN_PATHS.clinics },
          { label: t('dibnovaAdmin.nav.payments') },
        ]}
      />

      {isOnline && clinicReady && selectedClinic && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.paymentsTitle')}</h2>
          <p className="muted">
            {t('dibnovaAdmin.paymentsBalance')}: {formatMoney(payBalance?.balanceCents ?? 0)}
          </p>
          <label className="form-field">
            <span className="form-field__label">{t('dibnovaAdmin.notes')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('dibnovaAdmin.notesPlaceholder')}
            />
          </label>
          <div className="setup-grid">
            <label className="form-field">
              <span className="form-field__label">{t('patientRecord.account.amount')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('common.date')}</span>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('patientRecord.account.method')}</span>
              <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </label>
            <label className="form-field setup-grid__full">
              <span className="form-field__label">{t('common.note')}</span>
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            </label>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => {
              void dibnovaAdminApi
                .addPayment({
                  clinicId: selectedClinicId,
                  amount: Number(payAmount),
                  paymentDate: payDate,
                  method: payMethod,
                  note: payNote || undefined,
                })
                .then(() => {
                  setPayAmount('');
                  setSuccess(t('dibnovaAdmin.success.payment'));
                  invalidate();
                  queryClient.invalidateQueries({ queryKey: ['dibnova-admin-payments'] });
                  queryClient.invalidateQueries({ queryKey: ['dibnova-admin-balance'] });
                })
                .catch((err) => setError(getErrorMessage(err, t('common.error'))));
            }}
          >
            {t('dibnovaAdmin.recordPayment')}
          </button>
          {payments.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('patientRecord.account.amount')}</th>
                    <th>{t('patientRecord.account.method')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: AdminLicensePayment) => (
                    <tr key={p.id}>
                      <td>{p.paymentDate}</td>
                      <td>{formatMoney(p.amountCents)}</td>
                      <td>{p.method}</td>
                      <td>
                        <span className={`status-badge status-badge--${p.status.toLowerCase()}`}>{p.status}</span>
                      </td>
                      <td className="table-row-actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          onClick={async () => {
                            const clinic = await loadClinicPrintInfo();
                            print(
                              <AdminPaymentReceiptPrintable
                                payment={p}
                                clinicName={selectedClinic.clinicName}
                                clinic={clinic}
                                language={language}
                              />,
                            );
                          }}
                        >
                          {t('common.print')}
                        </button>
                        {p.status !== 'VOID' && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--small btn--danger"
                            onClick={() => {
                              if (window.confirm(t('dibnovaAdmin.voidPaymentConfirm'))) {
                                void dibnovaAdminApi.voidPayment(p.id, notes).then(() => {
                                  invalidate();
                                  queryClient.invalidateQueries({ queryKey: ['dibnova-admin-payments'] });
                                });
                              }
                            }}
                          >
                            {t('common.cancel')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
