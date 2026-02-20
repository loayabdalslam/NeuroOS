import React, { useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useOS } from '../hooks/useOS';
import { useContextMenu } from './ContextMenu';
import { RefreshCw, Image, Settings, Info, Monitor, FolderOpen } from 'lucide-react';


interface DesktopProps {
  children?: React.ReactNode;
}

export const Desktop: React.FC<DesktopProps> = ({ children }) => {
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const { openApp } = useOS();

  const desktopCtx = useContextMenu(useCallback(() => [
    { label: 'Refresh', icon: RefreshCw, action: () => window.location.reload(), shortcut: 'F5' },
    { type: 'divider' as const },
    { label: 'Open File Explorer', icon: FolderOpen, action: () => openApp('files') },
    { label: 'Display Settings', icon: Monitor, action: () => openApp('settings') },
    { type: 'divider' as const },
    { label: 'About NeuroOS', icon: Info, action: () => openApp('settings') },
  ], [openApp]));

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-50 pointer-events-none">
      {/* Background Layer */}
      {wallpaper ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-in-out"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-in-out"
          style={{ backgroundImage: `url('/Background.png')` }}
        />
      )}

      {/* Dot Pattern */}
      {!wallpaper && (
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
      )}

      {/* Desktop surface (right-click target) */}
      <div
        className="absolute inset-0 z-10 p-6 pointer-events-auto"
        {...desktopCtx}
      >
        {children}
      </div>
    </div>
  );
};
