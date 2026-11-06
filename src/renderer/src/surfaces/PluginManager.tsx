import { useCallback, useEffect, useState } from 'react';
import type { PluginProviderEntry, PluginRecord, InstalledTheme } from '@shared/types';
import { useAppStore } from '../state/store';
import { invoke } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Field, IconButton, Modal, Spinner, Switch } from '../components/ui';

export function PluginManager(): JSX.Element {
  const pushToast = useAppStore((s) => s.pushToast);
  const [records, setRecords] = useState<PluginRecord[]>([]);
  const [themes, setThemes] = useState<InstalledTheme[]>([]);
  const [providers, setProviders] = useState<PluginProviderEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [logsFor, setLogsFor] = useState<PluginRecord | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [detail, setDetail] = useState<PluginRecord | null>(null);

  const load = useCallback(async () => {
    const [list, themeList, providerList] = await Promise.all([
      invoke('plugins.list', undefined),
      invoke('plugins.themes', undefined),
      invoke('plugins.providers', undefined),
    ]);
    setRecords(list);
    setThemes(themeList);
    setProviders(providerList);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const installWith = async (kind: 'folder' | 'archive'): Promise<void> => {
    setBusy(kind);
    try {
      const result = kind === 'folder' ? await invoke('plugins.installFolder', undefined) : await invoke('plugins.installArchive', undefined);
      if (result.installed) pushToast({ title: 'Plugin installed', message: result.message, kind: 'success' });
      else if (result.message !== 'cancelled') pushToast({ title: 'Install failed', message: result.message, kind: 'error' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const installUrl = async (): Promise<void> => {
    if (!url.trim()) return;
    setBusy('url');
    try {
      const result = await invoke('plugins.installUrl', { url: url.trim() });
      if (result.installed) {
        pushToast({ title: 'Plugin installed', message: result.message, kind: 'success' });
        setUrlOpen(false);
        setUrl('');
      } else {
        pushToast({ title: 'Install failed', message: result.message, kind: 'error' });
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (record: PluginRecord, enabled: boolean): Promise<void> => {
    setBusy(record.id);
    try {
      setRecords(await invoke('plugins.toggle', { id: record.id, enabled }));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const uninstall = async (record: PluginRecord): Promise<void> => {
    setBusy(record.id);
    try {
      setRecords(await invoke('plugins.uninstall', { id: record.id }));
      setDetail(null);
      await load();
      pushToast({ title: `${record.name} removed`, kind: 'info' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="plugins">
      <div className="plugins__head">
        <div>
          <div className="small strong">Installed plugins</div>
          <div className="tiny faint">
            Third-party extensions can contribute tools, themes, provider presets, streaming adapters and commands. They run in the
            main process with the permissions you grant.
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Button variant="outline" size="sm" icon="folder-open" onClick={() => void installWith('folder')} disabled={busy !== null}>
            {busy === 'folder' ? <Spinner size={12} /> : null} From folder
          </Button>
          <Button variant="outline" size="sm" icon="archive" onClick={() => void installWith('archive')} disabled={busy !== null}>
            {busy === 'archive' ? <Spinner size={12} /> : null} From .zip
          </Button>
          <Button variant="soft" size="sm" icon="link" onClick={() => setUrlOpen(true)}>
            From URL
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon="puzzle"
          title="No plugins installed"
          body="Drop a folder containing neuro.plugin.json, or install a .zip package. See docs/PLUGINS.md for the manifest and API."
        />
      ) : (
        <div className="plugins__grid">
          {records.map((record) => (
            <div key={record.id} className="pluginCard" data-status={record.status}>
              <div className="pluginCard__top">
                <span className="pluginCard__icon">
                  <Icon name="puzzle" size={17} />
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="small strong truncate">{record.name}</span>
                    <span className="n-badge">v{record.version}</span>
                  </div>
                  <div className="tiny faint truncate">{record.id} · {record.author ?? 'unknown author'}</div>
                </div>
                <Switch on={record.enabled} onChange={(enabled) => void toggle(record, enabled)} label={record.name} />
              </div>
              <div className="pluginCard__desc">{record.description}</div>
              <div className="pluginCard__stats">
                <span><Icon name="wrench" size={11} /> {record.contributions.tools} tools</span>
                <span><Icon name="palette" size={11} /> {record.contributions.themes} themes</span>
                <span><Icon name="plug" size={11} /> {record.contributions.providers + record.contributions.adapters} providers</span>
                <span><Icon name="command" size={11} /> {record.contributions.commands} commands</span>
              </div>
              {record.error ? <div className="pluginCard__error tiny">{record.error}</div> : null}
              <div className="pluginCard__foot">
                <span className={`n-badge ${record.status === 'loaded' ? 'n-badge--success' : record.status === 'error' ? 'n-badge--danger' : ''}`}>
                  {record.status}
                </span>
                <span className="tiny faint">{relativeTime(record.installedAt)}</span>
                <span className="grow" />
                <IconButton icon="code" label="Logs" size={13} onClick={() => { setLogsFor(record); void invoke('plugins.logs', { id: record.id }).then(setLogs); }} />
                <IconButton icon="rotate-ccw" label="Reload" size={13} onClick={() => void invoke('plugins.reload', { id: record.id }).then((next) => { setRecords(next); void load(); })} />
                <IconButton icon="folder-open" label="Open folder" size={13} onClick={() => void invoke('plugins.openFolder', { id: record.id })} />
                <IconButton icon="info" label="Details" size={13} onClick={() => setDetail(record)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {(themes.length || providers.length) ? (
        <div className="plugins__contrib">
          {themes.length ? (
            <div>
              <div className="tiny faint uppercase" style={{ marginBottom: 6 }}>Contributed themes</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {themes.map((theme) => (
                  <span key={theme.id} className="n-chip">
                    <Icon name="palette" size={11} /> {theme.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {providers.length ? (
            <div>
              <div className="tiny faint uppercase" style={{ marginBottom: 6 }}>Contributed providers</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {providers.map((provider) => (
                  <span key={provider.id} className="n-chip">
                    <Icon name={provider.kind === 'adapter' ? 'zap' : 'plug'} size={11} /> {provider.pluginName} · {provider.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="plugins__docs">
        <Icon name="book" size={14} className="faint" />
        <div>
          <div className="small strong">Build your own</div>
          <div className="tiny faint" style={{ lineHeight: 1.6 }}>
            A plugin is a folder with <code>neuro.plugin.json</code> plus an optional <code>main.js</code>. Declare tools, themes,
            providers, adapters and commands; export handlers from <code>module.exports</code>. Full reference:{' '}
            <code>docs/PLUGINS.md</code> — examples live in <code>examples/plugins/</code>.
          </div>
        </div>
      </div>

      <Modal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        title="Install from URL"
        description="Download a .zip plugin package over HTTPS."
        footer={
          <>
            <Button onClick={() => setUrlOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="download" onClick={() => void installUrl()} disabled={!url.trim() || busy !== null}>
              {busy === 'url' ? <Spinner size={13} /> : null} Install
            </Button>
          </>
        }
      >
        <Field label="Package URL">
          <input className="n-input n-input--mono" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/my-plugin.zip" autoFocus />
        </Field>
      </Modal>

      <Modal
        open={Boolean(logsFor)}
        onClose={() => setLogsFor(null)}
        title={`${logsFor?.name ?? ''} · logs`}
        description="Plugin console output and load errors."
        width={720}
      >
        <pre className="plugins__logs mono">{logs.length ? logs.join('\n') : 'No log lines yet.'}</pre>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        description={detail?.description}
        width={620}
        footer={
          detail ? (
            <>
              <span className="mono tiny faint">{detail.path}</span>
              <span className="grow" />
              <Button variant="danger" icon="trash" onClick={() => void uninstall(detail)}>
                Uninstall
              </Button>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="col" style={{ gap: 12 }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="n-badge">v{detail.version}</span>
              <span className="n-badge">{detail.status}</span>
              {detail.permissionList.length ? (
                detail.permissionList.map((permission) => (
                  <span key={permission} className="n-chip"><Icon name="lock" size={10} /> {permission}</span>
                ))
              ) : (
                <span className="n-chip">no permissions</span>
              )}
            </div>
            <div className="settings__kvGrid">
              <Kv label="Tools" value={String(detail.contributions.tools)} />
              <Kv label="Themes" value={String(detail.contributions.themes)} />
              <Kv label="Providers" value={String(detail.contributions.providers + detail.contributions.adapters)} />
              <Kv label="Commands" value={String(detail.contributions.commands)} />
            </div>
            <div className="tiny faint">Installed {new Date(detail.installedAt).toLocaleString()}</div>
            {detail.error ? <div className="errText tiny">{detail.error}</div> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="kvRow">
      <span className="tiny faint uppercase">{label}</span>
      <span className="small mono">{value}</span>
    </div>
  );
}
