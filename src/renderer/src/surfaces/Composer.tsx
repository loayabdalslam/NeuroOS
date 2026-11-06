import { useCallback, useEffect, useRef, useState } from 'react';
import type { Composition, CompositionRun, CompositionStep } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, on } from '../lib/ipc';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Field, IconButton, Spinner, Switch } from '../components/ui';

export function ComposerSurface(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const pushToast = useAppStore((s) => s.pushToast);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Composition | null>(null);
  const [input, setInput] = useState('Summarise the current state of agentic developer tools in 2026.');
  const [run, setRun] = useState<CompositionRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<CompositionRun[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void invoke('composition.list', undefined).then((list) => {
      setCompositions(list);
      if (list[0]) setActiveId(list[0].id);
    });
  }, []);

  useEffect(() => {
    const found = compositions.find((item) => item.id === activeId);
    if (found) setDraft(structuredClone(found));
    if (activeId) void invoke('composition.runs', { compositionId: activeId }).then(setRuns);
  }, [activeId, compositions.length]);

  useEffect(() => {
    const dispose = on('composition:event', (event) => {
      setRun((current) => {
        if (!current || current.id !== event.runId) return current;
        const steps = current.steps.map((step) => (step.stepId === event.stepId ? { ...step, status: 'ok' as const, output: event.output ?? step.output } : step));
        return { ...current, status: event.status, steps };
      });
      if (['ok', 'error', 'cancelled'].includes(event.status) && !event.stepId) {
        void invoke('composition.runs', { compositionId: event.compositionId }).then(setRuns);
        if (event.status === 'ok') pushToast({ title: 'Composition finished', kind: 'success' });
      }
    });
    return () => dispose();
  }, [pushToast]);

  const persist = useCallback((next: Composition) => {
    setDraft(next);
    setCompositions((current) => current.map((item) => (item.id === next.id ? next : item)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void invoke('composition.save', next).then(setCompositions).catch(() => {});
    }, 600);
  }, []);

  const patch = (value: Partial<Composition>): void => {
    if (!draft) return;
    persist({ ...draft, ...value });
  };

  const patchStep = (stepId: string, value: Partial<CompositionStep>): void => {
    if (!draft) return;
    patch({ steps: draft.steps.map((step) => (step.id === stepId ? { ...step, ...value } : step)) });
  };

  const addStep = (): void => {
    if (!draft) return;
    patch({
      steps: [
        ...draft.steps,
        {
          id: `step_${Date.now().toString(36)}`,
          name: `Step ${draft.steps.length + 1}`,
          agentId: settings?.agents[0]?.id ?? 'neuro',
          prompt: '{{previous}}',
          usePrevious: true,
        },
      ],
    });
  };

  const removeStep = (stepId: string): void => {
    if (!draft) return;
    patch({ steps: draft.steps.filter((step) => step.id !== stepId) });
  };

  const moveStep = (stepId: string, direction: -1 | 1): void => {
    if (!draft) return;
    const index = draft.steps.findIndex((step) => step.id === stepId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    patch({ steps });
  };

  const createComposition = async (): Promise<void> => {
    const now = new Date().toISOString();
    const fresh: Composition = {
      id: `comp_${Date.now().toString(36)}`,
      name: 'New composition',
      description: '',
      steps: [
        { id: `step_${Date.now().toString(36)}`, name: 'Draft', agentId: settings?.agents[0]?.id ?? 'neuro', prompt: '{{input}}', usePrevious: false },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const list = await invoke('composition.save', fresh);
    setCompositions(list);
    setActiveId(fresh.id);
    setDraft(fresh);
  };

  const runComposition = async (): Promise<void> => {
    if (!draft) return;
    setBusy(true);
    try {
      await invoke('composition.save', draft);
      const { runId } = await invoke('composition.run', { id: draft.id, input });
      setRun({
        id: runId,
        compositionId: draft.id,
        compositionName: draft.name,
        status: 'running',
        startedAt: new Date().toISOString(),
        steps: draft.steps.map((step) => ({ stepId: step.id, name: step.name, status: 'running' as const, output: '' })),
      });
    } catch (error) {
      pushToast({ title: 'Composition failed to start', message: (error as Error).message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <div className="composer center" style={{ height: '100%' }}>
        <EmptyState
          icon="boxes"
          title="Compose agents"
          body="Chain agents into a pipeline. Each step can see the original input and the previous step's output."
          action={<Button variant="primary" icon="plus" onClick={() => void createComposition()}>New composition</Button>}
        />
      </div>
    );
  }

  return (
    <div className="composer">
      <aside className="composer__list">
        <div className="composer__listHead">
          <span className="small strong">Compositions</span>
          <IconButton icon="plus" label="New composition" onClick={() => void createComposition()} />
        </div>
        <div className="n-scroll" style={{ flex: 1 }}>
          {compositions.map((item) => (
            <button key={item.id} type="button" className="composer__listItem" data-active={item.id === activeId} onClick={() => setActiveId(item.id)}>
              <Icon name="boxes" size={14} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small truncate">{item.name}</div>
                <div className="tiny faint">{item.steps.length} steps</div>
              </div>
            </button>
          ))}
        </div>
        <div className="composer__runs">
          <div className="tiny faint uppercase" style={{ padding: '6px 10px 2px' }}>Recent runs</div>
          {runs.slice(0, 5).map((entry) => (
            <div key={entry.id} className="composer__runRow">
              <span className="n-dot" style={{ background: entry.status === 'ok' ? 'var(--n-success)' : entry.status === 'error' ? 'var(--n-danger)' : 'var(--n-warn)' }} />
              <span className="tiny">{new Date(entry.startedAt).toLocaleTimeString()}</span>
              <span className="grow" />
              <span className="tiny faint">{entry.status}</span>
            </div>
          ))}
          {!runs.length ? <div className="tiny faint" style={{ padding: '2px 10px 8px' }}>No runs yet.</div> : null}
        </div>
      </aside>

      <section className="composer__main">
        <header className="composer__head">
          <input className="composer__name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          <span className="n-badge">{draft.steps.length} step{draft.steps.length === 1 ? '' : 's'}</span>
          <span className="grow" />
          <Button variant="outline" size="sm" icon="plus" onClick={addStep}>
            Add step
          </Button>
          <Button variant="primary" size="sm" icon={busy ? undefined : 'play'} onClick={() => void runComposition()} disabled={busy || run?.status === 'running' || !draft.steps.length}>
            {busy || run?.status === 'running' ? <Spinner size={13} /> : null}
            Run
          </Button>
        </header>

        <div className="composer__body n-scroll">
          <Field label="Description">
            <input className="n-input" value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="What this pipeline is for" />
          </Field>

          <div className="composer__steps">
            {draft.steps.map((step, index) => {
              const runStep = run?.steps.find((item) => item.stepId === step.id);
              return (
                <div key={step.id} className="composerStep" data-status={runStep?.status}>
                  <div className="composerStep__rail">
                    <span className="composerStep__index">{index + 1}</span>
                    {index < draft.steps.length - 1 ? <span className="composerStep__line" /> : null}
                  </div>
                  <div className="composerStep__card">
                    <div className="composerStep__head">
                      <input className="composerStep__title" value={step.name} onChange={(event) => patchStep(step.id, { name: event.target.value })} />
                      <span className="n-badge">{runStep?.status ?? 'step'}</span>
                      <div className="row" style={{ gap: 1 }}>
                        <IconButton icon="chevron-up" label="Move up" size={12} onClick={() => moveStep(step.id, -1)} />
                        <IconButton icon="chevron-down" label="Move down" size={12} onClick={() => moveStep(step.id, 1)} />
                        <IconButton icon="trash" label="Delete" size={12} onClick={() => removeStep(step.id)} />
                      </div>
                    </div>
                    <div className="composerStep__controls">
                      <label className="n-label">Agent</label>
                      <select className="n-select" value={step.agentId} onChange={(event) => patchStep(step.id, { agentId: event.target.value })}>
                        {(settings?.agents ?? []).map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                      <span className="grow" />
                      <span className="tiny faint">use previous output</span>
                      <Switch on={step.usePrevious} onChange={(usePrevious) => patchStep(step.id, { usePrevious })} label="Use previous" />
                    </div>
                    <textarea
                      className="composerStep__prompt mono"
                      rows={4}
                      value={step.prompt}
                      onChange={(event) => patchStep(step.id, { prompt: event.target.value })}
                      placeholder="Prompt — use {{input}} and {{previous}}"
                    />
                    {runStep?.output ? (
                      <div className="composerStep__output n-scroll">
                        <div className="tiny faint uppercase">output</div>
                        <pre className="mono">{runStep.output}</pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!draft.steps.length ? (
              <div className="tiny faint" style={{ padding: 20, textAlign: 'center' }}>
                No steps yet — add the first agent.
              </div>
            ) : null}
          </div>

          <div className="composer__input">
            <Field label="Input" hint="Passed to the first step as {{input}} and to every step that references it.">
              <textarea className="n-input n-textarea" rows={3} value={input} onChange={(event) => setInput(event.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <aside className="composer__run">
        <div className="composer__runHead">
          <span className="small strong">Run</span>
          {run ? <span className="n-badge">{run.status}</span> : <span className="n-badge">idle</span>}
        </div>
        <div className="composer__runBody n-scroll">
          {run ? (
            run.steps.map((step, index) => (
              <div key={step.stepId} className="composer__runStep">
                <div className="row" style={{ gap: 6 }}>
                  <span className="composerStep__index" style={{ width: 18, height: 18, fontSize: 9 }}>{index + 1}</span>
                  <span className="small truncate">{step.name}</span>
                  <span className="grow" />
                  <span className="tiny faint">{step.status}</span>
                </div>
                {step.output ? <pre className="composer__runOutput mono">{step.output.slice(0, 1200)}</pre> : null}
              </div>
            ))
          ) : (
            <div className="tiny faint" style={{ padding: 10, lineHeight: 1.6 }}>
              Run the composition to see each agent's output. Steps execute in order and pass their text forward.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
