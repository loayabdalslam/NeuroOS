import { Component, useEffect, useState, type ReactNode } from 'react';
import type { BrainCaptureInput, SurfaceKind } from '@shared/types';
import { languageByCode } from '@shared/i18n';
import { useAppStore } from './state/store';
import { useChatStore } from './state/chat';
import { on, invoke, modKey } from './lib/ipc';
import { TitleBar } from './components/TitleBar';
import { Dock } from './components/Dock';
import { Taskbar } from './components/Taskbar';
import { AnchorRail } from './components/AnchorRail';
import { CommandPalette } from './components/CommandPalette';
import { ToastHost } from './components/ToastHost';
import { BrandMark } from './components/BrandMark';
import { Onboarding } from './onboarding/Onboarding';
import { StoryIntro } from './onboarding/StoryIntro';
import { photoWallpaper, wallpaperUrl } from '@shared/themes';
import { Desktop } from './surfaces/Desktop';
import { Chat } from './surfaces/Chat';
import { Workspace } from './surfaces/Workspace';
import { Spaces } from './surfaces/Spaces';
import { NotebookSurface } from './surfaces/Notebook';
import { BrowserSurface } from './surfaces/Browser';
import { SitesSurface } from './surfaces/Sites';
import { BrainSurface } from './surfaces/Brain';
import { TerminalSurface } from './surfaces/Terminal';
import { MailSurface } from './surfaces/Mail';
import { AutomationSurface } from './surfaces/Automation';
import { ComposerSurface } from './surfaces/Composer';
import { Marketplace } from './surfaces/Marketplace';
import { SettingsSurface } from './surfaces/Settings';
import { StartMenu } from './components/StartMenu';
import { LockScreen } from './components/LockScreen';
import { useWindowStore } from './state/windows';

