const fs = require('fs');

// ---- kernel ----
let k = fs.readFileSync('src/main/kernel.ts', 'utf8');
if (!k.includes('WebService')) {
  k = k.replace("import { ComposioService } from './services/composio.service';", "import { ComposioService } from './services/composio.service';\nimport { WebService } from './services/web.service';");
  k = k.replace('  composio: ComposioService;', '  composio: ComposioService;\n  web: WebService;');
  k = k.replace(
    "  late.plugins = plugins;",
    `  late.plugins = plugins;

  const web = new WebService({
    dataFile: path.join(Paths.state, 'web.json'),
    vault: settings.secretVault,
    onEvent: (payload) => emitRaw('web:event', payload as never),
  });`,
  );
  k = k.replace('    composio,\n', '    composio,\n    web,\n');
  k = k.replace(
    "          { name: 'composio', status: composio.status().configured ? 'online' : 'degraded', detail: composio.status().configured ? `${composio.status().tools} tools` : 'not configured' },",
    `          { name: 'composio', status: composio.status().configured ? 'online' : 'degraded', detail: composio.status().configured ? \`\${composio.status().tools} tools\` : 'not configured' },
          { name: 'web', status: web.stats().port ? 'online' : 'degraded', detail: \`\${web.list().length} sites · \${web.peers().length} peers\` },`,
  );
  k = k.replace('      composio.dispose();', '      composio.dispose();\n      await web.dispose();');
  k = k.replace('    await composio.start();', '    await composio.start();\n    await web.start();');
  fs.writeFileSync('src/main/kernel.ts', k, 'utf8');
  console.log('kernel patched');
} else {
  console.log('kernel already patched');
}

// ---- handlers ----
let h = fs.readFileSync('src/main/ipcHandlers.ts', 'utf8');
if (!h.includes("'web.publish'")) {
  h = h.replace(
    "    'composio.execute': ({ slug, args }) => kernel.composio.execute(slug, args),",
    `    'composio.execute': ({ slug, args }) => kernel.composio.execute(slug, args),

    'web.status': () => kernel.web.stats(),
    'web.list': () => kernel.web.list(),
    'web.publish': (input) => kernel.web.publish(input),
    'web.publishFolder': async ({ domain, title }) => {
      const win = getWindow();
      const picked = win
        ? await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose a folder to publish' })
        : await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose a folder to publish' });
      if (picked.canceled || !picked.filePaths[0]) return { ok: false, error: 'cancelled' };
      return kernel.web.publishFolder(picked.filePaths[0], domain, title);
    },
    'web.unpublish': ({ domain }) => kernel.web.unpublish(domain),
    'web.resolve': ({ domain }) => kernel.web.resolve(domain),
    'web.peers': () => kernel.web.peers(),
    'web.peerAdd': ({ host, port }) => kernel.web.addPeer(host, Number(port)),
    'web.peerRemove': ({ nodeId }) => kernel.web.removePeer(nodeId),
    'web.gateway': () => ({ gateway: kernel.web.stats().gateway, port: kernel.web.stats().port }),`,
  );
  fs.writeFileSync('src/main/ipcHandlers.ts', h, 'utf8');
  console.log('handlers patched');
} else {
  console.log('handlers already patched');
}
