import React from 'react';
import {
    TerminalIcon,
    FilesIcon,
    ChatIcon,
    SettingsIcon,
    ViewerIcon,
    BoardIcon,
    BrowserIcon,
    MediaIcon,
    TasksIcon,
    NeuroAppsIcon,
    LLMIcon,
    MCPIcon,
    IntegrationsIcon
} from '../components/icons/AppIcons';

export interface AppConfig {
    id: string;
    name: string;
    icon: React.FC<{ className?: string; size?: number }>;
    color: string;
    description?: string;
    showOnDesktop?: boolean;
}

export const APPS_CONFIG: Record<string, AppConfig> = {
    terminal: { id: 'terminal', name: 'Terminal', icon: TerminalIcon, color: 'bg-zinc-900', description: 'Command line interface' },
    files: { id: 'files', name: 'Files', icon: FilesIcon, color: 'bg-blue-500', description: 'File explorer' },
    chat: { id: 'chat', name: 'Neuro Chat', icon: ChatIcon, color: 'bg-sky-500', description: 'AI assistant' },
    settings: { id: 'settings', name: 'Settings', icon: SettingsIcon, color: 'bg-zinc-400', description: 'System preferences' },
    viewer: { id: 'viewer', name: 'File Viewer', icon: ViewerIcon, color: 'bg-violet-500', description: 'View file contents' },
    board: { id: 'board', name: 'NeuroBoard', icon: BoardIcon, color: 'bg-indigo-400', description: 'Dashboard & widgets' },
    browser: { id: 'browser', name: 'Browser', icon: BrowserIcon, color: 'bg-sky-400', description: 'Web browser' },
    media: { id: 'media', name: 'Media Viewer', icon: MediaIcon, color: 'bg-cyan-500', description: 'View images & video' },
    tasks: { id: 'tasks', name: 'Tasks', icon: TasksIcon, color: 'bg-emerald-500', description: 'Task management' },
    neuroapps: { id: 'neuroapps', name: 'NeuroApps', icon: NeuroAppsIcon, color: 'bg-gradient-to-br from-emerald-500 to-cyan-500', description: 'Build & run AI apps' },
    llmmanager: { id: 'llmmanager', name: 'LLM Manager', icon: LLMIcon, color: 'bg-purple-500', description: 'Manage AI providers' },
    mcp: { id: 'mcp', name: 'MCP Connectors', icon: MCPIcon, color: 'bg-amber-500', description: 'Model Context Protocol' },
    integrations: { id: 'integrations', name: 'Integrations', icon: IntegrationsIcon, color: 'bg-rose-500', description: 'External integrations' },
};

// Apps that should show on desktop
export const DESKTOP_APPS = [
    'files', 'chat', 'terminal', 'settings', 'board', 'neuroapps', 'llmmanager', 'tasks', 'browser'
];
