const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace("import { MailService } from './services/mail.service';", "import { MailService } from './services/mail.service';\nimport { WebService } from './services/web.service';");

const block = `  await check('D-23', 'terminal', 'two concurrent PTY sessions keep separate buffers', async () => {
    const one = await call('terminal.create', { cols: 90, rows: 24, cwd: root });
    const two = await call('terminal.create', { cols: 90, rows: 24, cwd: root });
    await wait(900);
    await call('terminal.write', { id: one.id, data: 'echo SESSION_ONE_OK\\r\\n' });
    await call('terminal.write', { id: two.id, data: 'echo SESSION_TWO_OK\\r\\n' });
    await wait(2400);
    const first = await call('terminal.buffer', { id: one.id });
    const second = await call('terminal.buffer', { id: two.id });
    await call('terminal.kill', { id: one.id });
    await call('terminal.kill', { id: two.id });
    if (!first.data.includes('SESSION_ONE_OK') || first.data.includes('SESSION_TWO_OK')) throw new Error('session one buffer mixed up');
    if (!second.data.includes('SESSION_TWO_OK') || second.data.includes('SESSION_ONE_OK')) throw new Error('session two buffer mixed up');
    return { evidence: 'two PTYs, isolated buffers, both killed' };
  });

  await check('D-24', 'brain', 'recording toggle, graph, profile and batch capture', async () => {
    await call('brain.recording', { enabled: false });
    await call('brain.recording', { enabled: true });
    const captured = await call('brain.capture', {
      items: [
        { kind: 'note', title: \`Capture \${marker}\`, body: 'qa capture', surface: 'brain', at: new Date().toISOString() },
        { kind: 'event', title: \`Event \${marker}\`, body: 'qa event', surface: 'brain', at: new Date().toISOString() },
      ],
    });
    const graph = await call('brain.graph', { limit: 50 });
    const profile = await call('brain.profile');
    if (captured.recorded < 1) throw new Error('nothing recorded');
    if (!graph.nodes.length) throw new Error('graph empty');
    return { evidence: \`recorded \${captured.recorded}, graph \${graph.nodes.length} nodes, profile \${profile.totalNodes ?? '?'} nodes\` };
  });

  await check('D-25', 'mail', 'sent folder holds the outgoing message', async () => {
    const sent = await call('mail.messages', { folder: 'sent', limit: 50 });
    const message = sent.find((item: any) => String(item.subject).startsWith('Deep '));
    if (!message) throw new Error('sent folder has no Deep message');
    return { evidence: \`\${sent.length} sent, direction=\${message.direction}, encrypted=\${message.encrypted}\` };
  });

  await check('D-26', 'web', 'peer replication: another node publishes, this node serves it', async () => {
    const vaultMap = new Map<string, string>();
    const peer = new WebService({
      dataFile: path.join(root, 'peer-web.json'),
      blobsDir: path.join(root, 'peer-blobs'),
      vault: { get: (key: string) => vaultMap.get(key) ?? '', set: (key: string, value: string) => void vaultMap.set(key, value), remove: (key: string) => void vaultMap.delete(key) },
      onEvent: () => {},
    });
    await peer.start();
    try {
      const domain = \`replica-\${crypto.randomBytes(3).toString('hex')}\`;
      const published = await peer.publish({ domain, title: 'Replica', files: [{ path: 'index.html', data: Buffer.from(\`<h1>REPLICA_\${marker}</h1>\`).toString('base64') }] });
      if (!published.ok) throw new Error(published.error ?? 'peer publish failed');
      await call('web.peerAdd', { host: '127.0.0.1', port: peer.stats().port });
      const stats = await call('web.status');
      let page = '';
      for (let attempt = 0; attempt < 12; attempt += 1) {
        page = await fetch(\`http://127.0.0.1:\${stats.port}/dweb/\${domain}/\`).then((response) => response.text());
        if (page.includes(\`REPLICA_\${marker}\`)) break;
        await wait(500);
      }
      await call('web.peerRemove', { nodeId: peer.stats().nodeId });
      if (!page.includes(\`REPLICA_\${marker}\`)) throw new Error('gateway did not proxy the peer site');
      return { evidence: \`\${domain}.neuro published on peer, served by this gateway\` };
    } finally {
      await peer.dispose();
    }
  });

  const report = results;`;

c = c.replace('  const report = results;', block);
fs.writeFileSync(p, c, 'utf8');
console.log('added D-23..D-26');
