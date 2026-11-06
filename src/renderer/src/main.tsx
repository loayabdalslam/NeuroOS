import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/chat.css';
import './styles/workspace.css';
import './styles/desktop.css';
import './styles/settings.css';
import './styles/onboarding.css';
import './styles/os.css';
import './styles/composio.css';
import './styles/sites.css';
import './styles/audit.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Neuro OS renderer crashed', error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="boot">
          <div className="boot__word display">Renderer error</div>
          <div className="boot__hint mono" style={{ maxWidth: 620, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </div>
          <button type="button" className="n-btn n-btn--outline" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);


