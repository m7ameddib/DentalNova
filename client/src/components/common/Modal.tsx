import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  headerExtra?: ReactNode;
  /** Desktop-sized by default; "wide" for tables (invoice/payment history), "xwide" for wider catalogs (medication catalog). */
  size?: 'default' | 'wide' | 'xwide';
  children: ReactNode;
}

/** Centered desktop popup for secondary details (invoice, payment history, etc). */
export function Modal({ title, icon, onClose, headerExtra, size = 'default', children }: ModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const sizeClass =
    size === 'xwide' ? 'modal-panel modal-panel--xwide' : size === 'wide' ? 'modal-panel modal-panel--wide' : 'modal-panel';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={sizeClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-panel__header">
          <div className="modal-panel__title">
            {icon}
            <span>{title}</span>
          </div>
          {headerExtra}
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>
  );
}
