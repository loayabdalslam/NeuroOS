const fs = require('fs');
const p = 'src/main/services/providers/adapters.ts';
let c = fs.readFileSync(p, 'utf8');

const cls = c.indexOf('export class OpenAiCompatibleAdapter');
const start = c.indexOf('const response = await fetch(joinUrl(', cls);
const marker = 'await assertOk(response, this.provider.name);';
const end = c.indexOf(marker, start);
if (cls < 0 || start < 0 || end < 0) throw new Error('anchors missing');

const lines = [
  "    const rawBase = this.provider.baseUrl || 'https://api.openai.com/v1';",
  "    const base = this.provider.kind === 'ollama' && !/\\/v1\\/?$/.test(rawBase) ? `${rawBase.replace(/\\/$/, '')}/v1` : rawBase;",
  "    const endpoint = joinUrl(base, 'chat/completions');",
  '    const timeoutSignal = AbortSignal.timeout(180_000);',
  '    const combinedSignal = AbortSignal.any ? AbortSignal.any([signal, timeoutSignal]) : signal;',
  '    const call = (): Promise<Response> =>',
  '      fetch(endpoint, {',
  "        method: 'POST',",
  '        headers: authHeaders(this.provider),',
  '        body: JSON.stringify(body),',
  '        signal: combinedSignal,',
  '      });',
  '    let response = await call();',
  '    if (!response.ok) {',
  '      const errorText = await response.text();',
  '      if (body.tools && /does not support tools/i.test(errorText)) {',
  '        // Local models (Ollama, llama.cpp) may reject a tools payload.',
  '        delete body.tools;',
  '        delete body.tool_choice;',
  '        response = await call();',
  '      } else {',
  "        throw new Error(`${this.provider.name}: ${errorText.slice(0, 400) || response.statusText}`);",
  '      }',
  '    }',
  '    ' + marker,
];

c = c.slice(0, start) + lines.join('\n') + c.slice(end + marker.length);
fs.writeFileSync(p, c, 'utf8');
console.log('OpenAI adapter patched');
