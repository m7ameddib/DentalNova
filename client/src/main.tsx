import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import App from './App';
import './styles/index.css';
import './styles/mobile.css';
import './styles/print.css';
import './styles/follow-up.css';
import './styles/daily-report.css';
import { registerPwaServiceWorker } from '@/pwa/registerPwa';

registerPwaServiceWorker();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
