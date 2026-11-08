const fs = require('fs');

// 1) Scope the photo-wallpaper overrides so themed wallpapers and light themes are not darkened
const p1 = 'src/renderer/src/styles/audit.css';
let a = fs.readFileSync(p1, 'utf8');
const oldBlock = `/* ambient wallpaper behind the shell */
.app__bg {
  background-image: linear-gradient(180deg, rgba(6, 7, 12, 0.55), rgba(6, 7, 12, 0.8)), var(--n-wallpaper-image, none) !important;
  background-size: cover !important;
  background-position: center !important;
  filter: blur(22px) brightness(0.6) saturate(1.15);
  transform: scale(1.06);
}

/* readable desktop hint over photo wallpapers */
.desktop__hintTitle { text-shadow: 0 2px 24px rgba(0,0,0,.85), 0 1px 4px rgba(0,0,0,.8); }
.desktop__hintBody { color: rgba(240,242,248,.92); text-shadow: 0 1px 12px rgba(0,0,0,.9); }
.desktop__hintChip { background: rgba(9,11,18,.72); border-color: rgba(255,255,255,.16); backdrop-filter: blur(12px); }
.desktopIcon__label { text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6); }`;
const newBlock = `/* photo wallpapers only — themed wallpapers keep their design gradients */
:root[data-wallpaper^='photo:'] .app__bg {
  background-image: linear-gradient(180deg, rgba(6, 7, 12, 0.35), rgba(6, 7, 12, 0.6)), var(--n-wallpaper-image, none) !important;
  background-size: cover !important;
  background-position: center !important;
  filter: blur(22px) brightness(0.75) saturate(1.1);
  transform: scale(1.06);
}
:root[data-theme='light'][data-wallpaper^='photo:'] .app__bg {
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.55)), var(--n-wallpaper-image, none) !important;
  filter: blur(22px) brightness(1) saturate(1.05);
}
:root[data-wallpaper^='photo:'] .desktop__hintTitle { text-shadow: 0 2px 24px rgba(0,0,0,.55), 0 1px 4px rgba(0,0,0,.5); }
:root[data-wallpaper^='photo:'] .desktop__hintChip { background: rgba(9,11,18,.55); border-color: rgba(255,255,255,.18); backdrop-filter: blur(12px); }
:root[data-theme='light'][data-wallpaper^='photo:'] .desktop__hintChip { background: rgba(255,255,255,.78); border-color: rgba(15,18,26,.12); color: var(--n-text); }
:root[data-wallpaper^='photo:'] .desktopIcon__label { text-shadow: 0 1px 6px rgba(0,0,0,.75); }`;
if (!a.includes(oldBlock)) console.log('audit block anchor missing');
a = a.replace(oldBlock, newBlock);
fs.writeFileSync(p1, a, 'utf8');
console.log('audit wallpaper scoped');

// 2) Desktop icon tiles: theme-aware accent contrast
const p2 = 'src/renderer/src/styles/os.css';
let o = fs.readFileSync(p2, 'utf8');
o = o.replace(
  `.desktopIcon__tile {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  border: 1px solid;
  background: var(--n-layer-1);
}`,
  `.desktopIcon__tile {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--tile-accent, var(--n-accent)) 34%, transparent);
  background: color-mix(in srgb, var(--tile-accent, var(--n-accent)) 14%, var(--n-layer-1));
}
.desktopIcon__glyph {
  color: var(--tile-accent, var(--n-accent));
}
:root[data-theme='light'] .desktopIcon__tile {
  background: color-mix(in srgb, var(--tile-accent, var(--n-accent)) 12%, #ffffff);
  border-color: color-mix(in srgb, var(--tile-accent, var(--n-accent)) 28%, transparent);
}
:root[data-theme='light'] .desktopIcon__glyph {
  color: color-mix(in srgb, var(--tile-accent, var(--n-accent)) 62%, #0f131a);
}`,
);
fs.writeFileSync(p2, o, 'utf8');
console.log('desktop tiles patched');

// 3) Desktop markup uses the CSS variables instead of a fixed inline colour
const p3 = 'src/renderer/src/surfaces/Desktop.tsx';
let d = fs.readFileSync(p3, 'utf8');
d = d.replace(
  `<span className="desktopIcon__tile" style={{ background: \`\${app.accent}22\`, borderColor: \`\${app.accent}44\` }}>
              <Icon name={app.icon} size={26} style={{ color: app.accent }} />`,
  `<span className="desktopIcon__tile" style={{ ['--tile-accent' as string]: app.accent }}>
              <Icon name={app.icon} size={26} className="desktopIcon__glyph" />`,
);
fs.writeFileSync(p3, d, 'utf8');
console.log('desktop markup patched', d.includes('--tile-accent'));

// 4) Light-theme dock glyph contrast
const p4 = 'src/renderer/src/styles/tokens.css';
let t = fs.readFileSync(p4, 'utf8');
if (!t.includes('.dock__item[data-active=\'true\'] .dock__icon')) {
  t += `\n:root[data-theme='light'] .dock__item[data-active='true'] .dock__icon { color: color-mix(in srgb, var(--dock-accent, var(--n-accent)) 58%, #10141b); }\n:root[data-theme='light'] .dock__item .dock__icon { color: var(--n-text-2); }\n`;
  fs.writeFileSync(p4, t, 'utf8');
  console.log('dock light contrast added');
}

// 5) Provider cards: stronger light-theme surfaces
const p5 = 'src/renderer/src/styles/settings.css';
let s = fs.readFileSync(p5, 'utf8');
if (!s.includes(':root[data-theme=\'light\'] .providerPick')) {
  s += `\n:root[data-theme='light'] .providerPick { background: #ffffff; border-color: rgba(15, 18, 26, 0.14); }
:root[data-theme='light'] .providerPick:hover { background: var(--n-accent-softer); border-color: var(--n-accent-line); }
:root[data-theme='light'] .providerPick__logo { background: rgba(15, 18, 26, 0.05); border-color: rgba(15, 18, 26, 0.1); color: var(--n-text-2); }
`;
  fs.writeFileSync(p5, s, 'utf8');
  console.log('provider light contrast added');
}

// 6) Provider icon fallbacks (ACP presets use brand "bot" which has no mark)
function patchIcons(file, patterns) {
  let c = fs.readFileSync(file, 'utf8');
  if (!c.includes('hasBrand')) {
    c = c.replace("import { BrandIcon } from '../components/BrandIcon';", "import { BrandIcon, hasBrand } from '../components/BrandIcon';");
  }
  for (const [from, to] of patterns) {
    if (!c.includes(from)) console.log('icon pattern missing in', file);
    c = c.replaceAll(from, to);
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log(file, 'icons patched');
}

patchIcons('src/renderer/src/surfaces/Settings.tsx', [
  [
    "<BrandIcon brand={preset.brand} size={22} />",
    "{hasBrand(preset.brand) ? <BrandIcon brand={preset.brand} size={22} /> : <Icon name=\"plug\" size={18} />}",
  ],
]);
patchIcons('src/renderer/src/onboarding/Onboarding.tsx', [
  [
    "<BrandIcon brand={item.brand} size={22} />",
    "{hasBrand(item.brand) ? <BrandIcon brand={item.brand} size={22} /> : <Icon name=\"plug\" size={18} />}",
  ],
]);
