const fs = require('fs');
const p = 'src/main/qa.ts';
let c = fs.readFileSync(p, 'utf8');
if (c.includes('OLL-01')) {
  console.log('already present');
  process.exit(0);
}

const block = [
  "  await check('OLL-01', 'chat', 'Ollama chat round-trip (tools fallback)', async () => {",
  '    const provider = {',
  "      id: 'qa-ollama',",
  "      name: 'QA Ollama',",
  "      kind: 'ollama',",
  "      baseUrl: 'http://127.0.0.1:11434',",
  "      apiKey: '',",
  '      enabled: true,',
  "      models: [{ id: 'loaiabdalslam/gemma-700m-it-racore:latest', label: 'gemma-700m', supportsTools: true }],",
  "      defaultModel: 'loaiabdalslam/gemma-700m-it-racore:latest',",
  '      createdAt: new Date().toISOString(),',
  "      color: '#5686fe',",
  '    };',
  '    kernel.settings.saveProvider(provider as never);',
  '    try {',
  "      const session = await kernel.agent.createSession({ providerId: provider.id, model: provider.defaultModel, title: 'QA Ollama' });",
  '      const started = Date.now();',
  "      await kernel.agent.send(session.id, 'Reply with exactly: OLLAMA_OK');",
  "      let transcript = '';",
  '      let first = 0;',
  '      const deadline = Date.now() + 90_000;',
  '      while (Date.now() < deadline) {',
  '        await wait(500);',
  '        const full = await kernel.agent.getSession(session.id);',
  "        const assistant = full.messages.filter((message) => message.role === 'assistant').at(-1);",
  "        transcript = assistant?.content ?? '';",
  '        if (transcript && !first) first = Date.now() - started;',
  "        if (transcript.includes('OLLAMA_OK') || assistant?.error) break;",
  '      }',
  '      const full = await kernel.agent.getSession(session.id);',
  "      const error = full.messages.filter((message) => message.role === 'assistant').at(-1)?.error;",
  '      await kernel.agent.deleteSession(session.id).catch(() => {});',
  '      if (error) throw new Error(error);',
  "      if (!transcript.trim()) throw new Error('empty response after 90s');",
  "      return { evidence: 'first ' + first + 'ms, total ' + (Date.now() - started) + 'ms, \"' + transcript.slice(0, 60) + '\"' };",
  '    } finally {',
  "      kernel.settings.removeProvider('qa-ollama');",
  '    }',
  '  });',
  '',
  '  /* ----------------------------- COMPOSIO ---------------------------- */',
].join('\n');

const anchor = '  /* ----------------------------- COMPOSIO ---------------------------- */';
c = c.replace(anchor, block);
fs.writeFileSync(p, c, 'utf8');
console.log('OLL-01 added');
