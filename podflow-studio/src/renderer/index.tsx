import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GlobalBusyOverlay from './components/ui/GlobalBusyOverlay';
import ErrorBoundary from './components/ui/ErrorBoundary';
import '../index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <GlobalBusyOverlay />
    </ErrorBoundary>
  </React.StrictMode>
);
