const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Wallpaper legibility')) {
  b += [
    '',
    '## Wallpaper legibility (all themes, all wallpapers)',
    '',
    '| Issue | Fix |',
    '| --- | --- |',
    '| On the light theme, photo/custom wallpapers were covered by a white gradient, leaving desktop labels, the welcome card and dock labels washed out (black text on a pale image). | Photo/custom wallpapers now use a dark scrim on every theme (`rgba(4,6,12,.4→.62)`), desktop labels sit on a blurred contrast chip (white on dark for photos, theme-aware for gradients), the welcome block is a glass card with white text, and light-theme dock labels use stronger text tokens. Applies to every existing and future `photo:*`/custom wallpaper via the shared selector. |',
    '| Verification | D-39 asserts icon label `rgb(255,255,255)`, chip `rgba(7,9,15,.62)`, and a dark desktop scrim on Ubuntu light + Blue Marble. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
let d = fs.readFileSync('docs/DEEP-QA.md', 'utf8');
d = d.replace('| Checks | **37** |', '| Checks | **38** |').replace('| Pass | **35** |', '| Pass | **36** |');
fs.writeFileSync('docs/DEEP-QA.md', d, 'utf8');
console.log('wallpaper docs updated');
