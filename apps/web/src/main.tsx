import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { initI18n } from './i18n/config';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

void initI18n()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error('initI18n failed', err);
    const root = document.getElementById('root');
    if (root) {
      root.textContent = '';
      const p = document.createElement('p');
      p.style.cssText = 'color:#fca5a5;padding:1.5rem;font-family:system-ui,sans-serif;max-width:40rem';
      p.textContent =
        'Life OS could not start i18n. Check the console (initI18n failed). Try clearing site data or localStorage key life-os:locale if a bad locale was stored.';
      root.appendChild(p);
    }
  });
