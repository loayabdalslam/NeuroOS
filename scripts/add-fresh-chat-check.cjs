const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-40'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-40', 'ui', 'a brand-new conversation can send immediately', async () => {",
  "    await call('providers.save', {",
  "      id: 'ui-fresh', name: 'Fresh ACP', kind: 'acp', baseUrl: '', apiKey: '', enabled: true,",
  "      models: [{ id: 'acp:auto', label: 'Agent default', supportsTools: true }], defaultModel: 'acp:auto',",
  "      createdAt: new Date().toISOString(), color: '#14b8a6',",
  "      acp: { command: 'node', args: [path.join(process.cwd(), 'scripts', 'mock-acp-agent.cjs')], cwd: process.cwd() },",
  '    });',
  "    kernel.emit('ui:navigate', { surface: 'chat', params: {} });",
  '    await wait(800);',
  "    await win.webContents.executeJavaScript(\"document.querySelector('button[aria-label=\\\"New chat\\\"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    await wait(600);',
  "    await win.webContents.executeJavaScript(\`(() => { const area = document.querySelector('.composer__input'); if (!area) return false; const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; setter.call(area, 'hello fresh'); area.dispatchEvent(new Event('input', { bubbles: true })); return true; })()\`);",
  "    await win.webContents.executeJavaScript(\"document.querySelector('.composer__send')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\");",
  '    let live = false;',
  "    let content = '';",
  '    const deadline = Date.now() + 25_000;',
  '    while (Date.now() < deadline && !content) {',
  '      await wait(600);',
  "      const state = await win.webContents.executeJavaScript(\`(() => ({ live: Boolean(document.querySelector('.chat__live')), content: [...document.querySelectorAll('.msg--assistant .msg__bubble')].map((el) => el.innerText).join('').trim() }))()\`);",
  '      live = live || state.live;',
  '      content = state.content;',
  '    }',
  "    await shot('fresh-conversation-send');",
  "    await call('providers.remove', { id: 'ui-fresh' });",
  "    if (!live && !content) throw new Error('new conversation did not start a turn');",
  "    return { evidence: 'live=' + live + ' content=\"' + content.slice(0, 40) + '\"' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-40 added');
