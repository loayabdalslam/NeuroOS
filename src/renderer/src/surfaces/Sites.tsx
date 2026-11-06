import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SiteManifest, WebPeer, WebStats } from '@shared/types';
import { useAppStore } from '../state/store';
import { invoke, on } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Field, IconButton, Spinner } from '../components/ui';

interface DraftFile {
  path: string;
  data: string;
  size: number;
}

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function readEntry(entry: FileSystemEntry, prefix = ''): Promise<DraftFile[]> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    if (file.size > 4 * 1024 * 1024) return [];
    return [{ path, data: base64(await file.arrayBuffer()), size: file.size }];
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const all: FileSystemEntry[] = [];
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      all.push(...batch);
    }
    const nested = await Promise.all(all.filter((item) => !item.name.startsWith('.') && item.name !== 'node_modules').map((item) => readEntry(item, path)));
    return nested.flat();
  }
  return [];
}

export function SitesSurface(): JSX.Element {
  const pushToast = useAppStore((s) => s.pushToast);
  const navigate = useAppStore((s) => s.navigate);
  const [sites, setSites] = useState<SiteManifest[]>([]);
  const [peers, setPeers] = useState<WebPeer[]>([]);
  const [stats, setStats] = useState<WebStats | null>(null);
  const [domain, setDomain] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [peerHost, setPeerHost] = useState('');
  const [peerPort, setPeerPort] = useState('47813');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [siteList, statsNow, peerList] = await Promise.all([invoke('web.list', undefined), invoke('web.status', undefined), invoke('web.peers', undefined)]);
    setSites(siteList);
    setStats(statsNow);
    setPeers(peerList);
  }, []);

  useEffect(() => {
    void load();
    const dispose = on('web:event', (event) => {
      if (event.stats) setStats(event.stats);
      void invoke('web.list', undefined).then(setSites);
    });
    return () => dispose();
  }, [load]);

  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  const addFiles = (incoming: DraftFile[]): void => {
    const merged = new Map(files.map((file) => [file.path, file]));
    for (const file of incoming) merged.set(file.path, file);
    setFiles([...merged.values()]);
  };

  const onDrop = async (event: React.DragEvent): Promise<void> => {
    event.preventDefault();
    setDragging(false);
    const items = Array.from(event.dataTransfer.items ?? []);
    const entries = items
      .map((item) => (item.kind === 'file' ? item.webkitGetAsEntry() : null))
      .filter((entry): entry is FileSystemEntry => Boolean(entry));
    if (entries.length) {
      setBusy('drop');
      try {
        const collected = (await Promise.all(entries.map((entry) => readEntry(entry)))).flat();
        addFiles(collected);
        if (!domain) {
          const first = entries[0];
          const guess = (first.isDirectory ? first.name : first.name.replace(/\.[^.]+$/, '')).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
          if (guess) setDomain(guess);
        }
      } finally {
        setBusy(null);
      }
      return;
    }
    const dropped = Array.from(event.dataTransfer.files ?? []);
    const collected = await Promise.all(
      dropped.map(async (file) => ({ path: file.name, data: base64(await file.arrayBuffer()), size: file.size })),
    );
    addFiles(collected);
  };

  const publish = async (): Promise<void> => {
    if (!domain.trim() || !files.length) return;
    setBusy('publish');
    try {
      const result = await invoke('web.publish', {
        domain: domain.trim().toLowerCase().replace(/\.neuro$/, ''),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        files: files.map((file) => ({ path: file.path, data: file.data })),
      });
      if (result.ok) {
        pushToast({ title: `Published ${result.manifest?.domain}.neuro`, message: `${result.manifest?.files.length} files seeded to the mesh`, kind: 'success' });
        setFiles([]);
        setTitle('');
        setDescription('');
        setDomain('');
        await load();
      } else {
        pushToast({ title: 'Publish failed', message: result.error ?? 'Unknown error', kind: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  const publishFolder = async (): Promise<void> => {
    if (!domain.trim()) {
      pushToast({ title: 'Pick a domain first', message: 'Enter a name like my-site, then choose a folder.', kind: 'warning' });
      return;
    }
    setBusy('folder');
    try {
      const result = await invoke('web.publishFolder', { domain: domain.trim().toLowerCase().replace(/\.neuro$/, ''), title: title.trim() || undefined });
      if (result.ok) {
        pushToast({ title: `Published ${result.manifest?.domain}.neuro`, message: 'Folder pushed to the mesh', kind: 'success' });
        await load();
      } else if (result.error !== 'cancelled') {
        pushToast({ title: 'Publish failed', message: result.error, kind: 'error' });
      }
    } finally {
      setBusy(null);
    }
  };

  const gateway = stats?.gateway ?? '';
  const openSite = (site: SiteManifest): void => {
    navigate('browser', { url: `${gateway}/dweb/${site.domain}/`, mode: 'dweb' });
  };

  const unpublish = async (site: SiteManifest): Promise<void> => {
    setBusy(site.domain);
    try {
      setSites(await invoke('web.unpublish', { domain: site.domain }));
      pushToast({ title: `${site.domain}.neuro removed`, message: 'The claim was released on this node.', kind: 'info' });
    } finally {
      setBusy(null);
    }
  };

  const addPeer = async (): Promise<void> => {
    if (!peerHost.trim()) return;
    const [host, port] = peerHost.includes(':') ? peerHost.split(':') : [peerHost, peerPort];
    setBusy('peer');
    try {
      setPeers(await invoke('web.peerAdd', { host: host.trim(), port: Number(port) || 47813 }));
      setPeerHost('');
      pushToast({ title: 'Peer added', message: `${host}:${port}`, kind: 'success' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sites">
      <header className="sites__head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="sites__title">Neuro Web</span>
            <span className="n-badge n-badge--accent">decentralized</span>
            {stats ? <span className="n-chip mono">{stats.nodeId.slice(0, 12)}</span> : null}
          </div>
          <div className="small faint" style={{ marginTop: 4 }}>
            Host a site from this machine, or replicate one from a peer. Names resolve through the mesh — no registry, no hosting bill.
          </div>
        </div>
        {gateway ? (
          <button type="button" className="sites__gateway mono tiny" onClick={() => void navigator.clipboard.writeText(gateway)} title="Copy gateway URL">
            <Icon name="globe" size={12} /> {gateway}
          </button>
        ) : null}
      </header>

      <div className="sites__counters">
        <Counter label="Sites hosted" value={stats?.sites ?? 0} icon="layers" accent="#a78bfa" />
        <Counter label="Peers online" value={stats?.online ?? 0} icon="network" accent="#14b8a6" suffix={`/ ${stats?.peers ?? 0}`} />
        <Counter label="Visits served" value={stats?.hits ?? 0} icon="activity" accent="#22c55e" live />
        <Counter label="Content" value={formatBytes(stats?.bytes ?? 0)} icon="database" accent="#f59e0b" />
      </div>

      <div className="sites__grid">
        <section className="sites__publish">
          <div className="sites__sectionHead">
            <Icon name="package" size={15} />
            <span className="small strong">Publish a site</span>
            <span className="grow" />
            <button type="button" className="tiny faint" onClick={() => fileInput.current?.click()}>
              pick files
            </button>
          </div>

          <div className="sites__fields">
            <label className="sites__domain">
              <input value={domain} onChange={(event) => setDomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="my-site" />
              <span className="mono">.neuro</span>
            </label>
            <input className="n-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Site title (optional)" />
            <input className="n-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" />
          </div>

          <div
            className="sites__drop"
            data-active={dragging}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => void onDrop(event)}
            onClick={() => fileInput.current?.click()}
          >
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                void Promise.all(picked.map(async (file) => ({ path: file.name, data: base64(await file.arrayBuffer()), size: file.size }))).then(addFiles);
              }}
            />
            <div className="sites__dropIcon">
              <Icon name={dragging ? 'download' : 'upload'} size={22} />
            </div>
            <div className="small strong">{dragging ? 'Drop to stage the files' : 'Drag a folder or files here'}</div>
            <div className="tiny faint">index.html at the root · max 300 files · up to 12 MB per site</div>
            {files.length ? (
              <div className="sites__fileMeta tiny mono">
                {files.length} files · {formatBytes(totalBytes)}
              </div>
            ) : null}
          </div>

          {files.length ? (
            <div className="sites__files">
              {files.slice(0, 8).map((file) => (
                <div key={file.path} className="sites__file">
                  <Icon name={file.path.endsWith('.html') ? 'file-code' : file.path.match(/\.(png|jpe?g|svg|webp|gif)$/) ? 'image' : 'file-text'} size={13} />
                  <span className="mono truncate">{file.path}</span>
                  <span className="tiny faint">{formatBytes(file.size)}</span>
                  <IconButton icon="x" label="Remove" size={11} onClick={() => setFiles((current) => current.filter((item) => item.path !== file.path))} />
                </div>
              ))}
              {files.length > 8 ? <div className="tiny faint">+{files.length - 8} more</div> : null}
            </div>
          ) : null}

          <div className="sites__actions">
            <Button variant="outline" icon="folder" onClick={() => void publishFolder()} disabled={busy !== null}>
              {busy === 'folder' ? <Spinner size={13} /> : null} Publish a local folder
            </Button>
            <span className="grow" />
            {files.length ? (
              <Button variant="ghost" onClick={() => setFiles([])}>
                Clear
              </Button>
            ) : null}
            <Button variant="primary" icon="upload" onClick={() => void publish()} disabled={!domain.trim() || !files.length || busy !== null}>
              {busy === 'publish' || busy === 'drop' ? <Spinner size={13} /> : null} Publish to the mesh
            </Button>
          </div>
        </section>

        <aside className="sites__side">
          <div className="sites__sectionHead">
            <Icon name="server" size={15} />
            <span className="small strong">My sites</span>
            <span className="grow" />
            <span className="tiny faint">{sites.length}</span>
          </div>
          {sites.length ? (
            <div className="sites__list">
              {sites.map((site) => (
                <div key={site.domain} className="siteCard">
                  <div className="siteCard__top">
                    <span className="siteCard__icon">
                      <Icon name="globe" size={15} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small strong truncate">{site.domain}.neuro</div>
                      <div className="tiny faint truncate">{site.title}</div>
                    </div>
                    <span className="n-badge n-badge--success">live</span>
                  </div>
                  <div className="siteCard__meta tiny faint">
                    {site.files.length} files · {formatBytes(site.files.reduce((total, file) => total + file.size, 0))} · {relativeTime(site.updatedAt)}
                  </div>
                  <div className="siteCard__actions">
                    <Button variant="soft" size="sm" icon="external-link" onClick={() => openSite(site)}>
                      Open
                    </Button>
                    <IconButton icon="copy" label="Copy URL" size={13} onClick={() => void navigator.clipboard.writeText(`${gateway}/dweb/${site.domain}/`)} />
                    <span className="grow" />
                    <IconButton icon="trash" label="Unpublish" size={13} onClick={() => void unpublish(site)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="globe" title="No sites yet" body="Publish your first .neuro site from the panel on the left. It becomes reachable to peers immediately." />
          )}

          <div className="sites__sectionHead" style={{ marginTop: 10 }}>
            <Icon name="network" size={15} />
            <span className="small strong">Peers</span>
            <span className="grow" />
            <span className="tiny faint">{peers.length}</span>
          </div>
          <div className="sites__peerAdd">
            <input className="n-input n-input--mono" value={peerHost} onChange={(event) => setPeerHost(event.target.value)} placeholder="192.168.1.20:47813" />
            <Button variant="outline" icon="plus" onClick={() => void addPeer()} disabled={!peerHost.trim() || busy !== null}>
              Add
            </Button>
          </div>
          <div className="sites__peers">
            {peers.length ? (
              peers.map((peer) => {
                const online = Date.now() - new Date(peer.lastSeen).getTime() < 45_000;
                return (
                  <div key={peer.nodeId} className="sites__peer">
                    <span className={`n-dot ${online ? 'n-dot--online' : ''}`} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small mono truncate">{peer.host}:{peer.port}</div>
                      <div className="tiny faint">{peer.source} · {relativeTime(peer.lastSeen)}</div>
                    </div>
                    <IconButton icon="x" label="Remove peer" size={11} onClick={() => void invoke('web.peerRemove', { nodeId: peer.nodeId }).then(setPeers)} />
                  </div>
                );
              })
            ) : (
              <div className="tiny faint" style={{ padding: '8px 2px', lineHeight: 1.6 }}>
                No peers yet. Nodes on the same network appear here automatically; add a remote one manually as <span className="mono">host:port</span>.
              </div>
            )}
          </div>

          <div className="sites__hint">
            <Icon name="info" size={12} className="faint" />
            <span className="tiny faint">
              Sites are signed by this node and replicated to peers. If this machine goes offline, peers that accepted the site keep serving it.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Counter({ label, value, icon, accent, suffix, live }: { label: string; value: number | string; icon: string; accent: string; suffix?: string; live?: boolean }): JSX.Element {
  return (
    <div className="sites__counter" style={{ ['--counter-accent' as string]: accent }}>
      <div className="sites__counterTop">
        <span className="sites__counterIcon" style={{ background: `${accent}22`, borderColor: `${accent}44` }}>
          <Icon name={icon} size={16} />
        </span>
        {live ? <span className="n-dot n-dot--online n-dot--live" /> : null}
      </div>
      <div className="sites__counterValue">
        {value}
        {suffix ? <span className="tiny faint"> {suffix}</span> : null}
      </div>
      <div className="sites__counterLabel">{label}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
