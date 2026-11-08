const fs = require('fs');
const p = 'src/renderer/src/surfaces/Chat.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replaceAll('Ã‚Â·', '·').replaceAll('Â·', '·').replaceAll('â€¦', '…').replaceAll('â€”', '—').replaceAll('Ã¢â‚¬Â¦', '…');
fs.writeFileSync(p, c, 'utf8');
console.log('chat strings cleaned');

let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Thinking & streaming pass')) {
  b += [
    '',
    '## Thinking & streaming pass',
    '',
    '| Feature | Behaviour |',
    '| --- | --- |',
    '| Live thinking | While a turn is running the header shows a live status pill and the empty assistant bubble shows a spinner + current status (“Thinking”, “Running tool…”, ACP status) instead of a bare caret. |',
    '| Reasoning stream | Parses OpenAI/OpenRouter/Ollama `reasoning_content`, `reasoning` and `thinking` deltas, Anthropic `thinking_delta`, Gemini thought parts, and ACP `agent_thought_chunk` + plan updates. The reasoning panel opens while live, auto-scrolls, shows a pulse/caret and a character count. |',
    '| Thinking level | Composer has a **Thinking: Auto/Off/Low/Medium/High** selector. It maps to `reasoning_effort` (OpenAI-compatible), Anthropic `thinking.budget_tokens`, Gemini `thinkingConfig.thinkingBudget/includeThoughts`, and ACP `thought_level` config option where the agent supports it. Unsupported models retry without the parameter. |',
    '| Model name | The model dialog includes a free-text **model id** field (ACP model, Ollama tag, deployment name…) plus the provider’s model list, Refresh models and Manage providers. D-37 verifies a custom id sticks. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **35** |', '| Checks | **36** |').replace('| Pass | **33** |', '| Pass | **34** |');
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');
console.log('docs updated');
