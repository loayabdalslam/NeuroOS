const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("'D-38'")) {
  console.log('already');
  process.exit(0);
}
const block = [
  "  await check('D-38', 'ui', 'login terminal runs the ACP sign-in command', async () => {",
  "    kernel.emit('ui:navigate', { surface: 'terminal', params: { command: 'echo ACP_LOGIN_TEST' } });",
  '    await wait(1800);',
  "    const sessions = await call('terminal.list', undefined);",
  "    const active = sessions[sessions.length - 1];",
  "    const buffer = active ? await call('terminal.buffer', { id: active.id }) : { data: '' };",
  "    await shot('login-terminal');",
  "    if (!active) throw new Error('no terminal session');",
  "    if (!buffer.data.includes('ACP_LOGIN_TEST')) throw new Error('command was not typed into the terminal');",
  "    return { evidence: 'typed into ' + active.shell + '; buffer has ACP_LOGIN_TEST' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');
c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('D-38 added');
