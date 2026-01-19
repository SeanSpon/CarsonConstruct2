import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../index.css';

// #region agent log
const debugLog = (location: string, message: string, data: Record<string, unknown>, hypothesisId: string) => { fetch('http://127.0.0.1:7243/ingest/5a29b418-6eb9-4d45-b489-cbbacb9ac2f5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location,message,data,timestamp:Date.now(),sessionId:'debug-session',hypothesisId})}).catch(()=>{}); };

debugLog('renderer/index.tsx:top', 'Renderer starting', { hasApi: typeof window.api !== 'undefined' }, 'E');

window.addEventListener('error', (event) => {
  debugLog('renderer:global-error', 'Uncaught error in renderer', { message: event.message, filename: event.filename, lineno: event.lineno }, 'E');
});
window.addEventListener('unhandledrejection', (event) => {
  debugLog('renderer:unhandled-rejection', 'Unhandled promise rejection in renderer', { reason: String(event.reason) }, 'E');
});
// #endregion

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// #region agent log
debugLog('renderer/index.tsx:mount', 'Mounting React app', { containerId: container.id }, 'E');
// #endregion

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
