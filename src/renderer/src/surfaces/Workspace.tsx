import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FsEntry, SearchHit, WorkspaceInfo } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, on } from '../lib/ipc';
import { basename, dirname, fileIconKind, formatBytes, languageColor, extname } from '../lib/format';
import { CodeEditor } from '../components/CodeEditor';
import { Icon } from '../components/Icon';
import { Button, EmptyState, IconButton, Modal, Spinner } from '../components/ui';
import { LANGUAGE_COLORS } from '../lib/format';

interface OpenFile {
  path: string;
  name: string;
  language: string;
  content: string;
  original: string;
  dirty: boolean;
}

const ICON_BY_KIND: Record<string, string> = {
  ts: 'file-code',
  js: 'file-code',
  json: 'file-json',
  md: 'file-text',
  img: 'image',
  shell: 'terminal',
  py: 'file-code',
  css: 'file-code',
  html: 'file-code',
  file: 'file',
};

export function Workspace({ params }: { params: Record<string, string> }): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const themeMode = settings?.theme.mode ?? 'dark';
  const resolvedTheme: 'dark' | 'light' = themeMode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : themeMode;
  const root = settings?.workspaceRoot ?? '';
  const [childrenMap, setChildrenMap] = useState<Record<string, FsEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [mode, setMode] = useState<'explorer' | 'search'>('explorer');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [dialog, setDialog] = useState<null | 'file' | 'folder'>(null);
  const [dialogValue, setDialogValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = openFiles.find((file) => file.path === activePath) ?? null;

  const loadChildren = useCallback(async (dir: string): Promise<FsEntry[]> => {
    const entries = await invoke('fs.list', { path: dir, showHidden: false });
    setChildrenMap((current) => ({ ...current, [dir]: entries }));
    return entries;
  }, []);

  const refresh = useCallback(async () => {
    if (!root) return;
    setBusy(true);
    try {
      await loadChildren(root);
      setInfo(await invoke('fs.workspace', { root }));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [root, loadChildren]);

  useEffect(() => {
    setChildrenMap({});
    setExpanded(new Set());
    setOpenFiles([]);
    setActivePath(null);
    void refresh();
  }, [root, refresh]);

  useEffect(() => {
    const dispose = on('fs:changed', () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void refresh(), 400);
    });
    return () => dispose();
  }, [refresh]);

  const openFile = useCallback(
    async (path: string) => {
      const existing = openFiles.find((file) => file.path === path);
      if (existing) {
        setActivePath(path);
        return;
      }
      try {
        setStatus('Opening…');
        const result = await invoke('fs.read', { path });
        const file: OpenFile = {
          path,
          name: basename(path),
          language: result.stat.language,
          content: result.content,
          original: result.content,
          dirty: false,
        };
        setOpenFiles((current) => [...current, file]);
        setActivePath(path);
        setStatus('');
      } catch (err) {
        setError((err as Error).message);
        setStatus('');
      }
    },
    [openFiles],
  );

  useEffect(() => {
    if (params.path) void openFile(params.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.path]);

  const save = useCallback(
    async (file: OpenFile) => {
      setStatus('Saving…');
      try {
        await invoke('fs.write', { path: file.path, content: file.content });
        setOpenFiles((current) =>
          current.map((item) => (item.path === file.path ? { ...item, original: item.content, dirty: false } : item)),
        );
        setStatus('Saved');
        setTimeout(() => setStatus(''), 1600);
        void refresh();
      } catch (err) {
        setError((err as Error).message);
        setStatus('');
      }
    },
    [refresh],
  );

  const toggleExpand = async (entry: FsEntry): Promise<void> => {
    if (entry.kind !== 'directory') {
      void openFile(entry.path);
      return;
    }
    const next = new Set(expanded);
    if (next.has(entry.path)) next.delete(entry.path);
    else {
      next.add(entry.path);
      if (!childrenMap[entry.path]) await loadChildren(entry.path).catch(() => {});
    }
    setExpanded(next);
  };

  const runSearch = async (): Promise<void> => {
    if (!query.trim() || !root) return;
    setSearching(true);
    try {
      setHits(await invoke('fs.search', { root, query, maxResults: 150 }));
    } finally {
      setSearching(false);
    }
  };

  const createEntry = async (): Promise<void> => {
    const target = `${root}\\${dialogValue.trim()}`.replace(/\\\\/g, '\\');
    if (!dialogValue.trim()) return;
    if (dialog === 'folder') await invoke('fs.mkdir', { path: target });
    else await invoke('fs.write', { path: target, content: '' });
    setDialog(null);
    setDialogValue('');
    await refresh();
    if (dialog === 'file') await openFile(target);
  };

  const groupedHits = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.path) ?? [];
      list.push(hit);
      map.set(hit.path, list);
    }
    return [...map.entries()].slice(0, 40);
  }, [hits]);

  const dirtyCount = openFiles.filter((file) => file.dirty).length;

  return (
    <div className="ws">
      <aside className="ws__side">
        <div className="ws__sideHead">
          <div className="row" style={{ gap: 6, minWidth: 0 }}>
            <Icon name="folder-open" size={14} style={{ color: 'var(--n-accent)' }} />
            <span className="small strong truncate">{root ? basename(root) : t('workspace.noFolder')}</span>
          </div>
          <div className="row" style={{ gap: 0 }}>
            <IconButton icon="refresh" label={t('workspace.refresh')} size={14} onClick={() => void refresh()} />
            <IconButton icon="folder-plus" label={t('workspace.openFolder')} size={14} onClick={() => void invoke('system.pickDirectory', { title: t('workspace.openFolder') }).then((r) => { if (r.path) void useAppStore.getState().patchSettings({ workspaceRoot: r.path }); })} />
          </div>
        </div>

        <div className="ws__tabs">
          <button type="button" data-active={mode === 'explorer'} onClick={() => setMode('explorer')}>
            <Icon name="files" size={13} /> {t('workspace.explorer')}
          </button>
          <button type="button" data-active={mode === 'search'} onClick={() => setMode('search')}>
            <Icon name="search" size={13} /> {t('common.search')}
          </button>
        </div>

        {mode === 'explorer' ? (
          <>
            <div className="ws__tree n-scroll">
              {!root ? (
                <EmptyState icon="folder" title={t('workspace.noFolder')} body="Open a folder to browse real files." />
              ) : !childrenMap[root] ? (
                <div className="ws__treeLoading">
                  <Spinner />
                </div>
              ) : (
                childrenMap[root].map((entry) => (
                  <TreeNode
                    key={entry.path}
                    entry={entry}
                    depth={0}
                    expanded={expanded}
                    childrenMap={childrenMap}
                    activePath={activePath}
                    onToggle={toggleExpand}
                  />
                ))
              )}
            </div>
            <div className="ws__sideFoot">
              <IconButton icon="file-plus" label={t('workspace.newFile')} size={14} onClick={() => setDialog('file')} />
              <IconButton icon="folder-plus" label={t('workspace.newFolder')} size={14} onClick={() => setDialog('folder')} />
              <span className="grow" />
              {info ? <span className="tiny faint mono">{info.fileCount} files</span> : null}
            </div>
          </>
        ) : (
          <div className="ws__search">
            <div className="ws__searchBar">
              <Icon name="search" size={13} className="faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void runSearch()}
                placeholder={t('workspace.search')}
                autoFocus
              />
              {searching ? <Spinner size={13} /> : null}
            </div>
            <div className="ws__results n-scroll">
              {groupedHits.length === 0 ? (
                <div className="tiny faint" style={{ padding: 12 }}>
                  {query ? 'No matches.' : 'Type a query and press Enter.'}
                </div>
              ) : (
                groupedHits.map(([file, fileHits]) => (
                  <div key={file} className="ws__resultFile">
                    <button type="button" className="ws__resultHead" onClick={() => void openFile(file)}>
                      <Icon name={ICON_BY_KIND[fileIconKind(basename(file))]} size={13} />
                      <span className="truncate small">{basename(file)}</span>
                      <span className="grow" />
                      <span className="tiny faint">{fileHits.length}</span>
                    </button>
                    {fileHits.slice(0, 6).map((hit, index) => (
                      <button key={index} type="button" className="ws__hit" onClick={() => void openFile(file)}>
                        <span className="mono tiny faint">{hit.line}</span>
                        <span className="truncate tiny">{hit.preview}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      <section className="ws__main">
        <div className="ws__fileTabs">
          {openFiles.length === 0 ? (
            <div className="ws__fileTabsEmpty tiny faint">
              <Icon name="folder-open" size={13} /> {root ? 'No file open — pick one from the explorer' : 'No workspace'}
            </div>
          ) : (
            openFiles.map((file) => (
              <button key={file.path} type="button" className="ws__fileTab" data-active={file.path === activePath} onClick={() => setActivePath(file.path)}>
                <span className="ws__langDot" style={{ background: languageColor(file.language) }} />
                <span className="truncate">{file.name}</span>
                {file.dirty ? <span className="ws__dirty" /> : null}
                <span
                  className="ws__fileClose"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenFiles((current) => current.filter((item) => item.path !== file.path));
                    if (activePath === file.path) setActivePath(openFiles.filter((item) => item.path !== file.path).slice(-1)[0]?.path ?? null);
                  }}
                >
                  <Icon name="x" size={10} />
                </span>
              </button>
            ))
          )}
          <span className="grow" />
          {active ? (
            <div className="row" style={{ gap: 4, padding: '0 8px' }}>
              <span className="tiny faint mono">{active.language}</span>
              <Button variant={active.dirty ? 'primary' : 'ghost'} size="sm" icon="save" onClick={() => void save(active)}>
                {t('workspace.save')}
              </Button>
            </div>
          ) : null}
          <IconButton icon="panel-right" label="Toggle info" size={14} onClick={() => setShowInfo(!showInfo)} />
        </div>

        {error ? (
          <div className="ws__error">
            <Icon name="alert" size={14} />
            <span className="grow small">{error}</span>
            <IconButton icon="x" label="Dismiss" onClick={() => setError(null)} />
          </div>
        ) : null}

        <div className="ws__editor">
          {active ? (
            <CodeEditor
              value={active.content}
              language={active.language}
              theme={resolvedTheme}
              onChange={(content) =>
                setOpenFiles((current) =>
                  current.map((item) => (item.path === active.path ? { ...item, content, dirty: content !== item.original } : item)),
                )
              }
              onSave={() => void save(active)}
            />
          ) : (
            <div className="ws__editorEmpty">
              <div className="ws__editorBrand">
                <Icon name="files" size={26} />
              </div>
              <div className="small strong">No file open</div>
              <div className="tiny faint">Pick a file from the explorer, search the workspace, or create a new one.</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <Button variant="outline" size="sm" icon="file-plus" onClick={() => setDialog('file')}>
                  {t('workspace.newFile')}
                </Button>
                <Button variant="ghost" size="sm" icon="terminal" onClick={() => useAppStore.getState().navigate('terminal')}>
                  {t('nav.terminal')}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="ws__status">
          <span className="mono tiny">{root || '—'}</span>
          <span className="grow" />
          {info?.git ? (
            <span className="row" style={{ gap: 5 }}>
              <Icon name="git-branch" size={12} />
              <span className="tiny">{info.git.branch}</span>
              {info.git.dirty ? <span className="n-badge n-badge--warn">{info.git.dirty}</span> : null}
            </span>
          ) : null}
          {status ? <span className="tiny accentText">{status}</span> : null}
          {dirtyCount ? <span className="tiny faint">{dirtyCount} unsaved</span> : null}
          <span className="tiny faint mono">{openFiles.length} open</span>
        </div>
      </section>

      {showInfo ? (
        <aside className="ws__info">
          <div className="ws__infoHead">
            <span className="small strong">{t('nav.workspace')}</span>
            <IconButton icon="x" label="Close" size={13} onClick={() => setShowInfo(false)} />
          </div>
          <div className="ws__infoBody n-scroll">
            {info ? (
              <>
                <div className="ws__infoGrid">
                  <Stat label="Files" value={String(info.fileCount)} />
                  <Stat label="Size" value={formatBytes(info.totalBytes)} />
                  <Stat label="Branch" value={info.git?.branch ?? '—'} />
                  <Stat label="Changes" value={info.git ? String(info.git.dirty) : '0'} />
                </div>
                <div className="ws__infoSection">
                  <div className="tiny faint uppercase">Languages</div>
                  <div className="ws__langList">
                    {info.languages.slice(0, 8).map((language) => {
                      const total = info.languages.reduce((acc, item) => acc + item.files, 0) || 1;
                      return (
                        <div key={language.id} className="ws__langRow">
                          <span className="ws__langDot" style={{ background: LANGUAGE_COLORS[language.id] ?? '#8b949e' }} />
                          <span className="tiny">{language.id}</span>
                          <span className="grow" />
                          <span className="tiny faint mono">{language.files}</span>
                          <span className="ws__langBar">
                            <span style={{ width: `${(language.files / total) * 100}%`, background: LANGUAGE_COLORS[language.id] ?? '#8b949e' }} />
                          </span>
                        </div>
                      );
                    })}
                    {!info.languages.length ? <span className="tiny faint">No code files yet.</span> : null}
                  </div>
                </div>
                <div className="ws__infoSection">
                  <div className="tiny faint uppercase">Root</div>
                  <div className="mono tiny" style={{ wordBreak: 'break-all', marginTop: 4 }}>{info.root}</div>
                </div>
              </>
            ) : (
              <div className="center" style={{ padding: 20 }}><Spinner /></div>
            )}
          </div>
        </aside>
      ) : null}

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'folder' ? t('workspace.newFolder') : t('workspace.newFile')}
        description={`Inside ${root}`}
        footer={
          <>
            <Button onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={() => void createEntry()} disabled={!dialogValue.trim()}>
              {t('common.new')}
            </Button>
          </>
        }
      >
        <input
          className="n-input"
          value={dialogValue}
          onChange={(event) => setDialogValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void createEntry()}
          placeholder={dialog === 'folder' ? 'src/components' : 'src/components/App.tsx'}
          autoFocus
        />
      </Modal>
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  expanded,
  childrenMap,
  activePath,
  onToggle,
}: {
  entry: FsEntry;
  depth: number;
  expanded: Set<string>;
  childrenMap: Record<string, FsEntry[]>;
  activePath: string | null;
  onToggle: (entry: FsEntry) => void;
}): JSX.Element {
  const isOpen = expanded.has(entry.path);
  const children = childrenMap[entry.path];
  const kind = entry.kind === 'directory' ? 'folder' : fileIconKind(entry.name);
  return (
    <>
      <button
        type="button"
        className="treeRow"
        style={{ paddingLeft: 8 + depth * 13 }}
        data-active={activePath === entry.path}
        data-dir={entry.kind === 'directory'}
        onClick={() => void onToggle(entry)}
        title={entry.path}
      >
        {entry.kind === 'directory' ? (
          <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={11} className="faint" />
        ) : (
          <span style={{ width: 11 }} />
        )}
        <Icon
          name={entry.kind === 'directory' ? (isOpen ? 'folder-open' : 'folder') : ICON_BY_KIND[kind]}
          size={13}
          style={{ color: entry.kind === 'directory' ? 'var(--n-accent)' : languageColor(extname(entry.name)) }}
        />
        <span className="truncate">{entry.name}</span>
        <span className="grow" />
        {entry.kind === 'file' && entry.size > 0 ? <span className="treeRow__size mono">{formatBytes(entry.size, 0)}</span> : null}
      </button>
      {entry.kind === 'directory' && isOpen
        ? (children ?? []).map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              childrenMap={childrenMap}
              activePath={activePath}
              onToggle={onToggle}
            />
          ))
        : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="ws__stat">
      <span className="tiny faint uppercase">{label}</span>
      <span className="small mono truncate">{value}</span>
    </div>
  );
}

export const workspaceHelpers = { dirname };

