import { useEffect, useMemo, useState } from 'react';
import type { Note, Space } from '@shared/types';
import { useAppStore } from '../state/store';
import { useChatStore } from '../state/chat';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { relativeTime } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, EmptyState, IconButton, Modal, Spinner } from '../components/ui';

const EMOJIS = ['◈', '◎', '⬡', '✦', '◆', '❖', '⬢', '◉', '⌘', '✳'];
const COLORS = ['#4176e6', '#a78bfa', '#22c55e', '#f59e0b', '#14b8a6', '#fb7185', '#e879f9'];

export function Spaces(): JSX.Element {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const navigate = useAppStore((s) => s.navigate);
  const sessions = useChatStore((s) => s.sessions);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', emoji: '◈', color: COLORS[0], path: '' });

  useEffect(() => {
    void Promise.all([invoke('spaces.list', undefined), invoke('notes.list', undefined)]).then(([spaceList, noteList]) => {
      setSpaces(spaceList);
      setNotes(noteList);
      setSelectedId(spaceList[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  const selected = useMemo(() => spaces.find((space) => space.id === selectedId) ?? spaces[0] ?? null, [spaces, selectedId]);
  const spaceNotes = notes.filter((note) => !note.spaceId || note.spaceId === selected?.id);
  const spaceSessions = sessions.filter((session) => session.spaceId === selected?.id);

  useEffect(() => {
    if (!selectedId) return;
    const detail = document.querySelector('.spaceDetail');
    if (detail && window.innerWidth < 980) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  const createSpace = async (): Promise<void> => {
    if (!draft.name.trim()) return;
    const space = await invoke('spaces.create', {
      name: draft.name.trim(),
      description: draft.description.trim(),
      emoji: draft.emoji,
      path: draft.path || undefined,
    });
    const withColor = await invoke('spaces.save', { ...space, color: draft.color });
    setSpaces(withColor);
    setSelectedId(space.id);
    setCreateOpen(false);
    setDraft({ name: '', description: '', emoji: '◈', color: COLORS[0], path: '' });
  };

  const openSpace = (space: Space): void => {
    if (space.path) {
      void useAppStore.getState().patchSettings({ workspaceRoot: space.path });
    }
    navigate('workspace');
  };

  const removeSpace = async (id: string): Promise<void> => {
    const next = await invoke('spaces.remove', { id });
    setSpaces(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const togglePin = async (space: Space): Promise<void> => {
    const next = await invoke('spaces.save', { ...space, pinned: !space.pinned });
    setSpaces(next);
  };

  if (loading) {
    return (
      <div className="spaces center" style={{ height: '100%' }}>
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="spaces">
      <header className="spaces__head">
        <div>
          <h1 className="spaces__title display">{t('nav.space')}</h1>
          <p className="small muted">Context that outlives a conversation — notes, files and agents grouped by intent.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="n-chip">{spaces.length} spaces</span>
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
            {t('space.create')}
          </Button>
        </div>
      </header>

      <div className="spaces__body">
        <div className="spaces__grid n-scroll">
          {spaces.length === 0 ? (
            <EmptyState
              icon="boxes"
              title={t('space.emptyTitle')}
              body="A space links a folder, a notebook, conversations and notes into one working context."
              action={<Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>{t('space.create')}</Button>}
            />
          ) : (
            spaces.map((space) => (              <button
                key={space.id}
                type="button"
                className="spaceCard"
                data-active={space.id === selected?.id}
                onClick={() => setSelectedId(space.id)}
                onDoubleClick={() => openSpace(space)}
                title="Click to preview · double-click to open its workspace"
              >
                <div className="spaceCard__top">
                  <span className="spaceCard__glyph" style={{ color: space.color, background: `${space.color}1f`, borderColor: `${space.color}3d` }}>
                    {space.emoji}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="spaceCard__name truncate">{space.name}</span>
                      {space.pinned ? <Icon name="pin" size={11} style={{ color: 'var(--n-accent)' }} /> : null}
                    </div>
                    <div className="tiny faint">{relativeTime(space.updatedAt)}</div>
                  </div>
                  <Icon name="chevron-right" size={14} className="faint" />
                </div>
                <div className="spaceCard__desc">{space.description || 'No description yet.'}</div>
                <div className="spaceCard__foot">
                  {space.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="n-chip tiny">{tag}</span>
                  ))}
                  <span className="grow" />
                  <span className="tiny faint mono">
                    {sessions.filter((session) => session.spaceId === space.id).length} chats
                  </span>
                </div>
              </button>
            ))
          )}
          <button type="button" className="spaceCard spaceCard--new" onClick={() => setCreateOpen(true)}>
            <span className="spaceCard__newIcon">
              <Icon name="plus" size={18} />
            </span>
            <div className="small strong">New space</div>
            <div className="tiny faint" style={{ lineHeight: 1.55 }}>
              Group a folder, a notebook and the conversations that belong to them.
            </div>
          </button>
        </div>

        {selected ? (
          <aside className="spaceDetail">
            <div className="spaceDetail__head">
              <span className="spaceCard__glyph" style={{ color: selected.color, background: `${selected.color}1f`, borderColor: `${selected.color}3d` }}>
                {selected.emoji}
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small strong truncate">{selected.name}</div>
                <div className="tiny faint">created {relativeTime(selected.createdAt)}</div>
              </div>
              <IconButton icon="pin" label="Pin space" active={selected.pinned} onClick={() => void togglePin(selected)} />
              <IconButton icon="trash" label={t('common.delete')} onClick={() => void removeSpace(selected.id)} />
            </div>

            <p className="spaceDetail__desc">{selected.description || 'Add a description to give the agent intent.'}</p>

            <div className="spaceDetail__actions">
              <Button variant="primary" size="sm" icon="external-link" onClick={() => openSpace(selected)}>
                Open
              </Button>
              <Button variant="outline" size="sm" icon="message" onClick={() => navigate('chat', {}, { forceNew: true })}>
                {t('chat.newChat')}
              </Button>
              <Button variant="ghost" size="sm" icon="files" onClick={() => navigate('workspace')}>
                {t('nav.workspace')}
              </Button>
              <Button variant="ghost" size="sm" icon="notebook-pen" onClick={() => navigate('notebook')}>
                {t('nav.notebook')}
              </Button>
            </div>

            <div className="spaceDetail__section">
              <div className="spaceDetail__label">
                {t('space.members')} <span className="tiny faint">{spaceSessions.length || 'none'}</span>
              </div>
              {spaceSessions.length === 0 ? (
                <div className="tiny faint" style={{ padding: '4px 0' }}>No conversations linked yet.</div>
              ) : (
                spaceSessions.slice(0, 5).map((session) => (
                  <button key={session.id} type="button" className="spaceDetail__row" onClick={() => { void useChatStore.getState().open(session.id); navigate('chat'); }}>
                    <Icon name="message" size={13} />
                    <span className="truncate small">{session.title}</span>
                  </button>
                ))
              )}
            </div>

            <div className="spaceDetail__section">
              <div className="spaceDetail__label">Notes <span className="tiny faint">{spaceNotes.length}</span></div>
              {spaceNotes.slice(0, 4).map((note) => (
                <div key={note.id} className="spaceDetail__note">
                  <span className="spaceDetail__noteDot" style={{ background: note.color }} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small truncate">{note.title}</div>
                    <div className="tiny faint" style={{ whiteSpace: 'pre-wrap', maxHeight: 52, overflow: 'hidden' }}>
                      {note.body}
                    </div>
                  </div>
                  <Icon
                    name="pin"
                    size={12}
                    className="faint"
                    role="button"
                    onClick={() => {
                      const current = settings;
                      if (!current) return;
                      void useAppStore.getState().patchSettings({
                        anchor: {
                          ...current.anchor,
                          pins: [
                            ...current.anchor.pins,
                            { id: `pin_${Date.now()}`, kind: 'note', ref: note.id, label: note.title, subtitle: note.body.slice(0, 50), order: current.anchor.pins.length },
                          ],
                        },
                      });
                    }}
                  />
                </div>
              ))}
              {spaceNotes.length === 0 ? <div className="tiny faint">No notes yet.</div> : null}
            </div>

            <div className="spaceDetail__meta">
              <span className="tiny faint uppercase">folder</span>
              <span className="mono tiny truncate">{selected.path ?? settings?.workspaceRoot ?? '—'}</span>
            </div>
          </aside>
        ) : null}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('space.create')}
        description="Spaces group context. Nothing is copied — they reference live entities."
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" icon="plus" onClick={() => void createSpace()} disabled={!draft.name.trim()}>
              {t('common.new')}
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 14 }}>
          <label className="n-field">
            <span className="n-label">{t('space.name')}</span>
            <input className="n-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
          </label>
          <label className="n-field">
            <span className="n-label">{t('space.description')}</span>
            <textarea className="n-input n-textarea" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <div className="n-field">
            <span className="n-label">Glyph</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="n-chip" data-active={draft.emoji === emoji} onClick={() => setDraft({ ...draft, emoji })} style={{ fontSize: 15 }}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="n-field">
            <span className="n-label">{t('settings.accent')}</span>
            <div className="row" style={{ gap: 8 }}>
              {COLORS.map((color) => (
                <button key={color} type="button" className="swatch" style={{ background: color }} data-active={draft.color === color} onClick={() => setDraft({ ...draft, color })} />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
