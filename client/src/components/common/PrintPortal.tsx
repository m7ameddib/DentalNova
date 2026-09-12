import { useEffect, useRef } from 'react';
import { usePrintStore } from '@/store/print.store';

/** Mounted once (in AppShell) — renders whatever the print store asks for, then opens the print dialog. */
export function PrintPortal() {
  const content = usePrintStore((s) => s.content);
  const requestId = usePrintStore((s) => s.requestId);
  const clear = usePrintStore((s) => s.clear);
  const printedIdRef = useRef(0);

  useEffect(() => {
    if (!content || requestId === 0) return undefined;
    let cancelled = false;
    let timeoutId = 0;
    const printedFor = requestId;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => {
          if (cancelled) return;
          printedIdRef.current = printedFor;
          window.print();
        }, 120);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutId);
    };
  }, [content, requestId]);

  useEffect(() => {
    function handleAfterPrint() {
      if (usePrintStore.getState().requestId === printedIdRef.current) {
        clear();
      }
    }
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [clear]);

  if (!content) return null;
  return <div className="receipt-print-only">{content}</div>;
}
