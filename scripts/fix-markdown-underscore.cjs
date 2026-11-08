const fs = require('fs');
const p = 'src/renderer/src/components/Markdown.tsx';
const lines = fs.readFileSync(p, 'utf8').split('\n');
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i].includes('const pattern =')) {
    lines[i] = '  const pattern = /(`[^`]+`)|(\\*\\*[^*]+\\*\\*)|(\\*[^*\\n]+\\*)|(\\[[^\\]]+\\]\\([^)]+\\))|(https?:\\/\\/[^\\s<)]+)/g;';
    break;
  }
}
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('markdown pattern simplified');
