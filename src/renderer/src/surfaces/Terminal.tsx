import { useEffect, useRef, useState } from 'react';
import type { TerminalInfo } from '@shared/types';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, on } from '../lib/ipc';
import { Icon } from '../components/Icon';
import { Button, IconButton, Spinner } from '../components/ui';

const DARK_THEME = {
  background: '#101012',
  foreground: '#e8eaee',
  cursor: '#5686fe',
  cursorAccent: '#101012',
  selectionBackground: 'rgba(86,134,254,0.32)',
  black: '#1b1b1c',
  red: '#f25a5a',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#5686fe',
  magenta: '#a78bfa',
  cyan: '#14b8a6',
  white: '#e8eaee',
  brightBlack: '#6b7075',
  brightRed: '#ff7b7b',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#7aaaff',
  brightMagenta: '#c4b5fd',
  brightCyan: '#2dd4bf',
  brightWhite: '#ffffff',
};

const LIGHT_THEME = {
  ...DARK_THEME,
  background: '#fbfcfd',
  foreground: '#15171b',
  cursor: '#4176e6',
  selectionBackground: 'rgba(65,118,230,0.2)',
  black: '#15171b',
  white: '#f7f8fa',
  brightBlack: '#61666b',
  brightWhite: '#ffffff',
};

export function TerminalSurface(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const [sessions, setSessions] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shells, setShells] = useState<{ name: string; path: string }[]>([]);
  const [pty, setPty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const themeMode = settings?.theme.mode ?? 'dark';
  const resolvedTheme: 'dark' | 'light' = themeMode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : themeMode;

  const createSession = async (shell?: string): Promise<void> => {
    setCreating(true);
    try {
      const info = await invoke('terminal.create', {
        cwd: settings?.workspaceRoot,
        shell,
        cols: 120,
        rows: 32,
      });
      setSessions((current) => [...current.filter((session) => session.id !== info.id), info]);
      setActiveId(info.id);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const [live, available] = await Promise.all([invoke('terminal.list', undefined), invoke('terminal.shells', undefined)]);
      setShells(available.shells);
      setPty(available.pty);
      if (live.length) {
        setSessions(live);
        setActiveId(live[0].id);
      } else {
        await createSession();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return on('terminal:exit', ({ id, code }) => {
      setSessions((current) =>
        current.map((session) => (session.id === id ? { ...session, status: 'exited', exitCode: code } : session)),
      );
    });
  }, []);

  const killSession = async (id: string): Promise<void> => {
    await invoke('terminal.kill', { id });
    setSessions((current) => {
      const next = current.filter((session) => session.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const active = sessions.find((session) => session.id === activeId);
  const nativePty = active?.usingPty ?? pty;

  return (
    <div className="termview">
      <header className="termview__head">
        <div className="termview__tabs">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="termview__tab"
              data-active={session.id === activeId}
              onClick={() => setActiveId(session.id)}
            >
              <Icon name="terminal" size={13} />
              <span className="truncate">{session.title}</span>
              <span className={`termview__status termview__status--${session.status}`} />
              <span
                className="termview__tabClose"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  void killSession(session.id);
                }}
              >
                <Icon name="x" size={10} />
              </span>
            </button>
          ))}
          {creating ? <Spinner /> : null}
        </div>
        <div className="row" style={{ gap: 2 }}>
          <div style={{ position: 'relative' }}>
            <IconButton icon="plus" label={t('terminal.newTab')} onClick={() => setMenuOpen(!menuOpen)} />
            {menuOpen ? (
              <div className="termview__menu">
                {shells.map((shell) => (
                  <button
                    key={shell.path}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void createSession(shell.path);
                    }}
                  >
                    <Icon name="terminal" size={13} />
                    <span className="grow">{shell.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <IconButton
            icon="trash"
            label={t('terminal.kill')}
            onClick={() => active && void killSession(active.id)}
            disabled={!active}
          />
        </div>
      </header>

      <div className="termview__stack">
        {sessions.map((session) => (
          <TerminalView key={session.id} session={session} active={session.id === activeId} theme={resolvedTheme} />
        ))}
        {!sessions.length ? (
          <div className="termview__empty">
            <Icon name="terminal" size={26} />
            <div className="small strong">No terminal session</div>
            <Button variant="primary" icon="plus" onClick={() => void createSession()}>
              {t('terminal.newTab')}
            </Button>
          </div>
        ) : null}
      </div>

      <footer className="termview__foot">
        <span className="n-badge" data-tone={nativePty ? 'ok' : 'warn'}>
          <span className={`n-dot ${nativePty ? 'n-dot--online' : 'n-dot--warn'}`} />
          {nativePty ? t('terminal.pty') : t('terminal.pipe')}
        </span>
        <span className="mono tiny truncate">{active?.cwd ?? ''}</span>
        <span className="grow" />
        <span className="mono tiny">{active?.shell.split(/[\\/]/).pop()}</span>
        <span className="mono tiny faint">
          {active?.cols}×{active?.rows}
        </span>
        <span className="mono tiny faint">{active?.status}</span>
      </footer>
    </div>
  );
}

function TerminalView({ session, active, theme }: { session: TerminalInfo; active: boolean; theme: 'dark' | 'light' }): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
      fontSize: 12.6,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 8000,
      allowTransparency: true,
      theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
      macOptionIsMeta: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;
    setReady(true);

    void invoke('terminal.buffer', { id: session.id })
      .then(({ data }) => {
        if (data) term.write(data.replace(/\r?\n/g, '\r\n'));
      })
      .catch(() => {});

    const dataDisposable = term.onData((data) => {
      void invoke('terminal.write', { id: session.id, data });
    });

    const observer = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return;
      try {
        fitRef.current.fit();
        void invoke('terminal.resize', { id: session.id, cols: term.cols, rows: term.rows });
      } catch {
        /* hidden */
      }
    });
    observer.observe(hostRef.current);

    return () => {
      dataDisposable.dispose();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  }, [theme]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      try {
        fitRef.current?.fit();
        if (termRef.current) void invoke('terminal.resize', { id: session.id, cols: termRef.current.cols, rows: termRef.current.rows });
        termRef.current?.focus();
      } catch {
        /* ignore */
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [active, session.id]);

  useEffect(() => {
    const dispose = on('terminal:data', ({ id, data }) => {
      if (id === session.id) termRef.current?.write(data);
    });
    return () => dispose();
  }, [session.id]);

  return (
    <div className="termview__pane" data-active={active} aria-hidden={!active}>
      <div className="termview__term" ref={hostRef} />
      {!ready ? (
        <div className="termview__loading">
          <Spinner />
        </div>
      ) : null}
    </div>
  );
}

