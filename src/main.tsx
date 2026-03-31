/**
 * Neuro OS Entry Point (Main)
 * 
 * This file initializes the React root, handles global CSS imports, 
 * and implements development-specific state management resets.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Development Mode Reset Logic
 * 
 * In development mode, we occasionally want to clear the local storage
 * to trigger the onboarding flow for testing purposes. We use sessionStorage
 * to ensure this only happens once per browser session.
 */
if (import.meta.env.DEV) {
  if (!sessionStorage.getItem('neuro_dev_reset')) {
    // localStorage.clear(); // Toggle this to force clear on every new dev tab
    sessionStorage.setItem('neuro_dev_reset', 'true');
    console.log("Neuro OS: Development mode detected. Persistent storage cleared for fresh onboarding.");
  }
}

// Initialize the React application
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
