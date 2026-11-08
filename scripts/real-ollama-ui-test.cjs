const fs = require('fs');

let p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `    await call('providers.save', {
      id: 'ui-fresh', name: 'Fresh ACP', kind: 'acp', baseUrl: '', apiKey: '', enabled: true,
      models: [{ id: 'acp:auto', label: 'Agent default', supportsTools: true }], defaultModel: 'acp:auto',
      createdAt: new Date().toISOString(), color: '#14b8a6',
      acp: { command: 'node', args: [path.join(process.cwd(), 'scripts', 'mock-acp-agent.cjs')], cwd: process.cwd() },
    });`,
  `    await call('providers.save', {
      id: 'ui-fresh', name: 'Fresh Ollama', kind: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true,
      models: [{ id: 'gemma3:1b', label: 'gemma3:1b', supportsTools: true }], defaultModel: 'gemma3:1b',
      createdAt: new Date().toISOString(), color: '#22c55e',
    });`,
);
c = c.replace(
  `    while (Date.now() < deadline && !content) {
      await wait(600);
      const state = await win.webContents.executeJavaScript(\`(() => ({ live: Boolean(document.querySelector('.chat__live')), content: [...document.querySelectorAll('.msg--assistant .msg__bubble')].map((el) => el.innerText).join('').trim() }))()\`);
      live = live || state.live;
      content = state.content;
    }`,
  `    while (Date.now() < deadline && !content) {
      await wait(600);
      const state = await win.webContents.executeJavaScript(\`(() => ({ live: Boolean(document.querySelector('.chat__live')), content: [...document.querySelectorAll('.msg--assistant .msg__bubble')].map((el) => el.innerText).join('').trim() }))()\`);
      live = live || state.live;
      if (state.content && state.content !== 'Thinking') content = state.content;
    }`,
);
c = c.replace(
  "    if (!live && !content) throw new Error('new conversation did not start a turn');",
  "    if (!content) throw new Error('new conversation did not stream an answer (live=' + live + ')');",
);
fs.writeFileSync(p, c, 'utf8');

p = 'src/main/qa.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replaceAll("loaiabdalslam/gemma-700m-it-racore:latest", 'gemma3:1b');
c = c.replaceAll("label: 'gemma-700m'", "label: 'gemma3:1b'");
fs.writeFileSync(p, c, 'utf8');
console.log('D-40 now uses real Ollama; OLL-01 uses gemma3:1b');
