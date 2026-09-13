import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Users,
  ClipboardList,
  Receipt,
  FlaskConical,
  Sparkles,
  Menu,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { ConnectionStatusChip } from '@/components/common/ConnectionStatusChip';
import { TrialRemainingChip } from '@/components/common/TrialRemainingChip';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';

export function TopNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { language, setLanguage, mobileNavOpen, setMobileNavOpen } = useUiStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const isPatientWorkspaceActive =
    location.pathname === '/' || location.pathname.startsWith('/patients');
  const isMoreActive =
    location.pathname.startsWith('/ai-assistant') || location.pathname.startsWith('/settings');

  const canViewPatients = usePermission(PERMISSIONS.PATIENTS_VIEW);
  const canViewAppointments = usePermission(PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewFollowUps = usePermission(PERMISSIONS.FOLLOWUPS_MANAGE);
  const canViewLabCases = usePermission(PERMISSIONS.LAB_CASES_MANAGE);
  const canViewReports = usePermission(PERMISSIONS.REPORTS_VIEW);
  const canViewSettings = usePermission(PERMISSIONS.SETTINGS_VIEW);
  const canUseAiAssistant = usePermission(PERMISSIONS.AI_ASSISTANT_USE);
  const hasOverflow = canUseAiAssistant || canViewSettings;

  useEffect(() => {
    setMobileNavOpen(false);
    setMoreOpen(false);
  }, [location.pathname, setMobileNavOpen]);

  useEffect(() => {
    document.body.classList.toggle('top-nav-menu-open', mobileNavOpen);
    return () => document.body.classList.remove('top-nav-menu-open');
  }, [mobileNavOpen]);

  const closeMenu = () => setMobileNavOpen(false);

  return (
    <header className="top-nav">
      <div className="top-nav__brand">
        <BrandLogo variant="nav" />
        <ConnectionStatusChip />
      </div>

      <button
        type="button"
        className="top-nav__menu-btn icon-btn"
        aria-expanded={mobileNavOpen}
        aria-controls="top-nav-menu"
        aria-label={mobileNavOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
      >
        {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileNavOpen && (
        <button
          type="button"
          className="top-nav__backdrop"
          aria-label={t('nav.closeMenu')}
          onClick={closeMenu}
        />
      )}

      <nav
        id="top-nav-menu"
        className={mobileNavOpen ? 'top-nav__links top-nav__links--open' : 'top-nav__links'}
      >
        {canViewPatients && (
          <NavLink
            to="/"
            className={isPatientWorkspaceActive ? 'top-nav__link active' : 'top-nav__link'}
            onClick={closeMenu}
          >
            <Users size={16} /> {t('nav.patientWorkspace')}
          </NavLink>
        )}
        {canViewAppointments && (
          <NavLink to="/appointments" className="top-nav__link" onClick={closeMenu}>
            <CalendarDays size={16} /> {t('nav.appointments')}
          </NavLink>
        )}
        {canViewFollowUps && (
          <NavLink to="/follow-ups" className="top-nav__link" onClick={closeMenu}>
            <ClipboardList size={16} /> {t('nav.followUp')}
          </NavLink>
        )}
        {canViewLabCases && (
          <NavLink to="/lab-cases" className="top-nav__link" onClick={closeMenu}>
            <FlaskConical size={16} /> {t('nav.labCases')}
          </NavLink>
        )}
        {canViewReports && (
          <NavLink to="/clinic-expenses" className="top-nav__link" onClick={closeMenu}>
            <Receipt size={16} /> {t('nav.clinicExpenses')}
          </NavLink>
        )}
        {canViewReports && (
          <NavLink to="/reports" className="top-nav__link" onClick={closeMenu}>
            <BarChart3 size={16} /> {t('nav.reports')}
          </NavLink>
        )}
        {hasOverflow && (
          <div className="top-nav__overflow">
            <button
              type="button"
              className={isMoreActive ? 'top-nav__link active' : 'top-nav__link'}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal size={16} /> {t('nav.more')}
            </button>
            <div className={moreOpen ? 'top-nav__overflow-menu top-nav__overflow-menu--open' : 'top-nav__overflow-menu'}>
              {canUseAiAssistant && (
                <NavLink to="/ai-assistant" className="top-nav__link" onClick={closeMenu}>
                  <Sparkles size={16} /> {t('nav.aiAssistant')}
                </NavLink>
              )}
              {canViewSettings && (
                <NavLink to="/settings" className="top-nav__link" onClick={closeMenu}>
                  <Settings size={16} /> {t('nav.settings')}
                </NavLink>
              )}
            </div>
          </div>
        )}
        {canUseAiAssistant && (
          <NavLink to="/ai-assistant" className="top-nav__link top-nav__link--drawer-only" onClick={closeMenu}>
            <Sparkles size={16} /> {t('nav.aiAssistant')}
          </NavLink>
        )}
        {canViewSettings && (
          <NavLink to="/settings" className="top-nav__link top-nav__link--drawer-only" onClick={closeMenu}>
            <Settings size={16} /> {t('nav.settings')}
          </NavLink>
        )}

        <div className="top-nav__drawer-footer">
          <div className="top-nav__lang">
            <button
              type="button"
              className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
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
              <TrialRemainingChip compact />
            </div>
            <button className="icon-btn" title={t('common.logout') ?? ''} onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="top-nav__lang top-nav__lang--desktop">
        <button
          type="button"
          className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('ar')}
        >
          AR
        </button>
      </div>

      <div className="top-nav__user top-nav__user--desktop">
        <div className="top-nav__user-info">
          <span className="top-nav__user-name">{user?.fullName}</span>
          <span className="top-nav__user-role">{user?.roleLabel}</span>
          <TrialRemainingChip compact />
        </div>
        <button className="icon-btn" title={t('common.logout') ?? ''} onClick={logout}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
