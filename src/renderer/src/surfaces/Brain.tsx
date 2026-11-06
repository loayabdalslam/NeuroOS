import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BrainGraph, BrainHit, BrainNode, BrainProfile, BrainStats, BrainEventRecord } from '@shared/types';
import { useAppStore } from '../state/store';
import { invoke, on } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { useT } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { Button, EmptyState, IconButton, Spinner, Switch } from '../components/ui';

type Tab = 'graph' | 'timeline' | 'ask' | 'profile';

const KIND_COLOR: Record<string, string> = {
  app: '#5686fe',
  page: '#a78bfa',
  action: '#22c55e',
  person: '#f472b6',
  site: '#14b8a6',
  tool: '#f59e0b',
  workflow: '#fb7185',
  topic: '#94a3b8',
  memory: '#eab308',
};

interface SimNode extends BrainNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export function BrainSurface(): JSX.Element {
  const t = useT();
  const pushToast = useAppStore((s) => s.pushToast);
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [graph, setGraph] = useState<BrainGraph>({ nodes: [], edges: [] });
  const [timeline, setTimeline] = useState<BrainEventRecord[]>([]);
  const [profile, setProfile] = useState<BrainProfile | null>(null);
  const [tab, setTab] = useState<Tab>('graph');
  const [selected, setSelected] = useState<BrainNode | null>(null);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<{ text: string; hits: BrainHit[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [teaching, setTeaching] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const hoverRef = useRef<SimNode | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    const [statsNow, graphNow, timelineNow, profileNow] = await Promise.all([
      invoke('brain.stats', undefined),
      invoke('brain.graph', { limit: 120 }),
      invoke('brain.timeline', { limit: 80 }),
      invoke('brain.profile', undefined),
    ]);
    setStats(statsNow);
    setGraph(graphNow);
    setTimeline(timelineNow);
    setProfile(profileNow);
  }, []);

  useEffect(() => {
    void load();
    const dispose = on('brain:event', (event) => {
      if (event.stats) setStats(event.stats);
      if (event.node) setGraph((current) => (current.nodes.some((node) => node.id === event.node!.id) ? current : current));
    });
    const timer = setInterval(() => {
      if (!stats?.recording) return;
      void invoke('brain.timeline', { limit: 80 }).then(setTimeline).catch(() => {});
    }, 6000);
    return () => {
      dispose();
      clearInterval(timer);
    };
  }, [load, stats?.recording]);

  useEffect(() => {
    if (tab !== 'graph') return;
    void invoke('brain.graph', { limit: 120 }).then(setGraph).catch(() => {});
  }, [tab, stats?.events]);

