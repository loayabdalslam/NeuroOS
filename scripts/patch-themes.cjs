const fs = require('fs');
const root = 'C:\\Work\\Research\\AGI\\Neuro Os\\';

let p = root + 'src\\renderer\\src\\styles\\tokens.css';
let c = fs.readFileSync(p, 'utf8');
const accents = [
  ['  --n-accent: #4cc2ff;', '  --n-accent: #4cc2ff;\n  --n-violet: #60cdff;'],
  ['  --n-accent: #0067c0;', '  --n-accent: #0067c0;\n  --n-violet: #0f83d6;'],
  ['  --n-accent: #e95420;', '  --n-accent: #e95420;\n  --n-violet: #77216f;'],
  ['  --n-accent: #c7162b;', '  --n-accent: #c7162b;\n  --n-violet: #77216f;'],
  ['  --n-accent: #0a84ff;', '  --n-accent: #0a84ff;\n  --n-violet: #5e5ce6;'],
  ['  --n-accent: #007aff;', '  --n-accent: #007aff;\n  --n-violet: #5e5ce6;'],
];
for (const [from, to] of accents) {
  if (!c.includes(from)) console.log('MISS accent', from);
  c = c.replace(from, to);
}
fs.writeFileSync(p, c, 'utf8');

p = root + 'src\\renderer\\src\\surfaces\\Desktop.tsx';
c = fs.readFileSync(p, 'utf8');
c = c.replace('<span className="tiny faint uppercase">kernel</span>', '<span className="tiny faint uppercase">status</span>');
fs.writeFileSync(p, c, 'utf8');

p = root + 'src\\renderer\\src\\styles\\shell.css';
c = fs.readFileSync(p, 'utf8');
c = c.replace('.titlebar__tabs {\n  display: flex;', '.titlebar__tabs {\n  mask-image: linear-gradient(90deg, #000 94%, transparent);\n  display: flex;');
fs.writeFileSync(p, c, 'utf8');

p = root + 'src\\main\\index.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "    router?.emit('ui:navigate', { surface: 'desktop', params: {} });\n    await wait(1100);",
  "    router?.emit('ui:navigate', { surface: 'desktop', params: {} });\n    await wait(700);\n    await win.webContents.executeJavaScript(\"document.querySelector('.desk__scroll')?.scrollTo(0,0)\").catch(() => {});\n    await wait(400);",
);
fs.writeFileSync(p, c, 'utf8');
console.log('patched ok');
