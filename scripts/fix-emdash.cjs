const fs = require('fs');
const p = 'src/renderer/src/onboarding/StoryIntro.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.split('\u00e2\u20ac\u201d').join('\u2014');
c = c.split('\u00e2\u20ac\u201c').join('\u2013');
fs.writeFileSync(p, c, 'utf8');
console.log('mojibake left:', c.includes('\u00e2\u20ac'));
