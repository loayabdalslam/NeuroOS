import { useEffect, useRef, useState } from 'react';
import type { BrowserTab, SiteManifest, WebStats } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { ensureHttp } from '../lib/util';
import { invoke, on } from '../lib/ipc';
import { Icon } from '../components/Icon';
import { BrandMark } from '../components/BrandMark';
import { Button, IconButton } from '../components/ui';

const QUICK_LINKS = [
  { label: 'DeepSeek', url: 'https://www.deepseek.com', icon: 'sparkles' },
  { label: 'GitHub', url: 'https://github.com', icon: 'git-branch' },
  { label: 'MDN', url: 'https://developer.mozilla.org', icon: 'braces' },
  { label: 'arXiv', url: 'https://arxiv.org', icon: 'telescope' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com', icon: 'activity' },
  { label: 'ACP spec', url: 'https://agentclientprotocol.com', icon: 'plug' },
];

let counter = 0;
const newTab = (url = ''): BrowserTab => ({
  id: `tab_${Date.now().toString(36)}_${counter++}`,
  url,
  title: url ? 'Loading…' : 'New tab',
  loading: false,
  canGoBack: false,
  canGoForward: false,
  createdAt: new Date().toISOString(),
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return String(bytes);
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'K';
  return (bytes / 1024 / 1024).toFixed(1) + 'M';
}

export function BrowserSurface({ params }: { params: Record<string, string> }): JSX.Element {
  const t = useT();
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [newTab(params.url ?? '')]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [address, setAddress] = useState(params.url ?? '');
  const [homeOpen, setHomeOpen] = useState(!params.url);
  const [mode, setMode] = useState<'central' | 'dweb'>(() =>
    params.mode === 'dweb' || localStorage.getItem('neuro.browser.mode') === 'dweb' ? 'dweb' : 'central',
  );
  const [gateway, setGateway] = useState('');
  const [webStats, setWebStats] = useState<WebStats | null>(null);
  const [webSites, setWebSites] = useState<SiteManifest[]>([]);
  const navigate = useAppStore((s) => s.navigate);
  const webviews = useRef(new Map<string, Electron.WebviewTag>());
  const ready = useRef(new Set<string>());
  const pendingUrl = useRef(new Map<string, string>());
  const activeRef = useRef(activeId);
  const homeRef = useRef(homeOpen);

  useEffect(() => {
    homeRef.current = homeOpen;
  }, [homeOpen]);

  useEffect(() => {
    void invoke('web.gateway', undefined)
      .then((result) => setGateway(result.gateway))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('neuro.browser.mode', mode);
    if (mode !== 'dweb') return;
    const load = (): void => {
      void invoke('web.status', undefined).then(setWebStats).catch(() => {});
      void invoke('web.list', undefined).then(setWebSites).catch(() => {});
    };
    load();
    const dispose = on('web:event', (event) => {
      if (event.stats) setWebStats(event.stats);
      load();
    });
    return () => dispose();
  }, [mode]);
  activeRef.current = activeId;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const patchTab = (id: string, patch: Partial<BrowserTab>): void => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  };

  const resolveInput = (input: string): string => {
    if (mode === 'dweb') {
      const raw = input.trim();
      if (raw && !/^https?:\/\//i.test(raw) && !raw.startsWith('about:')) {
        const [hostPart, ...rest] = raw.split('/');
        const domain = hostPart.replace(/\.neuro$/i, '').toLowerCase();
        if (/^[a-z0-9-]{2,40}$/.test(domain) && gateway) return `${gateway}/dweb/${domain}/${rest.join('/')}`;
      }
    }
    return ensureHttp(input);
  };

  const go = (input: string, tabId = activeId): void => {
    const url = resolveInput(input);
    if (!url) return;
    setHomeOpen(false);
    patchTab(tabId, { url, loading: true, title: url });
    setAddress(url);
    const view = webviews.current.get(tabId);
    if (view && ready.current.has(tabId)) {
      void view.loadURL(url).catch(() => {});
    } else {
      pendingUrl.current.set(tabId, url);
    }
  };

  useEffect(() => {
    if (params.url) go(params.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url]);

  const attachWebview = (tabId: string): ((element: Electron.WebviewTag | null) => void) => (element) => {
    if (!element) {
      webviews.current.delete(tabId);
      ready.current.delete(tabId);
      return;
    }
    if (webviews.current.get(tabId) === element) return;
    webviews.current.set(tabId, element);
    element.setAttribute('allowpopups', 'false');

    const navigateSync = (): void => {
      patchTab(tabId, {
        canGoBack: element.canGoBack(),
        canGoForward: element.canGoForward(),
        url: element.getURL(),
      });
    };

    element.addEventListener('dom-ready', () => {
      ready.current.add(tabId);
      const pending = pendingUrl.current.get(tabId);
      if (pending) {
        pendingUrl.current.delete(tabId);
        void element.loadURL(pending).catch(() => {});
      }
      navigateSync();
    });
    element.addEventListener('did-start-loading', () => patchTab(tabId, { loading: true }));
    element.addEventListener('did-stop-loading', () => {
      if (!ready.current.has(tabId)) return;
      patchTab(tabId, { loading: false });
      navigateSync();
    });
    element.addEventListener('page-title-updated', (event) => {
      const title = (event as unknown as { title: string }).title;
      patchTab(tabId, { title });
    });
    element.addEventListener('did-navigate', (event) => {
      const url = (event as unknown as { url: string }).url;
      patchTab(tabId, { url, loading: false });
      if (tabId === activeRef.current && !homeRef.current) setAddress(url);
      if (ready.current.has(tabId)) navigateSync();
    });
    element.addEventListener('did-navigate-in-page', (event) => {
      const url = (event as unknown as { url: string }).url;
      patchTab(tabId, { url });
      if (tabId === activeRef.current) setAddress(url);
    });
    element.addEventListener('did-fail-load', (event) => {
      const detail = event as unknown as { errorDescription: string };
      if (detail?.errorDescription && !/ERR_ABORTED/.test(detail.errorDescription)) {
        patchTab(tabId, { loading: false, title: 'Failed to load' });
      }
    });
  };

  useEffect(() => {
    const view = webviews.current.get(activeId);
    if (!view || !ready.current.has(activeId)) return;
    try {
      setAddress(view.getURL() || '');
      patchTab(activeId, { canGoBack: view.canGoBack(), canGoForward: view.canGoForward() });
      view.focus();
    } catch {
      /* not ready yet */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return (
    <div className="browser">
      <div className="browser__bar">
        <div className="browser__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="browser__tab"
              data-active={tab.id === activeId}
              onClick={() => setActiveId(tab.id)}
            >
              <Icon name={tab.loading ? 'loader' : 'globe'} size={12} className={tab.loading ? 'spin' : ''} />
              <span className="truncate">{tab.title || 'New tab'}</span>
              <span
                className="browser__tabClose"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setTabs((current) => {
                    const next = current.filter((item) => item.id !== tab.id);
                    if (!next.length) return [newTab()];
                    if (activeId === tab.id) setActiveId(next[next.length - 1].id);
                    return next;
                  });
                }}
              >
                <Icon name="x" size={10} />
              </span>
            </button>
          ))}
          <IconButton
            icon="plus"
            label={t('browser.newTab')}
            onClick={() => {
              const tab = newTab();
              setTabs((current) => [...current, tab]);
              setActiveId(tab.id);
              setAddress('');
              setHomeOpen(true);
            }}
          />
        </div>
      </div>

      <div className="browser__nav">
        <IconButton
          icon="arrow-left"
          label="Back"
          disabled={!active?.canGoBack}
          onClick={() => {
            const view = webviews.current.get(activeId);
            if (view && ready.current.has(activeId)) {
              try {
                void view.goBack();
              } catch {
                /* not ready */
              }
            }
          }}
        />
        <IconButton
          icon="arrow-right"
          label="Forward"
          disabled={!active?.canGoForward}
          onClick={() => {
            const view = webviews.current.get(activeId);
            if (view && ready.current.has(activeId)) {
              try {
                void view.goForward();
              } catch {
                /* not ready */
              }
            }
          }}
        />
        <IconButton
          icon="refresh"
          label="Reload"
          onClick={() => {
            const view = webviews.current.get(activeId);
            if (view && ready.current.has(activeId)) {
              try {
                void view.reload();
              } catch {
                /* not ready */
              }
            }
          }}
        />
        <IconButton icon="home" label={t('browser.home')} onClick={() => { setHomeOpen(true); setAddress(''); }} />
        <div className="n-segmented browser__mode">
          <button type="button" data-active={mode === 'central'} onClick={() => setMode('central')} title="Central internet">
            <Icon name="globe" size={11} /> Web
          </button>
          <button type="button" data-active={mode === 'dweb'} onClick={() => { setMode('dweb'); setHomeOpen(true); setAddress(''); homeRef.current = true; }} title="Decentralized Neuro Web">
            <Icon name="network" size={11} /> Neuro Web
          </button>
        </div>
        <form
          className="browser__address"
          onSubmit={(event) => {
            event.preventDefault();
            go(address);
          }}
        >
          <Icon name={homeOpen ? 'search' : 'lock'} size={12} className="faint" />
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t('browser.address')} spellCheck={false} />
          {active?.loading ? (
            <span className="n-progress browser__loadbar">
              <span style={{ width: '60%' }} />
            </span>
          ) : null}
        </form>
        <IconButton
          icon="pin"
          label={t('anchor.pin')}
          onClick={() => {
            const settings = useAppStore.getState().settings;
            if (!settings || !active?.url) return;
            void useAppStore.getState().patchSettings({
              anchor: {
                ...settings.anchor,
                pins: [
                  ...settings.anchor.pins,
                  {
                    id: `pin_${Date.now()}`,
                    kind: 'link',
                    ref: active.url,
                    label: active.title.slice(0, 34) || active.url,
                    subtitle: 'link',
                    order: settings.anchor.pins.length,
                  },
                ],
              },
            });
          }}
        />
        <IconButton icon="external-link" label="Open in system browser" onClick={() => active?.url && void invoke('system.openExternal', { url: active.url })} />
      </div>

      <div className="browser__view">
        {homeOpen && mode === 'dweb' ? (
          <div className="browser__home dwebHome">
            <div className="browser__homeInner">
              <div className="dwebHome__badge">
                <Icon name="network" size={13} /> NEURO WEB · DECENTRALIZED
              </div>
              <h2 className="display browser__homeTitle">The internet, hosted by its users</h2>
              <p className="small muted" style={{ textAlign: 'center', maxWidth: 520 }}>
                Names resolve peer to peer. Every site below is served from a real machine — yours or another node's.
              </p>
              <div className="dwebHome__counters">
                <div><span>{webStats?.sites ?? 0}</span><label>sites</label></div>
                <div><span>{webStats?.online ?? 0}</span><label>peers online</label></div>
                <div><span>{webStats?.hits ?? 0}</span><label>visits served</label></div>
                <div><span>{formatSize(webStats?.bytes ?? 0)}</span><label>hosted</label></div>
              </div>
              <form
                className="browser__homeSearch"
                onSubmit={(event) => {
                  event.preventDefault();
                  go(address);
                }}
              >
                <Icon name="globe" size={15} className="faint" />
                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="my-site.neuro" spellCheck={false} />
                <Button type="submit" variant="primary" size="sm" icon="arrow-right">
                  Open
                </Button>
              </form>
              <div className="dwebHome__grid">
                {webSites.length ? (
                  webSites.slice(0, 8).map((site) => (
                    <button key={site.domain} type="button" className="dwebSite" onClick={() => go(`${site.domain}.neuro`)}>
                      <span className="dwebSite__icon"><Icon name="globe" size={15} /></span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="small strong truncate">{site.domain}.neuro</span>
                        <span className="tiny faint truncate">{site.title}</span>
                      </span>
                      <span className="n-badge n-badge--success">{site.files.length} files</span>
                    </button>
                  ))
                ) : (
                  <div className="dwebHome__empty">
                    <Icon name="network" size={22} className="faint" />
                    <div className="small strong">No .neuro sites on this node yet</div>
                    <div className="tiny faint">Publish one from your machine in a few seconds, or add a peer that hosts one.</div>
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <Button variant="soft" size="sm" icon="upload" onClick={() => navigate('sites')}>
                  Publish a site
                </Button>
                <Button variant="ghost" size="sm" icon="refresh" onClick={() => { setMode('central'); setHomeOpen(true); setAddress(''); }}>
                  Switch to the central internet
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {homeOpen && mode !== 'dweb' ? (
          <div className="browser__home">
            <div className="n-aurora" aria-hidden>
              <span />
              <span />
            </div>
            <div className="browser__homeInner">
              <BrandMark size={38} animated />
              <h2 className="display browser__homeTitle">Neuro Browser</h2>
              <p className="small muted" style={{ textAlign: 'center', maxWidth: 460 }}>
                A real Chromium surface with its own partition. The agent can drive it with <code>browser.open</code> and read
                pages with <code>browser.read</code>.
              </p>
              <form
                className="browser__homeSearch"
                onSubmit={(event) => {
                  event.preventDefault();
                  go(address);
                }}
              >
                <Icon name="search" size={15} className="faint" />
                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t('browser.address')} autoFocus />
                <Button type="submit" variant="primary" size="sm" icon="arrow-right">
                  Go
                </Button>
              </form>
              <div className="browser__quick">
                {QUICK_LINKS.map((link) => (
                  <button key={link.label} type="button" className="browser__quickItem" onClick={() => go(link.url)}>
                    <span className="browser__quickIcon">
                      <Icon name={link.icon} size={16} />
                    </span>
                    <span className="small">{link.label}</span>
                    <span className="tiny faint mono truncate">{new URL(link.url).hostname}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {tabs.map((tab) => (
          <webview
            key={tab.id}
            ref={attachWebview(tab.id)}
            src={tab.url || 'about:blank'}
            partition="persist:neuro-browser"
            style={{ display: !homeOpen && tab.id === activeId ? 'flex' : 'none' }}
            className="browser__frame"
          />
        ))}
      </div>

      <div className="browser__status">
        <span className="row" style={{ gap: 6 }}>
          <span className={`n-dot ${active?.loading ? 'n-dot--warn' : 'n-dot--online'}`} />
          <span className="tiny">{active?.loading ? 'Loading' : 'Ready'}</span>
        </span>
        <span className="n-chip tiny">{mode === 'dweb' ? 'neuro web' : 'central'}</span>
        <span className="grow" />
        <span className="tiny faint mono truncate" style={{ maxWidth: 460 }}>{active?.url || (mode === 'dweb' ? 'neuro://dweb' : 'neuro://start')}</span>
      </div>
    </div>
  );
}
