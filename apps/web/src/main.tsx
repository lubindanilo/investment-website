import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ToastProvider } from './components/Toast.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { SubscriptionProvider } from './contexts/SubscriptionContext.js';
import { initSentry } from './lib/sentry.js';
import './i18n/index.js';
import './styles/global.css';

initSentry();

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <App />
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