export function App(): JSX.Element {
  const ready = useAppStore((s) => s.ready);
  const bootError = useAppStore((s) => s.bootError);
  const settings = useAppStore((s) => s.settings);
  const hydrate = useAppStore((s) => s.hydrate);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storySeen, setStorySeen] = useState(() => localStorage.getItem('neuro.story') === 'done');

  useEffect(() => {
    const open = (): void => setStoryOpen(true);
    window.addEventListener('neuro:story', open);
    return () => window.removeEventListener('neuro:story', open);
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  /* ---- global theme + locale projection ---- */
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const mode = settings.theme.mode === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme.mode;
    const language = languageByCode(settings.locale);
    root.dataset.theme = mode;
    root.dataset.accent = settings.theme.accent;
    root.dataset.design = settings.theme.design;
    root.dataset.surface = settings.theme.surface;
    root.dataset.wallpaper = settings.theme.wallpaper;
    root.dataset.density = settings.theme.density;
    root.dataset.transparency = settings.theme.transparency ? 'on' : 'off';
    root.dataset.motion = settings.theme.motion === 'reduced' ? 'reduced' : 'full';
    root.dataset.glow = settings.theme.glow ? 'on' : 'off';
    root.lang = language.code;
    root.dir = language.dir;
    root.style.fontSize = `${13.5 * settings.theme.fontScale}px`;
    root.style.setProperty('--n-font-size', `${13.5 * settings.theme.fontScale}px`);
    root.style.setProperty('--n-radius', `${settings.theme.radius}px`);
    root.style.setProperty('--n-radius-lg', `${Math.round(settings.theme.radius * 1.25)}px`);
    root.style.setProperty('--n-radius-xl', `${Math.round(settings.theme.radius * 1.7)}px`);
    root.style.setProperty('--n-anchor-w', `${settings.anchor.width}px`);
    const photo = settings.theme.wallpaper.startsWith('photo:') ? photoWallpaper(settings.theme.wallpaper.slice(6)) : undefined;
    if (photo) root.style.setProperty('--n-wallpaper-image', `url("${wallpaperUrl(photo.file)}")`);
    else root.style.removeProperty('--n-wallpaper-image');
  }, [settings, systemDark]);

  /* ---- brain: capture every interaction ---- */
  useEffect(() => {
    if (!ready) return;
    let queue: BrainCaptureInput[] = [];
    let timer: number | undefined;
    const flush = (): void => {
      if (!queue.length) return;
      const items = queue;
      queue = [];
      void invoke('brain.capture', { items }).catch(() => {});
    };
    const schedule = (): void => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        flush();
      }, 1200);
    };
    const push = (item: BrainCaptureInput): void => {
      queue.push(item);
      if (queue.length >= 14) {
        if (timer) window.clearTimeout(timer);
        timer = undefined;
        flush();
        return;
      }
      schedule();
    };
    const labelFor = (element: Element | null): string => {
      const target = element?.closest('button, a, [role="button"], [role="tab"], input, select, textarea') as HTMLElement | null;
      if (!target) return '';
      return (target.getAttribute('aria-label') || target.getAttribute('data-tip') || target.getAttribute('placeholder') || target.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);
    };
    const onClick = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      if (!target || target.closest('.brain')) return;
      const label = labelFor(target);
      if (!label) return;
      const state = useAppStore.getState();
      const page = state.pages.find((item) => item.id === state.activePageId);
      push({
        kind: 'click',
        label,
        surface: page?.surface,
        app: page?.surface,
        detail: `clicked ${target.tagName.toLowerCase()}`,
      });
    };
    const onSubmit = (event: Event): void => {
      const form = event.target as HTMLFormElement;
      const state = useAppStore.getState();
      const page = state.pages.find((item) => item.id === state.activePageId);
      const input = form.querySelector('input') as HTMLInputElement | null;
      push({
        kind: 'search',
        label: `Submitted ${form.className.includes('address') ? 'address bar' : 'form'}`,
        detail: input?.value?.slice(0, 140),
        surface: page?.surface,
        app: page?.surface,
      });
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.activePageId === previous.activePageId) return;
      const page = state.pages.find((item) => item.id === state.activePageId);
      if (!page) return;
      const from = previous.pages.find((item) => item.id === previous.activePageId)?.surface ?? 'unknown';
      push({ kind: 'navigate', label: `${page.title} page`, surface: page.surface, app: page.surface, detail: `from ${from}` });
    });
    const onBeforeUnload = (): void => flush();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [ready]);

  /* ---- system theme following ---- */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  /* ---- main-process events ---- */
  useEffect(() => {
    const disposers = [
      on('agent:event', (event) => useChatStore.getState().handleEvent(event)),
      on('settings:changed', (next) => useAppStore.getState().setSettings(next)),
      on('system:stats', (stats) => useAppStore.setState({ stats })),
      on('kernel:status', (kernel) => useAppStore.setState({ kernel })),
      on('tools:changed', (tools) => useAppStore.setState({ tools })),
      on('window:state', (state) => useAppStore.getState().setWindowState(state)),
      on('toast', (toast) => useAppStore.getState().pushToast(toast)),
      on('ui:navigate', ({ surface, params }) => {
      const aliases: Record<string, SurfaceKind> = { spaces: 'space', files: 'workspace', overview: 'desktop' };
      useAppStore.getState().navigate((aliases[surface] ?? surface) as SurfaceKind, params);
    }),
      on('os:open', ({ appId }) => {
        const state = useAppStore.getState();
        const desktopPage = state.pages.find((page) => page.surface === 'desktop');
        if (desktopPage) state.setActivePage(desktopPage.id);
        else state.navigate('desktop');
        useWindowStore.getState().open(appId);
      }),
      on('terminal:list', () => {}),
    ];
    return () => disposers.forEach((dispose) => dispose());
  }, []);

  /* ---- global shortcuts ---- */
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        useAppStore.getState().setCommandOpen(!useAppStore.getState().commandOpen);
      } else if (key === 'j') {
        event.preventDefault();
        useAppStore.getState().setAnchorOpen(!useAppStore.getState().anchorOpen);
      } else if (key === 'n' && event.shiftKey) {
        event.preventDefault();
        useAppStore.getState().navigate('chat', {}, { forceNew: true });
        void useChatStore.getState().create();
      } else if (key === '`') {
        event.preventDefault();
        useAppStore.getState().navigate('terminal');
      } else if (key === ',') {
        event.preventDefault();
        useAppStore.getState().navigate('settings');
      } else if (key === 'b') {
        event.preventDefault();
        useAppStore.getState().toggleDock();
      } else if (/^[1-9]$/.test(key)) {
        event.preventDefault();
        const index = Number(key) - 1;
        const page = useAppStore.getState().pages[index];
        if (page) useAppStore.getState().setActivePage(page.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!ready) return <Boot />;
  if (bootError) return <BootError message={bootError} />;

  if (storyOpen || (settings && !settings.onboardingComplete && !storySeen)) {
    return (
      <StoryIntro
        replay={storyOpen}
        onDone={() => {
          localStorage.setItem('neuro.story', 'done');
          setStorySeen(true);
          setStoryOpen(false);
          const pending = (window as unknown as { __storyDone?: () => void }).__storyDone;
          if (pending) pending();
        }}
      />
    );
  }

  if (settings && !settings.onboardingComplete) {
    return (
      <>
        <Onboarding />
        <ToastHost />
      </>
    );
  }

  return <Shell />;
}

