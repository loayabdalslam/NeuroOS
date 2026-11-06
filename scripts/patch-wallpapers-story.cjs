const fs = require('fs');

function patch(file, pairs) {
  let c = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (!c.includes(from)) {
      console.log('MISS', file, from.slice(0, 50).replace(/\n/g, ' '));
      continue;
    }
    c = c.replace(from, to);
  }
  fs.writeFileSync(file, c, 'utf8');
}

// 1. themes: photo wallpapers
let t = fs.readFileSync('src/shared/themes.ts', 'utf8');
if (!t.includes('PHOTO_WALLPAPERS')) {
  t += `
export interface PhotoWallpaper {
  id: string;
  label: string;
  credit: string;
  file: string;
}

/**
 * Iconic, public-domain photography bundled with the app (NASA).
 * Attribution is kept in the UI and in resources/wallpapers/CREDITS.md.
 */
export const PHOTO_WALLPAPERS: PhotoWallpaper[] = [
  { id: 'blue-marble', label: 'Blue Marble', credit: 'NASA · Apollo 17, 1972 · public domain', file: 'blue-marble.png' },
  { id: 'earthrise', label: 'Earthrise', credit: 'NASA · Apollo 8, 1968 · public domain', file: 'earthrise.jpg' },
  { id: 'pale-blue-dot', label: 'Pale Blue Dot', credit: 'NASA/JPL · Voyager 1, 1990 · public domain', file: 'pale-blue-dot.jpg' },
  { id: 'pillars', label: 'Pillars of Creation', credit: 'NASA/ESA · Hubble, 2014 · public domain', file: 'pillars.jpg' },
  { id: 'milky-way', label: 'Milky Way', credit: 'NASA · public domain', file: 'milky-way.jpg' },
  { id: 'aurora', label: 'Aurora from orbit', credit: 'NASA · ISS · public domain', file: 'aurora.jpg' },
];

export const photoWallpaper = (id: string): PhotoWallpaper | undefined => PHOTO_WALLPAPERS.find((item) => item.id === id);

export const wallpaperUrl = (file: string): string => \`neuro://wallpapers/\${file}\`;
`;
  fs.writeFileSync('src/shared/themes.ts', t, 'utf8');
  console.log('themes patched');
}

// 2. App: story + wallpaper var
patch('src/renderer/src/App.tsx', [
  [
    "import { Onboarding } from './onboarding/Onboarding';",
    "import { Onboarding } from './onboarding/Onboarding';\nimport { StoryIntro } from './onboarding/StoryIntro';\nimport { photoWallpaper, wallpaperUrl } from '@shared/themes';",
  ],
  [
    '  const [systemDark, setSystemDark] = useState(() => window.matchMedia(\'(prefers-color-scheme: dark)\').matches);',
    `  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storySeen, setStorySeen] = useState(() => localStorage.getItem('neuro.story') === 'done');

  useEffect(() => {
    const open = (): void => setStoryOpen(true);
    window.addEventListener('neuro:story', open);
    return () => window.removeEventListener('neuro:story', open);
  }, []);`,
  ],
  [
    "    root.style.setProperty('--n-anchor-w', `${settings.anchor.width}px`);",
    `    root.style.setProperty('--n-anchor-w', \`\${settings.anchor.width}px\`);
    const photo = settings.theme.wallpaper.startsWith('photo:') ? photoWallpaper(settings.theme.wallpaper.slice(6)) : undefined;
    if (photo) root.style.setProperty('--n-wallpaper-image', \`url("\${wallpaperUrl(photo.file)}")\`);
    else root.style.removeProperty('--n-wallpaper-image');`,
  ],
  [
    `  if (!ready) return <Boot />;
  if (bootError) return <BootError message={bootError} />;

  if (settings && !settings.onboardingComplete) {`,
    `  if (!ready) return <Boot />;
  if (bootError) return <BootError message={bootError} />;

  if (storyOpen || (settings && !settings.onboardingComplete && !storySeen)) {
    return (
      <StoryIntro
        replay={storyOpen}
        onDone={() => {
          localStorage.setItem('neuro.story', 'done');
          setStorySeen(true);
          setStoryOpen(false);
          const pending = (window as unknown as { __storyDone?: () => void }).__storyDone;
          if (pending) pending();
        }}
      />
    );
  }

  if (settings && !settings.onboardingComplete) {`,
  ],
]);

// 3. Settings: photo wallpapers + replay
patch('src/renderer/src/surfaces/Settings.tsx', [
  ["import { THEME_PRESETS, WALLPAPERS } from '@shared/themes';", "import { PHOTO_WALLPAPERS, THEME_PRESETS, WALLPAPERS, wallpaperUrl } from '@shared/themes';"],
  [
    `            </Section>

            <Section title="Interface" description="Density, scale and surface treatment.">`,
    `            </Section>

            <Section title="Photography" description="Iconic public-domain imagery (NASA), bundled offline. Sets the desktop and shell backdrop.">
              <div className="photoWallpaperGrid">
                {PHOTO_WALLPAPERS.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="photoWallpaper"
                    data-active={settings.theme.wallpaper === \`photo:\${photo.id}\`}
                    onClick={() => update({ theme: { wallpaper: \`photo:\${photo.id}\` } })}
                  >
                    <img src={wallpaperUrl(photo.file)} alt={photo.label} loading="lazy" />
                    <span className="photoWallpaper__meta">
                      <strong>{photo.label}</strong>
                      <em>{photo.credit}</em>
                    </span>
                  </button>
                ))}
              </div>
              {settings.theme.wallpaper.startsWith('photo:') ? (
                <button type="button" className="photoWallpaperReset" onClick={() => update({ theme: { wallpaper: 'nebula' } })}>
                  Back to the design wallpaper
                </button>
              ) : null}
            </Section>

            <Section title="Interface" description="Density, scale and surface treatment.">`,
  ],
  [
    `<div className="row wrap" style={{ gap: 8 }}>
                <Button variant="outline" icon="folder-open" onClick={() => void invoke('app.openDataFolder', undefined)}>Open data folder</Button>`,
    `<div className="row wrap" style={{ gap: 8 }}>
                <Button variant="outline" icon="play" onClick={() => window.dispatchEvent(new CustomEvent('neuro:story'))}>Replay the intro</Button>
                <Button variant="outline" icon="folder-open" onClick={() => void invoke('app.openDataFolder', undefined)}>Open data folder</Button>`,
  ],
]);

// 4. story css import
patch('src/renderer/src/main.tsx', [["import './styles/brain.css';", "import './styles/brain.css';\nimport './styles/story.css';"]]);

// 5. selftest story capture
let idx = fs.readFileSync('src/main/index.ts', 'utf8');
if (!idx.includes('00-story')) {
  idx = idx.replace(
    "  await screenshot('01-onboarding');",
    `  await win.webContents.executeJavaScript(\`window.dispatchEvent(new CustomEvent('neuro:story'))\`).catch(() => {});
  await wait(1800);
  await screenshot('00-story');
  const storySkip = await win.webContents
    .executeJavaScript(\`(() => { const button = document.querySelector('.story__skipCorner'); if (!button) return 'missing'; button.click(); return 'clicked'; })()\`)
    .catch((error) => String(error));
  log.info('selftest', \`story intro: \${storySkip}\`);
  await wait(900);
  await screenshot('01-onboarding');`,
  );
  fs.writeFileSync('src/main/index.ts', idx, 'utf8');
  console.log('selftest story added');
}
