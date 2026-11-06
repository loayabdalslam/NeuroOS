import { useEffect, useMemo, useRef, useState } from 'react';
import { OS_APPS } from '@shared/apps';
import { useWindowStore } from '../state/windows';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, modKey } from '../lib/ipc';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';

export function StartMenu(): JSX.Element | null {
  const t = useT();
  const open = useWindowStore((s) => s.startOpen);
  const setOpen = useWindowStore((s) => s.setStartOpen);
  const openWindow = useWindowStore((s) => s.open);
  const windows = useWindowStore((s) => s.windows);
  const setLocked = useWindowStore((s) => s.setLocked);
  const settings = useAppStore((s) => s.settings);
  const navigate = useAppStore((s) => s.navigate);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OS_APPS;
    return OS_APPS.filter((app) => `${app.name} ${app.description}`.toLowerCase().includes(q));
  }, [query]);

  if (!open) return null;

  return (
    <div className="startScrim" onPointerDown={() => setOpen(false)}>
      <div className="startMenu" onPointerDown={(event) => event.stopPropagation()}>
        <div className="startMenu__search">
          <Icon name="search" size={15} className="faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search apps…"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && apps[0]) {
                openWindow(apps[0].id);
                setOpen(false);
              }
            }}
          />
          <span className="n-kbd">{modKey}</span>
          <span className="n-kbd">K</span>
        </div>

        <div className="startMenu__section">
          <span className="tiny faint uppercase">Pinned</span>
          <button
            type="button"
            className="startMenu__more"
            onClick={() => {
              setOpen(false);
              setCommandOpen(true);
            }}
          >
            All apps <Icon name="chevron-right" size={11} />
          </button>
        </div>
        <div className="startMenu__grid">
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              className="startMenu__app"
              onClick={() => {
                openWindow(app.id);
                setOpen(false);
              }}
            >
              <span className="startMenu__appIcon" style={{ color: app.accent, background: `${app.accent}1f`, borderColor: `${app.accent}3d` }}>
                <Icon name={app.icon} size={19} />
              </span>
              <span className="tiny truncate">{app.name}</span>
            </button>
          ))}
          {!apps.length ? <div className="tiny faint" style={{ padding: 12 }}>No apps match.</div> : null}
        </div>

        {windows.length ? (
          <>
            <div className="startMenu__section">
              <span className="tiny faint uppercase">Open windows</span>
              <span className="tiny faint">{windows.length}</span>
            </div>
            <div className="startMenu__windows">
              {windows.slice(-4).map((win) => (
                <button
                  key={win.id}
                  type="button"
                  className="startMenu__window"
                  onClick={() => {
                    useWindowStore.getState().focus(win.id);
                    setOpen(false);
                  }}
                >
                  <Icon name={win.icon} size={13} />
                  <span className="truncate tiny">{win.title}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="startMenu__foot">
          <button
            type="button"
            className="startMenu__user"
            onClick={() => {
              setOpen(false);
              useAppStore.getState().setSettingsSection('profile');
              navigate('settings');
            }}
          >
            <span className="startMenu__avatar">{(settings?.profile.name || 'N').slice(0, 1).toUpperCase()}</span>
            <span className="small strong truncate">{settings?.profile.name || 'Explorer'}</span>
          </button>
          <span className="grow" />
          <button type="button" className="startMenu__power" data-tip={t('settings.appearance')} onClick={() => { setOpen(false); navigate('settings'); }}>
            <Icon name="settings" size={15} />
          </button>
          <button type="button" className="startMenu__power" data-tip="Lock" onClick={() => { setLocked(true); setOpen(false); }}>
            <Icon name="lock" size={15} />
          </button>
          <button type="button" className="startMenu__power" data-tip="Shut down" onClick={() => void invoke('app.quit', undefined)}>
            <Icon name="power" size={15} />
          </button>
          <span className="startMenu__brand">
            <BrandMark size={15} />
          </span>
        </div>
      </div>
    </div>
  );
}
