import React from 'react';
import { useOS } from '../hooks/useOS';
import { cn } from '../lib/utils';
import { LayoutGrid, Search, Bell, Wifi, Battery } from 'lucide-react';
import { format } from 'date-fns';
import { AssistantChat } from './AssistantChat';

export const Taskbar: React.FC = () => {
  const { appWindows, openApp, toggleStartMenu, isStartMenuOpen, focusWindow } = useOS();
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-12 bg-white/80 backdrop-blur-md border-t border-black/5 flex items-center justify-between px-2 z-[9999] absolute bottom-0 left-0 right-0">
      <div className="flex items-center gap-1">
        <button 
          onClick={() => toggleStartMenu()}
          className={cn(
            "p-2 rounded-lg transition-all duration-200",
            isStartMenuOpen ? "bg-black text-white" : "hover:bg-black/5"
          )}
        >
          <LayoutGrid size={20} />
        </button>
        
        <div className="w-px h-6 bg-black/10 mx-1" />
        
        {/* Running Apps */}
        <div className="flex items-center gap-1">
          {appWindows.map(windowData => (
            <button
              key={windowData.id}
              onClick={() => focusWindow(windowData.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200 text-sm",
                windowData.isFocused ? "bg-zinc-100 border border-black/10 shadow-sm" : "hover:bg-black/5"
              )}
            >
              <span>{windowData.icon}</span>
              <span className="max-w-[100px] truncate font-medium">{windowData.title}</span>
              {windowData.isFocused && <div className="w-1 h-1 rounded-full bg-black ml-1" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex justify-center">
        <AssistantChat />
      </div>

      <div className="flex items-center gap-4 px-4">
        <div className="flex items-center gap-3 text-zinc-500">
          <Wifi size={16} />
          <Battery size={16} />
          <Bell size={16} />
        </div>
        <div className="flex flex-col items-end leading-none">
          <span className="text-xs font-semibold">{format(time, 'HH:mm')}</span>
          <span className="text-[10px] text-zinc-500">{format(time, 'MMM d, yyyy')}</span>
        </div>
      </div>
    </div>
  );
};
