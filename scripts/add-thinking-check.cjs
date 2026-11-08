const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-37'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-37', 'ui', 'thinking level and custom model id are selectable', async () => {",
  "    await call('providers.save', {",
  "      id: 'ui-think', name: 'Think Provider', kind: 'openai', baseUrl: 'http://127.0.0.1:9/v1', apiKey: '',",
  "      enabled: true, models: [{ id: 'think-model', label: 'Think Model', supportsTools: true }], defaultModel: 'think-model',",
  "      createdAt: new Date().toISOString(), color: '#f59e0b',",
  '    });',
  "    const session = await call('chat.create', { providerId: 'ui-think', model: 'think-model' });",
  "    kernel.emit('ui:navigate', { surface: 'chat', params: {} });",
  '    await wait(900);',
  "    await win.webContents.executeJavaScript(\"document.querySelectorAll('.composer__select')[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(500);',
  "    await win.webContents.executeJavaScript(\"(() => { const btn = [...document.querySelectorAll('.providerChoice')].find((el) => el.innerText.includes('High')); if (btn) btn.click(); return Boolean(btn); })()\");",
  '    await wait(700);',
  "    const thinkingText = await win.webContents.executeJavaScript(\"[...document.querySelectorAll('.composer__select')].map((el) => el.innerText.trim()).join(' | ')\");",
  "    await win.webContents.executeJavaScript(\"document.querySelectorAll('.composer__select')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(500);',
  "    const hasCustom = await win.webContents.executeJavaScript(\"Boolean(document.querySelector('.customModel input'))\");",
  "    await win.webContents.executeJavaScript(\"(() => { const input = document.querySelector('.customModel input'); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, 'custom-deployment'); input.dispatchEvent(new Event('input', { bubbles: true })); const use = [...document.querySelectorAll('button')].find((el) => el.innerText.trim() === 'Use'); if (use) use.click(); return true; })()\");",
  '    await wait(700);',
  "    const modelText = await win.webContents.executeJavaScript(\"[...document.querySelectorAll('.composer__select')].map((el) => el.innerText.trim()).join(' | ')\");",
  "    await shot('thinking-and-model');",
  "    await call('chat.delete', { id: session.id });",
  "    await call('providers.remove', { id: 'ui-think' });",
  "    if (!thinkingText.includes('High')) throw new Error('thinking level did not stick: ' + thinkingText);",
  "    if (!hasCustom) throw new Error('custom model input missing');",
  "    if (!modelText.includes('custom-deployment')) throw new Error('custom model id did not stick: ' + modelText);",
  "    return { evidence: thinkingText + ' · ' + modelText };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-37 added');
