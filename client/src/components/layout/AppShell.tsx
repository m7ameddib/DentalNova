import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { SessionRefresh } from './SessionRefresh';
import { PrintPortal } from '@/components/common/PrintPortal';

export function AppShell() {
  return (
    <div className="app-shell">
      <SessionRefresh />
      <TopNav />
      <main className="app-shell__content">
        <Outlet />
      </main>
      <PrintPortal />
    </div>
  );
}
