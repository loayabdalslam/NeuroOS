import React from 'react';
import { useOS } from '../hooks/useOS';
import { cn } from '../lib/utils';
import { LayoutGrid, Search, Bell, Wifi, Battery } from 'lucide-react';
import { format } from 'date-fns';
import { APPS_CONFIG } from '../lib/apps';
import { NeuroIcon } from './icons/NeuroIcon';

export const Taskbar: React.FC = () => {
  const { appWindows, openApp, toggleStartMenu, isStartMenuOpen, focusWindow } = useOS();
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-white h-14 w-auto rounded-full ring-1 ring-zinc-200 shadow-xl shadow-zinc-200/50 flex items-center px-4 gap-6 transition-all duration-300 ease-spring">
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleStartMenu()}
          className={cn(
            "p-2.5 rounded-full transition-all duration-200 hover:bg-zinc-100 active:scale-95 group flex items-center justify-center",
            isStartMenuOpen ? "bg-zinc-900 text-white hover:bg-zinc-800" : "text-zinc-900"
          )}
        >
          <NeuroIcon size={20} showTM={true} className={isStartMenuOpen ? "text-white" : "text-zinc-900"} />
        </button>

        <div className="w-px h-6 bg-zinc-100 mx-2" />

        {/* Running Apps */}
        <div className="flex items-center gap-2">
          {appWindows.map(windowData => {
            const appConfig = APPS_CONFIG[windowData.component];
            const Icon = appConfig?.icon || LayoutGrid; // Fallback

            return (
              <button
                key={windowData.id}
                onClick={() => focusWindow(windowData.id)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 relative group",
                  windowData.isFocused ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200 shadow-sm custom-spring-bounce" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                )}
              >
                <Icon size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                {windowData.isFocused && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-zinc-900" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div className="flex items-center gap-5 pl-4 border-l border-zinc-100">
        <div className="flex flex-col items-end leading-none">
          <span className="text-sm font-semibold text-zinc-900">{format(time, 'HH:mm')}</span>
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{format(time, 'MMM d')}</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-400">
          <Wifi size={16} className="text-zinc-800" />
          <Battery size={16} />
        </div>
      </div>
    </div>
  );
};
