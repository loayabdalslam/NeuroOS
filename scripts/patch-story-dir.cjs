const fs = require('fs');
const p = 'src/renderer/src/onboarding/StoryIntro.tsx';
let c = fs.readFileSync(p, 'utf8');
const from = '<div className="story" dir="rtl">';
const to = '<div className="story" dir={arabic ? \'rtl\' : \'ltr\'}>';
if (c.includes(from)) {
  c = c.replace(from, to);
  fs.writeFileSync(p, c, 'utf8');
  console.log('story dir patched');
} else {
  console.log('anchor missing', c.includes('dir="rtl"'));
}
