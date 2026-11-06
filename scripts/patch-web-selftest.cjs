const fs = require('fs');
let m = fs.readFileSync('src/renderer/src/main.tsx', 'utf8');
if (!m.includes('sites.css')) {
  m = m.replace("import './styles/audit.css';", "import './styles/sites.css';\nimport './styles/audit.css';");
  fs.writeFileSync('src/renderer/src/main.tsx', m, 'utf8');
  console.log('sites css imported');
}

let p = 'src/main/index.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes('decentralized web (two nodes)')) {
  console.log('selftest already patched');
  process.exit(0);
}

if (!c.includes("from './services/web.service'")) {
  c = c.replace("import { MailService } from './services/mail.service';", "import { MailService } from './services/mail.service';\nimport { WebService } from './services/web.service';");
}

const webTest = `  /* --------------------- decentralized web (two nodes) ---------------------- */
  const peerWebFile = path.join(Paths.cache, 'selftest-web-peer.json');
  try {
    fs.rmSync(peerWebFile, { force: true });
  } catch {
    /* ignore */
  }
  const peerWebVault = (() => {
    const map = new Map<string, string>();
    return { get: (key: string) => map.get(key) ?? '', set: (key: string, value: string) => map.set(key, value) };
  })();
  const peerWeb = new WebService({ dataFile: peerWebFile, vault: peerWebVault, onEvent: () => {} });
  await peerWeb.start();
  kernel.web.addPeer('127.0.0.1', peerWeb.stats().port);
  peerWeb.addPeer('127.0.0.1', kernel.web.stats().port);
  const siteHtml = '<!doctype html><html><head><title>Selftest</title></head><body><h1 id="neuro-web-ok">Hello from the mesh</h1></body></html>';
  const published = await kernel.web.publish({
    domain: 'selftest',
    title: 'Selftest site',
    description: 'Hosted by the QA harness',
    files: [{ path: 'index.html', data: Buffer.from(siteHtml).toString('base64') }],
  });
  await wait(700);
  const resolvedSite = await peerWeb.resolve('selftest');
  const served = resolvedSite
    ? await fetch(\`http://127.0.0.1:\${peerWeb.stats().port}/dweb/selftest/\`)
        .then((response) => response.text())
        .catch((error) => \`ERR \${(error as Error).message}\`)
    : 'NO_RESOLVE';
  log.info(
    'selftest',
    \`web p2p: published=\${published.ok} domain=\${published.manifest?.domain}.neuro resolved=\${Boolean(resolvedSite)} served=\${served.includes('neuro-web-ok')} peerSites=\${peerWeb.stats().sites} hits=\${peerWeb.stats().hits} bytes=\${kernel.web.stats().bytes}\`,
  );

`;
c = c.replace('  const surfaces: [string, string, Record<string, string>?][] = [', webTest + '  const surfaces: [string, string, Record<string, string>?][] = [');

c = c.replace("    ['21-integrations', 'settings', { section: 'integrations' }],", "    ['21-integrations', 'settings', { section: 'integrations' }],\n    ['22-sites', 'sites'],\n    ['23-neuroweb', 'browser', { mode: 'dweb' }],");

// sidebar capture after the start menu
c = c.replace(
  "  await screenshot('20-start-menu');",
  `  await screenshot('20-start-menu');
  await win.webContents.executeJavaScript(\`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))\`).catch(() => {});
  await wait(200);
  await win.webContents.executeJavaScript(\`document.querySelector('.dock__collapse')?.click()\`).catch(() => {});
  await wait(600);
  await screenshot('24-sidebar');
  await win.webContents.executeJavaScript(\`document.querySelector('.dock__collapse')?.click()\`).catch(() => {});`,
);

// cleanup
c = c.replace('  await mockComposio.close();', '  await mockComposio.close();\n  await peerWeb.dispose();');

fs.writeFileSync(p, c, 'utf8');
console.log('selftest web checks added');
