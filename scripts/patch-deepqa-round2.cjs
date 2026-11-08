const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');

// imports for the peer mail test
c = c.replace(
  "import { log } from './core/ipc';",
  "import { log } from './core/ipc';\nimport { MailService } from './services/mail.service';",
);

function replaceBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`start not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`end not found for ${startMarker}`);
  return source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

// D-09 terminal
c = replaceBlock(
  c,
  "  await check('D-09'",
  "  });",
  `  await check('D-09', 'terminal', 'spawn PTY, run a command, read buffer, resize, kill', async () => {
    const info = await call('terminal.create', { cols: 100, rows: 30, cwd: root });
    await wait(900);
    await call('terminal.write', { id: info.id, data: 'echo DEEP_TERMINAL_OK\\r\\n' });
    await wait(2600);
    let buffer = await call('terminal.buffer', { id: info.id });
    if (!buffer.data.includes('DEEP_TERMINAL_OK')) {
      await call('terminal.write', { id: info.id, data: 'echo DEEP_TERMINAL_OK\\r\\n' });
      await wait(1800);
      buffer = await call('terminal.buffer', { id: info.id });
    }
    await call('terminal.resize', { id: info.id, cols: 120, rows: 40 });
    await call('terminal.kill', { id: info.id });
    if (!buffer.data.includes('DEEP_TERMINAL_OK')) throw new Error(\`output not found; tail: \${JSON.stringify(buffer.data.slice(-160))}\`);
    return { evidence: \`\${buffer.data.length} buffer chars, resize + kill ok\` };
  });`,
);

// D-10 mail via a real second node
c = replaceBlock(
  c,
  "  await check('D-10'",
  "  });",
  `  await check('D-10', 'mail', 'peer-to-peer send, receive, read and delete', async () => {
    const vaultMap = new Map<string, string>();
    const peer = new MailService({
      dataFile: path.join(root, 'peer-mail.json'),
      vault: { get: (key: string) => vaultMap.get(key) ?? '', set: (key: string, value: string) => void vaultMap.set(key, value), remove: (key: string) => void vaultMap.delete(key) },
      discovery: false,
      secretPrefix: 'peer',
    });
    await peer.start();
    await peer.createIdentity('QA Peer');
    try {
      const peerStatus = peer.status();
      const peerAddress = peerStatus.identity?.address;
      if (!peerAddress) throw new Error('peer identity missing');
      await call('mail.peerAdd', { host: '127.0.0.1', port: peerStatus.port });
      const sent = await call('mail.send', { to: peerAddress, subject: \`Deep \${marker}\`, body: \`body \${marker}\`, encrypt: true });
      if (!sent.ok) throw new Error(sent.message ?? 'send failed');
      let received: any = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await wait(400);
        received = peer.messages('inbox', 50).find((message: any) => message.subject === \`Deep \${marker}\`);
        if (received) break;
      }
      if (!received) throw new Error('peer never received the encrypted message');
      if (received.body !== \`body \${marker}\`) throw new Error('decrypted body mismatch');
      if (!received.encrypted) throw new Error('message was not encrypted');
      await call('mail.peerRemove', { nodeId: peerStatus.identity!.nodeId });
      return { evidence: \`encrypted \${addressOf(peerStatus)} delivery, subject/body decrypted, peer removed\` };
    } finally {
      await peer.dispose();
    }
  });`,
);

// helper used by the mail evidence
c = c.replace(
  'const wait = (ms: number): Promise<void> =>',
  'const addressOf = (status: any): string => status.identity?.address ?? "peer";\n\nconst wait = (ms: number): Promise<void> =>',
);

// D-11 automation: deterministic workflow (no provider needed)
c = replaceBlock(
  c,
  "  await check('D-11'",
  "  });",
  `  await check('D-11', 'automation', 'save a workflow, run it, inspect steps and remove it', async () => {
    const now = new Date().toISOString();
    const workflow: any = {
      id: \`flow_\${crypto.randomBytes(4).toString('hex')}\`,
      name: \`Deep flow \${marker}\`,
      description: 'qa',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      nodes: [
        { id: 'n1', type: 'trigger.manual', name: 'Run', x: 0, y: 0, config: {} },
        { id: 'n2', type: 'transform.code', name: 'Set value', x: 200, y: 0, config: { code: 'return "DEEP_AUTOMATION_OK";' } },
      ],
      edges: [{ id: 'e1', from: 'n1', fromPort: 'main', to: 'n2' }],
    };
    await call('automation.save', workflow);
    const run = await call('automation.run', { id: workflow.id });
    let finished: any = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(400);
      const runs = await call('automation.runs', { workflowId: workflow.id });
      finished = runs.find((item: any) => item.id === run.runId);
      if (finished && ['ok', 'error', 'cancelled'].includes(finished.status)) break;
    }
    await call('automation.remove', { id: workflow.id });
    if (!finished) throw new Error('run never appeared');
    if (finished.status !== 'ok') throw new Error(\`status \${finished.status}: \${JSON.stringify(finished.steps ?? [])}\`);
    return { evidence: \`\${finished.steps?.length ?? 0} steps, \${finished.durationMs ?? "?"}ms, output \${String(finished.steps?.[0]?.output ?? '').slice(0, 60)}\` };
  });`,
);

// brain answer field
c = c.replace('String(answer.answer ?? \'\').length', 'String(answer.text ?? \'\').length');

// D-20 start menu with a real event + delay
c = replaceBlock(
  c,
  "  await check('D-20'",
  "  });",
  `  await check('D-20', 'ui', 'start menu opens and closes', async () => {
    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(700);
    const exists = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.taskbar__start'))\`);
    if (!exists) throw new Error('start button not found in the DOM');
    await win.webContents.executeJavaScript(\`document.querySelector('.taskbar__start').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\`);
    await wait(900);
    const open = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.startMenu'))\`);
    await shot('start-menu');
    await win.webContents.executeJavaScript(\`document.querySelector('.startScrim')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))\`);
    await wait(600);
    const closed = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.startMenu'))\`);
    if (!open) throw new Error('start menu did not open');
    if (closed) throw new Error('start menu did not close');
    return { evidence: 'open + scrim close' };
  });`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('deepqa patched');
