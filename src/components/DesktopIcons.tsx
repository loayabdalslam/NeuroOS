import React, { useState, useEffect, useCallback } from 'react';
import { useFileSystem } from '../hooks/useFileSystem';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useOS } from '../hooks/useOS';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
    Folder, File, FileCode, FileText, FileImage,
    Music, Video, Archive, BrainCircuit
} from 'lucide-react';
import { NeuroIcon } from './icons/NeuroIcon';
import { APPS_CONFIG, DESKTOP_APPS } from '../lib/apps';

interface DesktopFile {
    name: string;
    path: string;
    isDirectory: boolean;
    isApp?: boolean;
    appId?: string;
}

const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) return { Icon: Folder, color: 'text-sky-500' };
    if (name.endsWith('.ai')) return { Icon: BrainCircuit, color: 'text-sky-600' };

    const ext = name.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, { Icon: any; color: string }> = {
        ts: { Icon: FileCode, color: 'text-blue-500' },
        tsx: { Icon: FileCode, color: 'text-sky-500' },
        js: { Icon: FileCode, color: 'text-yellow-500' },
        json: { Icon: FileCode, color: 'text-green-500' },
        md: { Icon: FileText, color: 'text-zinc-500' },
        txt: { Icon: FileText, color: 'text-zinc-400' },
        png: { Icon: FileImage, color: 'text-pink-400' },
        jpg: { Icon: FileImage, color: 'text-pink-400' },
        svg: { Icon: FileImage, color: 'text-orange-400' },
    };
    return iconMap[ext] || { Icon: File, color: 'text-zinc-400' };
};

// System App Icon component
const SystemAppIcon: React.FC<{ appId: string }> = ({ appId }) => {
    const config = APPS_CONFIG[appId];
    if (!config) return null;
    const Icon = config.icon;
    return (
        <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-100")}>
            <Icon size={24} className={config.color.includes('bg-gradient') ? 'text-white' : 'text-white'} />
        </div>
    );
};

export const DesktopIcons: React.FC = () => {
    const { listFiles, isElectron, createDir, statFile } = useFileSystem();
    const { workspacePath } = useWorkspaceStore();
    const { openApp, sendAppAction } = useOS();
    const [icons, setIcons] = useState<DesktopFile[]>([]);
    const [loading, setLoading] = useState(false);

    const desktopPath = workspacePath ? `${workspacePath}/desktop` : '';

    const refresh = useCallback(async () => {
        if (!desktopPath || !isElectron) return;
        setLoading(true);
        try {
            try {
                const entries = await listFiles(desktopPath);
                setIcons(entries.map((e: any) => ({
                    name: e.name,
                    path: e.path,
                    isDirectory: e.isDirectory
                })));
            } catch (e: any) {
                if (e.message?.includes('ENOENT') || e.code === 'ENOENT') {
                    await createDir(desktopPath);
                    setIcons([]);
                } else {
                    throw e;
                }
            }
        } catch (e) {
            // Silent fail
        } finally {
            setLoading(false);
        }
    }, [desktopPath, isElectron, listFiles, createDir]);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleOpen = (file: DesktopFile) => {
        if (file.isApp && file.appId) {
            openApp(file.appId);
        } else if (file.name.endsWith('.ai')) {
            openApp('chat', file.name);
            setTimeout(() => {
                const chatWin = useOS.getState().appWindows.filter(w => w.component === 'chat').pop();
                if (chatWin) {
                    sendAppAction(chatWin.id, 'open_file', { path: file.path, name: file.name });
                }
            }, 100);
        } else if (file.isDirectory) {
            openApp('files');
        } else {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const mediaExts = ['png','jpg','jpeg','gif','webp','svg','bmp','ico','avif','mp4','webm','avi','mov','mkv','wmv','ogv','mp3','wav','ogg','flac','aac','m4a','wma'];
            const appType = mediaExts.includes(ext) ? 'media' : 'viewer';
            openApp(appType, file.name);
            setTimeout(() => {
                const win = useOS.getState().appWindows.filter(w => w.component === appType).pop();
                if (win) {
                    sendAppAction(win.id, 'open_file', { path: file.path, name: file.name });
                }
            }, 100);
        }
    };

    // Combine system apps with files
    const systemApps: DesktopFile[] = DESKTOP_APPS.map(appId => ({
        name: APPS_CONFIG[appId]?.name || appId,
        path: `system://${appId}`,
        isDirectory: false,
        isApp: true,
        appId
    }));

    const allIcons = [...systemApps, ...icons];

    return (
        <div className="absolute top-0 left-0 p-6 flex flex-col flex-wrap h-[calc(100vh-100px)] w-fit gap-2 content-start pointer-events-none">
            <AnimatePresence mode="popLayout">
                {allIcons.map((icon) => {
                    if (icon.isApp && icon.appId) {
                        const config = APPS_CONFIG[icon.appId];
                        const Icon = config?.icon || NeuroIcon;
                        return (
                            <motion.div
                                key={icon.appId}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="w-24 p-2 flex flex-col items-center gap-1.5 rounded-xl hover:bg-black/5 cursor-pointer group pointer-events-auto select-none"
                                onDoubleClick={() => handleOpen(icon)}
                            >
                                <div className={cn(
                                    "w-14 h-14 flex items-center justify-center rounded-2xl shadow-sm border border-zinc-100/50 group-hover:shadow-lg transition-all",
                                    config?.color || 'bg-zinc-500'
                                )}>
                                    <Icon size={28} className="text-white" />
                                </div>
                                <span className="text-[11px] font-medium text-white text-center line-clamp-2 drop-shadow-md px-1 leading-tight">
                                    {icon.name}
                                </span>
                            </motion.div>
                        );
                    }

                    const { Icon, color } = getFileIcon(icon.name, icon.isDirectory);
                    return (
                        <motion.div
                            key={icon.path}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="w-24 p-2 flex flex-col items-center gap-1 rounded-xl hover:bg-black/5 cursor-pointer group pointer-events-auto select-none"
                            onDoubleClick={() => handleOpen(icon)}
                        >
                            <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-100 group-hover:shadow-md transition-all", color)}>
                                <span className="text-lg font-bold uppercase">{icon.name.charAt(0)}</span>
                            </div>
                            <span className="text-[11px] font-medium text-white text-center line-clamp-2 drop-shadow-md px-1 leading-tight">
                                {icon.name.replace('.ai', '')}
                            </span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};