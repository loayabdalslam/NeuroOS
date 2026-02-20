import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useOS, OSAppWindow } from '../hooks/useOS';
import { cn } from '../lib/utils';

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

  if (windowData.state === 'minimized') return null;

  const isMaximized = windowData.state === 'maximized';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        top: isMaximized ? 0 : windowData.position.y,
        left: isMaximized ? 0 : windowData.position.x,
        width: isMaximized ? '100%' : windowData.size.width,
        height: isMaximized ? 'calc(100% - 48px)' : windowData.size.height,
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        "absolute bg-white border border-black/10 shadow-2xl flex flex-col overflow-hidden",
        windowData.isFocused ? "z-[100]" : "z-[10]",
        isMaximized ? "rounded-none" : "rounded-xl"
      )}
      style={{ zIndex: windowData.zIndex }}
      onMouseDown={() => focusWindow(windowData.id)}
    >
      {/* Title Bar */}
      <div 
        className="h-10 bg-zinc-50 border-bottom border-black/5 flex items-center justify-between px-4 cursor-default select-none shrink-0"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => updateWindow(windowData.id, { state: isMaximized ? 'normal' : 'maximized' })}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{windowData.icon}</span>
          <span className="text-sm font-medium text-zinc-700">{windowData.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); minimizeWindow(windowData.id); }}
            className="p-1.5 hover:bg-black/5 rounded-md transition-colors"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); updateWindow(windowData.id, { state: isMaximized ? 'normal' : 'maximized' }); }}
            className="p-1.5 hover:bg-black/5 rounded-md transition-colors"
          >
            <Maximize2 size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); closeWindow(windowData.id); }}
            className="p-1.5 hover:bg-red-500 hover:text-white rounded-md transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white">
        {children}
      </div>
    </motion.div>
  );
};
