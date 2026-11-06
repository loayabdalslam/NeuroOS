const fs = require('fs');
const p = 'src/main/qa.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.split(' key=${mask(key)}').join('');
c = c
  .split('\n')
  .filter((line) => !line.trim().startsWith('const mask ='))
  .join('\n');
fs.writeFileSync(p, c, 'utf8');
console.log('mask refs left:', c.includes('mask('), 'line:', c.split('\n').find((line) => line.includes('key=')) ?? 'none');
