import { create } from 'zustand';

export interface AppNotification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'reminder' | 'pomodoro';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
    action?: { label: string; appId: string; actionType: string; payload: any };
    autoDismissMs: number;
}

interface NotificationState {
    notifications: AppNotification[];
    addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    dismissNotification: (id: string) => void;
    markRead: (id: string) => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
    notifications: [],

    addNotification: (n) => set((state) => ({
        notifications: [
            {
                ...n,
                id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                timestamp: Date.now(),
                read: false,
            },
            ...state.notifications,
        ].slice(0, 50),
    })),

    dismissNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
    })),

    markRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        ),
    })),

    clearAll: () => set({ notifications: [] }),
}));
