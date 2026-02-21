import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

interface AISession {
    id: string;
    startTime: number;
    lastActive: number;
    context: Record<string, any>;
    history: { role: 'user' | 'assistant'; content: string; timestamp: number }[];
}

interface BrowserRequestResult {
    success: boolean;
    data?: any;
    error?: string;
}

interface AIStore {
    sessions: Record<string, AISession>;
    currentSessionId: string | null;
    memory: Record<string, any>;
    browserLogs: { type: 'info' | 'action' | 'error'; message: string; timestamp: number; tabId?: string }[];

    // Promise bridge for browser tool results
    pendingBrowserRequests: Map<string, { resolve: (r: BrowserRequestResult) => void; reject: (e: any) => void }>;

    // Actions
    createSession: () => string;
    switchSession: (id: string) => void;
    addMessage: (role: 'user' | 'assistant', content: string) => void;
    updateMemory: (key: string, value: any) => void;
    addBrowserLog: (log: { type: 'info' | 'action' | 'error'; message: string; tabId?: string }) => void;
    clearBrowserLogs: () => void;

    /** Register a pending request; returns requestId */
    registerBrowserRequest: (resolve: (r: BrowserRequestResult) => void, reject: (e: any) => void) => string;
    /** Resolve a pending request */
    resolveBrowserRequest: (requestId: string, result: BrowserRequestResult) => void;
}

export const useAIStore = create<AIStore>()(
    persist(
        (set, get) => ({
            sessions: {},
            currentSessionId: null,
            memory: {},
            browserLogs: [],
            pendingBrowserRequests: new Map(),

            createSession: () => {
                const id = uuidv4();
                const newSession: AISession = {
                    id,
                    startTime: Date.now(),
                    lastActive: Date.now(),
                    context: {},
                    history: []
                };
                set(state => ({
                    sessions: { ...state.sessions, [id]: newSession },
                    currentSessionId: id
                }));
                return id;
            },

            switchSession: (id: string) => {
                if (get().sessions[id]) {
                    set({ currentSessionId: id });
                }
            },

            addMessage: (role, content) => {
                const { currentSessionId, sessions } = get();
                if (!currentSessionId) return;

                const session = sessions[currentSessionId];
                if (!session) return;

                const newMessage = { role, content, timestamp: Date.now() };
                set(state => ({
                    sessions: {
                        ...state.sessions,
                        [currentSessionId]: {
                            ...session,
                            history: [...session.history, newMessage],
                            lastActive: Date.now()
                        }
                    }
                }));
            },

            updateMemory: (key, value) => {
                set(state => ({
                    memory: { ...state.memory, [key]: value }
                }));
            },

            addBrowserLog: (log) => {
                set(state => ({
                    browserLogs: [
                        ...state.browserLogs,
                        { ...log, timestamp: Date.now() }
                    ].slice(-100) // Keep last 100 logs
                }));
            },

            clearBrowserLogs: () => set({ browserLogs: [] }),

            registerBrowserRequest: (resolve, reject) => {
                const id = `br_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                // Use get() to mutate the Map directly (Map is not frozen by zustand)
                get().pendingBrowserRequests.set(id, { resolve, reject });
                return id;
            },

            resolveBrowserRequest: (requestId, result) => {
                const pending = get().pendingBrowserRequests.get(requestId);
                if (pending) {
                    get().pendingBrowserRequests.delete(requestId);
                    pending.resolve(result);
                }
            },
        }),
        {
            name: 'neuro-ai-store',
            partialize: (state) => ({
                sessions: state.sessions,
                memory: state.memory
            })
        }
    )
);
