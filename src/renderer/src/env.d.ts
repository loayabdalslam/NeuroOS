import type { RendererBridge } from '@shared/ipc';

declare global {
  interface Window {
    neuro: RendererBridge;
    neuroPlatform: { platform: string; arch: string };
  }
}

export {};
