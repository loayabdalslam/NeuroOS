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

interface DesktopFile {
    name: string;
    path: string;
    isDirectory: boolean;
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
            // Ensure desktop folder exists
            const exists = await statFile(desktopPath);
            if (!exists) {
                await createDir(desktopPath);
            }

            const entries = await listFiles(desktopPath);
            setIcons(entries.map((e: any) => ({
                name: e.name,
                path: e.path,
                isDirectory: e.isDirectory
            })));
        } catch (e) {
            console.error('Failed to load desktop icons', e);
        } finally {
            setLoading(false);
        }
    }, [desktopPath, isElectron, listFiles, createDir, statFile]);

    useEffect(() => {
        refresh();
        // Set up an interval to refresh desktop icons every 5 seconds for basic "sync"
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleOpen = (file: DesktopFile) => {
        if (file.name.endsWith('.ai')) {
            openApp('chat', file.name);
            setTimeout(() => {
                const chatWin = useOS.getState().appWindows.filter(w => w.component === 'chat').pop();
                if (chatWin) {
                    sendAppAction(chatWin.id, 'open_file', { path: file.path, name: file.name });
                }
            }, 100);
        } else if (file.isDirectory) {
            openApp('files');
            // Additional logic to navigate File Explorer could go here
        } else {
            openApp('viewer', file.name);
            setTimeout(() => {
                const viewerWin = useOS.getState().appWindows.filter(w => w.component === 'viewer').pop();
                if (viewerWin) {
                    sendAppAction(viewerWin.id, 'open_file', { path: file.path, name: file.name });
                }
            }, 100);
        }
    };

    return (
        <div className="absolute top-0 left-0 p-6 flex flex-col flex-wrap h-[calc(100vh-100px)] w-fit gap-2 content-start pointer-events-none">
            <AnimatePresence mode="popLayout">
                {icons.map((icon) => {
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
                                <Icon size={28} strokeWidth={1.5} />
                            </div>
                            <span className="text-[11px] font-medium text-zinc-900 text-center line-clamp-2 drop-shadow-sm px-1 leading-tight">
                                {icon.name.replace('.ai', '')}
                            </span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
