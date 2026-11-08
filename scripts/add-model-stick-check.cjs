const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-35'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-35', 'ui', 'selecting a model creates/updates the conversation', async () => {",
  "    await call('providers.save', {",
  "      id: 'ui-modelpick', name: 'Model Pick', kind: 'openai', baseUrl: 'http://127.0.0.1:9/v1', apiKey: '',",
  "      enabled: true, models: [{ id: 'pick-me', label: 'Pick Me', supportsTools: true }], defaultModel: 'pick-me',",
  "      createdAt: new Date().toISOString(), color: '#22c55e',",
  '    });',
  "    kernel.emit('ui:navigate', { surface: 'chat', params: {} });",
  '    await wait(900);',
  "    await win.webContents.executeJavaScript(\"document.querySelectorAll('.composer__select')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(500);',
  "    await win.webContents.executeJavaScript(\"document.querySelector('.providerChoice')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(800);',
  "    const info = await win.webContents.executeJavaScript(\"(() => ({ pill: [...document.querySelectorAll('.composer__select')].map((el) => el.innerText.trim()).join(' | '), header: document.querySelector('.chat__sub')?.innerText ?? '', modelMenus: document.querySelectorAll('.providerChoice').length }))()\");",
  "    await shot('model-selected');",
  "    await call('providers.remove', { id: 'ui-modelpick' });",
  "    if (!info.header.includes('pick-me') && !info.pill.includes('Pick Me')) throw new Error('model did not stick: ' + JSON.stringify(info));",
  "    return { evidence: 'pill=' + info.pill + ' header=' + info.header.replace(/\\n/g, ' ') };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-35 added');
