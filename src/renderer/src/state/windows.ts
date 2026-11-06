import { create } from 'zustand';
import type { OsWindow, WindowBounds } from '@shared/types';
import { appById } from '@shared/apps';
import { newId } from '../lib/util';

interface WindowStore {
  windows: OsWindow[];
  focusedId: string | null;
  zTop: number;
  startOpen: boolean;
  locked: boolean;
  open: (appId: string, opts?: { params?: Record<string, string>; bounds?: Partial<WindowBounds> }) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  setBounds: (id: string, bounds: Partial<WindowBounds>) => void;
  snap: (id: string, side: 'left' | 'right' | null) => void;
  closeAll: () => void;
  minimizeAll: () => void;
  setStartOpen: (open: boolean) => void;
  setLocked: (locked: boolean) => void;
  restoreAll: () => void;
}

const TITLEBAR = 46;
const TASKBAR = 52;

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  focusedId: null,
  zTop: 10,
  startOpen: false,
  locked: false,

  open: (appId, opts) => {
    const app = appById(appId);
    const existing = get().windows.find((win) => win.appId === appId);
    if (existing) {
      get().focus(existing.id);
      if (existing.minimized) {
        set({ windows: get().windows.map((win) => (win.id === existing.id ? { ...win, minimized: false } : win)) });
      }
      return existing.id;
    }
    const width = opts?.bounds?.width ?? app?.width ?? 900;
    const height = opts?.bounds?.height ?? app?.height ?? 600;
    const maxWidth = window.innerWidth - 120;
    const maxHeight = window.innerHeight - TITLEBAR - TASKBAR - 40;
    const w = Math.min(width, Math.max(480, maxWidth));
    const h = Math.min(height, Math.max(320, maxHeight));
    const offset = get().windows.length * 42;
    const x = opts?.bounds?.x ?? Math.round((window.innerWidth - w) / 2 - 90 + offset);
    const y = opts?.bounds?.y ?? Math.round((window.innerHeight - TITLEBAR - TASKBAR - h) / 2 - 60 + offset / 2);
    const win: OsWindow = {
      id: newId('win'),
      appId,
      title: app?.name ?? appId,
      icon: app?.icon ?? 'square',
      accent: app?.accent ?? '#5686fe',
      x: Math.max(12, x),
      y: Math.max(8, y),
      width: w,
      height: h,
      z: get().zTop + 1,
      minimized: false,
      maximized: false,
      resizable: app?.resizable !== false,
      createdAt: new Date().toISOString(),
    };
    set({ windows: [...get().windows, win], focusedId: win.id, zTop: win.z });
    return win.id;
  },

  close: (id) => {
    const windows = get().windows.filter((win) => win.id !== id);
    const focusedId = get().focusedId === id ? windows.slice().sort((a, b) => b.z - a.z)[0]?.id ?? null : get().focusedId;
    set({ windows, focusedId });
  },

  focus: (id) => {
    const z = get().zTop + 1;
    set({
      windows: get().windows.map((win) => (win.id === id ? { ...win, z, minimized: false } : win)),
      focusedId: id,
      zTop: z,
    });
  },

  minimize: (id) => {
    set({ windows: get().windows.map((win) => (win.id === id ? { ...win, minimized: true } : win)) });
    const remaining = get().windows.filter((win) => !win.minimized && win.id !== id).sort((a, b) => b.z - a.z);
    set({ focusedId: remaining[0]?.id ?? null });
  },

  toggleMinimize: (id) => {
    const win = get().windows.find((item) => item.id === id);
    if (!win) return;
    if (win.minimized) get().focus(id);
    else get().minimize(id);
  },

  toggleMaximize: (id) => {
    set({
      windows: get().windows.map((win) => {
        if (win.id !== id) return win;
        if (win.maximized && win.restore) {
          return { ...win, maximized: false, ...win.restore, restore: undefined };
        }
        return {
          ...win,
          maximized: true,
          restore: { x: win.x, y: win.y, width: win.width, height: win.height },
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight - TITLEBAR - TASKBAR,
        };
      }),
    });
    get().focus(id);
  },

  setBounds: (id, bounds) => {
    set({
      windows: get().windows.map((win) => {
        if (win.id !== id) return win;
        return {
          ...win,
          x: bounds.x ?? win.x,
          y: bounds.y ?? win.y,
          width: Math.max(360, bounds.width ?? win.width),
          height: Math.max(240, bounds.height ?? win.height),
        };
      }),
    });
  },

  snap: (id, side) => {
    const width = window.innerWidth;
    const height = window.innerHeight - TITLEBAR - TASKBAR;
    set({
      windows: get().windows.map((win) => {
        if (win.id !== id) return win;
        if (!side) return win.maximized ? { ...win, maximized: false, ...(win.restore ?? {}) } : win;
        return {
          ...win,
          maximized: false,
          restore: win.restore ?? { x: win.x, y: win.y, width: win.width, height: win.height },
          x: side === 'left' ? 0 : Math.round(width / 2),
          y: 0,
          width: Math.round(width / 2),
          height,
        };
      }),
    });
  },

  closeAll: () => set({ windows: [], focusedId: null }),
  minimizeAll: () => set({ windows: get().windows.map((win) => ({ ...win, minimized: true })), focusedId: null }),
  setStartOpen: (startOpen) => set({ startOpen }),
  setLocked: (locked) => set({ locked }),
  restoreAll: () => set({ windows: get().windows.map((win) => ({ ...win, minimized: false })) }),
}));
