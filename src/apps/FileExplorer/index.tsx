import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import {
    Folder, FileText, ArrowLeft, HardDrive, Upload, Plus,
    Trash2, RefreshCw, X, Check, FolderOpen, Edit3,
    File, FileCode, FileImage, Music, Video, Archive,
    ChevronRight, Home, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

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

export const FileExplorer: React.FC = () => {
    const { isElectron, listFiles, selectDirectory, selectFiles, deleteFile, copyFile, writeFile, createDir, renameFile } = useFileSystem();
    const { workspacePath, setWorkspace, clearWorkspace } = useWorkspaceStore();

    const [currentPath, setCurrentPath] = useState<string>('');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
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

    const refresh = useCallback(async (p?: string) => {
        const target = p ?? currentPath;
        if (!target) return;
        setLoading(true);
        try {
            const entries = await listFiles(target);
            setFiles(entries.map((e: FileEntry) => ({ ...e, ext: e.name.split('.').pop() })));
        } catch (err) {
            console.error("Failed to list directory", err);
        } finally {
            setLoading(false);
        }
    }, [currentPath, listFiles]);

    // Load workspace on mount
    useEffect(() => {
        if (workspacePath && isElectron) {
            navigateTo(workspacePath);
        }
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
            console.error("Failed to navigate", err);
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
            const dest = `${currentPath}/${name}`;
            await copyFile(fp, dest);
        }
        if (filePaths.length > 0) {
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

    // Breadcrumb segments
    const segments = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);

    // === SETUP SCREEN ===
    if (!isElectron) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <HardDrive size={48} className="mb-4 text-zinc-200" />
                <h3 className="text-zinc-900 font-semibold mb-2">Desktop Mode Required</h3>
                <p className="text-sm text-zinc-400">File Explorer requires the NeuroOS desktop app.</p>
            </div>
        );
    }

    if (!workspacePath) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full p-12 text-center"
            >
                <div className="w-20 h-20 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-6">
                    <FolderOpen size={36} className="text-sky-500" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2">Choose a Workspace</h2>
                <p className="text-sm text-zinc-400 mb-8 max-w-xs leading-relaxed">
                    Select a folder on your computer to use as your NeuroOS workspace. Files you create or upload will be saved here.
                </p>
                <button
                    onClick={handleSelectWorkspace}
                    className="flex items-center gap-2.5 px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-700 transition-all active:scale-95 shadow-lg shadow-zinc-200"
                >
                    <Folder size={18} />
                    Select Workspace Folder
                </button>
                <p className="text-xs text-zinc-300 mt-4">You can change this later from the toolbar</p>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white text-zinc-900">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs px-4 py-2 rounded-full shadow-xl"
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toolbar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-100 shrink-0">
                <button onClick={handleBack} disabled={history.length === 0}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors">
                    <ArrowLeft size={15} />
                </button>
                <button onClick={() => navigateTo(workspacePath)}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors" title="Go to workspace root">
                    <Home size={15} />
                </button>
                {/* Breadcrumb */}
                <div className="flex-1 flex items-center gap-1 px-2 py-1 bg-zinc-50 rounded-lg border border-zinc-100 text-xs font-mono text-zinc-500 overflow-hidden">
                    {segments.map((seg, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <ChevronRight size={10} className="text-zinc-300 shrink-0" />}
                            <button
                                onClick={() => {
                                    const p = (currentPath.includes('/') ? '/' : '\\') + segments.slice(0, i + 1).join(currentPath.includes('/') ? '/' : '\\');
                                    // Rebuild absolute path
                                    const sep = currentPath.includes('/') ? '/' : '\\';
                                    const parts = currentPath.replace(/\\/g, '/').split('/');
                                    const idx = parts.lastIndexOf(seg);
                                    if (idx >= 0) navigateTo(parts.slice(0, idx + 1).join('/'));
                                }}
                                className="truncate max-w-[80px] hover:text-zinc-900 transition-colors shrink-0"
                            >{seg}</button>
                        </React.Fragment>
                    ))}
                </div>
                <button onClick={() => refresh()} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors" title="Refresh">
                    <RefreshCw size={15} />
                </button>
                <button onClick={handleUpload} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-sky-600" title="Upload files">
                    <Upload size={15} />
                </button>
                <button onClick={() => setIsCreatingFile(true)} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-sky-600" title="New file/folder">
                    <Plus size={15} />
                </button>
                <button onClick={handleSelectWorkspace} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400" title="Change workspace">
                    <FolderOpen size={15} />
                </button>
            </div>

            {/* Search bar */}
            <div className="px-3 py-2 border-b border-zinc-50">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-lg border border-zinc-100">
                    <Search size={12} className="text-zinc-300" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search files…"
                        className="flex-1 bg-transparent text-xs outline-none text-zinc-700 placeholder:text-zinc-300"
                    />
                    {searchQuery && <button onClick={() => setSearchQuery('')}><X size={12} className="text-zinc-300" /></button>}
                </div>
            </div>

            {/* New File Input */}
            <AnimatePresence>
                {isCreatingFile && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="px-3 py-2 border-b border-zinc-100 bg-sky-50 flex items-center gap-2">
                        <Plus size={12} className="text-sky-500" />
                        <input
                            autoFocus
                            type="text"
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCreateFile(); if (e.key === 'Escape') setIsCreatingFile(false); }}
                            placeholder="filename.ext or folder-name"
                            className="flex-1 bg-transparent text-xs outline-none text-zinc-800 placeholder:text-zinc-300"
                        />
                        <button onClick={handleCreateFile} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600"><Check size={12} /></button>
                        <button onClick={() => setIsCreatingFile(false)} className="p-1 hover:bg-zinc-100 rounded"><X size={12} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-3">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-zinc-300">
                        <RefreshCw size={24} className="animate-spin" />
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-200 gap-3">
                        <Folder size={48} strokeWidth={1} />
                        <p className="text-xs">This folder is empty</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
                        <AnimatePresence mode="popLayout">
                            {filteredFiles.map(file => {
                                const { Icon, color } = getFileIcon(file.name, file.isDirectory);
                                const isRenaming = renamingPath === file.path;
                                const isConfirmingDelete = confirmDelete === file.path;

                                return (
                                    <motion.div
                                        layout
                                        key={file.path}
                                        initial={{ opacity: 0, scale: 0.85 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                                        className={cn(
                                            "group relative flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer select-none transition-colors",
                                            selectedFile?.path === file.path ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-zinc-50"
                                        )}
                                        onClick={() => {
                                            if (file.isDirectory) {
                                                navigateTo(file.path);
                                            } else {
                                                setSelectedFile(file);
                                            }
                                        }}
                                    >
                                        {/* Icon */}
                                        <div className={cn("w-10 h-10 flex items-center justify-center rounded-lg", color)}>
                                            <Icon size={28} strokeWidth={1.5} />
                                        </div>

                                        {/* Name or Rename input */}
                                        {isRenaming ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                value={renameValue}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingPath(null); }}
                                                onBlur={handleRename}
                                                className="w-full text-[10px] text-center bg-white border border-sky-300 rounded px-1 outline-none"
                                            />
                                        ) : (
                                            <span className="text-[10px] font-medium text-zinc-600 text-center truncate w-full px-0.5 leading-tight">
                                                {file.name}
                                            </span>
                                        )}

                                        {/* Hover action buttons */}
                                        {!isRenaming && (
                                            <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                                                <button
                                                    onClick={e => { e.stopPropagation(); setRenamingPath(file.path); setRenameValue(file.name); }}
                                                    className="p-0.5 bg-white rounded border border-zinc-100 hover:bg-zinc-50 text-zinc-400 hover:text-zinc-700"
                                                    title="Rename"
                                                >
                                                    <Edit3 size={9} />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); setConfirmDelete(file.path); }}
                                                    className="p-0.5 bg-white rounded border border-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={9} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Delete confirm dialog */}
                                        {isConfirmingDelete && (
                                            <div className="absolute inset-0 z-10 bg-white/95 flex flex-col items-center justify-center rounded-xl gap-1.5 p-1 border border-red-200">
                                                <p className="text-[9px] text-red-600 font-bold text-center">Delete?</p>
                                                <div className="flex gap-1">
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(file.path); }} className="px-2 py-0.5 bg-red-500 text-white text-[9px] rounded-md">Yes</button>
                                                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[9px] rounded-md">No</button>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-1.5 border-t border-zinc-100 flex justify-between items-center text-[10px] text-zinc-300">
                <span>{filteredFiles.length} items</span>
                <span className="font-mono truncate max-w-[280px]">{currentPath}</span>
            </div>
        </div>
    );
};
