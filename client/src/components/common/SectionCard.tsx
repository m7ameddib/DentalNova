import { Plus } from 'lucide-react';
import { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  onAdd?: () => void;
  addTitle?: string;
  className?: string;
  /** Extra content rendered in the header between the title and the add button (e.g. a compact search input). */
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** Reusable section container used by all four Patient Record columns. */
export function SectionCard({
  title,
  icon,
  onAdd,
  addTitle,
  className,
  headerExtra,
  children,
}: SectionCardProps) {
  return (
    <section className={`section-card ${className ?? ''}`}>
      <header className="section-card__header">
        <div className="section-card__title">
          {icon}
          <span>{title}</span>
        </div>
        {headerExtra ? <div className="section-card__header-extra">{headerExtra}</div> : null}
        {onAdd && (
          <button className="section-card__add-btn" onClick={onAdd} title={addTitle} type="button">
            <Plus size={15} />
          </button>
        )}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
