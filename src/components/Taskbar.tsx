import React from 'react';
import { useOS } from '../hooks/useOS';
import { cn } from '../lib/utils';
import { LayoutGrid, Search, Bell, Wifi, Battery, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { APPS_CONFIG } from '../lib/apps';
import { NeuroIcon } from './icons/NeuroIcon';

const PINNED_APPS = ['chat', 'browser', 'board', 'files', 'terminal', 'settings'];

export const Taskbar: React.FC = () => {
  const { appWindows, openApp, toggleStartMenu, isStartMenuOpen, focusWindow, minimizeWindow } = useOS();
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute which apps to show on the taskbar
  const taskbarApps = React.useMemo(() => {
    // 1. Start with pinned apps
    const apps = PINNED_APPS.map(appId => {
      const runningInstance = appWindows.find(w => w.component === appId);
      return {
        id: appId,
        config: APPS_CONFIG[appId],
        instance: runningInstance,
        isPinned: true
      };
    });

    // 2. Add non-pinned running apps (e.g. viewer)
    appWindows.forEach(windowData => {
      if (!PINNED_APPS.includes(windowData.component)) {
        apps.push({
          id: windowData.id,
          config: APPS_CONFIG[windowData.component],
          instance: windowData,
          isPinned: false
        });
      }
    });

    return apps;
  }, [appWindows]);

  const handleAppClick = (app: any) => {
    if (app.instance) {
      // If already focused and visible, minimize it; otherwise focus it
      if (app.instance.isFocused && app.instance.state !== 'minimized') {
        minimizeWindow(app.instance.id);
      } else {
        focusWindow(app.instance.id);
      }
    } else {
      openApp(app.id, app.config?.name);
    }
  };

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[9999] bg-[color:var(--color-dock)] backdrop-blur-[var(--shell-blur)] min-h-[68px] w-auto rounded-[28px] border border-white/40 shadow-[var(--shell-shadow-strong)] flex items-center px-4 py-2 gap-4 transition-all duration-300 ease-spring">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => toggleStartMenu()}
          className={cn(
            "p-3 rounded-2xl transition-all duration-300 hover:bg-white/70 active:scale-90 group flex items-center justify-center",
            isStartMenuOpen ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20" : "text-zinc-900"
          )}
        >
          <NeuroIcon size={20} showTM={true} className={isStartMenuOpen ? "text-white" : "text-zinc-900"} />
        </button>

        <div className="w-px h-8 bg-zinc-200/60 mx-1.5" />

        {/* Taskbar Apps (Pinned + Running) */}
        <div className="flex items-center gap-1.5">
          {taskbarApps.map((app, idx) => {
            const Icon = app.config?.icon;
            const isRunning = !!app.instance;
            const isFocused = app.instance?.isFocused;

            return (
              <button
                key={app.instance?.id || app.id}
                onClick={() => handleAppClick(app)}
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative group",
                  isFocused
                    ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 scale-105"
                    : "text-zinc-600 hover:bg-white/70 hover:scale-105 active:scale-95"
                )}
                title={app.config?.name}
              >
                <div className={cn(
                  "transition-all duration-300",
                  isFocused ? "scale-110" : "group-hover:scale-110"
                )}>
                  {Icon ? <Icon size={20} /> : <span className="text-xs font-bold">{app.config?.name.charAt(0)}</span>}
                </div>

                {/* Running indicator dot */}
                {isRunning && !isFocused && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-zinc-400 group-hover:bg-zinc-600 transition-colors" />
                )}

                {/* Tooltip hint on hover (optional enhancement) */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 text-white text-[10px] font-bold rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl uppercase tracking-wider">
                  {app.config?.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div className="flex items-center gap-4 pl-3 border-l border-zinc-200/50">
        <div className="hidden md:flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-2 text-[11px] font-semibold text-zinc-500">
          <Sparkles size={12} className="text-sky-500" />
          Codex Ready
        </div>
        <div className="flex flex-col items-end leading-none cursor-default select-none">
          <span className="text-sm font-bold text-zinc-900 tracking-tight">{format(time, 'HH:mm')}</span>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{format(time, 'MMM d')}</span>
        </div>
        <div className="flex items-center gap-2.5 text-zinc-400">
          <Wifi size={14} className="text-zinc-800" strokeWidth={2.5} />
          <Battery size={14} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
};
