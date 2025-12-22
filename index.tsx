import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

const root = ReactDOM.createRoot(rootElement);

// Global Error Handler for Startup
window.addEventListener('error', (event) => {
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Application Error</h1>
      <p>${event.message}</p>
      <pre>${event.error?.stack || ''}</pre>
    </div>
  `;
});

// Async Error Handler
window.addEventListener('unhandledrejection', (event) => {
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Unhandled Promise Rejection</h1>
      <p>${event.reason}</p>
    </div>
  `;
});

try {
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
} catch (e) {
  console.error("Render Error:", e);
}