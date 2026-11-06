import type { RendererBridge } from '@shared/ipc';
import type React from 'react';

declare global {
  interface Window {
    neuro: RendererBridge;
    neuroPlatform: { platform: string; arch: string };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          allowpopups?: string;
          webpreferences?: string;
          useragent?: string;
        },
        HTMLElement
      >;
    }
  }

  interface HTMLElementTagNameMap {
    webview: Electron.WebviewTag;
  }
}

export {};
