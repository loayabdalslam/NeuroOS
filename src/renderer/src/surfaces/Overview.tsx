import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem, Notebook, Space, WorkspaceInfo } from '@shared/types';
import { useAppStore } from '../state/store';
import { useChatStore } from '../state/chat';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { clockTime, formatBytes, fullDate, greeting, relativeTime } from '../lib/format';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { Button, Dot, IconButton, Spinner } from '../components/ui';
import { SURFACES, SURFACE_ORDER } from './meta';

const PROMPTS = [
  'Summarise my workspace and what I should build next',
  'Check system health and free disk space',
  'Draft a release note from the latest changes',
  'What did we decide last session?',
];

export function Overview(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const kernel = useAppStore((s) => s.kernel);
  const tools = useAppStore((s) => s.tools);
  const info = useAppStore((s) => s.info);
  const navigate = useAppStore((s) => s.navigate);
  const sessions = useChatStore((s) => s.sessions);
  const [now, setNow] = useState(new Date());
  const [command, setCommand] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void invoke('spaces.list', undefined).then(setSpaces).catch(() => {});
    void invoke('notebooks.list', undefined).then(setNotebooks).catch(() => {});
    void invoke('marketplace.catalog', undefined).then((items) => setCatalog(items.filter((item) => item.featured).slice(0, 3))).catch(() => {});
    if (settings?.workspaceRoot) void invoke('fs.workspace', { root: settings.workspaceRoot }).then(setWorkspace).catch(() => {});
  }, [settings?.workspaceRoot]);

  const toolGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const tool of tools) groups.set(tool.category, (groups.get(tool.category) ?? 0) + 1);
    return [...groups.entries()].sort((a, b) => b[1] - a[1]);
  }, [tools]);

  const run = async (text?: string): Promise<void> => {
    const prompt = (text ?? command).trim();
    if (!prompt) return;
    setSending(true);
    try {
      const session = await invoke('chat.create', {});
      useChatStore.setState({ activeId: session.id, active: session, sessions: [session, ...useChatStore.getState().sessions] });
      navigate('chat');
      useChatStore.getState().setDraft(prompt);
      await useChatStore.getState().send();
      setCommand('');
    } finally {
      setSending(false);
    }
  };

  const agent = settings?.agents.find((item) => item.id === settings.activeAgentId) ?? settings?.agents[0];
  const memoryPct = stats ? (stats.memoryUsed / stats.memoryTotal) * 100 : 0;
  const providerCount = settings?.providers.filter((provider) => provider.enabled).length ?? 0;

  return (
    <div className="desk">
      <div className="desk__scroll n-scroll">
        <section className="desk__hero">
          <div className="desk__heroCopy">
            <div className="desk__eyebrow mono uppercase">
              <span className="desk__pulse" />
              {kernel && kernel.services.some((service) => service.status === 'offline') ? 'degraded services' : 'all systems nominal'}
              <span className="faint">·</span>
              {fullDate(now, settings?.locale)}
            </div>
            <h1 className="desk__greeting display">
              {greeting(now)}, <span className="desk__name">{settings?.profile.name || 'explorer'}</span>
            </h1>
            <p className="desk__sub">
              {sessions.length} conversations · {tools.length} tools · {providerCount || 'no'} providers · workspace{' '}
              <span className="mono tiny">{settings?.workspaceRoot.split(/[\\/]/).pop()}</span>
            </p>

            <div className="desk__command">
              <BrandMark size={18} animated />
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void run()}
                placeholder="Ask Neuro anything — or describe what to build…"
              />
              <span className="n-kbd">←µ</span>
              <Button variant="primary" size="sm" onClick={() => void run()} disabled={!command.trim() || sending} icon={sending ? undefined : 'arrow-up'}>
                {sending ? <Spinner size={13} /> : null}
              </Button>
            </div>

            <div className="desk__prompts">
              {PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="desk__prompt" onClick={() => void run(prompt)}>
                  <Icon name="sparkles" size={11} />
                  <span className="truncate">{prompt}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="desk__clockCard">
            <div className="desk__clock mono">{clockTime(now, settings?.taskbar.clock24h ?? false)}</div>
            <div className="desk__clockDate">{now.toLocaleDateString(settings?.locale, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="desk__clockMeta">
              <span className="row" style={{ gap: 5 }}>
                <Dot state="online" /> <span className="tiny">kernel</span>
              </span>
              <span className="mono tiny">{Math.floor((stats?.uptime ?? 0) / 3600)}h up</span>
              <span className="mono tiny">{stats?.processes ?? 0} proc</span>
            </div>
          </div>
        </section>

        <section className="desk__grid">
          <div className="wcard wcard--span4 wcard--monitor">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="gauge" size={13} /> System</span>
              <span className="n-badge n-badge--success">live</span>
            </div>
            <div className="desk__rings">
              <Ring value={stats?.cpu ?? 0} label="CPU" color="var(--n-accent)" detail={`${stats?.cpu ?? 0}%`} />
              <Ring value={memoryPct} label="RAM" color="var(--n-teal)" detail={`${(stats?.memoryUsed ?? 0) / 1024 ** 3 < 0.1 ? '0' : ((stats?.memoryUsed ?? 0) / 1024 ** 3).toFixed(1)}G`} />
              <Ring value={Math.min(100, ((stats?.uptime ?? 0) / 86400) * 100)} label="Up" color="var(--n-violet)" detail={`${Math.floor((stats?.uptime ?? 0) / 3600)}h`} />
            </div>
            <div className="desk__kv">
              <Kv label="Cores" value={String(info?.cpus ?? '—')} />
              <Kv label="Memory" value={formatBytes(info?.memoryTotal ?? 0).replace(' ', '')} />
              <Kv label="GPU" value={info?.gpu.split(' ').slice(0, 2).join(' ') ?? '—'} />
            </div>
          </div>

          <div className="wcard wcard--span4">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="message" size={13} /> {t('chat.sessions')}</span>
              <IconButton icon="plus" label={t('chat.newChat')} size={13} onClick={() => void useChatStore.getState().create().then(() => navigate('chat'))} />
            </div>
            <div className="desk__list">
              {sessions.slice(0, 4).map((session) => (
                <button key={session.id} type="button" className="desk__listRow" onClick={() => { void useChatStore.getState().open(session.id); navigate('chat'); }}>
                  <span className="desk__listIcon"><Icon name="message" size={12} /></span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="truncate small">{session.title}</div>
                    <div className="tiny faint truncate">{session.model}</div>
                  </div>
                  <span className="tiny faint">{relativeTime(session.updatedAt)}</span>
                </button>
              ))}
              {!sessions.length ? <div className="tiny faint" style={{ padding: 6 }}>No conversations yet — ask something above.</div> : null}
            </div>
          </div>

          <div className="wcard wcard--span4">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="files" size={13} /> Workspace</span>
              <IconButton icon="arrow-up-right" label="Open" size={13} onClick={() => navigate('workspace')} />
            </div>
            {workspace ? (
              <>
                <div className="desk__workspaceName small strong truncate">{workspace.name}</div>
                <div className="desk__kv" style={{ marginTop: 8 }}>
                  <Kv label="Files" value={String(workspace.fileCount)} />
                  <Kv label="Size" value={formatBytes(workspace.totalBytes)} />
                  <Kv label="Git" value={workspace.git ? workspace.git.branch : '—'} />
                </div>
                <div className="desk__langs">
                  {workspace.languages.slice(0, 6).map((language) => (
                    <span key={language.id} className="desk__lang">
                      <span className="desk__langBar" data-lang={language.id} />
                      <span className="tiny faint">{language.id}</span>
                    </span>
                  ))}
                  {!workspace.languages.length ? <span className="tiny faint">No code files yet.</span> : null}
                </div>
              </>
            ) : (
              <div className="center" style={{ padding: 20 }}><Spinner /></div>
            )}
          </div>

          <div className="wcard wcard--span6">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="fork" size={13} /> Spaces & notebooks</span>
              <Button variant="ghost" size="sm" icon="plus" onClick={() => navigate('space')}>{t('space.create')}</Button>
            </div>
            <div className="desk__duo">
              <div className="desk__duoCol">
                {spaces.slice(0, 4).map((space) => (
                  <button key={space.id} type="button" className="desk__chipRow" onClick={() => navigate('space')}>
                    <span style={{ color: space.color }}>{space.emoji}</span>
                    <span className="truncate small">{space.name}</span>
                    <span className="grow" />
                    <span className="tiny faint">{space.tags[0] ?? ''}</span>
                  </button>
                ))}
                {!spaces.length ? <span className="tiny faint">No spaces yet.</span> : null}
              </div>
              <div className="desk__duoCol">
                {notebooks.slice(0, 4).map((notebook) => (
                  <button key={notebook.id} type="button" className="desk__chipRow" onClick={() => navigate('notebook')}>
                    <Icon name="notebook-pen" size={12} style={{ color: 'var(--n-warn)' }} />
                    <span className="truncate small">{notebook.title}</span>
                    <span className="grow" />
                    <span className="tiny faint">{notebook.cells.length}</span>
                  </button>
                ))}
                {!notebooks.length ? <span className="tiny faint">No notebooks yet.</span> : null}
              </div>
            </div>
          </div>

          <div className="wcard wcard--span6">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="wrench" size={13} /> Tool bus</span>
              <span className="tiny faint mono">{tools.length} registered</span>
            </div>
            <div className="desk__tools">
              {toolGroups.map(([category, count]) => (
                <div key={category} className="desk__toolRow">
                  <span className="tiny">{category}</span>
                  <span className="desk__toolBar">
                    <span style={{ width: `${Math.min(100, (count / Math.max(...toolGroups.map(([, c]) => c))) * 100)}%` }} />
                  </span>
                  <span className="tiny faint mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="wcard wcard--span6">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="brain" size={13} /> Agents</span>
              <Button variant="ghost" size="sm" icon="settings" onClick={() => { useAppStore.getState().setSettingsSection('agents'); navigate('settings'); }}>
                {t('settings.agents')}
              </Button>
            </div>
            <div className="desk__agents">
              {(settings?.agents ?? []).slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="desk__agent"
                  data-active={item.id === settings?.activeAgentId}
                  onClick={() => void useAppStore.getState().patchSettings({ activeAgentId: item.id })}
                >
                  <span className="desk__agentDot" style={{ background: item.color }} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small truncate">{item.name}</div>
                    <div className="tiny faint truncate">{item.tools === 'all' ? 'all tools' : `${item.tools.length} tools`}</div>
                  </div>
                  {item.id === settings?.activeAgentId ? <Icon name="check" size={12} style={{ color: 'var(--n-accent)' }} /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="wcard wcard--span6">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="package" size={13} /> From the marketplace</span>
              <Button variant="ghost" size="sm" icon="arrow-up-right" onClick={() => navigate('marketplace')}>Browse</Button>
            </div>
            <div className="desk__catalog">
              {catalog.map((item) => (
                <button key={item.id} type="button" className="desk__catalogCard" onClick={() => navigate('marketplace')}>
                  <span className="desk__catalogIcon" style={{ color: item.accent, background: `${item.accent}1f` }}>
                    <Icon name={item.icon} size={15} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 5 }}>
                      <span className="small strong truncate">{item.name}</span>
                      {item.verified ? <Icon name="shield" size={11} style={{ color: 'var(--n-success)' }} /> : null}
                    </div>
                    <div className="tiny faint truncate">{item.tagline}</div>
                  </div>
                  <Icon name="arrow-up-right" size={13} className="faint" />
                </button>
              ))}
            </div>
          </div>

          <div className="wcard wcard--span12 wcard--launch">
            <div className="wcard__head">
              <span className="wcard__title"><Icon name="grid" size={13} /> Launch</span>
              <span className="tiny faint mono">⌘K for everything</span>
            </div>
            <div className="desk__launch">
              {SURFACE_ORDER.map((surface) => (
                <button key={surface} type="button" className="desk__launchItem" onClick={() => navigate(surface)}>
                  <span className="desk__launchIcon" style={{ color: SURFACES[surface].accent }}>
                    <Icon name={SURFACES[surface].icon} size={17} />
                  </span>
                  <span className="tiny">{t(SURFACES[surface].labelKey)}</span>
                </button>
              ))}
              <button type="button" className="desk__launchItem" onClick={() => void invoke('system.screenshot', undefined).then((shot) => useAppStore.getState().pushToast({ title: 'Screenshot captured', message: shot.path, kind: 'success' }))}>
                <span className="desk__launchIcon" style={{ color: 'var(--n-danger)' }}>
                  <Icon name="scan" size={17} />
                </span>
                <span className="tiny">Capture</span>
              </button>
            </div>
          </div>
        </section>

        <section className="desk__kernelStrip">
          <span className="tiny faint uppercase">status</span>
          {(kernel?.services ?? []).map((service) => (
            <span key={service.name} className="desk__service">
              <Dot state={service.status === 'online' ? 'online' : service.status === 'degraded' ? 'warn' : 'offline'} />
              <span className="tiny">{service.name}</span>
            </span>
          ))}
          <span className="grow" />
          <span className="tiny faint mono">
            {info?.name} {info?.version} · electron {info?.electron} · {info?.ptyAvailable ? 'pty' : 'pipe'}
          </span>
        </section>
      </div>
    </div>
  );
}

function Ring({ value, label, color, detail }: { value: number; label: string; color: string; detail: string }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="desk__ring">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={radius} fill="none" stroke="var(--n-layer-3)" strokeWidth="5" />
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          transform="rotate(-90 34 34)"
        />
      </svg>
      <div className="desk__ringCenter">
        <span className="mono small">{detail}</span>
        <span className="tiny faint uppercase">{label}</span>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="desk__kvItem">
      <span className="tiny faint uppercase">{label}</span>
      <span className="mono tiny truncate">{value}</span>
    </div>
  );
}

