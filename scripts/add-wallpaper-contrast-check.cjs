const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-39'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-39', 'ui', 'photo wallpapers stay readable on the light theme', async () => {",
  "    await call('settings.patch', { theme: { design: 'ubuntu', mode: 'light', surface: 'white', wallpaper: 'photo:blue-marble' } });",
  '    await wait(900);',
  "    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });",
  '    await wait(700);',
  "    const info = await win.webContents.executeJavaScript(\`(() => {",
  "      const label = document.querySelector('.desktopIcon__label');",
  "      const style = label ? getComputedStyle(label) : null;",
  "      const bg = getComputedStyle(document.querySelector('.desktop')).backgroundImage;",
  "      return { color: style?.color ?? '', labelBg: style?.backgroundColor ?? '', darkScrim: bg.includes('rgba(4, 6, 12') || bg.includes('rgba(5, 6, 11') };",
  "    })()\`);",
  "    await shot('wallpaper-light');",
  "    await call('settings.patch', { theme: { design: 'neuro', mode: 'dark', wallpaper: 'nebula' } });",
  "    if (info.color !== 'rgb(255, 255, 255)') throw new Error('icon label not white on photo: ' + JSON.stringify(info));",
  "    if (!info.labelBg.includes('0.62') && !info.labelBg.includes('0.6')) throw new Error('label chip missing: ' + JSON.stringify(info));",
  "    if (!info.darkScrim) throw new Error('missing dark scrim on light photo: ' + JSON.stringify(info));",
  "    return { evidence: 'label #fff on rgba(7,9,15,.62), dark scrim active' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-39 added');
