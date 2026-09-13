import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ClipboardList, BarChart3, Users, MoreHorizontal } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const isPatientWorkspaceActive =
    location.pathname === '/' || location.pathname.startsWith('/patients');

  const canViewPatients = usePermission(PERMISSIONS.PATIENTS_VIEW);
  const canViewAppointments = usePermission(PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewFollowUps = usePermission(PERMISSIONS.FOLLOWUPS_MANAGE);
  const canViewReports = usePermission(PERMISSIONS.REPORTS_VIEW);

  return (
    <nav className="bottom-nav" aria-label={t('nav.more')}>
      {canViewPatients && (
        <NavLink
          to="/"
          className={isPatientWorkspaceActive ? 'bottom-nav__link active' : 'bottom-nav__link'}
        >
          <Users size={18} />
          <span>{t('nav.patientWorkspace')}</span>
        </NavLink>
      )}
      {canViewAppointments && (
        <NavLink to="/appointments" className="bottom-nav__link">
          <CalendarDays size={18} />
          <span>{t('nav.appointments')}</span>
        </NavLink>
      )}
      {canViewFollowUps && (
        <NavLink to="/follow-ups" className="bottom-nav__link">
          <ClipboardList size={18} />
          <span>{t('nav.followUp')}</span>
        </NavLink>
      )}
      {canViewReports && (
        <NavLink to="/reports" className="bottom-nav__link">
          <BarChart3 size={18} />
          <span>{t('nav.reports')}</span>
        </NavLink>
      )}
      <button
        type="button"
        className={mobileNavOpen ? 'bottom-nav__link bottom-nav__link--more active' : 'bottom-nav__link bottom-nav__link--more'}
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
      >
        <MoreHorizontal size={18} />
        <span>{t('nav.more')}</span>
      </button>
    </nav>
  );
}
