import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, GripVertical, FileText, File, Folder, AppWindow, ImageIcon, FileCode } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BoardCard as BoardCardType } from './types';
import { APPS_CONFIG } from '../../lib/apps';
import { useFileSystem } from '../../hooks/useFileSystem';

interface CardProps {
    card: BoardCardType;
    onUpdate: (id: string, updates: Partial<BoardCardType>) => void;
    onDelete: (id: string) => void;
}

export const BoardCard: React.FC<CardProps> = ({ card, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'text' | 'image' | 'code' | 'none'>('none');
    const { readFile } = useFileSystem();

    useEffect(() => {
        if (card.type === 'file' && !card.metadata?.isDirectory && card.metadata?.path) {
            const ext = card.metadata.path.split('.').pop()?.toLowerCase();
            const textExtensions = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'css', 'html', 'py'];
            const imageExtensions = ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'];

            if (textExtensions.includes(ext || '')) {
                const fetchContent = async () => {
                    try {
                        const content = await readFile(card.metadata.path);
                        setPreviewContent(content.slice(0, 1000)); // First 1000 chars
                        setPreviewType(ext === 'md' ? 'text' : (['js', 'ts', 'tsx', 'py'].includes(ext!) ? 'code' : 'text'));
                    } catch (e) {
                        console.error('Failed to read file for preview', e);
                    }
                };
                fetchContent();
            } else if (imageExtensions.includes(ext || '')) {
                setPreviewType('image');
                // For images, we might use a dedicated API or just a path if the browser can see it
                // Local server usually serves these
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
                {card.type === 'file' ? (
                    <div className="flex flex-col gap-2 p-1 h-full min-h-[120px]">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-zinc-50 flex items-center justify-center text-zinc-400">
                                {card.metadata?.isDirectory ? <Folder size={14} /> : (previewType === 'code' ? <FileCode size={14} /> : <FileText size={14} />)}
                            </div>
                            <span className="text-[11px] font-bold truncate text-zinc-600 tracking-tight">{card.content}</span>
                        </div>

                        {/* Preview Area */}
                        {!card.metadata?.isDirectory && (
                            <div className="flex-1 bg-zinc-50/50 rounded-lg p-3 border border-zinc-100/50 overflow-hidden relative group/preview">
                                {previewType === 'text' || previewType === 'code' ? (
                                    <div className={cn(
                                        "text-[10px] leading-relaxed text-zinc-500 whitespace-pre-wrap line-clamp-[10] break-words",
                                        previewType === 'code' ? "font-mono text-blue-600/70" : "font-sans"
                                    )}>
                                        {previewContent || "Loading preview..."}
                                    </div>
                                ) : previewType === 'image' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-100 rounded">
                                        <ImageIcon size={24} className="text-zinc-300" />
                                        <span className="sr-only">Image Preview</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 grayscale opacity-40">
                                        <File size={32} strokeWidth={1} />
                                        <span className="text-[9px] uppercase font-bold tracking-tighter">No Preview</span>
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-50/80 to-transparent pointer-events-none" />
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
