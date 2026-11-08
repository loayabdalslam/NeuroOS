const fs = require('fs');

let p = 'docs/DEEP-QA.md';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('| Checks | **26** |', '| Checks | **28** |');
c = c.replace('| Pass | **25** |', '| Pass | **26** |');
c = c.replace('| Warn | **1** |', '| Warn | **2** |');
c = c.replace(
  '| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape |',
  '| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape, all 8 theme presets captured, provider picker in a light theme |',
);
c = c.replace(
  '- **Workspace boundary (BUG-014, accepted):** `fs.read` is OS-wide by design, like Finder. The Workspace surface is a root, not a sandbox.',
  `- **Workspace boundary (BUG-014, accepted):** \`fs.read\` is OS-wide by design, like Finder. The Workspace surface is a root, not a sandbox.
- **Composio (D-18):** the run had no \`NEURO_QA_COMPOSIO_KEY\`, so the live check was skipped (the earlier live run passed).`,
);

let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## UI / theme pass')) {
  b +=

`

## UI / theme pass

| Issue | Fix |
| --- | --- |
| Photo-wallpaper overlay was applied globally (`.app__bg`, `.desktop`, `.lockscreen`), darkening every theme and turning Ubuntu light into flat grey. | Scoped to \`:root[data-wallpaper^='photo:']\`, with a light variant. Themed gradients (Yaru, Mica, Aurora, Paper) render again. |
| ACP provider cards had blank icons: presets use brand \`bot\`, which has no brand mark and \`BrandIcon\` returned \`null\`. | Provider grids render \`Icon name="plug"\` when \`hasBrand()\` is false (Settings + Onboarding). |
| Provider picker collapsed to one oversized column: \`1fr\` columns used min-content width, and ACP install strings are long. | \`grid-template-columns: repeat(2, minmax(0, 1fr))\` + \`min-width: 0\` on cards; verified 293 px + 293 px columns. |
| “Add provider” skipped the preset list and opened DeepSeek directly; ACP presets were unreachable from Settings. | The button now opens the picker (\`providerPicker\` state, \`ProviderModal\` accepts \`open\`); 23 cards render in a light theme. |
| Light-theme dock/taskbar glyphs were washed out on pale bars. | Light-theme dock tiles + stronger glyph contrast; desktop tiles use \`color-mix\` accent backgrounds and darkened glyphs. |
| Provider cards had faint borders in light themes. | Explicit light-theme surfaces/borders and logo tile contrast. |
`;
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
fs.writeFileSync(p, c, 'utf8');
console.log('docs updated');
