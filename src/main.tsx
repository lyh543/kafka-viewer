import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app.css';
import {
  attachConsoleForwarding,
  attachGlobalErrorHandlers,
  frontendLogger,
} from './utils/logger';

attachConsoleForwarding();
attachGlobalErrorHandlers();
frontendLogger.info('bootstrap', 'Starting React application');

// Disable the webview's built-in context menu; the app renders its own menus.
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);