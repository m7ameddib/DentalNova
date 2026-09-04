import { useEffect } from 'react';
import { usePrintStore } from '@/store/print.store';

/** Mounted once (in AppShell) — renders whatever the print store asks for, then opens the print dialog. */
export function PrintPortal() {
  const content = usePrintStore((s) => s.content);
  const clear = usePrintStore((s) => s.clear);

  useEffect(() => {
    if (!content) return undefined;
    const raf = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(raf);
  }, [content]);

  useEffect(() => {
    function handleAfterPrint() {
      clear();
    }
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [clear]);

  if (!content) return null;
  return <div className="receipt-print-only">{content}</div>;
}
