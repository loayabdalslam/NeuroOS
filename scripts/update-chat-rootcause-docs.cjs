const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Chat streaming root cause')) {
  b += [
    '',
    '## Chat streaming root cause (all providers)',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| New conversations were created with session *metadata* only (`active.messages` undefined), so the first send could throw before any request reached the provider. | `chat.create` now loads the full session (`chat.session`) and falls back to `messages: []`; send and the event reducer guard missing arrays. |',
    '| Even when the provider answered, the assistant bubble stayed on “Thinking…”: the local placeholder id was `pending_*`, while backend `text_delta` / `reasoning_delta` / tool events used the real assistant message id, so every delta missed and the UI never updated. `turn_end` only refreshed session metadata. | `turn_start` now reconciles the last empty assistant placeholder with the backend `messageId`, and `turn_end` reloads the full session, so streaming text, reasoning, tools and usage all render live. |',
    '| Invalid/stale model ids on old sessions could loop on “Thinking”. | AgentService falls back to the provider default model and emits a status; custom model ids are saved to the provider when typed, and New chat is created with the active provider/model. |',
    '',
    '### Real provider matrix (configured profile)',
    '',
    '| Provider | Result |',
    '| --- | --- |',
    '| Groq (`openai/gpt-oss-120b`) | **PASS** — real round-trip returned GROQ_OK. |',
    '| Ollama (`gemma3:1b`, CPU) | **PASS** — real round-trip returned OLLAMA_REAL_OK; UI new-conversation D-40 streamed real content. |',
    '| OpenCode ACP | Handshake PASS, prompt needs `opencode auth login` (0 credentials) — warning by design. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **38** |', '| Checks | **39** |').replace('| Pass | **36** |', '| Pass | **37** |');
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');
console.log('chat root cause docs updated');
