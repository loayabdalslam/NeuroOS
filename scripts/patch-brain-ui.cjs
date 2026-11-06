const fs = require('fs');

function patch(file, pairs) {
  let c = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (!c.includes(from)) {
      console.log('missing anchor in', file, '::', from.slice(0, 60));
      continue;
    }
    c = c.replace(from, to);
  }
  fs.writeFileSync(file, c, 'utf8');
}

// css import
patch('src/renderer/src/main.tsx', [["import './styles/sites.css';", "import './styles/sites.css';\nimport './styles/brain.css';"]]);

// surface kind
patch('src/shared/types.ts', [["  | 'sites'", "  | 'sites'\n  | 'brain'"]]);

// apps
let apps = fs.readFileSync('src/shared/apps.ts', 'utf8');
if (!apps.includes("id: 'brain'")) {
  const insert = `  {
    id: 'brain',
    name: 'Brain',
    icon: 'brain',
    accent: '#ec4899',
    surface: 'brain',
    description: 'The memory graph: every action, every click, remembered',
    width: 1180,
    height: 760,
    minWidth: 820,
    minHeight: 520,
  },
`;
  apps = apps.replace("  {\n    id: 'spaces',", insert + "  {\n    id: 'spaces',");
  fs.writeFileSync('src/shared/apps.ts', apps, 'utf8');
  console.log('brain app added');
}

// meta + order
let meta = fs.readFileSync('src/renderer/src/surfaces/meta.ts', 'utf8');
if (!meta.includes("brain:")) {
  meta = meta.replace(
    "  composer: { icon: 'boxes', labelKey: 'nav.composer', accent: '#a78bfa' },",
    "  composer: { icon: 'boxes', labelKey: 'nav.composer', accent: '#a78bfa' },\n  brain: { icon: 'brain', labelKey: 'nav.brain', accent: '#ec4899' },",
  );
  meta = meta.replace("  'composer',", "  'composer',\n  'brain',");
  fs.writeFileSync('src/renderer/src/surfaces/meta.ts', meta, 'utf8');
  console.log('brain meta added');
}

// App surface
let app = fs.readFileSync('src/renderer/src/App.tsx', 'utf8');
if (!app.includes('BrainSurface')) {
  app = app.replace("import { SitesSurface } from './surfaces/Sites';", "import { SitesSurface } from './surfaces/Sites';\nimport { BrainSurface } from './surfaces/Brain';");
  app = app.replace("    case 'sites':\n      return <SitesSurface />;", "    case 'sites':\n      return <SitesSurface />;\n    case 'brain':\n      return <BrainSurface />;");
  fs.writeFileSync('src/renderer/src/App.tsx', app, 'utf8');
  console.log('brain surface added');
}

// AppContent
let ac = fs.readFileSync('src/renderer/src/components/AppContent.tsx', 'utf8');
if (!ac.includes('BrainSurface')) {
  ac = ac.replace("import { SitesSurface } from '../surfaces/Sites';", "import { SitesSurface } from '../surfaces/Sites';\nimport { BrainSurface } from '../surfaces/Brain';");
  ac = ac.replace("    case 'sites':\n      return <SitesSurface />;", "    case 'sites':\n      return <SitesSurface />;\n    case 'brain':\n      return <BrainSurface />;");
  fs.writeFileSync('src/renderer/src/components/AppContent.tsx', ac, 'utf8');
  console.log('brain appcontent added');
}

// i18n
let i = fs.readFileSync('src/shared/i18n.ts', 'utf8');
if (!i.includes("'nav.brain'")) {
  i = i.replace("  'nav.composer': 'Composer',", "  'nav.composer': 'Composer',\n  'nav.brain': 'Brain',");
  i = i.replace("  'nav.composer': 'التركيب',", "  'nav.composer': 'التركيب',\n  'nav.brain': 'العقل',");
  fs.writeFileSync('src/shared/i18n.ts', i, 'utf8');
  console.log('brain i18n added');
}

// palette
let cp = fs.readFileSync('src/renderer/src/components/CommandPalette.tsx', 'utf8');
if (!cp.includes('nav-brain')) {
  cp = cp.replace(
    "      { id: 'nav-sites', group: 'Navigate',",
    "      { id: 'nav-brain', group: 'Navigate', label: t('nav.brain'), icon: iconForSurface('brain'), run: nav('brain') },\n      { id: 'nav-sites', group: 'Navigate',",
  );
  fs.writeFileSync('src/renderer/src/components/CommandPalette.tsx', cp, 'utf8');
  console.log('brain palette added');
}
