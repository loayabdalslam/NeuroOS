import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComposioAccountInfo, ComposioStatus, ComposioTool, ComposioToolkitInfo } from '@shared/types';
import { useAppStore } from '../state/store';
import { invoke } from '../lib/ipc';
import { useT } from '../lib/i18n';
import { BrandIcon } from '../components/BrandIcon';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Field, Spinner, Switch } from '../components/ui';

type Tab = 'toolkits' | 'tools';

export function ComposioPanel(): JSX.Element {
  const t = useT();
  const pushToast = useAppStore((s) => s.pushToast);
  const [status, setStatus] = useState<ComposioStatus | null>(null);
  const [accounts, setAccounts] = useState<ComposioAccountInfo[]>([]);
  const [toolkits, setToolkits] = useState<ComposioToolkitInfo[]>([]);
  const [tools, setTools] = useState<ComposioTool[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('toolkits');
  const [keyDraft, setKeyDraft] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [nextStatus, nextAccounts, nextToolkits, nextTools] = await Promise.all([
      invoke('composio.status', undefined),
      invoke('composio.accounts', undefined).catch(() => [] as ComposioAccountInfo[]),
      invoke('composio.toolkits', undefined).catch(() => [] as ComposioToolkitInfo[]),
      invoke('composio.tools', undefined).catch(() => [] as ComposioTool[]),
    ]);
    setStatus(nextStatus);
    setAccounts(nextAccounts);
    setToolkits(nextToolkits);
    setTools(nextTools);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveKey = async (): Promise<void> => {
    if (!keyDraft.trim()) return;
    setBusy('key');
    try {
      const next = await invoke('composio.configure', { apiKey: keyDraft.trim() });
      setStatus(next);
      setKeyDraft('');
      setEditingKey(false);
      pushToast({ title: 'Composio connected', message: 'Syncing the integration catalog…', kind: 'success' });
      await syncCatalog();
    } finally {
      setBusy(null);
    }
  };

  const syncCatalog = async (): Promise<void> => {
    setBusy('sync');
    try {
      const next = await invoke('composio.sync', undefined);
      setStatus(next);
      await loadAll();
      if (next.error) pushToast({ title: 'Composio sync failed', message: next.error, kind: 'error' });
      else pushToast({ title: 'Catalog synced', message: `${next.tools} actions · ${next.toolkits} toolkits`, kind: 'success' });
    } finally {
      setBusy(null);
    }
  };

  const refreshAccounts = async (): Promise<void> => {
    setBusy('accounts');
    try {
      setAccounts(await invoke('composio.accounts', undefined));
    } finally {
      setBusy(null);
    }
  };

  const connect = async (toolkit: string): Promise<void> => {
    setBusy(`connect:${toolkit}`);
    try {
      const result = await invoke('composio.connect', { toolkit });
      pushToast({
        title: `Continue in your browser`,
        message: `Authorize ${toolkit}, then press Refresh. ${result.redirectUrl.slice(0, 48)}…`,
        kind: 'info',
      });
      setTimeout(() => void refreshAccounts(), 6000);
    } catch (error) {
      pushToast({ title: 'Connection failed', message: (error as Error).message, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (slug: string, enabled: boolean): Promise<void> => {
    setBusy(slug);
    try {
      const next = await invoke('composio.toggle', { slug, enabled });
      setStatus(next);
      setTools((current) => current.map((tool) => (tool.slug === slug ? { ...tool, enabled } : tool)));
      pushToast({
        title: enabled ? 'Tool enabled' : 'Tool disabled',
        message: enabled ? `composio.${slug.toLowerCase()} is now callable by the agent.` : slug,
        kind: 'success',
      });
    } finally {
      setBusy(null);
    }
  };

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (tool) =>
        tool.slug.toLowerCase().includes(q) ||
        tool.name.toLowerCase().includes(q) ||
        tool.toolkit.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q),
    );
  }, [tools, query]);

  const filteredToolkits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return toolkits;
    return toolkits.filter((toolkit) => toolkit.slug.includes(q) || toolkit.name.toLowerCase().includes(q));
  }, [toolkits, query]);

  const connectedToolkits = useMemo(() => new Set(accounts.map((account) => account.toolkit)), [accounts]);

  if (!status) return <div className="composio"><Spinner size={18} /></div>;

  return (
    <div className="composio">
      <div className="composio__hero">
        <span className="composio__logo">
          <BrandIcon brand="composio" size={30} />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="composio__title">Composio</span>
            <span className={`n-badge ${status.configured ? 'n-badge--success' : ''}`}>{status.configured ? t('composio.connected') : t('composio.notConfigured')}</span>
          </div>
          <div className="tiny faint" style={{ lineHeight: 1.65, maxWidth: 720 }}>
            {t('composio.tagline')}
          </div>
        </div>
        {status.configured ? (
          <div className="row" style={{ gap: 6 }}>
            <Button variant="outline" size="sm" icon="refresh" onClick={() => void syncCatalog()} disabled={busy !== null}>
              {busy === 'sync' ? <Spinner size={12} /> : null} {t('composio.sync')}
            </Button>
            <Button variant="ghost" size="sm" icon="key-round" onClick={() => setEditingKey((value) => !value)}>
              {t('composio.apiKey')}
            </Button>
          </div>
        ) : null}
      </div>

      {!status.configured || editingKey ? (
        <div className="composio__setup">
          <div className="composio__steps">
            <div><span className="composio__step">1</span> Create a free account at <span className="mono">composio.dev</span></div>
            <div><span className="composio__step">2</span> Copy an API key from <span className="mono">Settings → API keys</span></div>
            <div><span className="composio__step">3</span> Paste it here — the key is stored in the OS keychain, never in settings JSON</div>
          </div>
          <div className="composio__keyRow">
            <Field label="API key" hint="Scoped to your Composio project. You can rotate it at any time.">
              <input
                className="n-input n-input--mono"
                type="password"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                placeholder="comp_…"
                autoFocus
              />
            </Field>
            <Button variant="primary" icon="check" onClick={() => void saveKey()} disabled={!keyDraft.trim() || busy !== null}>
              {busy === 'key' ? <Spinner size={13} /> : null} Save & sync
            </Button>
          </div>
        </div>
      ) : null}

      {status.configured ? (
        <>
          <div className="composio__stats">
            <Stat label="Actions" value={status.tools} icon="plug" />
            <Stat label="Toolkits" value={status.toolkits} icon="package" />
            <Stat label="Accounts" value={accounts.length} icon="user" />
            <Stat label="Enabled tools" value={status.enabled} icon="wrench" />
            <Stat label="User" value={status.userId} icon="user" mono />
            <div className="grow" />
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => void refreshAccounts()} disabled={busy !== null}>
              {busy === 'accounts' ? <Spinner size={12} /> : null} {t('composio.refresh')}
            </Button>
          </div>

          {status.error ? <div className="errText tiny">{status.error}</div> : null}

          <div className="composio__accounts">
            <div className="tiny faint uppercase">Connected accounts</div>
            {accounts.length ? (
              <div className="row wrap" style={{ gap: 6 }}>
                {accounts.map((account) => (
                  <span key={account.id} className="composio__account">
                    {connectedToolkits.has(account.toolkit) ? <BrandIcon toolkit={account.toolkit} size={14} /> : <Icon name="plug" size={13} />}
                    <span className="small">{account.toolkit}</span>
                    <span className="n-badge n-badge--success">{account.status.toLowerCase()}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="tiny faint">No accounts connected yet. Pick a toolkit below and press Connect — the browser opens the Composio auth page.</div>
            )}
          </div>

          <div className="composio__tabs">
            <div className="n-segmented">
              <button type="button" data-active={tab === 'toolkits'} onClick={() => setTab('toolkits')}>
                {t('composio.toolkits')} · {toolkits.length}
              </button>
              <button type="button" data-active={tab === 'tools'} onClick={() => setTab('tools')}>
                {t('composio.actions')} · {tools.length}
              </button>
            </div>
            <div className="composio__search">
              <Icon name="search" size={13} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search toolkits and actions…" />
            </div>
          </div>

          {tab === 'toolkits' ? (
            filteredToolkits.length ? (
              <div className="composio__grid">
                {filteredToolkits.map((toolkit) => {
                  const connected = connectedToolkits.has(toolkit.slug);
                  return (
                    <div key={toolkit.slug} className="composioToolkit" data-connected={connected}>
                      <span className="composioToolkit__logo">
                        <BrandIcon toolkit={toolkit.slug} size={22} />
                      </span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="small strong truncate">{toolkit.name}</div>
                        <div className="tiny faint truncate">
                          {toolkit.tools ? `${toolkit.tools} actions` : 'no actions synced'} · {toolkit.slug}
                        </div>
                      </div>
                      {connected ? (
                        <span className="n-badge n-badge--success">connected</span>
                      ) : (
                        <Button
                          variant="soft"
                          size="sm"
                          icon="link"
                          onClick={() => void connect(toolkit.slug)}
                          disabled={busy !== null}
                        >
                          {busy === `connect:${toolkit.slug}` ? <Spinner size={12} /> : null} Connect
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="plug" title="No toolkits in the catalog" body="Press Sync catalog to fetch the latest integrations from Composio." />
            )
          ) : filteredTools.length ? (
            <div className="composio__tools">
              {filteredTools.slice(0, 120).map((tool) => (
                <div key={tool.slug} className="composioTool" data-enabled={tool.enabled}>
                  <span className="composioTool__logo">
                    <BrandIcon toolkit={tool.toolkit} size={16} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{tool.name}</div>
                    <div className="tiny faint truncate">
                      <span className="mono">{tool.slug}</span> · {tool.toolkit}
                    </div>
                  </div>
                  <span className="composioTool__desc tiny faint">{tool.description.slice(0, 90)}</span>
                  <Switch on={tool.enabled} onChange={(enabled) => void toggle(tool.slug, enabled)} label={tool.slug} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="search" title="No matching actions" body="Try a different search, or sync the catalog again." />
          )}

          <div className="composio__foot">
            <Icon name="info" size={13} className="faint" />
            <span className="tiny faint">
              Enabled actions are registered as <code>composio.&lt;slug&gt;</code> tools and obey the per-tool policy in Settings → Tools.
              The agent can also discover and run any action through the meta tools. Full guide: <code>docs/COMPOSIO.md</code>.
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, icon, mono }: { label: string; value: number | string; icon: string; mono?: boolean }): JSX.Element {
  return (
    <div className="composio__stat">
      <Icon name={icon} size={15} />
      <div>
        <div className={`small strong ${mono ? 'mono' : ''}`}>{value}</div>
        <div className="tiny faint">{label}</div>
      </div>
    </div>
  );
}
