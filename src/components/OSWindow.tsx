import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Square, Maximize2, Minimize2, LayoutGrid } from 'lucide-react';
import { useOS, OSAppWindow } from '../hooks/useOS';
import { cn } from '../lib/utils';
import { APPS_CONFIG } from '../lib/apps';
import { useContextMenu, ContextMenuEntry } from './ContextMenu';
import { NeuroIcon } from './icons/NeuroIcon';

interface OSWindowProps {
  win: OSAppWindow;
  children: React.ReactNode;
}

export const OSWindow: React.FC<OSWindowProps> = ({ win: windowData, children }) => {
  const { closeWindow, focusWindow, updateWindow, minimizeWindow } = useOS();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    focusWindow(windowData.id);
    if (windowData.state === 'maximized') return;

    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - windowData.position.x,
      y: e.clientY - windowData.position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updateWindow(windowData.id, {
        position: {
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y,
        },
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, windowData.id, updateWindow]);

  const isMaximized = windowData.state === 'maximized';
  const isChatApp = windowData.component === 'chat';

  const titleBarCtx = useContextMenu(useCallback(() => [
    { label: 'Minimize', icon: Minimize2, action: () => minimizeWindow(windowData.id) },
    { label: isMaximized ? 'Restore' : 'Maximize', icon: Maximize2, action: () => updateWindow(windowData.id, { state: isMaximized ? 'normal' : 'maximized' }) },
    { type: 'divider' as const },
    { label: 'Close', icon: X, action: () => closeWindow(windowData.id), danger: true, shortcut: 'Alt+F4' },
  ], [windowData.id, isMaximized, minimizeWindow, updateWindow, closeWindow]));

  if (windowData.state === 'minimized') return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: isChatApp ? 0.88 : 0.95, y: isChatApp ? 0 : 10 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        top: isMaximized ? 0 : windowData.position.y,
        left: isMaximized ? 0 : windowData.position.x,
        width: isMaximized ? '100%' : windowData.size.width,
        height: isMaximized ? 'calc(100% - 48px)' : windowData.size.height,
      }}
      transition={{ type: 'spring', damping: isChatApp ? 22 : 25, stiffness: isChatApp ? 400 : 350, mass: 0.8 }}
      className={cn(
        "absolute bg-white flex flex-col overflow-hidden",
        windowData.isFocused
          ? `z-[100] shadow-2xl shadow-zinc-200/50 ring-1 ${isChatApp ? 'ring-sky-200' : 'ring-zinc-200'}`
          : "z-[10] shadow-md shadow-zinc-200/50 ring-1 ring-zinc-100",
        isMaximized ? "rounded-none" : "rounded-lg",
        "pointer-events-auto"
      )}
      style={{ zIndex: windowData.zIndex }}
      onMouseDown={() => focusWindow(windowData.id)}
    >
      {/* Title Bar */}
      <div
        className="h-10 bg-white border-b border-zinc-100 flex items-center justify-between px-3 cursor-default select-none shrink-0"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => updateWindow(windowData.id, { state: isMaximized ? 'normal' : 'maximized' })}
        {...titleBarCtx}
      >
        <div className="flex items-center gap-3">
          <span className={cn("flex items-center justify-center", isChatApp ? "text-sky-500" : "text-zinc-400")}>
            <NeuroIcon size={14} showTM={false} />
          </span>
          <span className="text-sm font-semibold text-zinc-800 tracking-tight">{windowData.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); minimizeWindow(windowData.id); }}
            className="w-6 h-6 flex items-center justify-center hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-700"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); updateWindow(windowData.id, { state: isMaximized ? 'normal' : 'maximized' }); }}
            className="w-6 h-6 flex items-center justify-center hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-700"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); closeWindow(windowData.id); }}
            className="w-6 h-6 flex items-center justify-center hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-full transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
        {children}
      </div>
    </motion.div>
  );
};
