import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
    label: string;
    icon?: LucideIcon;
    shortcut?: string;
    action: () => void;
    danger?: boolean;
    disabled?: boolean;
}

export interface ContextMenuDivider {
    type: 'divider';
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

function isDivider(entry: ContextMenuEntry): entry is ContextMenuDivider {
    return 'type' in entry && entry.type === 'divider';
}

interface ContextMenuState {
    x: number;
    y: number;
    items: ContextMenuEntry[];
}

// Global context menu store
let globalSetMenu: ((menu: ContextMenuState | null) => void) | null = null;

export function showContextMenu(x: number, y: number, items: ContextMenuEntry[]) {
    globalSetMenu?.({ x, y, items });
}

export function useContextMenu(getItems: () => ContextMenuEntry[]) {
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, getItems());
    }, [getItems]);

    return { onContextMenu: handleContextMenu };
}

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [menu, setMenu] = useState<ContextMenuState | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        globalSetMenu = setMenu;
        return () => { globalSetMenu = null; };
    }, []);

    // Close on click anywhere / Escape / scroll
    useEffect(() => {
        if (!menu) return;

        const close = () => setMenu(null);
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
        window.addEventListener('keydown', handleEsc);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);

        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('contextmenu', close);
            window.removeEventListener('keydown', handleEsc);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [menu]);

    // Adjust position so the menu doesn't overflow the viewport
    const adjustedPos = menu ? (() => {
        const menuW = 200;
        const menuH = menu.items.length * 34 + 16;
        return {
            x: Math.min(menu.x, window.innerWidth - menuW - 8),
            y: Math.min(menu.y, window.innerHeight - menuH - 8),
        };
    })() : null;

    return (
        <>
            {children}
            <AnimatePresence>
                {menu && adjustedPos && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -4 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 500, mass: 0.5 }}
                        className="fixed z-[9999] min-w-[180px] max-w-[260px] bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl shadow-zinc-300/40 border border-zinc-200/80 py-1.5 overflow-hidden"
                        style={{ left: adjustedPos.x, top: adjustedPos.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        {menu.items.map((entry, i) => {
                            if (isDivider(entry)) {
                                return <div key={`div-${i}`} className="my-1.5 h-px bg-zinc-100 mx-2" />;
                            }
                            const item = entry;
                            return (
                                <button
                                    key={`${item.label}-${i}`}
                                    disabled={item.disabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!item.disabled) {
                                            item.action();
                                            setMenu(null);
                                        }
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium transition-colors",
                                        item.disabled
                                            ? "text-zinc-300 cursor-not-allowed"
                                            : item.danger
                                                ? "text-red-500 hover:bg-red-50"
                                                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                                    )}
                                >
                                    {item.icon && <item.icon size={14} className="shrink-0 opacity-60" />}
                                    <span className="flex-1 text-left truncate">{item.label}</span>
                                    {item.shortcut && (
                                        <span className="text-[10px] text-zinc-300 font-mono ml-auto shrink-0">{item.shortcut}</span>
                                    )}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
