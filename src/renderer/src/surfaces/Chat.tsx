import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ToolInvocation } from '@shared/types';
import { useChatStore } from '../state/chat';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { formatDuration } from '../lib/util';
import { Icon } from '../components/Icon';
import { Markdown } from '../components/Markdown';
import { BrandMark } from '../components/BrandMark';
import { Button, EmptyState, IconButton, Menu, Modal, Spinner, type MenuItem } from '../components/ui';

const SUGGESTIONS = [
  { icon: 'files', title: 'Map this workspace', prompt: 'Summarise the workspace: what it is, the main entry points, and the riskiest part of the code. Read real files before answering.' },
  { icon: 'terminal', title: 'Check the machine', prompt: 'Report the OS, CPU, memory, GPU and installed runtimes. Then run a real shell command that proves the shell works.' },
  { icon: 'globe', title: 'Research something', prompt: 'Find the current state of the Agent Client Protocol. Read at least two primary sources and summarise with citations.' },
  { icon: 'notebook-pen', title: 'Prototype an idea', prompt: 'Write a JavaScript benchmark in the live notebook kernel that compares two approaches to debouncing, and explain the result.' },
];

export function Chat(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const tools = useAppStore((s) => s.tools);
  const navigate = useAppStore((s) => s.navigate);
  const sessions = useChatStore((s) => s.sessions);
  const active = useChatStore((s) => s.active);
  const activeId = useChatStore((s) => s.activeId);
  const streaming = useChatStore((s) => s.streaming);
  const status = useChatStore((s) => s.status);
  const loading = useChatStore((s) => s.loading);
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const send = useChatStore((s) => s.send);
  const cancel = useChatStore((s) => s.cancel);
  const create = useChatStore((s) => s.create);
  const open = useChatStore((s) => s.open);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const [search, setSearch] = useState('');
  const [showSessions, setShowSessions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [modelMenu, setModelMenu] = useState(false);
  const [providerModal, setProviderModal] = useState(false);
  const [modelModal, setModelModal] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [agentMenu, setAgentMenu] = useState(false);
  const [messageMenu, setMessageMenu] = useState<string | null>(null);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!activeId) return;
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distance < 420 || streaming) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [active?.messages, streaming, activeId]);

  useEffect(() => {
    const area = composerRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(220, area.scrollHeight)}px`;
  }, [draft]);

  const providers = settings?.providers ?? [];
  const provider = providers.find((item) => item.id === active?.providerId) ?? providers.find((item) => item.enabled);
  const agent = settings?.agents.find((item) => item.id === active?.agentId) ?? settings?.agents[0];
  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((session) => session.title.toLowerCase().includes(q));
  }, [sessions, search]);

  const enabledTools = agent?.tools === 'all' || !agent ? tools : tools.filter((tool) => agent.tools.includes(tool.name));
  const attachments = useChatStore((s) => s.attachments) ?? [];
  const setAttachments = useChatStore((s) => s.setAttachments);
  const pushToast = useAppStore((s) => s.pushToast);
  const toolModels = (provider?.models ?? []).filter((model) => model.supportsTools !== false);
  const modelChoices = toolModels.length ? toolModels : (provider?.models ?? []);

  const modelItems: MenuItem[] = [];
  for (const item of providers.filter((p) => p.enabled)) {
    if (!item.models.length) continue;
    for (const model of item.models) {
      modelItems.push({
        label: `${item.name} Â· ${model.label}`,
        icon: 'cpu',
        hint: model.contextWindow ? `${Math.round(model.contextWindow / 1000)}k` : undefined,
        onClick: () => {
          if (!activeId) return;
          void useChatStore.getState().setActiveMeta({ providerId: item.id, model: model.id });
        },
      });
    }
  }
  if (!modelItems.length) {
    modelItems.push({ label: 'Connect a providerâ€¦', icon: 'plug', onClick: () => navigate('settings') });
  }

  const providerItems: MenuItem[] = providers
    .filter((item) => item.enabled)
    .map((item) => ({
      label: item.name,
      icon: 'cpu',
      hint: `${item.models.length} models`,
      onClick: () => {
        if (!activeId) return;
        const keep = item.models.some((model) => model.id === active?.model) ? active?.model : item.models[0]?.id;
        void useChatStore.getState().setActiveMeta({ providerId: item.id, model: keep ?? '' });
      },
    }));
  if (!providerItems.length) {
    providerItems.push({ label: 'Connect a providerâ€¦', icon: 'plug', onClick: () => navigate('settings') });
  }
  const modelLabel = provider?.models.find((model) => model.id === active?.model)?.label ?? active?.model?.split('/').pop() ?? t('chat.model');

  const agentItems: MenuItem[] = (settings?.agents ?? []).map((item) => ({
    label: item.name,
    icon: item.icon,
    hint: item.builtin ? 'built-in' : undefined,
    onClick: () => {
      if (!activeId) return;
      void useChatStore.getState().setActiveMeta({ agentId: item.id });
    },
  }));

  const refreshModels = async (): Promise<void> => {
    const current = useAppStore.getState().settings;
    if (!provider || !current) return;
    try {
      const discovered = await invoke('providers.discoverModels', {
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey ?? '',
      });
      if (!discovered.length) throw new Error('The provider returned no models.');
      const next = await invoke('providers.save', {
        ...provider,
        models: discovered,
        defaultModel: discovered[0].id,
      });
      useAppStore.getState().setSettings({ ...current, providers: next });
      pushToast({ title: 'Models refreshed', message: discovered.length + ' models from ' + provider.name, kind: 'success' });
    } catch (error) {
      pushToast({ title: 'Could not refresh models', message: (error as Error).message, kind: 'error' });
    }
  };

  const attachImages = async (): Promise<void> => {
    setAttaching(true);
    try {
      const picked = await invoke('system.pickFiles', { multiple: true });
      const next = [...attachments];
      for (const path of picked.paths) {
        try {
          const data = await invoke('system.readDataUrl', { path });
          next.push({
            id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            kind: 'image',
            label: data.name,
            path,
            mime: data.mime,
            size: data.size,
            dataUrl: data.dataUrl,
          });
        } catch (error) {
          pushToast({ title: 'Could not attach image', message: (error as Error).message, kind: 'error' });
        }
      }
      setAttachments(next.slice(0, 4));
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="chat">
      {showSessions ? (
        <aside className="chat__sessions">
          <div className="chat__sessionsHead">
            <span className="small strong">{t('chat.sessions')}</span>
            <IconButton icon="plus" label={t('chat.newChat')} onClick={() => void create()} />
          </div>
          <div className="chat__search">
            <Icon name="search" size={13} className="faint" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('chat.searchSessions')} />
          </div>
          <div className="chat__sessionList n-scroll">
            {filteredSessions.length === 0 ? (
              <div className="tiny faint" style={{ padding: '14px 10px' }}>No conversations yet.</div>
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="chat__session"
                  data-active={session.id === activeId}
                  onClick={() => void open(session.id)}
                >
                  <Icon name="message" size={13} className="faint" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="truncate small">{session.title}</div>
                    <div className="tiny faint truncate">
                      {session.model} Â· {relativeTime(session.updatedAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <button type="button" className="chat__sessionsFoot" onClick={() => setShowSessions(false)}>
            <Icon name="panel-left" size={13} />
            Hide panel
          </button>
        </aside>
      ) : null}

      <section className="chat__main">
        <header className="chat__head">
          {!showSessions ? <IconButton icon="panel-left" label="Show sessions" onClick={() => setShowSessions(true)} /> : null}
          <div className="chat__headMeta">
            <div className="chat__title truncate">{active?.title ?? t('chat.newChat')}</div>
            <div className="chat__sub">
              <span className="n-dot n-dot--online" />
              <span>{agent?.name ?? 'Neuro'}</span>
              <span className="faint">Â·</span>
              <span className="mono tiny">{active?.model || 'no model'}</span>
              {provider ? <span className="n-badge" style={{ marginLeft: 4 }}>{provider.name}</span> : null}
            </div>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <div style={{ position: 'relative' }}>
              <Button variant="ghost" size="sm" icon="brain" onClick={() => setAgentMenu(true)}>
                {agent?.name ?? 'Agent'}
              </Button>
              {agentMenu ? <Menu items={agentItems} onClose={() => setAgentMenu(false)} align="right" width={220} /> : null}
            </div>
            <IconButton icon="plus" label={t('chat.newChat')} onClick={() => void create()} />
          </div>
        </header>

        {!provider ? (
          <div className="chat__banner">
            <Icon name="plug" size={15} />
            <div className="grow">
              <span className="small strong">No provider connected.</span>{' '}
              <span className="small muted">Add an API key, a local model, or an ACP agent to start.</span>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('settings')}>
              {t('settings.providers')}
            </Button>
          </div>
        ) : null}

        <div className="chat__scroll n-scroll" ref={scrollRef}>
          {loading && !active ? (
            <div className="center" style={{ padding: 60 }}>
              <Spinner size={20} />
            </div>
          ) : !active || active.messages.length === 0 ? (
            <div className="chat__hero">
              <div className="chat__heroOrb">
                <BrandMark size={42} animated />
              </div>
              <h2 className="chat__heroTitle display">{t('chat.emptyTitle')}</h2>
              <p className="chat__heroSub">{t('chat.emptyBody')}</p>
              <div className="chat__suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    className="chat__suggestion"
                    onClick={() => {
                      setDraft(suggestion.prompt);
                      composerRef.current?.focus();
                    }}
                  >
                    <span className="chat__suggestionIcon">
                      <Icon name={suggestion.icon} size={15} />
                    </span>
                    <span className="grow" style={{ textAlign: 'left' }}>
                      <span className="small strong" style={{ display: 'block' }}>{suggestion.title}</span>
                      <span className="tiny faint chat__suggestionBody">{suggestion.prompt}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="chat__heroFoot">
                <span className="n-chip" data-active>
                  <Icon name="wrench" size={12} /> {enabledTools.length} tools
                </span>
                <span className="n-chip">
                  <Icon name="shield" size={12} /> policy-gated
                </span>
                <span className="n-chip">
                  <Icon name="pin" size={12} /> pinnable
                </span>
              </div>
            </div>
          ) : (
            <div className="chat__thread">
              {active.messages
                .filter((message) => message.role !== 'tool')
                .map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    agentName={agent?.name ?? 'Neuro'}
                    streaming={streaming}
                    menuOpen={messageMenu === message.id}
                    onMenu={() => setMessageMenu(messageMenu === message.id ? null : message.id)}
                  />
                ))}
              {streaming ? (
                <div className="chat__thinking">
                  <span className="chat__thinkingDots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="small">{status || t('chat.thinking')}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="chat__composerWrap">
          <div className="composer" data-streaming={streaming}>
            {attachments.length ? (
              <div className="composer__attachmentsAbove">
                {attachments.map((attachment) => (
                  <span key={attachment.id} className="composer__attachmentChip">
                    {attachment.dataUrl ? <img src={attachment.dataUrl} alt={attachment.label} /> : <Icon name="file" size={12} />}
                    <span className="truncate">{attachment.label}</span>
                    <button type="button" onClick={() => setAttachments(attachments.filter((item) => item.id !== attachment.id))} aria-label="Remove attachment">
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <textarea
              ref={composerRef}
              className="composer__input"
              value={draft}
              placeholder={t('chat.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              spellCheck
            />
            <div className="composer__bottom">
              <IconButton icon={attaching ? 'loader' : 'paperclip'} label={t('chat.attach')} onClick={() => void attachImages()} />
              {attachments.length ? (
                <div className="composer__attachments">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="composer__attachment">
                      {attachment.dataUrl ? <img src={attachment.dataUrl} alt={attachment.label} /> : <Icon name="file" size={14} />}
                      <button type="button" aria-label="Remove attachment" onClick={() => setAttachments(attachments.filter((item) => item.id !== attachment.id))}>
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="composer__selectors">
                <div className="composer__selectWrap">
                  <button type="button" className="composer__select" onClick={() => setProviderModal(true)}>
                    <span className="composer__selectDot" style={{ background: provider?.color ?? 'var(--n-text-4)' }} />
                    <span className="truncate">{provider?.name ?? 'Provider'}</span>
                    <Icon name="chevron-down" size={10} />
                  </button>
                </div>
                <div className="composer__selectWrap">
                  <button type="button" className="composer__select" onClick={() => setModelModal(true)}>
                    <Icon name="cpu" size={12} />
                    <span className="truncate">{modelLabel}</span>
                    <Icon name="chevron-down" size={10} />
                  </button>
                </div>
              </div>
              <span className="grow" />
              {streaming ? (
                <button type="button" className="composer__send composer__send--stop" onClick={() => void cancel()} aria-label={t('common.stop')}>
                  <Icon name="square" size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  className="composer__send"
                  onClick={() => void send()}
                  disabled={(!draft.trim() && !attachments.length) || !active}
                  aria-label={t('common.send')}
                >
                  <Icon name="arrow-up" size={16} />
                </button>
              )}            </div>
          </div>
          <div className="chat__disclaimer tiny faint">
            Neuro OS can read files, run commands and control apps. Every high-risk tool call is mediated by policy.
          </div>
        </div>
      </section>

      <Modal
        open={providerModal}
        onClose={() => setProviderModal(false)}
        title="Providers"
        description="Choose the provider for this conversation. Keys stay in the OS keychain."
        width={520}
        footer={
          <>
            <Button onClick={() => setProviderModal(false)}>Close</Button>
            <Button
              variant="primary"
              icon="settings"
              onClick={() => {
                setProviderModal(false);
                navigate('settings');
              }}
            >
              Manage providers
            </Button>
          </>
        }
      >
        <div className="providerChooser">
          {providers.length ? (
            providers.map((item) => (
              <button
                key={item.id}
                type="button"
                className="providerChoice"
                data-active={item.id === provider?.id}
                onClick={() => {
                  const model = item.models.find((entry) => entry.id === active?.model)?.id ?? item.models.find((entry) => entry.supportsTools !== false)?.id ?? item.models[0]?.id ?? '';
                  void useChatStore.getState().setActiveMeta({ providerId: item.id, model });
                  setProviderModal(false);
                }}
              >
                <span className="composer__selectDot" style={{ background: item.color ?? 'var(--n-accent)' }} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="small strong">{item.name}</span>
                  <span className="tiny faint" style={{ display: 'block' }}>
                    {item.kind} · {item.models.length} models · {item.enabled ? 'enabled' : 'disabled'}
                  </span>
                </span>
                {item.id === provider?.id ? <Icon name="check" size={13} /> : null}
              </button>
            ))
          ) : (
            <span className="tiny faint">No providers yet. Open Settings → Providers to add one.</span>
          )}
        </div>
      </Modal>

      <Modal
        open={modelModal}
        onClose={() => setModelModal(false)}
        title={toolModels.length ? 'Models with tool calling' : 'Models'}
        description={provider ? (toolModels.length ? 'Only models that can call the 46 Neuro tools are listed.' : 'No tool-capable models are declared for this provider — showing all of its models.') : 'Choose a provider first.'}
        width={520}
        footer={
          <>
            <Button onClick={() => setModelModal(false)}>Close</Button>
            <Button icon="rotate-ccw" onClick={() => void refreshModels()} disabled={!provider}>
              Refresh models
            </Button>
            <Button
              variant="primary"
              icon="settings"
              onClick={() => {
                setModelModal(false);
                navigate('settings');
              }}
            >
              Manage providers
            </Button>
          </>
        }
      >
        <div className="providerChooser">
          {modelChoices.length ? (
            modelChoices.map((model) => (
              <button
                key={model.id}
                type="button"
                className="providerChoice"
                data-active={model.id === active?.model}
                onClick={() => {
                  void useChatStore.getState().setActiveMeta({ model: model.id });
                  setModelModal(false);
                }}
              >
                <Icon name="cpu" size={15} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="small strong">{model.label}</span>
                  <span className="tiny faint" style={{ display: 'block' }}>
                    {model.id}{model.contextWindow ? ' · ' + Math.round(model.contextWindow / 1000) + 'k context' : ''}
                    {model.supportsVision ? ' · vision' : ''}
                  </span>
                </span>
                {model.id === active?.model ? <Icon name="check" size={13} /> : null}
              </button>
            ))
          ) : (
            <span className="tiny faint">This provider has no models yet. Use Refresh models, or add one in Settings → Providers.</span>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MessageRow({
  message,
  agentName,
  streaming,
  menuOpen,
  onMenu,
}: {
  message: ChatMessage;
  agentName: string;
  streaming: boolean;
  menuOpen: boolean;
  onMenu: () => void;
}): JSX.Element {
  const approve = useChatStore((s) => s.approve);
  const regenerate = useChatStore((s) => s.regenerate);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return (
      <div className="msg msg--tool">
        <div className="msg__toolResult mono">
          <Icon name="arrow-down-right" size={12} />
          <span className="truncate">{message.content.slice(0, 180) || '(empty)'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--assistant'}`}>
      {!isUser ? (
        <div className="msg__avatar">
          <BrandMark size={17} animated={streaming && !message.content} />
        </div>
      ) : null}
      <div className="msg__body">
        <div className="msg__meta">
          <span className="msg__author">{isUser ? 'You' : agentName}</span>
          <span className="tiny faint">{new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          {message.model ? <span className="tiny faint mono truncate">{message.model}</span> : null}
          <span className="grow" />
          {!isUser && message.content ? (
            <div className="msg__actions">
              <button
                type="button"
                className="msg__action"
                onClick={() => {
                  void navigator.clipboard.writeText(message.content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={12} />
              </button>
              <button type="button" className="msg__action" onClick={() => void regenerate()}>
                <Icon name="rotate-ccw" size={12} />
              </button>
              <button type="button" className="msg__action" onClick={onMenu}>
                <Icon name="more" size={12} />
              </button>
              {menuOpen ? (
                <div className="msg__menu">
                  <button
                    type="button"
                    onClick={() => {
                      const sessionId = useChatStore.getState().activeId;
                      if (sessionId) {
                        void invoke('chat.export', { sessionId, format: 'md' });
                      }
                      onMenu();
                    }}
                  >
                    <Icon name="download" size={12} /> Export conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const active = useChatStore.getState().active;
                      if (active) {
                        void useAppStore.getState().patchSettings({
                          anchor: {
                            ...useAppStore.getState().settings!.anchor,
                            pins: [
                              ...useAppStore.getState().settings!.anchor.pins,
                              { id: `pin_${Date.now()}`, kind: 'chat', ref: active.id, label: active.title, subtitle: active.model, order: 99 },
                            ],
                          },
                        });
                      }
                      onMenu();
                    }}
                  >
                    <Icon name="pin" size={12} /> Pin to Anchor
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {message.reasoning ? <Reasoning text={message.reasoning} live={streaming} /> : null}

        {isUser && message.attachments?.length ? (
          <div className="msg__attachments">
            {message.attachments.map((attachment) =>
              attachment.dataUrl ? (
                <img key={attachment.id} src={attachment.dataUrl} alt={attachment.label} />
              ) : (
                <span key={attachment.id} className="n-chip">
                  <Icon name="file" size={11} /> {attachment.label}
                </span>
              ),
            )}
          </div>
        ) : null}

        <div className={`msg__bubble ${isUser ? 'is-user' : ''}`}>
          {message.content ? (
            isUser ? (
              <div className="msg__text">{message.content}</div>
            ) : (
              <Markdown source={message.content} />
            )
          ) : message.toolCalls?.length ? null : (
            <span className="msg__cursor" />
          )}
        </div>

        {message.toolCalls?.length ? (
          <div className="msg__tools">
            {message.toolCalls.map((call) => (
              <ToolCallCard key={call.id} call={call} onApprove={approve} />
            ))}
          </div>
        ) : null}

        {message.error ? (
          <div className="msg__error">
            <Icon name="alert" size={13} />
            {message.error}
          </div>
        ) : null}

        {message.usage ? (
          <div className="msg__usage mono tiny">
            {message.usage.input ?? 0} in Â· {message.usage.output ?? 0} out
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Reasoning({ text, live }: { text: string; live: boolean }): JSX.Element {
  const [open, setOpen] = useState(live);
  return (
    <div className="reasoning" data-open={open}>
      <button type="button" className="reasoning__head" onClick={() => setOpen(!open)}>
        <Icon name="brain" size={12} />
        <span>{live ? 'Thinkingâ€¦' : 'Reasoning'}</span>
        <span className="tiny faint mono">{text.length} chars</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} style={{ marginLeft: 'auto' }} />
      </button>
      {open ? <div className="reasoning__body n-scroll">{text}</div> : null}
    </div>
  );
}

function ToolCallCard({ call, onApprove }: { call: ToolInvocation; onApprove: (id: string, ok: boolean, always?: boolean) => Promise<void> }): JSX.Element {
  const [open, setOpen] = useState(false);
  const isPending = call.status === 'pending';
  const statusLabel = {
    pending: 'needs approval',
    running: 'running',
    ok: 'done',
    error: 'failed',
    denied: 'denied',
  }[call.status];

  return (
    <div className="toolcall" data-status={call.status}>
      <button type="button" className="toolcall__head" onClick={() => setOpen(!open)}>
        <span className="toolcall__icon">
          {call.status === 'running' ? <Spinner size={13} /> : <Icon name={call.status === 'ok' ? 'check' : call.status === 'error' ? 'alert' : call.status === 'denied' ? 'eye-off' : 'wrench'} size={13} />}
        </span>
        <span className="toolcall__name mono">{call.name}</span>
        <span className="n-badge" data-tone={call.status}>{statusLabel}</span>
        {call.durationMs ? <span className="tiny faint mono">{formatDuration(call.durationMs)}</span> : null}
        <span className="grow" />
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} className="faint" />
      </button>

      {isPending ? (
        <div className="toolcall__approve">
          <div className="tiny faint" style={{ flex: 1 }}>
            This tool can change your system. Approve to continue.
          </div>
          <Button variant="ghost" size="sm" onClick={() => void onApprove(call.id, false)}>Deny</Button>
          <Button variant="outline" size="sm" onClick={() => void onApprove(call.id, true, true)}>Always</Button>
          <Button variant="primary" size="sm" onClick={() => void onApprove(call.id, true)}>Approve</Button>
        </div>
      ) : null}

      {open ? (
        <div className="toolcall__body">
          <div className="toolcall__section">
            <span className="tiny faint uppercase">arguments</span>
            <pre className="mono toolcall__code">{JSON.stringify(call.args, null, 2)}</pre>
          </div>
          {call.output ? (
            <div className="toolcall__section">
              <span className="tiny faint uppercase">output</span>
              <pre className="mono toolcall__code">{call.output}</pre>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="toolcall__summary mono tiny truncate">{call.output?.split('\n')[0] ?? JSON.stringify(call.args).slice(0, 120)}</div>
      )}
    </div>
  );
}



