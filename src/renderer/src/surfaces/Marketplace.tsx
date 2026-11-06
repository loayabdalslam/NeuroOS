import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem, InstalledItem } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { invoke } from '../lib/ipc';
import { Icon } from '../components/Icon';
import { Button, EmptyState, IconButton, Modal, Spinner, Switch } from '../components/ui';
import { PluginManager } from './PluginManager';

const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'skill', label: 'Skills' },
  { id: 'plugin', label: 'Plugins' },
  { id: 'agent', label: 'Agents' },
  { id: 'theme', label: 'Themes' },
];

const KIND_ICON: Record<string, string> = { skill: 'sparkles', plugin: 'puzzle', agent: 'bot', theme: 'palette' };

export function Marketplace({ params }: { params?: Record<string, string> }): JSX.Element {
  const t = useT();
  const navigate = useAppStore((s) => s.navigate);
  const pushToast = useAppStore((s) => s.pushToast);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [installed, setInstalled] = useState<InstalledItem[]>([]);
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'catalog' | 'installed' | 'plugins'>(params?.tab === 'plugins' ? 'plugins' : 'catalog');
  const [detail, setDetail] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([invoke('marketplace.catalog', undefined), invoke('marketplace.installed', undefined)]).then(([items, own]) => {
      setCatalog(items);
      setInstalled(own);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let items = catalog;
    if (kind !== 'all') items = items.filter((item) => item.kind === kind);
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.tagline.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.includes(q)) ||
          item.category.toLowerCase().includes(q),
      );
    }
    if (tab === 'installed') items = items.filter((item) => installed.some((own) => own.id === item.id));
    return items;
  }, [catalog, installed, kind, query, tab]);

  const featured = catalog.filter((item) => item.featured).slice(0, 3);
  const isInstalled = (id: string): boolean => installed.some((item) => item.id === id);

  const install = async (item: CatalogItem): Promise<void> => {
    setBusy(item.id);
    try {
      const next = await invoke('marketplace.install', { id: item.id });
      setInstalled(next);
      pushToast({ title: `${item.name} installed`, message: item.kind === 'plugin' ? 'Its tools are live in the tool bus.' : 'Available immediately.', kind: 'success' });
      if (item.kind === 'theme') {
        const accent = item.accent.toLowerCase();
        const known = ['neuro', 'deepseek', 'violet', 'teal', 'amber'];
        if (known.includes(accent) || item.id.includes('midnight')) {
          const map: Record<string, string> = { '#a78bfa': 'violet', '#f59e0b': 'amber', '#14b8a6': 'teal', '#4176e6': 'deepseek' };
          void useAppStore.getState().patchSettings({ theme: { accent: (map[item.accent.toLowerCase()] ?? 'neuro') as never } });
        }
      }
    } catch (error) {
      pushToast({ title: 'Install failed', message: (error as Error).message, kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const uninstall = async (item: CatalogItem): Promise<void> => {
    setBusy(item.id);
    try {
      setInstalled(await invoke('marketplace.uninstall', { id: item.id }));
      pushToast({ title: `${item.name} removed`, kind: 'info' });
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, enabled: boolean): Promise<void> => {
    setInstalled(await invoke('marketplace.toggle', { id, enabled }));
  };

  if (loading) {
    return (
      <div className="mkt center" style={{ height: '100%' }}>
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="mkt">
      <header className="mkt__head">
        <div>
          <h1 className="mkt__title display">{t('nav.marketplace')}</h1>
          <p className="small muted">Skills teach the agent procedures. Plugins add real tools. Agents add personalities. Themes restyle the OS.</p>
        </div>
        <div className="mkt__headRight">
          <div className="mkt__search">
            <Icon name="search" size={13} className="faint" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('marketplace.search')} />
          </div>
          <div className="n-segmented">
            <button type="button" data-active={tab === 'catalog'} onClick={() => setTab('catalog')}>
              {t('marketplace.catalog')}
            </button>
            <button type="button" data-active={tab === 'installed'} onClick={() => setTab('installed')}>
              {t('marketplace.installedTab')} {installed.length ? `· ${installed.length}` : ''}
            </button>
            <button type="button" data-active={tab === 'plugins'} onClick={() => setTab('plugins')}>
              Extensions
            </button>
          </div>
        </div>
      </header>

      <div className="mkt__filters" data-hidden={tab === 'plugins'}>
        {KINDS.map((item) => (
          <button key={item.id} type="button" className="n-chip" data-active={kind === item.id} onClick={() => setKind(item.id)}>
            {item.id !== 'all' ? <Icon name={KIND_ICON[item.id]} size={11} /> : null}
            {item.label}
          </button>
        ))}
        <span className="grow" />
        <span className="tiny faint mono">{filtered.length} items</span>
      </div>

      {tab === 'plugins' ? (
        <div className="mkt__scroll n-scroll">
          <PluginManager />
        </div>
      ) : (
      <div className="mkt__scroll n-scroll">
        {tab === 'catalog' && !query && kind === 'all' && featured.length ? (
          <div className="mkt__featured">
            {featured.map((item) => (
              <button key={item.id} type="button" className="mktFeature" onClick={() => setDetail(item)}>
                <div className="mktFeature__glow" style={{ background: item.accent }} />
                <div className="mktFeature__top">
                  <span className="mktFeature__icon" style={{ color: item.accent, background: `${item.accent}22`, borderColor: `${item.accent}44` }}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="n-badge n-badge--accent">featured</span>
                </div>
                <div className="mktFeature__name">{item.name}</div>
                <div className="mktFeature__tag">{item.tagline}</div>
                <div className="mktFeature__foot">
                  <span className="tiny faint">{item.installs.toLocaleString()} {t('marketplace.installs')}</span>
                  <span className="row" style={{ gap: 3 }}>
                    <Icon name="star" size={10} style={{ color: 'var(--n-warn)' }} />
                    <span className="tiny">{item.rating}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            icon="package"
            title={tab === 'installed' ? 'Nothing installed yet' : 'No matches'}
            body={tab === 'installed' ? 'Install a skill or plugin from the catalog to extend the agent.' : 'Try a different search or category.'}
          />
        ) : (
          <div className="mkt__grid">
            {filtered.map((item) => {
              const own = installed.find((entry) => entry.id === item.id);
              return (
                <div key={item.id} className="mktCard" data-installed={Boolean(own)}>
                  <div className="mktCard__top">
                    <span className="mktCard__icon" style={{ color: item.accent, background: `${item.accent}1c`, borderColor: `${item.accent}38` }}>
                      <Icon name={item.icon} size={16} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 5 }}>
                        <span className="mktCard__name truncate">{item.name}</span>
                        {item.verified ? <Icon name="shield" size={11} style={{ color: 'var(--n-success)' }} /> : null}
                      </div>
                      <div className="tiny faint">
                        {item.kind} · {item.author}
                      </div>
                    </div>
                    {own ? (
                      <Switch on={own.enabled} onChange={(next) => void toggle(item.id, next)} label={item.name} />
                    ) : (
                      <Button
                        variant="soft"
                        size="sm"
                        icon={busy === item.id ? undefined : 'download'}
                        onClick={() => void install(item)}
                        disabled={busy === item.id}
                      >
                        {busy === item.id ? <Spinner size={12} /> : t('common.install')}
                      </Button>
                    )}
                  </div>
                  <button type="button" className="mktCard__body" onClick={() => setDetail(item)}>
                    {item.tagline}
                  </button>
                  <div className="mktCard__foot">
                    <span className="row" style={{ gap: 3 }}>
                      <Icon name="star" size={10} style={{ color: 'var(--n-warn)' }} />
                      <span className="tiny">{item.rating}</span>
                    </span>
                    <span className="tiny faint">{item.installs.toLocaleString()}</span>
                    <span className="grow" />
                    <div className="row" style={{ gap: 4 }}>
                      {item.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="mktCard__tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        description={detail?.tagline}
        width={680}
        footer={
          detail ? (
            <>
              <span className="tiny faint mono">
                {detail.kind} · v{detail.version} · {detail.author}
              </span>
              <span className="grow" />
              {isInstalled(detail.id) ? (
                <Button variant="danger" icon="trash" onClick={() => { void uninstall(detail); setDetail(null); }}>
                  {t('common.delete')}
                </Button>
              ) : (
                <Button variant="primary" icon="download" onClick={() => { void install(detail); setDetail(null); }}>
                  {t('common.install')}
                </Button>
              )}
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="mktDetail">
            <div className="mktDetail__meta">
              <span className="n-chip"><Icon name="star" size={11} /> {detail.rating}</span>
              <span className="n-chip"><Icon name="download" size={11} /> {detail.installs.toLocaleString()}</span>
              <span className="n-chip"><Icon name={KIND_ICON[detail.kind]} size={11} /> {detail.kind}</span>
              {detail.verified ? <span className="n-badge n-badge--success">verified</span> : null}
            </div>
            <p className="small" style={{ lineHeight: 1.65 }}>{detail.description}</p>
            {detail.tools?.length ? (
              <div>
                <div className="tiny faint uppercase" style={{ marginBottom: 6 }}>tools contributed</div>
                <div className="col" style={{ gap: 6 }}>
                  {detail.tools.map((tool) => (
                    <div key={tool.name} className="mktDetail__tool">
                      <span className="mono tiny">{tool.name}</span>
                      <span className="tiny faint truncate">{tool.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {detail.permissions?.length ? (
              <div>
                <div className="tiny faint uppercase" style={{ marginBottom: 6 }}>permissions</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {detail.permissions.map((permission) => (
                    <span key={permission} className="n-chip"><Icon name="lock" size={10} /> {permission}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {detail.kind === 'skill' ? (
              <div>
                <div className="tiny faint uppercase" style={{ marginBottom: 6 }}>SKILL.md</div>
                <pre className="mktDetail__content mono">{detail.content}</pre>
              </div>
            ) : null}
            <div className="row" style={{ gap: 8 }}>
              <span className="tiny faint">Author</span>
              <span className="tiny">{detail.author}</span>
              <span className="grow" />
              {detail.homepage ? (
                <Button variant="ghost" size="sm" icon="external-link" onClick={() => void invoke('system.openExternal', { url: detail.homepage! })}>
                  Homepage
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
