import type { SurfaceKind } from './types';

/** The application registry used by the desktop, start menu and window manager. */
export interface AppDef {
  id: string;
  name: string;
  icon: string;
  accent: string;
  surface?: SurfaceKind;
  description: string;
  width: number;
  height: number;
  resizable?: boolean;
  singleton?: boolean;
  minWidth?: number;
  minHeight?: number;
}

export const OS_APPS: AppDef[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: 'dashboard',
    accent: '#5686fe',
    description: 'System health, conversations and live widgets',
    width: 1060,
    height: 700,
    minWidth: 720,
    minHeight: 480,
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: 'message',
    accent: '#5686fe',
    surface: 'chat',
    description: 'Talk to Neuro, approve tools, run the agent',
    width: 1020,
    height: 700,
    minWidth: 720,
    minHeight: 480,
  },
  {
    id: 'workspace',
    name: 'Files',
    icon: 'files',
    accent: '#22c55e',
    surface: 'workspace',
    description: 'Browse and edit workspace files',
    width: 1120,
    height: 720,
    minWidth: 720,
    minHeight: 460,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: 'terminal',
    accent: '#e879f9',
    surface: 'terminal',
    description: 'A real ConPTY PowerShell session',
    width: 900,
    height: 560,
    minWidth: 520,
    minHeight: 320,
  },
  {
    id: 'browser',
    name: 'Browser',
    icon: 'globe',
    accent: '#14b8a6',
    surface: 'browser',
    description: 'Chromium surface the agent can drive',
    width: 1080,
    height: 720,
    minWidth: 620,
    minHeight: 420,
  },
  {
    id: 'notebook',
    name: 'Notebook',
    icon: 'notebook-pen',
    accent: '#f59e0b',
    surface: 'notebook',
    description: 'Live code cells and analysis',
    width: 980,
    height: 700,
    minWidth: 640,
    minHeight: 420,
  },
  {
    id: 'mail',
    name: 'Mail',
    icon: 'inbox',
    accent: '#f472b6',
    surface: 'mail',
    description: 'Decentralized, serverless, end-to-end encrypted mail',
    width: 1040,
    height: 700,
    minWidth: 720,
    minHeight: 460,
  },
  {
    id: 'automation',
    name: 'Automation',
    icon: 'workflow',
    accent: '#fb7185',
    surface: 'automation',
    description: 'n8n-style workflows over agents, tools and mail',
    width: 1180,
    height: 740,
    minWidth: 820,
    minHeight: 520,
  },
  {
    id: 'composer',
    name: 'Composer',
    icon: 'boxes',
    accent: '#a78bfa',
    surface: 'composer',
    description: 'Chain agents into a composition',
    width: 1040,
    height: 700,
    minWidth: 720,
    minHeight: 460,
  },
  {
    id: 'spaces',
    name: 'Spaces',
    icon: 'layers',
    accent: '#a78bfa',
    surface: 'space',
    description: 'Context that outlives a conversation',
    width: 1040,
    height: 700,
    minWidth: 720,
    minHeight: 460,
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    icon: 'package',
    accent: '#fb7185',
    surface: 'marketplace',
    description: 'Skills, plugins, agents and themes',
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 480,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    accent: '#94a3b8',
    surface: 'settings',
    description: 'Every knob in the OS',
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 480,
  },
];

export const appById = (id: string): AppDef | undefined => OS_APPS.find((app) => app.id === id);