  /* ------------------------------- simulation ------------------------------- */
  useEffect(() => {
    const width = wrapRef.current?.clientWidth ?? 800;
    const height = wrapRef.current?.clientHeight ?? 600;
    const radius = Math.min(width, height) * 0.42;
    simRef.current = graph.nodes.map((node, index) => {
      const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius * (0.55 + Math.random() * 0.45),
        y: height / 2 + Math.sin(angle) * radius * (0.55 + Math.random() * 0.45),
        vx: 0,
        vy: 0,
        r: 3 + Math.sqrt(node.weight) * 1.9,
      };
    });
  }, [graph]);

  useEffect(() => {
    if (tab !== 'graph') return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let disposed = false;
    const dpr = window.devicePixelRatio || 1;
    const resize = (): void => {
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = `${wrap.clientWidth}px`;
      canvas.style.height = `${wrap.clientHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    const positions = new Map<string, SimNode>();

    const loop = (): void => {
      if (disposed) return;
      frame += 1;
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      const nodes = simRef.current;
      positions.clear();
      for (const node of nodes) positions.set(node.id, node);

      // repulsion
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy) || 0.01;
          if (distance > 280) continue;
          const force = 900 / (distance * distance);
          dx /= distance;
          dy /= distance;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }
      // springs
      for (const edge of graph.edges) {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const target = 118;
        const force = (distance - target) * 0.0016;
        a.vx += (dx / distance) * force * 60;
        a.vy += (dy / distance) * force * 60;
        b.vx -= (dx / distance) * force * 60;
        b.vy -= (dy / distance) * force * 60;
      }
      for (const node of nodes) {
        node.vx += (width / 2 - node.x) * 0.0009;
        node.vy += (height / 2 - node.y) * 0.0009;
        node.vx *= 0.92;
        node.vy *= 0.92;
        node.x = Math.max(node.r + 6, Math.min(width - node.r - 6, node.x + node.vx));
        node.y = Math.max(node.r + 6, Math.min(height - node.r - 6, node.y + node.vy));
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(width / 2 + offsetRef.current.x, height / 2 + offsetRef.current.y);
      context.scale(zoom, zoom);
      context.translate(-width / 2, -height / 2);

      for (const edge of graph.edges) {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) continue;
        context.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        context.lineWidth = Math.min(2.4, 0.6 + edge.weight * 0.18);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      const hover = hoverRef.current;
      for (const node of nodes) {
        const color = KIND_COLOR[node.kind] ?? '#94a3b8';
        const isSelected = selected?.id === node.id;
        if (isSelected || hover?.id === node.id) {
          context.beginPath();
          context.arc(node.x, node.y, node.r + 5, 0, Math.PI * 2);
          context.fillStyle = `${color}22`;
          context.fill();
        }
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fillStyle = color;
        context.globalAlpha = 0.35 + node.salience * 0.65;
        context.fill();
        context.globalAlpha = 1;
        if (isSelected) {
          context.strokeStyle = '#fff';
          context.lineWidth = 1.4;
          context.stroke();
        }
        if (node.r > 7 || isSelected || hover?.id === node.id) {
          context.font = `${isSelected ? 600 : 500} ${isSelected ? 12 : 10.5}px ui-sans-serif, system-ui`;
          context.fillStyle = isSelected ? '#f4f5fa' : 'rgba(226, 232, 240, 0.72)';
          context.textAlign = 'center';
          context.fillText(node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label, node.x, node.y + node.r + 12);
        }
      }
      context.restore();
      if (frame % 2 === 0) frame = 0;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [graph, tab, zoom, selected]);

  const pick = (event: React.MouseEvent<HTMLCanvasElement>): SimNode | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = (event.clientX - rect.left - offsetRef.current.x - rect.width / 2) / zoom + rect.width / 2;
    const y = (event.clientY - rect.top - offsetRef.current.y - rect.height / 2) / zoom + rect.height / 2;
    let best: SimNode | null = null;
    let bestDistance = 18;
    for (const node of simRef.current) {
      const distance = Math.hypot(node.x - x, node.y - y);
      if (distance < Math.max(bestDistance, node.r + 5)) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  };

  const ask = async (): Promise<void> => {
    if (!query.trim()) return;
    setAsking(true);
    try {
      const result = await invoke('brain.ask', { query: query.trim() });
      setAnswer(result);
      await invoke('brain.capture', {
        items: [{ kind: 'query', label: `Asked memory: ${query.slice(0, 70)}`, detail: query, surface: 'brain', app: 'brain', tags: ['memory', 'query'] }],
      });
    } finally {
      setAsking(false);
    }
  };

  const teach = async (): Promise<void> => {
    if (!teaching.trim()) return;
    await invoke('brain.remember', { text: teaching.trim(), tags: ['user'] });
    setTeaching('');
    pushToast({ title: 'Memory stored', message: 'It is now part of the graph.', kind: 'success' });
    await load();
  };

  const toggleRecording = async (enabled: boolean): Promise<void> => {
    const next = await invoke('brain.recording', { enabled });
    setStats(next);
    pushToast({ title: enabled ? 'Recording resumed' : 'Recording paused', message: enabled ? 'Every action is being remembered.' : 'Nothing new is captured until you resume.', kind: enabled ? 'success' : 'info' });
  };

  const forget = async (node: BrainNode): Promise<void> => {
    const next = await invoke('brain.forget', { id: node.id });
    setStats(next);
    setSelected(null);
    await load();
  };

  const wipe = async (): Promise<void> => {
    setBusy(true);
    try {
      const next = await invoke('brain.wipe', undefined);
      setStats(next);
      setSelected(null);
      setAnswer(null);
      await load();
      pushToast({ title: 'Brain wiped', message: 'All nodes and events were deleted.', kind: 'info' });
    } finally {
      setBusy(false);
    }
  };

  const related = useMemo(() => {
    if (!selected) return [];
    return graph.edges
      .filter((edge) => edge.from === selected.id || edge.to === selected.id)
      .map((edge) => ({
        relation: edge.relation,
        weight: edge.weight,
        node: graph.nodes.find((node) => node.id === (edge.from === selected.id ? edge.to : edge.from)),
      }))
      .filter((item) => item.node)
      .slice(0, 8);
  }, [selected, graph]);

  const maxHour = Math.max(1, ...(profile?.hours ?? [1]));

  return (
    <div className="brain">
      <header className="brain__head">
        <div className="row" style={{ gap: 10 }}>
          <span className="brain__mark">
            <Icon name="brain" size={22} />
          </span>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <span className="brain__title">{t('brain.title')}</span>
              <span className="n-badge n-badge--accent">{t('brain.local')}</span>
            </div>
            <div className="tiny faint">{t('brain.tagline')}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="brain__stats">
            <Stat label={t('brain.nodes')} value={stats?.nodes ?? 0} />
            <Stat label={t('brain.edges')} value={stats?.edges ?? 0} />
            <Stat label={t('brain.events')} value={stats?.events ?? 0} />
            <Stat label={t('brain.today')} value={stats?.today ?? 0} />
          </div>
          <div className="brain__rec">
            <span className="tiny faint">{stats?.recording ? t('brain.recording') : t('brain.paused')}</span>
            <Switch on={Boolean(stats?.recording)} onChange={(enabled) => void toggleRecording(enabled)} label="Record actions" />
          </div>
        </div>
      </header>

      <div className="brain__tabs">
        <div className="n-segmented">
          {(['graph', 'timeline', 'ask', 'profile'] as Tab[]).map((item) => (
            <button key={item} type="button" data-active={tab === item} onClick={() => setTab(item)}>
              {item === 'graph' ? <Icon name="network" size={11} /> : null}
              {item === 'timeline' ? <Icon name="clock" size={11} /> : null}
              {item === 'ask' ? <Icon name="message" size={11} /> : null}
              {item === 'profile' ? <Icon name="user" size={11} /> : null}
              {t(`brain.tab.${item}`)}
            </button>
          ))}
        </div>
        <span className="grow" />
        <span className="tiny faint mono">{formatBytes(stats?.storageBytes ?? 0)} on disk</span>
        <Button variant="ghost" size="sm" icon="trash" onClick={() => void wipe()} disabled={busy}>
          {t('brain.wipe')}
        </Button>
      </div>

      <div className="brain__body">
        <section className="brain__main">
          {tab === 'graph' ? (
            <div className="brain__canvasWrap" ref={wrapRef}>
              <canvas
                ref={canvasRef}
                className="brain__canvas"
                onMouseMove={(event) => {
                  if (dragRef.current) {
                    offsetRef.current = {
                      x: offsetRef.current.x + (event.clientX - dragRef.current.x),
                      y: offsetRef.current.y + (event.clientY - dragRef.current.y),
                    };
                    dragRef.current = { x: event.clientX, y: event.clientY };
                    return;
                  }
                  hoverRef.current = pick(event);
                  if (canvasRef.current) canvasRef.current.style.cursor = hoverRef.current ? 'pointer' : 'grab';
                }}
                onMouseDown={(event) => {
                  dragRef.current = { x: event.clientX, y: event.clientY };
                }}
                onMouseUp={() => {
                  dragRef.current = null;
                }}
                onMouseLeave={() => {
                  dragRef.current = null;
                  hoverRef.current = null;
                }}
                onClick={(event) => {
                  const node = pick(event);
                  if (node) setSelected(node);
                }}
                onDoubleClick={() => {
                  offsetRef.current = { x: 0, y: 0 };
                  setZoom(1);
                }}
                onWheel={(event) => {
                  event.preventDefault();
                  setZoom((value) => Math.min(2.4, Math.max(0.55, value - event.deltaY * 0.001)));
                }}
              />
              <div className="brain__legend">
                {Object.entries(KIND_COLOR).map(([kind, color]) => (
                  <span key={kind}>
                    <i style={{ background: color }} />
                    {kind}
                  </span>
                ))}
              </div>
              {!graph.nodes.length ? (
                <div className="brain__empty">
                  <Icon name="brain" size={30} className="faint" />
                  <div className="small strong">Your brain is empty</div>
                  <div className="tiny faint">Use the app — every click, navigation and tool call is captured here.</div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'timeline' ? (
            <div className="brain__timeline n-scroll">
              {timeline.length ? (
                timeline.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="brainEvent"
                    onClick={() => {
                      const node = graph.nodes.find((item) => item.id === event.nodeId);
                      if (node) setSelected(node);
                    }}
                  >
                    <span className="brainEvent__icon" data-kind={event.kind}>
                      <Icon name={eventIcon(event.kind)} size={13} />
                    </span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="small truncate">{event.label}</span>
                      <span className="tiny faint truncate">
                        {event.kind}
                        {event.surface ? ` · ${event.surface}` : ''}
                        {event.detail ? ` · ${event.detail}` : ''}
                      </span>
                    </span>
                    <span className="tiny faint">{relativeTime(event.at)}</span>
                  </button>
                ))
              ) : (
                <EmptyState icon="clock" title="No events yet" body="Actions are recorded as soon as you interact with the app." />
              )}
            </div>
          ) : null}

          {tab === 'ask' ? (
            <div className="brain__ask n-scroll">
              <div className="brain__askHead">
                <Icon name="brain" size={18} />
                <div>
                  <div className="small strong">{t('brain.askTitle')}</div>
                  <div className="tiny faint">{t('brain.askHint')}</div>
                </div>
              </div>
              <div className="brain__askRow">
                <input
                  className="n-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void ask()}
                  placeholder="What did I do with mail yesterday? / settings / automation…"
                  autoFocus
                />
                <Button variant="primary" icon="search" onClick={() => void ask()} disabled={asking || !query.trim()}>
                  {asking ? <Spinner size={13} /> : null} {t('brain.recall')}
                </Button>
              </div>
              {answer ? (
                <>
                  <div className="brain__answer">{answer.text}</div>
                  <div className="brain__hits">
                    {answer.hits.map((hit) => (
                      <button key={hit.node.id} type="button" className="brainHit" onClick={() => setSelected(hit.node)}>
                        <span className="brainHit__dot" style={{ background: KIND_COLOR[hit.node.kind] }} />
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span className="small truncate">{hit.node.label}</span>
                          <span className="tiny faint">{hit.why}</span>
                        </span>
                        <span className="n-badge">{Math.round(hit.score * 100)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="brain__suggest">
                  {['settings', 'mail', 'automation', 'sites', 'terminal'].map((item) => (
                    <button key={item} type="button" className="n-chip" onClick={() => { setQuery(item); }}>
                      {item}
                    </button>
                  ))}
                </div>
              )}
              <div className="brain__teach">
                <div className="tiny faint uppercase">{t('brain.teach')}</div>
                <div className="brain__askRow">
                  <input className="n-input" value={teaching} onChange={(event) => setTeaching(event.target.value)} placeholder="e.g. Prefers concise answers, no emojis" />
                  <Button variant="soft" icon="plus" onClick={() => void teach()} disabled={!teaching.trim()}>
                    {t('brain.remember')}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'profile' ? (
            <div className="brain__profile n-scroll">
              <div className="brainProfileGrid">
                <ProfileList title="Top apps" items={profile?.topApps ?? []} color="#5686fe" />
                <ProfileList title="Top actions" items={profile?.topActions ?? []} color="#22c55e" />
                <ProfileList title="Topics" items={profile?.topTopics ?? []} color="#a78bfa" />
                <ProfileList title="People" items={profile?.collaborators ?? []} color="#f472b6" />
              </div>
              <div className="brainHours">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="tiny faint uppercase">Activity by hour</span>
                  <span className="tiny faint">{profile?.totalEvents ?? 0} events</span>
                </div>
                <div className="brainHours__bars">
                  {(profile?.hours ?? Array.from({ length: 24 }, () => 0)).map((value, hour) => (
                    <div key={hour} className="brainHours__bar" title={`${hour}:00 · ${value}`}>
                      <span style={{ height: `${Math.max(4, (value / maxHour) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="brainHours__scale">
                  <span>00</span>
                  <span>06</span>
                  <span>12</span>
                  <span>18</span>
                  <span>23</span>
                </div>
              </div>
              <div className="brainProfileFooter tiny faint">
                Memory started {profile?.firstAt ? new Date(profile.firstAt).toLocaleString() : '—'} · {stats?.nodes ?? 0} nodes · {stats?.edges ?? 0} relations
              </div>
            </div>
          ) : null}
        </section>

        <aside className="brain__inspector">
          {selected ? (
            <>
              <div className="brain__inspectorHead">
                <span className="brain__kindDot" style={{ background: KIND_COLOR[selected.kind] }} />
                <span className="n-badge">{selected.kind}</span>
                <span className="grow" />
                <IconButton icon="trash" label="Forget node" size={13} onClick={() => void forget(selected)} />
                <IconButton icon="x" label="Close" size={13} onClick={() => setSelected(null)} />
              </div>
              <div className="brain__nodeTitle">{selected.label}</div>
              {selected.detail ? <div className="tiny faint">{selected.detail}</div> : null}
              <div className="brain__nodeMeta">
                <span>seen {selected.weight}×</span>
                <span>salience {Math.round(selected.salience * 100)}%</span>
                <span>last {relativeTime(selected.lastAt)}</span>
              </div>
              {selected.tags.length ? (
                <div className="row wrap" style={{ gap: 4 }}>
                  {selected.tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="n-chip tiny">{tag}</span>
                  ))}
                </div>
              ) : null}
              <div className="brain__sectionTitle">{t('brain.relations')}</div>
              <div className="brain__relations">
                {related.length ? (
                  related.map((item, index) => (
                    <button
                      key={`${item.node!.id}-${index}`}
                      type="button"
                      className="brainRelation"
                      onClick={() => setSelected(item.node ?? null)}
                    >
                      <span className="brain__kindDot" style={{ background: KIND_COLOR[item.node!.kind] }} />
                      <span className="grow truncate small">{item.node!.label}</span>
                      <span className="tiny faint">{item.relation} · {item.weight}×</span>
                    </button>
                  ))
                ) : (
                  <div className="tiny faint">No relations yet.</div>
                )}
              </div>
            </>
          ) : (
            <div className="brain__inspectorEmpty">
              <Icon name="brain" size={26} className="faint" />
              <div className="small strong">{t('brain.select')}</div>
              <div className="tiny faint">{t('brain.selectBody')}</div>
            </div>
          )}
          <div className="brain__privacy">
            <Icon name="shield" size={13} className="faint" />
            <span className="tiny faint">{t('brain.privacy')}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="brain__stat">
      <span className="brain__statValue">{value}</span>
      <span className="brain__statLabel">{label}</span>
    </div>
  );
}

function ProfileList({ title, items, color }: { title: string; items: { label: string; count: number }[]; color: string }): JSX.Element {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="brainProfileList">
      <div className="tiny faint uppercase">{title}</div>
      {items.length ? (
        items.map((item) => (
          <div key={item.label} className="brainProfileRow">
            <span className="small truncate">{item.label}</span>
            <span className="brainProfileBar">
              <span style={{ width: `${(item.count / max) * 100}%`, background: color }} />
            </span>
            <span className="tiny faint mono">{item.count}</span>
          </div>
        ))
      ) : (
        <div className="tiny faint">Nothing yet.</div>
      )}
    </div>
  );
}

function eventIcon(kind: string): string {
  if (kind === 'chat') return 'message';
  if (kind === 'mail') return 'mail';
  if (kind === 'site') return 'globe';
  if (kind === 'tool') return 'wrench';
  if (kind === 'workflow') return 'workflow';
  if (kind === 'navigate') return 'arrow-right';
  if (kind === 'query') return 'search';
  return 'mouse-pointer';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
