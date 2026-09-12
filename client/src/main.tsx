import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import App from './App';
import './styles/index.css';
import './styles/mobile.css';
import './styles/print.css';
import './styles/follow-up.css';
import './styles/daily-report.css';
import { registerPwaServiceWorker } from '@/pwa/registerPwa';
import { queryClient } from '@/queryClient';
import { startOfflineFallback } from '@/offline/bootstrap';

registerPwaServiceWorker();
void startOfflineFallback();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
