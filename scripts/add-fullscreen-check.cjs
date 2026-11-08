const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-41'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-41', 'ui', 'F11 fullscreen toggle IPC', async () => {",
  "    const first = await call('window.toggleFullscreen');",
  '    await wait(700);',
  "    const second = await call('window.toggleFullscreen');",
  '    await wait(500);',
  "    if (!first.fullscreen) throw new Error('did not enter fullscreen: ' + JSON.stringify(first));",
  "    if (second.fullscreen) throw new Error('did not leave fullscreen: ' + JSON.stringify(second));",
  "    return { evidence: 'entered fullscreen, then restored' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-41 added');
