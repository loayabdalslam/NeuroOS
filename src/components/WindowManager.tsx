import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useOS } from '../hooks/useOS';
import { OSWindow } from './OSWindow';
import { TerminalApp } from '../apps/Terminal';
import { AgentStudio } from '../apps/AgentStudio';
import { SettingsApp } from '../apps/Settings';
import { FileExplorer } from '../apps/FileExplorer';
import { LLMManager } from '../apps/LLMManager';
import { MCPConnectors } from '../apps/MCPConnectors';
import { AutomationEngine } from '../apps/AutomationEngine';
import { ChatApp } from '../apps/Chat';
import { FileViewer } from '../apps/FileViewer';
import { BoardApp } from '../apps/Board';

// Component Registry
const COMPONENT_REGISTRY: Record<string, React.FC<any>> = {
    terminal: TerminalApp,
    agents: AgentStudio,
    settings: SettingsApp,
    files: FileExplorer,
    llm: LLMManager,
    automation: AutomationEngine,
    mcp: MCPConnectors,
    chat: ChatApp,
    viewer: FileViewer,
    board: BoardApp,
};

const AppNotFound: React.FC<{ windowData?: any }> = () => (
    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
        <LayoutGrid size={48} strokeWidth={1} />
        <p className="text-sm font-medium">App Not Found</p>
    </div>
);

export const WindowManager: React.FC = () => {
    const { appWindows } = useOS();

    return (
        <div className="absolute inset-0 z-10 pointer-events-none">
            {appWindows.map(windowData => {
                const Component = COMPONENT_REGISTRY[windowData.component] || AppNotFound;
                return (
                    <OSWindow key={windowData.id} win={windowData}>
                        <Component windowData={windowData} />
                    </OSWindow>
                );
            })}
        </div>
    );
};
