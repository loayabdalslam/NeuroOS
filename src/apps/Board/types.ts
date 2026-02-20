export type CardType = 'note' | 'sticky' | 'file' | 'app';

export interface BoardCard {
    id: string;
    type: CardType;
    title?: string;
    content: string;
    position: { x: number; y: number };
    groupId?: string;
    color?: string;
    metadata?: Record<string, any>;
}

export interface BoardGroup {
    id: string;
    title: string;
    position: { x: number; y: number };
    color?: string;
}

export interface BoardData {
    id: string;
    name: string;
    cards: BoardCard[];
    groups: BoardGroup[];
    updatedAt: number;
}
