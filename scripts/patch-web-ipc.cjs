const fs = require('fs');
const p = 'src/shared/ipc.ts';
let c = fs.readFileSync(p, 'utf8');

// Type imports
if (!c.includes('SiteManifest')) {
  c = c.replace('  SearchHit,', '  SearchHit,\n  SiteManifest,');
  c = c.replace('  WindowInfo,', '  WebPeer,\n  WebPublishFile,\n  WebPublishResult,\n  WebStats,\n  WindowInfo,');
}

// IPC map
if (!c.includes("'web.publish'")) {
  c = c.replace(
    "  'composio.execute': { params: { slug: string; args: Record<string, unknown> }; result: { ok: boolean; output: string; data?: unknown } };",
    `  'composio.execute': { params: { slug: string; args: Record<string, unknown> }; result: { ok: boolean; output: string; data?: unknown } };

  /* neuro web (decentralized domains + hosting) */
  'web.status': { params: void; result: WebStats };
  'web.list': { params: void; result: SiteManifest[] };
  'web.publish': { params: { domain: string; title?: string; description?: string; files: WebPublishFile[] }; result: WebPublishResult };
  'web.publishFolder': { params: { domain: string; title?: string }; result: WebPublishResult };
  'web.unpublish': { params: { domain: string }; result: SiteManifest[] };
  'web.resolve': { params: { domain: string }; result: { manifest: SiteManifest; host: string; port: number } | null };
  'web.peers': { params: void; result: WebPeer[] };
  'web.peerAdd': { params: { host: string; port: number }; result: WebPeer[] };
  'web.peerRemove': { params: { nodeId: string }; result: WebPeer[] };
  'web.gateway': { params: void; result: { gateway: string; port: number } };`,
  );
}

// Channel list
if (!c.includes("'web.publish',")) {
  c = c.replace("  'composio.execute',\n", "  'composio.execute',\n  'web.status',\n  'web.list',\n  'web.publish',\n  'web.publishFolder',\n  'web.unpublish',\n  'web.resolve',\n  'web.peers',\n  'web.peerAdd',\n  'web.peerRemove',\n  'web.gateway',\n");
}

// Event channel
if (!c.includes("'web:event'")) {
  c = c.replace("  'plugins:changed': PluginRecord[];", "  'plugins:changed': PluginRecord[];\n  'web:event': { kind: string; stats?: WebStats };");
}

// Event channel list
if (!c.includes("'web:event',")) {
  c = c.replace("  'plugins:changed',", "  'plugins:changed',\n  'web:event',");
}

fs.writeFileSync(p, c, 'utf8');
console.log('ipc patched');
