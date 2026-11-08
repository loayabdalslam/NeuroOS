const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-32'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-32', 'ui', 'provider and tool-model pickers plus image attachments', async () => {",
  "    await call('providers.save', {",
  "      id: 'ui-provider', name: 'UI Provider', kind: 'openai', baseUrl: 'http://127.0.0.1:9/v1', apiKey: '',",
  "      enabled: true, models: [{ id: 'ui-model', label: 'UI Model', supportsTools: true }], defaultModel: 'ui-model',",
  "      createdAt: new Date().toISOString(), color: '#5686fe',",
  '    });',
  "    kernel.emit('ui:navigate', { surface: 'chat', params: {} });",
  '    await wait(700);',
  "    await win.webContents.executeJavaScript(\"document.querySelectorAll('.composer__select')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(500);',
  "    const providersShown = await win.webContents.executeJavaScript(\"document.querySelectorAll('.providerChoice').length\");",
  "    await shot('composer-providers');",
  "    await win.webContents.executeJavaScript(\"window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))\");",
  '    await wait(400);',
  "    await win.webContents.executeJavaScript(\"document.querySelectorAll('.composer__select')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(500);',
  "    const modelDialog = await win.webContents.executeJavaScript(\"document.body.innerText.includes('Models with tool calling')\");",
  "    await shot('composer-models');",
  "    await win.webContents.executeJavaScript(\"window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))\");",
  "    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY1nWQAAAABJRU5ErkJggg==', 'base64');",
  "    const imagePath = path.join(root, 'pixel.png');",
  '    await fs.writeFile(imagePath, png);',
  "    const image = await call('system.readDataUrl', { path: imagePath });",
  "    await call('providers.remove', { id: 'ui-provider' });",
  "    if (!providersShown) throw new Error('provider modal showed no providers');",
  '    if (!modelDialog) throw new Error("tool-model modal did not open");',
  "    if (!String(image.dataUrl).startsWith('data:image/png;base64,')) throw new Error('image read failed');",
  "    return { evidence: providersShown + ' providers, tool-model dialog, image ' + image.size + 'B' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-32 added');
