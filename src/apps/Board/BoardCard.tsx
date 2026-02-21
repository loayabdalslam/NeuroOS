import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, GripVertical, FileText, File, Folder, AppWindow, ImageIcon, FileCode, ExternalLink, Globe, Activity, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { BoardCard as BoardCardType } from './types';
import { fetchMetadata, LinkMetadata } from './utils';
import { APPS_CONFIG } from '../../lib/apps';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useOS } from '../../hooks/useOS';
import { WeatherWidget, StockWidget, NewsCarousel } from '../../components/Widgets';

interface CardProps {
    card: BoardCardType;
    onUpdate: (id: string, updates: Partial<BoardCardType>) => void;
    onDelete: (id: string) => void;
}

export const BoardCard: React.FC<CardProps> = ({ card, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
    const [previewType, setPreviewType] = useState<'text' | 'image' | 'video' | 'code' | 'markdown' | 'html' | 'none'>('none');
    const { readFile } = useFileSystem();
    const { openApp, sendAppAction, appWindows } = useOS();

    useEffect(() => {
        if (card.type === 'link' && card.metadata?.url) {
            fetchMetadata(card.metadata.url).then(setMetadata);
        }
    }, [card.type, card.metadata?.url]);

    const handleOpenFile = () => {
        const path = card.metadata?.path || card.metadata?.url;
        if (!path) return;
        const name = card.content;

        if (card.type === 'link') {
            openApp('browser', path);
            return;
        }

        // Use viewer for "Read Full" as requested by user
        openApp('viewer', name);
        setTimeout(() => {
            const viewerWin = useOS.getState().appWindows.filter(w => w.component === 'viewer').pop();
            if (viewerWin) {
                sendAppAction(viewerWin.id, 'open_file', { path, name });
            }
        }, 100);
    };

    useEffect(() => {
        if (card.type === 'file' && !card.metadata?.isDirectory && card.metadata?.path) {
            const ext = card.metadata.path.split('.').pop()?.toLowerCase() || '';
            const imageExtensions = ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp'];
            const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'mkv'];
            const codeExtensions = ['js', 'ts', 'tsx', 'py', 'json', 'css', 'scss', 'sh', 'sql'];
            const markdownExtensions = ['md'];
            const htmlExtensions = ['html']; // SVG handled as image if needed or HTML if preferred

            const fetchContent = async (type: 'markdown' | 'html' | 'code' | 'text') => {
                try {
                    const content = await readFile(card.metadata.path!);
                    setPreviewContent(content);
                    setPreviewType(type);
                } catch (e) {
                    console.error(`Failed to read file for ${type} preview`, e);
                }
            };

            if (markdownExtensions.includes(ext)) {
                fetchContent('markdown');
            } else if (htmlExtensions.includes(ext)) {
                fetchContent('html');
            } else if (codeExtensions.includes(ext)) {
                fetchContent('code');
            } else if (imageExtensions.includes(ext)) {
                setPreviewType('image');
            } else if (videoExtensions.includes(ext)) {
                setPreviewType('video');
            } else if (['txt'].includes(ext)) {
                fetchContent('text');
            } else {
                setPreviewType('none');
            }
        }
    }, [card.type, card.metadata?.path, card.metadata?.isDirectory, readFile]);

    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => {
                onUpdate(card.id, {
                    position: {
                        x: card.position.x + info.offset.x,
                        y: card.position.y + info.offset.y
                    }
                });
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "absolute w-64 group flex flex-col gap-2 p-4 rounded-2xl shadow-xl border transition-all hover:shadow-2xl z-20",
                card.type === 'sticky' ? "bg-amber-100 border-amber-200 rotate-[0.5deg]" : "bg-white border-zinc-100",
                isEditing ? "ring-2 ring-sky-500/20 shadow-sky-100" : ""
            )}
            style={{ left: card.position.x, top: card.position.y }}
        >
            <div className="flex items-center justify-between">
                <div className="p-1 cursor-grab active:cursor-grabbing text-zinc-300 group-hover:text-zinc-400 transition-colors">
                    <GripVertical size={14} />
                </div>
                <button
                    onClick={() => onDelete(card.id)}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Content Display/Edit */}
            <div className="flex-1 overflow-hidden">
                {(card.type as string) === 'file' || (card.type as string) === 'link' ? (
                    <div className="flex flex-col gap-2 p-1 h-full min-h-[120px]">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-zinc-50 flex items-center justify-center text-zinc-400">
                                {card.type === 'widget' ? <Activity size={12} className="text-purple-500" /> : card.type === 'link' ? <Globe size={14} className="text-sky-500" /> : (card.metadata?.isDirectory ? <Folder size={14} /> : (previewType === 'code' ? <FileCode size={14} /> : <FileText size={14} />))}
                            </div>
                            <span className="text-[11px] font-bold truncate text-zinc-600 tracking-tight">{card.content}</span>
                        </div>

                        {/* Preview Area */}
                        {(card.type === 'link' || !card.metadata?.isDirectory) && (
                            <div className="flex-1 bg-zinc-50/50 rounded-xl border border-zinc-100/50 overflow-hidden relative group/preview min-h-[160px]">
                                {card.type === 'link' ? (
                                    <div className="w-full h-full relative group-hover/preview:opacity-95 transition-all flex flex-col">
                                        {metadata?.image ? (
                                            <div className="w-full h-24 overflow-hidden bg-zinc-100">
                                                <img
                                                    src={metadata.image}
                                                    className="w-full h-full object-cover"
                                                    alt="link preview"
                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-24 bg-sky-50 flex items-center justify-center">
                                                <Globe size={24} className="text-sky-200" />
                                            </div>
                                        )}
                                        <div className="p-3 flex flex-col gap-1">
                                            <span className="text-[11px] font-bold text-zinc-800 line-clamp-1">
                                                {metadata?.title || card.content}
                                            </span>
                                            <p className="text-[10px] text-zinc-500 line-clamp-2 leading-tight">
                                                {metadata?.description || "No description available"}
                                            </p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="w-3 h-3 rounded-full bg-sky-100 flex items-center justify-center">
                                                    <Globe size={8} className="text-sky-500" />
                                                </div>
                                                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">
                                                    {metadata?.siteName || metadata?.url.split('/')[2]?.replace('www.', '') || "Website"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 z-10" />
                                    </div>
                                ) : (card.type as string) === 'widget' ? (
                                    <div className="w-full h-full bg-white flex flex-col">
                                        {card.metadata?.widgetType === 'weather' ? (
                                            <WeatherWidget minimalist />
                                        ) : card.metadata?.widgetType === 'stocks' ? (
                                            <StockWidget symbol={card.metadata?.symbol} minimalist />
                                        ) : (
                                            <NewsCarousel minimalist />
                                        )}
                                    </div>
                                ) : previewType === 'markdown' ? (
                                    <div className="p-4 pt-2 text-[12px] prose prose-zinc lg:prose-base max-w-none text-zinc-600 font-sans leading-snug text-left max-h-[150px] overflow-hidden md-preview relative">
                                        <ReactMarkdown
                                            components={{
                                                h1: ({ node, ...props }) => <h1 className="text-sm font-bold mb-1 text-zinc-900 border-b border-zinc-100 pb-0.5" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-[13px] font-bold mb-1 text-zinc-800" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-[12px] font-bold mb-0.5 text-zinc-800" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0 line-clamp-2" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-3 mb-1.5 space-y-0.5" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal pl-3 mb-1.5 space-y-0.5" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-bold text-zinc-800" {...props} />,
                                            }}
                                        >
                                            {previewContent || ''}
                                        </ReactMarkdown>
                                    </div>
                                ) : previewType === 'html' ? (
                                    <div className="w-full h-full relative group-hover/preview:opacity-90 transition-opacity">
                                        <iframe
                                            srcDoc={previewContent || ''}
                                            className="w-full h-full border-0 pointer-events-none scale-[0.6] origin-top-left"
                                            style={{ width: '166.66%', height: '166.66%' }}
                                            title="HTML Preview"
                                        />
                                        <div className="absolute inset-0 z-10" /> {/* Click protection */}
                                    </div>
                                ) : previewType === 'text' || previewType === 'code' ? (
                                    <div className={cn(
                                        "p-4 text-[10px] leading-relaxed text-zinc-500 whitespace-pre-wrap line-clamp-6 break-words",
                                        previewType === 'code' ? "font-mono text-blue-600/70" : "font-sans"
                                    )}>
                                        {previewContent?.slice(0, 1000) || "Loading preview..."}
                                    </div>
                                ) : previewType === 'image' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-100/50 rounded-xl overflow-hidden relative">
                                        <img
                                            src={`file://${card.metadata.path}`}
                                            alt="preview"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-110"
                                            onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity" />
                                    </div>
                                ) : previewType === 'video' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl overflow-hidden relative">
                                        <video
                                            src={`file://${card.metadata.path}`}
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
                                            <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-[8px] font-bold text-white/90 uppercase tracking-widest">Live Preview</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 grayscale opacity-40">
                                        <File size={32} strokeWidth={1} />
                                        <span className="text-[9px] uppercase font-bold tracking-tighter">No Preview</span>
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-20" />

                                <div
                                    onClick={handleOpenFile}
                                    className="absolute top-2 right-2 p-2 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-zinc-200/50 opacity-0 group-hover/preview:opacity-100 transition-all duration-300 scale-90 hover:scale-110 cursor-pointer z-30 hover:bg-sky-50 hover:border-sky-200 group/btn"
                                    title="Open full file"
                                >
                                    <ExternalLink size={12} className="text-zinc-500 group-hover/btn:text-sky-600 transition-colors" />
                                </div>

                                <button
                                    onClick={handleOpenFile}
                                    className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-zinc-200 shadow-sm text-[10px] font-bold text-zinc-500 opacity-0 group-hover/preview:opacity-100 transition-all duration-300 hover:bg-zinc-50 hover:text-zinc-800 z-30 flex items-center gap-1.5"
                                >
                                    <Eye size={12} />
                                    Read Full
                                </button>
                            </div>
                        )}
                    </div>
                ) : card.type === 'app' ? (
                    <div className="flex items-center gap-3 p-1">
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm",
                            APPS_CONFIG[card.metadata?.appId || '']?.color || 'bg-zinc-400'
                        )}>
                            {React.createElement(APPS_CONFIG[card.metadata?.appId || '']?.icon || AppWindow, { size: 20 })}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-800">{card.content}</span>
                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Application</span>
                        </div>
                    </div>
                ) : isEditing ? (
                    <textarea
                        autoFocus
                        value={card.content}
                        onChange={(e) => onUpdate(card.id, { content: e.target.value })}
                        onBlur={() => setIsEditing(false)}
                        className="w-full h-32 bg-transparent border-none text-sm text-zinc-700 focus:ring-0 p-0 resize-none font-sans leading-relaxed"
                    />
                ) : (
                    <div
                        onDoubleClick={() => setIsEditing(true)}
                        className={cn(
                            "text-sm leading-relaxed text-zinc-700 min-h-[100px] cursor-text",
                            card.type === 'sticky' ? "font-serif italic" : "font-sans"
                        )}
                    >
                        {card.content || "Double click to edit..."}
                    </div>
                )}
            </div>

            {card.type === 'sticky' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-200/50 rounded-tl-full pointer-events-none" />
            )}
        </motion.div>
    );
};
