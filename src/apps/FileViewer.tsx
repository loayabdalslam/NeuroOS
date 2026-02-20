import React, { useState, useEffect, useCallback, useRef } from 'react';
import { OSAppWindow, useOS } from '../hooks/useOS';
import { useFileSystem } from '../hooks/useFileSystem';
import {
    FileText, Image as ImageIcon, Film, Music, Code, FileJson,
    File, Download, Copy, ZoomIn, ZoomOut, RotateCw,
    WrapText, AlignLeft
} from 'lucide-react';

// ─── Extension Mapping ──────────────────────────────
type FileType = 'text' | 'code' | 'image' | 'video' | 'audio' | 'markdown' | 'pdf' | 'json' | 'html' | 'unknown';

const EXT_MAP: Record<string, FileType> = {
    // Text
    txt: 'text', log: 'text', csv: 'text', ini: 'text', cfg: 'text', env: 'text', yml: 'text', yaml: 'text', toml: 'text', xml: 'text',
    // Markdown
    md: 'markdown', mdx: 'markdown',
    // Code
    js: 'code', jsx: 'code', ts: 'code', tsx: 'code', py: 'code', rb: 'code', go: 'code', rs: 'code',
    java: 'code', c: 'code', cpp: 'code', h: 'code', hpp: 'code', cs: 'code', php: 'code',
    swift: 'code', kt: 'code', scala: 'code', lua: 'code', sh: 'code', bash: 'code', zsh: 'code',
    bat: 'code', ps1: 'code', sql: 'code', r: 'code', dart: 'code', vue: 'code', svelte: 'code',
    css: 'code', scss: 'code', less: 'code', sass: 'code', styl: 'code',
    // JSON
    json: 'json', jsonc: 'json', jsonl: 'json',
    // HTML
    html: 'html', htm: 'html', svg: 'html',
    // Images
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', ico: 'image', avif: 'image',
    // Video
    mp4: 'video', webm: 'video', mkv: 'video', avi: 'video', mov: 'video', ogv: 'video',
    // Audio
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio', wma: 'audio',
    // PDF
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

// ─── Component ──────────────────────────────────────
interface FileViewerProps {
    windowData: OSAppWindow;
}

export const FileViewer: React.FC<FileViewerProps> = ({ windowData }) => {
    const { readFile } = useFileSystem();
    const { updateWindow } = useOS();

    const [content, setContent] = useState<string>('');
    const [blobUrl, setBlobUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [wordWrap, setWordWrap] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [lineNumbers, setLineNumbers] = useState(true);
    const lastLoadedRef = useRef<number>(0);

    // Get file path from lastAction
    const filePath = windowData.lastAction?.payload?.path || '';
    const fileName = getFileName(filePath);
    const fileType = getFileType(fileName);
    const ext = getExt(fileName);
    const lang = LANG_MAP[ext] || ext;

    // Load file content
    const loadFile = useCallback(async () => {
        if (!filePath) {
            setError('No file specified');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (fileType === 'image' || fileType === 'video' || fileType === 'audio' || fileType === 'pdf') {
                // Binary files — use file:// protocol in Electron
                const fileUrl = filePath.startsWith('/') ? `file://${filePath}` : `file:///${filePath.replace(/\\/g, '/')}`;
                setBlobUrl(fileUrl);
            } else {
                // Text-based files
                const text = await readFile(filePath);
                setContent(text);
            }
        } catch (e: any) {
            setError(`Failed to open file: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [filePath, fileType, readFile]);

    // Load on mount and when file changes
    useEffect(() => {
        const actionTs = windowData.lastAction?.timestamp || 0;
        if (actionTs > lastLoadedRef.current) {
            lastLoadedRef.current = actionTs;
            loadFile();
        }
    }, [windowData.lastAction, loadFile]);

    // Update window title
    useEffect(() => {
        if (fileName && windowData.title !== fileName) {
            updateWindow(windowData.id, { title: fileName });
        }
    }, [fileName]);

    // Copy content to clipboard
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
    };

    // ─── Renderers ──────────────────────────────────
    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full text-zinc-400">
                    <RotateCw size={28} className="animate-spin" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
                    <File size={48} strokeWidth={1} />
                    <p className="text-sm">{error}</p>
                </div>
            );
        }

        switch (fileType) {
            case 'image':
                return (
                    <div className="flex items-center justify-center h-full bg-[#1a1a2e] overflow-auto p-4">
                        <img
                            src={blobUrl}
                            alt={fileName}
                            style={{ maxWidth: `${zoom}%`, maxHeight: `${zoom}%` }}
                            className="object-contain rounded shadow-2xl transition-all duration-200"
                            draggable={false}
                        />
                    </div>
                );

            case 'video':
                return (
                    <div className="flex items-center justify-center h-full bg-black">
                        <video
                            src={blobUrl}
                            controls
                            autoPlay={false}
                            className="max-w-full max-h-full"
                        />
                    </div>
                );

            case 'audio':
                return (
                    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] gap-6">
                        <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-500/30 to-sky-500/30 flex items-center justify-center backdrop-blur-xl border border-white/10">
                            <Music size={56} className="text-white/70" />
                        </div>
                        <p className="text-white/80 text-sm font-medium">{fileName}</p>
                        <audio src={blobUrl} controls className="w-80" />
                    </div>
                );

            case 'pdf':
                return (
                    <iframe
                        src={blobUrl}
                        className="w-full h-full border-0"
                        title={fileName}
                    />
                );

            case 'html':
                return (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-auto">
                            {ext === 'svg' ? (
                                <div
                                    className="flex items-center justify-center h-full bg-[#1a1a2e] p-4"
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
                return renderCodeView(content, 'markdown');

            case 'code':
                return renderCodeView(content, lang);

            case 'text':
            default:
                return renderCodeView(content, 'plain');
        }
    };

    const renderCodeView = (text: string, language: string) => {
        const lines = text.split('\n');
        return (
            <div
                className="h-full overflow-auto font-mono text-[13px] leading-[1.6]"
                style={{ fontSize: `${Math.round(13 * zoom / 100)}px` }}
            >
                <table className="w-full border-collapse">
                    <tbody>
                        {lines.map((line, i) => (
                            <tr key={i} className="hover:bg-white/5">
                                {lineNumbers && (
                                    <td className="select-none text-right pr-4 pl-3 py-0 text-zinc-500 border-r border-zinc-700/50 w-[1%]">
                                        {i + 1}
                                    </td>
                                )}
                                <td className="pl-4 pr-3 py-0" style={{ whiteSpace: wordWrap ? 'pre-wrap' : 'pre', wordBreak: wordWrap ? 'break-all' : 'normal' }}>
                                    {line || ' '}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // ─── Get type icon & color ──────────────────────
    const getTypeInfo = () => {
        switch (fileType) {
            case 'image': return { icon: ImageIcon, color: 'text-pink-400', bg: 'bg-pink-500/10', label: ext.toUpperCase() };
            case 'video': return { icon: Film, color: 'text-red-400', bg: 'bg-red-500/10', label: ext.toUpperCase() };
            case 'audio': return { icon: Music, color: 'text-purple-400', bg: 'bg-purple-500/10', label: ext.toUpperCase() };
            case 'code': return { icon: Code, color: 'text-sky-400', bg: 'bg-sky-500/10', label: lang };
            case 'json': return { icon: FileJson, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'JSON' };
            case 'markdown': return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Markdown' };
            case 'html': return { icon: Code, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'HTML' };
            case 'pdf': return { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10', label: 'PDF' };
            default: return { icon: FileText, color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: ext || 'TXT' };
        }
    };

    const typeInfo = getTypeInfo();
    const TypeIcon = typeInfo.icon;
    const isTextType = ['text', 'code', 'json', 'markdown', 'html', 'unknown'].includes(fileType);
    const lineCount = content ? content.split('\n').length : 0;

    return (
        <div className="flex flex-col h-full bg-[#0f0f1a] text-zinc-200">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161625] border-b border-zinc-800 min-h-[36px]">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${typeInfo.bg}`}>
                    <TypeIcon size={13} className={typeInfo.color} />
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${typeInfo.color}`}>{typeInfo.label}</span>
                </div>

                <span className="text-xs text-zinc-500 truncate flex-1">{filePath}</span>

                {/* Controls */}
                <div className="flex items-center gap-0.5">
                    {isTextType && (
                        <>
                            <button
                                onClick={() => setWordWrap(!wordWrap)}
                                className={`p-1.5 rounded hover:bg-white/10 transition ${wordWrap ? 'text-sky-400' : 'text-zinc-500'}`}
                                title="Word Wrap"
                            >
                                <WrapText size={14} />
                            </button>
                            <button
                                onClick={() => setLineNumbers(!lineNumbers)}
                                className={`p-1.5 rounded hover:bg-white/10 transition ${lineNumbers ? 'text-sky-400' : 'text-zinc-500'}`}
                                title="Line Numbers"
                            >
                                <AlignLeft size={14} />
                            </button>
                            <button onClick={handleCopy} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 transition" title="Copy">
                                <Copy size={14} />
                            </button>
                        </>
                    )}

                    {(fileType === 'image' || isTextType) && (
                        <>
                            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 transition" title="Zoom Out">
                                <ZoomOut size={14} />
                            </button>
                            <span className="text-[10px] text-zinc-500 w-8 text-center">{zoom}%</span>
                            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 transition" title="Zoom In">
                                <ZoomIn size={14} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>

            {/* Status bar */}
            {isTextType && content && (
                <div className="flex items-center gap-4 px-3 py-1 bg-[#161625] border-t border-zinc-800 text-[11px] text-zinc-500">
                    <span>{lineCount} lines</span>
                    <span>{content.length.toLocaleString()} chars</span>
                    <span className="uppercase">{lang}</span>
                    <span className="ml-auto">UTF-8</span>
                </div>
            )}
        </div>
    );
};
