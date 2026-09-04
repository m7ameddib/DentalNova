import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, BarChart3, Settings, LogOut, Users, ClipboardList, Receipt, FlaskConical, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';

export function TopNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { language, setLanguage } = useUiStore();
  const isPatientWorkspaceActive = location.pathname === '/' || location.pathname.startsWith('/patients');

  const canViewAppointments = usePermission(PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewFollowUps = usePermission(PERMISSIONS.FOLLOWUPS_MANAGE);
  const canViewLabCases = usePermission(PERMISSIONS.LAB_CASES_MANAGE);
  const canViewReports = usePermission(PERMISSIONS.REPORTS_VIEW);
  const canViewSettings = usePermission(PERMISSIONS.SETTINGS_VIEW);
  const canUseAiAssistant = usePermission(PERMISSIONS.AI_ASSISTANT_USE);

  return (
    <header className="top-nav">
      <div className="top-nav__brand">
        <BrandLogo variant="nav" />
      </div>

      <nav className="top-nav__links">
        <NavLink
          to="/"
          className={isPatientWorkspaceActive ? 'top-nav__link active' : 'top-nav__link'}
        >
          <Users size={16} /> {t('nav.patientWorkspace')}
        </NavLink>
        {canViewAppointments && (
          <NavLink to="/appointments" className="top-nav__link">
            <CalendarDays size={16} /> {t('nav.appointments')}
          </NavLink>
        )}
        {canViewFollowUps && (
          <NavLink to="/follow-ups" className="top-nav__link">
            <ClipboardList size={16} /> {t('nav.followUp')}
          </NavLink>
        )}
        {canViewLabCases && (
          <NavLink to="/lab-cases" className="top-nav__link">
            <FlaskConical size={16} /> {t('nav.labCases')}
          </NavLink>
        )}
        {canViewReports && (
          <NavLink to="/clinic-expenses" className="top-nav__link">
            <Receipt size={16} /> {t('nav.clinicExpenses')}
          </NavLink>
        )}
        {canViewReports && (
          <NavLink to="/reports" className="top-nav__link">
            <BarChart3 size={16} /> {t('nav.reports')}
          </NavLink>
        )}
        {canUseAiAssistant && (
          <NavLink to="/ai-assistant" className="top-nav__link">
            <Sparkles size={16} /> {t('nav.aiAssistant')}
          </NavLink>
        )}
        {canViewSettings && (
          <NavLink to="/settings" className="top-nav__link">
            <Settings size={16} /> {t('nav.settings')}
          </NavLink>
        )}
      </nav>

      <div className="top-nav__lang">
        <button
          className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('ar')}
        >
          AR
        </button>
      </div>

      <div className="top-nav__user">
        <div className="top-nav__user-info">
          <span className="top-nav__user-name">{user?.fullName}</span>
          <span className="top-nav__user-role">{user?.roleLabel}</span>
        </div>
        <button className="icon-btn" title={t('common.logout') ?? ''} onClick={logout}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
