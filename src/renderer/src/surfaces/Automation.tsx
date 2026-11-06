import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeTypeSpec, PortName, RunStatus, Workflow, WorkflowNode, WorkflowRun } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, on } from '../lib/ipc';
import { formatDuration } from '../lib/util';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Field, IconButton, Menu, Spinner, Switch } from '../components/ui';

const NODE_W = 224;
const NODE_H = 68;

const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--n-text-4)',
  running: 'var(--n-warn)',
  ok: 'var(--n-success)',
  error: 'var(--n-danger)',
  cancelled: 'var(--n-text-4)',
};

export function AutomationSurface(): JSX.Element {
  const t = useT();
  const pushToast = useAppStore((s) => s.pushToast);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [specs, setSpecs] = useState<NodeTypeSpec[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [run, setRun] = useState<{ runId: string; status: RunStatus; nodes: Record<string, RunStatus>; log: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'pan' | 'node'; nodeId?: string; startX: number; startY: number; originX: number; originY: number; panX: number; panY: number } | null>(null);
  const connectRef = useRef<{ from: string; port: PortName } | null>(null);
  const [pendingLine, setPendingLine] = useState<{ from: string; port: PortName; x: number; y: number } | null>(null);

  const specFor = useCallback((type: string) => specs.find((spec) => spec.type === type), [specs]);

  const load = useCallback(async () => {
    const [list, nodeTypes] = await Promise.all([invoke('automation.list', undefined), invoke('automation.nodeTypes', undefined)]);
    setSpecs(nodeTypes);
    setWorkflows(list);
    if (!activeId && list[0]) {
      setActiveId(list[0].id);
    }
  }, [activeId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const found = workflows.find((item) => item.id === activeId);
    if (found) {
      setWorkflow(structuredClone(found));
      setSelectedNode(null);
      setSelectedEdge(null);
      setPan({ x: 40, y: 40 });
      setZoom(1);
      void invoke('automation.runs', { workflowId: activeId }).then(setRuns);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const dispose = on('automation:event', (event) => {
      if (!workflow || event.workflowId !== workflow.id) return;
      setRun((current) => {
        if (!current || current.runId !== event.runId) {
          return { runId: event.runId, status: event.status, nodes: event.nodeId && event.nodeStatus ? { [event.nodeId]: event.nodeStatus } : {}, log: event.message ? [event.message] : [] };
        }
        return {
          ...current,
          status: event.status,
          nodes: event.nodeId && event.nodeStatus ? { ...current.nodes, [event.nodeId]: event.nodeStatus } : current.nodes,
          log: event.message ? [...current.log.slice(-120), event.message] : current.log,
        };
      });
      if (['ok', 'error', 'cancelled'].includes(event.status) && !event.nodeId) {
        void invoke('automation.runs', { workflowId: workflow.id }).then(setRuns);
        if (event.status === 'ok') pushToast({ title: 'Workflow finished', message: workflow.name, kind: 'success' });
        if (event.status === 'error') pushToast({ title: 'Workflow failed', message: event.message ?? 'error', kind: 'error' });
      }
    });
    return () => dispose();
  }, [workflow, pushToast]);

  const saveDraft = useCallback(
    async (draft: Workflow) => {
      const list = await invoke('automation.save', draft);
      setWorkflows(list);
    },
    [],
  );

  useEffect(() => {
    if (!workflow) return;
    const timer = setTimeout(() => void saveDraft(workflow), 700);
    return () => clearTimeout(timer);
  }, [workflow, saveDraft]);

  const patchWorkflow = (patch: Partial<Workflow>): void => setWorkflow((current) => (current ? { ...current, ...patch } : current));

  const patchNode = (nodeId: string, patch: Partial<WorkflowNode>): void =>
    setWorkflow((current) =>
      current ? { ...current, nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch, config: { ...node.config, ...(patch.config ?? {}) } } : node)) } : current,
    );

  const addNode = (spec: NodeTypeSpec): void => {
    if (!workflow) return;
    const config: Record<string, unknown> = {};
    for (const field of spec.fields) if (field.default !== undefined) config[field.key] = field.default;
    const node: WorkflowNode = {
      id: `node_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      type: spec.type,
      name: spec.label,
      x: Math.round((260 - pan.x) / zoom),
      y: Math.round((140 - pan.y) / zoom),
      config,
    };
    patchWorkflow({ nodes: [...workflow.nodes, node] });
    setSelectedNode(node.id);
    setAddOpen(false);
  };

  const removeNode = (nodeId: string): void => {
    if (!workflow) return;
    patchWorkflow({
      nodes: workflow.nodes.filter((node) => node.id !== nodeId),
      edges: workflow.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
    });
    setSelectedNode(null);
  };

  const addEdge = (from: string, fromPort: PortName, to: string): void => {
    if (!workflow || from === to) return;
    if (workflow.edges.some((edge) => edge.from === from && edge.fromPort === fromPort && edge.to === to)) return;
    patchWorkflow({ edges: [...workflow.edges, { id: `edge_${Date.now().toString(36)}`, from, fromPort, to }] });
  };

  const canvasPoint = (event: React.PointerEvent | React.MouseEvent | PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left - pan.x) / zoom, y: (event.clientY - rect.top - pan.y) / zoom };
  };

  const startPan = (event: React.PointerEvent): void => {
    if (event.button !== 0) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    dragRef.current = { mode: 'pan', startX: event.clientX, startY: event.clientY, originX: 0, originY: 0, panX: pan.x, panY: pan.y };
  };

  const startNodeDrag = (event: React.PointerEvent, node: WorkflowNode): void => {
    event.stopPropagation();
    setSelectedNode(node.id);
    setSelectedEdge(null);
    dragRef.current = {
      mode: 'node',
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (drag) {
        if (drag.mode === 'pan') {
          setPan({ x: drag.panX + (event.clientX - drag.startX), y: drag.panY + (event.clientY - drag.startY) });
        } else if (drag.nodeId) {
          const dx = (event.clientX - drag.startX) / zoom;
          const dy = (event.clientY - drag.startY) / zoom;
          patchNode(drag.nodeId, { x: Math.round(drag.originX + dx), y: Math.round(drag.originY + dy) });
        }
      }
      if (connectRef.current) {
        const point = canvasPoint(event as unknown as PointerEvent);
        setPendingLine({ ...connectRef.current, x: point.x, y: point.y });
      }
    };
    const onUp = (): void => {
      dragRef.current = null;
      if (connectRef.current) {
        connectRef.current = null;
        setPendingLine(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pan]);

  const onWheel = (event: React.WheelEvent): void => {
    if (!event.ctrlKey && !event.metaKey) {
      setPan({ x: pan.x - event.deltaX, y: pan.y - event.deltaY });
      return;
    }
    event.preventDefault();
    setZoom((current) => Math.max(0.4, Math.min(1.6, current - event.deltaY * 0.0012)));
  };

  const runWorkflow = async (): Promise<void> => {
    if (!workflow) return;
    setBusy(true);
    try {
      await saveDraft(workflow);
      const input = run?.log[0] ?? '';
      void input;
      const { runId } = await invoke('automation.run', { id: workflow.id, input: '' });
      setRun({ runId, status: 'running', nodes: {}, log: [] });
    } catch (error) {
      pushToast({ title: 'Run failed', message: (error as Error).message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const createWorkflow = async (): Promise<void> => {
    const now = new Date().toISOString();
    const draft: Workflow = {
      id: `flow_${Date.now().toString(36)}`,
      name: 'Untitled workflow',
      description: '',
      nodes: [],
      edges: [],
      enabled: false,
      createdAt: now,
      updatedAt: now,
    };
    const list = await invoke('automation.save', draft);
    setWorkflows(list);
    setActiveId(draft.id);
  };

  const selected = workflow?.nodes.find((node) => node.id === selectedNode) ?? null;
  const selectedSpec = selected ? specFor(selected.type) : null;
  const grouped = useMemo(() => {
    const map = new Map<string, NodeTypeSpec[]>();
    for (const spec of specs) {
      const list = map.get(spec.category) ?? [];
      list.push(spec);
      map.set(spec.category, list);
    }
    return [...map.entries()];
  }, [specs]);

  if (!workflows.length && !workflow) {
    return (
      <div className="auto">
        <EmptyState
          icon="workflow"
          title="No workflows yet"
          body="Compose triggers, agents, tools and actions into a workflow — like n8n, but wired into your OS."
          action={<Button variant="primary" icon="plus" onClick={() => void createWorkflow()}>Create workflow</Button>}
        />
        <div className="auto__go" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="auto center" style={{ height: '100%' }}>
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="auto">
      <aside className="auto__list">
        <div className="auto__listHead">
          <span className="small strong">{t('nav.automation')}</span>
          <IconButton icon="plus" label="New workflow" onClick={() => void createWorkflow()} />
        </div>
        <div className="n-scroll" style={{ flex: 1 }}>
          {workflows.map((item) => {
            const lastRun = runs.find((entry) => entry.workflowId === item.id);
            return (
              <button key={item.id} type="button" className="auto__listItem" data-active={item.id === activeId} onClick={() => setActiveId(item.id)}>
                <span className="auto__listDot" data-enabled={item.enabled} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small truncate">{item.name}</div>
                  <div className="tiny faint">
                    {item.nodes.length} nodes{lastRun ? ` · ${lastRun.status}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button type="button" className="auto__runsToggle" onClick={() => setShowRuns(!showRuns)}>
          <Icon name="history" size={13} />
          Run history
          <span className="grow" />
          <span className="tiny faint">{runs.length}</span>
        </button>
        {showRuns ? (
          <div className="auto__runs n-scroll">
            {runs.slice(0, 12).map((entry) => (
              <div key={entry.id} className="auto__runRow">
                <span className="n-dot" style={{ background: STATUS_COLOR[entry.status] }} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="tiny truncate">{entry.trigger}</div>
                  <div className="tiny faint">{new Date(entry.startedAt).toLocaleTimeString()}</div>
                </div>
                <span className="tiny" style={{ color: STATUS_COLOR[entry.status] }}>{entry.status}</span>
              </div>
            ))}
            {!runs.length ? <div className="tiny faint" style={{ padding: 8 }}>No runs yet.</div> : null}
          </div>
        ) : null}
      </aside>

      <section className="auto__main">
        <header className="auto__toolbar">
          <input className="auto__name" value={workflow.name} onChange={(event) => patchWorkflow({ name: event.target.value })} />
          <label className="row" style={{ gap: 6 }}>
            <Switch on={workflow.enabled} onChange={(enabled) => patchWorkflow({ enabled })} label="Enabled" />
            <span className="tiny faint">{workflow.enabled ? 'enabled' : 'disabled'}</span>
          </label>
          <span className="grow" />
          <span className="tiny faint mono">{Math.round(zoom * 100)}%</span>
          <IconButton icon="minus" label="Zoom out" size={14} onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} />
          <IconButton icon="plus" label="Zoom in" size={14} onClick={() => setZoom(Math.min(1.6, zoom + 0.1))} />
          <IconButton icon="rotate-ccw" label="Reset view" size={14} onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }} />
          <div style={{ position: 'relative' }}>
            <Button variant="outline" size="sm" icon="plus" onClick={() => setAddOpen(true)}>
              Node
            </Button>
            {addOpen ? (
              <div className="auto__addMenu">
                {grouped.map(([category, list]) => (
                  <div key={category}>
                    <div className="auto__addGroup">{category}</div>
                    {list.map((spec) => (
                      <button key={spec.type} type="button" onClick={() => addNode(spec)}>
                        <Icon name={spec.icon} size={14} />
                        <span className="grow">{spec.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Button variant="primary" size="sm" icon={busy ? undefined : 'play'} onClick={() => void runWorkflow()} disabled={busy || run?.status === 'running'}>
            {busy || run?.status === 'running' ? <Spinner size={13} /> : null}
            Run
          </Button>
        </header>

        <div className="auto__canvas" ref={canvasRef} onPointerDown={startPan} onWheel={onWheel}>
          <div className="auto__grid" style={{ backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${28 * zoom}px ${28 * zoom}px` }} />
          <div className="auto__world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg className="auto__edges" width="4000" height="3000" aria-hidden>
              {workflow.edges.map((edge) => {
                const from = workflow.nodes.find((node) => node.id === edge.from);
                const to = workflow.nodes.find((node) => node.id === edge.to);
                if (!from || !to) return null;
                const portIndex = edge.fromPort === 'true' ? 0 : edge.fromPort === 'false' ? 1 : 0;
                const fromSpec = specFor(from.type);
                const multi = (fromSpec?.outputs.length ?? 1) > 1;
                const fy = from.y + NODE_H / 2 + (multi ? (portIndex === 0 ? -12 : 12) : 0);
                const fx = from.x + NODE_W;
                const tx = to.x;
                const ty = to.y + NODE_H / 2;
                const dx = Math.max(60, Math.abs(tx - fx) * 0.5);
                const path = `M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
                return (
                  <g key={edge.id}>
                    <path d={path} className="auto__edge" data-selected={selectedEdge === edge.id} />
                    <path
                      d={path}
                      className="auto__edgeHit"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEdge(edge.id);
                        setSelectedNode(null);
                      }}
                    />
                  </g>
                );
              })}
              {pendingLine ? (
                <path
                  d={`M ${(workflow.nodes.find((node) => node.id === pendingLine.from)?.x ?? 0) + NODE_W} ${
                    (workflow.nodes.find((node) => node.id === pendingLine.from)?.y ?? 0) + NODE_H / 2
                  } C ${pendingLine.x} ${pendingLine.y}, ${pendingLine.x} ${pendingLine.y}, ${pendingLine.x} ${pendingLine.y}`}
                  className="auto__edge auto__edge--pending"
                />
              ) : null}
            </svg>

            {workflow.nodes.map((node) => {
              const spec = specFor(node.type);
              const status = run?.nodes[node.id];
              const outputs = spec?.outputs ?? ['main'];
              return (
                <div
                  key={node.id}
                  className="autoNode"
                  data-selected={selectedNode === node.id}
                  data-status={status}
                  data-trigger={node.type.startsWith('trigger.')}
                  style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                  onPointerDown={(event) => startNodeDrag(event, node)}
                  onClick={() => { setSelectedNode(node.id); setSelectedEdge(null); }}
                >
                  <div className="autoNode__icon">
                    <Icon name={spec?.icon ?? 'circle'} size={15} />
                  </div>
                  <div className="autoNode__body">
                    <div className="autoNode__name truncate">{node.name}</div>
                    <div className="autoNode__type truncate">{spec?.label ?? node.type}</div>
                  </div>
                  {status ? <span className="autoNode__status" style={{ background: STATUS_COLOR[status] }} /> : null}
                  <span
                    className="autoPort autoPort--in"
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      const pending = connectRef.current;
                      if (pending) addEdge(pending.from, pending.port, node.id);
                      connectRef.current = null;
                      setPendingLine(null);
                    }}
                  />
                  {outputs.map((port, index) => (
                    <span
                      key={port}
                      className="autoPort autoPort--out"
                      data-port={port}
                      style={{ top: outputs.length > 1 ? (index === 0 ? '30%' : '70%') : '50%' }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        connectRef.current = { from: node.id, port };
                        const point = canvasPoint(event);
                        setPendingLine({ from: node.id, port, x: point.x, y: point.y });
                      }}
                      title={`Output: ${port}`}
                    />
                  ))}
                </div>
              );
            })}
            {!workflow.nodes.length ? (
              <div className="auto__emptyCanvas">
                <div className="small strong">Empty canvas</div>
                <div className="tiny faint">Add a trigger, then agents, tools and actions. Drag from a right-hand dot to connect.</div>
                <Button variant="soft" size="sm" icon="plus" onClick={() => setAddOpen(true)}>
                  Add the first node
                </Button>
              </div>
            ) : null}
          </div>

        </div>
      </section>

      <aside className="auto__inspector">
        {run ? (
          <div className="auto__runBox">
              <div className="row" style={{ gap: 8 }}>
                <span className="n-dot" style={{ background: STATUS_COLOR[run.status] }} />
                <span className="small strong">Run {run.status}</span>
                <span className="tiny faint mono">{run.runId.slice(-6)}</span>
                <span className="grow" />
                {run.status === 'running' ? (
                  <Button variant="ghost" size="sm" icon="square" onClick={() => void invoke('automation.cancel', { runId: run.runId })}>
                    Cancel
                  </Button>
                ) : (
                  <IconButton icon="x" label="Hide" onClick={() => setRun(null)} />
                )}
              </div>
              <div className="auto__runLog n-scroll">
                {workflow.nodes
                  .filter((node) => run.nodes[node.id])
                  .map((node) => (
                    <div key={node.id} className="auto__logRow">
                      <span className="n-dot" style={{ background: STATUS_COLOR[run.nodes[node.id]] }} />
                      <span className="tiny truncate">{node.name}</span>
                      <span className="grow" />
                      <span className="tiny faint">{run.nodes[node.id]}</span>
                    </div>
                  ))}
                {run.log.slice(-6).map((line, index) => (
                  <div key={index} className="auto__logLine tiny mono">{line}</div>
                ))}
              </div>
            </div>
        ) : null}

        {selected && selectedSpec ? (
          <>
            <div className="auto__inspectorHead">
              <span className="n-badge n-badge--accent">{selectedSpec.category}</span>
              <span className="grow" />
              <IconButton icon="trash" label="Delete node" onClick={() => removeNode(selected.id)} />
            </div>
            <Field label="Name">
              <input className="n-input" value={selected.name} onChange={(event) => patchNode(selected.id, { name: event.target.value })} />
            </Field>
            <div className="auto__inspectorType tiny faint">{selectedSpec.description}</div>
            {selectedSpec.fields.map((field) => (
              <NodeField
                key={field.key}
                field={field}
                value={selected.config[field.key]}
                onChange={(value) => patchNode(selected.id, { config: { [field.key]: value } })}
              />
            ))}
          </>
        ) : selectedEdge ? (
          <>
            <div className="auto__inspectorHead">
              <span className="n-badge">edge</span>
              <span className="grow" />
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={() => {
                  patchWorkflow({ edges: workflow.edges.filter((edge) => edge.id !== selectedEdge) });
                  setSelectedEdge(null);
                }}
              >
                Delete
              </Button>
            </div>
            <div className="tiny faint">Connects two nodes. Drag from an output dot to an input dot to create another.</div>
          </>
        ) : (
          <>
            <div className="auto__inspectorHead">
              <span className="small strong">Workflow</span>
            </div>
            <Field label="Description">
              <textarea className="n-input n-textarea" rows={3} value={workflow.description} onChange={(event) => patchWorkflow({ description: event.target.value })} />
            </Field>
            <div className="auto__inspectorStats">
              <div><span className="mono small">{workflow.nodes.length}</span><span className="tiny faint">nodes</span></div>
              <div><span className="mono small">{workflow.edges.length}</span><span className="tiny faint">edges</span></div>
              <div><span className="mono small">{workflow.enabled ? 'on' : 'off'}</span><span className="tiny faint">trigger</span></div>
            </div>
            <div className="auto__hint">
              <Icon name="info" size={13} className="faint" />
              <span className="tiny faint">
                Select a node to edit it. Drag nodes to move, drag the background to pan, ⌘/Ctrl + wheel to zoom.
              </span>
            </div>
            <div className="auto__templates">
              <div className="tiny faint uppercase">Triggers available</div>
              {specs.filter((spec) => spec.category === 'trigger').map((spec) => (
                <div key={spec.type} className="auto__templateRow">
                  <Icon name={spec.icon} size={12} />
                  <span className="tiny">{spec.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function NodeField({ field, value, onChange }: { field: NodeTypeSpec['fields'][number]; value: unknown; onChange: (value: unknown) => void }): JSX.Element {
  if (field.kind === 'select') {
    return (
      <Field label={field.label} hint={field.hint}>
        <select className="n-select" value={String(value ?? field.default ?? '')} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.kind === 'textarea' || field.kind === 'code') {
    return (
      <Field label={field.label} hint={field.hint}>
        <textarea
          className="n-input n-textarea n-textarea--mono"
          rows={field.kind === 'code' ? 3 : 4}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    );
  }
  if (field.kind === 'number') {
    return (
      <Field label={field.label} hint={field.hint}>
        <input className="n-input" type="number" value={Number(value ?? field.default ?? 0)} onChange={(event) => onChange(Number(event.target.value))} />
      </Field>
    );
  }
  if (field.kind === 'checkbox') {
    return (
      <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
        <span className="n-label">{field.label}</span>
        <Switch on={Boolean(value)} onChange={onChange} label={field.label} />
      </div>
    );
  }
  return (
    <Field label={field.label} hint={field.hint}>
      <input className="n-input" value={String(value ?? '')} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export const automationHelpers = { formatDuration };
