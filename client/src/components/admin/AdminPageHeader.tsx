import { Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '@/store/ui.store';
import { ADMIN_BASE_PATH } from './admin-utils';

export interface AdminBreadcrumb {
  label: string;
  to?: string;
}

export function AdminPageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  crumbs?: AdminBreadcrumb[];
}) {
  const language = useUiStore((s) => s.language);
  const Chevron = language === 'ar' ? ChevronLeft : ChevronRight;
  const items: AdminBreadcrumb[] = crumbs?.length
    ? crumbs
    : [{ label: title }];

  return (
    <header className="admin-page-header">
      <div className="admin-page-header__copy">
        <nav className="admin-breadcrumb" aria-label="Breadcrumb">
          <Link to={ADMIN_BASE_PATH} className="admin-breadcrumb__link">
            DibNova
          </Link>
          {items.map((item, index) => (
            <Fragment key={`${item.label}-${index}`}>
              <Chevron size={12} className="admin-breadcrumb__sep" aria-hidden />
              {item.to ? (
                <Link to={item.to} className="admin-breadcrumb__link">
                  {item.label}
                </Link>
              ) : (
                <span className="admin-breadcrumb__current">{item.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </header>
  );
}
