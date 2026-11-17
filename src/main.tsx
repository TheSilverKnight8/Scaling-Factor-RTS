import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/archivo';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App';

// Installs the service worker. New versions activate on the next app launch.
if (!import.meta.env.DEV) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
