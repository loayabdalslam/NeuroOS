import {
    Terminal,
    Files,
    Bot,
    Cpu,
    Workflow,
    Settings,
    BrainCircuit,
    Eye,
    Layout,
    Globe,
    Zap,
    Music,
    Image,
    Network,
    LucideIcon
} from 'lucide-react';

export interface AppConfig {
    id: string;
    name: string;
    icon: LucideIcon;
    color: string;
}

export const APPS_CONFIG: Record<string, AppConfig> = {
    terminal: { id: 'terminal', name: 'Terminal', icon: Terminal, color: 'bg-zinc-900' },
    files: { id: 'files', name: 'Files', icon: Files, color: 'bg-blue-500' },
    chat: { id: 'chat', name: 'Neuro Chat', icon: BrainCircuit, color: 'bg-sky-500' },
    settings: { id: 'settings', name: 'Settings', icon: Settings, color: 'bg-zinc-400' },
    viewer: { id: 'viewer', name: 'File Viewer', icon: Eye, color: 'bg-violet-500' },
    board: { id: 'board', name: 'NeuroBoard', icon: Layout, color: 'bg-indigo-400' },
    browser: { id: 'browser', name: 'Browser', icon: Globe, color: 'bg-sky-400' },
    agents: { id: 'agents', name: 'Agent Studio', icon: Bot, color: 'bg-purple-500' },
    automation: { id: 'automation', name: 'Automation', icon: Workflow, color: 'bg-orange-500' },
    p2pchat: { id: 'p2pchat', name: 'P2P Chat', icon: Network, color: 'bg-green-500' },
    llmmanager: { id: 'llmmanager', name: 'LLM Manager', icon: Cpu, color: 'bg-red-500' },
    mcp: { id: 'mcp', name: 'MCP Connectors', icon: Zap, color: 'bg-yellow-500' },
    music: { id: 'music', name: 'Music', icon: Music, color: 'bg-pink-500' },
    media: { id: 'media', name: 'Media Viewer', icon: Image, color: 'bg-cyan-500' },
};
