const fs = require('fs');

let docs = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
docs = docs.replace('| Checks | **26** |', '| Checks | **28** |');
docs = docs.replace('| Pass | **25** |', '| Pass | **26** |');
docs = docs.replace('| Warn | **1** |', '| Warn | **2** |');
docs = docs.replace(
  '| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape |',
  '| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape, all 8 theme presets captured, provider picker in a light theme |',
);
const oldWarn = '- **Workspace boundary (BUG-014, accepted):** `fs.read` is OS-wide by design, like Finder. The Workspace surface is a root, not a sandbox.';
const newWarn = [
  '- **Workspace boundary (BUG-014, accepted):** fs.read is OS-wide by design, like Finder. The Workspace surface is a root, not a sandbox.',
  '- **Composio (D-18):** the run had no NEURO_QA_COMPOSIO_KEY, so the live check was skipped (the earlier live run passed).',
].join('\n');
docs = docs.replace(oldWarn, newWarn);
fs.writeFileSync('docs/DEEP-QA.md', docs, 'utf8');
console.log('DEEP-QA updated');

let bugs = fs.readFileSync('BUGS.md', 'utf8');
if (!bugs.includes('## UI / theme pass')) {
  const section = [
    '',
    '## UI / theme pass',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| Photo-wallpaper overlay was applied globally (.app__bg, .desktop, .lockscreen), darkening every theme and turning Ubuntu light into flat grey. | Scoped to :root[data-wallpaper^=photo:] with a light variant; themed gradients render again. |',
    '| ACP provider cards had blank icons (brand bot has no mark, BrandIcon returned null). | Provider grids fall back to Icon name=plug when hasBrand() is false. |',
    '| Provider picker collapsed to one oversized column (1fr min-content + long ACP install strings). | repeat(2, minmax(0,1fr)) + min-width:0; verified 293px + 293px columns. |',
    '| “Add provider” skipped the preset list and opened DeepSeek directly. | It opens the picker now; 23 cards render in a light theme. |',
    '| Light-theme dock/taskbar glyphs were washed out on pale bars. | Light dock tiles + stronger glyph contrast; desktop tiles use color-mix accent backgrounds. |',
    '| Provider cards had faint borders in light themes. | Explicit light-theme surfaces, borders and logo tiles. |',
    '',
  ].join('\n');
  bugs += section;
  fs.writeFileSync('BUGS.md', bugs, 'utf8');
  console.log('BUGS updated');
} else {
  console.log('BUGS already updated');
}
