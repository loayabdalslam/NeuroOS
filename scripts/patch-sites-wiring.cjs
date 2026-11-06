const fs = require('fs');

// types union
let t = fs.readFileSync('src/shared/types.ts', 'utf8');
if (!t.includes("| 'sites'")) {
  t = t.replace("  | 'browser'", "  | 'browser'\n  | 'sites'");
  fs.writeFileSync('src/shared/types.ts', t, 'utf8');
  console.log('surface kind added');
}

// apps registry
let a = fs.readFileSync('src/shared/apps.ts', 'utf8');
if (!a.includes("id: 'sites'")) {
  const browserBlockStart = a.indexOf("  {\n    id: 'browser',");
  const insert = `  {
    id: 'sites',
    name: 'Sites',
    icon: 'network',
    accent: '#14b8a6',
    surface: 'sites',
    description: 'Host a site from this machine on the decentralized web',
    width: 1120,
    height: 760,
    minWidth: 780,
    minHeight: 520,
  },
`;
  a = a.slice(0, browserBlockStart) + insert + a.slice(browserBlockStart);
  fs.writeFileSync('src/shared/apps.ts', a, 'utf8');
  console.log('app added');
}

// meta
let m = fs.readFileSync('src/renderer/src/surfaces/meta.ts', 'utf8');
if (!m.includes("sites:")) {
  m = m.replace(
    "  browser: { icon: 'globe', labelKey: 'nav.browser', accent: '#14b8a6' },",
    "  browser: { icon: 'globe', labelKey: 'nav.browser', accent: '#14b8a6' },\n  sites: { icon: 'network', labelKey: 'nav.sites', accent: '#14b8a6' },",
  );
  m = m.replace("  'browser',", "  'browser',\n  'sites',");
  fs.writeFileSync('src/renderer/src/surfaces/meta.ts', m, 'utf8');
  console.log('meta added');
}

// App surface host + import
let app = fs.readFileSync('src/renderer/src/App.tsx', 'utf8');
if (!app.includes('SitesSurface')) {
  app = app.replace("import { BrowserSurface } from './surfaces/Browser';", "import { BrowserSurface } from './surfaces/Browser';\nimport { SitesSurface } from './surfaces/Sites';");
  app = app.replace("    case 'browser':\n      return <BrowserSurface params={page.params} />;", "    case 'browser':\n      return <BrowserSurface params={page.params} />;\n    case 'sites':\n      return <SitesSurface />;");
  fs.writeFileSync('src/renderer/src/App.tsx', app, 'utf8');
  console.log('app surface added');
}

// AppContent
let ac = fs.readFileSync('src/renderer/src/components/AppContent.tsx', 'utf8');
if (!ac.includes('SitesSurface')) {
  ac = ac.replace("import { BrowserSurface } from '../surfaces/Browser';", "import { BrowserSurface } from '../surfaces/Browser';\nimport { SitesSurface } from '../surfaces/Sites';");
  ac = ac.replace("    case 'browser':\n      return <BrowserSurface params={{}} />;", "    case 'browser':\n      return <BrowserSurface params={{}} />;\n    case 'sites':\n      return <SitesSurface />;");
  fs.writeFileSync('src/renderer/src/components/AppContent.tsx', ac, 'utf8');
  console.log('appcontent added');
}

// i18n label
let i = fs.readFileSync('src/shared/i18n.ts', 'utf8');
if (!i.includes("'nav.sites'")) {
  i = i.replace("  'nav.browser': 'Browser',", "  'nav.browser': 'Browser',\n  'nav.sites': 'Sites',");
  i = i.replace("  'nav.browser': 'المتصفح',", "  'nav.browser': 'المتصفح',\n  'nav.sites': 'المواقع',");
  fs.writeFileSync('src/shared/i18n.ts', i, 'utf8');
  console.log('i18n added');
}

// Command palette entry
let cp = fs.readFileSync('src/renderer/src/components/CommandPalette.tsx', 'utf8');
if (!cp.includes('nav-sites')) {
  cp = cp.replace(
    "      { id: 'nav-terminal', group: 'Navigate',",
    "      { id: 'nav-sites', group: 'Navigate', label: t('nav.sites'), icon: iconForSurface('sites'), run: nav('sites') },\n      { id: 'nav-terminal', group: 'Navigate',",
  );
  fs.writeFileSync('src/renderer/src/components/CommandPalette.tsx', cp, 'utf8');
  console.log('palette added');
}
