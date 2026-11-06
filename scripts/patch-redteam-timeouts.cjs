const fs = require('fs');
const p = 'src/main/redteam.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace("import { Paths } from './core/store';", "import { Paths } from './core/store';\nimport { log } from './core/ipc';");

c = c.replace(
  ") => checks.push({ id, area, severity, title, pass, evidence, risk });",
  `) => {
  checks.push({ id, area, severity, title, pass, evidence, risk });
  log.info('redteam', \`\${pass ? 'PASS' : 'FAIL'} \${id} \${title}\`);
};`,
);

c = c.replace(
  "    body: typeof payload === 'string' ? payload : JSON.stringify(payload),",
  "    body: typeof payload === 'string' ? payload : JSON.stringify(payload),\n    signal: AbortSignal.timeout(10000),",
);

c = c.replace(
  "const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { headers: { connection: 'close' } });",
  "const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { headers: { connection: 'close' }, signal: AbortSignal.timeout(10000) });",
);

c = c.replace(
  'export async function runRedTeam(): Promise<RedCheck[]> {',
  `export async function runRedTeam(): Promise<RedCheck[]> {
  const watchdog = setTimeout(() => {
    log.error('redteam', 'watchdog fired');
    fs.writeFileSync('redteam-partial.json', JSON.stringify(checks, null, 2), 'utf8');
    app.exit(2);
  }, 120000);
  watchdog.unref();`,
);

c = c.replace('  return checks;\n}', '  clearTimeout(watchdog);\n  return checks;\n}');

fs.writeFileSync(p, c, 'utf8');
console.log('patched', c.includes('watchdog fired'), c.includes('AbortSignal.timeout(10000)'));
