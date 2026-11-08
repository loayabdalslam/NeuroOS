const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  "    const cards = await win.webContents.executeJavaScript(`document.querySelectorAll('.providerPick').length`);",
  "    const cards = await win.webContents.executeJavaScript(`document.querySelectorAll('.providerPick').length`);\n    const gridStyle = await win.webContents.executeJavaScript(\n      `(() => { const el = document.querySelector('.providerGrid'); if (!el) return null; const s = getComputedStyle(el); return { display: s.display, cols: s.gridTemplateColumns, width: el.clientWidth, rect: el.getBoundingClientRect().width }; })()`,\n    );",
);
c = c.replace(
  "    return { evidence: `${cards} provider cards rendered in ios-light` };",
  "    return { evidence: `${cards} cards; ${JSON.stringify(gridStyle)}` };",
);
fs.writeFileSync(p, c, 'utf8');
console.log('grid probe added', c.includes('gridStyle'));
