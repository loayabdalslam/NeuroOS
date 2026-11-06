const fs = require('fs');
const p = 'src/shared/ipc.ts';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('BrainStats')) {
  c = c.replace('  AppInfo,', '  AppInfo,\n  BrainAnswer,\n  BrainCaptureInput,\n  BrainGraph,\n  BrainHit,\n  BrainNode,\n  BrainProfile,\n  BrainStats,');
}

if (!c.includes("'brain.capture'")) {
  c = c.replace(
    "  'web.gateway': { params: void; result: { gateway: string; port: number } };",
    `  'web.gateway': { params: void; result: { gateway: string; port: number } };

  /* brain (memory graph) */
  'brain.stats': { params: void; result: BrainStats };
  'brain.capture': { params: { items: BrainCaptureInput[] }; result: { recorded: number } };
  'brain.graph': { params: { limit?: number } | void; result: BrainGraph };
  'brain.recall': { params: { query: string; limit?: number }; result: BrainHit[] };
  'brain.ask': { params: { query: string }; result: BrainAnswer };
  'brain.timeline': { params: { limit?: number } | void; result: import('./types').BrainEventRecord[] };
  'brain.profile': { params: void; result: BrainProfile };
  'brain.forget': { params: { id: string }; result: BrainStats };
  'brain.wipe': { params: void; result: BrainStats };
  'brain.recording': { params: { enabled: boolean }; result: BrainStats };
  'brain.remember': { params: { text: string; tags?: string[] }; result: BrainNode };`,
  );
}

if (!c.includes("'brain.stats',")) {
  c = c.replace("  'web.gateway',\n", "  'web.gateway',\n  'brain.stats',\n  'brain.capture',\n  'brain.graph',\n  'brain.recall',\n  'brain.ask',\n  'brain.timeline',\n  'brain.profile',\n  'brain.forget',\n  'brain.wipe',\n  'brain.recording',\n  'brain.remember',\n");
}

if (!c.includes("'brain:event'")) {
  c = c.replace("  'web:event': { kind: string; stats?: WebStats };", "  'web:event': { kind: string; stats?: WebStats };\n  'brain:event': { kind: string; stats?: BrainStats; node?: BrainNode };");
}

if (!c.includes("'brain:event',")) {
  c = c.replace("  'web:event',", "  'web:event',\n  'brain:event',");
}

fs.writeFileSync(p, c, 'utf8');
console.log('brain ipc patched');
