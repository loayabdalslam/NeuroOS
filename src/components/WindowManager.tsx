import React from 'react';
import { useOS } from '../hooks/useOS';
import { OSWindow } from './OSWindow';
import { NeuroIcon } from './icons/NeuroIcon';
import { TerminalApp } from '../apps/Terminal';
import { SettingsApp } from '../apps/Settings';
import { FileExplorer } from '../apps/FileExplorer';
import { ChatApp } from '../apps/Chat';
import { FileViewer } from '../apps/FileViewer';
import { BoardApp } from '../apps/Board';
import { BrowserApp } from '../apps/Browser';

// Component Registry
const COMPONENT_REGISTRY: Record<string, React.FC<any>> = {
    terminal: TerminalApp,
    files: FileExplorer,
    chat: ChatApp,
    settings: SettingsApp,
    viewer: FileViewer,
    board: BoardApp,
    browser: BrowserApp,
};

const AppNotFound: React.FC<{ windowData?: any }> = () => (
    <div className="flex flex-col items-center justify-center h-full text-zinc-300 gap-4">
        <NeuroIcon size={48} showTM={false} className="opacity-20" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-40">App Not Found</p>
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
