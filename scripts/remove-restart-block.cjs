const fs = require('fs');
const p = 'src/main/redteam.ts';
let c = fs.readFileSync(p, 'utf8');

const start = c.indexOf('  const restarted = new MailService');
const m7 = c.indexOf("'M-07'", start);
if (start > -1 && m7 > -1) {
  const addStart = c.lastIndexOf('  add(', m7);
  const lineEnd = c.indexOf('\n', m7);
  c = c.slice(0, start) + '  const restartPort = victimPort;' + c.slice(lineEnd);
  console.log('removed restart block from', start, 'to', lineEnd, 'addStart', addStart);
} else {
  console.log('markers missing', start, m7);
}

c = c.replace(/^\s*await restarted\.dispose\(\);\s*$/gm, '');
fs.writeFileSync(p, c, 'utf8');
console.log('restarted references left:', (c.match(/restarted/g) || []).length);
