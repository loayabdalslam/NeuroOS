import React from 'react';
import { motion } from 'motion/react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BoardGroup as GroupType, BoardCard as CardType } from './types';

interface GroupProps {
    group: GroupType;
    cards: CardType[];
    onUpdate: (id: string, updates: Partial<GroupType>) => void;
    onDelete: (id: string) => void;
}

export const BoardGroup: React.FC<GroupProps> = ({ group, cards, onUpdate, onDelete }) => {
    // Calculate bounding box of cards in this group
    const PADDING = 40;
    const groupCards = cards.filter(c => c.groupId === group.id);

    const bounds = groupCards.reduce((acc, card) => {
        return {
            minX: Math.min(acc.minX, card.position.x),
            minY: Math.min(acc.minY, card.position.y),
            maxX: Math.max(acc.maxX, card.position.x + 256), // Assuming card width is 256
            maxY: Math.max(acc.maxY, card.position.y + 160)  // Estimated card height
        };
    }, {
        minX: group.position.x,
        minY: group.position.y,
        maxX: group.position.x + 320,
        maxY: group.position.y + 220
    });

    const groupWidth = Math.max(320, (bounds.maxX - bounds.minX) + PADDING * 2);
    const groupHeight = Math.max(220, (bounds.maxY - bounds.minY) + PADDING * 2);

    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => {
                onUpdate(group.id, {
                    position: {
                        x: group.position.x + info.offset.x,
                        y: group.position.y + info.offset.y
                    }
                });
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
                opacity: 1,
                scale: 1,
                width: groupWidth,
                height: groupHeight,
                left: bounds.minX - PADDING,
                top: bounds.minY - PADDING
            }}
            className="absolute bg-zinc-100/20 border-2 border-dashed border-zinc-200 rounded-[2.5rem] p-6 group/group z-10"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1 cursor-grab active:cursor-grabbing text-zinc-300">
                        <GripVertical size={14} />
                    </div>
                    <input
                        defaultValue={group.title}
                        onBlur={(e) => onUpdate(group.id, { title: e.target.value })}
                        className="bg-transparent border-none text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 focus:ring-0 p-0 w-full outline-none"
                    />
                </div>
                <button
                    onClick={() => onDelete(group.id)}
                    className="p-1 rounded-md opacity-0 group-hover/group:opacity-100 text-zinc-300 hover:text-red-400 transition-all"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Visual indicator for drop zone */}
            <div className="absolute inset-4 rounded-[2rem] border border-zinc-100/50 pointer-events-none" />
        </motion.div>
    );
};
