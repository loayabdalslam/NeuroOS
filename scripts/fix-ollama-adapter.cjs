const fs = require('fs');

const p = 'src/main/services/providers/adapters.ts';
let c = fs.readFileSync(p, 'utf8');
const start = c.indexOf('    const response = await fetch(joinUrl(');
const endMarker = '    await assertOk(response, this.provider.name);';
const end = c.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('anchors missing');
const endPos = end + endMarker.length;

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
  '    await assertOk(response, this.provider.name);',
];
c = c.slice(0, start) + lines.join('\n') + c.slice(endPos);
fs.writeFileSync(p, c, 'utf8');
console.log('adapter patched by index');

// CSS for composer selectors + inline error
const cssPath = 'src/renderer/src/styles/chat.css';
const css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.composer__selectors')) {
  const block = [
    '',
    '.composer__selectors { display: flex; align-items: center; gap: 4px; min-width: 0; }',
    '.composer__selectWrap { position: relative; min-width: 0; }',
    '.composer__select { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 99px; border: 1px solid var(--n-line); background: var(--n-layer-1); color: var(--n-text-3); font-size: 11px; max-width: 210px; }',
    '.composer__select:hover { border-color: var(--n-accent-line); color: var(--n-text); }',
    '.composer__select .truncate { max-width: 130px; }',
    '.composer__selectDot { width: 6px; height: 6px; border-radius: 50%; flex: none; }',
    '.msg__error { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 8px 10px; border-radius: 8px; border: 1px solid color-mix(in srgb, #ef4444 35%, transparent); background: color-mix(in srgb, #ef4444 8%, transparent); color: #ef4444; font-size: 11.5px; line-height: 1.5; }',
    '',
  ].join('\n');
  fs.writeFileSync(cssPath, css + block, 'utf8');
  console.log('chat css appended');
}
