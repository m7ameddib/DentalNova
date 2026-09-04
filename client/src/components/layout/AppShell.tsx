import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopNav } from './TopNav';
import { SessionRefresh } from './SessionRefresh';
import { PrintPortal } from '@/components/common/PrintPortal';

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="app-shell">
      <SessionRefresh />
      <TopNav />
      <main className="app-shell__content">
        <Outlet />
      </main>
      <footer className="app-shell__footer">{t('app.poweredBy')}</footer>
      <PrintPortal />
    </div>
  );
}
