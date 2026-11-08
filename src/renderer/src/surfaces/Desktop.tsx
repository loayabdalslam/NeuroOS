import { useEffect, useRef, useState } from 'react';
import { OS_APPS } from '@shared/apps';
import { WALLPAPERS } from '@shared/themes';
import { useAppStore } from '../state/store';
import { useWindowStore } from '../state/windows';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { Icon } from '../components/Icon';
import { WindowFrame } from '../components/WindowFrame';
import { BrandMark } from '../components/BrandMark';

interface ContextMenuState {
  x: number;
  y: number;
}

export function Desktop(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const navigate = useAppStore((s) => s.navigate);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const windows = useWindowStore((s) => s.windows);
  const open = useWindowStore((s) => s.open);
  const closeAll = useWindowStore((s) => s.closeAll);
  const minimizeAll = useWindowStore((s) => s.minimizeAll);
  const setLocked = useWindowStore((s) => s.setLocked);
  const pushToast = useAppStore((s) => s.pushToast);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [area, setArea] = useState({ width: 1200, height: 700 });
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = desktopRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setArea({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const close = (): void => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  const cycleWallpaper = (): void => {
    const current = settings?.theme.wallpaper ?? 'nebula';
    const index = WALLPAPERS.findIndex((item) => item.id === current);
    const next = WALLPAPERS[(index + 1) % WALLPAPERS.length];
    void patchSettings({ theme: { wallpaper: next.id } });
    pushToast({ title: 'Wallpaper changed', message: next.label, kind: 'info' });
  };

  const newNote = async (): Promise<void> => {
    const now = new Date().toISOString();
    await invoke('notes.save', {
      id: `note_${Date.now().toString(36)}`,
      title: 'Desktop note',
      body: '',
      color: '#4176e6',
      createdAt: now,
      updatedAt: now,
    });
    pushToast({ title: 'Note created', message: 'Open Spaces to find it.', kind: 'success' });
  };

  const contextItems = [
    { label: 'Open Overview', icon: 'dashboard', run: () => open('overview') },
    { label: t('terminal.newTab'), icon: 'terminal', run: () => open('terminal') },
    { label: 'Open Files', icon: 'files', run: () => open('workspace') },
    { label: 'New note', icon: 'pencil', run: () => void newNote() },
    { separator: true, label: '', icon: '', run: () => {} },
    { label: 'Change wallpaper', icon: 'palette', run: cycleWallpaper },
    { label: 'Display settings', icon: 'settings', run: () => { useAppStore.getState().setSettingsSection('appearance'); navigate('settings'); } },
    { label: 'Command palette', icon: 'command', run: () => setCommandOpen(true) },
    { separator: true, label: '', icon: '', run: () => {} },
    { label: 'Minimize all windows', icon: 'minimize', run: () => minimizeAll() },
    { label: 'Lock screen', icon: 'lock', run: () => setLocked(true) },
    { label: 'Close all windows', icon: 'x', run: () => closeAll() },
  ];

  const visible = windows.filter((win) => !win.minimized).sort((a, b) => a.z - b.z);
  const minimized = windows.filter((win) => win.minimized);

  return (
    <div
      className="desktop"
      ref={desktopRef}
      onPointerDown={() => {
        setSelected(null);
        setMenu(null);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="desktop__glow" aria-hidden />

      <div className="desktop__icons">
        {OS_APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            className="desktopIcon"
            data-selected={selected === app.id}
            onPointerDown={(event) => {
              event.stopPropagation();
              setSelected(app.id);
            }}
            onDoubleClick={() => open(app.id)}
            onKeyDown={(event) => event.key === 'Enter' && open(app.id)}
          >
            <span className="desktopIcon__tile" style={{ ['--tile-accent' as string]: app.accent }}>
              <Icon name={app.icon} size={26} className="desktopIcon__glyph" />
            </span>
            <span className="desktopIcon__label">{app.name}</span>
          </button>
        ))}
      </div>

      <div className="desktop__windows">
        {visible.map((win) => (
          <WindowFrame key={win.id} win={win} areaW={area.width} areaH={area.height} />
        ))}
      </div>

      {!windows.length ? (
        <div className="desktop__hint">
          <BrandMark size={34} animated />
          <div className="desktop__hintTitle display">
            {settings?.profile.name ? `Welcome, ${settings.profile.name}` : 'Welcome to Neuro OS'}
          </div>
          <div className="desktop__hintBody">Double-click an app icon, or press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + K to run anything.</div>
          <div className="desktop__hintRow">
            {['chat', 'terminal', 'mail', 'automation'].map((id) => {
              const app = OS_APPS.find((item) => item.id === id);
              return (
                <button key={id} type="button" className="desktop__hintChip" onClick={() => open(id)}>
                  <Icon name={app?.icon ?? 'square'} size={13} style={{ color: app?.accent }} />
                  {app?.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {minimized.length ? (
        <div className="desktop__minimized tiny faint">
          {minimized.length} minimized · restore from the taskbar
        </div>
      ) : null}

      <div className="desktop__corner">
        <span className="tiny faint mono">
          {settings?.theme.design === 'neuro' ? 'NEURO' : settings?.theme.design?.toUpperCase()} · {windows.length} windows
        </span>
      </div>

      {menu ? (
        <div className="desktopMenu" style={{ left: Math.min(menu.x, area.width - 230), top: Math.min(menu.y, area.height - 340) }} onPointerDown={(event) => event.stopPropagation()}>
          {contextItems.map((item, index) =>
            item.separator ? (
              <div key={`sep-${index}`} className="desktopMenu__sep" />
            ) : (
              <button key={item.label} type="button" onClick={() => { item.run(); setMenu(null); }}>
                <Icon name={item.icon} size={14} />
                <span className="grow">{item.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
