import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Override localStorage for Electron persistent config storage
if ((window as any).electronStore) {
  const store = (window as any).electronStore;
  const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
  const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

  const isPersistentKey = (key: string) => key.startsWith('mobaxterm_') || key.startsWith('kirin_') || key.startsWith('net_');
  
  window.localStorage.getItem = (key: string) => {
    if (isPersistentKey(key)) {
      const val = store.getSync(key);
      if (val === null || val === undefined) return null;
      return typeof val === 'string' ? val : JSON.stringify(val);
    }
    return originalGetItem(key);
  };
  
  window.localStorage.setItem = (key: string, value: string) => {
    if (isPersistentKey(key)) {
      try {
        store.setSync(key, JSON.parse(value));
      } catch (e) {
        store.setSync(key, value);
      }
    } else {
      originalSetItem(key, value);
    }
  };

  window.localStorage.removeItem = (key: string) => {
    if (isPersistentKey(key)) {
      store.setSync(key, null);
    }
    originalRemoveItem(key);
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
