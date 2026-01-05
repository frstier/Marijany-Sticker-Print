import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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

// --- REMOTE DEBUGGING: ON-SCREEN CONSOLE ---
if (import.meta.env.PROD || true) { // Force enable for debugging
  const logDiv = document.createElement('div');
  logDiv.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 200px;
    background: rgba(0,0,0,0.8);
    color: #0f0;
    font-family: monospace;
    font-size: 10px;
    overflow: auto;
    z-index: 10000;
    padding: 10px;
    pointer-events: none;
  `;
  document.body.appendChild(logDiv);

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const appendLog = (type: string, args: any[]) => {
    const msg = args.map(a => {
      try {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      } catch (e) {
        return String(a);
      }
    }).join(' ');

    const line = document.createElement('div');
    line.textContent = `[${type}] ${msg}`;
    line.style.borderBottom = '1px solid #333';
    if (type === 'ERROR') line.style.color = '#ff6b6b';
    if (type === 'WARN') line.style.color = '#feca57';
    logDiv.appendChild(line);
    logDiv.scrollTop = logDiv.scrollHeight;
  };

  console.log = (...args) => { originalLog(...args); appendLog('LOG', args); };
  console.error = (...args) => { originalError(...args); appendLog('ERROR', args); };
  console.warn = (...args) => { originalWarn(...args); appendLog('WARN', args); };
}
// -------------------------------------------

import { AuthProvider } from './hooks/useAuth';

console.log("Sticker Print App Starting...");

try {
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
} catch (e) {
  console.error("Render Error:", e);
}