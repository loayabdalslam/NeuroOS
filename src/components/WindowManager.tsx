import React from 'react';
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
};

export const WindowManager: React.FC = () => {
    const { appWindows } = useOS();

    return (
        <div className="absolute inset-0 z-10 pointer-events-none">
            {appWindows.map(windowData => {
                const Component = COMPONENT_REGISTRY[windowData.component] || (() => <div>App Not Found</div>);
                return (
                    <OSWindow key={windowData.id} win={windowData}>
                        <Component windowData={windowData} />
                    </OSWindow>
                );
            })}
        </div>
    );
};
