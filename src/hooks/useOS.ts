import { create } from 'zustand';

export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface OSAppWindow {
  id: string;
  title: string;
  component: string; // Key for the component registry
  zIndex: number;
  isFocused: boolean;
  state: WindowState;
  position: { x: number; y: number };
  size: { width: number; height: number };
  lastAction?: { type: string; payload: any; timestamp: number };
}

export interface OSState {
  appWindows: OSAppWindow[];
  activeWindowId: string | null;
  nextZIndex: number;
  isStartMenuOpen: boolean;

  // Actions
  openApp: (component: string, title?: string) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<OSAppWindow>) => void;
  toggleStartMenu: (open?: boolean) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  sendAppAction: (id: string, type: string, payload: any) => void;
}

export const useOS = create<OSState>((set, get) => ({
  appWindows: [],
  activeWindowId: null,
  nextZIndex: 10,
  isStartMenuOpen: false,

  openApp: (component, title) => {
    const { appWindows, nextZIndex } = get();

    // Multi-instance apps (viewer) always open a new window
    const isMultiInstance = component === 'viewer';

    if (!isMultiInstance) {
      // Check if app is already open
      const existing = appWindows.find(windowData => windowData.component === component);
      if (existing) {
        get().focusWindow(existing.id);
        if (existing.state === 'minimized') {
          get().updateWindow(existing.id, { state: 'normal' });
        }
        return;
      }
    }

    const id = Math.random().toString(36).substr(2, 9);

    // Chat gets centered on screen, others stack
    const isChatApp = component === 'chat';
    const defaultSize = isChatApp
      ? { width: 680, height: 580 }
      : { width: 800, height: 600 };
    const defaultPos = isChatApp
      ? { x: Math.round((window.innerWidth - 680) / 2), y: Math.round((window.innerHeight - 580) / 2.4) }
      : { x: 100 + appWindows.length * 30, y: 100 + appWindows.length * 30 };

    const newWindow: OSAppWindow = {
      id,
      title: title || component,
      component,
      zIndex: nextZIndex,
      isFocused: true,
      state: 'normal',
      position: defaultPos,
      size: defaultSize,
    };


    set({
      appWindows: [...appWindows.map(windowData => ({ ...windowData, isFocused: false })), newWindow],
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
      isStartMenuOpen: false,
    });
  },

  closeWindow: (id) => {
    set(state => ({
      appWindows: state.appWindows.filter(windowData => windowData.id !== id),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    }));
  },

  focusWindow: (id) => {
    const { nextZIndex } = get();
    set(state => ({
      appWindows: state.appWindows.map(windowData => ({
        ...windowData,
        isFocused: windowData.id === id,
        zIndex: windowData.id === id ? nextZIndex : windowData.zIndex,
        state: (windowData.id === id && windowData.state === 'minimized') ? 'normal' : windowData.state
      })),
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    }));
  },

  updateWindow: (id, updates) => {
    set(state => ({
      appWindows: state.appWindows.map(windowData => windowData.id === id ? { ...windowData, ...updates } : windowData),
    }));
  },

  toggleStartMenu: (open) => {
    set(state => ({ isStartMenuOpen: open ?? !state.isStartMenuOpen }));
  },

  minimizeWindow: (id) => {
    set(state => ({
      appWindows: state.appWindows.map(windowData => windowData.id === id ? { ...windowData, state: 'minimized', isFocused: false } : windowData),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    }));
  },

  maximizeWindow: (id) => {
    set(state => ({
      appWindows: state.appWindows.map(windowData => windowData.id === id ? { ...windowData, state: 'maximized' } : windowData),
    }));
  },

  sendAppAction: (idOrComponent, type, payload) => {
    set(state => ({
      appWindows: state.appWindows.map(windowData =>
        (windowData.id === idOrComponent || windowData.component === idOrComponent)
          ? { ...windowData, lastAction: { type, payload, timestamp: Date.now() } }
          : windowData
      ),
    }));
  }
}));
