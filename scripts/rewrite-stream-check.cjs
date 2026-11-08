const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
const start = c.indexOf("  await check('D-36'");
const end = c.indexOf('  const report = results;', start);
if (start < 0 || end < 0) throw new Error('D-36 anchors missing');

const block = [
  "  await check('D-36', 'chat', 'Ollama streams incremental content', async () => {",
  "    await call('providers.save', {",
  "      id: 'ui-stream', name: 'Stream Ollama', kind: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '',",
  "      enabled: true, models: [{ id: 'gemma3:4b', label: 'gemma3:4b', supportsTools: true }], defaultModel: 'gemma3:4b',",
  "      createdAt: new Date().toISOString(), color: '#22c55e',",
  '    });',
  "    const session = await call('chat.create', { providerId: 'ui-stream', model: 'gemma3:4b' });",
  "    await call('chat.send', { sessionId: session.id, text: 'Say STREAM_OK' });",
  '    const lengths: number[] = [];',
  '    let error = "";',
  '    const deadline = Date.now() + 90_000;',
  '    while (Date.now() < deadline) {',
  '      await wait(700);',
  "      const full = await call('chat.session', { id: session.id });",
  "      const assistant = full.messages.filter((message: any) => message.role === 'assistant').at(-1);",
  '      lengths.push(assistant?.content?.length ?? 0);',
  "      error = assistant?.error ?? '';",
  '      if (error) break;',
  '      const tail = lengths.slice(-4);',
  '      if (tail.length === 4 && tail.every((value) => value === tail[0] && value > 0)) break;',
  '    }',
  "    await call('chat.delete', { id: session.id });",
  "    await call('providers.remove', { id: 'ui-stream' });",
  '    const distinct = [...new Set(lengths.filter((value) => value > 0))];',
  "    if (error) throw new Error('stream error: ' + error);",
  "    if (!lengths.some((value) => value > 0)) throw new Error('no content streamed');",
  "    if (distinct.length < 2) throw new Error('content was not incremental: ' + JSON.stringify(lengths.slice(0, 12)));",
  "    return { evidence: 'grew through ' + distinct.length + ' lengths, final ' + distinct.at(-1) + ' chars' };",
  '  });',
  '',
  '  const report = results;',
].join('\n');

c = c.slice(0, start) + block + c.slice(end + '  const report = results;'.length);
fs.writeFileSync(p, c, 'utf8');
console.log('D-36 rewritten');
