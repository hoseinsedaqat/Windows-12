import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Let the shell know the real viewport size (window manager math depends on it).
window.addEventListener('resize', () => {
  window.dispatchEvent(new CustomEvent('win12:resize'));
});

// PWA: register the offline shell worker in production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[Windows 12 Concept] service worker registration failed', error);
    });
  });
}
