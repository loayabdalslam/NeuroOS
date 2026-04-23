import React, { useState, useEffect, useCallback, useRef } from 'react';
import { OSAppWindow, useOS } from '../hooks/useOS';
import { useFileSystem } from '../hooks/useFileSystem';
import {
    FileText, Image as ImageIcon, Film, Music, Code, FileJson,
    File, Copy, ZoomIn, ZoomOut, WrapText, AlignLeft, Check,
    ChevronRight, Hash, Braces, Globe, FileType, RotateCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// ─── Extension Mapping ──────────────────────────────
type FileType = 'text' | 'code' | 'image' | 'video' | 'audio' | 'markdown' | 'pdf' | 'json' | 'html' | 'unknown';

const EXT_MAP: Record<string, FileType> = {
    txt: 'text', log: 'text', csv: 'text', ini: 'text', cfg: 'text', env: 'text', yml: 'text', yaml: 'text', toml: 'text', xml: 'text',
    md: 'markdown', mdx: 'markdown',
    js: 'code', jsx: 'code', ts: 'code', tsx: 'code', py: 'code', rb: 'code', go: 'code', rs: 'code',
    java: 'code', c: 'code', cpp: 'code', h: 'code', hpp: 'code', cs: 'code', php: 'code',
    swift: 'code', kt: 'code', scala: 'code', lua: 'code', sh: 'code', bash: 'code', zsh: 'code',
    bat: 'code', ps1: 'code', sql: 'code', r: 'code', dart: 'code', vue: 'code', svelte: 'code',
    css: 'code', scss: 'code', less: 'code', sass: 'code', styl: 'code',
    json: 'json', jsonc: 'json', jsonl: 'json',
    html: 'html', htm: 'html', svg: 'html',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', ico: 'image', avif: 'image',
    mp4: 'video', webm: 'video', mkv: 'video', avi: 'video', mov: 'video', ogv: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio', wma: 'audio',
    pdf: 'pdf',
};

const LANG_MAP: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', php: 'php',
    swift: 'swift', kt: 'kotlin', sh: 'bash', bash: 'bash', sql: 'sql',
    css: 'css', scss: 'scss', html: 'html', json: 'json', xml: 'xml',
    yml: 'yaml', yaml: 'yaml', toml: 'toml', md: 'markdown',
};

