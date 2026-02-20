import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { OSAppWindow } from '../hooks/useOS';

interface TerminalProps {
  windowData?: OSAppWindow;
}

export const TerminalApp: React.FC<TerminalProps> = ({ windowData }) => {
  const [history, setHistory] = useState<string[]>(['NeuroOS Kernel v1.0.0 initialized.', 'Type "help" for a list of commands.']);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (windowData?.lastAction && windowData.lastAction.type === 'execute_command') {
      handleCommand(windowData.lastAction.payload);
    }
  }, [windowData?.lastAction]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = (cmd: string) => {
    const newHistory = [...history, `neuro@os:~$ ${cmd}`];
    
    switch (cmd.trim().toLowerCase()) {
      case 'help':
        newHistory.push('Available commands: help, clear, ls, whoami, date, agent --run, neuro --status');
        break;
      case 'clear':
        setHistory([]);
        return;
      case 'ls':
        newHistory.push('Documents/  Downloads/  Apps/  Agents/  system.config');
        break;
      case 'whoami':
        newHistory.push('neuro_user (Administrator)');
        break;
      case 'date':
        newHistory.push(new Date().toString());
        break;
      case 'neuro --status':
        newHistory.push('System: Online');
        newHistory.push('Uptime: 14m 22s');
        newHistory.push('Memory: 4.2GB / 16GB');
        newHistory.push('Agents: 3 Active');
        break;
      default:
        if (cmd.startsWith('agent')) {
          newHistory.push('Starting agent orchestration engine...');
          setTimeout(() => {
            setHistory(prev => [...prev, 'Agent "NeuroCore" is now listening.']);
          }, 500);
        } else {
          newHistory.push(`Command not found: ${cmd}`);
        }
    }
    setHistory(newHistory);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 font-mono text-sm p-4">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1">
        {history.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">{line}</div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 border-t border-white/10 pt-2">
        <span className="text-emerald-400 font-bold">neuro@os:~$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommand(input);
              setInput('');
            }
          }}
          className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0"
          autoFocus
        />
      </div>
    </div>
  );
};
