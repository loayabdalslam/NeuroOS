const fs = require('fs');

function patch(file, pairs, imports) {
  let c = fs.readFileSync(file, 'utf8');
  if (imports && !c.includes(imports.needle)) {
    c = c.replace(imports.anchor, imports.anchor + '\n' + imports.needle);
  }
  for (const [from, to] of pairs) {
    if (!c.includes(from)) {
      console.log('MISS', file, '::', from.slice(0, 55).replace(/\n/g, ' '));
      continue;
    }
    c = c.replace(from, to);
  }
  fs.writeFileSync(file, c, 'utf8');
}

/* ---------------- Onboarding: live language switch ---------------- */
patch('src/renderer/src/onboarding/Onboarding.tsx', [
  [
    "  const [locale, setLocale] = useState('en');",
    `  const [locale, setLocale] = useState('en');

  const applyLocale = (code: string): void => {
    setLocale(code);
    const state = useAppStore.getState();
    const current = state.settings;
    if (!current || current.locale === code) return;
    // optimistic so the whole onboarding flips language + direction instantly
    state.setSettings({ ...current, locale: code });
    void invoke('settings.patch', { locale: code }).catch(() => {});
  };`,
  ],
  ['onClick={() => setLocale(item.code)}', 'onClick={() => applyLocale(item.code)}'],
]);

/* ---------------- Story intro ---------------- */
patch(
  'src/renderer/src/onboarding/StoryIntro.tsx',
  [
    ["import { BrandMark } from '../components/BrandMark';", "import { BrandMark } from '../components/BrandMark';\nimport { useT } from '../lib/i18n';"],
    ['export function StoryIntro({ onDone, replay = false }: { onDone: () => void; replay?: boolean }): JSX.Element {', 'export function StoryIntro({ onDone, replay = false }: { onDone: () => void; replay?: boolean }): JSX.Element {\n  const t = useT();'],
    ['<span>NEURO OS · القصة</span>', "<span>{t('story.eyebrow')}</span>"],
    [
      `            من فكرةٍ في الخامس من نوفمبر
            <br />
            إلى نظام تشغيل كامل`,
      "            {t('story.title')}",
    ],
    ['              ابدأ الرحلة', "              {t('story.start')}"],
    ['              تخطّي القصة', "              {t('story.skip')}"],
    ['        تخطّي\n      </button>', "        {t('story.skip')}\n      </button>"],
    ['<span className="story__dateLabel">نوفمبر · يوم الاستيقاظ</span>', "<span className=\"story__dateLabel\">{t('story.date')}</span>"],
    [
      "{replay ? 'إعادة تشغيل القصة' : 'حكاية تُرسم بالكود'} · Esc للتخطي",
      "{replay ? t('story.replay') : t('story.hint')}",
    ],
    ['<span className="story__nameSub">{TITLE_LINES[1]}</span>', "<span className=\"story__nameSub\">{t('story.son')}</span>"],
  ],
  { anchor: "import { BrandMark } from '../components/BrandMark';", needle: "import { useT } from '../lib/i18n';" },
);

/* ---------------- Welcome motion ---------------- */
patch(
  'src/renderer/src/onboarding/WelcomeMotion.tsx',
  [
    ["import { BrandMark } from '../components/BrandMark';", "import { BrandMark } from '../components/BrandMark';\nimport { useT } from '../lib/i18n';"],
    ['export function WelcomeTicker(): JSX.Element {\n  const [index, setIndex] = useState(0);', "export function WelcomeTicker(): JSX.Element {\n  const t = useT();\n  const [index, setIndex] = useState(0);"],
    ['const feature = FEATURES[index];', 'const feature = FEATURES[index];\n  const title = t(`welcome.f${index + 1}t`);\n  const body = t(`welcome.f${index + 1}b`);'],
    ['<div className="wmTicker__title">{feature.title}</div>', '<div className="wmTicker__title">{title}</div>'],
    ['<div className="wmTicker__body">{feature.body}</div>', '<div className="wmTicker__body">{body}</div>'],
    ['<div className="wmTicker__card" key={feature.title}>', '<div className="wmTicker__card" key={title}>'],
    ['key={feature.title}', 'key={title}'],
    ['aria-label={feature.title}', 'aria-label={title}'],
    ['<span className="wmTicker__trait">\n            <Icon name="check" size={10} /> {trait}', '<span className="wmTicker__trait">\n            <Icon name="check" size={10} /> {t(`welcome.t${TRAITS.indexOf(trait) + 1}`)}'],
    ['export function WelcomePanel(): JSX.Element {\n  const tools = useAppStore((s) => s.tools.length);', "export function WelcomePanel(): JSX.Element {\n  const t = useT();\n  const tools = useAppStore((s) => s.tools.length);"],
    ['<span className="n-badge n-badge--accent">system map</span>', "<span className=\"n-badge n-badge--accent\">{t('welcome.map')}</span>"],
    ['<span className="tiny faint mono">14 surfaces · live</span>', "<span className=\"tiny faint mono\">{t('welcome.live', { count: apps.length })}</span>"],
    ['<span className="tiny faint uppercase">surfaces</span>', "<span className=\"tiny faint uppercase\">{t('welcome.s1')}</span>"],
    ['<span className="tiny faint uppercase">tools</span>', "<span className=\"tiny faint uppercase\">{t('welcome.s2')}</span>"],
    ['<span className="tiny faint uppercase">providers</span>', "<span className=\"tiny faint uppercase\">{t('welcome.s3')}</span>"],
    ['<span className="tiny faint uppercase">languages</span>', "<span className=\"tiny faint uppercase\">{t('welcome.s4')}</span>"],
    ['{cap.label === \'tools\' ? `${tools || 50} tools` : cap.label}', '{cap.key === \'c2\' ? `${tools || 50} ${t(\'welcome.c2\')}` : t(`welcome.${cap.key}`)}'],
  ],
  { anchor: "import { BrandMark } from '../components/BrandMark';", needle: "import { useT } from '../lib/i18n';" },
);

