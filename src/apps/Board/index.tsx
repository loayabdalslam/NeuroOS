import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    StickyNote,
    Type,
    FileText,
    Layout,
    Save,
    Search,
    MoreHorizontal,
    X,
    FolderPlus,
    Maximize2,
    Minimize2,
    FilePlus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { OSAppWindow, useOS } from '../../hooks/useOS';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { BoardData, BoardCard as CardType, BoardGroup as GroupType, CardType as CType } from './types';
import { BoardCard } from './BoardCard';
import { BoardGroup } from './BoardGroup';

interface BoardProps {
    windowData: OSAppWindow;
}

export const BoardApp: React.FC<BoardProps> = ({ windowData }) => {
    const { workspacePath } = useWorkspaceStore();
    const { writeFile, readFile, listFiles, createDir } = useFileSystem();
    const [board, setBoard] = useState<BoardData>({
        id: 'default',
        name: 'New Project',
        cards: [],
        groups: [],
        updatedAt: Date.now()
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Load board data
    useEffect(() => {
        const loadBoard = async () => {
            if (!workspacePath) return;
            const boardsDir = `${workspacePath}/.neuro/boards`;
            try {
                await createDir(boardsDir);
                const files = await listFiles(boardsDir);
                if (files.length > 0) {
                    const content = await readFile(`${boardsDir}/${files[0].name}`);
                    setBoard(JSON.parse(content));
                }
            } catch (e) {
                console.error('Failed to load board', e);
            }
        };
        loadBoard();
    }, [workspacePath]);

    const saveBoard = useCallback(async (currentBoard: BoardData) => {
        if (!workspacePath) return;
        setIsSaving(true);
        const path = `${workspacePath}/.neuro/boards/${currentBoard.name.replace(/\s+/g, '_').toLowerCase()}.json`;
        try {
            await writeFile(path, JSON.stringify(currentBoard, null, 2));
        } catch (e) {
            console.error('Failed to save board', e);
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    }, [workspacePath, writeFile]);

    const addCard = (type: CType, initialProps?: Partial<CardType>) => {
        const newCard: CardType = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            content: initialProps?.content || (type === 'note' ? 'Double click to edit note...' : 'Sticky note content...'),
            position: initialProps?.position || { x: 100 + board.cards.length * 20, y: 100 + board.cards.length * 20 },
            color: initialProps?.color || (type === 'sticky' ? 'bg-amber-100' : 'bg-white'),
            metadata: initialProps?.metadata
        };
        const updated = { ...board, cards: [...board.cards, newCard], updatedAt: Date.now() };
        setBoard(updated);
        saveBoard(updated);
    };

    const updateCard = (id: string, updates: Partial<CardType>) => {
        setBoard(prev => {
            // Check if card was moved into a group
            let groupId = updates.groupId;

            if (updates.position && !updates.groupId) {
                const droppedCard = prev.cards.find(c => c.id === id);
                if (droppedCard) {
                    const groupAtPos = prev.groups.find(g => {
                        // Proximity check - ideally we'd use dynamic bounds, but let's use a standard area for now
                        const isInside =
                            updates.position!.x >= g.position.x - 20 &&
                            updates.position!.x <= g.position.x + 420 &&
                            updates.position!.y >= g.position.y - 20 &&
                            updates.position!.y <= g.position.y + 320;
                        return isInside;
                    });
                    groupId = groupAtPos ? groupAtPos.id : undefined;
                }
            }

            const updated = {
                ...prev,
                cards: prev.cards.map(c => c.id === id ? { ...c, ...updates, groupId: groupId !== undefined ? groupId : c.groupId } : c),
                updatedAt: Date.now()
            };
            saveBoard(updated);
            return updated;
        });
    };

    const deleteCard = (id: string) => {
        setBoard(prev => {
            const updated = {
                ...prev,
                cards: prev.cards.filter(c => c.id !== id),
                updatedAt: Date.now()
            };
            saveBoard(updated);
            return updated;
        });
    };

    const addGroup = () => {
        const newGroup: GroupType = {
            id: Math.random().toString(36).substr(2, 9),
            title: 'New Group',
            position: { x: 100, y: 100 }
        };
        const updated = { ...board, groups: [...board.groups, newGroup], updatedAt: Date.now() };
        setBoard(updated);
        saveBoard(updated);
    };

    const updateGroup = (id: string, updates: Partial<GroupType>) => {
        setBoard(prev => {
            const group = prev.groups.find(g => g.id === id);
            if (!group) return prev;

            const updatedGroups = prev.groups.map(g => g.id === id ? { ...g, ...updates } : g);

            // If position changed, move all cards in this group
            let updatedCards = prev.cards;
            if (updates.position && group.position) {
                const dx = updates.position.x - group.position.x;
                const dy = updates.position.y - group.position.y;

                updatedCards = prev.cards.map(c =>
                    c.groupId === id
                        ? { ...c, position: { x: c.position.x + dx, y: c.position.y + dy } }
                        : c
                );
            }

            const updated = {
                ...prev,
                groups: updatedGroups,
                cards: updatedCards,
                updatedAt: Date.now()
            };
            saveBoard(updated);
            return updated;
        });
    };

    const deleteGroup = (id: string) => {
        setBoard(prev => {
            const updated = {
                ...prev,
                groups: prev.groups.filter(g => g.id !== id),
                updatedAt: Date.now()
            };
            saveBoard(updated);
            return updated;
        });
    };

    const handleAddFile = async () => {
        try {
            // @ts-ignore - OS might provide selective typing for specialized tools
            const files = await window.os.selectFiles();
            if (files && files.length > 0) {
                files.forEach((file: any) => {
                    addCard('file', {
                        content: file.name,
                        metadata: { path: file.path, isDirectory: false }
                    });
                });
            }
        } catch (e) {
            console.error('Failed to select files', e);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check for file drop
        const fileData = e.dataTransfer.getData('neuro/file');
        if (fileData) {
            const file = JSON.parse(fileData);
            addCard('file', {
                content: file.name,
                position: { x, y },
                metadata: { path: file.path, isDirectory: file.isDirectory }
            });
            return;
        }

        // Check for app drop
        const appData = e.dataTransfer.getData('neuro/app');
        if (appData) {
            const app = JSON.parse(appData);
            addCard('app', {
                content: app.name,
                position: { x, y },
                metadata: { appId: app.id }
            });
            return;
        }
    };

    return (
        <div
            className="flex flex-col h-full bg-[#fafafa] font-sans overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-200/50 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-lg outline-none">
                        <Layout size={16} className="text-zinc-400" />
                        <input
                            value={board.name}
                            onChange={(e) => setBoard({ ...board, name: e.target.value })}
                            className="bg-transparent border-none text-sm font-bold text-zinc-700 w-32 focus:ring-0 p-0"
                            placeholder="Board Name"
                        />
                    </div>

                    <div className="h-6 w-[1px] bg-zinc-200 mx-1" />

                    <div className="flex items-center gap-1">
                        <button onClick={() => addCard('note')} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="Add Note">
                            <Type size={18} />
                        </button>
                        <button onClick={() => addCard('sticky')} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="Add Sticky">
                            <StickyNote size={18} />
                        </button>
                        <button onClick={handleAddFile} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="Add File">
                            <FilePlus size={18} />
                        </button>
                        <button onClick={addGroup} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors" title="Add Group">
                            <FolderPlus size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-sky-500 transition-colors" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search board..."
                            className="pl-9 pr-4 py-1.5 bg-zinc-100 border-none rounded-lg text-xs w-48 focus:ring-2 focus:ring-sky-500/20 transition-all outline-none"
                        />
                    </div>
                    <button
                        onClick={() => saveBoard(board)}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            isSaving ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800"
                        )}
                    >
                        <Save size={14} className={isSaving ? "animate-spin" : ""} />
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                ref={canvasRef}
                className="flex-1 relative overflow-auto p-20 select-none bg-grid-zinc-100/50"
                style={{
                    backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
            >
                <AnimatePresence>
                    {board.groups.map(group => (
                        <BoardGroup
                            key={group.id}
                            group={group}
                            cards={board.cards}
                            onUpdate={updateGroup}
                            onDelete={deleteGroup}
                        />
                    ))}

                    {board.cards.map(card => (
                        <BoardCard
                            key={card.id}
                            card={card}
                            onUpdate={updateCard}
                            onDelete={deleteCard}
                        />
                    ))}
                </AnimatePresence>

                {board.cards.length === 0 && board.groups.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-4">
                        <Layout size={64} strokeWidth={1} />
                        <p className="text-sm font-medium">Your canvas is empty. Start adding notes!</p>
                        <div className="flex gap-2">
                            <button onClick={() => addCard('note')} className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">Add Note</button>
                            <button onClick={() => addCard('sticky')} className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">Add Sticky</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
