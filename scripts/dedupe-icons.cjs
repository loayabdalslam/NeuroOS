const fs = require('fs');
const p = 'src/renderer/src/components/SystemIcon.tsx';
const lines = fs.readFileSync(p, 'utf8').split('\n');
const removePrefixes = ["  'rotate-ccw': s(", '  library: s(', "  'server-cog': s("];
const out = lines.filter((line) => !removePrefixes.some((prefix) => line.startsWith(prefix)));
console.log('removed', lines.length - out.length, 'duplicate lines');
fs.writeFileSync(p, out.join('\n'), 'utf8');
