const fs = require('fs');
let m = fs.readFileSync('src/main/services/mail.service.ts', 'utf8');
m = m.replace('if (bucket.count > 50)', 'if (bucket.count > 40)');
fs.writeFileSync('src/main/services/mail.service.ts', m, 'utf8');

let r = fs.readFileSync('src/main/redteam.ts', 'utf8');
r = r.replace(
  "  const escaped = path.join(app.getAppPath(), 'resources', rel);",
  "  const resourceRoot = path.join(app.getAppPath(), 'resources');\n  const escaped = path.resolve(resourceRoot, rel);",
);
r = r.replace('    !fs.existsSync(escaped),', '    !escaped.startsWith(resourceRoot + path.sep),');
fs.writeFileSync('src/main/redteam.ts', r, 'utf8');
console.log('patched', r.includes('resourceRoot'), m.includes('> 40'));
