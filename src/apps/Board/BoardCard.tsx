import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, GripVertical, FileText, File, Folder, AppWindow } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BoardCard as BoardCardType } from './types';
import { APPS_CONFIG } from '../../lib/apps';

interface CardProps {
    card: BoardCardType;
    onUpdate: (id: string, updates: Partial<BoardCardType>) => void;
    onDelete: (id: string) => void;
}

export const BoardCard: React.FC<CardProps> = ({ card, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);

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
                    <div className="flex items-center gap-3 p-1">
                        <div className="w-10 h-10 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400">
                            {card.metadata?.isDirectory ? <Folder size={20} /> : <File size={20} />}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-semibold truncate text-zinc-700">{card.content}</span>
                            <span className="text-[9px] text-zinc-400 truncate font-mono uppercase tracking-tight">{card.metadata?.isDirectory ? 'Folder' : 'File'}</span>
                        </div>
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
