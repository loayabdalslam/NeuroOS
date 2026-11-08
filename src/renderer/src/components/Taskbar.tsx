import { useEffect, useState } from 'react';
import { LANGUAGES } from '@shared/i18n';
import { themePreset } from '@shared/themes';
import { OS_APPS } from '@shared/apps';
import { useAppStore } from '../state/store';
import { useWindowStore } from '../state/windows';
import { useT } from '../lib/i18n';
import { invoke, on } from '../lib/ipc';
import { clockTime } from '../lib/format';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { Flag } from './Flag';
import { SURFACE_ORDER, surfaceMeta } from '../surfaces/meta';
import { Menu, type MenuItem } from './ui';

export function Taskbar(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const pages = useAppStore((s) => s.pages);
  const activePageId = useAppStore((s) => s.activePageId);
  const navigate = useAppStore((s) => s.navigate);
  const setAnchorOpen = useAppStore((s) => s.setAnchorOpen);
  const windows = useWindowStore((s) => s.windows);
  const focusedWindow = useWindowStore((s) => s.focusedId);
  const openWindow = useWindowStore((s) => s.open);
  const toggleWindow = useWindowStore((s) => s.toggleMinimize);
  const setStartOpen = useWindowStore((s) => s.setStartOpen);
  const setLocked = useWindowStore((s) => s.setLocked);
  const [now, setNow] = useState(new Date());
  const [menu, setMenu] = useState<null | 'tray' | 'language' | 'stats'>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = (): void => {
      void invoke('mail.status', undefined)
        .then((status) => setUnread(status.unread))
        .catch(() => setUnread(0));
    };
    load();
    const dispose = on('mail:event', (event) => {
      if (event.status) setUnread(event.status.unread);
      else load();
    });
    return () => dispose();
  }, []);

  const openApp = (appId: string): void => {
    const state = useAppStore.getState();
    const desktopPage = state.pages.find((page) => page.surface === 'desktop');
    if (desktopPage) state.setActivePage(desktopPage.id);
    else state.navigate('desktop');
    openWindow(appId);
  };

  if (!settings) return <div className="taskbar" />;

  const taskbar = settings.taskbar;
  const locale = settings.locale;
  const language = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];
  const pinned = taskbar.pinned.filter((id) => SURFACE_ORDER.includes(id as never));
  const running = windows;

  const setLocale = (code: string): void => {
    void useAppStore.getState().patchSettings({ locale: code });
  };

  const applyTheme = (id: string): void => {
    const preset = themePreset(id);
    if (!preset) return;
    void useAppStore.getState().patchSettings({
      theme: {
        design: preset.design,
        mode: preset.mode,
        surface: preset.surface,
        accent: preset.accent,
        radius: preset.radius,
        density: preset.density,
        transparency: preset.transparency,
        glow: preset.glow,
        wallpaper: preset.wallpaper,
      },
      taskbar: { ...taskbar, position: preset.taskbar },
    });
  };

  const trayItems: MenuItem[] = [
    { label: t('settings.appearance'), icon: 'palette', onClick: () => { useAppStore.getState().setSettingsSection('appearance'); navigate('settings'); } },
    { label: 'Theme Â· Neuro OS', icon: 'sparkles', onClick: () => applyTheme('neuro-dark') },
    { label: 'Theme Â· Neuro White', icon: 'sun', onClick: () => applyTheme('neuro-white') },
    { label: 'Theme Â· Windows 11', icon: 'grid', onClick: () => applyTheme('windows-11') },
    { label: 'Theme Â· Ubuntu', icon: 'layers', onClick: () => applyTheme('ubuntu-dark') },
    { label: 'Theme Â· iOS', icon: 'monitor', onClick: () => applyTheme('ios-light') },
    { separator: true, label: '', onClick: () => {} },
    { label: t('settings.taskbar'), icon: 'sliders', onClick: () => { useAppStore.getState().setSettingsSection('taskbar'); navigate('settings'); } },
    { label: t('settings.anchor'), icon: 'anchor', onClick: () => { useAppStore.getState().setSettingsSection('anchor'); navigate('settings'); } },
    { separator: true, label: '', onClick: () => {} },
    { label: t('chat.newChat'), icon: 'message', onClick: () => navigate('chat', {}, { forceNew: true }) },
    { label: t('terminal.newTab'), icon: 'terminal', onClick: () => navigate('terminal') },
    { separator: true, label: '', onClick: () => {} },
    { label: 'Start menu', icon: 'grid', onClick: () => setStartOpen(true) },
    { label: 'Automation', icon: 'workflow', onClick: () => openApp('automation') },
    { label: 'Mail', icon: 'inbox', onClick: () => openApp('mail') },
    { label: 'Lock screen', icon: 'lock', onClick: () => setLocked(true) },
    { separator: true, label: '', onClick: () => {} },
    { label: t('app.openDataFolder'), icon: 'folder-open', onClick: () => void invoke('app.openDataFolder', undefined) },
    { label: t('menu.quit'), icon: 'power', danger: true, onClick: () => void invoke('app.quit', undefined) },
  ];

  const cpu = stats?.cpu ?? 0;
  const memPct = stats ? Math.round((stats.memoryUsed / stats.memoryTotal) * 100) : 0;

  return (
    <footer className={`taskbar taskbar--${taskbar.position}`} data-size={taskbar.size}>
      <div className="taskbar__left">
        <button type="button" className="taskbar__start" onClick={() => setStartOpen(true)} aria-label="Start">
          <BrandMark size={17} animated />
        </button>
        <div className="taskbar__divider" />
        {pinned.map((surface) => {
          const meta = surfaceMeta(surface);
          const app = OS_APPS.find((item) => item.surface === surface);
          const window = app ? windows.find((win) => win.appId === app.id) : undefined;
          const active = Boolean(window && window.id === focusedWindow);
          return (
            <button
              key={surface}
              type="button"
              className="taskbar__app"
              data-active={active}
              data-running={Boolean(window)}
              data-tip={t(meta.labelKey)}
              onClick={() => {
                if (app) openApp(app.id);
                else navigate(surface as never);
              }}
            >
              <Icon name={meta.icon} size={16} style={{ color: active ? meta.accent : undefined }} />
              {taskbar.showLabels ? <span className="taskbar__app-label truncate">{t(meta.labelKey)}</span> : null}
            </button>
          );
        })}
        {running.length ? <div className="taskbar__divider" /> : null}
        {running.slice(0, 6).map((win) => (
          <button
            key={win.id}
            type="button"
            className="taskbar__app taskbar__app--running"
            data-active={win.id === focusedWindow && !win.minimized}
            data-minimized={win.minimized}
            data-tip={win.title}
            onClick={() => toggleWindow(win.id)}
          >
            <Icon name={win.icon} size={15} />
            <span className="taskbar__app-label truncate">{win.title}</span>
            <span className="taskbar__windowDot" />
          </button>
        ))}
      </div>

      <div className="taskbar__spacer" />

      <div className="taskbar__right">
        {taskbar.showSystemStats && stats ? (
          <button type="button" className="taskbar__stat" onClick={() => setMenu(menu === 'stats' ? null : 'stats')} data-tip={`${stats.processes} processes`}>
            <span className="taskbar__meter">
              <span className="taskbar__meter-label mono">CPU</span>
              <span className="taskbar__bar">
                <span style={{ width: `${cpu}%`, background: cpu > 75 ? 'var(--n-danger)' : 'var(--n-accent)' }} />
              </span>
              <span className="mono tiny">{cpu}%</span>
            </span>
            <span className="taskbar__meter">
              <span className="taskbar__meter-label mono">RAM</span>
              <span className="taskbar__bar">
                <span style={{ width: `${memPct}%`, background: memPct > 85 ? 'var(--n-danger)' : 'var(--n-teal)' }} />
              </span>
              <span className="mono tiny">{memPct}%</span>
            </span>
          </button>
        ) : null}

        {taskbar.showLanguage ? (
          <div style={{ position: 'relative' }}>
            <button type="button" className="taskbar__tray" onClick={() => setMenu(menu === 'language' ? null : 'language')} data-tip={language.name}>
              <Flag code={language.flag} size={16} radius={2} />
              <span className="mono tiny uppercase">{language.code}</span>
            </button>
            {menu === 'language' ? (
              <Menu
                items={LANGUAGES.map((item) => ({
                  label: `${item.nativeName} Â· ${item.region}`,
                  hint: item.code.toUpperCase(),
                  onClick: () => setLocale(item.code),
                }))}
                onClose={() => setMenu(null)}
                align="right"
                width={250}
              />
            ) : null}
          </div>
        ) : null}

        <button type="button" className="taskbar__tray" onClick={() => openApp('mail')} data-tip="Mail">
          <Icon name="inbox" size={14} />
          {unread ? <span className="taskbar__badge">{unread > 9 ? '9+' : unread}</span> : null}
        </button>

        <button type="button" className="taskbar__tray" onClick={() => setAnchorOpen(true)} data-tip={t('anchor.title')}>
          <Icon name="anchor" size={15} />
          {settings.anchor.pins.length ? <span className="taskbar__count">{settings.anchor.pins.length}</span> : null}
        </button>

        <div className="taskbar__clock" data-tip={now.toDateString()}>
          <span className="taskbar__time mono">{clockTime(now, taskbar.clock24h)}</span>
          <span className="taskbar__date tiny">{now.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>

        <div style={{ position: 'relative' }}>
          <button type="button" className="taskbar__tray" onClick={() => setMenu(menu === 'tray' ? null : 'tray')} aria-label="System tray">
            <Icon name="chevron-up" size={13} />
          </button>
          {menu === 'tray' ? <Menu items={trayItems} onClose={() => setMenu(null)} align="right" width={230} /> : null}
        </div>
      </div>

      {menu === 'stats' && stats ? (
        <div className="taskbar__popover">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small strong">System</span>
            <span className="n-badge n-badge--success">live</span>
          </div>
          <div className="taskbar__popover-grid">
            <Metric label="CPU" value={`${stats.cpu}%`} pct={stats.cpu} />
            <Metric label="Memory" value={`${(stats.memoryUsed / 1024 ** 3).toFixed(1)} / ${(stats.memoryTotal / 1024 ** 3).toFixed(1)} GB`} pct={memPct} />
            <Metric label="Processes" value={String(stats.processes)} />
            <Metric label="Uptime" value={`${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`} />
          </div>
        </div>
      ) : null}
    </footer>
  );
}

function Metric({ label, value, pct }: { label: string; value: string; pct?: number }): JSX.Element {
  return (
    <div className="taskbar__metric">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tiny faint uppercase">{label}</span>
        <span className="mono tiny">{value}</span>
      </div>
      {pct !== undefined ? (
        <div className="n-progress" style={{ marginTop: 5 }}>
          <span style={{ width: `${pct}%`, background: pct > 80 ? 'var(--n-danger)' : undefined }} />
        </div>
      ) : null}
    </div>
  );
}


