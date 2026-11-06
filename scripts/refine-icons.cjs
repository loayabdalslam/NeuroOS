const fs = require('fs');
const p = 'src/renderer/src/components/SystemIcon.tsx';
let c = fs.readFileSync(p, 'utf8');

const layersOld = `  layers: f(VIOLET, [
    p('M12 2.2l9.4 5-9.4 5-9.4-5z', 0),
    p('M2.6 11.4l9.4 5 9.4-5 1.6.9-11 5.8-11-5.8z', 1, 0.9),
    p('M2.6 15.8l9.4 5 9.4-5 1.6.9-11 5.8-11-5.8z', 2, 0.6),
  ]),`;
const layersNew = `  layers: f(VIOLET, [
    r(3.4, 3.2, 17.2, 4.6, 2, 0),
    r(2.4, 9.2, 19.2, 4.6, 2, 1),
    r(3.4, 15.2, 17.2, 4.6, 2, 2, 0.95),
  ]),`;

const composerOld = `  composer: f(VIOLET, [
    p('M12 2.4l3.2 1.9v3.8L12 10l-3.2-1.9V4.3z', 0),
    p('M5.2 12.4l3.2 1.9v3.8L5.2 20l-3.2-1.9v-3.8z', 1),
    p('M18.8 12.4l3.2 1.9v3.8L18.8 20l-3.2-1.9v-3.8z', 2),
    p('M10.6 6.6l-4 2.2.8 1.5 4-2.2zM13.4 6.6l4 2.2-.8 1.5-4-2.2z', 3, 0.7),
  ]),`;
const composerNew = `  composer: f(VIOLET, [
    p('M12 1.6l4.6 2.7v5.4L12 12.4 7.4 9.7V4.3z', 0),
    p('M5 12.2l4.6 2.7v5.4L5 23l-4.6-2.7v-5.4z', 1),
    p('M19 12.2l4.6 2.7v5.4L19 23l-4.6-2.7v-5.4z', 2),
    p('M9.6 6.9L4.4 10v1.8l5.2-3.1zM14.4 6.9l5.2 3.1V12l-5.2-3.1z', 3, 0.6),
  ]),`;

const automationOld = `  automation: f(BLUE, [
    p('M5 7.6h5.4v1.8H5zM13.6 7.6H19v1.8h-5.4zM11 8.5h2v7h-2z', 2, 0.7),
    p('M6.8 14.2h4.4v1.8H6.8z', 2, 0.7),
    c(3.4, 8.5, 2.6, 0),
    c(20.6, 8.5, 2.6, 1),
    c(12, 17.4, 2.6, 2),
    c(12, 5.2, 2.2, 3),
  ]),`;
const automationNew = `  automation: f(BLUE, [
    p('M6.4 8h4.2v2H6.4zM13.4 8h4.2v2h-4.2zM11 9h2v6.6h-2zM7.4 14.4h9.2v2H7.4z', 2, 0.8),
    c(4.4, 9, 3.2, 0),
    c(19.6, 9, 3.2, 1),
    c(12, 18.4, 3.2, 2),
    c(12, 4.4, 2.6, 3),
  ]),`;

const pinOld = `  pin: f(RED, [
    p('M14.2 2.4l7.4 7.4-2.6 2.6-1.2-.4-4.4 4.4.4 4.2-1.6 1.6-4.2-4.2-4.6 4.6-1.8-1.8 4.6-4.6-4.2-4.2 1.6-1.6 4.2.4 4.4-4.4-.4-1.2z', 0),
    c(16, 8, 1.4, 1, 0.5),
  ]),`;
const pinNew = `  pin: f(RED, [
    p('M12 1.8a6.8 6.8 0 0 1 6.8 6.8c0 4.9-6.8 13.6-6.8 13.6S5.2 13.5 5.2 8.6A6.8 6.8 0 0 1 12 1.8z', 0),
    c(12, 8.4, 2.6, 1, 0.95),
    p('M11.2 15.4h1.6v6.2h-1.6z', 2, 0.6),
  ]),`;

const anchorGlyph = `  anchor: f(BLUE, [
    c(12, 4.4, 2.2, 1),
    p('M11.1 6.6h1.8v9.8h-1.8z', 0),
    p('M12 16.4c-4.2 0-7.4-2.8-7.8-6.4H2.4c.4 4.9 4.4 8.2 9.6 8.2s9.2-3.3 9.6-8.2h-1.8c-.4 3.6-3.6 6.4-7.8 6.4z', 0),
    p('M6.2 10.4h3.6v1.8H6.2zM14.2 10.4h3.6v1.8h-3.6z', 2, 0.85),
  ]),
`;

for (const [oldBlock, newBlock, label] of [
  [layersOld, layersNew, 'layers'],
  [composerOld, composerNew, 'composer'],
  [automationOld, automationNew, 'automation'],
  [pinOld, pinNew, 'pin'],
]) {
  if (!c.includes(oldBlock)) {
    console.log('missing', label);
    continue;
  }
  c = c.replace(oldBlock, newBlock);
}

if (!c.includes('  anchor:')) {
  c = c.replace('  dashboard: f(BLUE,', anchorGlyph + '  dashboard: f(BLUE,');
}

fs.writeFileSync(p, c, 'utf8');
console.log('glyphs refined');