/* ---------------- Settings photography ---------------- */
patch('src/renderer/src/surfaces/Settings.tsx', [
  ['<Section title="Photography" description="Iconic public-domain imagery (NASA), bundled offline. Sets the desktop and shell backdrop.">', "<Section title={t('settings.photography')} description={t('settings.photographyHint')}>"],
  ['                  Back to the design wallpaper', "                  {t('settings.wallpaperReset')}"],
]);

/* ---------------- Brain header + tabs ---------------- */
patch(
  'src/renderer/src/surfaces/Brain.tsx',
  [
    ["import { relativeTime } from '../lib/format';", "import { relativeTime } from '../lib/format';\nimport { useT } from '../lib/i18n';"],
    ['export function BrainSurface(): JSX.Element {\n  const pushToast = useAppStore((s) => s.pushToast);', "export function BrainSurface(): JSX.Element {\n  const t = useT();\n  const pushToast = useAppStore((s) => s.pushToast);"],
    ['<span className="brain__title">Graph Brain</span>', "<span className=\"brain__title\">{t('brain.title')}</span>"],
    ['<span className="n-badge n-badge--accent">local memory</span>', "<span className=\"n-badge n-badge--accent\">{t('brain.local')}</span>"],
    ['<div className="tiny faint">Every action becomes a node. Every click is remembered, locally.</div>', "<div className=\"tiny faint\">{t('brain.tagline')}</div>"],
    ['<span className="tiny faint">{stats?.recording ? \'recording\' : \'paused\'}</span>', "<span className=\"tiny faint\">{stats?.recording ? t('brain.recording') : t('brain.paused')}</span>"],
    ['<Stat label="nodes" value={stats?.nodes ?? 0} />\n            <Stat label="edges" value={stats?.edges ?? 0} />\n            <Stat label="events" value={stats?.events ?? 0} />\n            <Stat label="today" value={stats?.today ?? 0} />', "<Stat label={t('brain.nodes')} value={stats?.nodes ?? 0} />\n            <Stat label={t('brain.edges')} value={stats?.edges ?? 0} />\n            <Stat label={t('brain.events')} value={stats?.events ?? 0} />\n            <Stat label={t('brain.today')} value={stats?.today ?? 0} />"],
    ['              Wipe', "              {t('brain.wipe')}"],
    ['{item}\n            </button>', "{t(`brain.tab.${item}`)}\n            </button>"],
    ['<div className="small strong">Ask your brain</div>', "<div className=\"small strong\">{t('brain.askTitle')}</div>"],
    ['<div className="tiny faint">Search the graph and get an answer from what this device remembers.</div>', "<div className=\"tiny faint\">{t('brain.askHint')}</div>"],
    ['{asking ? <Spinner size={13} /> : null} Recall', "{asking ? <Spinner size={13} /> : null} {t('brain.recall')}"],
    ['<div className="tiny faint uppercase">Teach a durable memory</div>', "<div className=\"tiny faint uppercase\">{t('brain.teach')}</div>"],
    ['                    Remember', "                    {t('brain.remember')}"],
    ['<div className="small strong">Select a node</div>', "<div className=\"small strong\">{t('brain.select')}</div>"],
    ['<div className="tiny faint">Click any dot to inspect what the brain knows about it, its relations, and to forget it.</div>', "<div className=\"tiny faint\">{t('brain.selectBody')}</div>"],
    ['<div className="brain__sectionTitle">Relations</div>', "<div className=\"brain__sectionTitle\">{t('brain.relations')}</div>"],
    ['<span className="tiny faint">Everything is stored in <span className="mono">state/brain.json</span> on this device. Nothing is uploaded.</span>', "<span className=\"tiny faint\">{t('brain.privacy')}</span>"],
  ],
  { anchor: "import { relativeTime } from '../lib/format';", needle: "import { useT } from '../lib/i18n';" },
);

