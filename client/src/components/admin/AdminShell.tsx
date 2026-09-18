import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Building2,
  ClipboardList,
  CreditCard,
  FlaskConical,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import { PrintPortal } from '@/components/common/PrintPortal';
import { getDibNovaAdminUser } from '@/api/dibnova-admin.api';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { AdminClinicPicker } from '@/components/admin/AdminClinicPicker';
import { ADMIN_PATHS, CLINIC_SCOPED_PATHS, type AdminNavItemId } from '@/components/admin/admin-utils';

interface NavItem {
  id: AdminNavItemId;
  to: string;
  icon: ReactNode;
  labelKey: string;
  end?: boolean;
  visible: boolean;
}

interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
}

export function AdminShell({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminUser = getDibNovaAdminUser();
  const {
    error,
    success,
    isLoading,
    isError,
    refetch,
    isOnline,
    canIssueOfflineLicenses,
  } = useAdminDashboard();

  const groups = useMemo<NavGroup[]>(
    () => [
      {
        id: 'overview',
        labelKey: 'dibnovaAdmin.navGroup.overview',
        items: [
          {
            id: 'dashboard',
            to: ADMIN_PATHS.dashboard,
            icon: <LayoutDashboard size={16} />,
            labelKey: 'dibnovaAdmin.nav.dashboard',
            end: true,
            visible: true,
          },
        ],
      },
      {
        id: 'clinics',
        labelKey: 'dibnovaAdmin.navGroup.clinics',
        items: [
          {
            id: 'clinics',
            to: ADMIN_PATHS.clinics,
            icon: <Building2 size={16} />,
            labelKey: 'dibnovaAdmin.nav.clinics',
            visible: true,
          },
          {
            id: 'subscription',
            to: ADMIN_PATHS.subscription,
            icon: <ShieldCheck size={16} />,
            labelKey: 'dibnovaAdmin.nav.subscription',
            visible: isOnline,
          },
          {
            id: 'payments',
            to: ADMIN_PATHS.payments,
            icon: <CreditCard size={16} />,
            labelKey: 'dibnovaAdmin.nav.payments',
            visible: isOnline,
          },
          {
            id: 'users',
            to: ADMIN_PATHS.users,
            icon: <Users size={16} />,
            labelKey: 'dibnovaAdmin.nav.users',
            visible: isOnline,
          },
          {
            id: 'operations',
            to: ADMIN_PATHS.operations,
            icon: <Activity size={16} />,
            labelKey: 'dibnovaAdmin.nav.operations',
            visible: isOnline,
          },
        ],
      },
      {
        id: 'trials',
        labelKey: 'dibnovaAdmin.navGroup.trials',
        items: [
          {
            id: 'trials',
            to: ADMIN_PATHS.trials,
            icon: <FlaskConical size={16} />,
            labelKey: 'dibnovaAdmin.nav.trials',
            visible: isOnline,
          },
          {
            id: 'marketing',
            to: ADMIN_PATHS.marketing,
            icon: <Megaphone size={16} />,
            labelKey: 'dibnovaAdmin.nav.marketing',
            visible: isOnline,
          },
        ],
      },
      {
        id: 'licensing',
        labelKey: 'dibnovaAdmin.navGroup.licensing',
        items: [
          {
            id: 'offline',
            to: ADMIN_PATHS.offline,
            icon: <KeyRound size={16} />,
            labelKey: 'dibnovaAdmin.nav.offline',
            visible: canIssueOfflineLicenses,
          },
        ],
      },
      {
        id: 'insights',
        labelKey: 'dibnovaAdmin.navGroup.insights',
        items: [
          {
            id: 'ai',
            to: ADMIN_PATHS.ai,
            icon: <ClipboardList size={16} />,
            labelKey: 'dibnovaAdmin.nav.ai',
            visible: isOnline,
          },
          {
            id: 'history',
            to: ADMIN_PATHS.history,
            icon: <History size={16} />,
            labelKey: 'dibnovaAdmin.nav.history',
            visible: isOnline,
          },
          {
            id: 'audit',
            to: ADMIN_PATHS.audit,
            icon: <ScrollText size={16} />,
            labelKey: 'dibnovaAdmin.nav.audit',
            visible: isOnline,
          },
        ],
      },
    ],
    [canIssueOfflineLicenses, isOnline],
  );

  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible && item.to) }))
    .filter((group) => group.items.length > 0);

  const showClinicPicker = CLINIC_SCOPED_PATHS.has(location.pathname);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  const sidebar = (
    <aside className="admin-sidebar" id="admin-sidebar">
      <div className="admin-sidebar__brand">
        <BrandLogo variant="nav" />
        <div>
          <strong>DibNova</strong>
          <span>{t('dibnovaAdmin.sidebarProduct')}</span>
        </div>
      </div>
      <nav className="admin-sidebar__nav" aria-label={t('dibnovaAdmin.title')}>
        {visibleGroups.map((group) => (
          <div key={group.id} className="admin-sidebar__group">
            <p className="admin-sidebar__group-label">{t(group.labelKey)}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'admin-sidebar__link admin-sidebar__link--active' : 'admin-sidebar__link'
                }
                onClick={closeSidebar}
              >
                {item.icon}
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="admin-sidebar__footer">
        <div className="admin-sidebar__user">
          <span className="admin-sidebar__user-name">{adminUser?.fullName || adminUser?.username || 'Admin'}</span>
          <span className="admin-sidebar__user-role">{t('dibnovaAdmin.adminRole')}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--small" onClick={onLogout}>
          <LogOut size={14} /> {t('dibnovaAdmin.logout')}
        </button>
        <Link to="/login" className="admin-sidebar__clinic-link">
          {t('dibnovaAdmin.clinicLoginLink')}
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="admin-app">
      {sidebarOpen && (
        <button
          type="button"
          className="admin-drawer-backdrop"
          aria-label={t('dibnovaAdmin.closeSidebar')}
          onClick={closeSidebar}
        />
      )}
      <div className={sidebarOpen ? 'admin-sidebar-host admin-sidebar-host--open' : 'admin-sidebar-host'}>
        {sidebar}
      </div>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__start">
            <button
              type="button"
              className="admin-topbar__menu"
              aria-label={t('dibnovaAdmin.openSidebar')}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="admin-topbar__title">
              <span className="admin-topbar__kicker">{t('dibnovaAdmin.title')}</span>
              <strong>{t('dibnovaAdmin.headerProduct')}</strong>
            </div>
          </div>
          <div className="admin-topbar__end">
            {showClinicPicker && <AdminClinicPicker compact />}
            <AuthLangSwitch />
            <button type="button" className="btn btn--ghost btn--small" onClick={() => refetch()}>
              <RefreshCw size={14} /> {t('common.refresh')}
            </button>
            <button type="button" className="btn btn--ghost btn--small admin-topbar__logout" onClick={onLogout}>
              <LogOut size={14} /> {t('dibnovaAdmin.logout')}
            </button>
          </div>
        </header>

        <div className="admin-content">
          {success && <div className="form-success-banner admin-alert">{success}</div>}
          {error && <div className="form-error-banner admin-alert">{error}</div>}
          {isLoading && <p className="muted admin-alert">{t('common.loading')}</p>}
          {isError && (
            <div className="form-error-banner admin-alert">
              {t('dibnovaAdmin.sessionExpired')}
              <button type="button" className="btn btn--ghost btn--small" onClick={onLogout}>
                {t('dibnovaAdmin.retryLogin')}
              </button>
            </div>
          )}
          <Outlet />
          <footer className="admin-content__footer muted">{t('app.poweredBy')}</footer>
        </div>
      </div>
      <PrintPortal />
    </div>
  );
}
