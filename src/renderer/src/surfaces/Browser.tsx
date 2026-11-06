import { useEffect, useRef, useState } from 'react';
import type { BrowserTab } from '@shared/types';
import { useAppStore } from '../state/store';
import { useT } from '../lib/i18n';
import { ensureHttp } from '../lib/util';
import { invoke } from '../lib/ipc';
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

export function BrowserSurface({ params }: { params: Record<string, string> }): JSX.Element {
  const t = useT();
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [newTab(params.url ?? '')]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [address, setAddress] = useState(params.url ?? '');
  const [homeOpen, setHomeOpen] = useState(!params.url);
  const webviews = useRef(new Map<string, Electron.WebviewTag>());
  const ready = useRef(new Set<string>());
  const pendingUrl = useRef(new Map<string, string>());
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const patchTab = (id: string, patch: Partial<BrowserTab>): void => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  };

  const go = (input: string, tabId = activeId): void => {
    const url = ensureHttp(input);
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
      if (tabId === activeRef.current) setAddress(url);
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
        {homeOpen ? (
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
        <span className="grow" />
        <span className="tiny faint mono truncate" style={{ maxWidth: 460 }}>{active?.url || 'neuro://start'}</span>
      </div>
    </div>
  );
}
