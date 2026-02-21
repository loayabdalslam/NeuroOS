import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { FileViewer } from '../FileViewer';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { OSAppWindow, useOS } from '../../hooks/useOS';
import {
    Folder, FileText, ArrowLeft, HardDrive, Upload, Plus,
    Trash2, RefreshCw, X, Check, FolderOpen, Edit3,
    File, FileCode, FileImage, Music, Video, Archive,
    ChevronRight, Home, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { showContextMenu, ContextMenuEntry } from '../../components/ContextMenu';
import { Copy, ClipboardPaste, FilePlus, FolderPlus } from 'lucide-react';

interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
    ext?: string;
}

// Get icon based on file extension
const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) return { Icon: Folder, color: 'text-sky-500' };
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, { Icon: any; color: string }> = {
        ts: { Icon: FileCode, color: 'text-blue-500' },
        tsx: { Icon: FileCode, color: 'text-sky-500' },
        js: { Icon: FileCode, color: 'text-yellow-500' },
        jsx: { Icon: FileCode, color: 'text-yellow-400' },
        json: { Icon: FileCode, color: 'text-green-500' },
        py: { Icon: FileCode, color: 'text-blue-400' },
        md: { Icon: FileText, color: 'text-zinc-500' },
        txt: { Icon: FileText, color: 'text-zinc-400' },
        png: { Icon: FileImage, color: 'text-pink-400' },
        jpg: { Icon: FileImage, color: 'text-pink-400' },
        jpeg: { Icon: FileImage, color: 'text-pink-400' },
        svg: { Icon: FileImage, color: 'text-orange-400' },
        mp3: { Icon: Music, color: 'text-purple-400' },
        mp4: { Icon: Video, color: 'text-red-400' },
        zip: { Icon: Archive, color: 'text-amber-500' },
        css: { Icon: FileCode, color: 'text-rose-400' },
        html: { Icon: FileCode, color: 'text-orange-500' },
    };
    return iconMap[ext] || { Icon: File, color: 'text-zinc-400' };
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

interface FileExplorerProps {
    windowData?: OSAppWindow;
}

