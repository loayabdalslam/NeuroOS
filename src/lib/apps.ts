import React from 'react';
import {
    TerminalIcon,
    FilesIcon,
    ChatIcon,
    SettingsIcon,
    ViewerIcon,
    BoardIcon,
    BrowserIcon,
    LLMIcon,
    MusicIcon,
    MediaIcon
} from '../components/icons/AppIcons';

export interface AppConfig {
    id: string;
    name: string;
    icon: React.FC<{ className?: string; size?: number }>;
    color: string;
    description?: string;
}

export const APPS_CONFIG: Record<string, AppConfig> = {
    terminal: { id: 'terminal', name: 'Terminal', icon: TerminalIcon, color: 'bg-zinc-900' },
    files: { id: 'files', name: 'Files', icon: FilesIcon, color: 'bg-blue-500' },
    chat: { id: 'chat', name: 'Neuro Chat', icon: ChatIcon, color: 'bg-sky-500' },
    settings: { id: 'settings', name: 'Settings', icon: SettingsIcon, color: 'bg-zinc-400' },
    viewer: { id: 'viewer', name: 'File Viewer', icon: ViewerIcon, color: 'bg-violet-500' },
    board: { id: 'board', name: 'NeuroBoard', icon: BoardIcon, color: 'bg-indigo-400' },
    browser: { id: 'browser', name: 'Browser', icon: BrowserIcon, color: 'bg-sky-400' },
    llmmanager: { id: 'llmmanager', name: 'LLM Manager', icon: LLMIcon, color: 'bg-red-500' },
    music: { id: 'music', name: 'Music', icon: MusicIcon, color: 'bg-pink-500' },
    media: { id: 'media', name: 'Media Viewer', icon: MediaIcon, color: 'bg-cyan-500' },
};
