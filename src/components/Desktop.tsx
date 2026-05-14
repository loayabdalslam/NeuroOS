import React, { useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useOS } from '../hooks/useOS';
import { useContextMenu } from './ContextMenu';
import { RefreshCw, Image, Settings, Info, Monitor, FolderOpen } from 'lucide-react';
import { DesktopIcons } from './DesktopIcons';
import { NotificationCenter } from './NotificationCenter';
import { DesktopWidgets } from './DesktopWidgets';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useFileSystem } from '../hooks/useFileSystem';
import { useAuthStore } from '../stores/authStore';
import backgroundPng from '../assets/Background.png';


interface DesktopProps {
  children?: React.ReactNode;
}

export const Desktop: React.FC<DesktopProps> = ({ children }) => {
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const { openApp } = useOS();
  const { workspacePath } = useWorkspaceStore();
  const { copyFile, writeFile } = useFileSystem();
  const { users, activeUserId } = useAuthStore();
  const activeUser = users.find(u => u.id === activeUserId);

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
          className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-in-out scale-[1.02]"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-in-out scale-[1.02]"
          style={{ backgroundImage: `url(${backgroundPng})` }}
        />
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_35%,rgba(15,23,42,0.18))]" />

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
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={async (e) => {
          e.preventDefault();
          if (!workspacePath) return;

          const desktopDir = `${workspacePath}/desktop`;

          // Handle AI Session drop
          const aiData = e.dataTransfer.getData('neuro/ai');
          if (aiData) {
            const { title, messages } = JSON.parse(aiData);
            const fileName = `AI Session ${new Date().toLocaleTimeString().replace(/:/g, '-')}.ai`;
            await writeFile(`${desktopDir}/${fileName}`, JSON.stringify({ title, messages, user: activeUser?.name }));
            return;
          }

          // Handle File drop
          const fileData = e.dataTransfer.getData('neuro/file');
          if (fileData) {
            const { name, path } = JSON.parse(fileData);
            await copyFile(path, `${desktopDir}/${name}`);
            return;
          }
        }}
      >
        <DesktopIcons />
        <DesktopWidgets />
        <NotificationCenter />
        {children}
      </div>
    </div>
  );
};
