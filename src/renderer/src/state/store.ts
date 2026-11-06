import { create } from 'zustand';
import type {
  AppInfo,
  KernelStatus,
  PageInstance,
  Settings,
  SurfaceKind,
  SystemStats,
  ToolDescriptor,
  ToastPayload,
} from '@shared/types';
import type { DeepPartial } from '@shared/ipc';
import { invoke } from '../lib/ipc';
import { newId } from '../lib/util';

export interface ToastItem extends ToastPayload {
  id: string;
}

const DEFAULT_PAGE: PageInstance = {
  id: 'page-desktop',
  surface: 'desktop',
  title: 'Desktop',
  params: {},
  pinned: true,
  closable: false,
};

function pageMatches(page: PageInstance, surface: SurfaceKind, params: Record<string, string>): boolean {
  if (page.surface !== surface) return false;
  const keys = new Set([...Object.keys(page.params), ...Object.keys(params)]);
  for (const key of keys) {
    if (key === 'url') return false; // browser tabs are separate pages
    if ((page.params[key] ?? '') !== (params[key] ?? '')) return false;
  }
  return true;
}

interface AppStore {
  settings: Settings | null;
  stats: SystemStats | null;
  kernel: KernelStatus | null;
  info: AppInfo | null;
  tools: ToolDescriptor[];
  pages: PageInstance[];
  activePageId: string;
  ready: boolean;
  bootError: string | null;
  toasts: ToastItem[];
  commandOpen: boolean;
  anchorOpen: boolean;
  dockCollapsed: boolean;
  windowState: { maximized: boolean; focused: boolean; fullscreen: boolean };
  settingsSection: string;
  searchQuery: string;
  hydrate: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  patchSettings: (patch: DeepPartial<Settings>) => Promise<void>;
  navigate: (surface: SurfaceKind, params?: Record<string, string>, opts?: { forceNew?: boolean }) => void;
  setActivePage: (id: string) => void;
  closePage: (id: string) => void;
  pinPage: (id: string) => void;
  pushToast: (toast: ToastPayload) => void;
  dismissToast: (id: string) => void;
  setCommandOpen: (open: boolean) => void;
  setAnchorOpen: (open: boolean) => void;
  toggleDock: () => void;
  setSettingsSection: (section: string) => void;
  setWindowState: (state: { maximized: boolean; focused: boolean; fullscreen: boolean }) => void;
  setSearchQuery: (query: string) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  settings: null,
  stats: null,
  kernel: null,
  info: null,
  tools: [],
  pages: [DEFAULT_PAGE],
  activePageId: DEFAULT_PAGE.id,
  ready: false,
  bootError: null,
  toasts: [],
  commandOpen: false,
  anchorOpen: false,
  dockCollapsed: false,
  windowState: { maximized: false, focused: true, fullscreen: false },
  settingsSection: 'appearance',
  searchQuery: '',

  hydrate: async () => {
    try {
      const [settings, tools, stats, kernel, info] = await Promise.all([
        invoke('settings.get', undefined),
        invoke('tools.list', undefined),
        invoke('system.stats', undefined),
        invoke('system.kernel', undefined),
        invoke('system.info', undefined),
      ]);
      const pages = settings.pages.length ? settings.pages : [DEFAULT_PAGE];
      set({
        settings,
        tools,
        stats,
        kernel,
        info,
        pages,
        activePageId: pages[0]?.id ?? DEFAULT_PAGE.id,
        ready: true,
      });
      document.body.dataset.neuroReady = '1';
    } catch (error) {
      set({ bootError: (error as Error).message, ready: true });
      document.body.dataset.neuroReady = '1';
    }
  },

  setSettings: (settings) => {
    const pages = settings.pages.length ? settings.pages : get().pages;
    set({ settings, pages, activePageId: pages.some((p) => p.id === get().activePageId) ? get().activePageId : pages[0].id });
  },

  patchSettings: async (patch) => {
    const next = await invoke('settings.patch', patch);
    set({ settings: next });
    if (patch.pages) set({ pages: next.pages });
  },

  navigate: (surface, params = {}, opts = {}) => {
    const { pages } = get();
    if (!opts.forceNew) {
      const existing = pages.find((page) => pageMatches(page, surface, params));
      if (existing) {
        set({ activePageId: existing.id });
        return;
      }
    }
    const page: PageInstance = {
      id: newId('page'),
      surface,
      title: surface.charAt(0).toUpperCase() + surface.slice(1),
      params,
      pinned: false,
    };
    const next = [...pages, page];
    set({ pages: next, activePageId: page.id });
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const current = get();
      void invoke('settings.patch', { pages: current.pages }).catch(() => {});
    }, 500);
  },

  setActivePage: (id) => set({ activePageId: id }),

  closePage: (id) => {
    const { pages, activePageId } = get();
    const target = pages.find((page) => page.id === id);
    if (!target || target.closable === false) return;
    const next = pages.filter((page) => page.id !== id);
    const fallback = next[next.length - 1] ?? DEFAULT_PAGE;
    set({ pages: next.length ? next : [DEFAULT_PAGE], activePageId: activePageId === id ? fallback.id : activePageId });
    void invoke('settings.patch', { pages: next.length ? next : [DEFAULT_PAGE] }).catch(() => {});
  },

  pinPage: (id) => {
    const pages = get().pages.map((page) => (page.id === id ? { ...page, pinned: !page.pinned } : page));
    set({ pages });
    void invoke('settings.patch', { pages }).catch(() => {});
  },

  pushToast: (toast) => {
    const item: ToastItem = { ...toast, id: toast.id ?? newId('toast') };
    set({ toasts: [...get().toasts.slice(-3), item] });
    const duration = toast.duration ?? 4200;
    if (duration > 0) setTimeout(() => get().dismissToast(item.id), duration);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setAnchorOpen: (anchorOpen) => set({ anchorOpen }),
  toggleDock: () => set({ dockCollapsed: !get().dockCollapsed }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  setWindowState: (windowState) => set({ windowState }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

export const useSettings = (): Settings | null => useAppStore((s) => s.settings);
