import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  thinking?: Array<{
    id: string;
    type: string;
    content: string;
    detail?: string;
    tool?: string;
    timestamp: number;
    duration?: number;
  }>;
  toolSummary?: Array<{
    tool: string;
    status: 'success' | 'error';
    preview: string;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string;
  workspacePath: string | null;
  tags: string[];
}

interface SessionState {
  sessions: ChatSession[];
  activeSessionId: string | null;

  // Actions
  createSession: (model: string, provider: string, workspacePath: string | null) => ChatSession;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  getActiveSession: () => ChatSession | null;
  updateSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  addSessionTag: (sessionId: string, tag: string) => void;
  clearOldSessions: (keepDays: number) => void;

  // Persistence to workspace
  saveSessionToWorkspace: (sessionId: string, workspacePath: string) => Promise<boolean>;
  loadSessionFromWorkspace: (sessionId: string, workspacePath: string) => Promise<ChatSession | null>;
  listWorkspaceSessions: (workspacePath: string) => Promise<ChatSession[]>;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (model, provider, workspacePath) => {
        const session: ChatSession = {
          id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model,
          provider,
          workspacePath,
          tags: [],
        };

        set(state => ({
          sessions: [session, ...state.sessions].slice(0, 50), // Keep max 50 sessions
          activeSessionId: session.id,
        }));

        return session;
      },

      deleteSession: (sessionId) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }));
      },

      setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId });
      },

      getActiveSession: () => {
        const state = get();
        return state.sessions.find(s => s.id === state.activeSessionId) || null;
      },

      updateSessionMessages: (sessionId, messages) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  messages,
                  updatedAt: Date.now(),
                  title: s.title === 'New Chat' && messages.length > 0
                    ? messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? '...' : '')
                    : s.title,
                }
              : s
          ),
        }));
      },

      updateSessionTitle: (sessionId, title) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s
          ),
        }));
      },

      addSessionTag: (sessionId, tag) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId && !s.tags.includes(tag)
              ? { ...s, tags: [...s.tags, tag], updatedAt: Date.now() }
              : s
          ),
        }));
      },

      clearOldSessions: (keepDays) => {
        const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
        set(state => ({
          sessions: state.sessions.filter(s => s.updatedAt > cutoff),
        }));
      },

      // Workspace persistence
      saveSessionToWorkspace: async (sessionId, workspacePath) => {
        try {
          const session = get().sessions.find(s => s.id === sessionId);
          if (!session || !workspacePath) return false;

          const electron = (window as any).electron;
          if (!electron?.fileSystem?.write) return false;

          const sessionsDir = `${workspacePath}/.neuro/sessions`;
          await electron.fileSystem.createDir(sessionsDir);

          const filePath = `${sessionsDir}/${sessionId}.json`;
          await electron.fileSystem.write(filePath, JSON.stringify(session, null, 2));

          return true;
        } catch (e) {
          console.error('Failed to save session:', e);
          return false;
        }
      },

      loadSessionFromWorkspace: async (sessionId, workspacePath) => {
        try {
          const electron = (window as any).electron;
          if (!electron?.fileSystem?.read) return null;

          const filePath = `${workspacePath}/.neuro/sessions/${sessionId}.json`;
          const content = await electron.fileSystem.read(filePath);
          const session = JSON.parse(content) as ChatSession;

          // Add to sessions if not already present
          const existing = get().sessions.find(s => s.id === sessionId);
          if (!existing) {
            set(state => ({
              sessions: [session, ...state.sessions].slice(0, 50),
            }));
          }

          return session;
        } catch (e) {
          console.error('Failed to load session:', e);
          return null;
        }
      },

      listWorkspaceSessions: async (workspacePath) => {
        try {
          const electron = (window as any).electron;
          if (!electron?.fileSystem?.list) return [];

          const sessionsDir = `${workspacePath}/.neuro/sessions`;
          const files = await electron.fileSystem.list(sessionsDir);

          const sessions: ChatSession[] = [];
          for (const file of files) {
            if (file.name.endsWith('.json')) {
              const content = await electron.fileSystem.read(file.path);
              try {
                const session = JSON.parse(content) as ChatSession;
                sessions.push(session);
              } catch {}
            }
          }

          return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (e) {
          console.error('Failed to list sessions:', e);
          return [];
        }
      },
    }),
    {
      name: 'neuro-sessions',
      version: 1,
    }
  )
);
