import { useCallback, useEffect, useRef, useState } from 'react';
import type { CellLanguage, Notebook, NotebookCell } from '@shared/types';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from '../components/Icon';
import { Markdown } from '../components/Markdown';
import { Button, EmptyState, IconButton, Spinner } from '../components/ui';

const LANGUAGES: { id: CellLanguage; label: string; icon: string }[] = [
  { id: 'javascript', label: 'JavaScript', icon: 'braces' },
  { id: 'typescript', label: 'TypeScript', icon: 'file-code' },
  { id: 'python', label: 'Python', icon: 'flask' },
  { id: 'bash', label: 'Shell', icon: 'terminal' },
];

export function NotebookSurface({ params }: { params: Record<string, string> }): JSX.Element {
  const t = useT();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [showList, setShowList] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void invoke('notebooks.list', undefined).then((list) => {
      setNotebooks(list);
      const wanted = params.id ? list.find((item) => item.id === params.id) : list[0];
      setNotebook(wanted ?? null);
    });
  }, [params.id]);

  const persist = useCallback((next: Notebook) => {
    setNotebook(next);
    setNotebooks((current) => current.map((item) => (item.id === next.id ? next : item)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void invoke('notebooks.save', next).catch(() => {});
    }, 500);
  }, []);

  const updateCell = (cellId: string, patch: Partial<NotebookCell>): void => {
    if (!notebook) return;
    persist({ ...notebook, cells: notebook.cells.map((cell) => (cell.id === cellId ? { ...cell, ...patch } : cell)) });
  };

  const addCell = (kind: 'code' | 'markdown', afterId?: string): void => {
    if (!notebook) return;
    const cell: NotebookCell = {
      id: `cell_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      kind,
      language: 'javascript',
      source: kind === 'markdown' ? '## New section\n\nExplain what this notebook does.' : 'return 2 + 2;',
      status: 'idle',
      updatedAt: new Date().toISOString(),
    };
    const cells = [...notebook.cells];
    const index = afterId ? cells.findIndex((item) => item.id === afterId) + 1 : cells.length;
    cells.splice(index, 0, cell);
    persist({ ...notebook, cells });
  };

  const removeCell = (cellId: string): void => {
    if (!notebook) return;
    persist({ ...notebook, cells: notebook.cells.filter((cell) => cell.id !== cellId) });
  };

  const moveCell = (cellId: string, direction: -1 | 1): void => {
    if (!notebook) return;
    const index = notebook.cells.findIndex((cell) => cell.id === cellId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= notebook.cells.length) return;
    const cells = [...notebook.cells];
    [cells[index], cells[target]] = [cells[target], cells[index]];
    persist({ ...notebook, cells });
  };

  const runCell = async (cellId: string): Promise<void> => {
    if (!notebook) return;
    setRunning((current) => ({ ...current, [cellId]: true }));
    try {
      const updated = await invoke('notebooks.runCell', { notebookId: notebook.id, cellId });
      setNotebook((current) =>
        current ? { ...current, cells: current.cells.map((cell) => (cell.id === updated.id ? updated : cell)) } : current,
      );
      setNotebooks((current) => current.map((item) => (item.id === notebook.id ? { ...item, cells: item.cells.map((cell) => (cell.id === updated.id ? updated : cell)) } : item)));
    } catch (error) {
      updateCell(cellId, { status: 'error', output: (error as Error).message, outputKind: 'error' });
    } finally {
      setRunning((current) => ({ ...current, [cellId]: false }));
    }
  };

  const runAll = async (): Promise<void> => {
    if (!notebook) return;
    for (const cell of notebook.cells) {
      if (cell.kind === 'code') await runCell(cell.id);
    }
  };

  const createNotebook = async (): Promise<void> => {
    const now = new Date().toISOString();
    const fresh: Notebook = {
      id: `nb_${Date.now().toString(36)}`,
      title: 'Untitled notebook',
      description: '',
      kernel: 'auto',
      createdAt: now,
      updatedAt: now,
      cells: [
        {
          id: `cell_${Date.now().toString(36)}a`,
          kind: 'markdown',
          language: 'javascript',
          source: '# Untitled notebook\n\nWrite a hypothesis, then prove it with a cell.',
          status: 'idle',
          updatedAt: now,
        },
        {
          id: `cell_${Date.now().toString(36)}b`,
          kind: 'code',
          language: 'javascript',
          source: 'return [1, 2, 3].map((n) => n ** 3);',
          status: 'idle',
          updatedAt: now,
        },
      ],
    };
    const saved = await invoke('notebooks.save', fresh);
    setNotebooks(saved);
    setNotebook(fresh);
  };

  if (!notebook) {
    return (
      <div className="nb">
        <EmptyState
          icon="notebook-pen"
          title="No notebook yet"
          body="Notebooks run real code in a live kernel — JavaScript, TypeScript, Python and shell."
          action={<Button variant="primary" icon="plus" onClick={() => void createNotebook()}>{t('space.create')}</Button>}
        />
      </div>
    );
  }

  const codeCells = notebook.cells.filter((cell) => cell.kind === 'code').length;

  return (
    <div className="nb">
      {showList ? (
        <aside className="nb__list">
          <div className="nb__listHead">
            <span className="small strong">{t('nav.notebook')}</span>
            <IconButton icon="plus" label="New notebook" onClick={() => void createNotebook()} />
          </div>
          <div className="n-scroll">
            {notebooks.map((item) => (
              <button
                key={item.id}
                type="button"
                className="nb__listItem"
                data-active={item.id === notebook.id}
                onClick={() => setNotebook(item)}
              >
                <Icon name="notebook-pen" size={14} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small truncate">{item.title}</div>
                  <div className="tiny faint">{item.cells.length} cells · {relativeTime(item.updatedAt)}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="nb__kernel">
            <span className="n-dot n-dot--online n-dot--live" />
            <span className="tiny">kernel · node</span>
          </div>
        </aside>
      ) : null}

      <section className="nb__main">
        <header className="nb__head">
          <IconButton icon="panel-left" label="Toggle list" onClick={() => setShowList(!showList)} />
          <input
            className="nb__title"
            value={notebook.title}
            onChange={(event) => persist({ ...notebook, title: event.target.value })}
          />
          <span className="n-badge">{codeCells} code</span>
          <span className="grow" />
          <Button variant="outline" size="sm" icon="play" onClick={() => void runAll()}>
            {t('notebook.runAll')}
          </Button>
          <Button variant="soft" size="sm" icon="plus" onClick={() => addCell('code')}>
            {t('notebook.addCell')}
          </Button>
        </header>

        <div className="nb__cells n-scroll">
          {notebook.cells.map((cell, index) => (
            <div key={cell.id} className="nb__cell" data-kind={cell.kind} data-status={cell.status}>
              <div className="nb__gutter">
                <span className="mono tiny faint">{index + 1}</span>
                {cell.kind === 'code' ? (
                  <button
                    type="button"
                    className="nb__run"
                    aria-label="Run cell"
                    onClick={() => void runCell(cell.id)}
                    disabled={running[cell.id]}
                  >
                    {running[cell.id] ? <Spinner size={12} /> : <Icon name="play" size={11} />}
                  </button>
                ) : (
                  <Icon name="file-text" size={12} className="faint" />
                )}
              </div>
              <div className="nb__cellBody">
                <div className="nb__cellBar">
                  {cell.kind === 'code' ? (
                    <select
                      className="nb__lang"
                      value={cell.language}
                      onChange={(event) => updateCell(cell.id, { language: event.target.value as CellLanguage })}
                    >
                      {LANGUAGES.map((language) => (
                        <option key={language.id} value={language.id}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="nb__langLabel">markdown</span>
                  )}
                  <span className="grow" />
                  {cell.durationMs ? <span className="tiny faint mono">{cell.durationMs}ms</span> : null}
                  <span className={`n-badge n-badge--${cell.status === 'ok' ? 'success' : cell.status === 'error' ? 'danger' : 'default'}`}>
                    {cell.status}
                  </span>
                  <div className="nb__cellActions">
                    <button type="button" aria-label="Move up" onClick={() => moveCell(cell.id, -1)}>
                      <Icon name="chevron-up" size={11} />
                    </button>
                    <button type="button" aria-label="Move down" onClick={() => moveCell(cell.id, 1)}>
                      <Icon name="chevron-down" size={11} />
                    </button>
                    <button type="button" aria-label="Delete cell" onClick={() => removeCell(cell.id)}>
                      <Icon name="trash" size={11} />
                    </button>
                  </div>
                </div>

                {cell.kind === 'markdown' ? (
                  <MarkdownCell source={cell.source} onChange={(source) => updateCell(cell.id, { source })} />
                ) : (
                  <textarea
                    className="nb__editor mono"
                    value={cell.source}
                    spellCheck={false}
                    onChange={(event) => updateCell(cell.id, { source: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void runCell(cell.id);
                      }
                    }}
                    rows={Math.max(2, Math.min(18, cell.source.split('\n').length + 1))}
                  />
                )}

                {cell.output ? (
                  <pre className={`nb__output mono ${cell.status === 'error' ? 'is-error' : ''}`}>{cell.output}</pre>
                ) : null}

                <div className="nb__addRow">
                  <button type="button" onClick={() => addCell('code', cell.id)}>
                    <Icon name="plus" size={11} /> code
                  </button>
                  <button type="button" onClick={() => addCell('markdown', cell.id)}>
                    <Icon name="plus" size={11} /> markdown
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="nb__append" onClick={() => addCell('code')}>
            <Icon name="plus" size={13} /> {t('notebook.addCell')}
          </button>
        </div>
      </section>
    </div>
  );
}

function MarkdownCell({ source, onChange }: { source: string; onChange: (source: string) => void }): JSX.Element {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="nb__markdown" onDoubleClick={() => setEditing(true)} role="button" tabIndex={0}>
        <Markdown source={source} />
        <span className="nb__editHint tiny faint">double-click to edit</span>
      </div>
    );
  }
  return (
    <textarea
      className="nb__editor nb__editor--md"
      value={source}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setEditing(false)}
      rows={Math.max(3, source.split('\n').length + 1)}
      autoFocus
    />
  );
}
