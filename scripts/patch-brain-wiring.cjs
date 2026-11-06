const fs = require('fs');

// ---------- kernel ----------
let k = fs.readFileSync('src/main/kernel.ts', 'utf8');
if (!k.includes('BrainService')) {
  k = k.replace("import { WebService } from './services/web.service';", "import { WebService } from './services/web.service';\nimport { BrainService } from './services/brain.service';");
  k = k.replace('  web: WebService;', '  web: WebService;\n  brain: BrainService;');
  k = k.replace(
    "  const content = new ContentService();",
    `  const content = new ContentService();
  const brain = new BrainService({
    dataFile: path.join(Paths.state, 'brain.json'),
    onEvent: (payload) => emitRaw('brain:event', payload as never),
  });`,
  );
  k = k.replace('    web,\n', '    web,\n    brain,\n');
  k = k.replace(
    "          { name: 'web', status: web.stats().port ? 'online' : 'degraded', detail: `${web.list().length} sites · ${web.peers().length} peers` },",
    `          { name: 'web', status: web.stats().port ? 'online' : 'degraded', detail: \`\${web.list().length} sites · \${web.peers().length} peers\` },
          { name: 'brain', status: 'online', detail: \`\${brain.stats().nodes} nodes · \${brain.stats().events} events\` },`,
  );
  k = k.replace('      await web.dispose();', '      await web.dispose();\n      brain.dispose();');
  k = k.replace('    await web.start();', '    await web.start();\n    brain.start();');
  fs.writeFileSync('src/main/kernel.ts', k, 'utf8');
  console.log('kernel patched');
}

// ---------- agent deps: memory context ----------
let a = fs.readFileSync('src/main/services/agent.service.ts', 'utf8');
if (!a.includes('brainContext')) {
  a = a.replace('  pluginAdapter?: (providerId: string) => import(\'./providers/adapters\').ProviderAdapter | null;', '  pluginAdapter?: (providerId: string) => import(\'./providers/adapters\').ProviderAdapter | null;\n  brainContext?: (prompt: string) => string;');
  a = a.replace(
    '    const memoryBlock = memories.length ? `\\n\\n## Remembered context\\n${memories.map((m) => `- ${m.text}`).join(\'\\n\')}` : \'\';',
    `    const memoryBlock = memories.length ? \`\\n\\n## Remembered context\\n\${memories.map((m) => \`- \${m.text}\`).join('\\n')}\` : '';
    const lastPrompt = session.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '';
    const brainMemory = this.deps.brainContext?.(lastPrompt) ?? '';
    const brainBlock = brainMemory ? \`\\n\\n## Long-term memory\\n\${brainMemory}\` : '';`,
  );
  a = a.replace('${memoryBlock}${skills}${session.messages.length > 0 ? \'\' : \'\'}', '${memoryBlock}${brainBlock}${skills}${session.messages.length > 0 ? \'\' : \'\'}');
  fs.writeFileSync('src/main/services/agent.service.ts', a, 'utf8');
  console.log('agent memory patched');
}

// ---------- handlers ----------
let h = fs.readFileSync('src/main/ipcHandlers.ts', 'utf8');
if (!h.includes("'brain.stats'")) {
  h = h.replace(
    "    'web.gateway': () => ({ gateway: kernel.web.stats().gateway, port: kernel.web.stats().port }),",
    `    'web.gateway': () => ({ gateway: kernel.web.stats().gateway, port: kernel.web.stats().port }),

    'brain.stats': () => kernel.brain.stats(),
    'brain.capture': ({ items }) => kernel.brain.capture(items),
    'brain.graph': (params) => kernel.brain.graph(params?.limit),
    'brain.recall': ({ query, limit }) => kernel.brain.recall(query, limit),
    'brain.ask': ({ query }) => kernel.brain.ask(query),
    'brain.timeline': (params) => kernel.brain.timeline(params?.limit),
    'brain.profile': () => kernel.brain.profile(),
    'brain.forget': ({ id }) => kernel.brain.forget(id),
    'brain.wipe': () => kernel.brain.wipe(),
    'brain.recording': ({ enabled }) => kernel.brain.setRecording(enabled),
    'brain.remember': ({ text, tags }) => kernel.brain.remember(text, tags),`,
  );
  h = h.replace(
    "    'chat.send': ({ sessionId, text, attachments }) => agent.send(sessionId, text, attachments as never),",
    `    'chat.send': async ({ sessionId, text, attachments }) => {
      kernel.brain.capture([
        {
          kind: 'chat',
          label: \`Asked Neuro: \${text.slice(0, 80)}\`,
          detail: text.slice(0, 300),
          surface: 'chat',
          app: 'chat',
          tags: ['chat', 'agent'],
        },
      ]);
      return agent.send(sessionId, text, attachments as never);
    },`,
  );
  h = h.replace(
    "    'web.publish': (input) => kernel.web.publish(input),",
    `    'web.publish': async (input) => {
      const result = await kernel.web.publish(input);
      if (result.ok && result.manifest) {
        kernel.brain.capture([
          {
            kind: 'site',
            label: \`\${result.manifest.domain}.neuro\`,
            detail: result.manifest.title,
            surface: 'sites',
            app: 'sites',
            tags: ['site', 'web', ...(input.domain ? [input.domain] : [])],
          },
        ]);
      }
      return result;
    },`,
  );
  h = h.replace(
    "    'automation.run': ({ id, input }) => automation.run(id, 'manual', input),",
    `    'automation.run': async ({ id, input }) => {
      const workflow = automation.list().find((item) => item.id === id);
      kernel.brain.capture([
        {
          kind: 'workflow',
          label: workflow?.name ?? 'Workflow run',
          detail: 'manual run',
          surface: 'automation',
          app: 'automation',
          tags: ['automation'],
        },
      ]);
      return automation.run(id, 'manual', input);
    },`,
  );
  fs.writeFileSync('src/main/ipcHandlers.ts', h, 'utf8');
  console.log('handlers patched');
}
