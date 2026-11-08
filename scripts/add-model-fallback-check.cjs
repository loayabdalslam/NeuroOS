const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-34'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-34', 'ui', 'model picker falls back to all models when none declare tools', async () => {",
  "    await call('providers.save', {",
  "      id: 'ui-notools', name: 'Chat Only', kind: 'openai', baseUrl: 'http://127.0.0.1:9/v1', apiKey: '',",
  "      enabled: true, models: [{ id: 'chat-only', label: 'Chat Only Model', supportsTools: false }], defaultModel: 'chat-only',",
  "      createdAt: new Date().toISOString(), color: '#a78bfa',",
  '    });',
  "    kernel.emit('ui:navigate', { surface: 'chat', params: {} });",
  '    await wait(800);',
  "    await win.webContents.executeJavaScript(\"document.querySelectorAll('.composer__select')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(500);',
  "    const info = await win.webContents.executeJavaScript(\"(() => ({ choices: document.querySelectorAll('.providerChoice').length, text: document.body.innerText.includes('Chat Only Model') }))()\");",
  "    await shot('composer-model-fallback');",
  "    await win.webContents.executeJavaScript(\"window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))\");",
  "    await call('providers.remove', { id: 'ui-notools' });",
  "    if (!info.choices || !info.text) throw new Error('fallback model list missing: ' + JSON.stringify(info));",
  "    return { evidence: info.choices + ' models listed (supportsTools=false fallback)' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-34 added');
