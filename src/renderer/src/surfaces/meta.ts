import type { SurfaceKind } from '@shared/types';

export interface SurfaceMeta {
  icon: string;
  labelKey: string;
  accent: string;
}

export const SURFACES: Record<SurfaceKind, SurfaceMeta> = {
  desktop: { icon: 'dashboard', labelKey: 'nav.desktop', accent: 'var(--n-accent)' },
  chat: { icon: 'message', labelKey: 'nav.chat', accent: '#5686fe' },
  workspace: { icon: 'files', labelKey: 'nav.workspace', accent: '#22c55e' },
  space: { icon: 'boxes', labelKey: 'nav.space', accent: '#a78bfa' },
  notebook: { icon: 'notebook-pen', labelKey: 'nav.notebook', accent: '#f59e0b' },
  browser: { icon: 'globe', labelKey: 'nav.browser', accent: '#14b8a6' },
  terminal: { icon: 'terminal', labelKey: 'nav.terminal', accent: '#e879f9' },
  mail: { icon: 'inbox', labelKey: 'nav.mail', accent: '#f472b6' },
  automation: { icon: 'workflow', labelKey: 'nav.automation', accent: '#fb7185' },
  composer: { icon: 'boxes', labelKey: 'nav.composer', accent: '#a78bfa' },
  marketplace: { icon: 'package', labelKey: 'nav.marketplace', accent: '#fb7185' },
  settings: { icon: 'settings', labelKey: 'nav.settings', accent: '#94a3b8' },
};

export const SURFACE_ORDER: SurfaceKind[] = [
  'desktop',
  'chat',
  'workspace',
  'space',
  'notebook',
  'browser',
  'terminal',
  'mail',
  'automation',
  'composer',
  'marketplace',
  'settings',
];
