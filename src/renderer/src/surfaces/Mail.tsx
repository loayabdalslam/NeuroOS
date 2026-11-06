import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MailMessage, MailPeer, MailStatus } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke, on } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Field, IconButton, Modal, Spinner, Switch } from '../components/ui';

type Folder = 'inbox' | 'sent';

export function MailSurface(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const pushToast = useAppStore((s) => s.pushToast);
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [peerOpen, setPeerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [identityName, setIdentityName] = useState(settings?.profile.name ?? '');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ to: '', subject: '', body: '', encrypt: true });
  const [peerDraft, setPeerDraft] = useState({ host: '', port: '47800' });
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async (activeFolder: Folder = folder) => {
    try {
      const [nextStatus, list] = await Promise.all([invoke('mail.status', undefined), invoke('mail.messages', { folder: activeFolder, limit: 200 })]);
      setStatus(nextStatus);
      setMessages(list);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    void refresh(folder);
  }, [folder, refresh]);

  useEffect(() => {
    const disposers = [
      on('mail:event', (event) => {
        if (event.status) setStatus(event.status);
        if (event.kind === 'message' || event.kind === 'delivery') void refresh(folder);
        if (event.kind === 'status') void refresh(folder);
      }),
    ];
    return () => disposers.forEach((dispose) => dispose());
  }, [folder, refresh]);

  const createIdentity = async (): Promise<void> => {
    setCreating(true);
    try {
      const next = await invoke('mail.identityCreate', { name: identityName.trim() || 'Explorer' });
      setStatus(next);
      pushToast({ title: 'Mail identity created', message: next.identity?.address, kind: 'success' });
      await refresh();
    } catch (error) {
      pushToast({ title: 'Could not create identity', message: (error as Error).message, kind: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (message) =>
        message.subject.toLowerCase().includes(q) ||
        message.from.name.toLowerCase().includes(q) ||
        message.from.address.toLowerCase().includes(q) ||
        message.body.toLowerCase().includes(q),
    );
  }, [messages, query]);

  const selected = messages.find((message) => message.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected && selected.direction === 'in' && !selected.read) {
      void invoke('mail.read', { id: selected.id }).then(() => refresh(folder));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const send = async (): Promise<void> => {
    if (!draft.to.trim() || !draft.subject.trim()) return;
    setSending(true);
    try {
      const result = await invoke('mail.send', { to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body, encrypt: draft.encrypt });
      pushToast({ title: 'Message queued', message: result.message, kind: result.ok ? 'success' : 'error' });
      setComposeOpen(false);
      setDraft({ to: '', subject: '', body: '', encrypt: true });
      setFolder('sent');
      await refresh('sent');
    } catch (error) {
      pushToast({ title: 'Send failed', message: (error as Error).message, kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  const addPeer = async (): Promise<void> => {
    try {
      await invoke('mail.peerAdd', { host: peerDraft.host.trim(), port: Number(peerDraft.port) });
      setPeerOpen(false);
      setPeerDraft({ host: '', port: '47800' });
      await refresh();
      pushToast({ title: 'Peer connected', kind: 'success' });
    } catch (error) {
      pushToast({ title: 'Peer unavailable', message: (error as Error).message, kind: 'error' });
    }
  };

  const reply = (message: MailMessage): void => {
    setDraft({
      to: message.from.address,
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      body: `\n\n─── On ${new Date(message.createdAt).toLocaleString()}, ${message.from.name} wrote:\n${message.body
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}`,
      encrypt: true,
    });
    setComposeOpen(true);
  };

  if (loading) {
    return (
      <div className="mail center" style={{ height: '100%' }}>
        <Spinner size={20} />
      </div>
    );
  }

  if (!status?.identity) {
    return (
      <div className="mail mail--setup">
        <div className="mailSetup">
          <div className="mailSetup__orb">
            <Icon name="inbox" size={30} />
          </div>
          <h1 className="mailSetup__title display">Your mail. No server.</h1>
          <p className="mailSetup__sub">
            Neuro mail is peer-to-peer. Your identity is an Ed25519 keypair, your address is derived from it, and messages are
            delivered directly to other nodes — signed, optionally end-to-end encrypted, and relayed by peers when you are offline.
          </p>
          <div className="mailSetup__facts">
            <span className="n-chip"><Icon name="lock" size={11} /> X25519 + AES-256-GCM</span>
            <span className="n-chip"><Icon name="shield" size={11} /> signed envelopes</span>
            <span className="n-chip"><Icon name="network" size={11} /> store-and-forward mesh</span>
            <span className="n-chip"><Icon name="activity" size={11} /> live over local sockets</span>
          </div>
          <Field label="Display name">
            <input
              className="n-input"
              value={identityName}
              onChange={(event) => setIdentityName(event.target.value)}
              placeholder="Your name"
              onKeyDown={(event) => event.key === 'Enter' && void createIdentity()}
              autoFocus
            />
          </Field>
          <Button variant="primary" size="lg" icon="key-round" onClick={() => void createIdentity()} disabled={creating}>
            {creating ? <Spinner size={14} /> : null}
            Create my identity
          </Button>
          <span className="tiny faint">The private key is encrypted with your OS keychain and never leaves this device.</span>
        </div>
      </div>
    );
  }

  const peers = status.peers;
  const onlinePeers = peers.filter((peer) => peer.online);

  return (
    <div className="mail">
      <aside className="mail__side">
        <div className="mail__identity">
          <div className="mail__identityTop">
            <span className="mail__identityDot" data-online={status.listening} />
            <span className="tiny mono truncate">{status.listening ? `node :${status.port}` : 'offline'}</span>
            <span className="grow" />
            <IconButton icon="copy" label="Copy address" size={13} onClick={() => void navigator.clipboard.writeText(status.identity!.address)} />
          </div>
          <div className="mail__address mono">{status.identity.address}</div>
          <div className="mail__identityMeta">
            <span className="tiny faint">{status.unread} unread</span>
            <span className="tiny faint">{status.pending} queued</span>
          </div>
        </div>

        <div className="mail__folders">
          <button type="button" data-active={folder === 'inbox'} onClick={() => { setFolder('inbox'); setSelectedId(null); }}>
            <Icon name="inbox" size={14} />
            <span className="grow">Inbox</span>
            {status.unread ? <span className="mail__badge">{status.unread}</span> : null}
          </button>
          <button type="button" data-active={folder === 'sent'} onClick={() => { setFolder('sent'); setSelectedId(null); }}>
            <Icon name="send" size={14} />
            <span className="grow">Sent</span>
          </button>
        </div>

        <div className="mail__peersHead">
          <span className="tiny faint uppercase">Peers</span>
          <div className="row" style={{ gap: 2 }}>
            <IconButton icon="refresh" label="Sync peers" size={12} onClick={() => void invoke('mail.sync', undefined).then(() => refresh())} />
            <IconButton icon="plus" label="Add peer" size={12} onClick={() => setPeerOpen(true)} />
          </div>
        </div>
        <div className="mail__peers n-scroll">
          {peers.length === 0 ? (
            <div className="tiny faint" style={{ padding: '4px 8px', lineHeight: 1.6 }}>
              LAN discovery is {status.discovery ? 'on — waiting for another node' : 'off'}. Add a peer manually by host and port.
            </div>
          ) : (
            peers.map((peer) => <PeerRow key={peer.nodeId} peer={peer} onRemove={() => void invoke('mail.peerRemove', { nodeId: peer.nodeId }).then(() => refresh())} />)
          )}
        </div>

        <div className="mail__discovery">
          <Switch on={status.discovery} onChange={(enabled) => void invoke('mail.discovery', { enabled }).then((next) => setStatus(next))} label="LAN discovery" />
          <span className="tiny">LAN discovery</span>
          <span className="grow" />
          <span className="tiny faint">{onlinePeers.length} online</span>
        </div>
      </aside>

      <section className="mail__list">
        <div className="mail__listHead">
          <div className="mail__search">
            <Icon name="search" size={13} className="faint" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" />
          </div>
          <Button variant="primary" size="sm" icon="pencil" onClick={() => { setDraft({ to: '', subject: '', body: '', encrypt: true }); setComposeOpen(true); }}>
            Compose
          </Button>
        </div>
        <div className="mail__messages n-scroll">
          {filtered.length === 0 ? (
            <EmptyState
              icon="inbox"
              title={folder === 'inbox' ? 'Inbox zero' : 'Nothing sent yet'}
              body={folder === 'inbox' ? 'When a peer sends you a message it appears here instantly — no polling, no server.' : 'Compose a message to a connected peer.'}
            />
          ) : (
            filtered.map((message) => (
              <button
                key={message.id}
                type="button"
                className="mail__message"
                data-active={selected?.id === message.id}
                data-unread={!message.read && message.direction === 'in'}
                onClick={() => setSelectedId(message.id)}
              >
                <div className="mail__messageTop">
                  <span className="mail__unreadDot" />
                  <span className="truncate small strong">{message.direction === 'in' ? message.from.name : `To ${message.to.name}`}</span>
                  <span className="grow" />
                  <span className="tiny faint">{relativeTime(message.createdAt)}</span>
                </div>
                <div className="mail__messageSubject truncate">{message.subject}</div>
                <div className="mail__messagePreview truncate">{message.body.replace(/\n/g, ' ')}</div>
                <div className="mail__messageBadges">
                  {message.encrypted ? <span className="mail__badge mail__badge--lock"><Icon name="lock" size={9} /> e2e</span> : null}
                  <span className={`mail__badge mail__badge--${message.delivery}`}>{message.delivery}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="mail__reader">
        {selected ? (
          <>
            <header className="mail__readerHead">
              <div className="grow" style={{ minWidth: 0 }}>
                <h2 className="mail__subject">{selected.subject}</h2>
                <div className="mail__readerMeta">
                  <span className="small strong">{selected.from.name}</span>
                  <span className="mono tiny faint">{selected.from.address}</span>
                  <span className="tiny faint">→ {selected.to.address}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <span className={`mail__badge mail__badge--${selected.delivery}`}>{selected.delivery}</span>
                {selected.encrypted ? <span className="mail__badge mail__badge--lock"><Icon name="lock" size={9} /> encrypted</span> : null}
                {selected.verified ? <span className="mail__badge mail__badge--verified"><Icon name="shield" size={9} /> verified</span> : null}
                <IconButton icon="trash" label="Delete" onClick={() => void invoke('mail.delete', { id: selected.id }).then(() => refresh())} />
              </div>
            </header>
            <div className="mail__readerBody n-scroll">
              <pre className="mail__body">{selected.body}</pre>
            </div>
            <footer className="mail__readerFoot">
              <span className="tiny faint">
                {new Date(selected.createdAt).toLocaleString()} · {selected.hops} hop{selected.hops === 1 ? '' : 's'} · thread {selected.threadId.slice(-6)}
              </span>
              <span className="grow" />
              {selected.direction === 'in' ? (
                <Button variant="outline" size="sm" icon="rotate-ccw" onClick={() => reply(selected)}>
                  Reply
                </Button>
              ) : null}
            </footer>
          </>
        ) : (
          <EmptyState icon="mail" title="Select a message" body="Messages are stored locally on this device. Nothing is synced to a cloud." />
        )}
      </section>

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="New message"
        description="Signed with your key. Encrypted when the recipient's public key is known."
        width={620}
        footer={
          <>
            <span className="tiny faint">{peers.length ? `${peers.length} peers known` : 'No peers yet'}</span>
            <span className="grow" />
            <Button onClick={() => setComposeOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" icon="send" onClick={() => void send()} disabled={sending || !draft.to.trim() || !draft.subject.trim()}>
              {sending ? <Spinner size={13} /> : null}
              Send
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 12 }}>
          <Field label="To" hint={peers.length ? 'Pick a peer or paste an address.' : 'Add a peer first in the left panel.'}>
            <div className="row" style={{ gap: 6 }}>
              <input
                className="n-input n-input--mono"
                value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                placeholder="name@node.neuro"
              />
              <select
                className="n-select"
                value=""
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                style={{ width: 160 }}
              >
                <option value="">Peers…</option>
                {peers.map((peer) => (
                  <option key={peer.nodeId} value={peer.address}>
                    {peer.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Subject">
            <input className="n-input" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
          </Field>
          <Field label="Message">
            <textarea className="n-input n-textarea" rows={9} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          </Field>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="row" style={{ gap: 6 }}>
              <Switch on={draft.encrypt} onChange={(encrypt) => setDraft({ ...draft, encrypt })} label="Encrypt" />
              <span className="tiny">End-to-end encrypt</span>
            </span>
            <span className="tiny faint">Delivery is direct peer-to-peer; offline peers receive it via relay.</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={peerOpen}
        onClose={() => setPeerOpen(false)}
        title="Add a peer"
        description="Enter the host and mail port of another Neuro node. LAN discovery finds peers automatically."
        footer={
          <>
            <Button onClick={() => setPeerOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" icon="link" onClick={() => void addPeer()} disabled={!peerDraft.host.trim()}>
              Connect
            </Button>
          </>
        }
      >
        <div className="row" style={{ gap: 10 }}>
          <Field label="Host">
            <input className="n-input n-input--mono" value={peerDraft.host} onChange={(event) => setPeerDraft({ ...peerDraft, host: event.target.value })} placeholder="192.168.1.40" />
          </Field>
          <Field label="Port">
            <input className="n-input n-input--mono" value={peerDraft.port} onChange={(event) => setPeerDraft({ ...peerDraft, port: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function PeerRow({ peer, onRemove }: { peer: MailPeer; onRemove: () => void }): JSX.Element {
  return (
    <div className="mail__peer" data-online={peer.online}>
      <span className={`n-dot ${peer.online ? 'n-dot--online' : ''}`} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="tiny truncate">{peer.name}</div>
        <div className="tiny faint mono truncate">{peer.host}:{peer.port}</div>
      </div>
      <button type="button" className="mail__peerRemove" onClick={onRemove} aria-label="Remove peer">
        <Icon name="x" size={10} />
      </button>
    </div>
  );
}
