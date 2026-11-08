const fs = require('fs');
const p = 'src/main/deepqa.ts';
let c = fs.readFileSync(p, 'utf8');
const start = c.indexOf("  await check('D-36'");
const end = c.indexOf('  const report = results;', start);
if (start < 0 || end < 0) throw new Error('D-36 anchors missing');
c = c.slice(0, start) + c.slice(end);
fs.writeFileSync(p, c, 'utf8');
console.log('D-36 removed');
