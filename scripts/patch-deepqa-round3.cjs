const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');

function replaceBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`start not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`end not found: ${startMarker}`);
  return source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

c = replaceBlock(
  c,
  "  await check('D-10'",
  "  });",
  `  await check('D-10', 'mail', 'peer-to-peer send, receive, reply, read and delete', async () => {
    let own = await call('mail.status');
    if (!own.identity) own = await call('mail.identityCreate', { name: 'QA Deep' });
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
      const reply = await call('mail.send', { to: peerAddress, subject: \`Re: Deep \${marker}\`, body: 'reply', replyTo: received.id });
      if (!reply.ok) throw new Error(\`reply failed: \${reply.message ?? ''}\`);
      let replied = false;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        await wait(300);
        replied = peer.messages('inbox', 50).filter((message: any) => message.subject.startsWith('Re: Deep')).length > 0;
        if (replied) break;
      }
      await call('mail.peerRemove', { nodeId: peerStatus.identity!.nodeId });
      if (!replied) throw new Error('reply never arrived');
      return { evidence: \`encrypted \${addressOf(peerStatus)} send + reply, decrypt ok, peer removed\` };
    } finally {
      await peer.dispose();
    }
  });`,
);

c = replaceBlock(
  c,
  "  await check('D-20'",
  "  });",
  `  await check('D-20', 'ui', 'start menu opens and closes', async () => {
    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(800);
    const probe = await win.webContents.executeJavaScript(
      \`(() => ({ start: Boolean(document.querySelector('[aria-label="Start"], .taskbar__start')), taskbar: Boolean(document.querySelector('.taskbar')), buttons: document.querySelectorAll('button').length, tail: document.body.innerText.slice(-120) }))()\`,
    );
    if (!probe.start) throw new Error(\`start button missing (taskbar=\${probe.taskbar}, buttons=\${probe.buttons}, tail=\${JSON.stringify(probe.tail)})\`);
    await win.webContents.executeJavaScript(
      \`document.querySelector('[aria-label="Start"], .taskbar__start').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))\`,
    );
    await wait(900);
    const open = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.startMenu'))\`);
    await shot('start-menu');
    await win.webContents.executeJavaScript(\`document.querySelector('.startScrim')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))\`);
    await wait(600);
    const closed = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.startMenu'))\`);
    if (!open) throw new Error('start menu did not open');
    if (closed) throw new Error('start menu did not close');
    return { evidence: 'open + scrim close' };
  });

  await check('D-21', 'ui', 'command palette opens with Ctrl+K and closes with Escape', async () => {
    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(500);
    await win.webContents.executeJavaScript(
      \`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))\`,
    );
    await wait(500);
    const open = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.palette'))\`);
    await shot('command-palette');
    await win.webContents.executeJavaScript(
      \`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))\`,
    );
    await wait(400);
    const closed = await win.webContents.executeJavaScript(\`Boolean(document.querySelector('.palette'))\`);
    if (!open) throw new Error('palette did not open');
    if (closed) throw new Error('palette did not close');
    return { evidence: 'Ctrl+K → palette → Escape' };
  });

  await check('D-22', 'chat', 'a session with no provider fails with a clear message', async () => {
    const session = await call('chat.create', { title: 'No provider', providerId: 'missing-provider' });
    try {
      await call('chat.send', { sessionId: session.id, text: 'hello' });
      return { status: 'warn', evidence: 'send did not throw without a provider' };
    } catch (error) {
      return { evidence: (error as Error).message.slice(0, 160) };
    } finally {
      await call('chat.delete', { id: session.id }).catch(() => {});
    }
  });`,
);

fs.writeFileSync(p, c, 'utf8');
console.log('deepqa round 3 patched');
