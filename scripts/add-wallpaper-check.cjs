const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-33'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-33', 'ui', 'custom wallpaper applies from settings', async () => {",
  "    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY1nWQAAAABJRU5ErkJggg==', 'base64');",
  "    const dataUrl = 'data:image/png;base64,' + png.toString('base64');",
  "    await call('settings.patch', { theme: { customWallpaper: dataUrl, wallpaper: 'photo:custom' } });",
  '    await wait(700);',
  "    const probe = await win.webContents.executeJavaScript(\`(() => ({ wallpaper: document.documentElement.dataset.wallpaper, image: getComputedStyle(document.documentElement).getPropertyValue('--n-wallpaper-image').trim().slice(0, 30) }))()\`);",
  "    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });",
  '    await wait(500);',
  "    await shot('custom-wallpaper');",
  "    kernel.emit('ui:navigate', { surface: 'settings', params: {} });",
  '    await wait(600);',
  "    const hasUploader = await win.webContents.executeJavaScript(\"Boolean(document.querySelector('.customWallpaper'))\");",
  "    await call('settings.patch', { theme: { customWallpaper: '', wallpaper: 'nebula' } });",
  "    if (probe.wallpaper !== 'photo:custom' || !probe.image.includes('data:image/png')) throw new Error('custom wallpaper not applied: ' + JSON.stringify(probe));",
  "    if (!hasUploader) throw new Error('settings uploader missing');",
  "    return { evidence: 'desktop data-wallpaper=photo:custom, uploader present' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-33 added');
