const fs = require('fs');

function edit(file, pairs) {
  let c = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (!c.includes(from)) {
      console.log('MISS', file, from.slice(0, 60).replace(/\n/g, ' '));
      continue;
    }
    c = c.replace(from, to);
    n += 1;
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log(file, n, '/', pairs.length);
}

// 1. normalize surface aliases at the single navigation entry
edit('src/renderer/src/App.tsx', [
  [
    "on('ui:navigate', ({ surface, params }) => useAppStore.getState().navigate(surface as SurfaceKind, params)),",
    `on('ui:navigate', ({ surface, params }) => {
      const aliases: Record<string, SurfaceKind> = { spaces: 'space', files: 'workspace', overview: 'desktop' };
      useAppStore.getState().navigate((aliases[surface] ?? surface) as SurfaceKind, params);
    }),`,
  ],
]);

// 2. defensive metadata fallbacks
edit('src/renderer/src/surfaces/meta.ts', [
  [
    "export const SURFACE_ORDER: SurfaceKind[] = [",
    `export const surfaceMeta = (surface: string): SurfaceMeta => SURFACES[surface as SurfaceKind] ?? SURFACES.desktop;

export const SURFACE_ORDER: SurfaceKind[] = [`,
  ],
]);

edit('src/renderer/src/components/Dock.tsx', [
  ["import { SURFACES, SURFACE_ORDER } from '../surfaces/meta';", "import { SURFACES, SURFACE_ORDER, surfaceMeta } from '../surfaces/meta';"],
  ['const meta = SURFACES[surface];', 'const meta = surfaceMeta(surface);'],
]);

edit('src/renderer/src/components/Taskbar.tsx', [
  ["import { SURFACES } from '../surfaces/meta';", "import { surfaceMeta } from '../surfaces/meta';"],
  ['const meta = SURFACES[surface as keyof typeof SURFACES];', 'const meta = surfaceMeta(surface);'],
]);

edit('src/renderer/src/components/TitleBar.tsx', [
  ["import { SURFACES } from '../surfaces/meta';", "import { surfaceMeta } from '../surfaces/meta';"],
  ['const meta = SURFACES[page.surface];', 'const meta = surfaceMeta(page.surface);'],
]);

edit('src/renderer/src/surfaces/Overview.tsx', [
  ["import { SURFACES } from './meta';", "import { surfaceMeta } from './meta';"],
  ['<span className="desk__launchIcon" style={{ color: SURFACES[surface].accent }}>', '<span className="desk__launchIcon" style={{ color: surfaceMeta(surface).accent }}>'],
  ['<Icon name={SURFACES[surface].icon} size={17} />', '<Icon name={surfaceMeta(surface).icon} size={17} />'],
  ['<span className="tiny">{t(SURFACES[surface].labelKey)}</span>', '<span className="tiny">{t(surfaceMeta(surface).labelKey)}</span>'],
]);

// 3. deep suite: real surface key, alias check, palette on window
let d = fs.readFileSync('src/main/deepqa.ts', 'utf8');
d = d.replace(
  "const surfaces = ['desktop', 'chat', 'workspace', 'terminal', 'browser', 'notebook', 'mail', 'automation', 'composer', 'spaces', 'brain', 'sites', 'marketplace', 'settings'];",
  "const surfaces = ['desktop', 'chat', 'workspace', 'terminal', 'browser', 'notebook', 'mail', 'automation', 'composer', 'space', 'brain', 'sites', 'marketplace', 'settings'];",
);
d = d.replace("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))", "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))");
d = d.replace("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))", "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
fs.writeFileSync('src/main/deepqa.ts', d, 'utf8');
console.log('deepqa updated');