function Shell(): JSX.Element {
  const pages = useAppStore((s) => s.pages);
  const activePageId = useAppStore((s) => s.activePageId);
  const anchorOpen = useAppStore((s) => s.anchorOpen);
  const settings = useAppStore((s) => s.settings);
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  useEffect(() => {
    const timer = setTimeout(() => void invoke('fs.watch', { root: settings?.workspaceRoot ?? null }).catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [settings?.workspaceRoot]);

  return (
    <div className="app" data-taskbar={settings?.taskbar.position ?? 'bottom'} data-dock={useAppStore.getState().dockCollapsed ? 'collapsed' : 'expanded'}>
      <div className="app__bg" aria-hidden>
        <div className="n-aurora">
          <span />
          <span />
          <span />
        </div>
        <div className="n-grid-bg" />
      </div>
      <TitleBar />
      <div className="app__body">
        <Dock />
        <main className="app__main">
          {activePage ? (
            <SurfaceBoundary key={`${activePage.id}-${activePage.surface}`} surface={activePage.surface}>
              <SurfaceHost page={activePage} />
            </SurfaceBoundary>
          ) : null}
        </main>
        {anchorOpen ? <AnchorRail /> : null}
      </div>
      <Taskbar />
      <StartMenu />
      <LockScreen />
      <CommandPalette />
      <ToastHost />
    </div>
  );
}

function SurfaceHost({ page }: { page: ReturnType<typeof useAppStore.getState>['pages'][number] }): JSX.Element {  switch (page.surface) {
    case 'desktop':
      return <Desktop />;
    case 'chat':
      return <Chat />;
    case 'workspace':
      return <Workspace params={page.params} />;
    case 'space':
      return <Spaces />;
    case 'notebook':
      return <NotebookSurface params={page.params} />;
    case 'browser':
      return <BrowserSurface params={page.params} />;
    case 'sites':
      return <SitesSurface />;
    case 'brain':
      return <BrainSurface />;
    case 'terminal':
      return <TerminalSurface />;
    case 'mail':
      return <MailSurface />;
    case 'automation':
      return <AutomationSurface />;
    case 'composer':
      return <ComposerSurface />;
    case 'marketplace':
      return <Marketplace params={page.params} />;
    case 'settings':
      return <SettingsSurface params={page.params} />;
    default:
      return <Desktop />;
  }
}

class SurfaceBoundary extends Component<{ surface: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[surface:${this.props.surface}] crashed`, error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="surfaceError">
          <div className="surfaceError__icon">
            <BrandMark size={34} />
          </div>
          <div className="small strong">The {this.props.surface} surface hit an error</div>
          <div className="tiny faint mono" style={{ maxWidth: 560, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </div>
          <button type="button" className="n-btn n-btn--outline" onClick={() => this.setState({ error: null })}>
            Retry surface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Boot(): JSX.Element {  return (
    <div className="boot">
      <div className="boot__glow" />
      <div className="boot__mark">
        <BrandMark size={54} animated />
      </div>
      <div className="boot__word display uppercase">
        Neuro<span>OS</span>
      </div>
      <div className="boot__hint mono">initialising kernel…</div>
      <div className="boot__bar">
        <span />
      </div>
    </div>
  );
}

function BootError({ message }: { message: string }): JSX.Element {
  return (
    <div className="boot">
      <div className="boot__word display">Could not start</div>
      <div className="boot__hint mono" style={{ maxWidth: 560, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
        {message}
      </div>
      <button type="button" className="n-btn n-btn--outline" onClick={() => location.reload()}>
        Reload
      </button>
    </div>
  );
}

export const MOD = modKey;
