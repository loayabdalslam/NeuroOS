const fs = require('fs');

// ---- tools.ts ----
let t = fs.readFileSync('src/main/services/tools.ts', 'utf8');
if (!t.includes("'brain.recall'")) {
  t = t.replace(
    "  mail?: {",
    `  brain?: {
    recall: (query: string, limit?: number) => { label: string; kind: string; weight: number; why: string }[];
    remember: (text: string, tags?: string[]) => void;
    stats: () => { nodes: number; edges: number; events: number };
  };
  mail?: {`,
  );
  t = t.replace(
    `  define(
    'desktop.open',`,
    `  define(
    'brain.recall',
    'Recall from memory',
    'Search the local memory graph (apps used, actions taken, people, sites, tools, past questions) and return the closest memories with why they matched.',
    'agent',
    'low',
    obj({ query: str('What to recall, in natural language.'), limit: num('Max results (default 6).') }, ['query']),
    async (args, rt) => {
      if (!rt.brain) return { ok: false, output: 'Brain is unavailable.' };
      const hits = rt.brain.recall(String(args.query), Math.min(Number(args.limit ?? 6) || 6, 20));
      if (!hits.length) return { ok: true, output: 'Nothing in memory matches that yet.' };
      return { ok: true, output: hits.map((hit) => \`- \${hit.label} (\${hit.kind}, \${hit.weight}x) — \${hit.why}\`).join('\\n') };
    },
  ),
  define(
    'brain.remember',
    'Remember a fact',
    'Store a durable fact or preference in the local memory graph so it can be recalled in later conversations.',
    'agent',
    'low',
    obj({ text: str('The fact or preference to store.'), tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' } }, ['text']),
    async (args, rt) => {
      if (!rt.brain) return { ok: false, output: 'Brain is unavailable.' };
      rt.brain.remember(String(args.text), Array.isArray(args.tags) ? (args.tags as string[]) : []);
      return { ok: true, output: 'Stored in long-term memory.' };
    },
  ),
  define(
    'brain.stats',
    'Memory stats',
    'Report how many memory nodes, relations and recorded events the brain holds.',
    'agent',
    'low',
    obj({}),
    async (_args, rt) => {
      if (!rt.brain) return { ok: false, output: 'Brain is unavailable.' };
      const stats = rt.brain.stats();
      return { ok: true, output: \`\${stats.nodes} memories · \${stats.edges} relations · \${stats.events} events recorded\` };
    },
  ),
  define(
    'desktop.open',`,
  );
  fs.writeFileSync('src/main/services/tools.ts', t, 'utf8');
  console.log('brain tools added');
}

// ---- kernel runtime ----
let k = fs.readFileSync('src/main/kernel.ts', 'utf8');
if (!k.includes('brain: {')) {
  k = k.replace(
    "    mail: {\n      status: () => late.mail!.status(),",
    `    brain: {
      recall: (query, limit) =>
        brain.recall(query, limit).map((hit) => ({ label: hit.node.label, kind: hit.node.kind, weight: hit.node.weight, why: hit.why })),
      remember: (text, tags) => void brain.remember(text, tags),
      stats: () => ({ nodes: brain.stats().nodes, edges: brain.stats().edges, events: brain.stats().events }),
    },
    mail: {
      status: () => late.mail!.status(),`,
  );
  fs.writeFileSync('src/main/kernel.ts', k, 'utf8');
  console.log('brain runtime added');
}

// ---- graph spread ----
let b = fs.readFileSync('src/renderer/src/surfaces/Brain.tsx', 'utf8');
b = b.replace('const radius = Math.min(width, height) * 0.34;', 'const radius = Math.min(width, height) * 0.42;');
b = b.replace('const force = 220 / (distance * distance);', 'const force = 900 / (distance * distance);');
b = b.replace('const target = 90;', 'const target = 118;');
fs.writeFileSync('src/renderer/src/surfaces/Brain.tsx', b, 'utf8');
console.log('graph spread tuned');
