import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Reset state on dev start to show onboarding
if (import.meta.env.DEV) {
  if (!sessionStorage.getItem('neuro_dev_reset')) {
    localStorage.clear();
    sessionStorage.setItem('neuro_dev_reset', 'true');
    console.log("Neuro OS: Development mode detected. Persistent storage cleared for fresh onboarding.");
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
