import React from 'react';
import { useOS } from './hooks/useOS';
import { Taskbar } from './components/Taskbar';
import { StartMenu } from './components/StartMenu';
import { OSWindow } from './components/OSWindow';
import { TerminalApp } from './apps/Terminal';
import { AgentStudio } from './apps/AgentStudio';
import { SettingsApp } from './apps/Settings';
import { FileExplorer } from './apps/FileExplorer';
import { LLMManager } from './apps/LLMManager';
import { MCPConnectors } from './apps/MCPConnectors';
import { AutomationEngine } from './apps/AutomationEngine';
import { motion } from 'motion/react';

// Component Registry
const COMPONENT_REGISTRY: Record<string, React.FC<any>> = {
  terminal: TerminalApp,
  agents: AgentStudio,
  settings: SettingsApp,
  files: FileExplorer,
  llm: LLMManager,
  automation: AutomationEngine,
  mcp: MCPConnectors,
};

export default function App() {
  const { appWindows } = useOS();

  return (
    <div className="h-screen w-screen bg-[#F5F5F5] overflow-hidden relative font-sans text-zinc-900 selection:bg-black selection:text-white">
      {/* Desktop Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[40vw] h-[40vw] bg-indigo-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[20%] w-[30vw] h-[30vw] bg-emerald-200/20 blur-[100px] rounded-full" />
      </div>

      {/* Desktop Icons (Optional) */}
      <div className="absolute inset-0 p-6 grid grid-flow-col grid-rows-6 gap-4 w-fit">
        {/* We could add desktop icons here if needed */}
      </div>

      {/* Windows Layer */}
      <div className="absolute inset-0 z-10">
        {appWindows.map(windowData => {
          const Component = COMPONENT_REGISTRY[windowData.component] || (() => <div>App Not Found</div>);
          return (
            <OSWindow key={windowData.id} win={windowData}>
              <Component windowData={windowData} />
            </OSWindow>
          );
        })}
      </div>

      {/* UI Shell */}
      <StartMenu />
      <Taskbar />

      {/* Boot Overlay (Optional) */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1, delay: 1 }}
        onAnimationComplete={(definition) => {
          // Hide boot screen
        }}
        className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center pointer-events-none"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-white flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-white rounded-xl flex items-center justify-center font-bold text-2xl">N</div>
          <span className="text-sm font-bold tracking-[0.2em] uppercase">NeuroOS</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
