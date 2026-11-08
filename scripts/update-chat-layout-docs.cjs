const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Chat layout pass')) {
  b += [
    '',
    '## Chat layout pass',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| Chat composer inherited the Composer surface’s 3-column grid (`.composer { display: grid; grid-template-columns: 236px 1fr 300px }`), squeezing the textarea and putting the toolbar beside it. | Scoped `.chat .composer` overrides: flex column, full-width textarea with min-height, toolbar in its own row behind a divider, send button on the right. |',
    '| Identifiers with underscores (`MOCK_ACP_OK`) rendered as emphasis (`MOCKACPOK`) because the markdown inline parser treated `_…_` as italic anywhere. | Removed underscore emphasis from the inline pattern; `*italic*` and `**bold**` still work. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
console.log('chat layout docs updated');
