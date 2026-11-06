import { useEffect, useState } from 'react';
import type { AnchorPin, Note } from '@shared/types';
import { useAppStore } from '../state/store';
import { useChatStore } from '../state/chat';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from './Icon';
import { IconButton, Menu, Modal, Button, EmptyState, Field, type MenuItem } from './ui';
import { BrandMark } from './BrandMark';

const PIN_ICONS: Record<AnchorPin['kind'], string> = {
  chat: 'message',
  note: 'file-text',
  file: 'file-code',
  space: 'boxes',
  notebook: 'notebook-pen',
  link: 'link',
  terminal: 'terminal',
  widget: 'gauge',
};

export function AnchorRail(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const stats = useAppStore((s) => s.stats);
  const setAnchorOpen = useAppStore((s) => s.setAnchorOpen);
  const navigate = useAppStore((s) => s.navigate);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const activeChatId = useChatStore((s) => s.activeId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  useEffect(() => {
    void invoke('notes.list', undefined).then(setNotes).catch(() => {});
  }, []);

  if (!settings) return <aside className="anchor" />;
  const pins = [...settings.anchor.pins].sort((a, b) => a.order - b.order);
  const agent = settings.agents.find((a) => a.id === settings.activeAgentId) ?? settings.agents[0];

  const addPin = (pin: Omit<AnchorPin, 'id' | 'order'>): void => {
    const next: AnchorPin = { ...pin, id: `pin_${Date.now().toString(36)}`, order: pins.length };
    void patchSettings({ anchor: { ...settings.anchor, pins: [...settings.anchor.pins, next] } });
  };

  const removePin = (id: string): void => {
    void patchSettings({ anchor: { ...settings.anchor, pins: settings.anchor.pins.filter((pin) => pin.id !== id) } });
  };

  const openPin = (pin: AnchorPin): void => {
    switch (pin.kind) {
      case 'chat':
        void useChatStore.getState().open(pin.ref);
        navigate('chat');
        break;
      case 'note':
        navigate('space');
        break;
      case 'file':
        navigate('workspace', { path: pin.ref });
        break;
      case 'link':
        navigate('browser', { url: pin.ref });
        break;
      case 'notebook':
        navigate('notebook');
        break;
      case 'terminal':
        navigate('terminal');
        break;
      case 'space':
        navigate('space');
        break;
      default:
        navigate('desktop');
    }
  };

  const addItems: MenuItem[] = [
    {
      label: 'Current conversation',
      icon: 'message',
      onClick: () => {
        const active = useChatStore.getState().active;
        if (!active) return;
        addPin({ kind: 'chat', ref: active.id, label: active.title, subtitle: active.model });
      },
    },
    ...notes.slice(0, 4).map((note) => ({
      label: note.title,
      icon: 'file-text',
      onClick: () => addPin({ kind: 'note', ref: note.id, label: note.title, subtitle: note.body.slice(0, 60) }),
    })),
    {
      label: 'Workspace root',
      icon: 'folder',
      onClick: () => addPin({ kind: 'file', ref: settings.workspaceRoot, label: settings.workspaceRoot.split(/[\\/]/).pop() ?? 'Workspace', subtitle: settings.workspaceRoot }),
    },
    { label: 'Link…', icon: 'link', onClick: () => setLinkOpen(true) },
  ];

  return (
    <aside className="anchor">
      <header className="anchor__head">
        <div className="row" style={{ gap: 8 }}>
          <span className="anchor__mark">
            <Icon name="pin" size={14} />
          </span>
          <div>
            <div className="anchor__title">{t('anchor.title')}</div>
            <div className="tiny faint">{pins.length} pinned</div>
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <IconButton icon="plus" label={t('anchor.add')} onClick={() => setMenuOpen(true)} />
          <IconButton icon="x" label="Hide anchor" onClick={() => setAnchorOpen(false)} />
        </div>
      </header>

      <div className="anchor__body n-scroll">
        {agent ? (
          <div className="anchor__agent">
            <div className="row" style={{ gap: 10 }}>
              <div className="anchor__agent-orb">
                <BrandMark size={18} animated />
              </div>
              <div className="grow">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small strong">{agent.name}</span>
                  <span className="n-badge n-badge--accent">active</span>
                </div>
                <div className="tiny faint truncate">{agent.description}</div>
              </div>
            </div>
            <div className="anchor__agent-stats">
              <span className="mono tiny">{agent.tools === 'all' ? 'all tools' : `${agent.tools.length} tools`}</span>
              <span className="mono tiny">max {agent.maxSteps}</span>
              <span className="mono tiny">t° {agent.temperature}</span>
            </div>
          </div>
        ) : null}

        <div className="anchor__section-title">
          <span>{t('anchor.title')} pins</span>
          {pins.length ? <span className="tiny faint">{pins.length}</span> : null}
        </div>

        {pins.length === 0 ? (
          <EmptyState
            icon="pin"
            title="Nothing pinned yet"
            body={t('anchor.empty')}
            action={
              <Button variant="soft" size="sm" icon="plus" onClick={() => setMenuOpen(true)}>
                {t('anchor.add')}
              </Button>
            }
          />
        ) : (
          <div className="anchor__pins">
            {pins.map((pin) => (
              <div key={pin.id} className="anchor__pin" role="button" tabIndex={0} onClick={() => openPin(pin)}>
                <span className={`anchor__pin-icon anchor__pin-icon--${pin.kind}`}>
                  <Icon name={PIN_ICONS[pin.kind]} size={14} />
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="anchor__pin-label truncate">{pin.label}</div>
                  <div className="anchor__pin-sub truncate">{pin.subtitle ?? pin.kind}</div>
                </div>
                <button
                  type="button"
                  className="anchor__pin-remove"
                  aria-label={t('anchor.unpin')}
                  onClick={(event) => {
                    event.stopPropagation();
                    removePin(pin.id);
                  }}
                >
                  <Icon name="pin-off" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="anchor__section-title">
          <span>Live</span>
          <span className="n-dot n-dot--online n-dot--live" />
        </div>

        <div className="anchor__widget">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="tiny faint uppercase">Memory</span>
            <span className="mono tiny">
              {stats ? `${(stats.memoryUsed / 1024 ** 3).toFixed(1)} / ${(stats.memoryTotal / 1024 ** 3).toFixed(1)} GB` : '—'}
            </span>
          </div>
          <div className="n-progress" style={{ marginTop: 8 }}>
            <span style={{ width: `${stats ? (stats.memoryUsed / stats.memoryTotal) * 100 : 0}%`, background: 'var(--n-teal)' }} />
          </div>
          <div className="row" style={{ gap: 14, marginTop: 12 }}>
            <MiniStat label="CPU" value={stats ? `${stats.cpu}%` : '—'} />
            <MiniStat label="Proc" value={stats ? String(stats.processes) : '—'} />
            <MiniStat label="Up" value={stats ? `${Math.floor(stats.uptime / 3600)}h` : '—'} />
          </div>
        </div>

        <div className="anchor__section-title">
          <span>Recent notes</span>
          <Icon name="file-text" size={12} className="faint" />
        </div>
        <div className="anchor__notes">
          {notes.slice(0, 3).map((note) => (
            <div
              key={note.id}
              className="anchor__note"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!pins.some((pin) => pin.ref === note.id)) addPin({ kind: 'note', ref: note.id, label: note.title, subtitle: note.body.slice(0, 60) });
              }}
            >
              <span className="anchor__note-dot" style={{ background: note.color }} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small truncate">{note.title}</div>
                <div className="tiny faint truncate">{note.body.replace(/\n/g, ' ')}</div>
              </div>
              <span className="tiny faint">{relativeTime(note.updatedAt)}</span>
            </div>
          ))}
          {notes.length === 0 ? <div className="tiny faint" style={{ padding: '4px 2px' }}>No notes yet.</div> : null}
        </div>
      </div>

      <footer className="anchor__foot">
        <button type="button" className="anchor__foot-btn" onClick={() => void invoke('system.screenshot', undefined).catch(() => {})}>
          <Icon name="scan" size={13} />
          Capture
        </button>
        <button type="button" className="anchor__foot-btn" onClick={() => navigate('settings')}>
          <Icon name="settings" size={13} />
          {t('nav.settings')}
        </button>
      </footer>

      {menuOpen ? <Menu items={addItems} onClose={() => setMenuOpen(false)} align="right" width={252} /> : null}

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Pin a link"
        description="The link opens in the Neuro browser from the Anchor rail."
        footer={
          <>
            <Button onClick={() => setLinkOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              icon="pin"
              onClick={() => {
                if (!linkValue.trim()) return;
                addPin({ kind: 'link', ref: linkValue.trim(), label: linkValue.replace(/^https?:\/\//, '').slice(0, 40), subtitle: 'link' });
                setLinkValue('');
                setLinkOpen(false);
              }}
            >
              {t('anchor.pin')}
            </Button>
          </>
        }
      >
        <Field label="URL">
          <input className="n-input" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://…" autoFocus />
        </Field>
      </Modal>
      {activeChatId ? null : null}
    </aside>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="col" style={{ gap: 1 }}>
      <span className="mono tiny faint uppercase">{label}</span>
      <span className="mono small">{value}</span>
    </div>
  );
}
