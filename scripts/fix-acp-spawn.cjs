const fs = require('fs');
const p = 'src/main/services/providers/acpClient.ts';
let c = fs.readFileSync(p, 'utf8');
const from = `    const child = spawn(command, args, {
      cwd,
      env: { ...(process.env as Record<string, string>), ...(env ?? {}), ELECTRON_RUN_AS_NODE: undefined as unknown as string },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
    });`;
const to = `    // Windows: .cmd/.ps1 shims and bare command names need a shell, but real
    // executables must be spawned directly. When a shell is used, quote any
    // argument containing spaces — Node concatenates them unescaped.
    const useShell =
      process.platform === 'win32' &&
      (!path.extname(command) || /\\.(cmd|bat|ps1)$/i.test(command));
    const spawnArgs = useShell ? args.map((arg) => (/\\s/.test(arg) ? \`"\${arg}"\` : arg)) : args;
    const child = spawn(command, spawnArgs, {
      cwd,
      env: { ...(process.env as Record<string, string>), ...(env ?? {}), ELECTRON_RUN_AS_NODE: undefined as unknown as string },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: useShell,
    });`;
if (!c.includes(from)) {
  console.log('spawn anchor missing');
} else {
  c = c.replace(from, to);
  fs.writeFileSync(p, c, 'utf8');
  console.log('ACP spawn fixed');
}
