const fs = require('fs');
const p = 'src/renderer/src/components/SystemIcon.tsx';
let c = fs.readFileSync(p, 'utf8');

const autoRe = /  automation: f\(BLUE, \[[\s\S]*?\n  \]\),/;
const composerRe = /  composer: f\(VIOLET, \[[\s\S]*?\n  \]\),/;

const auto = `  automation: f(BLUE, [
    r(2.4, 4, 8.8, 6.6, 2.2, 0),
    r(12.8, 13.4, 8.8, 6.6, 2.2, 1),
    p('M10.2 6.6h3.4v2h-3.4zM12 6.6h1.8v9.2H12zM12.8 13.8h3.6v2h-3.6z', 2, 0.9),
  ]),`;
const composer = `  composer: f(VIOLET, [
    p('M6.6 2.4l4.4 2.5v5L6.6 12.4 2.2 9.9v-5z', 0),
    p('M17.4 11.6l4.4 2.5v5l-4.4 2.5-4.4-2.5v-5z', 1),
    p('M10.2 4.8h1.8v6.2h-1.8zM10.2 10.4h6.8v1.8h-6.8z', 2, 0.9),
  ]),`;

if (!autoRe.test(c)) console.log('automation not found');
c = c.replace(autoRe, auto);
if (!composerRe.test(c)) console.log('composer not found');
c = c.replace(composerRe, composer);
fs.writeFileSync(p, c, 'utf8');
console.log('flow glyphs updated');