function getExt(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function getFileType(filename: string): FileType {
    return EXT_MAP[getExt(filename)] || 'unknown';
}

function getFileName(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop() || path;
}

function getPathSegments(path: string): string[] {
    const normalized = path.replace(/\\/g, '/');
    return normalized.split('/').filter(Boolean);
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Component ──────────────────────────────────────
interface FileViewerProps {
    windowData: OSAppWindow;
}

export const FileViewer: React.FC<FileViewerProps> = ({ windowData }) => {
    const { readFile } = useFileSystem();
    const { updateWindow } = useOS();

    const [content, setContent] = useState('');
    const [blobUrl, setBlobUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [wordWrap, setWordWrap] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [lineNumbers, setLineNumbers] = useState(true);
    const [copied, setCopied] = useState(false);
    const [fileSize, setFileSize] = useState(0);
    const lastLoadedRef = useRef<number>(0);
    const codeContainerRef = useRef<HTMLDivElement>(null);

    const filePath = windowData.lastAction?.payload?.path || '';
    const fileName = getFileName(filePath);
    const fileType = getFileType(fileName);
    const ext = getExt(fileName);
    const lang = LANG_MAP[ext] || ext;

    const loadFile = useCallback(async () => {
        if (!filePath) {
            setError('No file specified');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        setContent('');
        setBlobUrl('');

        try {
            const electron = (window as any).electron;
            const stat = await electron?.fileSystem?.stat(filePath).catch(() => null);
            if (!stat) throw new Error('not found');
            if (stat.size) setFileSize(stat.size);

            if (fileType === 'image' || fileType === 'video' || fileType === 'audio' || fileType === 'pdf') {
                if (electron?.fileSystem?.readBinary) {
                    const mimeMap: Record<string, string> = {
                        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
                        webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
                        mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo', mov: 'video/quicktime',
                        mkv: 'video/x-matroska', ogv: 'video/ogg',
                        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
                        aac: 'audio/aac', m4a: 'audio/mp4', wma: 'audio/x-ms-wma',
                        pdf: 'application/pdf',
                    };
                    const data = await electron.fileSystem.readBinary(filePath);
                    const mime = mimeMap[ext] || 'application/octet-stream';
                    const blob = new Blob([data], { type: mime });
                    setBlobUrl(URL.createObjectURL(blob));
                }
            } else {
                const text = await readFile(filePath);
                setContent(text);
                if (!stat.size) setFileSize(new TextEncoder().encode(text).length);
            }
        } catch (e: any) {
            setError('Could not open file – it may have been moved or deleted.');
            console.error('readFile error', e);
        } finally {
            setLoading(false);
        }
    }, [filePath, fileType, readFile]);

    useEffect(() => {
        const actionTs = windowData.lastAction?.timestamp || 0;
        if (actionTs > lastLoadedRef.current) {
            lastLoadedRef.current = actionTs;
            loadFile();
        }
    }, [windowData.lastAction, loadFile]);

    useEffect(() => {
        if (fileName && windowData.title !== fileName) {
            updateWindow(windowData.id, { title: fileName });
        }
    }, [fileName]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getTypeInfo = () => {
        switch (fileType) {
            case 'image': return { icon: ImageIcon, color: 'text-pink-500', bg: 'bg-pink-50', label: ext.toUpperCase() };
            case 'video': return { icon: Film, color: 'text-red-500', bg: 'bg-red-50', label: ext.toUpperCase() };
            case 'audio': return { icon: Music, color: 'text-violet-500', bg: 'bg-violet-50', label: ext.toUpperCase() };
            case 'code': return { icon: Code, color: 'text-sky-500', bg: 'bg-sky-50', label: lang };
            case 'json': return { icon: Braces, color: 'text-amber-500', bg: 'bg-amber-50', label: 'JSON' };
            case 'markdown': return { icon: Hash, color: 'text-blue-500', bg: 'bg-blue-50', label: 'MD' };
            case 'html': return { icon: Globe, color: 'text-orange-500', bg: 'bg-orange-50', label: ext === 'svg' ? 'SVG' : 'HTML' };
            case 'pdf': return { icon: FileType, color: 'text-red-500', bg: 'bg-red-50', label: 'PDF' };
            default: return { icon: FileText, color: 'text-zinc-500', bg: 'bg-zinc-100', label: ext || 'TXT' };
        }
    };

    const typeInfo = getTypeInfo();
    const TypeIcon = typeInfo.icon;
    const isTextType = ['text', 'code', 'json', 'markdown', 'html', 'unknown'].includes(fileType);
    const lineCount = content ? content.split('\n').length : 0;
    const pathSegments = getPathSegments(filePath);

    // ─── Renderers ──────────────────────────────────

    const renderCodeView = (text: string, _language: string) => {
        const lines = text.split('\n');
        const gutterWidth = String(lines.length).length;

        return (
            <div
                ref={codeContainerRef}
                className="h-full overflow-auto font-mono"
                style={{ fontSize: `${Math.round(13 * zoom / 100)}px`, lineHeight: '1.65' }}
            >
                <table className="w-full border-collapse">
                    <tbody>
                        {lines.map((line, i) => (
                            <tr key={i} className="group/line hover:bg-black/[0.02] transition-colors duration-75">
                                {lineNumbers && (
                                    <td
                                        className="select-none text-right pr-4 pl-3 py-0 text-zinc-400 border-r border-black/[0.04] w-[1%] group-hover/line:text-zinc-500 transition-colors"
                                        style={{ minWidth: `${gutterWidth + 2}ch` }}
                                    >
                                        {i + 1}
                                    </td>
                                )}
                                <td
                                    className="pl-4 pr-4 py-0 text-zinc-700"
                                    style={{
                                        whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                                        wordBreak: wordWrap ? 'break-all' : 'normal'
                                    }}
                                >
                                    {line || ' '}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        <RotateCw size={24} className="text-zinc-600" />
                    </motion.div>
                    <p className="text-xs text-zinc-600">Loading file...</p>
                </div>
            );
        }

        if (error) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-4"
                >
                    <div className="w-14 h-14 rounded-2xl bg-black/[0.03] flex items-center justify-center">
                        <File size={24} className="text-zinc-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-zinc-500 mb-1">{error}</p>
                        <button
                            onClick={loadFile}
                            className="text-xs text-sky-500 hover:text-sky-600 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                </motion.div>
            );
        }

        switch (fileType) {
            case 'image':
                return (
                    <div className="flex items-center justify-center h-full bg-zinc-50 overflow-auto p-6">
                        <motion.img
                            key={blobUrl}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            src={blobUrl}
                            alt={fileName}
                            style={{ maxWidth: `${zoom}%`, maxHeight: `${zoom}%` }}
                            className="object-contain rounded-lg shadow-2xl"
                            draggable={false}
                        />
                    </div>
                );

            case 'video':
                return (
                    <div className="h-full w-full bg-black flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-black/[0.06] bg-black"
                        >
                            <video src={blobUrl} controls autoPlay className="w-full h-full object-contain" />
                        </motion.div>
                    </div>
                );

            case 'audio':
                return (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-zinc-50 via-violet-50/30 to-zinc-50 gap-5"
                    >
                        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 border border-black/[0.06] flex items-center justify-center">
                            <Music size={40} className="text-violet-400" />
                        </div>
                        <p className="text-sm text-zinc-700 font-medium">{fileName}</p>
                        <audio src={blobUrl} controls className="w-80" />
                    </motion.div>
                );

            case 'pdf':
                return <iframe src={blobUrl} className="w-full h-full border-0" title={fileName} />;

            case 'html':
                return (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-auto">
                            {ext === 'svg' ? (
                                <div
                                    className="flex items-center justify-center h-full bg-zinc-50 p-6"
                                    dangerouslySetInnerHTML={{ __html: content }}
                                />
                            ) : (
                                <iframe
                                    srcDoc={content}
                                    className="w-full h-full border-0 bg-white"
                                    title={fileName}
                                    sandbox="allow-scripts"
                                />
                            )}
                        </div>
                    </div>
                );

            case 'json':
                try {
                    const formatted = JSON.stringify(JSON.parse(content), null, 2);
                    return renderCodeView(formatted, 'json');
                } catch {
                    return renderCodeView(content, 'json');
                }

            case 'markdown':
                return (
                    <div className="h-full overflow-auto bg-white p-8">
                        <div className="max-w-3xl mx-auto prose prose-sm prose-zinc
                            prose-headings:text-zinc-800 prose-headings:font-semibold prose-headings:border-b prose-headings:border-black/[0.06] prose-headings:pb-2
                            prose-p:text-zinc-600 prose-p:leading-relaxed
                            prose-a:text-sky-500 prose-a:no-underline hover:prose-a:underline
                            prose-strong:text-zinc-700
                            prose-code:text-pink-600 prose-code:bg-black/[0.03] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                            prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-black/[0.06] prose-pre:rounded-xl
                            prose-blockquote:border-violet-400 prose-blockquote:text-zinc-500
                            prose-li:text-zinc-600
                            prose-hr:border-black/[0.06]
                            prose-th:text-zinc-700 prose-td:text-zinc-600
                        ">
                            <ReactMarkdown>{content}</ReactMarkdown>
                        </div>
                    </div>
                );

            case 'code':
                return renderCodeView(content, lang);

            case 'text':
            default:
                return renderCodeView(content, 'plain');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white text-zinc-700 select-none">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border-b border-black/[0.06] min-h-[36px] shrink-0">
                {/* Type badge */}
                <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md shrink-0", typeInfo.bg)}>
                    <TypeIcon size={12} className={typeInfo.color} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", typeInfo.color)}>{typeInfo.label}</span>
                </div>

                {/* Breadcrumb path */}
                <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-hidden text-[11px]">
                    {pathSegments.length > 3 ? (
                        <>
                            <span className="text-zinc-400 truncate">{pathSegments[0]}</span>
                            <ChevronRight size={10} className="text-zinc-300 shrink-0" />
                            <span className="text-zinc-400">&hellip;</span>
                            <ChevronRight size={10} className="text-zinc-300 shrink-0" />
                            {pathSegments.slice(-2).map((seg, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <ChevronRight size={10} className="text-zinc-300 shrink-0" />}
                                    <span className={cn(
                                        "truncate",
                                        i === pathSegments.slice(-2).length - 1 ? "text-zinc-700 font-medium" : "text-zinc-400"
                                    )}>
                                        {seg}
                                    </span>
                                </React.Fragment>
                            ))}
                        </>
                    ) : (
                        pathSegments.map((seg, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <ChevronRight size={10} className="text-zinc-300 shrink-0" />}
                                <span className={cn(
                                    "truncate",
                                    i === pathSegments.length - 1 ? "text-zinc-700 font-medium" : "text-zinc-400"
                                )}>
                                    {seg}
                                </span>
                            </React.Fragment>
                        ))
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-0.5 shrink-0">
                    {isTextType && (
                        <>
                            <button
                                onClick={() => setWordWrap(!wordWrap)}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    wordWrap ? "text-sky-500 bg-sky-50" : "text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04]"
                                )}
                                title="Word Wrap"
                            >
                                <WrapText size={13} />
                            </button>
                            <button
                                onClick={() => setLineNumbers(!lineNumbers)}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    lineNumbers ? "text-sky-500 bg-sky-50" : "text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04]"
                                )}
                                title="Line Numbers"
                            >
                                <AlignLeft size={13} />
                            </button>
                            <button
                                onClick={handleCopy}
                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04] transition-colors relative"
                                title="Copy"
                            >
                                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            </button>
                            <div className="w-px h-3.5 bg-black/[0.06] mx-0.5" />
                        </>
                    )}

                    {(fileType === 'image' || isTextType) && (
                        <>
                            <button
                                onClick={() => setZoom(z => Math.max(50, z - 10))}
                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04] transition-colors"
                                title="Zoom Out"
                            >
                                <ZoomOut size={13} />
                            </button>
                            <span className="text-[10px] text-zinc-400 w-8 text-center font-mono tabular-nums">{zoom}%</span>
                            <button
                                onClick={() => setZoom(z => Math.min(200, z + 10))}
                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04] transition-colors"
                                title="Zoom In"
                            >
                                <ZoomIn size={13} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={filePath || 'empty'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="h-full"
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Status bar */}
            {isTextType && content && (
                <div className="flex items-center gap-3 px-3 py-1 bg-zinc-50 border-t border-black/[0.06] text-[10px] text-zinc-400 shrink-0">
                    <span>{lineCount.toLocaleString()} lines</span>
                    <span className="w-px h-2.5 bg-black/[0.06]" />
                    <span>{content.length.toLocaleString()} chars</span>
                    <span className="w-px h-2.5 bg-black/[0.06]" />
                    <span>{formatBytes(fileSize)}</span>
                    <span className="w-px h-2.5 bg-black/[0.06]" />
                    <span className="uppercase font-medium">{lang}</span>
                    <span className="ml-auto">UTF-8</span>
                </div>
            )}
        </div>
    );
};
