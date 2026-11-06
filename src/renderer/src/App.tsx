import { Component, useEffect, useState, type ReactNode } from 'react';
import type { SurfaceKind } from '@shared/types';
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
import { Desktop } from './surfaces/Desktop';
import { Chat } from './surfaces/Chat';
import { Workspace } from './surfaces/Workspace';
import { Spaces } from './surfaces/Spaces';
import { NotebookSurface } from './surfaces/Notebook';
import { BrowserSurface } from './surfaces/Browser';
import { TerminalSurface } from './surfaces/Terminal';
import { Marketplace } from './surfaces/Marketplace';
import { SettingsSurface } from './surfaces/Settings';

export function App(): JSX.Element {
  const ready = useAppStore((s) => s.ready);
  const bootError = useAppStore((s) => s.bootError);
  const settings = useAppStore((s) => s.settings);
  const hydrate = useAppStore((s) => s.hydrate);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

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
  }, [settings, systemDark]);

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
      on('ui:navigate', ({ surface, params }) => useAppStore.getState().navigate(surface as SurfaceKind, params)),
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
    case 'terminal':
      return <TerminalSurface />;
    case 'marketplace':
      return <Marketplace />;
    case 'settings':
      return <SettingsSurface />;
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
