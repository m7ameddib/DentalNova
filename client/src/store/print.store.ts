import { ReactNode } from 'react';
import { create } from 'zustand';

interface PrintState {
  content: ReactNode | null;
  /** Mounts the given printable content and triggers the browser print dialog. */
  print: (content: ReactNode) => void;
  clear: () => void;
}

/**
 * Single shared "print target" so every Print action (patient file, account
 * statement, payment receipt, invoice receipt) reuses one hidden
 * `.receipt-print-only` node instead of each feature managing its own —
 * this guarantees only the requested document is ever sent to the printer.
 */
export const usePrintStore = create<PrintState>((set) => ({
  content: null,
  print: (content) => set({ content }),
  clear: () => set({ content: null }),
}));
