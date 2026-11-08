import { create } from 'zustand';
import type { AgentEvent, ChatMessage, ChatSession, ChatSessionFull } from '@shared/types';
import { invoke } from '../lib/ipc';
import { useAppStore } from './store';

interface ChatState {
  sessions: ChatSession[];
  activeId: string | null;
  active: ChatSessionFull | null;
  streaming: boolean;
  status: string;
  draft: string;
  error: string | null;
  attachments: ChatMessage['attachments'];
  loading: boolean;
  loadSessions: () => Promise<void>;
  open: (id: string) => Promise<void>;
  create: (params?: { providerId?: string; model?: string; agentId?: string; spaceId?: string }) => Promise<void>;
  send: () => Promise<void>;
  cancel: () => Promise<void>;
  regenerate: () => Promise<void>;
  approve: (callId: string, approved: boolean, always?: boolean) => Promise<void>;
  setDraft: (draft: string) => void;
  setActiveMeta: (patch: Partial<ChatSession>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  handleEvent: (event: AgentEvent) => void;
  reset: () => void;
}

function updateMessage(messages: ChatMessage[], id: string, fn: (message: ChatMessage) => ChatMessage): ChatMessage[] {
  return messages.map((message) => (message.id === id ? fn({ ...message }) : message));
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeId: null,
  active: null,
  streaming: false,
  status: '',
  draft: '',
  error: null,
  attachments: [],
  loading: false,

  loadSessions: async () => {
    const sessions = await invoke('chat.sessions', undefined);
    set({ sessions });
    if (!get().activeId && sessions.length) await get().open(sessions[0].id);
  },

  open: async (id) => {
    set({ loading: true, error: null });
    try {
      const active = await invoke('chat.session', { id });
      set({ activeId: id, active, loading: false, streaming: false, status: '' });
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
    }
  },

  create: async (params) => {
    const session = await invoke('chat.create', params ?? {});
    set({ sessions: [session, ...get().sessions], activeId: session.id, active: session, draft: '' });
  },

  send: async () => {
    const { active, draft, activeId } = get();
    if (!draft.trim() || !active || !activeId) return;
    const text = draft.trim();
    const userMessage: ChatMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      attachments: get().attachments,
    };
    const assistantMessage: ChatMessage = {
      id: `pending_${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      model: active.model,
    };
    set({
      draft: '',
      attachments: [],
      streaming: true,
      status: 'Thinking',
      active: { ...active, messages: [...active.messages, userMessage, assistantMessage] },
    });
    try {
      await invoke('chat.send', { sessionId: activeId, text, attachments: get().attachments as never });
      void get().loadSessions().then(() => {
        const sessions = get().sessions.map((session) => (session.id === activeId ? { ...session, title: text.slice(0, 56) } : session));
        set({ sessions });
      });
    } catch (error) {
      set({ streaming: false, status: '', error: (error as Error).message });
      useAppStore.getState().pushToast({ title: 'Could not send', message: (error as Error).message, kind: 'error' });
    }
  },

  cancel: async () => {
    const id = get().activeId;
    if (!id) return;
    await invoke('chat.cancel', { sessionId: id });
    set({ streaming: false, status: 'Stopped' });
  },

  approve: async (callId, approved, always) => {
    await invoke('chat.approve', { callId, approve: approved, always });
  },

  setDraft: (draft) => set({ draft }),

  regenerate: async () => {
    const id = get().activeId;
    if (!id) return;
    set({ streaming: true, status: 'Regenerating' });
    try {
      await invoke('chat.regenerate', { sessionId: id });
      const active = await invoke('chat.session', { id });
      set({ active });
    } catch (error) {
      set({ streaming: false, status: '' });
      useAppStore.getState().pushToast({ title: 'Could not regenerate', message: (error as Error).message, kind: 'error' });
    }
  },

  setActiveMeta: async (patch) => {
    const id = get().activeId;
    if (!id) return;
    const updated = await invoke('chat.patch', { id, ...patch });
    set({ sessions: get().sessions.map((session) => (session.id === id ? updated : session)), active: get().active ? { ...get().active!, ...updated } : null });
  },

  remove: async (id) => {
    await invoke('chat.delete', { id });
    const sessions = get().sessions.filter((session) => session.id !== id);
    set({ sessions });
    if (get().activeId === id) {
      if (sessions[0]) await get().open(sessions[0].id);
      else set({ active: null, activeId: null });
    }
  },

  reset: () => set({ active: null, activeId: null, streaming: false, status: '', error: null }),

  handleEvent: (event) => {
    const state = get();
    if (!state.active || state.active.id !== event.sessionId) {
      // Keep the sidebar fresh even for background sessions.
      if (event.type === 'turn_end') void state.loadSessions();
      return;
    }
    const active = state.active;

    switch (event.type) {
      case 'turn_start': {
        set({ streaming: true, status: 'Thinking' });
        break;
      }
      case 'status': {
        set({ status: event.status });
        break;
      }
      case 'text_delta': {
        set({
          status: '',
          active: {
            ...active,
            messages: updateMessage(active.messages, event.messageId, (message) => ({ ...message, content: message.content + event.delta })),
          },
        });
        break;
      }
      case 'reasoning_delta': {
        set({
          active: {
            ...active,
            messages: updateMessage(active.messages, event.messageId, (message) => ({ ...message, reasoning: (message.reasoning ?? '') + event.delta })),
          },
        });
        break;
      }
      case 'tool_call':
      case 'tool_result': {
        set({
          status: event.call.status === 'pending' ? `Waiting for approval · ${event.call.name}` : `Running ${event.call.name}`,
          active: {
            ...active,
            messages: updateMessage(active.messages, event.messageId, (message) => {
              const calls = [...(message.toolCalls ?? [])];
              const index = calls.findIndex((call) => call.id === event.call.id);
              if (index >= 0) calls[index] = event.call;
              else calls.push(event.call);
              return { ...message, toolCalls: calls };
            }),
          },
        });
        break;
      }
      case 'usage': {
        set({
          active: {
            ...active,
            messages: updateMessage(active.messages, event.messageId, (message) => ({ ...message, usage: event.usage })),
          },
        });
        break;
      }
      case 'turn_end': {
        set({ streaming: false, status: event.reason === 'max_steps' ? 'Step limit reached' : '' });
        void state.loadSessions().then(() => {
          const updated = get().sessions.find((session) => session.id === active.id);
          if (updated) set({ sessions: get().sessions, active: get().active ? { ...get().active!, updatedAt: updated.updatedAt, title: updated.title } : null });
        });
        break;
      }
      case 'error': {
        const failed = updateMessage(active.messages, (event as { messageId?: string }).messageId ?? active.messages[active.messages.length - 1]?.id ?? '', (message) => ({
          ...message,
          error: event.message,
          content: message.content || `⚠️ ${event.message}`,
        }));
        set({ streaming: false, status: '', error: event.message, active: { ...active, messages: failed } });
        useAppStore.getState().pushToast({ title: 'Agent error', message: event.message, kind: 'error', duration: 7000 });
        break;
      }
      default:
        break;
    }
  },
}));
