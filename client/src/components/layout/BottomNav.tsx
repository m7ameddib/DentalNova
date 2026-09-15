import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ClipboardList, BarChart3, Users, Sparkles, Settings } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { useShowAiAssistant } from '@/hooks/useDeploymentMode';
import { PERMISSIONS } from '@/constants/permissions';

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const isPatientWorkspaceActive =
    location.pathname === '/' || location.pathname.startsWith('/patients');

  const canViewPatients = usePermission(PERMISSIONS.PATIENTS_VIEW);
  const canViewAppointments = usePermission(PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewFollowUps = usePermission(PERMISSIONS.FOLLOWUPS_MANAGE);
  const canViewReports = usePermission(PERMISSIONS.REPORTS_VIEW);
  const canUseAiAssistant = useShowAiAssistant(usePermission(PERMISSIONS.AI_ASSISTANT_USE));
  const canViewSettings = usePermission(PERMISSIONS.SETTINGS_VIEW);

  return (
    <nav className="bottom-nav" aria-label={t('app.name')}>
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
      {canUseAiAssistant && (
        <NavLink to="/ai-assistant" className="bottom-nav__link">
          <Sparkles size={18} />
          <span>{t('nav.aiAssistant')}</span>
        </NavLink>
      )}
      {canViewSettings && (
        <NavLink to="/settings" className="bottom-nav__link">
          <Settings size={18} />
          <span>{t('nav.settings')}</span>
        </NavLink>
      )}
    </nav>
  );
}