/* ---------------- Sites header + counters ---------------- */
patch(
  'src/renderer/src/surfaces/Sites.tsx',
  [
    ["import { relativeTime } from '../lib/format';", "import { relativeTime } from '../lib/format';\nimport { useT } from '../lib/i18n';"],
    ['export function SitesSurface(): JSX.Element {\n  const pushToast', "export function SitesSurface(): JSX.Element {\n  const t = useT();\n  const pushToast"],
    ['<span className="sites__title">Neuro Web</span>', "<span className=\"sites__title\">{t('sites.title')}</span>"],
    ['<span className="n-badge n-badge--accent">decentralized</span>', "<span className=\"n-badge n-badge--accent\">{t('sites.decentralized')}</span>"],
    ['Host a site from this machine, or replicate one from a peer. Names resolve through the mesh — no registry, no hosting bill.', "{t('sites.tagline')}"],
    ['<Counter label="Sites hosted"', "<Counter label={t('sites.c1')}"],
    ['<Counter label="Peers online"', "<Counter label={t('sites.c2')}"],
    ['<Counter label="Visits served"', "<Counter label={t('sites.c3')}"],
    ['<Counter label="Content"', "<Counter label={t('sites.c4')}"],
    ['<span className="small strong">Publish a site</span>', "<span className=\"small strong\">{t('sites.publish')}</span>"],
    ['<span className="small strong">My sites</span>', "<span className=\"small strong\">{t('sites.mySites')}</span>"],
    ['<span className="small strong">Peers</span>', "<span className=\"small strong\">{t('sites.peers')}</span>"],
    ['{busy === \'publish\' || busy === \'drop\' ? <Spinner size={13} /> : null} Publish to the mesh', "{busy === 'publish' || busy === 'drop' ? <Spinner size={13} /> : null} {t('sites.publishMesh')}"],
    ['{busy === \'folder\' ? <Spinner size={13} /> : null} Publish a local folder', "{busy === 'folder' ? <Spinner size={13} /> : null} {t('sites.publishFolder')}"],
    ['                      Open\n', "                      {t('sites.open')}\n"],
    ['title="No sites yet"', "title={t('sites.empty')}"],
    ['body="Publish your first .neuro site from the panel on the left. It becomes reachable to peers immediately."', "body={t('sites.emptyBody')}"],
  ],
  { anchor: "import { relativeTime } from '../lib/format';", needle: "import { useT } from '../lib/i18n';" },
);

/* ---------------- Composio header ---------------- */
patch(
  'src/renderer/src/surfaces/ComposioPanel.tsx',
  [
    ["import { invoke } from '../lib/ipc';", "import { invoke } from '../lib/ipc';\nimport { useT } from '../lib/i18n';"],
    ['export function ComposioPanel(): JSX.Element {\n  const pushToast', "export function ComposioPanel(): JSX.Element {\n  const t = useT();\n  const pushToast"],
    ['<span className={`n-badge ${status.configured ? \'n-badge--success\' : \'\'}`}>{status.configured ? \'connected\' : \'not configured\'}</span>', "<span className={`n-badge ${status.configured ? 'n-badge--success' : ''}`}>{status.configured ? t('composio.connected') : t('composio.notConfigured')}</span>"],
    ['One connection layer for 100+ real tools — Gmail, GitHub, Slack, Notion, Linear, Jira, Sheets, HubSpot and more.\n            Enabled actions become first-class Neuro tools the agent can call, and the whole catalog is reachable through\n            <code> composio.search</code> + <code> composio.execute</code>.', "{t('composio.tagline')}"],
    ['{busy === \'sync\' ? <Spinner size={12} /> : null} Sync catalog', "{busy === 'sync' ? <Spinner size={12} /> : null} {t('composio.sync')}"],
    ['              API key\n', "              {t('composio.apiKey')}\n"],
    ['{busy === \'accounts\' ? <Spinner size={12} /> : null} Refresh accounts', "{busy === 'accounts' ? <Spinner size={12} /> : null} {t('composio.refresh')}"],
    ['                Toolkits · {toolkits.length}', "                {t('composio.toolkits')} · {toolkits.length}"],
    ['                Actions · {tools.length}', "                {t('composio.actions')} · {tools.length}"],
  ],
  { anchor: "import { invoke } from '../lib/ipc';", needle: "import { useT } from '../lib/i18n';" },
);
