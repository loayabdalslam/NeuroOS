import { useEffect, useMemo, useRef, useState } from 'react';
import type { SurfaceKind } from '@shared/types';
import { useAppStore } from '../state/store';
import { useChatStore } from '../state/chat';
import { useT } from '../lib/i18n';
import { invoke, modKey } from '../lib/ipc';
import { iconForSurface } from '../lib/surfaceMeta';
import { Icon } from './Icon';

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
  keywords?: string;
}

export function CommandPalette(): JSX.Element | null {
  const t = useT();
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const navigate = useAppStore((s) => s.navigate);
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const sessions = useChatStore((s) => s.sessions);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const nav = (surface: SurfaceKind): (() => void) => () => navigate(surface);
    const base: Command[] = [
      { id: 'nav-chat', group: 'Navigate', label: t('nav.chat'), icon: iconForSurface('chat'), run: nav('chat'), hint: 'G C' },
      { id: 'nav-workspace', group: 'Navigate', label: t('nav.workspace'), icon: iconForSurface('workspace'), run: nav('workspace') },
      { id: 'nav-space', group: 'Navigate', label: t('nav.space'), icon: iconForSurface('space'), run: nav('space') },
      { id: 'nav-notebook', group: 'Navigate', label: t('nav.notebook'), icon: iconForSurface('notebook'), run: nav('notebook') },
      { id: 'nav-browser', group: 'Navigate', label: t('nav.browser'), icon: iconForSurface('browser'), run: nav('browser') },
      { id: 'nav-brain', group: 'Navigate', label: t('nav.brain'), icon: iconForSurface('brain'), run: nav('brain') },
      { id: 'nav-sites', group: 'Navigate', label: t('nav.sites'), icon: iconForSurface('sites'), run: nav('sites') },
      { id: 'nav-terminal', group: 'Navigate', label: t('nav.terminal'), icon: iconForSurface('terminal'), run: nav('terminal') },
      { id: 'nav-mail', group: 'Navigate', label: t('nav.mail'), icon: iconForSurface('mail'), run: nav('mail') },
      { id: 'nav-automation', group: 'Navigate', label: t('nav.automation'), icon: iconForSurface('automation'), run: nav('automation') },
      { id: 'nav-composer', group: 'Navigate', label: t('nav.composer'), icon: iconForSurface('composer'), run: nav('composer') },
      { id: 'nav-marketplace', group: 'Navigate', label: t('nav.marketplace'), icon: iconForSurface('marketplace'), run: nav('marketplace') },
      { id: 'nav-settings', group: 'Navigate', label: t('nav.settings'), icon: iconForSurface('settings'), run: nav('settings') },
      { id: 'nav-desktop', group: 'Navigate', label: t('nav.desktop'), icon: iconForSurface('desktop'), run: nav('desktop') },
      {
        id: 'act-new-chat',
        group: 'Actions',
        label: t('chat.newChat'),
        icon: 'plus',
        run: () => {
          navigate('chat');
          void useChatStore.getState().create();
        },
        keywords: 'new conversation',
      },
      {
        id: 'act-theme',
        group: 'Actions',
        label: settings?.theme.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: settings?.theme.mode === 'dark' ? 'sun' : 'moon',
        run: () => void patchSettings({ theme: { mode: settings?.theme.mode === 'dark' ? 'light' : 'dark' } }),
      },
      {
        id: 'act-open-folder',
        group: 'Actions',
        label: t('workspace.openFolder'),
        icon: 'folder-open',
        run: async () => {
          const result = await invoke('system.pickDirectory', { title: 'Open workspace' });
          if (result.path) {
            await patchSettings({ workspaceRoot: result.path });
            navigate('workspace');
          }
        },
      },
      {
        id: 'act-screenshot',
        group: 'Actions',
        label: 'Capture screen',
        icon: 'scan',
        run: async () => {
          const shot = await invoke('system.screenshot', undefined);
          useAppStore.getState().pushToast({ title: 'Screenshot saved', message: shot.path, kind: 'success' });
        },
      },
      {
        id: 'act-clipboard',
        group: 'Actions',
        label: 'Copy clipboard to a note',
        icon: 'clipboard-list',
        run: async () => {
          const clip = await invoke('system.clipboardRead', undefined);
          if (!clip.text.trim()) return;
          await invoke('notes.save', {
            id: `note_${Date.now().toString(36)}`,
            title: 'Clipboard capture',
            body: clip.text,
            color: '#14b8a6',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          useAppStore.getState().pushToast({ title: 'Saved clipboard to notes', kind: 'success' });
        },
      },
      { id: 'act-devtools', group: 'Actions', label: 'Toggle developer tools', icon: 'code', run: () => void invoke('window.devtools', undefined) },
      { id: 'act-quit', group: 'Actions', label: t('menu.quit'), icon: 'power', run: () => void invoke('app.quit', undefined) },
    ];
    const sessionCommands: Command[] = sessions.slice(0, 24).map((session) => ({
      id: `session-${session.id}`,
      group: 'Conversations',
      label: session.title,
      hint: session.model,
      icon: 'message',
      run: () => {
        void useChatStore.getState().open(session.id);
        navigate('chat');
      },
    }));
    return [...base, ...sessionCommands];
  }, [navigate, patchSettings, sessions, settings?.theme.mode, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => {
      const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const command of filtered) {
      const list = map.get(command.group) ?? [];
      list.push(command);
      map.set(command.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((current) => Math.min(filtered.length - 1, current + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const command = filtered[index];
        if (command) {
          setOpen(false);
          command.run();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, index, setOpen]);

  useEffect(() => {
    const element = listRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null;
    element?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  let flatIndex = -1;
  return (
    <div className="palette-scrim" onMouseDown={() => setOpen(false)}>
      <div className="palette fade-in" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal>
        <div className="palette__inputRow">
          <Icon name="search" size={17} className="faint" />
          <input
            ref={inputRef}
            className="palette__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('kbd.command') + '…'}
            spellCheck={false}
          />
          <span className="n-kbd">esc</span>
        </div>
        <div className="palette__list n-scroll" ref={listRef}>
          {grouped.length === 0 ? (
            <div className="palette__empty">No matches for “{query}”</div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="palette__group">
                <div className="palette__groupLabel">{group}</div>
                {items.map((command) => {
                  flatIndex += 1;
                  const selected = flatIndex === index;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      className="palette__item"
                      data-selected={selected}
                      onMouseEnter={() => setIndex(flatIndex)}
                      onClick={() => {
                        setOpen(false);
                        command.run();
                      }}
                    >
                      <span className="palette__icon">
                        <Icon name={command.icon} size={15} />
                      </span>
                      <span className="grow truncate">{command.label}</span>
                      {command.hint ? <span className="tiny faint mono">{command.hint}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette__foot">
          <span className="row" style={{ gap: 5 }}>
            <span className="n-kbd">↑</span>
            <span className="n-kbd">↓</span>
            <span className="tiny faint">navigate</span>
          </span>
          <span className="row" style={{ gap: 5 }}>
            <span className="n-kbd">↵</span>
            <span className="tiny faint">run</span>
          </span>
          <span className="row" style={{ gap: 5 }}>
            <span className="n-kbd">{modKey}</span>
            <span className="n-kbd">K</span>
            <span className="tiny faint">toggle</span>
          </span>
          <span className="grow" />
          <span className="tiny faint mono">{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
