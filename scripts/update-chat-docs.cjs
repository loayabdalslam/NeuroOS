const fs = require('fs');

let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **28** |', '| Checks | **30** |');
d = d.replace('| Pass | **26** |', '| Pass | **28** |');
d = d.replace(
  '| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape, all 8 theme presets captured, provider picker in a light theme |',
  '| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape, all 8 theme presets captured, provider picker in a light theme, ChatGPT-style composer, centred mail setup |',
);
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');

let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Chat & composer pass')) {
  const section = [
    '',
    '## Chat & composer pass',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| Ollama models that do not support tools returned HTTP 400 for the whole turn, leaving an empty bubble. | The OpenAI-compatible adapter detects “does not support tools” and retries the turn without a tools payload; Ollama base URLs without /v1 are normalized; streaming has a 180s hard timeout. OLL-01: first token ~6.1s. |',
    '| Agent failures were only toasts; the assistant bubble stayed empty with a caret. | Error events now fill the message with ⚠️ + message and render an inline error block. |',
    '| Composer looked like a control panel: workspace/auto-approve chips, send/newline hints, crowded provider/model pills. | ChatGPT-style composer: paperclip left, compact provider + model selectors, circular send/stop button, chip row removed, larger radius and softer shadow. |',
    '| Mail setup card inherited the 3-column mail grid and was clipped on the left. | .mail--setup is a single-column centred grid with padding and overflow; D-00 verifies left=505px, width=520px inside a 1480px viewport. |',
    '',
  ].join('\n');
  b += section;
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
console.log('docs updated');
