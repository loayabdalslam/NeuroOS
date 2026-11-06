const fs = require('fs');
const p = 'src/renderer/src/surfaces/Browser.tsx';
let c = fs.readFileSync(p, 'utf8');

if (c.includes('dwebHome')) {
  console.log('browser already patched');
  process.exit(0);
}

// imports
c = c.replace("import type { BrowserTab } from '@shared/types';", "import type { BrowserTab, SiteManifest, WebStats } from '@shared/types';");
c = c.replace("import { invoke } from '../lib/ipc';", "import { invoke, on } from '../lib/ipc';");

// state
c = c.replace(
  "  const [homeOpen, setHomeOpen] = useState(!params.url);",
  `  const [homeOpen, setHomeOpen] = useState(!params.url);
  const [mode, setMode] = useState<'central' | 'dweb'>(() =>
    params.mode === 'dweb' || localStorage.getItem('neuro.browser.mode') === 'dweb' ? 'dweb' : 'central',
  );
  const [gateway, setGateway] = useState('');
  const [webStats, setWebStats] = useState<WebStats | null>(null);
  const [webSites, setWebSites] = useState<SiteManifest[]>([]);
  const navigate = useAppStore((s) => s.navigate);`,
);

// effects (after refs)
c = c.replace(
  "  const activeRef = useRef(activeId);",
  `  const activeRef = useRef(activeId);

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
  }, [mode]);`,
);

// go resolver
c = c.replace(
  "  const go = (input: string, tabId = activeId): void => {\n    const url = ensureHttp(input);",
  `  const resolveInput = (input: string): string => {
    if (mode === 'dweb') {
      const raw = input.trim();
      if (raw && !/^https?:\\/\\//i.test(raw) && !raw.startsWith('about:')) {
        const [hostPart, ...rest] = raw.split('/');
        const domain = hostPart.replace(/\\.neuro$/i, '').toLowerCase();
        if (/^[a-z0-9-]{2,40}$/.test(domain) && gateway) return \`\${gateway}/dweb/\${domain}/\${rest.join('/')}\`;
      }
    }
    return ensureHttp(input);
  };

  const go = (input: string, tabId = activeId): void => {
    const url = resolveInput(input);`,
);

// toolbar mode switch
c = c.replace(
  '        <IconButton icon="home" label={t(\'browser.home\')} onClick={() => { setHomeOpen(true); setAddress(\'\'); }} />',
  `        <IconButton icon="home" label={t('browser.home')} onClick={() => { setHomeOpen(true); setAddress(''); }} />
        <div className="n-segmented browser__mode">
          <button type="button" data-active={mode === 'central'} onClick={() => setMode('central')} title="Central internet">
            <Icon name="globe" size={11} /> Web
          </button>
          <button type="button" data-active={mode === 'dweb'} onClick={() => { setMode('dweb'); setHomeOpen(true); setAddress(''); }} title="Decentralized Neuro Web">
            <Icon name="network" size={11} /> Neuro Web
          </button>
        </div>`,
);

// dweb home before the central home
const dwebHome = `        {homeOpen && mode === 'dweb' ? (
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
                <div><span>{((webStats?.bytes ?? 0) / 1024 / 1024).toFixed(1)}</span><label>MB hosted</label></div>
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
                    <button key={site.domain} type="button" className="dwebSite" onClick={() => go(\`\${site.domain}.neuro\`)}>
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

`;
c = c.replace('        {homeOpen ? (', dwebHome + '        {homeOpen && mode !== \'dweb\' ? (');

// status bar mode
c = c.replace(
  "        <span className=\"grow\" />\n        <span className=\"tiny faint mono truncate\" style={{ maxWidth: 460 }}>{active?.url || 'neuro://start'}</span>",
  "        <span className=\"n-chip tiny\">{mode === 'dweb' ? 'neuro web' : 'central'}</span>\n        <span className=\"grow\" />\n        <span className=\"tiny faint mono truncate\" style={{ maxWidth: 460 }}>{active?.url || (mode === 'dweb' ? 'neuro://dweb' : 'neuro://start')}</span>",
);

fs.writeFileSync(p, c, 'utf8');
console.log('browser patched');
