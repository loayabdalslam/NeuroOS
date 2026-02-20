import {
    Terminal,
    Files,
    Bot,
    Cpu,
    Workflow,
    Database,
    Settings,
    BrainCircuit,
    Eye,
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
    agents: { id: 'agents', name: 'Agent Studio', icon: Bot, color: 'bg-indigo-500' },
    chat: { id: 'chat', name: 'Neuro Chat', icon: BrainCircuit, color: 'bg-sky-500' },
    llm: { id: 'llm', name: 'LLM Manager', icon: Cpu, color: 'bg-emerald-500' },
    automation: { id: 'automation', name: 'Automation', icon: Workflow, color: 'bg-amber-500' },
    mcp: { id: 'mcp', name: 'MCP Connectors', icon: Database, color: 'bg-rose-500' },
    settings: { id: 'settings', name: 'Settings', icon: Settings, color: 'bg-zinc-400' },
    viewer: { id: 'viewer', name: 'File Viewer', icon: Eye, color: 'bg-violet-500' },
};
