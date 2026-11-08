const fs = require('fs');

// 1) Theme type
let p = 'src/shared/types.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `  fontScale: number;
  wallpaper: string;
  motion: MotionLevel;`,
  `  fontScale: number;
  wallpaper: string;
  /** data: URL of a user-supplied wallpaper (overrides wallpaper presets). */
  customWallpaper?: string;
  motion: MotionLevel;`,
);
fs.writeFileSync(p, c, 'utf8');

// 2) Apply custom wallpaper in App
p = 'src/renderer/src/App.tsx';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "    root.dataset.wallpaper = settings.theme.wallpaper;",
  "    const customWallpaper = settings.theme.customWallpaper;\n    root.dataset.wallpaper = customWallpaper ? 'photo:custom' : settings.theme.wallpaper;",
);
c = c.replace(
  `    const photo = settings.theme.wallpaper.startsWith('photo:') ? photoWallpaper(settings.theme.wallpaper.slice(6)) : undefined;
    if (photo) root.style.setProperty('--n-wallpaper-image', \`url("\${wallpaperUrl(photo.file)}")\`);
    else root.style.removeProperty('--n-wallpaper-image');`,
  `    const photo = !customWallpaper && settings.theme.wallpaper.startsWith('photo:') ? photoWallpaper(settings.theme.wallpaper.slice(6)) : undefined;
    if (customWallpaper) root.style.setProperty('--n-wallpaper-image', \`url("\${customWallpaper}")\`);
    else if (photo) root.style.setProperty('--n-wallpaper-image', \`url("\${wallpaperUrl(photo.file)}")\`);
    else root.style.removeProperty('--n-wallpaper-image');`,
);
fs.writeFileSync(p, c, 'utf8');

// 3) Settings: upload/remove custom wallpaper and clear it when a preset is picked
p = 'src/renderer/src/surfaces/Settings.tsx';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('uploadWallpaper')) {
  c = c.replace(
    "  const update = async (patch: DeepPartial<Settings>): Promise<void> => {",
    `  const uploadWallpaper = async (): Promise<void> => {
    const picked = await invoke('system.pickFiles', { multiple: false });
    const path = picked.paths[0];
    if (!path) return;
    try {
      const image = await invoke('system.readDataUrl', { path });
      await update({ theme: { customWallpaper: image.dataUrl, wallpaper: 'photo:custom' } });
    } catch (error) {
      window.alert((error as Error).message);
    }
  };

  const update = async (patch: DeepPartial<Settings>): Promise<void> => {`,
  );
  c = c.replace(
    '                <div className="photoWallpaperGrid">',
    `                <div className="customWallpaper">
                  <span className="customWallpaper__preview">
                    {settings.theme.customWallpaper ? (
                      <img src={settings.theme.customWallpaper} alt="Custom wallpaper" />
                    ) : (
                      <Icon name="image" size={18} />
                    )}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong">Your wallpaper</div>
                    <div className="tiny faint">PNG, JPEG, WebP or GIF · up to 8 MB. Applied to the desktop and shell.</div>
                  </div>
                  <Button variant="soft" size="sm" icon="upload" onClick={() => void uploadWallpaper()}>
                    Upload
                  </Button>
                  {settings.theme.customWallpaper ? (
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => void update({ theme: { customWallpaper: '', wallpaper: 'nebula' } })}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="photoWallpaperGrid">`,
  );
  // clear custom when choosing a photo/wallpaper/theme preset
  c = c.replaceAll(
    "onClick={() => update({ theme: { wallpaper: `photo:${photo.id}` } })}",
    "onClick={() => update({ theme: { wallpaper: `photo:${photo.id}`, customWallpaper: '' } })}",
  );
  c = c.replace(
    "onClick={() => update({ theme: { wallpaper: wallpaper.id } })}",
    "onClick={() => update({ theme: { wallpaper: wallpaper.id, customWallpaper: '' } })}",
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('custom wallpaper UI added');
}

// 4) styles
p = 'src/renderer/src/styles/settings.css';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('.customWallpaper {')) {
  c += `\n.customWallpaper { display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px solid var(--n-line); border-radius: 12px; background: var(--n-layer-1); margin-bottom: 10px; }\n.customWallpaper__preview { width: 54px; height: 40px; border-radius: 8px; overflow: hidden; display: grid; place-items: center; background: var(--n-layer-2); border: 1px solid var(--n-line); flex: none; color: var(--n-text-4); }\n.customWallpaper__preview img { width: 100%; height: 100%; object-fit: cover; display: block; }\n`;
  fs.writeFileSync(p, c, 'utf8');
  console.log('custom wallpaper css added');
}