// Refactored single-file implementation: small helper components below keep behavior unchanged
export const FileExplorer: React.FC<FileExplorerProps> = ({ windowData }) => {
    const { isElectron, listFiles, selectDirectory, selectFiles, deleteFile, copyFile, writeFile, createDir, renameFile } = useFileSystem();
    const { workspacePath, setWorkspace } = useWorkspaceStore();
    const { openApp, sendAppAction } = useOS();

    const [currentPath, setCurrentPath] = useState<string>('');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
    const [previewPath, setPreviewPath] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const openFileInViewer = useCallback((filePath: string, fileName: string) => {
        openApp('viewer', fileName);
        setTimeout(() => {
            const all = useOS.getState().appWindows;
            const viewer = all.filter(w => w.component === 'viewer').pop();
            if (viewer) sendAppAction(viewer.id, 'open_file', { path: filePath, name: fileName });
        }, 50);
    }, [openApp, sendAppAction]);

    const refresh = useCallback(async (p?: string) => {
        const target = p ?? currentPath;
        if (!target) return;
        setLoading(true);
        try {
            const entries = await listFiles(target);
            setFiles(entries.map((e: FileEntry) => ({ ...e, ext: e.name.split('.').pop() })));
        } catch (err) {
            console.error('listFiles failed', err);
        } finally {
            setLoading(false);
        }
    }, [currentPath, listFiles]);

    useEffect(() => {
        if (workspacePath && isElectron) navigateTo(workspacePath);
    }, [workspacePath, isElectron]);

    const navigateTo = async (p: string) => {
        setLoading(true);
        setSelectedFile(null);
        try {
            const entries = await listFiles(p);
            setFiles(entries.map((e: FileEntry) => ({ ...e, ext: e.name.split('.').pop() })));
            if (currentPath) setHistory(prev => [...prev, currentPath]);
            setCurrentPath(p);
        } catch (err) {
            console.error('navigate failed', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectWorkspace = async () => {
        const p = await selectDirectory();
        if (p) {
            setWorkspace(p);
            navigateTo(p);
            showToast('Workspace set!');
        }
    };

    const handleBack = () => {
        const prev = history[history.length - 1];
        if (prev) {
            setHistory(h => h.slice(0, -1));
            navigateTo(prev);
        }
    };

    const handleUpload = async () => {
        if (!currentPath) return;
        const filePaths = await selectFiles();
        for (const fp of filePaths) {
            const name = fp.split(/[\\/]/).pop()!;
            await copyFile(fp, `${currentPath}/${name}`);
        }
        if (filePaths.length) {
            await refresh();
            showToast(`Uploaded ${filePaths.length} file(s)`);
        }
    };

    const handleDelete = async (p: string) => {
        await deleteFile(p);
        setConfirmDelete(null);
        setSelectedFile(null);
        await refresh();
        showToast('Deleted');
    };

    const handleRename = async () => {
        if (!renamingPath || !renameValue.trim()) return;
        const dir = renamingPath.split(/[\\/]/).slice(0, -1).join('/') || renamingPath.split(/[\\/]/).slice(0, -1).join('\\');
        const newPath = `${dir}/${renameValue.trim()}`;
        await renameFile(renamingPath, newPath);
        setRenamingPath(null);
        setRenameValue('');
        await refresh();
        showToast('Renamed');
    };

    const handleCreateFile = async () => {
        if (!newFileName.trim() || !currentPath) return;
        const filePath = `${currentPath}/${newFileName.trim()}`;
        if (newFileName.endsWith('/') || !newFileName.includes('.')) {
            await createDir(filePath);
        } else {
            await writeFile(filePath, '');
        }
        setIsCreatingFile(false);
        setNewFileName('');
        await refresh();
        showToast('Created!');
    };

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const segments = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);

    if (!isElectron) return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <HardDrive size={48} className="mb-4 text-zinc-200" />
            <h3 className="text-zinc-900 font-semibold mb-2">Desktop Mode Required</h3>
            <p className="text-sm text-zinc-400">File Explorer requires the NeuroOS desktop app.</p>
        </div>
    );

    if (!workspacePath) return (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-6">
                <FolderOpen size={36} className="text-sky-500" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Choose a Workspace</h2>
            <p className="text-sm text-zinc-400 mb-8 max-w-xs leading-relaxed">Select a folder on your computer to use as your NeuroOS workspace. Files you create or upload will be saved here.</p>
            <button onClick={handleSelectWorkspace} className="flex items-center gap-2.5 px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-700 transition-all active:scale-95 shadow-lg shadow-zinc-200">
                <Folder size={18} />
                Select Workspace Folder
            </button>
            <p className="text-xs text-zinc-300 mt-4">You can change this later from the toolbar</p>
        </motion.div>


    );
    return (
        <div className="flex flex-col h-full bg-white text-zinc-900">
            <AnimatePresence>{toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs px-4 py-2 rounded-full shadow-xl">{toast}</motion.div>
            )}</AnimatePresence>

            <HeaderBar
                onBack={handleBack}
                onHome={() => navigateTo(workspacePath)}
                onRefresh={() => refresh()}
                onUpload={handleUpload}
                onNew={() => setIsCreatingFile(true)}
                onChangeWorkspace={handleSelectWorkspace}
                historyLength={history.length}
                segments={segments}
                onNavigateSegment={(i) => {
                    const parts = currentPath.replace(/\\/g, '/').split('/');
                    const idx = parts.lastIndexOf(segments[i]);
                    if (idx >= 0) navigateTo(parts.slice(0, idx + 1).join('/'));
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            <AnimatePresence>
                {isCreatingFile && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-3 py-2 border-b border-zinc-100 bg-sky-50 flex items-center gap-2">
                        <Plus size={12} className="text-sky-500" />
                        <input autoFocus type="text" value={newFileName} onChange={e => setNewFileName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateFile(); if (e.key === 'Escape') setIsCreatingFile(false); }} placeholder="filename.ext or folder-name" className="flex-1 bg-transparent text-xs outline-none text-zinc-800 placeholder:text-zinc-300" />
                        <button onClick={handleCreateFile} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600"><Check size={12} /></button>
                        <button onClick={() => setIsCreatingFile(false)} className="p-1 hover:bg-zinc-100 rounded"><X size={12} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 overflow-auto p-3 flex" onContextMenu={(e) => {
                if ((e.target as HTMLElement).closest('[data-file-item]')) return;
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, [
                    { label: 'New File', icon: FilePlus, action: () => setIsCreatingFile(true) },
                    { label: 'New Folder', icon: FolderPlus, action: () => setIsCreatingFile(true) },
                    { type: 'divider' },
                    { label: 'Upload Files', icon: Upload, action: handleUpload },
                    { label: 'Refresh', icon: RefreshCw, action: refresh, shortcut: 'F5' },
                    { type: 'divider' },
                    { label: 'Change Workspace', icon: FolderOpen, action: handleSelectWorkspace },
                ]);
            }}>

                {loading ? (
                    <div className="flex items-center justify-center h-full text-zinc-300"><RefreshCw size={24} className="animate-spin" /></div>
                ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-200 gap-3"><Folder size={48} strokeWidth={1} /><p className="text-xs">This folder is empty</p></div>
                ) : (
                    <div className="flex-1">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
                            <AnimatePresence mode="popLayout">
                                {filteredFiles.map(file => (
                                    <FileCard
                                        key={file.path}
                                        file={file}
                                        selected={selectedFile?.path === file.path}
                                        renamingPath={renamingPath}
                                        renameValue={renameValue}
                                        setRenaming={(p, v) => { setRenamingPath(p); setRenameValue(v); }}
                                        setRenameValue={v => setRenameValue(v)}
                                        onRename={handleRename}
                                        onDelete={handleDelete}
                                        onSelect={() => { setSelectedFile(file); setPreviewPath(file.path); }}
                                        onOpen={() => file.isDirectory ? navigateTo(file.path) : openFileInViewer(file.path, file.name)}
                                        onContextMenuItems={(e) => {
                                            const items: ContextMenuEntry[] = [
                                                ...(file.isDirectory ? [{ label: 'Open Folder', icon: FolderOpen, action: () => navigateTo(file.path) }] : [{ label: 'Select', icon: Check, action: () => setSelectedFile(file) }]),
                                                { type: 'divider' as const },
                                                { label: 'Rename', icon: Edit3, action: () => { setRenamingPath(file.path); setRenameValue(file.name); }, shortcut: 'F2' },
                                                { label: 'Copy Path', icon: Copy, action: () => navigator.clipboard.writeText(file.path) },
                                                { type: 'divider' as const },
                                                { label: 'Delete', icon: Trash2, action: () => setConfirmDelete(file.path), danger: true, shortcut: 'Del' },
                                            ];
                                            showContextMenu(e.clientX, e.clientY, items);
                                        }}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {previewPath && (
                    <div className="w-1/3 border-l border-zinc-200 pl-4 relative">
                        <button onClick={() => setPreviewPath(null)} className="absolute top-2 right-2 p-1 bg-white rounded-full hover:bg-zinc-100 shadow" title="Close preview"><X size={12} /></button>
                        <FileViewer windowData={{
                            id: 'preview',
                            component: 'viewer',
                            zIndex: 100,
                            isFocused: true,
                            state: 'normal',
                            lastAction: { type: 'open_file', payload: { path: previewPath, name: selectedFile?.name }, timestamp: Date.now() },
                            title: selectedFile?.name || '',
                            position: { x: 0, y: 0 },
                            size: { width: 600, height: 400 }
                        }} />
                    </div>
                )}

            </div>

            <div className="shrink-0 px-4 py-1.5 border-t border-zinc-100 flex justify-between items-center text-[10px] text-zinc-300">
                <span>{filteredFiles.length} items</span>
                <span className="font-mono truncate max-w-[280px]">{currentPath}</span>
            </div>
        </div>
    );
};

// --- Helper subcomponents ---
const HeaderBar: React.FC<{
    onBack: () => void; onHome: () => void; onRefresh: () => void; onUpload: () => void; onNew: () => void; onChangeWorkspace: () => void;
    historyLength: number; segments: string[]; onNavigateSegment: (i: number) => void;
    searchQuery: string; setSearchQuery: (s: string) => void;
}> = ({ onBack, onHome, onRefresh, onUpload, onNew, onChangeWorkspace, historyLength, segments, onNavigateSegment, searchQuery, setSearchQuery }) => {
    return (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-100 shrink-0">
            <button onClick={onBack} disabled={historyLength === 0} className="p-1.5 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"><ArrowLeft size={15} /></button>
            <button onClick={onHome} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors" title="Go to workspace root"><Home size={15} /></button>
            <div className="flex-1 flex items-center gap-1 px-2 py-1 bg-zinc-50 rounded-lg border border-zinc-100 text-xs font-mono text-zinc-500 overflow-hidden">
                {segments.map((seg, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <ChevronRight size={10} className="text-zinc-300 shrink-0" />}
                        <button onClick={() => onNavigateSegment(i)} className="truncate max-w-[80px] hover:text-zinc-900 transition-colors shrink-0">{seg}</button>
                    </React.Fragment>
                ))}
            </div>
            <button onClick={onRefresh} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors" title="Refresh"><RefreshCw size={15} /></button>
            <button onClick={onUpload} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-sky-600" title="Upload files"><Upload size={15} /></button>
            <button onClick={onNew} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-sky-600" title="New file/folder"><Plus size={15} /></button>
            <button onClick={onChangeWorkspace} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400" title="Change workspace"><FolderOpen size={15} /></button>
            <div className="ml-2 px-3 py-1 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center gap-2">
                <Search size={12} className="text-zinc-300" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search files…" className="flex-1 bg-transparent text-xs outline-none text-zinc-700 placeholder:text-zinc-300" />
                {searchQuery && <button onClick={() => setSearchQuery('')}><X size={12} className="text-zinc-300" /></button>}
            </div>
        </div>
    );
};

const FileCard: React.FC<{
    file: FileEntry; selected: boolean; renamingPath: string | null; renameValue: string;
    setRenaming: (p: string, v: string) => void; setRenameValue: (v: string) => void; onRename: () => void; onDelete: (p: string) => void;
    onSelect: () => void; onOpen: () => void; onContextMenuItems: (e: MouseEvent) => void;
}> = ({ file, selected, renamingPath, renameValue, setRenaming, setRenameValue, onRename, onDelete, onSelect, onOpen, onContextMenuItems }) => {
    const isRenaming = renamingPath === file.path;
    const { Icon, color } = getFileIcon(file.name, file.isDirectory);

    return (
        <motion.div layout data-file-item draggable initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className={cn("group relative flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer select-none transition-colors", selected ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-zinc-50")} onClick={onSelect} onDoubleClick={(e) => { (e as any).stopPropagation(); onOpen(); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenuItems(e as unknown as MouseEvent); }}>
            <div className={cn("w-10 h-10 flex items-center justify-center rounded-lg", color)}><Icon size={28} strokeWidth={1.5} /></div>
            {isRenaming ? (
                <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') onRename();
                        if (e.key === 'Escape') setRenaming('', '');
                    }}
                    onBlur={onRename}
                    className="w-full text-[10px] text-center bg-white border border-sky-300 rounded px-1 outline-none"
                />
            ) : (
                <span className="text-[10px] font-medium text-zinc-600 text-center truncate w-full px-0.5 leading-tight">{file.name}</span>
            )}

            {!isRenaming && (
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                    <button onClick={e => { e.stopPropagation(); setRenaming(file.path, file.name); }} className="p-0.5 bg-white rounded border border-zinc-100 hover:bg-zinc-50 text-zinc-400 hover:text-zinc-700" title="Rename"><Edit3 size={9} /></button>
                    <button onClick={e => { e.stopPropagation(); onDelete(file.path); }} className="p-0.5 bg-white rounded border border-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500" title="Delete"><Trash2 size={9} /></button>
                </div>
            )}
        </motion.div>
    );
};
