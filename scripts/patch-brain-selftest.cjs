const fs = require('fs');

// mail -> brain
let k = fs.readFileSync('src/main/kernel.ts', 'utf8');
if (!k.includes("kind: 'mail'")) {
  k = k.replace(
    "      if (event.kind === 'message' && event.message?.direction === 'in') automation?.notifyMail(event.message);",
    `      if (event.kind === 'message' && event.message?.direction === 'in') automation?.notifyMail(event.message);
      if (event.kind === 'message' && event.message) {
        brain.capture([
          {
            kind: 'mail',
            label: event.message.from.address,
            detail: event.message.subject,
            surface: 'mail',
            app: 'mail',
            tags: ['mail', event.message.direction],
          },
        ]);
      }`,
  );
  fs.writeFileSync('src/main/kernel.ts', k, 'utf8');
  console.log('mail capture added');
}

// selftest
let c = fs.readFileSync('src/main/index.ts', 'utf8');
if (c.includes('brain recall')) {
  console.log('brain selftest exists');
  process.exit(0);
}

const brainTest = `  /* ------------------------------- brain ----------------------------------- */
  const seed: { kind: string; label: string; surface?: string; app?: string; detail?: string; tags?: string[] }[] = [
    { kind: 'app', label: 'chat', surface: 'chat', app: 'chat' },
    { kind: 'chat', label: 'Asked Neuro: summarise my mail', surface: 'chat', app: 'chat', detail: 'summarise my mail', tags: ['mail'] },
    { kind: 'chat', label: 'Asked Neuro: build a workflow', surface: 'chat', app: 'chat', detail: 'build a workflow', tags: ['automation'] },
    { kind: 'navigate', label: 'Settings page', surface: 'settings', app: 'settings' },
    { kind: 'click', label: 'Appearance', surface: 'settings', app: 'settings' },
    { kind: 'click', label: 'Providers', surface: 'settings', app: 'settings' },
    { kind: 'navigate', label: 'Mail page', surface: 'mail', app: 'mail' },
    { kind: 'mail', label: 'ada@selftest.neuro', surface: 'mail', app: 'mail', detail: 'Welcome to the mesh', tags: ['mail'] },
    { kind: 'mail', label: 'youssef@selftest.neuro', surface: 'mail', app: 'mail', detail: 'Re: mesh', tags: ['mail'] },
    { kind: 'navigate', label: 'Sites page', surface: 'sites', app: 'sites' },
    { kind: 'site', label: 'selftest.neuro', surface: 'sites', app: 'sites', detail: 'Selftest site', tags: ['site'] },
    { kind: 'click', label: 'Publish to the mesh', surface: 'sites', app: 'sites' },
    { kind: 'navigate', label: 'Automation page', surface: 'automation', app: 'automation' },
    { kind: 'workflow', label: 'Selftest pipeline', surface: 'automation', app: 'automation', detail: 'manual run' },
    { kind: 'navigate', label: 'Terminal page', surface: 'terminal', app: 'terminal' },
    { kind: 'tool', label: 'shell.exec', surface: 'terminal', app: 'terminal', detail: 'echo neuro-tool-bus' },
    { kind: 'navigate', label: 'Workspace page', surface: 'workspace', app: 'workspace' },
    { kind: 'click', label: 'Save file', surface: 'workspace', app: 'workspace' },
    { kind: 'memory', label: 'Prefers concise answers', detail: 'Prefers concise answers with no filler', tags: ['memory', 'preference'] },
    { kind: 'query', label: 'Asked memory: what did I do with mail', surface: 'brain', app: 'brain', detail: 'what did I do with mail' },
  ];
  kernel.brain.capture(seed);
  await win.webContents.executeJavaScript(\`document.querySelector('.dock__collapse')?.click()\`).catch(() => {});
  await wait(2200);
  await win.webContents.executeJavaScript(\`document.querySelector('.dock__collapse')?.click()\`).catch(() => {});
  const brainStats = kernel.brain.stats();
  const brainHits = kernel.brain.recall('settings', 5);
  const brainAnswer = kernel.brain.ask('mail');
  log.info(
    'selftest',
    \`brain: nodes=\${brainStats.nodes} edges=\${brainStats.edges} events=\${brainStats.events} indexed=\${brainStats.indexed} recall=\${brainHits.length} top="\${brainHits[0]?.node.label ?? '-'}" ask="\${brainAnswer.text.slice(0, 52).replace(/\\n/g, ' ')}"\`,
  );

`;
c = c.replace('  const surfaces: [string, string, Record<string, string>?][] = [', brainTest + '  const surfaces: [string, string, Record<string, string>?][] = [');
c = c.replace("    ['23-neuroweb', 'browser', { mode: 'dweb' }],", "    ['23-neuroweb', 'browser', { mode: 'dweb' }],\n    ['25-brain', 'brain'],");
fs.writeFileSync('src/main/index.ts', c, 'utf8');
console.log('brain selftest added');
